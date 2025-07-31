// domain/damage-calculator.js - 대미지 계산기 (이벤트 기반)

class DamageCalculator {
    constructor(dependencies) {
        this.eventBus = dependencies.eventBus;
        this.mediator = dependencies.mediator;
        
        this.subscribeToEvents();
        this.registerMediatorHandlers();
    }
    
    subscribeToEvents() {
        // 대미지 계산 요청
        this.eventBus.on(Events.CALCULATE_DAMAGE, (event) => this.handleCalculateRequest(event));
    }
    
    registerMediatorHandlers() {
        // 소장품 보너스 요청 핸들러
        this.mediator.registerHandler('GET_COLLECTION_BONUS', async (data) => {
            return this.getCollectionBonus(data.weaponType);
        });
        
        // 즉시 대미지 계산 요청 핸들러
        this.mediator.registerHandler('CALCULATE_INSTANT_DAMAGE', async (data) => {
            return this.calculateInstantDamage(data);
        });
        
        // 버스트 대미지 계산 요청 핸들러
        this.mediator.registerHandler('CALCULATE_BURST_DAMAGE', async (data) => {
            return this.calculateBurstDamage(data);
        });
    }
    
    /**
     * 대미지 계산 요청 처리
     */
    async handleCalculateRequest(event) {
        const {
            requestId,
            characterId,
            character,
            charState,
            buffs,
            config,
            isSpecialAttack,
            time
        } = event.data;
        
        // 대미지 계산
        const damageResult = this.calculateAttackDamage({
            character,
            charState,
            buffs,
            config,
            isSpecialAttack
        });
        
        // 결과 이벤트 발생
        this.eventBus.emit(Events.DAMAGE_CALCULATED, {
            requestId,
            characterId,
            damageResult,
            time
        });
    }
    
    /**
     * 일반 공격 대미지 계산
     * @param {Object} params
     * @returns {Object} 대미지 결과
     */
    calculateAttackDamage(params) {
        const {
            character,
            charState,
            buffs,
            config,
            isSpecialAttack = false
        } = params;
        
        const stats = character.getStats();
        const weaponParams = character.baseStats;
        
        // 명중률 기반 산포도 계산
        const spread = this.calculateSpreadDiameter(character.weaponType, buffs.accuracy);
        const coreHitRate = this.calculateCoreHitRate(spread, config.coreSize || 30, character.weaponType);
        
        // 펠릿 수 계산
        let pelletsPerShot = weaponParams.basePellets + (buffs.pelletBonus || 0);
        
        // 특수 공격 처리 (도로시)
        if (isSpecialAttack && charState.replaceAttack) {
            pelletsPerShot = charState.replaceAttack.modifiers.pelletsPerShot || pelletsPerShot;
        }
        
        let totalDamage = 0;
        let coreHits = 0;
        let critHits = 0;
        const pelletResults = [];
        
        // 각 펠릿별 대미지 계산
        for (let i = 0; i < pelletsPerShot; i++) {
            const isCrit = this.checkProbability(buffs.critRate + (buffs.helmCritBonus || 0));
            const isCore = this.checkProbability(coreHitRate);
            
            // SR/RL 풀차지 여부
            const isFullCharge = (character.weaponType === 'SR' || character.weaponType === 'RL');
            const chargeCoef = isFullCharge ? (weaponParams.chargeMultiplier || 2.5) : 0;
            
            // 최적 거리
            const OPTIMAL_DISTANCE = {
                AR: 3, SMG: 2, SR: 4, RL: 4, MG: 3, SG: 1
            };
            
            const triggers = {
                crit: isCrit ? 1 : 0,
                core: isCore ? 1 : 0,
                distance: config.distance === OPTIMAL_DISTANCE[character.weaponType] ? 1 : 0,
                fullburst: buffs.isFullBurst ? 1 : 0,
                part: 0,
                penetration: isSpecialAttack && charState.replaceAttack?.modifiers.penetration ? 1 : 0,
                dot: 0,
                defIgnore: 0,
                charge: isFullCharge ? 1 : 0,
                elite: config.eliteCode === 'yes' ? 1 : 0,
                distributed: buffs.distributedDamage > 0 ? 1 : 0
            };
            
            const collectionBonus = this.getCollectionBonus(character.weaponType);
            
            // 상수들
            const ENEMY_DEF = 6070;
            
            const damage = this.calculateGeneralDamage(
                stats.atk,
                ENEMY_DEF,
                weaponParams.weaponCoef,
                chargeCoef,
                buffs,
                triggers,
                collectionBonus
            );
            
            totalDamage += damage;
            if (isCrit) critHits++;
            if (isCore) coreHits++;
            
            pelletResults.push({
                damage,
                isCrit,
                isCore
            });
        }
        
        // 샷건은 펠릿당 대미지 분할
        if (character.weaponType === 'SG') {
            totalDamage = Math.round(totalDamage / pelletsPerShot);
        }
        
        return {
            damage: totalDamage,
            pelletsHit: pelletsPerShot,
            coreHits: coreHits,
            critHits: critHits,
            pelletResults: pelletResults,
            isSpecialAttack: isSpecialAttack
        };
    }
    
