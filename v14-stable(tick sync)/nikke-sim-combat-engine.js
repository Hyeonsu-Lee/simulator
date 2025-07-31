/* nikke-sim-combat-engine.js - 수정된 전투 엔진 */

class CombatEngine {
    constructor(dependencies) {
        // 의존성 주입
        this.squad = dependencies.squad || [];
        this.targetIndex = dependencies.targetIndex || 0;
        this.logger = dependencies.logger;
        this.config = dependencies.config || {};
        
        // 시스템 초기화
        this.burstManager = new BurstManager(() => this.squad);
        
        this.buffSystem = new BuffSystem({
            logger: this.logger,
            config: {
                overloadBuffs: this.config.overloadBuffs,
                collectionBonus: this.config.collectionBonus,
                cubeType: this.config.cubeType
            }
        });
        
        // 모든 캐릭터 버프 등록
        this.squad.forEach(character => {
            this.buffSystem.registerCharacter(character);
        });
        
        // 전투 상태
        this.context = this.createInitialContext();
        this.running = true;
        
        // DEBUG: 타겟 캐릭터 확인
        this.log(0, `[ENGINE] 타겟 캐릭터: ${this.squad[this.targetIndex]?.name}`, 'system');
    }
    
    createInitialContext() {
        return {
            time: 0,
            deltaTime: 0,
            squad: this.squad,
            targetIndex: this.targetIndex,
            cycle: -1,
            burstUsers: [],
            isFullBurst: false,
            distance: this.config.distance || 2,
            isEliteEnemy: this.config.eliteCode === 'yes',
            coreSize: parseInt(this.config.coreSize) || 30,
            collectionBonus: this.calculateCollectionBonus(),
            characterStates: new Map()
        };
    }
    
    calculateCollectionBonus() {
        const targetNikke = this.squad[this.targetIndex];
        if (!targetNikke) return { coreBonus: 0, chargeRatio: 0, damageMultiplier: 1, maxAmmo: 0 };
        
        const bonus = {
            coreBonus: 0,
            chargeRatio: 0,
            damageMultiplier: 1,
            maxAmmo: 0
        };
        
        switch(targetNikke.weaponType) {
            case 'AR':
                bonus.coreBonus = 0.1704;
                break;
            case 'SR':
            case 'RL':
                bonus.chargeRatio = 0.0947;
                break;
            case 'SG':
            case 'SMG':
                bonus.damageMultiplier = 1.0946;
                break;
            case 'MG':
                bonus.maxAmmo = 0.095;
                break;
        }
        
        return bonus;
    }
    
    async simulate(duration, speedMultiplier, updateCallback) {
        const frameDelay = Math.max(1, Math.floor(16 / speedMultiplier));
        let frameCount = 0;
        
        this.log(0, '전투 시작', 'buff');
        this.logInitialSettings();
        
        // 타겟 캐릭터 상태 초기화
        const targetChar = this.squad[this.targetIndex];
        const targetState = this.getOrCreateCharacterState(targetChar.id);
        
        // 초기 탄약 설정
        const staticMaxAmmoBonus = (this.config.overloadBuffs?.maxAmmo || 0) + 
                                  (this.context.collectionBonus.maxAmmo || 0);
        targetState.maxAmmo = Math.floor(targetChar.baseStats.baseAmmo * (1 + staticMaxAmmoBonus));
        targetState.currentAmmo = targetState.maxAmmo;
        targetChar.currentAmmo = targetState.currentAmmo;
        targetChar.maxAmmo = targetState.maxAmmo;
        
        // 첫 공격 시간 설정
        this.context.time = targetChar.baseStats.attackInterval;
        
        while (this.context.time < duration && this.running) {
            // 전투 루프
            // 1. 버스트 사이클 업데이트
            this.updateBurstCycle();
            
            // 2. 타겟 캐릭터 전투 처리
            const timeAdvanced = this.processTargetCombat();
            
            // 3. 시간 진행
            if (timeAdvanced > 0) {
                this.context.time += timeAdvanced;
            } else {
                // 대기 시간
                this.context.time += 0.1;
            }
            
            // UI 업데이트
            frameCount++;
            if (frameCount % Math.max(1, Math.floor(speedMultiplier / 10)) === 0) {
                updateCallback(this.getStats());
                await new Promise(resolve => setTimeout(resolve, frameDelay));
            }
        }
        
        // 최종 통계
        this.context.time = duration;
        const finalStats = this.getStats();
        updateCallback(finalStats);
        
        this.log(duration, 
            `[시뮬레이션 종료] 총 대미지: ${formatNumber(finalStats.totalDamage)}, ` +
            `DPS: ${formatNumber(finalStats.dps)}, ` +
            `크리티컬률: ${finalStats.critRate.toFixed(1)}%, ` +
            `총 발사수: ${finalStats.shotCount}`,
            'buff'
        );
        
        return finalStats;
    }
    
