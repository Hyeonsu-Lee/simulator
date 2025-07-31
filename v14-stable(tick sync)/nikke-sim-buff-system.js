/* nikke-sim-buff-system.js - 개선된 버프 시스템 */

/**
 * 타겟 리졸버 - 버프 대상을 결정하는 확장 가능한 시스템
 */
class TargetResolver {
    constructor() {
        this.resolvers = new Map();
        this.registerDefaultResolvers();
    }
    
    registerDefaultResolvers() {
        // 자기 자신
        this.registerResolver('self', (context, source) => {
            if (!source) {
                console.error('TargetResolver: source is undefined for self target');
                return [];
            }
            return [source];
        });
        
        // 아군 전체
        this.registerResolver('all_allies', (context) => {
            if (!context.squad || !Array.isArray(context.squad)) {
                console.error('TargetResolver: invalid squad in context');
                return [];
            }
            return context.squad.filter(char => char != null);
        });
        
        // 버스트 사용자
        this.registerResolver('burst_users', (context) => {
            if (!context.burstUsers || !Array.isArray(context.burstUsers)) {
                return [];
            }
            return context.burstUsers.filter(char => char != null);
        });
        
        // 체력이 가장 낮은 아군 (확장 예시)
        this.registerResolver('lowest_hp', (context) => {
            if (!context.squad || context.squad.length === 0) return [];
            
            const validChars = context.squad.filter(char => 
                char && typeof char.currentHp !== 'undefined'
            );
            
            if (validChars.length === 0) return [];
            
            return [validChars.reduce((min, char) => 
                char.currentHp < min.currentHp ? char : min
            )];
        });
        
        // 같은 무기 타입 (확장 예시)
        this.registerResolver('same_weapon_type', (context, source) => {
            if (!source || !context.squad) return [];
            
            return context.squad.filter(char => 
                char && char.weaponType === source.weaponType
            );
        });
    }
    
    registerResolver(targetType, resolverFn) {
        if (typeof resolverFn !== 'function') {
            console.error(`TargetResolver: resolver must be a function for ${targetType}`);
            return;
        }
        this.resolvers.set(targetType, resolverFn);
    }
    
    resolve(targetType, context, source) {
        const resolver = this.resolvers.get(targetType);
        
        if (!resolver) {
            console.warn(`TargetResolver: Unknown target type "${targetType}", defaulting to empty`);
            return [];
        }
        
        try {
            const result = resolver(context, source);
            
            // 반환값 검증
            if (!Array.isArray(result)) {
                console.error(`TargetResolver: resolver for "${targetType}" must return an array`);
                return [];
            }
            
            // null/undefined 필터링
            return result.filter(target => target != null);
            
        } catch (error) {
            console.error(`TargetResolver: error in resolver for "${targetType}":`, error);
            return [];
        }
    }
    
    // 디버깅용 메서드
    getRegisteredTypes() {
        return Array.from(this.resolvers.keys());
    }
}

/**
 * 개선된 버프 시스템
 */
class BuffSystem {
    constructor(dependencies = {}) {
        this.logger = dependencies.logger;
        this.config = dependencies.config || {};
        
        // 타겟 리졸버
        this.targetResolver = new TargetResolver();
        
        // 정적 버프 (오버로드, 큐브 등)
        this.staticBuffs = this.calculateStaticBuffs();
        
        // 활성 버프 관리
        this.activeBuffs = new Map(); // 'characterId_slot_buffId' -> buffData
        
        // 트리거 타입별 버프 분류
        this.buffRegistry = {
            passive: [],
            conditional: [],
            periodic: [],
            burst: []
        };
        
        // 활성화 이력 관리 (사이클당 1회 제한 등)
        this.activationHistory = new Map(); // buffKey -> Set<cycle>
        this.lastCleanupCycle = -1;
    }
    
