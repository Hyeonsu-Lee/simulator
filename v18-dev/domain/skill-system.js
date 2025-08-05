// domain/skill-system.js - 스킬 시스템 (순환 참조 제거)

class SkillSystem {
    constructor(dependencies) {
        this.eventBus = dependencies.eventBus;
        this.mediator = dependencies.mediator;
        this.stateStore = dependencies.stateStore;
        this.timeManager = dependencies.timeManager;
        this.logger = dependencies.logger;
        this.characterLoader = dependencies.characterLoader;
        
        this.registeredSkills = new Map();
        this.triggerHandlers = new Map();
        this.accumulatorTrackers = new Map();
        this.periodicTriggers = new Map();
        this.currentProcessingCharacter = null;
        this.unsubscribers = []; // 이벤트 구독 해제 함수들
        
        this.subscribeToEvents();
    }
    
    subscribeToEvents() {
        // 시스템 이벤트
        this.unsubscribers.push(
            this.eventBus.on(Events.INIT, () => this.initialize()),
            this.eventBus.on(Events.TICK, (event) => this.handleTick(event)),
            
            // 전투 이벤트
            this.eventBus.on(Events.ATTACK, (event) => {
                this.currentProcessingCharacter = event.data.characterId;
                this.checkTriggers('ATTACK', event);
            }),
            this.eventBus.on(Events.DAMAGE, (event) => {
                this.currentProcessingCharacter = event.data.sourceId;
                this.checkTriggers('DAMAGE', event);
            }),
            this.eventBus.on(Events.RELOAD, (event) => {
                this.currentProcessingCharacter = event.data.characterId;
                this.checkTriggers('RELOAD', event);
            }),
            
            // 버스트 이벤트
            this.eventBus.on(Events.BURST_USE, (event) => {
                this.currentProcessingCharacter = event.data.character?.id;
                this.checkTriggers('BURST_USE', event);
            }),
            this.eventBus.on(Events.FULL_BURST, (event) => this.checkTriggers('FULL_BURST_START', event)),
            this.eventBus.on(Events.FULL_BURST_END, (event) => this.checkTriggers('FULL_BURST_END', event)),
            
            // 특수 이벤트
            this.eventBus.on(Events.LAST_BULLET, (event) => {
                this.currentProcessingCharacter = event.data.characterId;
                this.checkTriggers('LAST_BULLET_HIT', event);
            }),
            this.eventBus.on(Events.FULL_CHARGE, (event) => {
                this.currentProcessingCharacter = event.data.characterId;
                this.checkTriggers('FULL_CHARGE_ATTACK', event);
            }),
            this.eventBus.on(Events.HEAL, (event) => {
                this.currentProcessingCharacter = event.data.targetId;
                this.checkTriggers('HEAL_RECEIVED', event);
            }),
            this.eventBus.on(Events.BATTLE_START, (event) => this.checkTriggers('BATTLE_START', event))
        );
    }
    
    /**
     * 초기화
     */
    initialize() {
        const squad = this.stateStore.get('squad.members');
        
        squad.forEach(characterId => {
            if (!characterId) return;
            
            const character = this.characterLoader.getSpec(characterId);
            if (character && character.skills) {
                this.registerCharacterSkills(characterId, character.skills);
            }
        });
    }
    
    /**
     * 캐릭터 스킬 등록
     */
    registerCharacterSkills(characterId, skills) {
        this.registeredSkills.set(characterId, skills);
        
        // 각 스킬의 트리거 등록
        Object.entries(skills).forEach(([skillSlot, skill]) => {
            if (!skill.triggers) return;
            
            skill.triggers.forEach(trigger => {
                this.registerTrigger(characterId, skillSlot, skill, trigger);
            });
        });
    }
    
    /**
     * 트리거 등록
     */
    registerTrigger(characterId, skillSlot, skill, trigger) {
        const triggerId = `${characterId}_${skillSlot}_${trigger.id}`;
        
        switch (trigger.type) {
            case 'event':
                this.registerEventTrigger(triggerId, characterId, skillSlot, skill, trigger);
                break;
                
            case 'accumulator':
                this.registerAccumulatorTrigger(triggerId, characterId, skillSlot, skill, trigger);
                break;
                
            case 'periodic':
                this.registerPeriodicTrigger(triggerId, characterId, skillSlot, skill, trigger);
                break;
                
            case 'state':
                this.registerStateTrigger(triggerId, characterId, skillSlot, skill, trigger);
                break;
        }
    }
    
    /**
     * 이벤트 트리거 등록
     */
    registerEventTrigger(triggerId, characterId, skillSlot, skill, trigger) {
        if (!this.triggerHandlers.has(trigger.event)) {
            this.triggerHandlers.set(trigger.event, []);
        }
        
        this.triggerHandlers.get(trigger.event).push({
            triggerId,
            characterId,
            skillSlot,
            skill,
            trigger
        });
    }
    
