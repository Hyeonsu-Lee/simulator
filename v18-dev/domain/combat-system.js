// domain/combat-system.js - 전투 시스템 (이벤트 기반)

class CombatSystem {
    constructor(dependencies) {
        console.log('[CombatSystem] Constructor called');
        
        this.eventBus = dependencies.eventBus;
        this.mediator = dependencies.mediator;
        this.stateStore = dependencies.stateStore;
        this.timeManager = dependencies.timeManager;
        this.logger = dependencies.logger;
        this.characterLoader = dependencies.characterLoader;
        this.configManager = dependencies.configManager;
        
        this.running = false;
        
        // 이벤트 구독
        this.subscribeToEvents();
        this.registerMediatorHandlers();
        
        console.log('[CombatSystem] Constructor complete');
    }
    
    subscribeToEvents() {
        console.log('[CombatSystem] Subscribing to events');
        
        // START 이벤트 구독 제거 - SimulationController에서 직접 호출
        this.eventBus.on(Events.STOP, () => this.stop());
        this.eventBus.on(Events.TICK, (event) => this.handleTick(event));
        
        // 전투 이벤트
        this.eventBus.on(Events.ATTACK, (event) => this.handleAttack(event));
        this.eventBus.on(Events.RELOAD, (event) => this.handleReload(event));
        this.eventBus.on(Events.AMMO_CHANGE, (event) => this.handleAmmoChange(event));
        
        // 계산 결과 이벤트
        this.eventBus.on(Events.DAMAGE_CALCULATED, (event) => this.handleDamageCalculated(event));
        // handleBuffCalculated는 사용하지 않으므로 제거
        
        // 버스트 이벤트
        this.eventBus.on(Events.BURST_READY, (event) => this.handleBurstReady(event));
        this.eventBus.on(Events.BURST_USE, (event) => this.handleBurstUse(event));
        this.eventBus.on(Events.FULL_BURST_END, (event) => this.handleFullBurstEnd(event));
        
        console.log('[CombatSystem] Event subscription complete');
    }
    
    registerMediatorHandlers() {
        // 컬렉션 보너스 핸들러
        this.mediator.registerHandler('GET_COLLECTION_BONUS', async (data) => {
            // DamageCalculator에서 처리
            return null;
        });
    }
    
    /**
     * 시작
     */
    start() {
        if (this.running) return;
        
        console.log('[CombatSystem] Starting');
        this.running = true;
        
        // 초기 설정 로그
        this.logInitialSettings();
        
        // 초기 이벤트 스케줄
        this.scheduleInitialEvents();
        
        console.log('[CombatSystem] Combat system started successfully');
    }
    
    /**
     * 중지
     */
    stop() {
        console.log('[CombatSystem] Stopping');
        this.running = false;
    }
    
    /**
     * 초기 이벤트 스케줄
     */
    scheduleInitialEvents() {
        const squad = this.stateStore.get('squad.members');
        const targetIndex = this.stateStore.get('squad.targetIndex');
        
        console.log('[CombatSystem] Scheduling initial events');
        console.log('[CombatSystem] Squad:', squad);
        console.log('[CombatSystem] Target index:', targetIndex);
        
        // 전투 시작 이벤트
        this.eventBus.emit(Events.BATTLE_START, { time: 0 });
        
        // 타겟 캐릭터 첫 공격 스케줄
        const targetId = squad[targetIndex];
        if (targetId) {
            const character = this.characterLoader.createCharacter(targetId);
            if (character) {
                const firstAttackTime = character.baseStats.attackInterval;
                console.log(`[CombatSystem] Scheduling first attack for ${targetId} at ${firstAttackTime}s`);
                
                // 첫 공격 스케줄
                this.timeManager.schedule(
                    firstAttackTime,
                    Events.ATTACK,
                    { characterId: targetId },
                    5
                );
            } else {
                console.error(`[CombatSystem] Failed to create character ${targetId}`);
            }
        } else {
            console.error(`[CombatSystem] No target character found at index ${targetIndex}`);
        }
        
        // 타겟이 아닌 캐릭터들의 특수 동작 처리
        squad.forEach((charId, index) => {
            if (!charId || index === targetIndex) return;
            
            const character = this.characterLoader.createCharacter(charId);
            if (!character) return;
            
            // 캐릭터별 초기 이벤트 처리
            this.scheduleCharacterEvents(charId, character);
        });
        
        // 버스트 게이지 시작
        const BURST_GAUGE_CHARGE_TIME = 5; // 버스트 게이지 충전 시간
        const BURST_CYCLE_TIME = 20; // 버스트 사이클 시간
        
        this.timeManager.schedule(
            BURST_GAUGE_CHARGE_TIME,
            Events.BURST_READY,
            { cycle: 0 },
            1
        );
        
        console.log(`[CombatSystem] Scheduled BURST_READY at ${BURST_GAUGE_CHARGE_TIME}s`);
        
        // 주기적 체크
        this.timeManager.scheduleRepeating(
            0.1,
            0.1,
            Events.TICK,
            {},
            Infinity
        );
        
        console.log('[CombatSystem] Initial events scheduled successfully');
        console.log('[CombatSystem] TimeManager queue size:', this.timeManager.getQueueSize());
    }
    
