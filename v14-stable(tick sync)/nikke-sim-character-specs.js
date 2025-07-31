/* nikke-sim-character-specs.js - 개선된 캐릭터 명세 */

// 도로시 명세 - 특수 메커니즘을 스펙에 통합
function createDorothy() {
    const spec = {
        id: 'dorothy',
        name: '도로시',
        weaponType: 'SG',
        burstPosition: 3,
        burstCooldown: 40,
        burstReEntry: false,
        baseStats: {
            atk: 350890,
            weaponCoef: 2.015,
            baseAmmo: 9,
            basePellets: 10,
            attackInterval: 0.666,
            reloadTime: 1.5
        },
        // 특수 메커니즘 정의
        specialMechanisms: {
            pelletCounter: {
                type: 'counter',
                property: 'pelletsFired',
                initialValue: 0,
                threshold: 80,
                specialShots: 3,
                resetOnSpecial: true
            }
        },
        skills: {
            skill1: {
                name: '플라잉 타입',
                buffs: [
                    {
                        id: 'flying_damage',
                        trigger: {
                            type: 'conditional',
                            condition: (context, character) => {
                                return character.pelletsFired >= 80;
                            }
                        },
                        effect: {
                            target: 'self',
                            stat: 'damageIncrease',
                            value: 0.72
                        },
                        duration: { type: 'shots', value: 3 }
                    },
                    {
                        id: 'flying_accuracy',
                        trigger: {
                            type: 'conditional',
                            condition: (context, character) => {
                                return character.pelletsFired >= 80;
                            }
                        },
                        effect: {
                            target: 'self',
                            stat: 'accuracy',
                            value: 98.18
                        },
                        duration: { type: 'shots', value: 3 }
                    }
                ],
                actions: [
                    {
                        id: 'flying_special',
                        type: 'modify_attack',
                        priority: 10,
                        data: {
                            trigger: {
                                condition: (context, character) => {
                                    return character.pelletsFired >= 80;
                                }
                            },
                            modifiers: {
                                pelletsPerShot: 1
                            }
                        },
                        duration: { type: 'shots', value: 3 },
                        onActivate: (character, context) => {
                            character.attackModifiers.penetration = true;
                        },
                        onComplete: (character, context) => {
                            character.pelletsFired = 0;
                            character.attackModifiers.penetration = false;
                        }
                    }
                ]
            },
            skill2: {
                name: '리턴 플라이트',
                buffs: [
                    {
                        id: 'return_flight_penetration',
                        trigger: {
                            type: 'passive'
                        },
                        effect: {
                            target: 'self',
                            stat: 'penetrationDamage',
                            value: 0.5508
                        },
                        duration: { type: 'permanent', value: 0 }
                    },
                    {
                        id: 'return_flight_fullburst',
                        trigger: {
                            type: 'conditional',
                            condition: (context) => context.isFullBurst
                        },
                        effect: {
                            target: 'self',
                            stat: 'atkPercent',
                            value: 0.7524
                        },
                        duration: { type: 'permanent', value: 0 }
                    },
                    {
                        id: 'return_flight_accuracy',
                        trigger: {
                            type: 'conditional',
                            condition: (context) => context.isFullBurst
                        },
                        effect: {
                            target: 'self',
                            stat: 'accuracy',
                            value: 40.68
                        },
                        duration: { type: 'permanent', value: 0 }
                    }
                ],
                actions: []
            },
            burst: {
                name: '폭격 준비',
                buffs: [
                    {
                        id: 'burst_atk',
                        trigger: {
                            type: 'burst'
                        },
                        effect: {
                            target: 'self',
                            stat: 'atkPercent',
                            value: 0.8812
                        },
                        duration: { type: 'time', value: 15 }
                    },
                    {
                        id: 'burst_aspd',
                        trigger: {
                            type: 'burst'
                        },
                        effect: {
                            target: 'self',
                            stat: 'attackSpeed',
                            value: 0.65
                        },
                        duration: { type: 'time', value: 15 }
                    },
                    {
                        id: 'burst_pellet',
                        trigger: {
                            type: 'burst'
                        },
                        effect: {
                            target: 'self',
                            stat: 'pelletBonus',
                            value: 5
                        },
                        duration: { type: 'time', value: 15 }
                    }
                ],
                actions: []
            }
        }
    };
    
    const dorothy = new CharacterBase(spec);
    
    // 도로시 특수 메커니즘 처리 함수
    dorothy.processAttackMechanism = function(attackInfo) {
        // 특수탄이 아닐 때만 펠릿 카운트
        if (!attackInfo.isSpecialAttack) {
            this.pelletsFired += attackInfo.pelletsHit || 0;
        }
    };
    
    return dorothy;
}

