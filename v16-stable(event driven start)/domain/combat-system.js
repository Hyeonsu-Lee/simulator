// domain/combat-system.js - 전투 시스템

class CombatSystem {
    constructor() {
        this.running = false;
        this.subscribeToEvents();
    }
    
    subscribeToEvents() {
        eventBus.on(Events.START, () => this.start());
        eventBus.on(Events.STOP, () => this.stop());
        eventBus.on(Events.TICK, (event) => this.handleTick(event));
        
        // 전투 이벤트
        eventBus.on(Events.ATTACK, (event) => this.handleAttack(event));
        eventBus.on(Events.RELOAD, (event) => this.handleReload(event));
        eventBus.on(Events.AMMO_CHANGE, (event) => this.handleAmmoChange(event));
        
        // 버스트 이벤트
        eventBus.on(Events.BURST_READY, (event) => this.handleBurstReady(event));
        eventBus.on(Events.BURST_USE, (event) => this.handleBurstUse(event));
        eventBus.on(Events.FULL_BURST_END, (event) => this.handleFullBurstEnd(event));
    }
    
    /**
     * 전투 시작
     */
    start() {
        this.running = true;
        
        // 초기 이벤트 스케줄
        this.scheduleInitialEvents();
        
        // 로그
        logger.buff(0, '=== 시뮬레이션 시작 ===');
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
        const config = stateStore.get('config');
        const squad = stateStore.get('squad.members');
        const targetIndex = stateStore.get('squad.targetIndex');
        
        // 전투 시작 이벤트
        timeManager.schedule(0, Events.BATTLE_START, {}, 0);
        
        // 타겟 캐릭터 첫 공격
        const targetCharId = squad[targetIndex];
        if (targetCharId) {
            const character = characterLoader.createCharacter(targetCharId);
            if (character) {
                timeManager.schedule(
                    character.baseStats.attackInterval,
                    Events.ATTACK,
                    { characterId: targetCharId },
                    5
                );
            }
        }
        
        // 타겟이 아닌 캐릭터들의 특수 동작 처리
        squad.forEach((charId, index) => {
            if (!charId || index === targetIndex) return;
            
            const character = characterLoader.createCharacter(charId);
            if (!character) return;
            
            // 캐릭터별 초기 이벤트 처리 (JSON 기반으로 확장 가능)
            this.scheduleCharacterEvents(charId, character);
        });
        
        // 버스트 게이지 시작
        timeManager.schedule(
            BURST_GAUGE_CHARGE_TIME,
            Events.BURST_READY,
            { cycle: 0 },
            1
        );
        
        // 주기적 체크
        timeManager.scheduleRepeating(
            0.1,
            0.1,
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
            timeManager.schedule(
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
        stateStore.set('combat.time', currentTime);
        
        // UI 업데이트
        if (currentTime % 0.1 < 0.01) { // 0.1초마다
            this.updateStats();
        }
    }
    
    /**
     * 공격 처리
     */
    handleAttack(event) {
        const { characterId } = event.data;
        const time = timeManager.getEventTime(); // 정확한 이벤트 시간 가져오기
        
        const charState = stateStore.get(`combat.characters.${characterId}`);
        const targetIndex = stateStore.get('squad.targetIndex');
        const isTarget = stateStore.get('squad.members')[targetIndex] === characterId;
        
        if (!charState) return;
        
        const character = characterLoader.createCharacter(characterId);
        if (!character) return;
        
        // 탄약 확인
        if (charState.currentAmmo <= 0) {
            if (isTarget) {
                timeManager.schedule(
                    time,
                    Events.RELOAD,
                    { characterId },
                    7
                );
            }
            return;
        }
        
        // 공격 처리
        this.processAttack(characterId, charState, time, isTarget);
        
        // 탄약 소비
        this.consumeAmmo(characterId, 1);
        
        // 다음 공격 스케줄
        if (isTarget) {
            const staticBuffs = stateStore.get('buffs.static');
            const buffs = buffSystem.calculateTotalBuffs(characterId, staticBuffs);
            const attackInterval = character.baseStats.attackInterval / (1 + buffs.attackSpeed);
            
            timeManager.schedule(
                time + attackInterval,
                Events.ATTACK,
                { characterId },
                5
            );
        }
    }
    
    /**
     * 공격 처리
     */
    processAttack(characterId, charState, time, isTarget) {
        if (!isTarget) return;
        
        const character = characterLoader.createCharacter(characterId);
        if (!character) return;
        
        const config = configManager.config.simulation;  // ConfigManager에서 직접 가져오기
        const staticBuffs = stateStore.get('buffs.static');
        const buffs = buffSystem.calculateTotalBuffs(characterId, staticBuffs);
        
        // 마지막 탄환 확인
        if (charState.currentAmmo === 1) {
            eventBus.emit(Events.LAST_BULLET, {
                characterId: characterId,
                time
            });
        }
        
        // 대미지 계산
        const damageResult = damageCalculator.calculateAttackDamage({
            character,
            charState,
            buffs,
            config: {
                coreSize: config.coreSize,
                distance: config.distance,
                eliteCode: config.eliteCode
            },
            isSpecialAttack: charState.replaceAttack !== null
        });
        
        // 통계 업데이트
        stateStore.update(state => {
            const cs = state.combat.characters[characterId];
            cs.shotsFired++;
            cs.totalDamage += damageResult.damage;
            cs.pelletsHit += damageResult.pelletsHit;
            cs.coreHitCount += damageResult.coreHits;
            cs.critCount += damageResult.critHits;
            cs.totalPellets += damageResult.pelletsHit;
            
            // 누적 카운터
            cs.attackCount++;
            state.combat.globalCounters.bulletsConsumed++;
            
            return state;
        });
        
        // 로그
        let logMsg = `발사 #${charState.shotsFired + 1}`;
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
        logMsg += `, 대미지: ${formatNumber(damageResult.damage)}`;
        
        logger.log(time, logMsg, damageResult.critHits > 0 ? 'crit' : 'damage');
        
        // 대미지 이벤트
        eventBus.emit(Events.DAMAGE, {
            sourceId: characterId,
            damage: damageResult.damage,
            type: 'attack',
            time
        });
        
        // 특수 공격 처리
        if (charState.replaceAttack) {
            stateStore.update(state => {
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
        
        // 샷 기반 버프 감소
        buffSystem.decrementShotBuffs(characterId);
    }
    
    /**
     * 재장전 처리
     */
    handleReload(event) {
        const { characterId } = event.data;
        const time = timeManager.getEventTime(); // 정확한 이벤트 시간 가져오기
        
        const character = characterLoader.createCharacter(characterId);
        if (!character) return;
        
        const staticBuffs = stateStore.get('buffs.static');
        const buffs = buffSystem.calculateTotalBuffs(characterId, staticBuffs);
        
        // 재장전 시간 계산
        const baseReloadTime = character.baseStats.reloadTime;
        const reloadTime = baseReloadTime / (1 + buffs.reloadSpeed);
        
        // 최대 탄약 재계산
        const collectionBonus = damageCalculator.getCollectionBonus(character.weaponType);
        const maxAmmo = Math.floor(character.baseStats.baseAmmo * 
            (1 + buffs.maxAmmo + collectionBonus.maxAmmo));
        
        // 탄약 충전
        stateStore.update(state => {
            const charState = state.combat.characters[characterId];
            if (charState) {
                charState.maxAmmo = maxAmmo;
                charState.currentAmmo = maxAmmo;
                charState.reloadCount++;
            }
            return state;
        });
        
        logger.reload(time, 
            `재장전 (${reloadTime.toFixed(3)}초, 탄창: ${maxAmmo})`
        );
        
        // 다음 공격 스케줄
        timeManager.schedule(
            time + reloadTime,
            Events.ATTACK,
            { characterId },
            5
        );
    }
    
    /**
     * 탄약 변경 처리
     */
    handleAmmoChange(event) {
        const { characterId, type, amount } = event.data;
        
        stateStore.update(state => {
            const charState = state.combat.characters[characterId];
            if (!charState) return state;
            
            if (type === 'charge') {
                const chargeAmount = Math.floor(charState.maxAmmo * amount);
                charState.currentAmmo = Math.min(
                    charState.currentAmmo + chargeAmount,
                    charState.maxAmmo
                );
                
                logger.buff(event.data.time,
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
        
        stateStore.update(state => {
            state.burst.cycle = cycle;
            state.burst.ready = true;
            state.burst.users = []; // 새 사이클 시작 시 초기화
            return state;
        });
        
        // 버스트 사용자 결정
        const burstOrder = this.determineBurstOrder();
        
        // 버스트 사용 스케줄
        let delay = 0;
        burstOrder.forEach(character => {
            timeManager.schedule(
                event.data.time + delay,
                Events.BURST_USE,
                { character, position: character.burstPosition },
                1
            );
            delay += 0.143;
        });
        
        // 풀버스트 체크
        if (burstOrder.length === 3) {
            timeManager.schedule(
                event.data.time + delay,
                Events.FULL_BURST,
                { cycle },
                0
            );
            
            // 풀버스트 시작
            stateStore.update(state => {
                state.burst.fullBurst = true;
                return state;
            });
            
            // 10초 후 풀버스트 종료
            timeManager.schedule(
                event.data.time + delay + 10,
                Events.FULL_BURST_END,
                { cycle },
                0
            );
        }
        
        // 다음 사이클
        timeManager.schedule(
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
        const squad = stateStore.get('squad.members');
        const cooldowns = stateStore.get('burst.cooldowns');
        const currentTime = timeManager.currentTime;
        
        const available = [];
        
        for (let position = 1; position <= 3; position++) {
            const candidates = squad
                .map(id => id ? characterLoader.createCharacter(id) : null)
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
        stateStore.update(state => {
            state.burst.users.push(character.id);
            
            // 버스트 쿨다운 설정
            const realCooldown = BURST_COOLDOWN_MAP[character.burstCooldown] || character.burstCooldown;
            state.burst.cooldowns[character.id] = event.data.time + realCooldown;
            
            return state;
        });
        
        // 로그
        const burstSkill = character.skills?.burst;
        if (burstSkill) {
            logger.skill(event.data.time, 
                `[${character.name}] ${burstSkill.name} 발동`
            );
        }
    }
    
    /**
     * 풀버스트 종료 처리
     */
    handleFullBurstEnd(event) {
        stateStore.update(state => {
            state.burst.fullBurst = false;
            return state;
        });
    }
    
    /**
     * 탄약 소비
     */
    consumeAmmo(characterId, amount) {
        stateStore.update(state => {
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
        const combat = stateStore.get('combat');
        const targetIndex = stateStore.get('squad.targetIndex');
        const targetId = stateStore.get('squad.members')[targetIndex];
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
                (targetState.critCount / targetState.totalPellets * 100) : 0,
            reloadCount: targetState.reloadCount,
            skill1Count: targetState.skill1Count || 0
        };
        
        eventBus.emit(Events.UI_UPDATE, { stats });
    }
    
    /**
     * 초기 설정 로그
     */
    logInitialSettings() {
        const config = configManager.config;
        const squad = config.squad.members;
        const targetIndex = config.squad.targetIndex;
        
        // 소장품 효과
        const targetId = squad[targetIndex];
        if (targetId) {
            const targetChar = characterLoader.createCharacter(targetId);
            if (targetChar) {
                const bonus = damageCalculator.getCollectionBonus(targetChar.weaponType);
                
                logger.buff(0, '=== 소장품 효과 ===');
                logger.buff(0, `무기 타입: ${targetChar.weaponType}`);
                
                if (bonus.coreBonus > 0) {
                    logger.buff(0, `코어 대미지 +${(bonus.coreBonus * 100).toFixed(2)}%`);
                }
                if (bonus.chargeRatio > 0) {
                    logger.buff(0, `차지 대미지 배율 +${(bonus.chargeRatio * 100).toFixed(2)}%`);
                }
                if (bonus.maxAmmo > 0) {
                    logger.buff(0, `최대 장탄수 +${(bonus.maxAmmo * 100).toFixed(1)}%`);
                }
            }
        }
        
        // 오버로드 효과
        const overloadBuffs = configManager.calculateOverloadBuffs();
        if (Object.values(overloadBuffs).some(v => v > 0)) {
            logger.buff(0, '=== 오버로드 장비 효과 ===');
            
            if (overloadBuffs.atkPercent > 0) {
                logger.buff(0, `공격력 증가 +${(overloadBuffs.atkPercent * 100).toFixed(2)}%`);
            }
            if (overloadBuffs.critRate > 0) {
                logger.buff(0, `크리티컬 확률 증가 +${(overloadBuffs.critRate * 100).toFixed(2)}%`);
            }
            if (overloadBuffs.critDamage > 0) {
                logger.buff(0, `크리티컬 피해량 증가 +${(overloadBuffs.critDamage * 100).toFixed(2)}%`);
            }
            if (overloadBuffs.accuracy > 0) {
                logger.buff(0, `명중률 증가 +${overloadBuffs.accuracy.toFixed(2)}`);
            }
            if (overloadBuffs.maxAmmo > 0) {
                logger.buff(0, `최대 장탄 수 증가 +${(overloadBuffs.maxAmmo * 100).toFixed(2)}%`);
            }
            if (overloadBuffs.eliteDamage > 0) {
                logger.buff(0, `우월코드 대미지 증가 +${(overloadBuffs.eliteDamage * 100).toFixed(2)}%`);
            }
        }
        
        // 큐브 효과
        if (config.simulation.cubeType && CUBE_DATA[config.simulation.cubeType]) {
            logger.buff(0, `${CUBE_DATA[config.simulation.cubeType].name} 장착`);
        }
        
        // 스쿼드 구성
        logger.buff(0, '=== 스쿼드 구성 ===');
        squad.forEach((charId, index) => {
            if (!charId) return;
            
            const character = characterLoader.createCharacter(charId);
            if (!character) return;
            
            const role = index === targetIndex ? ' (타겟)' : '';
            const burstInfo = character.burstPosition ? ` [${character.burstPosition}버스트]` : '';
            logger.buff(0, `${index + 1}. ${character.name}${role}${burstInfo}`);
        });
        
        // 설정
        logger.buff(0, `코어 크기: ${config.simulation.coreSize}`);
        logger.buff(0, `우월코드: ${config.simulation.eliteCode === 'yes' ? '적용' : '미적용'}`);
        logger.buff(0, `거리: ${config.simulation.distance}단계`);
    }
}

// 전역 전투 시스템
const combatSystem = new CombatSystem();

// 내보내기
window.CombatSystem = CombatSystem;
window.combatSystem = combatSystem;