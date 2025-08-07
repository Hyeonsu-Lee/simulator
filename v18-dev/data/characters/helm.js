// data/characters/helm.js - 헬름 캐릭터 데이터

const helm = {
    id: "helm",
    name: "헬름",
    weaponType: "SR",
    burstPosition: 3,
    burstCooldown: 40,
    baseStats: {
        atk: 224572,
        weaponCoef: 0.6904,
        baseAmmo: 6,
        basePellets: 1,
        attackInterval: 1.0,
        reloadTime: 2.0,
        chargeMultiplier: 2.5,
        penetration: false
    },
    skills: {
        skill1: {
            id: "helm_skill1",
            name: "진두지휘",
            triggers: [{
                id: "last_bullet",
                type: "event",
                event: "LAST_BULLET_HIT"
            }, {
                id: "full_charge",
                type: "event",
                event: "FULL_CHARGE_ATTACK"
            }],
            effects: [{
                triggerId: "last_bullet",
                type: "buff",
                target: "all_allies",
                stats: {
                    critRate: { value: 0.1464, type: "percent" }
                },
                duration: { type: "time", value: 5 }
            }, {
                triggerId: "full_charge",
                type: "heal",
                target: "all_allies",
                amount: { value: 0.0059, type: "maxHpPercent", source: "self" }
            }, {
                triggerId: "full_charge",
                type: "burst_charge",
                target: "all_allies",
                amount: 0.1431
            }]
        },
        skill2: {
            id: "helm_skill2",
            name: "포문 개방",
            triggers: [{
                id: "battle_start",
                type: "event",
                event: "BATTLE_START"
            }, {
                id: "full_burst_start",
                type: "event",
                event: "FULL_BURST_START"
            }, {
                id: "full_charge_hit",
                type: "event",
                event: "FULL_CHARGE_ATTACK"
            }],
            effects: [{
                triggerId: "battle_start",
                type: "buff",
                target: "all_allies",
                stats: {
                    partDamage: { value: 0.0308, type: "percent" }
                },
                duration: { type: "permanent" }
            }, {
                triggerId: "full_burst_start",
                type: "buff",
                target: "all_allies",
                stats: {
                    damageIncrease: { value: 0.2787, type: "percent" }
                },
                duration: { type: "time", value: 10 }
            }, {
                triggerId: "full_charge_hit",
                type: "instant_damage",
                target: "enemy",
                damage: { value: 1.7898, type: "atkMultiplier", source: "self" }
            }]
        },
        burst: {
            id: "helm_burst",
            name: "이지스 캐논",
            triggers: [{
                id: "burst_use",
                type: "event",
                event: "BURST_USE"
            }],
            effects: [{
                type: "burst_damage",
                target: "enemy",
                damage: { value: 82.368, type: "atkMultiplier", source: "self" }
            }, {
                type: "heal",
                target: "all_allies",
                amount: { value: 0.5445, type: "damagePercent" },
                duration: { type: "time", value: 10 }
            }, {
                type: "buff",
                target: "self",
                stats: {
                    chargeRatio: { value: 1.584, type: "percent" }
                },
                duration: { type: "shots", value: 10 }
            }]
        }
    }
};

// 전역 노출
window.HELM_CHARACTER = helm;

// 디버그용 로그
console.log('Helm character loaded');