// domain/damage-calculator.js - 대미지 계산기 (순환 참조 제거)

class DamageCalculator {
    constructor(dependencies) {
        this.eventBus = dependencies.eventBus;
        this.mediator = dependencies.mediator;
        
        // 이벤트 구독
        this.subscribeToEvents();
        this.registerMediatorHandlers();
    }
    
    subscribeToEvents() {
        this.eventBus.on(Events.CALCULATE_DAMAGE, (event) => this.handleCalculateDamage(event));
    }
    
    registerMediatorHandlers() {
        // 즉시 대미지 계산 핸들러
        this.mediator.registerHandler('CALCULATE_INSTANT_DAMAGE', async (data) => {
            const { source, damage, buffs } = data;
            
            // 최종 공격력 계산
            const finalAtk = source.baseStats.atk * (1 + (buffs.atkPercent || 0) + (buffs.fixedATK || 0));
            
            // 대미지 계산
            const baseDamage = finalAtk * damage.value;
            
            // 버프 적용
            const finalDamage = baseDamage * (1 + (buffs.damageIncrease || 0));
            
            return Math.floor(finalDamage);
        });
    }
    
    /**
     * 대미지 계산 요청 처리
     */
    async handleCalculateDamage(event) {
        const { requestId, characterId, character, charState, buffs, config, time } = event.data;
        
        try {
            const damageResult = await this.calculateDamage(
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
    async calculateDamage(character, charState, buffs, config) {
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
        const spread = this.calculateSpread(weaponType, totalAccuracy, config.distance);
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
        const collectionBonus = await this.getCollectionBonus(weaponType);
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
    async getCollectionBonus(weaponType) {
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
    calculateSpread(weaponType, accuracy, distance) {
        // 상수 사용
        const baseAccuracy = window.BASE_ACCURACY[weaponType] || 50;
        const coefficient = window.SPREAD_COEFFICIENT[weaponType] || 0.5;
        
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