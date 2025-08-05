// domain/buff-system.js - 버프 시스템 (순환 참조 제거)

class BuffSystem {
    constructor(dependencies) {
        this.eventBus = dependencies.eventBus;
        this.stateStore = dependencies.stateStore;
        this.timeManager = dependencies.timeManager;
        this.characterLoader = dependencies.characterLoader;
        
        this.activeBuffs = new Map(); // characterId -> Map<buffKey, Buff>
        this.buffIdCounter = 0;
        
        // 이벤트 구독
        this.subscribeToEvents();
    }
    
    subscribeToEvents() {
        this.eventBus.on(Events.BUFF_APPLY, (event) => this.handleBuffApply(event));
        this.eventBus.on(Events.BUFF_REMOVE, (event) => this.handleBuffRemove(event));
        this.eventBus.on(Events.BUFF_UPDATE, (event) => this.handleBuffUpdate(event));
        this.eventBus.on(Events.BUFF_CALCULATE, (event) => this.handleBuffCalculate(event));
        this.eventBus.on(Events.TICK, (event) => this.handleTick(event));
        
        // 특수 버프 이벤트
        this.eventBus.on(Events.BUFF_TRANSFORM, (event) => this.handleBuffTransform(event));
        this.eventBus.on(Events.BUFF_DECREMENT_SHOT, (event) => this.decrementShotBuffs(event.data.characterId));
    }
    
    getBuffStacks(characterId, buffId) {
        const charBuffs = this.activeBuffs.get(characterId);
        if (!charBuffs) return 0;
        
        let stacks = 0;
        charBuffs.forEach((buff, key) => {
            if (buff.buffId === buffId) {
                stacks = buff.stacks || 1;
            }
        });
        return stacks;
    }
    
    /**
     * 버프 적용
     */
    handleBuffApply(event) {
        const { 
            buffId,
            target,
            source,
            stats,
            duration,
            stackable = false,
            maxStacks = 1
        } = event.data;
        
        const targetId = target.id;
        if (!this.activeBuffs.has(targetId)) {
            this.activeBuffs.set(targetId, new Map());
        }
        
        const charBuffs = this.activeBuffs.get(targetId);
        const buffKey = `${source.id}_${buffId}`;
        
        // 기존 버프 확인
        const existingBuff = charBuffs.get(buffKey);
        
        if (existingBuff && stackable) {
            // 스택 증가
            existingBuff.stacks = Math.min(existingBuff.stacks + 1, maxStacks);
            existingBuff.refreshTime(event.data.time);
        } else {
            // 새 버프 생성
            const buff = new Buff({
                id: ++this.buffIdCounter,
                buffId,
                key: buffKey,
                source,
                target,
                stats,
                duration,
                startTime: event.data.time,
                stackable,
                maxStacks
            });
            
            charBuffs.set(buffKey, buff);
        }
        
        // 상태 업데이트
        this.updateCharacterBuffState(targetId);
    }
    
    /**
     * 버프 제거
     */
    handleBuffRemove(event) {
        const { targetId, buffKey } = event.data;
        
        const charBuffs = this.activeBuffs.get(targetId);
        if (!charBuffs) return;
        
        charBuffs.delete(buffKey);
        this.updateCharacterBuffState(targetId);
    }
    
    /**
     * 버프 업데이트
     */
    handleBuffUpdate(event) {
        const { targetId, buffKey, updates } = event.data;
        
        const charBuffs = this.activeBuffs.get(targetId);
        if (!charBuffs) return;
        
        const buff = charBuffs.get(buffKey);
        if (!buff) return;
        
        Object.assign(buff, updates);
        this.updateCharacterBuffState(targetId);
    }
    
    /**
     * 버프 계산 요청 처리
     */
    handleBuffCalculate(event) {
        const { characterId, requestId } = event.data;
        
        // 정적 버프 가져오기
        const staticBuffs = this.stateStore.get('buffs.static') || {};
        
        // 총 버프 계산
        const buffs = this.calculateTotalBuffs(characterId, staticBuffs);
        
        // 결과 이벤트 발생
        this.eventBus.emit(Events.BUFF_CALCULATED, {
            requestId,
            characterId,
            buffs
        });
    }
    
    /**
     * 틱 처리 - 만료된 버프 제거
     */
    handleTick(event) {
        const currentTime = event.data.time;
        
        this.activeBuffs.forEach((charBuffs, targetId) => {
            const toRemove = [];
            
            charBuffs.forEach((buff, key) => {
                if (buff.isExpired(currentTime)) {
                    toRemove.push(key);
                }
            });
            
            toRemove.forEach(key => {
                charBuffs.delete(key);
            });
            
            if (toRemove.length > 0) {
                this.updateCharacterBuffState(targetId);
            }
        });
    }
    