    // 캐릭터 등록
    registerCharacter(character) {
        if (!character || !character.id) {
            console.error('BuffSystem: Invalid character registration');
            return;
        }
        
        this.log(0, `[BuffSystem] Registering character: ${character.name}`, 'debug');
        
        character.getAllSkills().forEach(({slot, skill}) => {
            if (!skill?.buffs) return;
            
            skill.buffs.forEach(buff => {
                const entry = { character, slot, buff };
                
                // 트리거 타입별 분류
                const triggerType = buff.trigger?.type || 'passive';
                
                switch (triggerType) {
                    case 'passive':
                        this.buffRegistry.passive.push(entry);
                        break;
                        
                    case 'periodic':
                        this.buffRegistry.periodic.push({
                            ...entry,
                            lastActivation: -999,  // 즉시 발동 가능
                            nextActivation: 0
                        });
                        break;
                        
                    case 'burst':
                        this.buffRegistry.burst.push(entry);
                        break;
                        
                    default:
                    case 'conditional':
                        this.buffRegistry.conditional.push(entry);
                        break;
                }
            });
        });
    }
    
    calculateStaticBuffs() {
        const buffs = this.getEmptyBuffState();
        
        // 오버로드 버프
        if (this.config.overloadBuffs) {
            const overload = this.config.overloadBuffs;
            buffs.atkPercent += overload.atkPercent || 0;
            buffs.critRate = CRIT_RATE + (overload.critRate || 0);
            buffs.critDamage = CRIT_DMG + (overload.critDamage || 0);
            buffs.accuracy += overload.accuracy || 0;
            buffs.eliteDamage += overload.eliteDamage || 0;
            buffs.maxAmmo += overload.maxAmmo || 0;
        } else {
            // 기본값 설정
            buffs.critRate = CRIT_RATE;
            buffs.critDamage = CRIT_DMG;
        }
        
        // 큐브 버프
        if (this.config.cubeType && CUBE_DATA[this.config.cubeType]) {
            const cube = CUBE_DATA[this.config.cubeType];
            Object.entries(cube.effects).forEach(([key, value]) => {
                if (buffs.hasOwnProperty(key)) {
                    buffs[key] = (buffs[key] || 0) + value;
                }
            });
        }
        
        return buffs;
    }
    
    calculateTotalBuffs(context) {
        // 컨텍스트 검증
        if (!context || typeof context.time !== 'number') {
            console.error('BuffSystem: Invalid context provided');
            return this.getEmptyBuffState();
        }
        
        // 1. 만료된 버프 제거
        this.removeExpiredBuffs(context.time);
        
        // 2. 오래된 활성화 이력 정리 (10사이클마다)
        if (context.cycle - this.lastCleanupCycle >= 10) {
            this.cleanupActivationHistory(context.cycle);
            this.lastCleanupCycle = context.cycle;
        }
        
        // 3. 모든 캐릭터의 버프 상태 초기화
        const allCharacterBuffs = new Map();
        
        // 4. 각 버프 타입별 처리
        this.applyPassiveBuffs(allCharacterBuffs, context);
        this.checkPeriodicBuffs(context);
        
        // 5. 새 사이클 시작 시 버스트 버프 체크
        if (context.newCycleStarted && context.burstUsers && context.burstUsers.length > 0) {
            this.log(context.time, `[BuffSystem] New cycle started with ${context.burstUsers.length} burst users`, 'debug');
            this.checkBurstBuffs(context);
        }
        
        // 6. 조건부 버프 체크 (항상)
        this.checkConditionalBuffs(context);
        
        // 7. 활성 버프를 모든 유효 타겟에 적용
        this.applyActiveBuffsToTargets(allCharacterBuffs, context);
        
        // 8. 타겟 니케의 버프 반환 (현재 구조 유지)
        const targetChar = context.squad[context.targetIndex];
        if (!targetChar) {
            console.error('BuffSystem: Target character not found');
            return this.getEmptyBuffState();
        }
        
        return allCharacterBuffs.get(targetChar.id) || this.getEmptyBuffState();
    }
    
    applyPassiveBuffs(allCharacterBuffs, context) {
        this.buffRegistry.passive.forEach(entry => {
            const key = this.getBuffKey(entry);
            
            // 이미 등록되어 있으면 스킵
            if (this.activeBuffs.has(key)) return;
            
            // 패시브는 항상 활성화
            this.activateBuff(entry, context, Infinity);
        });
    }
    
