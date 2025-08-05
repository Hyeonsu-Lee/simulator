// data/characters/character-data.js - 캐릭터 데이터

const CHARACTER_DATA = {
    dorothy: {
        id: "dorothy",
        name: "도로시",
        weaponType: "SG",
        burstPosition: 3,
        burstCooldown: 40,
        baseStats: {
            atk: 350254,
            weaponCoef: 2.015,
            baseAmmo: 9,
            basePellets: 10,
            attackInterval: 0.666,
            reloadTime: 1.5,
            chargeMultiplier: 0,
            penetration: false
        },
        skills: {
            skill1: {
                id: "dorothy_skill1",
                name: "섬광",
                triggers: [{
                    id: "pellet_counter",
                    type: "accumulator",
                    source: "self.pelletsHit",
                    threshold: 80,
                    resetOnTrigger: true,
                    scope: "self"
                }],
                effects: [{
                    type: "buff",
                    target: "self",
                    stats: {
                        accuracy: { value: 98.18, type: "flat" },
                        damageIncrease: { value: 0.72, type: "percent" }
                    },
                    duration: { type: "shots", value: 3 }
                }, {
                    type: "replace_attack",
                    target: "self",
                    duration: { type: "shots", value: 3 },
                    modifiers: {
                        pelletsPerShot: 1,
                        penetration: true
                    }
                }]
            },
            skill2: {
                id: "dorothy_skill2",
                name: "광익",
                triggers: [{
                    id: "battle_start",
                    type: "event",
                    event: "BATTLE_START"
                }, {
                    id: "full_burst_active",
                    type: "state",
                    condition: "isFullBurst",
                    continuous: true
                }],
                effects: [{
                    triggerId: "battle_start",
                    type: "buff",
                    target: "self",
                    stats: {
                        penetrationDamage: { value: 0.5508, type: "percent" }
                    },
                    duration: { type: "permanent" }
                }, {
                    triggerId: "full_burst_active",
                    type: "buff",
                    target: "self",
                    stats: {
                        atkPercent: { value: 0.7524, type: "percent" },
                        accuracy: { value: 40.68, type: "flat" }
                    },
                    duration: { type: "conditional" }
                }]
            },
            burst: {
                id: "dorothy_burst",
                name: "위구원",
                triggers: [{
                    id: "burst_use",
                    type: "event",
                    event: "BURST_USE"
                }],
                effects: [{
                    type: "buff",
                    target: "self",
                    stats: {
                        attackSpeed: { value: 0.65, type: "percent" },
                        atkPercent: { value: 0.8812, type: "percent" },
                        pelletBonus: { value: 5, type: "flat" }
                    },
                    duration: { type: "time", value: 15 }
                }]
            }
        }
    },
    crown: {
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
    },
    helm: {
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
    },
    siren: {
        id: "siren",
        name: "세이렌",
        weaponType: "SMG",
        burstPosition: 1,
        burstCooldown: 20,
        baseStats: {
            atk: 294324,
            weaponCoef: 0.1012,
            baseAmmo: 120,
            basePellets: 1,
            attackInterval: 0.033,
            reloadTime: 1.0,
            chargeMultiplier: 0,
            penetration: false
        },
        skills: {
            skill1: {
                id: "siren_skill1",
                name: "버블 오더",
                triggers: [{
                    id: "full_burst_end",
                    type: "event",
                    event: "FULL_BURST_END"
                }, {
                    id: "full_burst_start",
                    type: "event",
                    event: "FULL_BURST_START"
                }, {
                    id: "bullet_consumption",
                    type: "accumulator",
                    source: "global.bulletsConsumed",
                    threshold: 400,
                    resetOnTrigger: true,
                    scope: "global"
                }],
                effects: [{
                    triggerId: "full_burst_end",
                    type: "burst_cooldown_reduction",
                    target: "all_allies",
                    amount: 7.48
                }, {
                    triggerId: "full_burst_start",
                    type: "buff",
                    target: "all_allies",
                    stats: {
                        damageIncrease: { value: 0.04, type: "percent" }
                    },
                    duration: { type: "time", value: 10 }
                }, {
                    triggerId: "bullet_consumption",
                    type: "burst_charge",
                    target: "all_allies",
                    amount: 0.37
                }]
            },
            skill2: {
                id: "siren_skill2",
                name: "버블 웨이브",
                triggers: [{
                    id: "battle_start",
                    type: "event",
                    event: "BATTLE_START"
                }, {
                    id: "attack_counter",
                    type: "accumulator",
                    source: "self.attackCount",
                    threshold: 50,
                    resetOnTrigger: true,
                    scope: "self"
                }, {
                    id: "full_burst_periodic",
                    type: "periodic",
                    condition: "isFullBurst",
                    interval: 1.0
                }, {
                    id: "bullet_barrage",
                    type: "accumulator",
                    source: "global.bulletsConsumed",
                    threshold: 500,
                    resetOnTrigger: true,
                    scope: "global"
                }],
                effects: [{
                    triggerId: "battle_start",
                    type: "buff",
                    target: "enemy",
                    stats: {
                        receivedDamage: { value: 0.0505, type: "percent" }
                    },
                    duration: { type: "permanent" },
                    buffId: "bubble"
                }, {
                    triggerId: "attack_counter",
                    type: "transform_buff",
                    target: "enemy",
                    fromBuffId: "bubble",
                    toBuffId: "burst_bubble",
                    newStats: {
                        receivedDamage: { value: 0.0505, type: "percent" }
                    },
                    duration: { type: "permanent" }
                }, {
                    triggerId: "full_burst_periodic",
                    type: "multi_hit_damage",
                    target: "random_enemies",
                    damage: { value: 0.6336, type: "atkMultiplier", source: "self" },
                    hits: 4
                }, {
                    triggerId: "bullet_barrage",
                    type: "multi_hit_damage",
                    target: "random_enemies",
                    damage: { value: 0.85, type: "atkMultiplier", source: "self" },
                    hits: 10
                }]
            },
            burst: {
                id: "siren_burst",
                name: "세이렌 송",
                triggers: [{
                    id: "burst_use",
                    type: "event",
                    event: "BURST_USE"
                }],
                effects: [{
                    type: "buff",
                    target: "all_allies",
                    stats: {
                        damageIncrease: { value: 0.1013, type: "percent" }
                    },
                    duration: { type: "time", value: 10 }
                }, {
                    type: "ammo_charge",
                    target: "all_allies",
                    amount: 0.3326
                }, {
                    type: "buff",
                    target: "self",
                    stats: {
                        fixedATK: { value: 0.1728, type: "percent", source: "self" }
                    },
                    duration: { type: "time", value: 10 }
                }]
            }
        }
    }
};

// 캐릭터 ID 리스트
const CHARACTER_LIST = ["dorothy", "crown", "helm", "siren"];

// 전역 노출
window.CHARACTER_DATA = CHARACTER_DATA;
window.CHARACTER_LIST = CHARACTER_LIST;