    /**
     * 캐릭터의 총 버프 계산
     */
    calculateTotalBuffs(characterId, staticBuffs = {}) {
        
        const buffs = {
            // 기본값
            atkPercent: 0,
            critRate: window.CRIT_RATE,
            critDamage: window.CRIT_DMG,
            fixedATK: 0,
            accuracy: 0,
            damageIncrease: 0,
            eliteDamage: 0,
            coreBonus: 0,
            penetrationDamage: 0,
            distributedDamage: 0,
            receivedDamage: 0,
            attackSpeed: 0,
            pelletBonus: 0,
            helmCritBonus: 0,
            reloadSpeed: 0,
            maxAmmo: 0,
            ammoCharge: 0,
            distanceBonus: 0,
            partDamage: 0,
            dotDamage: 0,
            defIgnoreDamage: 0,
            chargeDamage: 0,
            chargeRatio: 0,
            healReceived: 0,
            
            // 상태 플래그
            isFullBurst: false,
            
            // 정적 버프 적용
            ...staticBuffs
        };
        
        const charBuffs = this.activeBuffs.get(characterId);
        if (!charBuffs) return buffs;
        
        // 활성 버프 적용
        charBuffs.forEach(buff => {
            const stats = buff.getEffectiveStats();
            
            Object.entries(stats).forEach(([stat, value]) => {
                if (stat === 'fixedATK' && value.source) {
                    // fixedATK 특수 처리
                    const sourceCharSpec = this.characterLoader.getSpec(value.source);
                    if (sourceCharSpec) {
                        buffs.fixedATK += sourceCharSpec.baseStats.atk * value.value;
                    }
                } else if (typeof value === 'object') {
                    // 타입별 처리
                    if (value.type === 'flat') {
                        buffs[stat] = (buffs[stat] || 0) + value.value;
                    } else if (value.type === 'percent') {
                        buffs[stat] = (buffs[stat] || 0) + value.value;
                    }
                } else {
                    // 기본값
                    buffs[stat] = (buffs[stat] || 0) + value;
                }
            });
        });
        
        return buffs;
    }
    
    /**
     * 캐릭터 버프 상태 업데이트
     */
    updateCharacterBuffState(characterId) {
        const buffs = this.calculateTotalBuffs(characterId);
        
        this.stateStore.set(`buffs.active.${characterId}`, {
            buffs: buffs,
            activeCount: this.activeBuffs.get(characterId)?.size || 0,
            lastUpdate: this.timeManager.currentTime
        });
    }
    
    /**
     * 버프 변환 처리
     */
    handleBuffTransform(event) {
        const { targetId, fromBuffId, toBuffId, newStats } = event.data;
        
        const charBuffs = this.activeBuffs.get(targetId);
        if (!charBuffs) return;
        
        let oldBuff = null;
        let oldKey = null;
        
        charBuffs.forEach((buff, key) => {
            if (buff.buffId === fromBuffId) {
                oldBuff = buff;
                oldKey = key;
            }
        });
        
        if (oldBuff && oldKey) {
            // 기존 버프 제거
            charBuffs.delete(oldKey);
            
            // 새 버프 생성
            const newBuff = new Buff({
                id: ++this.buffIdCounter,
                buffId: toBuffId,
                key: oldKey.replace(fromBuffId, toBuffId),
                source: oldBuff.source,
                target: oldBuff.target,
                stats: newStats,
                duration: oldBuff.duration,
                startTime: this.timeManager.currentTime
            });
            
            charBuffs.set(newBuff.key, newBuff);
            this.updateCharacterBuffState(targetId);
        }
    }
    
    /**
     * 조건부 버프 제거
     */
    removeConditionalBuff(targetId, buffId) {
        const charBuffs = this.activeBuffs.get(targetId);
        if (!charBuffs) return;
        
        const toRemove = [];
        charBuffs.forEach((buff, key) => {
            if (buff.buffId === buffId && buff.duration.type === 'conditional') {
                toRemove.push(key);
            }
        });
        
        toRemove.forEach(key => charBuffs.delete(key));
        
        if (toRemove.length > 0) {
            this.updateCharacterBuffState(targetId);
        }
    }
    
    /**
     * 샷 기반 버프 감소
     */
    decrementShotBuffs(characterId) {
        const charBuffs = this.activeBuffs.get(characterId);
        if (!charBuffs) return;
        
        const toRemove = [];
        
        charBuffs.forEach((buff, key) => {
            if (buff.duration.type === 'shots') {
                buff.duration.value--;
                if (buff.duration.value <= 0) {
                    toRemove.push(key);
                }
            }
        });
        
        toRemove.forEach(key => charBuffs.delete(key));
        
        if (toRemove.length > 0) {
            this.updateCharacterBuffState(characterId);
        }
    }
    
    /**
     * 리셋
     */
    reset() {
        this.activeBuffs.clear();
        this.buffIdCounter = 0;
    }
}

/**
 * 버프 클래스
 */
class Buff {
    constructor(data) {
        this.id = data.id;
        this.buffId = data.buffId;
        this.key = data.key;
        this.source = data.source;
        this.target = data.target;
        this.stats = data.stats;
        this.duration = data.duration;
        this.startTime = data.startTime;
        this.stackable = data.stackable || false;
        this.maxStacks = data.maxStacks || 1;
        this.stacks = 1;
        
        this.calculateEndTime();
    }
    
    calculateEndTime() {
        switch (this.duration.type) {
            case 'permanent':
                this.endTime = Infinity;
                break;
            case 'time':
                this.endTime = this.startTime + this.duration.value;
                break;
            case 'conditional':
            case 'shots':
                this.endTime = Infinity;
                break;
            default:
                this.endTime = this.startTime;
        }
    }
    
    isExpired(currentTime) {
        if (this.duration.type === 'time') {
            return currentTime > this.endTime;
        }
        return false;
    }
    
    refreshTime(currentTime) {
        this.startTime = currentTime;
        this.calculateEndTime();
    }
    
    getEffectiveStats() {
        const effectiveStats = {};
        
        Object.entries(this.stats).forEach(([stat, value]) => {
            if (this.stackable) {
                // 스택 적용
                if (typeof value === 'object' && value.value !== undefined) {
                    effectiveStats[stat] = {
                        ...value,
                        value: value.value * this.stacks
                    };
                } else {
                    effectiveStats[stat] = value * this.stacks;
                }
            } else {
                effectiveStats[stat] = value;
            }
        });
        
        return effectiveStats;
    }
}

// 전역 노출
window.BuffSystem = BuffSystem;
window.Buff = Buff;