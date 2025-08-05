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
        const isFullCharge = weaponType === 'SR' || weaponType === 'RL';
        
        // 특수 공격 처리
        let totalPellets = character.baseStats.basePellets || 1;
        let chargeMultiplier = 1;
        
        if (charState.replaceAttack) {
            // 대체 공격 적용
            const modifiers = charState.replaceAttack.modifiers;
            totalPellets += modifiers.pelletBonus || 0;
            // 다른 수정사항은 버프로 처리됨
        } else if (isFullCharge) {
            // 풀차지 대미지 배율
            chargeMultiplier = character.baseStats.chargeMultiplier || 2.5;
        }
        
        // 명중률 계산
        const accuracy = character.baseStats.accuracy || 0;
        const totalAccuracy = accuracy + (buffs.accuracy || 0);
        
        // 코어 히트율 계산
        const spread = this.calculateSpread(weaponType, totalAccuracy);
        const coreHitRate = this.calculateCoreHitRate(spread, config.coreSize, weaponType);
        
        // 펠릿당 계산
        let totalDamage = 0;
        let coreHits = 0;
        let pelletsHit = 0;
        
        for (let i = 0; i < totalPellets; i++) {
            const hitCore = Math.random() < coreHitRate;
            if (hitCore) {
                coreHits++;
                pelletsHit++;
            }
        }
        
        // 크리티컬 판정
        const critRate = buffs.critRate || window.CRIT_RATE;
        const isCrit = Math.random() < critRate;
        
        // 기본 대미지 계산
        const baseAtk = character.baseStats.atk;
        const weaponCoef = character.baseStats.weaponCoef;
        
        // 최종 공격력
        const finalAtk = baseAtk * (1 + (buffs.atkPercent || 0) + (buffs.fixedATK || 0));
        
        // 기본 대미지
        const baseDamage = finalAtk * weaponCoef * chargeMultiplier;
        
        // 크리티컬 대미지
        const critMultiplier = isCrit ? (1 + (buffs.critDamage || window.CRIT_DMG)) : 1;
        
        // 대미지 증가 버프
        const damageMultiplier = 1 + (buffs.damageIncrease || 0) + (buffs.partDamage || 0);
        
        // 우월코드 대미지
        const eliteMultiplier = config.eliteCode === 'yes' ? (1 + (buffs.eliteDamage || 0)) : 1;
        
        // 소장품 보너스
        const collectionBonus = this.getCollectionBonus(weaponType);
        const collectionMultiplier = collectionBonus.damageMultiplier || 1;
        
        // 거리 보정
        const distanceMultiplier = this.getDistanceMultiplier(weaponType, config.distance);
        
        // 방어력 계산
        const defense = window.ENEMY_DEF || 0;
        const defenseReduction = defense / (defense + finalAtk);
        const defenseMultiplier = 1 - defenseReduction;
        
        // 최종 대미지 계산
        const pelletsHitDamage = baseDamage * coreHits * critMultiplier * 
            damageMultiplier * eliteMultiplier * collectionMultiplier * 
            distanceMultiplier * defenseMultiplier;
        
        totalDamage = Math.floor(pelletsHitDamage);
        
        return {
            damage: totalDamage,
            isCrit,
            pelletsHit,
            coreHits,
            totalPellets
        };
    }
    
    /**
     * 거리 보정 계산
     */
    getDistanceMultiplier(weaponType, distance) {
        const optimalDistance = window.OPTIMAL_DISTANCE[weaponType] || 3;
        const diff = Math.abs(distance - optimalDistance);
        
        // 거리별 페널티 (간단화)
        const penalty = diff * 0.05;
        return Math.max(0.7, 1 - penalty);
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