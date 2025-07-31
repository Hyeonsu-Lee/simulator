/* nikke-sim-utils.js - 유틸리티 함수 */

function formatNumber(num) {
    return num.toLocaleString('ko-KR');
}

// 탄착원 직경 계산
function calculateSpreadDiameter(weaponType, hitRate) {
    const params = WEAPON_PARAMS[weaponType];
    const spread = params.base - params.reduction * hitRate;
    return Math.max(spread, 1);
}

// 코어 명중률 계산
function calculateCoreHitRate(spreadDiameter, coreSize, weaponType) {
    if (spreadDiameter <= coreSize) return 1.0;
    
    const sigmaRatio = weaponType === 'SG' ? 3 : 4;
    const sigma = spreadDiameter / sigmaRatio;
    const coreRadius = coreSize / 2;
    
    const hitProbability = 1 - Math.exp(-(coreRadius * coreRadius) / (2 * sigma * sigma));
    return Math.min(hitProbability, 1.0);
}

// 일반화된 대미지 계산
function calculateGeneralDamage(baseAtk, enemyDef, weaponCoef, chargeCoef, buffs, triggers, collectionBonus) {
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