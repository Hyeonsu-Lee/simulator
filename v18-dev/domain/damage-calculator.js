// domain/damage-calculator.js - 대미지 계산기 (순환 참조 제거)

class DamageCalculator {
    constructor(dependencies) {
        this.eventBus = dependencies.eventBus;
        
        // 이벤트 구독
        this.subscribeToEvents();
    }
    
    subscribeToEvents() {
        this.eventBus.on(Events.CALCULATE_DAMAGE, (event) => this.handleCalculateDamage(event));
    }
    
    /**
     * 대미지 계산 요청 처리
     */
    handleCalculateDamage(event) {
        const { requestId, characterId, character, charState, buffs, config, time } = event.data;
        
        try {
            const damageResult = this.calculateDamage(
                character,
                charState,
                buffs,
                config
            );
            
            // 결과 이벤트 발생
            this.eventBus.emit(Events.DAMAGE_CALCULATED, {
                requestId,
                characterId,
                damageResult,
                time
            });
        } catch (error) {
            console.error('[DamageCalculator] Error:', error);
            
            // 에러 시 기본값
            this.eventBus.emit(Events.DAMAGE_CALCULATED, {
                requestId,
                characterId,
                damageResult: {
                    damage: 0,
                    isCrit: false,
                    pelletsHit: 0,
                    coreHits: 0,
                    totalPellets: 1
                },
                time
            });
        }
    }
    
    
    /**
     * 대미지 계산
     */
    calculateDamage(character, charState, buffs, config) {
        const weaponType = character.baseStats.weaponType || character.weaponType;
        let totalPellets = character.baseStats.basePellets || 1;

        if (charState.replaceAttack) {
            totalPellets = charState.replaceAttack.modifiers.pelletsPerShot || 1;
        }

        const totalAccuracy = (buffs.accuracy || 0);
        const spread = this.calculateSpread(weaponType, totalAccuracy, config.distance);
        const coreHitRate = this.calculateCoreHitRate(spread, config.coreSize || 30, weaponType);

        let shotDamage = 0;
        let coreHits = 0;
        let pelletsHit = 0;
        let critCount = 0;

        const baseAtk = character.baseStats.atk;
        const weaponCoef = character.baseStats.weaponCoef;
        const enemyDef = window.ENEMY_DEF || 0;
        const collectionBonus = this.getCollectionBonus(weaponType);

        for (let i = 0; i < totalPellets; i++) {
            const isCrit = Math.random() < (buffs.critRate || window.CRIT_RATE || 0.15);
            const isCore = Math.random() < coreHitRate;
            
            const triggers = {
                crit: isCrit ? 1 : 0,
                core: isCore ? 1 : 0,
                distance: this.hasDistanceBonus(weaponType, parseInt(config.distance)) ? 1 : 0,
                fullburst: 0,
                part: 0,
                penetration: this.hasPenetration(character, charState) ? 1 : 0,
                dot: 0,
                defIgnore: 0,
                charge: 0,
                elite: config.eliteCode === 'yes' ? 1 : 0,
                distributed: (buffs.distributedDamage || 0) > 0 ? 1 : 0
            };
            
            const damage = this.calculateGeneralDamage(baseAtk, enemyDef, weaponCoef, 0, buffs, triggers, collectionBonus);
            shotDamage += damage;
            pelletsHit++;
            
            if (isCrit) critCount++;
            if (isCore) coreHits++;
        }

        shotDamage = Math.round(shotDamage / totalPellets);

        return {
            damage: shotDamage,
            isCrit: critCount > 0,
            pelletsHit,
            coreHits,
            totalPellets
        };
    }
    