    updateBurstCycle() {
        const newCycle = Math.floor((this.context.time - BURST_START_TIME) / BURST_CYCLE_TIME);
        
        if (newCycle !== this.context.cycle && newCycle >= 0) {
            this.context.cycle = newCycle;
            
            // 버스트 사용자 가져오기
            const burstUsers = this.burstManager.getBurstUsers(this.context.time);
            this.context.burstUsers = burstUsers;
            this.context.isFullBurst = burstUsers.length === 3;
            
            // 버스트 로그
            this.logBurstCycle();
            
            // 버스트 스킬 활성화 로그
            this.context.burstUsers.forEach(user => {
                const burstSkill = user.getSkill('burst');
                if (burstSkill) {
                    this.log(this.context.time, 
                        `[${user.name}] ${burstSkill.name} 발동`,
                        'skill'
                    );
                }
            });
            
            // 새 사이클 시작 플래그
            this.context.newCycleStarted = true;
        } else {
            this.context.newCycleStarted = false;
        }
    }
    
    processTargetCombat() {
        const targetChar = this.squad[this.targetIndex];
        const targetState = this.getOrCreateCharacterState(targetChar.id);
        
        // 1. 캐릭터 상태 동기화
        targetChar.currentAmmo = targetState.currentAmmo;
        targetChar.isReloading = targetState.isReloading;
        
        // 2. 활성 액션 업데이트
        targetChar.updateActiveActions(this.context);
        
        // 3. 버프 계산 (루프당 1회)
        const buffs = this.buffSystem.calculateTotalBuffs({
            squad: this.squad,
            targetIndex: this.targetIndex,
            burstUsers: this.context.burstUsers,
            time: this.context.time,
            isFullBurst: this.context.isFullBurst,
            cycle: this.context.cycle,
            newCycleStarted: this.context.newCycleStarted
        });
        
        // 4. 탄환 충전 처리
        if (buffs.ammoCharge > 0 && this.context.newCycleStarted) {
            const chargeAmount = Math.floor(targetState.maxAmmo * buffs.ammoCharge);
            const beforeAmmo = targetState.currentAmmo;
            targetState.currentAmmo = Math.min(beforeAmmo + chargeAmount, targetState.maxAmmo);
            targetChar.currentAmmo = targetState.currentAmmo;
            
            if (beforeAmmo !== targetState.currentAmmo) {
                this.log(this.context.time,
                    `[${targetChar.name}] 탄환 충전: ${beforeAmmo} → ${targetState.currentAmmo} (+${chargeAmount})`,
                    'buff'
                );
            }
        }
        
        // 5. 재장전 체크
        if (targetState.currentAmmo <= 0) {
            // 재장전 처리
            const baseReloadTime = targetChar.baseStats.reloadTime;
            const modifiedReloadTime = baseReloadTime / (1 + buffs.reloadSpeed);
            
            // 현재 버프 기준 최대 탄창 계산
            const totalMaxAmmoBonus = buffs.maxAmmo;
            const newMaxAmmo = Math.floor(targetChar.baseStats.baseAmmo * (1 + totalMaxAmmoBonus));
            
            if (targetState.maxAmmo !== newMaxAmmo) {
                const oldMax = targetState.maxAmmo;
                targetState.maxAmmo = newMaxAmmo;
                targetChar.maxAmmo = newMaxAmmo;
                
                this.log(this.context.time,
                    `최대 탄창 변경: ${oldMax} → ${newMaxAmmo}`,
                    'buff'
                );
            }
            
            targetState.currentAmmo = targetState.maxAmmo;
            targetState.reloadCount++;
            targetChar.currentAmmo = targetState.currentAmmo;
            
            this.log(this.context.time, 
                `재장전 (${modifiedReloadTime.toFixed(3)}초, 탄창: ${targetState.currentAmmo}/${targetState.maxAmmo})`, 
                'reload'
            );
            
            return modifiedReloadTime;
        }
        
        // 6. 모든 액션 체크
        const actions = targetChar.checkActions({
            ...this.context,
            buffs,
            engine: this
        });
        
        // 7. 액션 실행
        let cancelNormalAttack = false;
        
        for (const { slot, skill, action } of actions) {
            this.log(this.context.time,
                `[${targetChar.name}] ${action.name} 발동 (${action.type})`,
                'skill'
            );
            
            // 액션 실행
            action.execute(this.context, targetChar, this);
            
            // 활성 액션 목록에 추가
            if (action.active && !targetChar.activeActions.includes(action)) {
                targetChar.activeActions.push(action);
            }
            
            if (action.shouldCancelNormalAttack()) {
                cancelNormalAttack = true;
            }
        }
        
        // 8. 일반 공격 (취소되지 않았다면)
        if (!cancelNormalAttack) {
            const damage = this.executeAttack(targetChar, targetState, buffs);
            
            targetState.totalDamage += damage;
            targetState.shotCount++;
            targetState.currentAmmo--;
            targetChar.currentAmmo = targetState.currentAmmo;
            targetState.lastAttackTime = this.context.time;
            
            // 다음 공격까지 시간
            const weaponParams = targetChar.getWeaponParams();
            const attackInterval = weaponParams.attackInterval / (1 + buffs.attackSpeed);
            
            return attackInterval;
        }
        
        // 액션만 실행하고 일반 공격 없음
        return 0.1; // 최소 시간 진행
    }
    