// 크라운 명세 - 변경 없음
function createCrown() {
    const spec = {
        id: 'crown',
        name: '크라운',
        weaponType: 'RL',
        burstPosition: 2,
        burstCooldown: 20,
        burstReEntry: false,
        baseStats: {
            atk: 223261,
            weaponCoef: 1.0,
            baseAmmo: 6,
            basePellets: 1,
            attackInterval: 1.0,
            reloadTime: 2.0
        },
        skills: {
            skill1: {
                name: '축복의 가호',
                buffs: [
                    {
                        id: 'blessing_fixedatk',
                        trigger: {
                            type: 'conditional',
                            metadata: {
                                oncePerCycle: true,
                                persistent: true
                            },
                            condition: (context) => {
                                return context.isFullBurst && context.newCycleStarted;
                            }
                        },
                        effect: {
                            target: 'burst_users',
                            stat: 'fixedATK',
                            value: 0.6451,
                            isFixedATK: true
                        },
                        duration: { type: 'time', value: 15 }
                    },
                    {
                        id: 'blessing_reload',
                        trigger: {
                            type: 'conditional',
                            metadata: {
                                oncePerCycle: true,
                                persistent: true
                            },
                            condition: (context) => {
                                return context.isFullBurst && context.newCycleStarted;
                            }
                        },
                        effect: {
                            target: 'burst_users',
                            stat: 'reloadSpeed',
                            value: 0.4435
                        },
                        duration: { type: 'time', value: 15 }
                    }
                ],
                actions: []
            },
            skill2: {
                name: '생명의 축복',
                buffs: [
                    {
                        id: 'life_blessing',
                        trigger: {
                            type: 'passive'
                        },
                        effect: {
                            target: 'all_allies',
                            stat: 'damageIncrease',
                            value: 0.2099
                        },
                        duration: { type: 'permanent', value: 0 }
                    }
                ],
                actions: []
            },
            burst: {
                name: '파라다이스 로스트',
                buffs: [
                    {
                        id: 'paradise_lost',
                        trigger: {
                            type: 'burst'
                        },
                        effect: {
                            target: 'all_allies',
                            stat: 'damageIncrease',
                            value: 0.3624
                        },
                        duration: { type: 'time', value: 15 }
                    }
                ],
                actions: []
            }
        }
    };
    
    return new CharacterBase(spec);
}

// 헬름 명세 - 변경 없음
function createHelm() {
    const spec = {
        id: 'helm',
        name: '헬름',
        weaponType: 'SG',
        burstPosition: 3,
        burstCooldown: 40,
        burstReEntry: false,
        baseStats: {
            atk: 250000,
            weaponCoef: 2.0,
            baseAmmo: 9,
            basePellets: 10,
            attackInterval: 0.7,
            reloadTime: 1.5
        },
        skills: {
            skill1: {
                name: '추적자',
                buffs: [],
                actions: []
            },
            skill2: {
                name: '해적 기질',
                buffs: [
                    {
                        id: 'pirate_crit',
                        trigger: {
                            type: 'periodic',
                            params: {
                                interval: 6.51
                            }
                        },
                        effect: {
                            target: 'all_allies',
                            stat: 'helmCritBonus',
                            value: 0.1464
                        },
                        duration: { type: 'time', value: 5 }
                    },
                    {
                        id: 'pirate_damage',
                        trigger: {
                            type: 'conditional',
                            metadata: {
                                persistent: true
                            },
                            condition: (context) => context.isFullBurst
                        },
                        effect: {
                            target: 'all_allies',
                            stat: 'damageIncrease',
                            value: 0.2787
                        },
                        duration: { type: 'time', value: 10 }
                    }
                ],
                actions: []
            },
            burst: {
                name: '파이어!',
                buffs: [],
                actions: []
            }
        }
    };
    
    return new CharacterBase(spec);
}

