/* nikke-sim-interfaces.js - 인터페이스 정의 */

// 캐릭터 인터페이스
const ICharacter = {
    // 기본 정보
    id: '',
    name: '',
    weaponType: '',
    burstPosition: 0,
    burstCooldown: 0,
    burstReEntry: false,
    
    // 스탯
    baseStats: {
        atk: 0,
        weaponCoef: 0,
        baseAmmo: 0,
        basePellets: 1,
        attackInterval: 0,
        reloadTime: 0
    },
    
    // 메서드
    getStatWithCoreAndLevel(coreLevel, level) {},
    getSkills() {},
    getSpecialSystems() {}
};

// 스킬 인터페이스
const ISkill = {
    id: '',
    name: '',
    slot: '', // 'skill1', 'skill2', 'burst'
    type: '', // 'buff', 'action'
    priority: 0,
    
    // 발동 조건
    trigger: {
        type: '', // 'passive', 'conditional', 'periodic', 'burst'
        condition: null, // function(context) => boolean
        params: {} // 추가 파라미터
    },
    
    // 효과
    effects: {
        buffs: [], // 버프 효과
        actions: [] // 액션 효과
    },
    
    // 지속 시간
    duration: {
        type: '', // 'permanent', 'time', 'shots', 'until_reload'
        value: 0
    }
};

// 버프 효과 인터페이스
const IBuffEffect = {
    target: '', // 'self', 'all_allies', 'burst_users'
    stat: '', // 'atkPercent', 'critRate', etc.
    value: 0,
    isFixedATK: false, // fixedATK 특수 처리
    fixedATKConfig: null
};

// 액션 효과 인터페이스
const IActionEffect = {
    type: '', // 'replace_attack', 'additional_attack', 'special'
    shots: 0, // 특수탄 횟수
    modifiers: {}, // 대미지 모디파이어
    onActivate: null, // function(context) - 발동 시 실행
    onHit: null, // function(context, damage) - 명중 시 실행
    canStack: false // 중첩 가능 여부
};

// 특수 시스템 인터페이스
const ISpecialSystem = {
    id: '',
    type: '', // 'counter', 'state', 'resource'
    
    // 카운터 타입
    counter: {
        max: 0,
        current: 0,
        resetOn: '' // 'skill_activate', 'reload', 'burst'
    },
    
    // 상태 타입
    state: {
        values: [],
        current: 0,
        transitions: {} // 상태 전이 규칙
    },
    
    // 메서드
    update(context) {},
    getValue() {},
    reset() {}
};

// 전투 컨텍스트 인터페이스
const ICombatContext = {
    // 시간
    time: 0,
    deltaTime: 0,
    
    // 스쿼드
    squad: [], // 5명의 캐릭터
    targetIndex: 0, // 타겟 캐릭터 인덱스 (0~4)
    
    // 버스트
    cycle: 0,
    burstUsers: {
        burst1User: null,
        burst2User: null,
        burst3User: null,
        isFullBurst: false
    },
    
    // 전투 상태
    distance: 2, // 1~4
    isEliteEnemy: false,
    
    // 캐릭터별 상태
    characterStates: new Map() // characterId -> state
};

// 캐릭터 상태 인터페이스
const ICharacterState = {
    // 공격 관련
    shotCount: 0,
    currentAmmo: 0,
    nextAttackTime: 0,
    isReloading: false,
    
    // 대미지 통계
    totalDamage: 0,
    critCount: 0,
    coreHitCount: 0,
    totalPellets: 0,
    
    // 스킬 관련
    activeSkills: new Map(), // skillId -> activation info
    skillCounters: new Map(), // skillId -> counter
    
    // 특수 시스템
    specialSystems: new Map() // systemId -> system state
};