    /**
     * 누적 트리거 등록
     */
    registerAccumulatorTrigger(triggerId, characterId, skillSlot, skill, trigger) {
        this.accumulatorTrackers.set(triggerId, {
            characterId,
            skillSlot,
            skill,
            trigger,
            currentValue: 0,
            lastValue: 0
        });
    }
    
    /**
     * 주기적 트리거 등록
     */
    registerPeriodicTrigger(triggerId, characterId, skillSlot, skill, trigger) {
        this.periodicTriggers.set(triggerId, {
            characterId,
            skillSlot,
            skill,
            trigger,
            nextCheck: trigger.interval || 1.0
        });
    }
    
    /**
     * 상태 트리거 등록
     */
    registerStateTrigger(triggerId, characterId, skillSlot, skill, trigger) {
        // 상태 트리거는 주기적으로 체크 - 상수 사용
        if (trigger.continuous) {
            this.registerPeriodicTrigger(triggerId, characterId, skillSlot, skill, {
                ...trigger,
                type: 'state',
                interval: window.STATE_CHECK_INTERVAL
            });
        }
    }
    
    /**
     * 트리거 체크
     */
    checkTriggers(eventType, event) {
        const handlers = this.triggerHandlers.get(eventType) || [];
        
        handlers.forEach(handler => {
            const { characterId, skillSlot, skill, trigger } = handler;
            
            // 캐릭터 확인
            if (trigger.scope === 'self' && event.data.characterId !== characterId) {
                return;
            }
            
            // 효과 발동
            this.activateSkillEffects(characterId, skillSlot, skill, trigger.id, event);
        });
    }
    
    /**
     * 틱 처리
     */
    handleTick(event) {
        const currentTime = event.data.time;
        
        // 누적 트리거 체크
        this.checkAccumulatorTriggers(currentTime);
        
        // 주기적 트리거 체크
        this.checkPeriodicTriggers(currentTime);
    }
    
    /**
     * 누적 트리거 체크
     */
    checkAccumulatorTriggers(currentTime) {
        this.accumulatorTrackers.forEach((tracker, triggerId) => {
            const value = this.getAccumulatorValue(tracker.trigger.source, tracker.characterId);
            
            if (value >= tracker.trigger.threshold && tracker.lastValue < tracker.trigger.threshold) {
                // 트리거 발동
                this.activateSkillEffects(
                    tracker.characterId,
                    tracker.skillSlot,
                    tracker.skill,
                    tracker.trigger.id,
                    { time: currentTime }
                );
                
                // 리셋
                if (tracker.trigger.resetOnTrigger) {
                    this.resetAccumulator(tracker.trigger.source, tracker.characterId);
                    tracker.currentValue = 0;
                }
            }
            
            tracker.lastValue = value;
        });
    }
    
    /**
     * 주기적 트리거 체크
     */
    checkPeriodicTriggers(currentTime) {
        this.periodicTriggers.forEach((trigger, triggerId) => {
            if (currentTime >= trigger.nextCheck) {
                // 조건 체크
                if (this.checkTriggerCondition(trigger.trigger)) {
                    this.activateSkillEffects(
                        trigger.characterId,
                        trigger.skillSlot,
                        trigger.skill,
                        trigger.trigger.id,
                        { time: currentTime }
                    );
                }
                
                trigger.nextCheck = currentTime + (trigger.trigger.interval || 1.0);
            }
        });
    }
    
    /**
     * 스킬 효과 발동
     */
    activateSkillEffects(characterId, skillSlot, skill, triggerId, event) {
        // 로그
        this.logger.skill(event.time || this.timeManager.currentTime, 
            `[${characterId}] ${skill.name} 발동`
        );
        
        // 효과 처리
        skill.effects.forEach(effect => {
            // triggerId가 일치하는 효과만 처리
            if (effect.triggerId && effect.triggerId !== triggerId) {
                return;
            }
            
            this.processEffect(characterId, effect, event);
        });
        
        // 스킬 발동 이벤트
        this.eventBus.emit(Events.SKILL_ACTIVATE, {
            characterId,
            skillSlot,
            skill,
            triggerId,
            time: event.time || this.timeManager.currentTime
        });
        
        // 스킬1 카운트 증가
        if (skillSlot === 'skill1') {
            this.stateStore.update(state => {
                const charState = state.combat.characters[characterId];
                if (charState) {
                    charState.skill1Count = (charState.skill1Count || 0) + 1;
                }
                return state;
            });
        }
    }
    
