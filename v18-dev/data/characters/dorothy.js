// data/characters/dorothy.js - 도로시 캐릭터 데이터

const dorothy = {
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
};

// 전역 노출
window.DOROTHY_CHARACTER = dorothy;