    executeAttack(character, state, buffs) {
        // 캐릭터에게 공격 정보 받기
        const attackInfo = character.getAttackInfo(state, buffs);
        
        // 대미지 계산
        const stats = character.getStatWithCoreAndLevel();
        const weaponParams = character.getWeaponParams();
        const spread = calculateSpreadDiameter(character.weaponType, buffs.accuracy);
        const coreHitRate = calculateCoreHitRate(spread, this.context.coreSize, character.weaponType);
        
        const pelletsThisShot = attackInfo.pelletsPerShot;
        
        let shotDamage = 0;
        let coreCount = 0;
        let critCount = 0;
        let pelletsHit = 0;
        
        const effectiveCritRate = buffs.critRate + (buffs.helmCritBonus || 0);
        
        for (let i = 0; i < pelletsThisShot; i++) {
            const isCrit = Math.random() < effectiveCritRate;
            const isCore = Math.random() < coreHitRate;
            
            const triggers = {
                crit: isCrit ? 1 : 0,
                core: isCore ? 1 : 0,
                distance: this.context.distance === this.getOptimalDistance(character.weaponType) ? 1 : 0,
                fullburst: this.context.isFullBurst ? 1 : 0,
                part: 0,
                penetration: character.attackModifiers?.penetration ? 1 : 0,
                dot: 0,
                defIgnore: 0,
                charge: 0,
                elite: this.context.isEliteEnemy ? 1 : 0,
                distributed: buffs.distributedDamage > 0 ? 1 : 0
            };
            
            const damage = calculateGeneralDamage(
                stats.atk,
                ENEMY_DEF,
                weaponParams.weaponCoef,
                0,
                buffs,
                triggers,
                this.context.collectionBonus
            );
            
            shotDamage += damage;
            pelletsHit++;
            
            if (isCrit) { 
                state.critCount++; 
                critCount++; 
            }
            if (isCore) { 
                state.coreHitCount++; 
                coreCount++; 
            }
            state.totalPellets++;
        }
        
        // 샷건은 펠릿당 대미지 분할
        shotDamage = Math.round(shotDamage / pelletsThisShot);
        
        // 공격 완료 통지
        character.onAttackComplete({
            ...attackInfo,
            pelletsHit: pelletsHit,
            damage: shotDamage,
            context: this.context
        });
        
        // 로그
        let logMsg = `발사 #${state.shotCount + 1}`;
        if (attackInfo.isSpecialAttack) {
            logMsg += ` [특수탄]`;
        }
        logMsg += ` - `;
        
        if (pelletsThisShot > 1) {
            logMsg += `펠릿 ${pelletsThisShot}개 중 ${coreCount}개 코어히트`;
            if (critCount > 0) logMsg += `, 크리티컬 ${critCount}회`;
        } else {
            logMsg += coreCount > 0 ? '코어히트' : '일반히트';
            if (critCount > 0) logMsg += ' (크리티컬!)';
        }
        logMsg += `, 대미지: ${formatNumber(shotDamage)}`;
        
        this.log(this.context.time, logMsg, critCount > 0 ? 'crit' : 'damage');
        
        return shotDamage;
    }
    
