// core/event-types.js - 중앙 이벤트 타입 정의

const Events = Object.freeze({
    // 시스템 이벤트
    INIT: 'system.init',
    START: 'system.start',
    STOP: 'system.stop',
    TICK: 'system.tick',
    ERROR: 'system.error',
    DESTROY: 'system.destroy',
    
    // 상태 변경 이벤트
    STATE_CHANGED: 'state.changed',
    STATE_SNAPSHOT: 'state.snapshot',
    STATE_RESTORE: 'state.restore',
    
    // 전투 이벤트
    ATTACK: 'combat.attack',
    DAMAGE: 'combat.damage',
    RELOAD: 'combat.reload',
    AMMO_CHANGE: 'combat.ammo_change',
    LAST_BULLET: 'combat.last_bullet',
    FULL_CHARGE: 'combat.full_charge',
    HEAL: 'combat.heal',
    BATTLE_START: 'combat.battle_start',
    
    // 계산 요청 이벤트
    CALCULATE_DAMAGE: 'calculate.damage',
    DAMAGE_CALCULATED: 'calculate.damage.result',
    
    // 스킬 이벤트
    SKILL_TRIGGER: 'skill.trigger',
    SKILL_ACTIVATE: 'skill.activate',
    SKILL_DEACTIVATE: 'skill.deactivate',
    
    // 버프 이벤트
    BUFF_APPLY: 'buff.apply',
    BUFF_REMOVE: 'buff.remove',
    BUFF_UPDATE: 'buff.update',
    BUFF_CALCULATE: 'buff.calculate',
    BUFF_CALCULATED: 'buff.calculate.result',
    BUFF_TRANSFORM: 'buff.transform',
    BUFF_DECREMENT_SHOT: 'buff.decrement_shot',
    
    // 버스트 이벤트
    BURST_READY: 'burst.ready',
    BURST_USE: 'burst.use',
    BURST_CYCLE_START: 'burst.cycle_start',
    BURST_CYCLE_END: 'burst.cycle_end',
    FULL_BURST: 'burst.full',
    FULL_BURST_END: 'burst.full_end',
    
    // UI 이벤트
    UI_UPDATE: 'ui.update',
    LOG_MESSAGE: 'ui.log',
    PROGRESS_UPDATE: 'ui.progress',
    
    // 설정 이벤트
    CONFIG_CHANGE: 'config.change',
    CONFIG_VALIDATE: 'config.validate',
    SQUAD_CHANGE: 'squad.change',
    
    // 결과 이벤트
    SIMULATION_COMPLETE: 'simulation.complete',
    RUN_COMPLETE: 'run.complete',
    
    // 미디에이터 이벤트
    MEDIATOR_REQUEST: 'mediator.request',
    MEDIATOR_RESPONSE: 'mediator.response',
    
    // 레코더 이벤트
    RECORDER_START: 'recorder.start',
    RECORDER_STOP: 'recorder.stop',
    RECORDER_REPLAY: 'recorder.replay'
});

// 로그 레벨
const LogLevel = Object.freeze({
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4
});

// 에러 코드
const ErrorCode = Object.freeze({
    CIRCULAR_DEPENDENCY: 'E001',
    INITIALIZATION_FAILED: 'E002',
    INVALID_CONFIG: 'E003',
    CALCULATION_FAILED: 'E004',
    EVENT_TIMEOUT: 'E005',
    RESOURCE_LEAK: 'E006'
});

// 전역 노출
window.Events = Events;
window.LogLevel = LogLevel;
window.ErrorCode = ErrorCode;

// 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Events, LogLevel, ErrorCode };
}