    /**
     * 캐릭터별 이벤트 스케줄
     */
    scheduleCharacterEvents(characterId, character) {
        // 풀차지가 필요한 무기 타입 처리
        if (character.baseStats.chargeMultiplier) {
            this.timeManager.schedule(
                character.baseStats.attackInterval,
                Events.FULL_CHARGE,
                { characterId },
                5
            );
        }
    }
    
    /**
     * 틱 처리
     */
    handleTick(event) {
        const currentTime = event.data.time;
        
        // 상태 업데이트
        this.stateStore.set('combat.time', currentTime);
        
        // UI 업데이트
        if (currentTime % 0.1 < 0.01) { // 0.1초마다
            this.updateStats();
        }
    }
    
    /**
     * 공격 처리
     */
    async handleAttack(event) {
        const { characterId } = event.data;
        const time = this.timeManager.getEventTime();
        
        console.log(`[CombatSystem] Attack event for ${characterId} at ${time.toFixed(3)}s`);
        
        const charState = this.stateStore.get(`combat.characters.${characterId}`);
        const targetIndex = this.stateStore.get('squad.targetIndex');
        const isTarget = this.stateStore.get('squad.members')[targetIndex] === characterId;
        
        if (!charState) {
            console.error(`[CombatSystem] No character state for ${characterId}`);
            return;
        }
        
        const character = this.characterLoader.createCharacter(characterId);
        if (!character) {
            console.error(`[CombatSystem] No character spec for ${characterId}`);
            return;
        }
        
        // 탄약 확인
        if (charState.currentAmmo <= 0) {
            if (isTarget) {
                console.log(`[CombatSystem] ${characterId} out of ammo, scheduling reload`);
                this.timeManager.schedule(
                    time,
                    Events.RELOAD,
                    { characterId },
                    7
                );
            }
            return;
        }
        
        // 공격 처리
        if (isTarget) {
            await this.processAttack(characterId, charState, time);
        }
        
        // 탄약 소비
        this.consumeAmmo(characterId, 1);
        
        // 다음 공격 스케줄
        if (isTarget) {
            try {
                // 버프 계산 요청 - buffSystem 직접 사용
                const buffSystem = window.container?.get('buffSystem');
                const staticBuffs = this.stateStore.get('buffs.static') || {};
                const buffs = buffSystem ? buffSystem.calculateTotalBuffs(characterId, staticBuffs) : {};
                
                const attackInterval = character.baseStats.attackInterval / (1 + (buffs.attackSpeed || 0));
                
                console.log(`[CombatSystem] Next attack for ${characterId} at ${(time + attackInterval).toFixed(3)}s`);
                
                this.timeManager.schedule(
                    time + attackInterval,
                    Events.ATTACK,
                    { characterId },
                    5
                );
            } catch (error) {
                console.error('[CombatSystem] Error scheduling next attack:', error);
                // 기본 공격 간격 사용
                this.timeManager.schedule(
                    time + character.baseStats.attackInterval,
                    Events.ATTACK,
                    { characterId },
                    5
                );
            }
        }
    }
    
