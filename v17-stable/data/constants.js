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
const BURST_COOLDOWN_MAP = {
    20: 20,
    40: 40,
    60: 60
};

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

// 소장품 보너스
const COLLECTION_BONUS = {
    AR: {
        coreBonus: 0,
        chargeRatio: 0,
        damageMultiplier: 1,
        maxAmmo: 0
    },
    SMG: {
        coreBonus: 0,
        chargeRatio: 0,
        damageMultiplier: 1,
        maxAmmo: 0.15
    },
    SR: {
        coreBonus: 0.1,
        chargeRatio: 0.15,
        damageMultiplier: 1,
        maxAmmo: 0
    },
    RL: {
        coreBonus: 0,
        chargeRatio: 0.1,
        damageMultiplier: 1.1,
        maxAmmo: 0
    },
    MG: {
        coreBonus: 0,
        chargeRatio: 0,
        damageMultiplier: 1,
        maxAmmo: 0.15
    },
    SG: {
        coreBonus: 0.15,
        chargeRatio: 0,
        damageMultiplier: 1,
        maxAmmo: 0
    }
};

// 명중률 관련 상수
const BASE_ACCURACY = {
    AR: 50,
    SMG: 30,
    SR: 80,
    RL: 70,
    MG: 40,
    SG: 20
};

const SPREAD_COEFFICIENT = {
    AR: 0.5,
    SMG: 0.8,
    SR: 0.3,
    RL: 0.4,
    MG: 0.7,
    SG: 1.0
};