    checkPeriodicBuffs(context) {
        this.buffRegistry.periodic.forEach(entry => {
            const key = this.getBuffKey(entry);
            const interval = entry.buff.trigger.params?.interval || 999;
            
            // 다음 발동 시간 체크
            if (context.time >= entry.nextActivation) {
                // 이미 활성 중인 버프 체크
                const existing = this.activeBuffs.get(key);
                if (existing && context.time < existing.endTime) {
                    // 아직 만료되지 않았으면 스킵
                    return;
                }
                
                // 버프 활성화
                this.activateBuff(entry, context);
                
                // 다음 발동 시간 설정
                entry.lastActivation = context.time;
                entry.nextActivation = context.time + interval;
            }
        });
    }
    
    checkBurstBuffs(context) {
        // 이번 사이클 버스트 사용자만 체크
        context.burstUsers.forEach(burstUser => {
            this.buffRegistry.burst.forEach(entry => {
                if (entry.character === burstUser) {
                    const key = this.getBuffKey(entry);
                    
                    // 같은 사이클에 이미 발동했으면 스킵
                    const existing = this.activeBuffs.get(key);
                    if (existing && existing.cycle === context.cycle) {
                        return;
                    }
                    
                    // 버스트 버프 활성화
                    this.activateBuff(entry, context);
                }
            });
        });
    }
    
    checkConditionalBuffs(context) {
        this.buffRegistry.conditional.forEach(entry => {
            const key = this.getBuffKey(entry);
            const metadata = this.getBuffMetadata(entry.buff);
            
            // 사이클당 1회 제한 체크
            if (metadata.oncePerCycle) {
                const history = this.activationHistory.get(key) || new Set();
                if (history.has(context.cycle)) {
                    return; // 이미 이번 사이클에 발동함
                }
            }
            
            const existingBuff = this.activeBuffs.get(key);
            const isActive = !!existingBuff;
            
            // 조건 체크
            let conditionMet = false;
            try {
                conditionMet = entry.buff.trigger.condition(context, entry.character);
            } catch (error) {
                console.error(`BuffSystem: Error in condition check for ${key}:`, error);
                return;
            }
            
            // 조건 충족 & 비활성 → 활성화
            if (conditionMet && !isActive) {
                this.activateBuff(entry, context);
                
                // 사이클당 1회 제한 기록
                if (metadata.oncePerCycle) {
                    if (!this.activationHistory.has(key)) {
                        this.activationHistory.set(key, new Set());
                    }
                    this.activationHistory.get(key).add(context.cycle);
                }
            }
            // 조건 미충족 & 활성 & 지속형이 아님 → 비활성화
            else if (!conditionMet && isActive && !metadata.persistent) {
                this.deactivateBuff(key, context);
            }
        });
    }
    
    applyActiveBuffsToTargets(allCharacterBuffs, context) {
        this.activeBuffs.forEach((data, key) => {
            if (!data.buff || !data.buff.effect) {
                console.error(`BuffSystem: Invalid buff data for ${key}`);
                return;
            }
            
            // 타겟 리졸버로 대상 찾기
            const targets = this.targetResolver.resolve(
                data.buff.effect.target || 'self',
                context,
                data.source
            );
            
            // 각 타겟에 버프 적용
            targets.forEach(target => {
                if (!target || !target.id) return;
                
                // 타겟의 버프 상태 초기화
                if (!allCharacterBuffs.has(target.id)) {
                    allCharacterBuffs.set(target.id, { ...this.staticBuffs });
                }
                
                const targetBuffs = allCharacterBuffs.get(target.id);
                this.applyBuff(targetBuffs, data.buff.effect, data);
            });
        });
    }
    
    activateBuff(entry, context, overrideEndTime = null) {
        const { character, slot, buff } = entry;
        const key = this.getBuffKey(entry);
        
        // 지속시간 계산
        let endTime = Infinity;
        if (buff.duration) {
            switch (buff.duration.type) {
                case 'time':
                    endTime = context.time + (buff.duration.value || 0);
                    break;
                case 'instant':
                case 'once':
                    endTime = context.time;
                    break;
                case 'permanent':
                    endTime = Infinity;
                    break;
                case 'shots':
                    // shots 기반 버프는 액션으로 처리하는 것이 더 적절
                    // 여기서는 시간 기반으로 근사
                    endTime = context.time + 10; // 임시 처리
                    break;
            }
        }
        
        if (overrideEndTime !== null) {
            endTime = overrideEndTime;
        }
        
        // fixedATK 일회성 적용값 계산
        let appliedValue = null;
        if (buff.effect.isFixedATK && character) {
            const sourceStats = character.getStatWithCoreAndLevel();
            appliedValue = sourceStats.atk * buff.effect.value;
        }
        
        // 버프 활성화
        this.activeBuffs.set(key, {
            buff,
            source: character,
            slot,
            startTime: context.time,
            endTime,
            cycle: context.cycle,
            appliedValue
        });
        
        // 로그 - 개선: 타겟 니케에게 영향을 주는 경우만 출력
        if (this.logger) {
            const targets = this.targetResolver.resolve(
                buff.effect.target || 'self',
                context,
                character
            );
            const targetNikke = context.squad[context.targetIndex];
            
            // 타겟 니케가 영향받는 경우만 로그
            if (targets.includes(targetNikke)) {
                const description = this.getBuffDescription(buff);
                this.log(context.time,
                    `[${character.name}] ${description} 발동`,
                    'buff'
                );
            }
        }
    }
    