    /**
     * 효과 처리
     */
    async processEffect(sourceId, effect, context) {
        switch (effect.type) {
            case 'buff':
                await this.processBuff(sourceId, effect, context);
                break;
                
            case 'stack':
                await this.processStack(sourceId, effect, context);
                break;
                
            case 'replace_attack':
                this.processReplaceAttack(sourceId, effect, context);
                break;
                
            case 'instant_damage':
                await this.processInstantDamage(sourceId, effect, context);
                break;
                
            case 'multi_hit_damage':
                this.processMultiHitDamage(sourceId, effect, context);
                break;
                
            case 'heal':
                this.processHeal(sourceId, effect, context);
                break;
                
            case 'burst_charge':
                this.processBurstCharge(sourceId, effect, context);
                break;
                
            case 'ammo_charge':
                this.processAmmoCharge(sourceId, effect, context);
                break;
                
            case 'burst_cooldown_reduction':
                this.processBurstCooldownReduction(sourceId, effect, context);
                break;
                
            case 'transform_buff':
                await this.processBuffTransform(sourceId, effect, context);
                break;
        }
    }
    
    /**
     * 버프 처리
     */
    async processBuff(sourceId, effect, context) {
        const targets = this.resolveTargets(effect.target, sourceId);
        
        targets.forEach(target => {
            this.eventBus.emit(Events.BUFF_APPLY, {
                buffId: effect.buffId || `${sourceId}_buff`,
                target: { id: target },
                source: { id: sourceId },
                stats: effect.stats,
                duration: effect.duration,
                time: context.time || this.timeManager.currentTime
            });
        });
    }
    
    /**
     * 스택 처리
     */
    async processStack(sourceId, effect, context) {
        // 스택 버프는 BuffSystem에서 처리
        this.eventBus.emit(Events.BUFF_APPLY, {
            buffId: effect.buffId,
            target: { id: sourceId },
            source: { id: sourceId },
            stats: effect.stats,
            duration: effect.duration || { type: 'permanent' },
            stackable: true,
            maxStacks: effect.maxStacks || 20,
            time: context.time || this.timeManager.currentTime
        });
        
        // 최대 스택 도달 시 효과
        if (effect.onMaxStacks) {
            const currentStacks = await this.getBuffStacks(sourceId, effect.buffId);
            if (currentStacks >= (effect.maxStacks || 20)) {
                for (const maxEffect of effect.onMaxStacks) {
                    await this.processEffect(sourceId, maxEffect, context);
                }
            }
        }
    }
    
    /**
     * 공격 대체
     */
    processReplaceAttack(sourceId, effect, context) {
        this.stateStore.update(state => {
            const charState = state.combat.characters[sourceId];
            if (charState) {
                charState.replaceAttack = {
                    modifiers: effect.modifiers,
                    duration: effect.duration,
                    startTime: context.time || this.timeManager.currentTime,
                    shotsRemaining: effect.duration.value
                };
            }
            return state;
        });
    }
    
    /**
     * 즉시 대미지
     */
    async processInstantDamage(sourceId, effect, context) {
        const charSpec = this.characterLoader.getSpec(sourceId);
        if (!charSpec) return;
        
        const buffs = await this.mediator.request('GET_TOTAL_BUFFS', {
            characterId: sourceId,
            requestId: `instant-damage-${sourceId}-${context.time}`
        });
        
        const damage = await this.mediator.request('CALCULATE_INSTANT_DAMAGE', {
            source: { id: sourceId, baseStats: charSpec.baseStats },
            damage: effect.damage,
            buffs: buffs
        });
        
        this.eventBus.emit(Events.DAMAGE, {
            sourceId: sourceId,
            damage: damage,
            type: 'instant',
            skill: effect.skill,
            time: context.time || this.timeManager.currentTime
        });
    }
    
    /**
     * 다중 타격 - 상수 사용
     */
    processMultiHitDamage(sourceId, effect, context) {
        const baseTime = context.time || this.timeManager.currentTime;
        
        for (let i = 0; i < effect.hits; i++) {
            this.timeManager.schedule(
                baseTime + (i * window.MULTI_HIT_INTERVAL),
                Events.DAMAGE,
                {
                    sourceId: sourceId,
                    damage: effect.damage,
                    type: 'multi_hit',
                    hitIndex: i,
                    totalHits: effect.hits
                }
            );
        }
    }
    
    /**
     * 치유
     */
    processHeal(sourceId, effect, context) {
        const targets = this.resolveTargets(effect.target, sourceId);
        
        targets.forEach(target => {
            this.eventBus.emit(Events.HEAL, {
                sourceId: sourceId,
                targetId: target,
                amount: effect.amount,
                time: context.time || this.timeManager.currentTime
            });
        });
    }
    
