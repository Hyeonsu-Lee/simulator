// infrastructure/config-manager.js - 설정 관리자 (개선된 버전)

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
        
        // 검증 규칙
        this.validationRules = {
            'simulation.distance': { min: 1, max: 4, type: 'number' },
            'simulation.coreSize': { values: [0, 20, 30, 40, 50, 75, 100], type: 'number' },
            'simulation.eliteCode': { values: ['yes', 'no'], type: 'string' },
            'simulation.speed': { min: 1, max: 300, type: 'number' },
            'simulation.runCount': { min: 1, max: 100, type: 'number' },
            'simulation.duration': { min: 1, max: 600, type: 'number' },
            'squad.targetIndex': { min: 0, max: 4, type: 'number' }
        };
        
        // squad와 동기화
        this.syncWithSquad();
    }
    
    /**
     * squad와 초기 동기화
     */
    syncWithSquad() {
        if (typeof squad !== 'undefined') {
            squad.update(state => {
                state.squad = {
                    members: [...this.config.squad.members],
                    targetIndex: this.config.squad.targetIndex
                };
                return state;
            });
        }
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
     * @throws {Error} 검증 실패 시
     */
    set(path, value) {
        // 값 검증
        this.validateValue(path, value);
        
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this.config);
        
        const oldValue = target[lastKey];
        target[lastKey] = value;
        
        // 변경 이벤트 발생
        if (typeof eventBus !== 'undefined' && typeof Events !== 'undefined') {
            eventBus.emit(Events.CONFIG_CHANGE, {
                path,
                oldValue,
                newValue: value
            });
        }
        
        // 상태 저장소 업데이트
        if (typeof squad !== 'undefined') {
            squad.set(`config.${path}`, value);
        }
    }
    
    /**
     * 값 검증
     * @param {string} path 
     * @param {*} value 
     * @throws {Error} 검증 실패 시
     */
    validateValue(path, value) {
        const rule = this.validationRules[path];
        if (!rule) return; // 규칙이 없으면 통과
        
        // 타입 검증
        if (rule.type && typeof value !== rule.type) {
            throw new Error(`${path}: Expected ${rule.type}, got ${typeof value}`);
        }
        
        // 최소/최대값 검증
        if (rule.min !== undefined && value < rule.min) {
            throw new Error(`${path}: Value ${value} is less than minimum ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
            throw new Error(`${path}: Value ${value} is greater than maximum ${rule.max}`);
        }
        
        // 허용된 값 목록 검증
        if (rule.values && !rule.values.includes(value)) {
            throw new Error(`${path}: Value ${value} is not in allowed values: ${rule.values.join(', ')}`);
        }
        
        // 커스텀 검증 함수
        if (rule.validate && !rule.validate(value)) {
            throw new Error(`${path}: Custom validation failed for value ${value}`);
        }
    }
    
    /**
     * 스쿼드 멤버 설정
     * @param {number} index 
     * @param {string} characterId 
     */
    setSquadMember(index, characterId) {
        if (index < 0 || index > 4) {
            throw new Error(`Invalid squad index: ${index}`);
        }
        
        const oldSquad = [...this.config.squad.members];
        this.config.squad.members[index] = characterId;
        
        // squad 업데이트
        if (typeof squad !== 'undefined') {
            squad.update(state => {
                if (!state.squad) state.squad = { members: [], targetIndex: 0 };
                if (!state.squad.members) state.squad.members = [null, null, null, null, null];
                state.squad.members[index] = characterId;
                return state;
            });
        }
        
        if (typeof eventBus !== 'undefined' && typeof Events !== 'undefined') {
            eventBus.emit(Events.SQUAD_CHANGE, {
                index,
                characterId,
                oldSquad,
                newSquad: [...this.config.squad.members]
            });
        }
    }
    
    /**
     * 타겟 인덱스 설정
     * @param {number} index 
     */
    setTargetIndex(index) {
        if (index < 0 || index > 4) {
            throw new Error(`Invalid target index: ${index}`);
        }
        if (!this.config.squad.members[index]) {
            throw new Error(`No character at index ${index}`);
        }
        
        const oldIndex = this.config.squad.targetIndex;
        this.config.squad.targetIndex = index;
        
        // squad 업데이트
        if (typeof squad !== 'undefined') {
            squad.update(state => {
                if (!state.squad) state.squad = { members: [], targetIndex: 0 };
                state.squad.targetIndex = index;
                return state;
            });
        }
        
        if (typeof eventBus !== 'undefined' && typeof Events !== 'undefined') {
            eventBus.emit(Events.CONFIG_CHANGE, {
                path: 'squad.targetIndex',
                oldValue: oldIndex,
                newValue: index
            });
        }
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
        
        // 레벨 검증
        if (settings.level !== undefined) {
            if (settings.level < 1 || settings.level > 200) {
                throw new Error(`Invalid level: ${settings.level}`);
            }
        }
        
        // 코어 레벨 검증
        if (settings.coreLevel !== undefined) {
            if (settings.coreLevel < 0 || settings.coreLevel > 10) {
                throw new Error(`Invalid core level: ${settings.coreLevel}`);
            }
        }
        
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
            throw new Error(`Invalid overload slot: ${equipment}.${slotKey}`);
        }
        
        // 동일 장비에 중복 옵션 체크
        if (option && option.type) {
            const existingSlots = Object.entries(this.config.overload[equipment])
                .filter(([key, val]) => key !== slotKey && val?.type === option.type);
            
            if (existingSlots.length > 0) {
                throw new Error(`Duplicate option ${option.type} in ${equipment}`);
            }
        }
        
        this.config.overload[equipment][slotKey] = option;
        
        if (typeof eventBus !== 'undefined' && typeof Events !== 'undefined') {
            eventBus.emit(Events.CONFIG_CHANGE, {
                path: `overload.${equipment}.${slotKey}`,
                newValue: option
            });
        }
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
                    // OVERLOAD_OPTIONS는 constants.js에서 가져와야 함
                    if (typeof OVERLOAD_OPTIONS === 'undefined') {
                        console.warn('OVERLOAD_OPTIONS not defined');
                        return; // forEach에서는 continue 대신 return 사용
                    }
                    
                    const option = OVERLOAD_OPTIONS[slot.type];
                    if (!option) return; // forEach에서는 continue 대신 return 사용
                    
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
     * 설정 검증
     * @returns {Array} 검증 오류 목록
     */
    validateAll() {
        const errors = [];
        
        // 타겟 인덱스 검증
        if (!this.config.squad.members[this.config.squad.targetIndex]) {
            errors.push('Target index points to empty squad slot');
        }
        
        // 스쿼드에 최소 1명 검증
        if (this.config.squad.members.every(m => !m)) {
            errors.push('Squad must have at least one member');
        }
        
        // 시뮬레이션 설정 검증
        Object.entries(this.config.simulation).forEach(([key, value]) => {
            try {
                this.validateValue(`simulation.${key}`, value);
            } catch (error) {
                errors.push(error.message);
            }
        });
        
        return errors;
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
        
        this.syncWithSquad();
        
        if (typeof eventBus !== 'undefined' && typeof Events !== 'undefined') {
            eventBus.emit(Events.CONFIG_CHANGE, { reset: true });
        }
    }
    
    /**
     * 설정 내보내기
     * @returns {Object} 설정 객체
     */
    export() {
        return {
            ...this.config,
            characters: Array.from(this.config.characters.entries())
        };
    }
    
    /**
     * 설정 가져오기
     * @param {Object} configData - 설정 데이터
     */
    import(configData) {
        // 검증 후 적용
        const tempConfig = { ...configData };
        if (tempConfig.characters && Array.isArray(tempConfig.characters)) {
            tempConfig.characters = new Map(tempConfig.characters);
        }
        
        // 모든 값 검증
        // ... 검증 로직
        
        this.config = tempConfig;
        this.syncWithSquad();
    }
}

// 전역 노출
window.ConfigManager = ConfigManager;