    deactivateBuff(key, context) {
        const data = this.activeBuffs.get(key);
        if (data) {
            this.activeBuffs.delete(key);
            // 조건부 버프 해제는 로그 생략 (스팸 방지)
        }
    }
    
    removeExpiredBuffs(currentTime) {
        const expiredKeys = [];
        
        this.activeBuffs.forEach((data, key) => {
            if (currentTime > data.endTime) {
                expiredKeys.push(key);
                
                // 만료 로그 (즉시 효과는 로그 생략)
                if (this.logger && data.buff.duration?.type !== 'instant' && 
                    data.buff.duration?.type !== 'once') {
                    this.log(currentTime, 
                        `[${data.source.name}] ${this.getBuffDescription(data.buff)} 만료`, 
                        'buff'
                    );
                }
            }
        });
        
        expiredKeys.forEach(key => this.activeBuffs.delete(key));
    }
    
    applyBuff(totalBuffs, effect, buffData) {
        if (!effect.stat) return;
        
        // fixedATK 특수 처리
        if (effect.isFixedATK && buffData.appliedValue !== null) {
            totalBuffs.fixedATK = (totalBuffs.fixedATK || 0) + buffData.appliedValue;
        } else {
            // 일반 버프
            const currentValue = totalBuffs[effect.stat] || 0;
            totalBuffs[effect.stat] = currentValue + effect.value;
        }
    }
    
    getBuffKey(entry) {
        return `${entry.character.id}_${entry.slot}_${entry.buff.id}`;
    }
    
    getBuffMetadata(buff) {
        // 기본 메타데이터
        const defaultMetadata = {
            oncePerCycle: false,
            persistent: false,
            stackable: false,
            maxStacks: 1
        };
        
        return { ...defaultMetadata, ...(buff.trigger?.metadata || {}) };
    }
    
    getBuffDescription(buff) {
        const effect = buff.effect;
        if (!effect || !effect.stat) return '알 수 없는 버프';
        
        const value = effect.value;
        const percent = (value * 100).toFixed(1);
        let desc = '';
        
        // 스탯별 설명
        const statDescriptions = {
            atkPercent: `공격력 +${percent}%`,
            damageIncrease: `대미지 +${percent}%`,
            critRate: `크리티컬 확률 +${percent}%`,
            critDamage: `크리티컬 대미지 +${percent}%`,
            attackSpeed: `공격속도 +${percent}%`,
            reloadSpeed: `재장전 속도 +${percent}%`,
            pelletBonus: `펠릿 +${value}`,
            fixedATK: `고정 공격력 증가`,
            ammoCharge: `탄환 충전 ${percent}%`,
            penetrationDamage: `관통 대미지 +${percent}%`,
            receivedDamage: `받는 대미지 증가 +${percent}%`,
            accuracy: `명중률 +${value}`,
            helmCritBonus: `크리티컬 확률 +${percent}%`,
            maxAmmo: `최대 장탄수 +${percent}%`
        };
        
        desc = statDescriptions[effect.stat] || `${effect.stat} +${percent}%`;
        
        // 타겟 정보 추가
        if (effect.target && effect.target !== 'self') {
            const targetDescriptions = {
                all_allies: '아군 전체',
                burst_users: '버스트 사용자',
                lowest_hp: '체력이 가장 낮은 아군',
                same_weapon_type: '같은 무기 타입'
            };
            desc += ` (${targetDescriptions[effect.target] || effect.target})`;
        }
        
        return desc;
    }
    