    /**
     * 버스트 충전
     */
    processBurstCharge(sourceId, effect, context) {
        // 시뮬레이터에서는 무시 (고정 주기)
    }
    
    /**
     * 탄약 충전
     */
    processAmmoCharge(sourceId, effect, context) {
        const targets = this.resolveTargets(effect.target, sourceId);
        
        targets.forEach(target => {
            this.eventBus.emit(Events.AMMO_CHANGE, {
                characterId: target,
                type: 'charge',
                amount: effect.amount,
                time: context.time || this.timeManager.currentTime
            });
        });
    }
    
    /**
     * 버스트 쿨다운 감소
     */
    processBurstCooldownReduction(sourceId, effect, context) {
        const squad = this.stateStore.get('squad.members');
        squad.forEach(charId => {
            if (!charId) return;
            
            const cooldown = this.stateStore.get(`burst.cooldowns.${charId}`);
            if (cooldown && cooldown > this.timeManager.currentTime) {
                this.stateStore.set(`burst.cooldowns.${charId}`, 
                    Math.max(this.timeManager.currentTime, cooldown - effect.amount)
                );
            }
        });
    }
    
    /**
     * 버프 변환
     */
    async processBuffTransform(sourceId, effect, context) {
        // BuffSystem에 변환 요청
        this.eventBus.emit(Events.BUFF_TRANSFORM, {
            targetId: sourceId,
            fromBuffId: effect.fromBuffId,
            toBuffId: effect.toBuffId,
            newStats: effect.newStats
        });
    }
    
    /**
     * 타겟 결정
     */
    resolveTargets(targetType, sourceId) {
        const squad = this.stateStore.get('squad.members').filter(id => id !== null);
        
        switch (targetType) {
            case 'self':
                return [sourceId];
                
            case 'all_allies':
                return squad;
                
            case 'burst_users':
                const burstUsers = this.stateStore.get('burst.users');
                return squad.filter(charId => burstUsers.includes(charId));
                
            case 'non_burst_users':
                const nonBurstUsers = this.stateStore.get('burst.users');
                return squad.filter(charId => !nonBurstUsers.includes(charId));
                
            case 'enemy':
            case 'random_enemies':
                // 시뮬레이터에서는 무시
                return [];
                
            default:
                return [];
        }
    }
    
    /**
     * 누적값 가져오기
     */
    getAccumulatorValue(source, characterId) {
        const [scope, property] = source.split('.');
        
        if (scope === 'global') {
            return this.stateStore.get(`combat.globalCounters.${property}`) || 0;
        } else if (scope === 'self') {
            const charState = this.stateStore.get(`combat.characters.${characterId}`);
            if (!charState) return 0;
            
            switch (property) {
                case 'pelletsHit':
                    return charState.pelletsHit || 0;
                case 'attackCount':
                    return charState.attackCount || 0;
                default:
                    return 0;
            }
        }
        
        return 0;
    }
    
    /**
     * 누적값 리셋
     */
    resetAccumulator(source, characterId) {
        const [scope, property] = source.split('.');
        
        if (scope === 'global') {
            this.stateStore.set(`combat.globalCounters.${property}`, 0);
        } else if (scope === 'self') {
            this.stateStore.update(state => {
                const charState = state.combat.characters[characterId];
                if (!charState) return state;
                
                switch (property) {
                    case 'pelletsHit':
                        charState.pelletsHit = 0;
                        break;
                    case 'attackCount':
                        charState.attackCount = 0;
                        break;
                }
                
                return state;
            });
        }
    }
    
    /**
     * 트리거 조건 체크
     */
    checkTriggerCondition(trigger) {
        if (!trigger.condition) return true;
        
        switch (trigger.condition) {
            case 'isFullBurst':
                return this.stateStore.get('burst.fullBurst');
                
            default:
                return false;
        }
    }
    
    /**
     * 버프 스택 확인
     */
    async getBuffStacks(characterId, buffId) {
        // 미디에이터를 통해 버프 시스템에 요청
        return await this.mediator.request('GET_BUFF_STACKS', {
            characterId,
            buffId
        });
    }
    
    /**
     * 현재 처리 중인 캐릭터 ID 가져오기
     */
    getCurrentCharacterId() {
        return this.currentProcessingCharacter;
    }
    
    /**
     * 리셋
     */
    reset() {
        this.registeredSkills.clear();
        this.triggerHandlers.clear();
        this.accumulatorTrackers.clear();
        this.periodicTriggers.clear();
        this.currentProcessingCharacter = null;
    }
    
    /**
     * 리소스 정리
     */
    destroy() {
        // 이벤트 구독 해제
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];
        
        // 데이터 정리
        this.reset();
    }
}

// 전역 노출
window.SkillSystem = SkillSystem;

// 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SkillSystem;
}