    /**
     * 공격 처리
     */
    async processAttack(characterId, charState, time) {
        const character = this.characterLoader.createCharacter(characterId);
        if (!character) return;
        
        const config = this.configManager.config.simulation;
        
        // 마지막 탄환 확인
        if (charState.currentAmmo === 1) {
            this.eventBus.emit(Events.LAST_BULLET, {
                characterId: characterId,
                time
            });
        }
        
        try {
            // 버프 계산 - buffSystem 직접 사용
            const buffSystem = window.container?.get('buffSystem');
            const staticBuffs = this.stateStore.get('buffs.static') || {};
            const buffs = buffSystem ? buffSystem.calculateTotalBuffs(characterId, staticBuffs) : {};
            
            // 대미지 계산 요청
            this.eventBus.emit(Events.CALCULATE_DAMAGE, {
                requestId: `damage-${characterId}-${time}`,
                characterId,
                character,
                charState,
                buffs,
                config: {
                    coreSize: config.coreSize,
                    distance: config.distance,
                    eliteCode: config.eliteCode
                },
                isSpecialAttack: charState.replaceAttack !== null,
                time
            });
        } catch (error) {
            this.logger.error(time, `공격 처리 실패 [${characterId}]: ${error.message}`);
            console.error('[CombatSystem] Attack processing error:', error);
        }
    }
    
    /**
     * 대미지 계산 완료 처리
     */
    handleDamageCalculated(event) {
        const { characterId, damageResult, time } = event.data;
        
        console.log(`[CombatSystem] Damage calculated for ${characterId}: ${damageResult.damage}`);
        
        // 통계 업데이트
        this.stateStore.update(state => {
            const cs = state.combat.characters[characterId];
            if (!cs) return state;
            
            cs.shotsFired++;
            cs.totalDamage += damageResult.damage;
            cs.pelletsHit += damageResult.pelletsHit;
            cs.coreHitCount += damageResult.coreHits;
            cs.critCount += damageResult.critHits;
            cs.totalPellets += damageResult.pelletsHit;
            
            // 누적 카운터
            cs.attackCount = (cs.attackCount || 0) + 1;
            
            // globalCounters가 없으면 초기화
            if (!state.combat.globalCounters) {
                state.combat.globalCounters = {
                    bulletsConsumed: 0
                };
            }
            state.combat.globalCounters.bulletsConsumed++;
            
            return state;
        });
        
        // 로그
        this.logAttackResult(characterId, damageResult, time);
        
        // 대미지 이벤트
        this.eventBus.emit(Events.DAMAGE, {
            sourceId: characterId,
            damage: damageResult.damage,
            type: 'attack',
            time
        });
        
        // 특수 공격 처리
        const charState = this.stateStore.get(`combat.characters.${characterId}`);
        if (charState && charState.replaceAttack) {
            this.stateStore.update(state => {
                const cs = state.combat.characters[characterId];
                if (cs.replaceAttack) {
                    cs.replaceAttack.shotsRemaining--;
                    if (cs.replaceAttack.shotsRemaining <= 0) {
                        cs.replaceAttack = null;
                    }
                }
                return state;
            });
        }
        
        // 샷 기반 버프 감소 요청
        this.eventBus.emit(Events.BUFF_DECREMENT_SHOT, { characterId });
    }
    
    /**
     * 재장전 처리
     */
    async handleReload(event) {
        const { characterId } = event.data;
        const time = this.timeManager.getEventTime();
        
        console.log(`[CombatSystem] Reload for ${characterId} at ${time.toFixed(3)}s`);
        
        const character = this.characterLoader.createCharacter(characterId);
        if (!character) return;
        
        try {
            // 버프 계산 - buffSystem 직접 사용
            const buffSystem = window.container?.get('buffSystem');
            const staticBuffs = this.stateStore.get('buffs.static') || {};
            const buffs = buffSystem ? buffSystem.calculateTotalBuffs(characterId, staticBuffs) : {};
            
            // 재장전 시간 계산
            const baseReloadTime = character.baseStats.reloadTime;
            const reloadTime = baseReloadTime / (1 + (buffs.reloadSpeed || 0));
            
            // 최대 탄약 재계산
            const damageCalculator = window.container?.get('damageCalculator');
            const collectionBonus = damageCalculator ? 
                damageCalculator.getCollectionBonus(character.weaponType) : 
                { maxAmmo: 0 };
            
            const baseAmmo = character.baseStats.baseAmmo;
            const maxAmmo = Math.floor(baseAmmo * 
                (1 + collectionBonus.maxAmmo + (buffs.maxAmmo || 0)));
            
            this.stateStore.update(state => {
                const cs = state.combat.characters[characterId];
                if (cs) {
                    cs.isReloading = true;
                    cs.reloadEndTime = time + reloadTime;
                    cs.reloadCount++;
                    cs.maxAmmo = maxAmmo;
                }
                return state;
            });
            
            this.logger.log(time, `재장전 시작 (${reloadTime.toFixed(2)}초)`);
            
            // 재장전 완료 스케줄
            this.timeManager.schedule(
                time + reloadTime,
                Events.AMMO_CHANGE,
                { characterId, type: 'reload', amount: maxAmmo },
                6
            );
        } catch (error) {
            console.error('[CombatSystem] Reload error:', error);
            // 기본 재장전 처리
            const baseReloadTime = character.baseStats.reloadTime;
            this.timeManager.schedule(
                time + baseReloadTime,
                Events.AMMO_CHANGE,
                { characterId, type: 'reload', amount: character.baseStats.baseAmmo },
                6
            );
        }
    }
    