    cleanupActivationHistory(currentCycle) {
        this.activationHistory.forEach((cycles, key) => {
            // 10사이클 이전 기록 삭제
            const oldCycles = [];
            cycles.forEach(cycle => {
                if (currentCycle - cycle > 10) {
                    oldCycles.push(cycle);
                }
            });
            
            oldCycles.forEach(cycle => cycles.delete(cycle));
            
            // 빈 Set 삭제
            if (cycles.size === 0) {
                this.activationHistory.delete(key);
            }
        });
    }
    
    getEmptyBuffState() {
        return {
            // 퍼센트 증가
            atkPercent: 0,
            critRate: CRIT_RATE,
            critDamage: CRIT_DMG,
            
            // 고정 수치
            fixedATK: 0,
            accuracy: 0,
            
            // 대미지 증가
            damageIncrease: 0,
            eliteDamage: 0,
            coreBonus: 0,
            penetrationDamage: 0,
            distributedDamage: 0,
            receivedDamage: 0,
            
            // 공격 관련
            attackSpeed: 0,
            pelletBonus: 0,
            helmCritBonus: 0,
            
            // 재장전 관련
            reloadSpeed: 0,
            maxAmmo: 0,
            ammoCharge: 0,
            
            // 거리 관련
            distanceBonus: 0,
            
            // 기타
            partDamage: 0,
            dotDamage: 0,
            defIgnoreDamage: 0,
            chargeDamage: 0
        };
    }
    
    // 로그 메서드
    log(time, message, type) {
        if (this.logger) {
            this.logger.log(time, message, type);
        }
    }
    
    // 디버그용 메서드
    getActiveBuffsInfo() {
        const info = [];
        this.activeBuffs.forEach((data, key) => {
            info.push({
                key: key,
                source: data.source?.name || 'Unknown',
                stat: data.buff.effect?.stat || 'Unknown',
                value: data.buff.effect?.value || 0,
                remainingTime: data.endTime === Infinity ? 'Permanent' : 
                    Math.max(0, data.endTime - data.startTime).toFixed(1) + 's',
                cycle: data.cycle
            });
        });
        return info;
    }
    
    getDebugInfo() {
        return {
            activeBuffs: this.getActiveBuffsInfo(),
            registeredTargets: this.targetResolver.getRegisteredTypes(),
            buffCounts: {
                passive: this.buffRegistry.passive.length,
                conditional: this.buffRegistry.conditional.length,
                periodic: this.buffRegistry.periodic.length,
                burst: this.buffRegistry.burst.length
            },
            activationHistory: Array.from(this.activationHistory.entries()).map(([key, cycles]) => ({
                key,
                cycles: Array.from(cycles)
            }))
        };
    }
}

// BuffCalculator 호환성 래퍼 (기존 코드와의 호환성 유지)
class BuffCalculator {
    constructor(dependencies) {
        this.buffSystem = new BuffSystem({
            logger: dependencies.logFn ? {
                log: dependencies.logFn
            } : null,
            config: dependencies.config
        });
        
        this.getNikkes = dependencies.getNikkes;
        this.getBurstUsers = dependencies.getBurstUsers;
        this.targetNikke = dependencies.targetNikke;
        this.logFn = dependencies.logFn;
        
        // 모든 캐릭터 등록
        const allNikkes = this.getNikkes();
        allNikkes.forEach(nikke => {
            this.buffSystem.registerCharacter(nikke);
        });
    }
    
    calculate(time, combatState = {}) {
        const burstCycle = Math.floor((time - BURST_START_TIME) / BURST_CYCLE_TIME);
        const burstInfo = this.getBurstUsers(burstCycle, time);
        
        const context = {
            time: time,
            squad: this.getNikkes(),
            targetIndex: this.getNikkes().indexOf(this.targetNikke),
            burstUsers: burstInfo.activeBurstUsers || [],
            isFullBurst: burstInfo.isFullBurst || false,
            cycle: burstCycle,
            newCycleStarted: combatState.newCycleStarted || false
        };
        
        return this.buffSystem.calculateTotalBuffs(context);
    }
    
    recalculateStaticBuffs(config) {
        this.buffSystem.config = config;
        this.buffSystem.staticBuffs = this.buffSystem.calculateStaticBuffs();
    }
}