    /**
     * 즉시 대미지 적용 (액션에서 호출)
     */
    applyInstantDamage(source, damage, skillName) {
        const targetState = this.context.characterStates.get(source.id);
        if (targetState) {
            targetState.totalDamage = (targetState.totalDamage || 0) + damage;
        }
        
        this.log(this.context.time,
            `[${source.name}] ${skillName} 대미지: ${formatNumber(damage)}`,
            'skill'
        );
    }
    
    getOptimalDistance(weaponType) {
        const distances = {
            'SG': 1, 'SMG': 1,
            'AR': 2, 'MG': 2,
            'SR': 3, 'RL': 3
        };
        return distances[weaponType] || 2;
    }
    
    getOrCreateCharacterState(characterId) {
        if (!this.context.characterStates.has(characterId)) {
            this.context.characterStates.set(characterId, {
                // 공격 관련
                shotCount: 0,
                currentAmmo: 0,
                maxAmmo: 0,
                isReloading: false,
                reloadEndTime: 0,
                reloadCount: 0,
                lastAttackTime: 0,
                
                // 대미지 통계
                totalDamage: 0,
                critCount: 0,
                coreHitCount: 0,
                totalPellets: 0,
                
                // 탄환 충전
                ammoChargedThisCycle: false,
                lastCycle: -1
            });
        }
        return this.context.characterStates.get(characterId);
    }
    
    logBurstCycle() {
        const users = this.context.burstUsers;
        
        if (users.length === 0) {
            this.log(this.context.time, 
                `[버스트 사이클 ${this.context.cycle}] 버스트 사용자 없음 [미완성]`,
                'buff'
            );
            return;
        }
        
        const userNames = users.map((user, index) => {
            const position = user.burstPosition;
            return `${position}버: ${user.name}`;
        }).join(', ');
        
        const status = this.context.isFullBurst ? ' [풀버스트]' : ' [미완성]';
        
        this.log(this.context.time, 
            `[버스트 사이클 ${this.context.cycle}] ${userNames}${status}`,
            'buff'
        );
    }
    