    /**
     * 일반화된 대미지 계산
     */
    calculateGeneralDamage(baseAtk, enemyDef, weaponCoef, chargeCoef, buffs, triggers, collectionBonus) {
        // 1. 타겟 니케의 기본 공격력에 공격력 버프 적용
        const targetAtkWithBuff = baseAtk * (1 + buffs.atkPercent);
        
        // 2. 시전자 기준 공격력(fixedATK)을 더함
        const totalAtk = targetAtkWithBuff + buffs.fixedATK;
        
        // 3. 방어력 차감 후 1 미만이면 즉시 1 반환
        if (totalAtk - enemyDef < 1) {
            return 1;
        }
        
        // 4. 기본 대미지 계산
        const baseDamage = (totalAtk - enemyDef) * weaponCoef;
        
        // 5. 크리티컬/코어 배수 계산
        const critCoreMultiplier = 1 + 
            (triggers.crit * (0.5 + buffs.critDamage)) +
            (triggers.core * (1.0 + buffs.coreBonus + collectionBonus.coreBonus)) +
            (triggers.distance * 0.3) + buffs.distanceBonus +
            (triggers.fullburst * 0.5);
        
        // 6. 대미지 증가 배수 계산
        const damageMultiplier = 1 + 
            buffs.damageIncrease + 
            (triggers.part * buffs.partDamage) +
            (triggers.penetration * buffs.penetrationDamage) +
            (triggers.dot * buffs.dotDamage) +
            (triggers.defIgnore * buffs.defIgnoreDamage);
        
        // 7. 차지 대미지 계산
        let chargeMultiplier = 1;
        if (triggers.charge) {
            chargeMultiplier = chargeCoef + buffs.chargeDamage;
            chargeMultiplier += chargeMultiplier * collectionBonus.chargeRatio;
        }
        
        // 8. 우월코드 배수
        const eliteMultiplier = triggers.elite ? (1.1 + 0.1909 + buffs.eliteDamage) : 1;

        // 9. 받는 대미지 증가 배수
        const receivedMultiplier = 1 + 
            buffs.receivedDamage + 
            (triggers.distributed * buffs.distributedDamage);
        
        // 10. 최종 대미지 계산 (소장품 대미지 배수 포함)
        const finalDamage = baseDamage * critCoreMultiplier * damageMultiplier * 
            chargeMultiplier * eliteMultiplier * receivedMultiplier * 
            collectionBonus.damageMultiplier;
        
        // 11. 최종 대미지만 반올림
        return Math.round(finalDamage);
    }
    
