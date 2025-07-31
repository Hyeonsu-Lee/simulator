// infrastructure/config-manager.js - 설정 관리자

class ConfigManager {
    constructor() {
        this.config = {
            // 시뮬레이션 설정
            simulation: {
                distance: 2,
                coreSize: 30,
                eliteCode: 'yes',
                cubeType: 'reload',
                speed: 60,
                runCount: 1,
                duration: 180
            },
            
            // 스쿼드 설정
            squad: {
                members: [null, null, null, null, null],
                targetIndex: 0
            },
            
            // 캐릭터별 설정
            characters: new Map(),
            
            // 오버로드 설정
            overload: {
                helmet: { slot1: null, slot2: null, slot3: null },
                gloves: { slot1: null, slot2: null, slot3: null },
                armor: { slot1: null, slot2: null, slot3: null },
                boots: { slot1: null, slot2: null, slot3: null }
            }
        };
        
        // stateStore와 동기화
        this.syncWithStateStore();
    }
    
    /**
     * stateStore와 초기 동기화
     */
    syncWithStateStore() {
        // ConfigManager는 자체 config를 관리하고
        // stateStore에는 필요한 부분만 동기화
        stateStore.update(state => {
            state.squad = {
                members: [...this.config.squad.members],
                targetIndex: this.config.squad.targetIndex
            };
            return state;
        });
    }
    
    /**
     * 설정 값 가져오기
     * @param {string} path - 'simulation.distance'
     */
    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.config);
    }
    
    /**
     * 설정 값 설정
     * @param {string} path 
     * @param {*} value 
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this.config);
        
        const oldValue = target[lastKey];
        target[lastKey] = value;
        
        // 변경 이벤트 발생
        eventBus.emit(Events.CONFIG_CHANGE, {
            path,
            oldValue,
            newValue: value
        });
        
        // 상태 저장소 업데이트
        stateStore.set(`config.${path}`, value);
    }
    
    /**
     * 스쿼드 멤버 설정
     * @param {number} index 
     * @param {string} characterId 
     */
    setSquadMember(index, characterId) {
        if (index < 0 || index > 4) return;
        
        const oldSquad = [...this.config.squad.members];
        this.config.squad.members[index] = characterId;
        
        // stateStore 업데이트
        stateStore.update(state => {
            if (!state.squad) state.squad = { members: [], targetIndex: 0 };
            if (!state.squad.members) state.squad.members = [null, null, null, null, null];
            state.squad.members[index] = characterId;
            return state;
        });
        
        eventBus.emit(Events.SQUAD_CHANGE, {
            index,
            characterId,
            oldSquad,
            newSquad: [...this.config.squad.members]
        });
    }
    
    /**
     * 타겟 인덱스 설정
     * @param {number} index 
     */
    setTargetIndex(index) {
        if (index < 0 || index > 4) return;
        if (!this.config.squad.members[index]) return;
        
        const oldIndex = this.config.squad.targetIndex;
        this.config.squad.targetIndex = index;
        
        // stateStore 업데이트
        stateStore.update(state => {
            if (!state.squad) state.squad = { members: [], targetIndex: 0 };
            state.squad.targetIndex = index;
            return state;
        });
        
        eventBus.emit(Events.CONFIG_CHANGE, {
            path: 'squad.targetIndex',
            oldValue: oldIndex,
            newValue: index
        });
    }
    
    /**
     * 캐릭터 설정
     * @param {string} characterId 
     * @param {Object} settings 
     */
    setCharacterConfig(characterId, settings) {
        if (!this.config.characters.has(characterId)) {
            this.config.characters.set(characterId, {
                level: 200,
                coreLevel: 10,
                customAtk: null
            });
        }
        
        const charConfig = this.config.characters.get(characterId);
        Object.assign(charConfig, settings);
    }
    
    /**
     * 오버로드 설정
     * @param {string} equipment 
     * @param {number} slot 
     * @param {Object} option 
     */
    setOverloadOption(equipment, slot, option) {
        const slotKey = `slot${slot}`;
        if (!this.config.overload[equipment] || 
            !this.config.overload[equipment].hasOwnProperty(slotKey)) {
            return;
        }
        
        this.config.overload[equipment][slotKey] = option;
        
        eventBus.emit(Events.CONFIG_CHANGE, {
            path: `overload.${equipment}.${slotKey}`,
            newValue: option
        });
    }
    
    /**
     * 오버로드 버프 계산
     */
    calculateOverloadBuffs() {
        const buffs = {
            atkPercent: 0,
            critRate: 0,
            critDamage: 0,
            accuracy: 0,
            maxAmmo: 0,
            eliteDamage: 0
        };
        
        Object.values(this.config.overload).forEach(equipment => {
            Object.values(equipment).forEach(slot => {
                if (slot && slot.type && slot.level) {
                    const option = OVERLOAD_OPTIONS[slot.type];
                    if (!option) return;
                    
                    const value = option.values[slot.level - 1] / 100;
                    
                    switch(slot.type) {
                        case 'attack': 
                            buffs.atkPercent += value; 
                            break;
                        case 'critRate': 
                            buffs.critRate += value; 
                            break;
                        case 'critDamage': 
                            buffs.critDamage += value; 
                            break;
                        case 'accuracy': 
                            buffs.accuracy += option.values[slot.level - 1]; 
                            break;
                        case 'maxAmmo': 
                            buffs.maxAmmo += value; 
                            break;
                        case 'eliteDamage': 
                            buffs.eliteDamage += value; 
                            break;
                    }
                }
            });
        });
        
        return buffs;
    }
    
    /**
     * 시뮬레이션 설정 가져오기
     */
    getSimulationConfig() {
        return {
            ...this.config.simulation,
            overloadBuffs: this.calculateOverloadBuffs(),
            squad: this.config.squad.members.filter(id => id !== null),
            targetIndex: this.config.squad.targetIndex
        };
    }
    
    /**
     * 설정 리셋
     */
    reset() {
        this.config = {
            simulation: {
                distance: 2,
                coreSize: 30,
                eliteCode: 'yes',
                cubeType: 'reload',
                speed: 60,
                runCount: 1,
                duration: 180
            },
            squad: {
                members: [null, null, null, null, null],
                targetIndex: 0
            },
            characters: new Map(),
            overload: {
                helmet: { slot1: null, slot2: null, slot3: null },
                gloves: { slot1: null, slot2: null, slot3: null },
                armor: { slot1: null, slot2: null, slot3: null },
                boots: { slot1: null, slot2: null, slot3: null }
            }
        };
        
        this.syncWithStateStore();
        eventBus.emit(Events.CONFIG_CHANGE, { reset: true });
    }
}

// 전역 설정 관리자
const configManager = new ConfigManager();

// 내보내기
window.ConfigManager = ConfigManager;
window.configManager = configManager;