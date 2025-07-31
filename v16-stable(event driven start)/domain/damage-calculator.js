// domain/damage-calculator.js - 대미지 계산기

class DamageCalculator {
    constructor() {
        // 순수 계산기이므로 상태 없음
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
        const spread = calculateSpreadDiameter(character.weaponType, buffs.accuracy);
        const coreHitRate = calculateCoreHitRate(spread, config.coreSize || 30, character.weaponType);
        
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
            const isCrit = checkProbability(buffs.critRate + (buffs.helmCritBonus || 0));
            const isCore = checkProbability(coreHitRate);
            
            // SR/RL 풀차지 여부
            const isFullCharge = (character.weaponType === 'SR' || character.weaponType === 'RL');
            const chargeCoef = isFullCharge ? (weaponParams.chargeMultiplier || 2.5) : 0;
            
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
}

// 전역 대미지 계산기
const damageCalculator = new DamageCalculator();

// 내보내기
window.DamageCalculator = DamageCalculator;
window.damageCalculator = damageCalculator;