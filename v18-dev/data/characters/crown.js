// data/characters/crown.js - 크라운 캐릭터 데이터

const crown = {
    id: "crown",
    name: "크라운",
    weaponType: "MG",
    burstPosition: 2,
    burstCooldown: 20,
    baseStats: {
        atk: 224572,
        weaponCoef: 0.0557,
        baseAmmo: 300,
        basePellets: 1,
        attackInterval: 0.018,
        reloadTime: 2.5,
        chargeMultiplier: 0,
        penetration: false
    },
    skills: {
        skill1: {
            id: "crown_skill1",
            name: "원 포 올",
            triggers: [{
                id: "full_burst_start",
                type: "event",
                event: "FULL_BURST_START"
            }],
            effects: [{
                type: "buff",
                target: "burst_users",
                stats: {
                    fixedATK: { value: 0.6451, type: "percent", source: "self" },
                    reloadSpeed: { value: 0.4435, type: "percent" }
                },
                duration: { type: "time", value: 15 }
            }, {
                type: "buff",
                target: "non_burst_users",
                stats: {
                    fixedDEF: { value: 0.3744, type: "percent", source: "self" },
                    reloadSpeed: { value: 0.4435, type: "percent" }
                },
                duration: { type: "time", value: 15 }
            }]
        },
        skill2: {
            id: "crown_skill2",
            name: "로얄 에타이어",
            triggers: [{
                id: "attack_counter",
                type: "accumulator",
                source: "self.attackCount",
                threshold: 43,
                resetOnTrigger: false,
                stackMechanism: {
                    buffId: "relax",
                    maxStacks: 20,
                    consumeOnMax: true
                }
            }, {
                id: "heal_received",
                type: "event",
                event: "HEAL_RECEIVED"
            }],
            effects: [{
                triggerId: "attack_counter",
                type: "stack",
                target: "self",
                buffId: "relax",
                stats: {
                    healReceived: { value: 0.0406, type: "percent" }
                },
                duration: { type: "permanent" },
                maxStacks: 20,
                onMaxStacks: [{
                    type: "buff",
                    target: "self",
                    stats: {
                        invincible: { value: 1, type: "flag" },
                        taunt: { value: 1, type: "flag" }
                    },
                    duration: { type: "time", value: 5 }
                }, {
                    type: "heal",
                    target: "self",
                    amount: { value: 0.0523, type: "maxHpPercent", source: "self" }
                }]
            }, {
                triggerId: "heal_received",
                type: "buff",
                target: "all_allies",
                stats: {
                    damageIncrease: { value: 0.2099, type: "percent" }
                },
                duration: { type: "time", value: 7 }
            }]
        },
        burst: {
            id: "crown_burst",
            name: "파라다이스 로스트",
            triggers: [{
                id: "burst_use",
                type: "event",
                event: "BURST_USE"
            }],
            effects: [{
                type: "buff",
                target: "all_allies",
                stats: {
                    damageIncrease: { value: 0.3624, type: "percent" }
                },
                duration: { type: "time", value: 15 }
            }, {
                type: "shield",
                target: "all_allies",
                amount: { value: 0.1045, type: "maxHpPercent", source: "self" },
                duration: { type: "time", value: 15 }
            }]
        }
    }
};

// 전역 노출
window.CROWN_CHARACTER = crown;

// 디버그용 로그
console.log('Crown character loaded');