// 세이렌 명세 - 특수 메커니즘을 스펙에 통합
function createSiren() {
    const spec = {
        id: 'siren',
        name: '세이렌',
        weaponType: 'SMG',
        burstPosition: 1,
        burstCooldown: 20,
        burstReEntry: false,
        baseStats: {
            atk: 294864,
            weaponCoef: 10.12,
            baseAmmo: 120,
            basePellets: 1,
            attackInterval: 0.04,
            reloadTime: 1.0
        },
        // 특수 메커니즘 정의
        specialMechanisms: {
            bubbleWave: {
                type: 'state',
                properties: {
                    fullburstDamageTime: -999,
                    barrageLastShot: 0
                },
                fullBurstDamageMultiplier: 2.5344,
                fullBurstCooldown: 1.0,
                barrageDamageMultiplier: 8.5,
                barrageInterval: 500
            }
        },
        skills: {
            skill1: {
                name: '버블 오더',
                buffs: [
                    {
                        id: 'bubble_order',
                        trigger: {
                            type: 'conditional',
                            metadata: {
                                persistent: true
                            },
                            condition: (context) => context.isFullBurst
                        },
                        effect: {
                            target: 'all_allies',
                            stat: 'damageIncrease',
                            value: 0.04
                        },
                        duration: { type: 'time', value: 10 }
                    }
                ],
                actions: []
            },
            skill2: {
                name: '버블 웨이브',
                buffs: [
                    {
                        id: 'bubble_wave_passive',
                        trigger: {
                            type: 'passive'
                        },
                        effect: {
                            target: 'all_allies',
                            stat: 'receivedDamage',
                            value: 0.0505
                        },
                        duration: { type: 'permanent', value: 0 }
                    }
                ],
                actions: [
                    {
                        id: 'bubble_wave_fullburst',
                        type: 'instant_damage',
                        priority: 5,
                        data: {
                            trigger: {
                                condition: (context, character) => {
                                    if (!context.isFullBurst) return false;
                                    
                                    const elapsed = context.time - character.fullburstDamageTime;
                                    return elapsed >= 1.0; // fullBurstCooldown
                                }
                            },
                            damageMultiplier: 2.5344
                        },
                        onActivate: (character, context) => {
                            character.fullburstDamageTime = context.time;
                        }
                    },
                    {
                        id: 'bubble_wave_barrage',
                        type: 'instant_damage',
                        priority: 5,
                        data: {
                            trigger: {
                                condition: (context, character) => {
                                    if (!character.shotsFired) return false;
                                    
                                    const currentUnit = Math.floor(character.shotsFired / 500);
                                    const lastUnit = Math.floor(character.barrageLastShot / 500);
                                    
                                    if (currentUnit > lastUnit) {
                                        character.barrageLastShot = character.shotsFired;
                                        return true;
                                    }
                                    return false;
                                }
                            },
                            damageMultiplier: 8.5
                        }
                    }
                ]
            },
            burst: {
                name: '세이렌 송',
                buffs: [
                    {
                        id: 'siren_song_damage',
                        trigger: {
                            type: 'burst'
                        },
                        effect: {
                            target: 'all_allies',
                            stat: 'damageIncrease',
                            value: 0.1013
                        },
                        duration: { type: 'time', value: 10 }
                    },
                    {
                        id: 'siren_song_atk',
                        trigger: {
                            type: 'burst'
                        },
                        effect: {
                            target: 'self',
                            stat: 'atkPercent',
                            value: 0.1728
                        },
                        duration: { type: 'time', value: 10 }
                    },
                    {
                        id: 'siren_song_ammo',
                        trigger: {
                            type: 'burst'
                        },
                        effect: {
                            target: 'all_allies',
                            stat: 'ammoCharge',
                            value: 0.3326
                        },
                        duration: { type: 'once', value: 0 }
                    }
                ],
                actions: []
            }
        }
    };
    
    return new CharacterBase(spec);
}

// 캐릭터 레지스트리 (기존 코드 유지)
class CharacterRegistry {
    constructor() {
        this.creators = new Map();
        this.instances = new Map();
    }
    
    register(id, creatorFn) {
        if (typeof creatorFn !== 'function') {
            console.error(`CharacterRegistry: creator must be a function for ${id}`);
            return;
        }
        this.creators.set(id, creatorFn);
    }
    
    create(id, config = {}) {
        const creator = this.creators.get(id);
        if (!creator) {
            throw new Error(`Character ${id} not found in registry`);
        }
        
        const character = creator();
        
        // 설정 적용
        if (config.level) character.level = config.level;
        if (config.coreLevel) character.coreLevel = config.coreLevel;
        
        return character;
    }
    
    getAll() {
        return Array.from(this.creators.keys());
    }
    
    // 기존 NIKKE_REGISTRY와의 호환성
    forEach(callback) {
        this.creators.forEach((creator, id) => {
            callback(creator, id);
        });
    }
    
    get(id) {
        return this.creators.get(id);
    }
    
    set(id, creator) {
        this.register(id, creator);
    }
}

// 레지스트리 초기화
const CHARACTER_REGISTRY = new CharacterRegistry();
CHARACTER_REGISTRY.register('dorothy', createDorothy);
CHARACTER_REGISTRY.register('crown', createCrown);
CHARACTER_REGISTRY.register('helm', createHelm);
CHARACTER_REGISTRY.register('siren', createSiren);

// 기존 코드 호환성
const NIKKE_REGISTRY = CHARACTER_REGISTRY;

// 유틸리티 함수 (formatNumber가 없을 경우를 대비)
if (typeof formatNumber === 'undefined') {
    window.formatNumber = function(num) {
        return num.toLocaleString('ko-KR');
    };
}