    /**
     * 탄약 변경 처리
     */
    handleAmmoChange(event) {
        const { characterId, type, amount } = event.data;
        
        this.stateStore.update(state => {
            const charState = state.combat.characters[characterId];
            if (!charState) return state;
            
            if (type === 'reload') {
                charState.currentAmmo = charState.maxAmmo;
                charState.isReloading = false;
                charState.reloadEndTime = 0;
                
                this.logger.log(event.data.time, 
                    `재장전 완료 (${charState.currentAmmo}/${charState.maxAmmo})`
                );
                
                // 다음 공격 스케줄
                this.timeManager.schedule(
                    event.data.time,
                    Events.ATTACK,
                    { characterId },
                    5
                );
            } else if (type === 'charge') {
                const chargeAmount = Math.floor(charState.maxAmmo * amount);
                charState.currentAmmo = Math.min(
                    charState.currentAmmo + chargeAmount,
                    charState.maxAmmo
                );
                
                this.logger.buff(event.data.time,
                    `[${characterId}] 탄환 충전: +${chargeAmount}`
                );
            }
            
            return state;
        });
    }
    
    /**
     * 버스트 준비 처리
     */
    handleBurstReady(event) {
        const { cycle } = event.data;
        
        this.stateStore.update(state => {
            state.burst.cycle = cycle;
            state.burst.ready = true;
            state.burst.users = [];
            return state;
        });
        
        // 버스트 사용자 결정
        const burstOrder = this.determineBurstOrder();
        
        // 버스트 사용 스케줄
        let delay = 0;
        burstOrder.forEach(character => {
            this.timeManager.schedule(
                event.data.time + delay,
                Events.BURST_USE,
                { characterId: character.id, position: character.burstPosition },
                1
            );
            delay += 0.143;
        });
        
        // 풀버스트 체크
        if (burstOrder.length === 3) {
            this.timeManager.schedule(
                event.data.time + delay,
                Events.FULL_BURST,
                { cycle },
                0
            );
            
            // 풀버스트 시작
            this.stateStore.update(state => {
                state.burst.fullBurst = true;
                return state;
            });
            
            // 10초 후 풀버스트 종료
            this.timeManager.schedule(
                event.data.time + delay + 10,
                Events.FULL_BURST_END,
                { cycle },
                0
            );
        }
        
        // 다음 사이클
        const BURST_CYCLE_TIME = 20;
        this.timeManager.schedule(
            event.data.time + BURST_CYCLE_TIME,
            Events.BURST_READY,
            { cycle: cycle + 1 },
            1
        );
    }
    
    /**
     * 버스트 사용 순서 결정
     */
    determineBurstOrder() {
        const squad = this.stateStore.get('squad.members');
        const cooldowns = this.stateStore.get('burst.cooldowns') || new Map();
        const currentTime = this.timeManager.currentTime;
        
        const available = [];
        
        for (let position = 1; position <= 3; position++) {
            const candidates = squad
                .filter(id => id) // null 체크 추가
                .map(id => {
                    const character = this.characterLoader.createCharacter(id);
                    return character ? { id, character } : null;
                })
                .filter(data => data) // null 체크
                .filter(({ character }) => character.burstPosition === position)
                .filter(({ id }) => {
                    // Map인지 확인하고 적절한 방법으로 접근
                    const lastUsed = cooldowns instanceof Map ? 
                        (cooldowns.get(id) || -Infinity) : 
                        (cooldowns[id] || -Infinity);
                    const character = this.characterLoader.createCharacter(id);
                    return character && currentTime >= lastUsed + character.burstCooldown;
                });
            
            if (candidates.length > 0) {
                // 우선순위: 타겟 > 스쿼드 순서
                const targetIndex = this.stateStore.get('squad.targetIndex');
                const targetId = squad[targetIndex];
                
                const selected = candidates.find(({ id }) => id === targetId) || candidates[0];
                available.push(selected.character);
            }
        }
        
        return available;
    }
    
