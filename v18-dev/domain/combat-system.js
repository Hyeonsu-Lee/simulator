// domain/combat-system.js - 전투 시스템 (이벤트 기반)

class CombatSystem {
    constructor(dependencies) {
        this.eventBus = dependencies.eventBus;
        this.squad = dependencies.squad;
        this.timeManager = dependencies.timeManager;
        this.logger = dependencies.logger;
        this.characterLoader = dependencies.characterLoader;
        this.configManager = dependencies.configManager;
        this.buffSystem = dependencies.buffSystem;         // 추가
        this.damageCalculator = dependencies.damageCalculator; // 추가
        
        this.running = false;
        this.subscribeToEvents();
    }
    
    subscribeToEvents() {
        this.eventBus.on(Events.START, () => this.start());
        this.eventBus.on(Events.STOP, () => this.stop());
        this.eventBus.on(Events.TICK, (event) => this.handleTick(event));
        
        // 전투 이벤트
        this.eventBus.on(Events.ATTACK, (event) => this.handleAttack(event));
        this.eventBus.on(Events.RELOAD, (event) => this.handleReload(event));
        this.eventBus.on(Events.AMMO_CHANGE, (event) => this.handleAmmoChange(event));
        
        // 계산 결과 이벤트
        this.eventBus.on(Events.DAMAGE_CALCULATED, (event) => this.handleDamageCalculated(event));
        
        // 버스트 이벤트
        this.eventBus.on(Events.BURST_READY, (event) => this.handleBurstReady(event));
        this.eventBus.on(Events.BURST_USE, (event) => this.handleBurstUse(event));
        this.eventBus.on(Events.FULL_BURST_END, (event) => this.handleFullBurstEnd(event));
    }
    
    /**
     * 전투 시작
     */
    start() {
        console.log('[CombatSystem] Starting combat');
        this.running = true;
        
        // 초기 이벤트 스케줄
        this.scheduleInitialEvents();
        
        // 로그
        this.logger.buff(0, '=== 시뮬레이션 시작 ===');
        this.logInitialSettings();
    }
    
    /**
     * 전투 중지
     */
    stop() {
        this.running = false;
    }
    
    /**
     * 초기 이벤트 스케줄
     */
    scheduleInitialEvents() {
        const config = this.squad.get('config');
        const squadMembers = this.squad.get('squad.members');
        const targetIndex = this.squad.get('squad.targetIndex');
        
        console.log('[CombatSystem] Squad:', squadMembers, 'Target index:', targetIndex);
        
        // 전투 시작 이벤트
        this.timeManager.schedule(0, Events.BATTLE_START, {}, 0);
        
        // 타겟 캐릭터 첫 공격
        const targetCharId = squadMembers[targetIndex];
        if (targetCharId) {
            const character = this.characterLoader.createCharacter(targetCharId);
            if (character) {
                console.log(`[CombatSystem] Scheduling first attack for ${targetCharId} at ${character.baseStats.attackInterval}s`);
                this.timeManager.schedule(
                    character.baseStats.attackInterval,
                    Events.ATTACK,
                    { characterId: targetCharId },
                    5
                );
            }
        }
        
        // 타겟이 아닌 캐릭터들의 특수 동작 처리
        squadMembers.forEach((charId, index) => {
            if (!charId || index === targetIndex) return;
            
            const character = this.characterLoader.createCharacter(charId);
            if (!character) return;
            
            // 캐릭터별 초기 이벤트 처리
            this.scheduleCharacterEvents(charId, character);
        });
        
        // 버스트 게이지 시작 - 상수 사용
        this.timeManager.schedule(
            window.BURST_GAUGE_CHARGE_TIME,
            Events.BURST_READY,
            { cycle: 0 },
            1
        );
        
        // 주기적 체크
        this.timeManager.scheduleRepeating(
            window.UI_UPDATE_INTERVAL,
            window.UI_UPDATE_INTERVAL,
            Events.TICK,
            {},
            Infinity
        );
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
        this.squad.set('combat.time', currentTime);
        
        // UI 업데이트 - 상수 사용
        if (currentTime % window.UI_UPDATE_INTERVAL < 0.01) {
            this.updateStats();
        }
    }
    
