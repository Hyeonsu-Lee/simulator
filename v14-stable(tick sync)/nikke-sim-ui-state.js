/* nikke-sim-ui-state.js - UI 상태 관리 */

class UIState {
    constructor() {
        this.state = {
            // 스쿼드 (1~5)
            squad: [null, null, null, null, null],
            targetIndex: 0, // 타겟 캐릭터 인덱스 (0~4)
            
            // 캐릭터별 설정
            characterConfigs: new Map(), // characterId -> { level, coreLevel, customAtk }
            
            // 시뮬레이션 설정
            simulationConfig: {
                distance: 2, // 1~4
                eliteCode: 'yes',
                coreSize: 30,
                cubeType: 'reload',
                duration: COMBAT_TIME,
                speed: 60,
                runCount: 1
            },
            
            // 오버로드 설정
            overloadConfig: {
                helmet: { slot1: null, slot2: null, slot3: null },
                gloves: { slot1: null, slot2: null, slot3: null },
                armor: { slot1: null, slot2: null, slot3: null },
                boots: { slot1: null, slot2: null, slot3: null }
            }
        };
        
        // 리스너
        this.listeners = new Map();
    }
    
    // 스쿼드 관리
    setSquadMember(index, characterId) {
        if (index < 0 || index > 4) return;
        
        this.state.squad[index] = characterId;
        this.notify('squad', { index, characterId });
    }
    
    setTargetIndex(index) {
        if (index < 0 || index > 4) return;
        if (!this.state.squad[index]) {
            alert('해당 슬롯이 비어있습니다.');
            return;
        }
        
        this.state.targetIndex = index;
        this.notify('target', index);
    }
    
    // 캐릭터 설정
    setCharacterConfig(characterId, config) {
        if (!characterId) return;
        
        const currentConfig = this.state.characterConfigs.get(characterId) || {
            level: 200,
            coreLevel: 10,
            customAtk: null
        };
        
        this.state.characterConfigs.set(characterId, {
            ...currentConfig,
            ...config
        });
        
        this.notify('characterConfig', { characterId, config });
    }
    
    getCharacterConfig(characterId) {
        return this.state.characterConfigs.get(characterId) || {
            level: 200,
            coreLevel: 10,
            customAtk: null
        };
    }
    
    // 시뮬레이션 설정
    setSimulationConfig(key, value) {
        if (key in this.state.simulationConfig) {
            this.state.simulationConfig[key] = value;
            this.notify('simulationConfig', { key, value });
        }
    }
    
    // 오버로드 설정
    setOverloadSlot(equipment, slot, config) {
        if (!this.state.overloadConfig[equipment]) return;
        
        const slotKey = `slot${slot}`;
        this.state.overloadConfig[equipment][slotKey] = config;
        
        this.notify('overload', { equipment, slot, config });
    }
    
    getOverloadBuffs() {
        const buffs = {
            atkPercent: 0,
            critRate: 0,
            critDamage: 0,
            accuracy: 0,
            maxAmmo: 0,
            eliteDamage: 0
        };
        
        Object.values(this.state.overloadConfig).forEach(equipment => {
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
    
    // 시뮬레이션 설정 가져오기
    getSimulationSetup() {
        // 실제 캐릭터 인스턴스 생성
        const squad = this.state.squad.map(id => {
            if (!id) return null;
            
            const character = CHARACTER_REGISTRY.create(id, this.getCharacterConfig(id));
            return character;
        }).filter(c => c !== null);
        
        if (squad.length === 0) {
            throw new Error('스쿼드에 캐릭터가 없습니다.');
        }
        
        const targetIndex = Math.min(this.state.targetIndex, squad.length - 1);
        
        return {
            squad,
            targetIndex,
            config: {
                ...this.state.simulationConfig,
                overloadBuffs: this.getOverloadBuffs()
            }
        };
    }
    
    // 리스너 관리
    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }
    
    notify(event, data) {
        this.listeners.get(event)?.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in ${event} listener:`, error);
            }
        });
    }
    
    // 상태 초기화
    reset() {
        this.state.squad = [null, null, null, null, null];
        this.state.targetIndex = 0;
        this.state.characterConfigs.clear();
        this.notify('reset', {});
    }
    
    // 디버그
    getSnapshot() {
        return {
            squad: [...this.state.squad],
            targetIndex: this.state.targetIndex,
            characterConfigs: Array.from(this.state.characterConfigs.entries()),
            simulationConfig: { ...this.state.simulationConfig },
            overloadConfig: JSON.parse(JSON.stringify(this.state.overloadConfig))
        };
    }
}

// AppState 호환성 래퍼
const AppState = {
    // 내부 인스턴스
    _instance: new UIState(),
    
    // 설정
    config: {
        get overload() {
            return AppState._instance.state.overloadConfig;
        },
        simulation: {
            get eliteCode() {
                return AppState._instance.state.simulationConfig.eliteCode;
            },
            get coreSize() {
                return AppState._instance.state.simulationConfig.coreSize;
            },
            get cubeType() {
                return AppState._instance.state.simulationConfig.cubeType;
            }
        }
    },
    
    // 런타임
    runtime: {
        currentSimulator: null,
        logger: new CombatLogger(),
        multiRunResults: [],
        isFirstUpdate: true
    },
    
    // 메서드
    updateOverloadConfig(newConfig) {
        AppState._instance.state.overloadConfig = newConfig;
    },
    
    getOverloadConfig() {
        return JSON.parse(JSON.stringify(AppState._instance.state.overloadConfig));
    },
    
    setCurrentSimulator(simulator) {
        AppState.runtime.currentSimulator = simulator;
    },
    
    clearRuntime() {
        AppState.runtime.multiRunResults = [];
        AppState.runtime.isFirstUpdate = true;
        if (AppState.runtime.logger) {
            AppState.runtime.logger.clear();
        }
    }
};