    logInitialSettings() {
        // 소장품 효과
        const bonus = this.context.collectionBonus;
        const targetNikke = this.squad[this.targetIndex];
        
        if (Object.keys(bonus).some(k => bonus[k] > 0 && bonus[k] !== 1)) {
            this.log(0, '=== 소장품 효과 ===', 'buff');
            this.log(0, `무기 타입: ${WEAPON_PARAMS[targetNikke.weaponType]?.name || targetNikke.weaponType}`, 'buff');
            
            if (bonus.coreBonus > 0) {
                this.log(0, `코어 대미지 +${(bonus.coreBonus * 100).toFixed(2)}%`, 'buff');
            }
            if (bonus.chargeRatio > 0) {
                this.log(0, `차지 대미지 배율 +${(bonus.chargeRatio * 100).toFixed(2)}%`, 'buff');
            }
            if (bonus.damageMultiplier > 1) {
                this.log(0, `최종 대미지 x${bonus.damageMultiplier}`, 'buff');
            }
            if (bonus.maxAmmo > 0) {
                this.log(0, `최대 장탄수 +${(bonus.maxAmmo * 100).toFixed(1)}%`, 'buff');
            }
        }
        
        // 오버로드 효과
        if (this.config.overloadBuffs) {
            this.log(0, '=== 오버로드 장비 효과 ===', 'buff');
            const buffs = this.config.overloadBuffs;
            
            if (buffs.atkPercent > 0) {
                this.log(0, `공격력 증가 +${(buffs.atkPercent * 100).toFixed(2)}%`, 'buff');
            }
            if (buffs.critRate > 0) {
                this.log(0, `크리티컬 확률 증가 +${(buffs.critRate * 100).toFixed(2)}%`, 'buff');
            }
            if (buffs.critDamage > 0) {
                this.log(0, `크리티컬 피해량 증가 +${(buffs.critDamage * 100).toFixed(2)}%`, 'buff');
            }
            if (buffs.accuracy > 0) {
                this.log(0, `명중률 증가 +${buffs.accuracy.toFixed(2)}`, 'buff');
            }
            if (buffs.maxAmmo > 0) {
                this.log(0, `최대 장탄 수 증가 +${(buffs.maxAmmo * 100).toFixed(2)}%`, 'buff');
            }
            if (buffs.eliteDamage > 0) {
                this.log(0, `우월코드 대미지 증가 +${(buffs.eliteDamage * 100).toFixed(2)}%`, 'buff');
            }
        }
        
        // 스쿼드 구성
        this.log(0, '=== 스쿼드 구성 ===', 'buff');
        this.squad.forEach((nikke, index) => {
            const role = index === this.targetIndex ? ' (타겟)' : '';
            const burstInfo = nikke.burstPosition ? ` [${nikke.burstPosition}버스트]` : '';
            this.log(0, `${index + 1}. ${nikke.name}${role}${burstInfo}`, 'buff');
        });
        
        // 설정
        if (this.config.cubeType && CUBE_DATA[this.config.cubeType]) {
            this.log(0, `${CUBE_DATA[this.config.cubeType].name} 장착`, 'buff');
        }
        
        this.log(0, `코어 크기: ${this.context.coreSize}`, 'buff');
        this.log(0, `우월코드: ${this.context.isEliteEnemy ? '적용' : '미적용'}`, 'buff');
        this.log(0, `거리: ${this.context.distance}단계`, 'buff');
    }
    
    log(time, message, type) {
        if (this.logger) {
            this.logger.log(time, message, type);
        }
    }
    
    getStats() {
        const targetState = this.context.characterStates.get(this.squad[this.targetIndex].id);
        if (!targetState) {
            return {
                time: this.context.time,
                totalDamage: 0,
                dps: 0,
                shotCount: 0,
                coreHitRate: 0,
                critRate: 0,
                reloadCount: 0,
                skill1Count: 0,
                coreHits: 0,
                critHits: 0,
                totalPellets: 0
            };
        }
        
        const dps = Math.floor(targetState.totalDamage / Math.max(this.context.time, 1));
        const coreHitRate = (targetState.coreHitCount / Math.max(targetState.totalPellets, 1)) * 100;
        const critRate = (targetState.critCount / Math.max(targetState.totalPellets, 1)) * 100;
        
        // 스킬1 카운트는 캐릭터에서 가져오기
        const targetChar = this.squad[this.targetIndex];
        const skill1Count = targetChar.getSkillActivationCount ? targetChar.getSkillActivationCount('skill1') : 0;
        
        return {
            time: this.context.time,
            totalDamage: targetState.totalDamage,
            dps: dps,
            shotCount: targetState.shotCount,
            coreHitRate: coreHitRate,
            critRate: critRate,
            reloadCount: targetState.reloadCount,
            skill1Count: skill1Count,
            coreHits: targetState.coreHitCount,
            critHits: targetState.critCount,
            totalPellets: targetState.totalPellets
        };
    }
    
    stop() {
        this.running = false;
    }
}

// CombatSimulator 호환성 래퍼
class CombatSimulator {
    constructor(dependencies) {
        this.engine = new CombatEngine({
            squad: [dependencies.targetNikke],
            targetIndex: 0,
            logger: {
                log: dependencies.log
            },
            config: dependencies.config
        });
        
        this.targetNikke = dependencies.targetNikke;
        this.calculateBuffs = dependencies.calculateBuffs;
        this.log = dependencies.log;
        this.config = dependencies.config;
        this.state = this.engine.context.characterStates.get(dependencies.targetNikke.id) || {};
        this.state.running = true;
    }
    
    async simulate(duration, speedMultiplier, updateCallback) {
        return this.engine.simulate(duration, speedMultiplier, updateCallback);
    }
    
    stop() {
        this.engine.stop();
        this.state.running = false;
    }
}