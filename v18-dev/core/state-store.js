// core/state-store.js - 불변 상태 저장소 (개선된 버전)

class StateStore {
    constructor(initialState = {}) {
        this._state = this.deepFreeze(initialState);
        this._subscribers = new Set();
        this._history = [];
        this._maxHistory = 100;
        this._snapshots = new Map();
    }
    
    /**
     * 현재 상태 반환
     */
    getState() {
        return this._state;
    }
    
    /**
     * 상태 업데이트
     * @param {Function} updater - (prevState) => newState
     */
    update(updater) {
        const prevState = this._state;
        const newState = updater(this.deepClone(prevState));
        
        if (newState !== prevState) {
            this._state = this.deepFreeze(newState);
            this._history.push({ state: prevState, timestamp: Date.now() });
            
            if (this._history.length > this._maxHistory) {
                this._history.shift();
            }
            
            this.notify();
        }
    }
    
    /**
     * 특정 경로의 값 반환
     * @param {string} path - 'combat.targetCharacter.damage'
     */
    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this._state);
    }
    
    /**
     * 특정 경로에 값 설정
     * @param {string} path 
     * @param {*} value 
     */
    set(path, value) {
        this.update(state => {
            const keys = path.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((obj, key) => {
                if (!obj[key]) obj[key] = {};
                return obj[key];
            }, state);
            
            target[lastKey] = value;
            return state;
        });
    }
    
    /**
     * 구독자 등록
     * @param {Function} subscriber 
     * @returns {Function} unsubscribe
     */
    subscribe(subscriber) {
        this._subscribers.add(subscriber);
        return () => this._subscribers.delete(subscriber);
    }
    
    /**
     * 구독자들에게 알림
     */
    notify() {
        const state = this.getState();
        this._subscribers.forEach(subscriber => {
            try {
                subscriber(state);
            } catch (error) {
                console.error('Error in state subscriber:', error);
            }
        });
    }
    
    /**
     * 상태 리셋
     */
    reset(newState = {}) {
        this._state = this.deepFreeze(newState);
        this._history = [];
        this.notify();
    }
    
    /**
     * 히스토리에서 이전 상태로 복원
     */
    undo() {
        if (this._history.length > 0) {
            const { state } = this._history.pop();
            this._state = state;
            this.notify();
        }
    }
    
    /**
     * 스냅샷 생성
     * @param {string} name - 스냅샷 이름
     * @returns {string} 스냅샷 ID
     */
    createSnapshot(name) {
        const snapshotId = `${name}_${Date.now()}`;
        this._snapshots.set(snapshotId, {
            name,
            state: this.deepClone(this._state),
            timestamp: Date.now()
        });
        return snapshotId;
    }
    
    /**
     * 스냅샷 복원
     * @param {string} snapshotId - 스냅샷 ID
     * @returns {boolean} 성공 여부
     */
    restoreSnapshot(snapshotId) {
        const snapshot = this._snapshots.get(snapshotId);
        if (!snapshot) {
            console.error(`Snapshot not found: ${snapshotId}`);
            return false;
        }
        
        this._state = this.deepFreeze(this.deepClone(snapshot.state));
        this.notify();
        return true;
    }
    
    /**
     * 스냅샷 목록
     * @returns {Array} 스냅샷 정보 배열
     */
    listSnapshots() {
        return Array.from(this._snapshots.entries()).map(([id, snapshot]) => ({
            id,
            name: snapshot.name,
            timestamp: new Date(snapshot.timestamp).toISOString()
        }));
    }
    
    /**
     * 스냅샷 삭제
     * @param {string} snapshotId - 스냅샷 ID
     * @returns {boolean} 성공 여부
     */
    deleteSnapshot(snapshotId) {
        return this._snapshots.delete(snapshotId);
    }
    
    /**
     * 모든 스냅샷 삭제
     */
    clearSnapshots() {
        this._snapshots.clear();
    }
    
    /**
     * 객체 깊은 복사
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            return Object.keys(obj).reduce((cloned, key) => {
                cloned[key] = this.deepClone(obj[key]);
                return cloned;
            }, {});
        }
    }
    
    /**
     * 객체 깊은 동결
     */
    deepFreeze(obj) {
        Object.freeze(obj);
        Object.getOwnPropertyNames(obj).forEach(prop => {
            if (obj[prop] !== null && typeof obj[prop] === 'object' && !Object.isFrozen(obj[prop])) {
                this.deepFreeze(obj[prop]);
            }
        });
        return obj;
    }
    
    /**
     * 상태 검증
     * @param {Function} validator - (state) => errors[]
     * @returns {Array} 검증 오류 목록
     */
    validate(validator) {
        return validator(this.getState()) || [];
    }
    
    /**
     * 리소스 정리
     */
    destroy() {
        this._subscribers.clear();
        this._history = [];
        this._snapshots.clear();
    }
}

// 초기 상태 구조
const initialState = {
    // 시뮬레이션 설정
    config: {
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
    
    // 오버로드 설정
    overload: {
        helmet: {},
        gloves: {},
        armor: {},
        boots: {}
    },
    
    // 전투 상태
    combat: {
        time: 0,
        running: false,
        characters: {},
        globalCounters: {
            bulletsConsumed: 0
        }
    },
    
    // 버스트 상태
    burst: {
        cycle: 0,
        ready: false,
        users: [],
        fullBurst: false,
        cooldowns: {}
    },
    
    // 버프 상태
    buffs: {
        active: {},
        static: {}
    },
    
    // 통계
    stats: {
        current: {},
        history: []
    },
    
    // UI 상태
    ui: {
        progress: 0,
        logs: []
    }
};

// 전역 노출
window.StateStore = StateStore;
window.initialState = initialState;

// 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StateStore, initialState };
}