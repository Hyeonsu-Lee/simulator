/* nikke-sim-action-system.js - 범용 액션 시스템 */

/**
 * 액션 기본 클래스
 */
class Action {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.type = config.type;
        this.priority = config.priority || 0;
        this.duration = config.duration || { type: 'instant', value: 0 };
        this.data = config.data || {};
        this.onActivate = config.onActivate;
        this.onComplete = config.onComplete;
        
        // 상태
        this.active = false;
        this.startTime = null;
        this.endTime = null;
        this.remainingValue = null;
    }
    
    /**
     * 액션 실행 가능 여부 체크
     */
    canExecute(context, character) {
        // 트리거 조건 체크
        if (this.data.trigger?.condition) {
            return this.data.trigger.condition(context, character);
        }
        
        return true;
    }
    
    /**
     * 액션 활성화
     */
    activate(context, character) {
        this.active = true;
        this.startTime = context.time;
        
        // 지속시간 설정
        switch (this.duration.type) {
            case 'time':
                this.endTime = context.time + this.duration.value;
                break;
            case 'shots':
                this.remainingValue = this.duration.value;
                break;
            case 'instant':
                this.endTime = context.time;
                break;
        }
        
        // 활성화 콜백
        if (this.onActivate) {
            this.onActivate(character, context);
        }
    }
    
    /**
     * 액션 업데이트 (매 공격마다 호출)
     */
    update(context, character) {
        if (!this.active) return;
        
        // 시간 기반 만료 체크
        if (this.duration.type === 'time' && context.time >= this.endTime) {
            this.deactivate(context, character);
        }
        
        // 즉시 액션은 바로 종료
        if (this.duration.type === 'instant') {
            this.deactivate(context, character);
        }
    }
    
    /**
     * 공격 시 호출 (shots 기반 duration용)
     */
    onAttack(context, character) {
        if (!this.active) return;
        
        if (this.duration.type === 'shots' && this.remainingValue !== null) {
            this.remainingValue--;
            if (this.remainingValue <= 0) {
                this.deactivate(context, character);
            }
        }
    }
    
    /**
     * 액션 비활성화
     */
    deactivate(context, character) {
        this.active = false;
        
        // activeActions에서 제거
        const index = character.activeActions.indexOf(this);
        if (index > -1) {
            character.activeActions.splice(index, 1);
        }
        
        // 완료 콜백
        if (this.onComplete) {
            this.onComplete(character, context);
        }
    }
    
    /**
     * 액션이 일반 공격을 취소하는지 여부
     */
    shouldCancelNormalAttack() {
        return false;
    }
    
    /**
     * 액션 실행 (하위 클래스에서 구현)
     */
    execute(context, character, engine) {
        throw new Error('execute() must be implemented by subclass');
    }
}

/**
 * 공격 수정 액션 (도로시 특수탄 등)
 */
class ModifyAttackAction extends Action {
    constructor(config) {
        super(config);
        this.type = 'modify_attack';
    }
    
    execute(context, character, engine) {
        this.activate(context, character);
        
        // 공격 파라미터 수정 적용
        character.attackModifiers = this.data.modifiers || {};
    }
    
    deactivate(context, character) {
        super.deactivate(context, character);
        
        // 공격 수정 제거
        character.attackModifiers = {};
    }
}

/**
 * 즉시 대미지 액션 (세이렌 버블 웨이브, 홍련 등)
 */
class InstantDamageAction extends Action {
    constructor(config) {
        super(config);
        this.type = 'instant_damage';
    }
    
    execute(context, character, engine) {
        this.activate(context, character);
        
        // 대미지 계산
        const stats = character.getStatWithCoreAndLevel();
        const damage = Math.floor(stats.atk * (this.data.damageMultiplier || 1));
        
        // 엔진에 대미지 전달
        engine.applyInstantDamage(character, damage, this.name);
    }
    
    shouldCancelNormalAttack() {
        // 즉시 대미지는 일반 공격을 취소하지 않음
        return false;
    }
}

/**
 * 무기 변경 액션 (K, 레드후드 등)
 */
class WeaponChangeAction extends Action {
    constructor(config) {
        super(config);
        this.type = 'weapon_change';
    }
    
    execute(context, character, engine) {
        this.activate(context, character);
        
        // 무기 파라미터 오버라이드
        character.weaponOverride = this.data.weaponStats || {};
    }
    
    deactivate(context, character) {
        super.deactivate(context, character);
        
        // 무기 오버라이드 제거
        character.weaponOverride = null;
    }
}

/**
 * 조건 수정 액션 (흑련 등)
 */
class ModifyConditionAction extends Action {
    constructor(config) {
        super(config);
        this.type = 'modify_condition';
    }
    
    execute(context, character, engine) {
        this.activate(context, character);
        
        // 대상 스킬의 조건 수정
        const targetSkill = this.data.targetSkill;
        const modifiers = this.data.modifiers;
        
        if (character.skills[targetSkill]) {
            character.conditionModifiers = character.conditionModifiers || {};
            character.conditionModifiers[targetSkill] = modifiers;
        }
    }
    
    deactivate(context, character) {
        super.deactivate(context, character);
        
        // 조건 수정 제거
        if (character.conditionModifiers) {
            delete character.conditionModifiers[this.data.targetSkill];
        }
    }
}

/**
 * 액션 팩토리
 */
class ActionFactory {
    static actionTypes = {
        'modify_attack': ModifyAttackAction,
        'instant_damage': InstantDamageAction,
        'weapon_change': WeaponChangeAction,
        'modify_condition': ModifyConditionAction
    };
    
    static registerActionType(type, actionClass) {
        this.actionTypes[type] = actionClass;
    }
    
    static create(config) {
        const ActionClass = this.actionTypes[config.type] || Action;
        return new ActionClass(config);
    }
}