    /**
     * 버스트 사용 처리
     */
    handleBurstUse(event) {
        const { characterId, position } = event.data;
        const time = event.data.time;
        
        this.logger.buff(time, `[${characterId}] ${position}버스트 사용!`);
        
        // 쿨다운 기록
        this.stateStore.update(state => {
            if (!state.burst.cooldowns) {
                state.burst.cooldowns = new Map();
            }
            
            // Map인지 확인하고 적절한 방법으로 설정
            if (state.burst.cooldowns instanceof Map) {
                state.burst.cooldowns.set(characterId, time);
            } else {
                // 일반 객체인 경우 Map으로 변환
                const cooldownMap = new Map(Object.entries(state.burst.cooldowns || {}));
                cooldownMap.set(characterId, time);
                state.burst.cooldowns = cooldownMap;
            }
            
            // 버스트 사용자 기록
            if (position === 1) state.burst.burst1User = characterId;
            else if (position === 2) state.burst.burst2User = characterId;
            else if (position === 3) state.burst.burst3User = characterId;
            
            return state;
        });
        
        // 버스트 스킬 발동
        this.eventBus.emit(Events.SKILL_TRIGGER, {
            characterId,
            skillType: 'burst',
            time
        });
    }
    
    /**
     * 풀버스트 종료 처리
     */
    handleFullBurstEnd(event) {
        const time = event.data.time;
        
        this.logger.buff(time, '풀버스트 종료');
        
        this.stateStore.update(state => {
            state.burst.fullBurst = false;
            state.burst.burst1User = null;
            state.burst.burst2User = null;
            state.burst.burst3User = null;
            return state;
        });
    }
    
    /**
     * 탄약 소비
     */
    consumeAmmo(characterId, amount) {
        this.stateStore.update(state => {
            const charState = state.combat.characters[characterId];
            if (charState) {
                charState.currentAmmo = Math.max(0, charState.currentAmmo - amount);
            }
            return state;
        });
    }
    
    /**
     * 통계 업데이트
     */
    updateStats() {
        const targetIndex = this.stateStore.get('squad.targetIndex');
        const targetId = this.stateStore.get('squad.members')[targetIndex];
        const targetState = this.stateStore.get(`combat.characters.${targetId}`);
        const combat = this.stateStore.get('combat');
        
        if (!targetState) return;
        
        const stats = {
            time: combat.time,
            totalDamage: targetState.totalDamage,
            dps: combat.time > 0 ? Math.floor(targetState.totalDamage / combat.time) : 0,
            shotCount: targetState.shotsFired,
            coreHitRate: targetState.totalPellets > 0 ? 
                (targetState.coreHitCount / targetState.totalPellets * 100) : 0,
            critRate: targetState.totalPellets > 0 ? 
                (targetState.critCount / targetState.totalPellets * 100) : 0,
            reloadCount: targetState.reloadCount,
            skill1Count: targetState.skill1Count || 0
        };
        
        this.eventBus.emit(Events.UI_UPDATE, { stats });
    }
    
    /**
     * 공격 결과 로그
     */
    logAttackResult(characterId, damageResult, time) {
        const charState = this.stateStore.get(`combat.characters.${characterId}`);
        if (!charState) return;
        
        let logMsg = `발사 #${charState.shotsFired}`;
        if (damageResult.isSpecialAttack) {
            logMsg += ` [특수탄]`;
        }
        logMsg += ` - `;
        
        if (damageResult.pelletsHit > 1) {
            logMsg += `펠릿 ${damageResult.pelletsHit}개 중 ${damageResult.coreHits}개 코어히트`;
            if (damageResult.critHits > 0) logMsg += `, 크리티컬 ${damageResult.critHits}회`;
        } else {
            logMsg += damageResult.coreHits > 0 ? '코어히트' : '일반히트';
            if (damageResult.critHits > 0) logMsg += ' (크리티컬!)';
        }
        logMsg += `, 대미지: ${this.formatNumber(damageResult.damage)}`;
        
        this.logger.log(time, logMsg, damageResult.critHits > 0 ? 'crit' : 'damage');
    }
    
    /**
     * 숫자 포맷팅
     */
    formatNumber(num) {
        if (typeof num !== 'number') return '0';
        return Math.floor(num).toLocaleString('ko-KR');
    }
    
