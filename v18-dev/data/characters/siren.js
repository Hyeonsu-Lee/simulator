// data/characters/siren.js - 세이렌 캐릭터 데이터

const siren = {
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
};

// 전역 노출
window.SIREN_CHARACTER = siren;

// 디버그용 로그
console.log('Siren character loaded');