    calculateGeneralDamage(baseAtk, enemyDef, weaponCoef, chargeCoef, buffs, triggers, collectionBonus) {
        const targetAtkWithBuff = baseAtk * (1 + (buffs.atkPercent || 0));
        const totalAtk = targetAtkWithBuff + (buffs.fixedATK || 0);
        
        if (totalAtk - enemyDef < 1) return 1;
        
        const baseDamage = (totalAtk - enemyDef) * weaponCoef;
        
        const critCoreMultiplier = 1 + 
            (triggers.crit * (0.5 + (buffs.critDamage || 0))) +
            (triggers.core * (1.0 + (buffs.coreBonus || 0) + collectionBonus.coreBonus)) +
            (triggers.distance * 0.3) + (buffs.distanceBonus || 0) +
            (triggers.fullburst * 0.5);
        
        const damageMultiplier = 1 + 
            (buffs.damageIncrease || 0) + 
            (triggers.part * (buffs.partDamage || 0)) +
            (triggers.penetration * (buffs.penetrationDamage || 0)) +
            (triggers.dot * (buffs.dotDamage || 0)) +
            (triggers.defIgnore * (buffs.defIgnoreDamage || 0));
        
        let chargeMultiplier = 1;
        if (triggers.charge) {
            chargeMultiplier = chargeCoef + (buffs.chargeDamage || 0);
            chargeRatio = collectionBonus.chargeRatio + (buffs.chargeRatio || 0);
            chargeMultiplier += chargeMultiplier * chargeRatio;
        }
        
        const eliteMultiplier = triggers.elite ? (1.1 + 0.1909 + (buffs.eliteDamage || 0)) : 1;
        
        const receivedMultiplier = 1 + 
            (buffs.receivedDamage || 0) + 
            (triggers.distributed * (buffs.distributedDamage || 0));
        
        const finalDamage = baseDamage * critCoreMultiplier * damageMultiplier * 
            chargeMultiplier * eliteMultiplier * receivedMultiplier * 
            collectionBonus.damageMultiplier;
        
        return Math.round(finalDamage);
    }

    /**
     * 관통 트리거
     */
    hasPenetration(character, charState) {
        // 1. 스킬로 인한 일시적 관통 (우선순위 높음)
        if (charState.replaceAttack?.modifiers?.penetration) {
            return true;
        }
        
        // 2. 캐릭터 기본 관통 속성
        return character.baseStats.penetration || false;
    }

    /**
     * 거리 보정 트리거
     */
    hasDistanceBonus(weaponType, distance) {
        const bonusRanges = window.DISTANCE_BONUS_RANGES[weaponType];
        return bonusRanges && bonusRanges.includes(distance);
    }
    
    /**
     * 소장품 보너스 가져오기
     */
    getCollectionBonus(weaponType) {
        return window.COLLECTION_BONUS[weaponType] || {
            coreBonus: 0,
            chargeRatio: 0,
            damageMultiplier: 1,
            maxAmmo: 0
        };
    }
    
    /**
     * 분산도 계산
     */
    calculateSpread(weaponType, accuracy) {
        // RL, SR, MG는 탄착원 계산 불필요 (항상 명중)
        if (weaponType === 'RL' || weaponType === 'SR' || weaponType === 'MG') {
            return 0; // 또는 의미없는 작은 값
        }
        
        // AR, SMG, SG만 실제 공식 적용
        const params = window.WEAPON_ACCURACY_PARAMS[weaponType];
        
        if (!params) {
            console.warn(`No accuracy params for weapon type: ${weaponType}`);
            return 5; // 기본값
        }
        
        // 실제 공식: 탄착원 = base - reduction × Hit_Rate(%)
        const hitRate = accuracy; // accuracy가 Hit Rate %로 사용됨
        const spread = params.base - params.reduction * hitRate;
        return Math.max(spread, 1); // 최소값 1
    }
    
    /**
     * 코어 히트율 계산 (유틸 함수)
     */
    calculateCoreHitRate(spread, coreSize, weaponType) {
        // RL, SR, MG는 항상 100% 명중
        if (weaponType === 'RL' || weaponType === 'SR' || weaponType === 'MG') {
            return 1.0;
        }
        
        if (coreSize === 0) return 0;
        
        // 탄착원이 코어보다 작거나 같으면 100% 명중
        if (spread <= coreSize) {
            return 1.0;
        }
        
        // AR, SMG, SG만 가우시안 분포 확률 계산
        const sigmaRatio = weaponType === 'SG' ? 3 : 4;
        const sigma = spread / sigmaRatio;
        const coreRadius = coreSize / 2;
        
        // 2D 가우시안 분포 확률 공식
        const hitProbability = 1 - Math.exp(-(coreRadius * coreRadius) / (2 * sigma * sigma));
        
        return Math.min(hitProbability, 1.0);
    }
}

// 전역 노출  
window.DamageCalculator = DamageCalculator;