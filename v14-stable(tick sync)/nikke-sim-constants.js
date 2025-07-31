/* nikke-sim-constants.js - 게임 상수 정의 */

// 버프 타입
const BUFF_TYPES = {
    PASSIVE: 'passive',
    FULLBURST: 'fullburst',
    BURST: 'burst',
    PERIODIC: 'periodic',
    STACK_BASED: 'stack_based',
    CYCLE_BASED: 'cycle_based',
    CONDITIONAL: 'conditional'
};

// 버프 타겟
const BUFF_TARGETS = {
    SELF: 'self',
    ALL_ALLIES: 'all_allies',
    BURST_USER_THIS_CYCLE: 'burst_user_this_cycle'
};

// 게임 상수
const COMBAT_TIME = 180;
const ENEMY_DEF = 0;//31784;
const CRIT_RATE = 0.15;
const CRIT_DMG = 0.0; // 이미 대미지 계산 공식에서 0.5 적용 중
const BURST_CYCLE_TIME = 12.43;
const BURST_START_TIME = 2.43;

// 큐브 데이터
const CUBE_DATA = {
    reload: {
        name: '재장전 큐브',
        effects: { reloadSpeed: 0.2969 }
    }
};

// 오버로드 옵션
const OVERLOAD_OPTIONS = {
    'eliteDamage': {
        name: '우월코드 대미지 증가',
        values: [9.54, 10.94, 12.34, 13.75, 15.15, 16.55, 17.95, 19.35, 20.75, 22.15, 23.56, 24.96, 26.36, 27.76, 29.16]
    },
    'accuracy': {
        name: '명중률 증가',
        values: [4.77, 5.47, 6.18, 6.88, 7.59, 8.29, 9.00, 9.70, 10.40, 11.11, 11.81, 12.52, 13.22, 13.93, 14.63]
    },
    'maxAmmo': {
        name: '최대 장탄 수 증가',
        values: [27.84, 31.95, 36.06, 40.17, 44.28, 48.39, 52.50, 56.60, 60.71, 64.82, 68.93, 73.04, 77.15, 81.26, 85.37]
    },
    'attack': {
        name: '공격력 증가',
        values: [4.77, 5.47, 6.18, 6.88, 7.59, 8.29, 9.00, 9.70, 10.40, 11.11, 11.81, 12.52, 13.22, 13.93, 14.63]
    },
    'critDamage': {
        name: '크리티컬 피해량 증가',
        values: [6.64, 7.62, 8.60, 9.58, 10.56, 11.54, 12.52, 13.50, 14.48, 15.46, 16.44, 17.42, 18.40, 19.38, 20.36]
    },
    'critRate': {
        name: '크리티컬 확률 증가',
        values: [2.30, 2.64, 2.98, 3.32, 3.66, 4.00, 4.35, 4.69, 5.03, 5.37, 5.70, 6.05, 6.39, 6.73, 7.07]
    }
};

// 무기별 정밀 계수
const WEAPON_PARAMS = {
    'SG': { base: 278, reduction: 2.84, name: 'SG (샷건)' }
};