    /**
     * 공격 처리
     */
    handleAttack(event) {
        const { characterId } = event.data;
        const time = event.data.time;
        
        console.log(`[CombatSystem] Attack event for ${characterId} at ${time.toFixed(3)}s`);
        
        // 캐릭터 상태 확인
        const charState = this.squad.get(`combat.characters.${characterId}`);
        if (!charState) {
            console.error(`[CombatSystem] Character state not found for ${characterId}`);
            return;
        }
        
        // 재장전 중이면 무시
        if (charState.isReloading) {
            console.log(`[CombatSystem] ${characterId} is reloading, skipping attack`);
            return;
        }
        
        // 탄약 확인
        if (charState.currentAmmo <= 0) {
            console.log(`[CombatSystem] ${characterId} has no ammo, starting reload`);
            this.startReload(characterId, time);
            return;
        }
        
        // 공격 처리
        this.processAttack(characterId, charState, time);
        
        // 탄약 소비
        this.consumeAmmo(characterId, 1);
        
        // 다음 공격 스케줄
        if (charState.currentAmmo > 0 && !charState.isReloading) {
            const character = this.characterLoader.createCharacter(characterId);
            
            try {
                const staticBuffs = this.squad.get('buffs.static') || {};
                const buffs = this.buffSystem.calculateTotalBuffs(characterId, staticBuffs);
                
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
    processAttack(characterId, charState, time) {
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
            const staticBuffs = this.squad.get('buffs.static') || {};
            const buffs = this.buffSystem.calculateTotalBuffs(characterId, staticBuffs);
            
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
        this.squad.update(state => {
            const charState = state.combat.characters[characterId];
            if (!charState) return state;
            
            charState.totalDamage += damageResult.damage;
            charState.shotsFired++;
            charState.attackCount++;
            charState.pelletsHit += damageResult.pelletsHit;
            charState.coreHitCount += damageResult.coreHits;
            charState.totalPellets += damageResult.totalPellets;
            if (damageResult.isCrit) {
                charState.critCount++;
            }
            
            // 글로벌 카운터
            state.combat.globalCounters.bulletsConsumed++;
            
            return state;
        });
        
        // 대미지 로그
        if (damageResult.isCrit) {
            this.logger.crit(time, 
                `[${characterId}] 크리티컬! ${Math.floor(damageResult.damage)} 대미지 ` +
                `(명중 ${damageResult.pelletsHit}/${damageResult.totalPellets})`
            );
        } else {
            this.logger.damage(time,
                `[${characterId}] ${Math.floor(damageResult.damage)} 대미지 ` +
                `(명중 ${damageResult.pelletsHit}/${damageResult.totalPellets})`
            );
        }
        
        // Shot 기반 버프 감소
        this.eventBus.emit(Events.BUFF_DECREMENT_SHOT, {
            characterId: characterId,
            time
        });
    }
    
    /**
     * 재장전 시작
     */
    startReload(characterId, time) {
        const character = this.characterLoader.createCharacter(characterId);
        if (!character) return;
        
        // 상태 업데이트
        this.squad.update(state => {
            const charState = state.combat.characters[characterId];
            if (charState) {
                charState.isReloading = true;
                charState.reloadCount++;
            }
            return state;
        });
        
        // 버프 계산
        const staticBuffs = this.squad.get('buffs.static') || {};
        const buffs = this.buffSystem.calculateTotalBuffs(characterId, staticBuffs);
        
        const reloadTime = character.baseStats.reloadTime / (1 + (buffs.reloadSpeed || 0));
        
        // 재장전 로그
        this.logger.reload(time, `[${characterId}] 재장전 시작 (${reloadTime.toFixed(2)}초)`);
        
        // 재장전 완료 스케줄
        this.timeManager.schedule(
            time + reloadTime,
            Events.RELOAD,
            { characterId },
            3
        );
    }
    
    /**
     * 재장전 완료 처리
     */
    handleReload(event) {
        const { characterId } = event.data;
        const time = event.data.time;
        
        const character = this.characterLoader.createCharacter(characterId);
        if (!character) return;
        
        // 상태 업데이트
        this.squad.update(state => {
            const charState = state.combat.characters[characterId];
            if (charState) {
                charState.isReloading = false;
                charState.currentAmmo = charState.maxAmmo;
            }
            return state;
        });
        
        this.logger.reload(time, `[${characterId}] 재장전 완료`);
        
        // 다음 공격 스케줄
        this.scheduleNextAttack(characterId, time);
    }
    
    /**
     * 다음 공격 스케줄
     */
    scheduleNextAttack(characterId, time) {
        const character = this.characterLoader.createCharacter(characterId);
        if (!character) return;
        
        // 버프 계산
        try {
            const staticBuffs = this.squad.get('buffs.static') || {};
            const buffs = this.buffSystem.calculateTotalBuffs(characterId, staticBuffs);
            
            const attackInterval = character.baseStats.attackInterval / (1 + (buffs.attackSpeed || 0));
            
            this.timeManager.schedule(
                time + attackInterval,
                Events.ATTACK,
                { characterId },
                5
            );
        } catch (error) {
            console.error('[CombatSystem] Error in scheduleNextAttack:', error);
            // 기본 공격 간격 사용
            this.timeManager.schedule(
                time + character.baseStats.attackInterval,
                Events.ATTACK,
                { characterId },
                5
            );
        }
    }
    
    /**
     * 탄약 변경 처리
     */
    handleAmmoChange(event) {
        const { characterId, type, amount } = event.data;
        
        this.squad.update(state => {
            const charState = state.combat.characters[characterId];
            if (!charState) return state;
            
            if (type === 'charge') {
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
        
        this.squad.update(state => {
            state.burst.cycle = cycle;
            state.burst.ready = true;
            state.burst.users = [];
            return state;
        });
        
        // 버스트 사용자 결정
        const burstOrder = this.determineBurstOrder();
        
        // 버스트 사용 스케줄 - 상수 사용
        let delay = 0;
        burstOrder.forEach(character => {
            this.timeManager.schedule(
                event.data.time + delay,
                Events.BURST_USE,
                { character, position: character.burstPosition },
                1
            );
            delay += window.BURST_USE_DELAY;
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
            this.squad.update(state => {
                state.burst.fullBurst = true;
                return state;
            });
            
            // 풀버스트 종료 - 상수 사용
            this.timeManager.schedule(
                event.data.time + delay + window.FULL_BURST_DURATION,
                Events.FULL_BURST_END,
                { cycle },
                0
            );
        }
        
        // 다음 사이클 - 상수 사용
        this.timeManager.schedule(
            event.data.time + window.BURST_CYCLE_TIME,
            Events.BURST_READY,
            { cycle: cycle + 1 },
            1
        );
    }
    
    /**
     * 버스트 사용 순서 결정
     */
    determineBurstOrder() {
        const squadMembers = this.squad.get('squad.members');
        const cooldowns = this.squad.get('burst.cooldowns');
        const currentTime = this.timeManager.currentTime;
        
        const available = [];
        
        for (let position = 1; position <= 3; position++) {
            const candidates = squadMembers
                .map(id => id ? this.characterLoader.createCharacter(id) : null)
                .filter(char => 
                    char && 
                    char.burstPosition === position &&
                    (!cooldowns[char.id] || cooldowns[char.id] <= currentTime)
                );
            
            if (candidates.length > 0) {
                available.push(candidates[0]);
            }
        }
        
        return available;
    }
    
    /**
     * 버스트 사용 처리
     */
    handleBurstUse(event) {
        const { character, position } = event.data;
        
        // 버스트 사용 기록
        this.squad.update(state => {
            state.burst.users.push(character.id);
            
            // 버스트 쿨다운 설정 - 상수 사용
            const realCooldown = window.BURST_COOLDOWN_MAP[character.burstCooldown] || character.burstCooldown;
            state.burst.cooldowns[character.id] = event.data.time + realCooldown;
            
            return state;
        });
        
        // 로그
        const burstSkill = character.skills?.burst;
        if (burstSkill) {
            this.logger.skill(event.data.time, 
                `[${character.name}] ${burstSkill.name} 발동`
            );
        }
    }
    
    /**
     * 풀버스트 종료 처리
     */
    handleFullBurstEnd(event) {
        this.squad.update(state => {
            state.burst.fullBurst = false;
            return state;
        });
    }
    
    /**
     * 탄약 소비
     */
    consumeAmmo(characterId, amount) {
        this.squad.update(state => {
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
        const combat = this.squad.get('combat');
        const targetIndex = this.squad.get('squad.targetIndex');
        const targetId = this.squad.get('squad.members')[targetIndex];
        const targetState = combat.characters[targetId];
        
        if (!targetState) return;
        
        const stats = {
            time: combat.time,
            totalDamage: targetState.totalDamage,
            dps: combat.time > 0 ? Math.floor(targetState.totalDamage / combat.time) : 0,
            shotCount: targetState.shotsFired,
            coreHitRate: targetState.totalPellets > 0 ? 
                (targetState.coreHitCount / targetState.totalPellets * 100) : 0,
            critRate: targetState.totalPellets > 0 ?
                (targetState.critCount / targetState.shotsFired * 100) : 0,
            currentAmmo: targetState.currentAmmo,
            maxAmmo: targetState.maxAmmo,
            reloadCount: targetState.reloadCount
        };
        
        this.eventBus.emit(Events.UI_UPDATE, { stats });
    }
    
    /**
     * 시작 설정 로그
     */
    logInitialSettings() {
        try {
            const config = this.configManager.config;
            const squadMembers = this.squad.get('squad.members');
            const targetIndex = this.squad.get('squad.targetIndex');
            
            // 스쿼드 구성
            this.logger.buff(0, '=== 스쿼드 구성 ===');
            squadMembers.forEach((charId, index) => {
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
window.CombatSystem = CombatSystem;