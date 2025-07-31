/* nikke-sim-character-base.js - 개선된 캐릭터 기본 클래스 */

class CharacterBase {
    constructor(spec) {
        // 기본 정보
        this.id = spec.id;
        this.name = spec.name;
        this.weaponType = spec.weaponType;
        this.burstPosition = spec.burstPosition;
        this.burstCooldown = spec.burstCooldown;
        this.burstReEntry = spec.burstReEntry || false;
        
        // 기본 스탯
        this.baseStats = { ...spec.baseStats };
        
        // 스킬 (새 구조 - Skill 클래스 없이 일반 객체)
        this.skills = spec.skills || {};
        
        // 레벨과 코어
        this.level = 200;
        this.coreLevel = 10;
        
        // 전투 상태 초기화
        this.shotsFired = 0;
        this.currentAmmo = this.baseStats.baseAmmo;
        this.maxAmmo = this.baseStats.baseAmmo;
        this.isReloading = false;
        this.reloadEndTime = 0;
        this.reloadCount = 0;
        
        // 액션 관리
        this.activeActions = [];
        this.actionInstances = new Map(); // 액션 인스턴스 캐싱
        this.attackModifiers = {};
        this.weaponOverride = null;
        this.conditionModifiers = {};
        
        // 특수 메커니즘을 스펙에서 초기화
        if (spec.specialMechanisms) {
            this.initializeSpecialMechanisms(spec.specialMechanisms);
        }
    }
    
    /**
     * 특수 메커니즘 초기화
     */
    initializeSpecialMechanisms(mechanisms) {
        // 각 메커니즘의 초기 상태 설정
        Object.entries(mechanisms).forEach(([key, config]) => {
            if (config.type === 'counter') {
                // 카운터 타입 (도로시 펠릿 카운터)
                this[config.property || key] = config.initialValue || 0;
            } else if (config.type === 'state') {
                // 상태 타입 (세이렌 버블 웨이브 타이머)
                Object.entries(config.properties || {}).forEach(([prop, value]) => {
                    this[prop] = value;
                });
            }
        });
    }
    
    // 레벨과 코어 강화를 반영한 스탯 계산
    getStatWithCoreAndLevel(coreLevel = this.coreLevel, level = this.level) {
        const levelMultiplier = 1;//1 + (level - 1) * 0.002;
        const coreMultiplier = 1;//1 + coreLevel * 0.05;

        return {
            ...this.baseStats,
            atk: Math.floor(this.baseStats.atk * levelMultiplier * coreMultiplier)
        };
    }
    
    /**
     * 모든 가능한 액션 체크
     */
    checkActions(context) {
        const availableActions = [];
        
        // 모든 스킬의 액션 체크
        for (const [slot, skill] of Object.entries(this.skills)) {
            if (!skill.actions) continue;
            
            for (const actionConfig of skill.actions) {
                const actionKey = `${slot}_${actionConfig.id || actionConfig.type}`;
                
                // 기존 액션 인스턴스 가져오거나 새로 생성
                let action = this.actionInstances.get(actionKey);
                if (!action) {
                    action = ActionFactory.create({
                        ...actionConfig,
                        name: actionConfig.name || skill.name,
                        id: actionKey
                    });
                    this.actionInstances.set(actionKey, action);
                }
                
                // 이미 활성 중이면 스킵
                if (this.activeActions.includes(action)) {
                    continue;
                }
                
                // 실행 가능 여부 체크
                if (action.canExecute(context, this)) {
                    availableActions.push({
                        slot,
                        skill: skill.name,
                        action
                    });
                }
            }
        }
        
        // 우선순위 정렬 (높은 것부터)
        return availableActions.sort((a, b) => 
            b.action.priority - a.action.priority
        );
    }
    
    /**
     * 활성 액션 업데이트
     */
    updateActiveActions(context) {
        // 만료된 액션 제거
        this.activeActions = this.activeActions.filter(action => {
            action.update(context, this);
            return action.active;
        });
    }
    
    /**
     * 공격 완료 처리
     */
    onAttackComplete(attackInfo) {
        this.shotsFired++;
        
        // 특수 메커니즘 처리
        if (this.processAttackMechanism) {
            this.processAttackMechanism(attackInfo);
        }
        
        // 활성 액션들에게 공격 알림
        this.activeActions.forEach(action => {
            action.onAttack(this.context || attackInfo.context || {}, this);
        });
    }
    
    /**
     * 공격 정보 반환 (수정자 적용)
     */
    getAttackInfo(state, buffs) {
        // 기본 정보
        let baseInfo = {
            pelletsPerShot: this.baseStats.basePellets + (buffs.pelletBonus || 0),
            isSpecialAttack: false
        };
        
        // 공격 수정자 적용
        if (this.attackModifiers.pelletsPerShot !== undefined) {
            baseInfo.pelletsPerShot = this.attackModifiers.pelletsPerShot;
            baseInfo.isSpecialAttack = true;
        }
        
        return baseInfo;
    }
    
    /**
     * 무기 파라미터 반환 (오버라이드 적용)
     */
    getWeaponParams() {
        if (this.weaponOverride) {
            return {
                ...this.baseStats,
                ...this.weaponOverride
            };
        }
        return this.baseStats;
    }
    
    // 스킬 관련 메서드들
    getSkill(slot) {
        return this.skills[slot];
    }
    
    getAllSkills() {
        return Object.entries(this.skills).map(([slot, skill]) => ({
            slot,
            skill
        }));
    }
    
    // 버스트 액션 반환 (현재는 사용 안 함)
    getBurstAction() {
        return null;
    }
    
    // 디버그 로그
    log(message) {
        // 캐릭터 레벨에서는 로그하지 않음
    }
}