// data/constants.js - 모든 상수 정의

// 기본 전투 상수
const CRIT_RATE = 0.15; // 기본 크리티컬 확률 15%
const CRIT_DMG = 0.5; // 기본 크리티컬 대미지 50%
const ENEMY_DEF = 6070; // 적 방어력

// 거리별 최적 거리
const OPTIMAL_DISTANCE = {
    AR: 3,
    SMG: 2,
    SR: 4,
    RL: 4,
    MG: 3,
    SG: 1
};

// 버스트 관련 상수
const BURST_GAUGE_CHARGE_TIME = 5; // 버스트 게이지 충전 시간
const BURST_CYCLE_TIME = 20; // 버스트 사이클 시간
const BURST_USE_DELAY = 0.143; // 버스트 사용 간 딜레이
const FULL_BURST_DURATION = 10; // 풀버스트 지속시간
const BURST_COOLDOWN_MAP = {
    20: 20,
    40: 40,
    60: 60
};

// UI 관련 상수
const UI_UPDATE_INTERVAL = 0.1; // UI 업데이트 주기

// 스킬 관련 상수
const MULTI_HIT_INTERVAL = 0.1; // 다중 타격 간격
const STATE_CHECK_INTERVAL = 0.1; // 상태 체크 주기

// 큐브 데이터
const CUBE_DATA = {
    reload: {
        name: "재장전 큐브",
        effects: {
            reloadSpeed: 0.15 // 재장전 속도 15% 증가
        }
    }
};

// 오버로드 옵션
const OVERLOAD_OPTIONS = {
    attack: {
        name: "공격력(%)",
        values: [4.93, 6.34, 7.40, 8.22, 8.87, 9.38, 9.79, 10.11, 10.37, 10.57, 10.72, 10.84, 10.93, 10.99, 11.04]
    },
    critRate: {
        name: "크리티컬 확률(%)",
        values: [5.48, 7.04, 8.22, 9.13, 9.85, 10.42, 10.88, 11.24, 11.52, 11.74, 11.91, 12.04, 12.14, 12.21, 12.26]
    },
    critDamage: {
        name: "크리티컬 피해량(%)",
        values: [10.95, 14.08, 16.44, 18.26, 19.70, 20.84, 21.75, 22.47, 23.04, 23.49, 23.83, 24.09, 24.28, 24.42, 24.52]
    },
    accuracy: {
        name: "명중률",
        values: [10.95, 14.08, 16.44, 18.26, 19.70, 20.84, 21.75, 22.47, 23.04, 23.49, 23.83, 24.09, 24.28, 24.42, 24.52]
    },
    maxAmmo: {
        name: "최대 장탄 수(%)",
        values: [10.95, 14.08, 16.44, 18.26, 19.70, 20.84, 21.75, 22.47, 23.04, 23.49, 23.83, 24.09, 24.28, 24.42, 24.52]
    },
    eliteDamage: {
        name: "우월코드 대미지(%)",
        values: [5.48, 7.04, 8.22, 9.13, 9.85, 10.42, 10.88, 11.24, 11.52, 11.74, 11.91, 12.04, 12.14, 12.21, 12.26]
    }
};

const DISTANCE_BONUS_RANGES = {
    SG: [1],           // 1단계에서만 보너스
    SMG: [1, 2],       // 1, 2단계에서 보너스
    AR: [2],           // 2단계에서만 보너스
    MG: [3, 4],        // 3, 4단계에서 보너스
    SR: [4],           // 4단계에서만 보너스
    RL: []             // 거리 보너스 없음
};


// 소장품 보너스
const COLLECTION_BONUS = {
    AR: {
        coreBonus: 0.1704,      // 코어 대미지 17.04% 증가
        chargeRatio: 0,
        damageMultiplier: 1,
        maxAmmo: 0
    },
    SMG: {
        coreBonus: 0,
        chargeRatio: 0,
        damageMultiplier: 1.0946,  // 최종 대미지 9.46% 증가
        maxAmmo: 0
    },
    SR: {
        coreBonus: 0,
        chargeRatio: 0.0947,       // 차지 대미지 배율 9.47% 증가
        damageMultiplier: 1,
        maxAmmo: 0
    },
    RL: {
        coreBonus: 0,
        chargeRatio: 0.0947,       // 차지 대미지 배율 9.47% 증가
        damageMultiplier: 1,
        maxAmmo: 0
    },
    MG: {
        coreBonus: 0,
        chargeRatio: 0,
        damageMultiplier: 1,
        maxAmmo: 0.095             // 최대 장탄수 9.5% 증가
    },
    SG: {
        coreBonus: 0,
        chargeRatio: 0,
        damageMultiplier: 1.0946,  // 최종 대미지 9.46% 증가
        maxAmmo: 0
    }
};

// 실제 NIKKE 명중률 공식의 무기별 파라미터
const WEAPON_ACCURACY_PARAMS = {
    AR: { base: 80, reduction: 0.873 },
    SMG: { base: 115, reduction: 1.13 },
    SG: { base: 278, reduction: 2.84 }
    // SR, RL, MG는 데이터 없음 - 추후 추가 필요
};

// 전역 노출
window.CRIT_RATE = CRIT_RATE;
window.CRIT_DMG = CRIT_DMG;
window.ENEMY_DEF = ENEMY_DEF;
window.OPTIMAL_DISTANCE = OPTIMAL_DISTANCE;
window.BURST_GAUGE_CHARGE_TIME = BURST_GAUGE_CHARGE_TIME;
window.BURST_CYCLE_TIME = BURST_CYCLE_TIME;
window.BURST_USE_DELAY = BURST_USE_DELAY;
window.FULL_BURST_DURATION = FULL_BURST_DURATION;
window.BURST_COOLDOWN_MAP = BURST_COOLDOWN_MAP;
window.UI_UPDATE_INTERVAL = UI_UPDATE_INTERVAL;
window.MULTI_HIT_INTERVAL = MULTI_HIT_INTERVAL;
window.STATE_CHECK_INTERVAL = STATE_CHECK_INTERVAL;
window.CUBE_DATA = CUBE_DATA;
window.OVERLOAD_OPTIONS = OVERLOAD_OPTIONS;
window.DISTANCE_BONUS_RANGES = DISTANCE_BONUS_RANGES;
window.COLLECTION_BONUS = COLLECTION_BONUS;
window.WEAPON_ACCURACY_PARAMS = WEAPON_ACCURACY_PARAMS;

