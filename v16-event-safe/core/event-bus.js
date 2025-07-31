// core/event-bus.js - 중앙 이벤트 시스템

class EventBus {
    constructor() {
        this.events = new Map();
        this.eventQueue = [];
        this.processing = false;
        this.eventId = 0;
    }
    
    /**
     * 이벤트 핸들러 등록
     * @param {string} eventType 
     * @param {Function} handler 
     * @returns {Function} unsubscribe 함수
     */
    on(eventType, handler) {
        if (!this.events.has(eventType)) {
            this.events.set(eventType, new Set());
        }
        
        this.events.get(eventType).add(handler);
        
        // unsubscribe 함수 반환
        return () => {
            this.events.get(eventType)?.delete(handler);
        };
    }
    
    /**
     * 이벤트 발행
     * @param {string} eventType 
     * @param {Object} data 
     */
    emit(eventType, data = {}) {
        const event = {
            id: ++this.eventId,
            type: eventType,
            data: data,
            timestamp: Date.now()
        };
        
        this.eventQueue.push(event);
        
        if (!this.processing) {
            this.processQueue();
        }
    }
    
    /**
     * 이벤트 큐 처리
     */
    processQueue() {
        this.processing = true;
        
        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift();
            const handlers = this.events.get(event.type);
            
            if (handlers) {
                handlers.forEach(handler => {
                    try {
                        handler(event);
                    } catch (error) {
                        console.error(`Error in handler for ${event.type}:`, error);
                    }
                });
            }
        }
        
        this.processing = false;
    }
    
    /**
     * 모든 이벤트 핸들러 제거
     */
    clear() {
        this.events.clear();
        this.eventQueue = [];
    }
}

// 이벤트 타입 정의
const Events = {
    // 시스템 이벤트
    INIT: 'system.init',
    START: 'system.start',
    STOP: 'system.stop',
    TICK: 'system.tick',
    
    // 상태 변경 이벤트
    STATE_CHANGED: 'state.changed',
    
    // 전투 이벤트
    ATTACK: 'combat.attack',
    DAMAGE: 'combat.damage',
    RELOAD: 'combat.reload',
    AMMO_CHANGE: 'combat.ammo_change',
    LAST_BULLET: 'combat.last_bullet',
    FULL_CHARGE: 'combat.full_charge',
    HEAL: 'combat.heal',
    BATTLE_START: 'combat.battle_start',
    
    // 스킬 이벤트
    SKILL_TRIGGER: 'skill.trigger',
    SKILL_ACTIVATE: 'skill.activate',
    SKILL_DEACTIVATE: 'skill.deactivate',
    
    // 버프 이벤트
    BUFF_APPLY: 'buff.apply',
    BUFF_REMOVE: 'buff.remove',
    BUFF_UPDATE: 'buff.update',
    
    // 버스트 이벤트
    BURST_READY: 'burst.ready',
    BURST_USE: 'burst.use',
    BURST_CYCLE_START: 'burst.cycle_start',
    BURST_CYCLE_END: 'burst.cycle_end',
    FULL_BURST: 'burst.full',
    FULL_BURST_END: 'burst.full_end', // 추가됨
    
    // UI 이벤트
    UI_UPDATE: 'ui.update',
    LOG_MESSAGE: 'ui.log',
    PROGRESS_UPDATE: 'ui.progress',
    
    // 설정 이벤트
    CONFIG_CHANGE: 'config.change',
    SQUAD_CHANGE: 'squad.change',
    
    // 결과 이벤트
    SIMULATION_COMPLETE: 'simulation.complete',
    RUN_COMPLETE: 'run.complete'
};

// 전역 이벤트 버스 인스턴스
const eventBus = new EventBus();

// 내보내기
window.EventBus = EventBus;
window.Events = Events;
window.eventBus = eventBus;