    /**
     * 즉시 대미지 계산 (스킬)
     */
    calculateInstantDamage(params) {
        const { source, damage, buffs } = params;
        
        let finalDamage = 0;
        
        if (damage.type === 'atkMultiplier') {
            // 공격력 배수
            const baseAtk = source.baseStats ? source.baseStats.atk : 0;
            const totalAtk = baseAtk * (1 + buffs.atkPercent) + buffs.fixedATK;
            finalDamage = Math.floor(totalAtk * damage.value);
        } else if (damage.type === 'damagePercent') {
            // 대미지 퍼센트
            finalDamage = damage.value;
        }
        
        // 대미지 증가 적용
        finalDamage *= (1 + buffs.damageIncrease);
        
        return Math.floor(finalDamage);
    }
    
    /**
     * 버스트 대미지 계산
     */
    calculateBurstDamage(params) {
        const { source, damage, buffs } = params;
        
        const baseAtk = source.baseStats ? source.baseStats.atk : 0;
        const totalAtk = baseAtk * (1 + buffs.atkPercent) + buffs.fixedATK;
        let finalDamage = Math.floor(totalAtk * damage.value);
        
        // 버스트 대미지는 항상 크리티컬
        finalDamage *= (1 + buffs.critDamage);
        
        // 대미지 증가 적용
        finalDamage *= (1 + buffs.damageIncrease);
        
        return Math.floor(finalDamage);
    }
    
    /**
     * 소장품 보너스 계산
     */
    getCollectionBonus(weaponType) {
        const COLLECTION_BONUS = {
            AR: {
                coreBonus: 0,
                chargeRatio: 0,
                damageMultiplier: 1,
                maxAmmo: 0
            },
            SMG: {
                coreBonus: 0,
                chargeRatio: 0,
                damageMultiplier: 1,
                maxAmmo: 0.15
            },
            SR: {
                coreBonus: 0.1,
                chargeRatio: 0.15,
                damageMultiplier: 1,
                maxAmmo: 0
            },
            RL: {
                coreBonus: 0,
                chargeRatio: 0.1,
                damageMultiplier: 1.1,
                maxAmmo: 0
            },
            MG: {
                coreBonus: 0,
                chargeRatio: 0,
                damageMultiplier: 1,
                maxAmmo: 0.15
            },
            SG: {
                coreBonus: 0.15,
                chargeRatio: 0,
                damageMultiplier: 1,
                maxAmmo: 0
            }
        };
        
        const bonus = {
            coreBonus: 0,
            chargeRatio: 0,
            damageMultiplier: 1,
            maxAmmo: 0
        };
        
        const collection = COLLECTION_BONUS[weaponType];
        if (collection) {
            Object.assign(bonus, collection);
        }
        
        return bonus;
    }
    
    /**
     * 확률 체크 (유틸 함수)
     */
    checkProbability(probability) {
        return Math.random() < probability;
    }
    
    /**
     * 산포도 계산 (유틸 함수)
     */
    calculateSpreadDiameter(weaponType, accuracy) {
        const BASE_ACCURACY = {
            AR: 50, SMG: 30, SR: 80, RL: 70, MG: 40, SG: 20
        };
        const SPREAD_COEFFICIENT = {
            AR: 0.5, SMG: 0.8, SR: 0.3, RL: 0.4, MG: 0.7, SG: 1.0
        };
        
        const baseAccuracy = BASE_ACCURACY[weaponType] || 50;
        const coefficient = SPREAD_COEFFICIENT[weaponType] || 0.5;
        
        const totalAccuracy = baseAccuracy + accuracy;
        const spread = 100 / (1 + totalAccuracy / 100) * coefficient;
        
        return Math.max(5, spread);
    }
    
    /**
     * 코어 히트율 계산 (유틸 함수)
     */
    calculateCoreHitRate(spread, coreSize, weaponType) {
        if (coreSize === 0) return 0;
        
        let hitRate = coreSize / spread;
        
        if (weaponType === 'SR' || weaponType === 'RL') {
            hitRate *= 1.2;
        } else if (weaponType === 'SG') {
            hitRate *= 0.8;
        }
        
        return Math.min(1, Math.max(0, hitRate));
    }
}

// 전역 노출  
window.DamageCalculator = DamageCalculator;

// 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DamageCalculator;
}