    /**
     * 초기 설정 로그
     */
    async logInitialSettings() {
        const config = this.configManager.config;
        const squad = config.squad.members;
        const targetIndex = config.squad.targetIndex;
        
        try {
            // 소장품 효과
            const targetId = squad[targetIndex];
            if (targetId) {
                const targetChar = this.characterLoader.createCharacter(targetId);
                if (targetChar) {
                    const damageCalculator = window.container?.get('damageCalculator');
                    const bonus = damageCalculator ? 
                        damageCalculator.getCollectionBonus(targetChar.weaponType) :
                        { coreBonus: 0, chargeRatio: 0, maxAmmo: 0 };
                    
                    this.logger.buff(0, '=== 소장품 효과 ===');
                    this.logger.buff(0, `무기 타입: ${targetChar.weaponType}`);
                    
                    if (bonus.coreBonus > 0) {
                        this.logger.buff(0, `코어 대미지 +${(bonus.coreBonus * 100).toFixed(2)}%`);
                    }
                    if (bonus.chargeRatio > 0) {
                        this.logger.buff(0, `차지 대미지 배율 +${(bonus.chargeRatio * 100).toFixed(2)}%`);
                    }
                    if (bonus.maxAmmo > 0) {
                        this.logger.buff(0, `최대 장탄수 +${(bonus.maxAmmo * 100).toFixed(1)}%`);
                    }
                }
            }
            
            // 오버로드 효과
            const overloadBuffs = this.configManager.calculateOverloadBuffs();
            if (Object.values(overloadBuffs).some(v => v > 0)) {
                this.logger.buff(0, '=== 오버로드 장비 효과 ===');
                
                if (overloadBuffs.atkPercent > 0) {
                    this.logger.buff(0, `공격력 증가 +${(overloadBuffs.atkPercent * 100).toFixed(2)}%`);
                }
                if (overloadBuffs.critRate > 0) {
                    this.logger.buff(0, `크리티컬 확률 증가 +${(overloadBuffs.critRate * 100).toFixed(2)}%`);
                }
                if (overloadBuffs.critDamage > 0) {
                    this.logger.buff(0, `크리티컬 피해량 증가 +${(overloadBuffs.critDamage * 100).toFixed(2)}%`);
                }
                if (overloadBuffs.accuracy > 0) {
                    this.logger.buff(0, `명중률 증가 +${overloadBuffs.accuracy.toFixed(2)}`);
                }
                if (overloadBuffs.maxAmmo > 0) {
                    this.logger.buff(0, `최대 장탄 수 증가 +${(overloadBuffs.maxAmmo * 100).toFixed(2)}%`);
                }
                if (overloadBuffs.eliteDamage > 0) {
                    this.logger.buff(0, `우월코드 대미지 증가 +${(overloadBuffs.eliteDamage * 100).toFixed(2)}%`);
                }
            }
            
            // 큐브 효과
            const CUBE_DATA = {
                reload: {
                    name: "재장전 큐브",
                    effects: {
                        reloadSpeed: 0.15
                    }
                }
            };
            
            if (config.simulation.cubeType && CUBE_DATA[config.simulation.cubeType]) {
                this.logger.buff(0, `${CUBE_DATA[config.simulation.cubeType].name} 장착`);
            }
            
            // 스쿼드 구성
            this.logger.buff(0, '=== 스쿼드 구성 ===');
            squad.forEach((charId, index) => {
                if (!charId) return;
                
                const character = this.characterLoader.createCharacter(charId);
                if (!character) return;
                
                const role = index === targetIndex ? ' (타겟)' : '';
                const burstInfo = character.burstPosition ? ` [${character.burstPosition}버스트]` : '';
                this.logger.buff(0, `${index + 1}. ${character.name}${role}${burstInfo}`);
            });
            
            // 설정
            this.logger.buff(0, `코어 크기: ${config.simulation.coreSize}`);
            this.logger.buff(0, `우월코드: ${config.simulation.eliteCode === 'yes' ? '적용' : '미적용'}`);
            this.logger.buff(0, `거리: ${config.simulation.distance}단계`);
        } catch (error) {
            console.error('[CombatSystem] Error in logInitialSettings:', error);
        }
    }
}

// 전역 노출
if (typeof window !== 'undefined' && !window.CombatSystem) {
    window.CombatSystem = CombatSystem;
}

// 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CombatSystem;
}