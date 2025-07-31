// main.js - 메인 애플리케이션

class SimulationController {
    constructor() {
        this.multiRunResults = [];
        this.currentRun = 0;
        this.totalRuns = 1;
    }
    
    /**
     * 초기화
     */
    async initialize() {
        // 캐릭터 데이터 로드
        await characterLoader.loadAll();
        
        // UI 초기화 (캐릭터 로드 완료 후)
        await uiController.initialize();
        
        // 초기 상태 설정
        this.setupInitialState();
        
        // 이벤트 리스너
        this.setupEventListeners();
        
        console.log('Simulation Controller initialized');
    }
    
    /**
     * 초기 상태 설정
     */
    setupInitialState() {
        // 캐릭터 상태 초기화
        const squad = configManager.config.squad.members;
        squad.forEach((characterId, index) => {
            if (!characterId) return;
            
            const charConfig = configManager.config.characters.get(characterId) || {
                level: 200,
                coreLevel: 10,
                customAtk: null
            };
            
            const character = characterLoader.createCharacter(characterId, charConfig);
            
            if (character) {
                const staticBuffs = {
                    ...configManager.calculateOverloadBuffs(),
                    ...this.getCubeBuffs()
                };
                const buffs = buffSystem.calculateTotalBuffs(characterId, staticBuffs);
                
                const collectionBonus = damageCalculator.getCollectionBonus(character.weaponType);
                const maxAmmo = Math.floor(character.baseStats.baseAmmo * 
                    (1 + buffs.maxAmmo + collectionBonus.maxAmmo));
                
                stateStore.set(`combat.characters.${characterId}`, {
                    id: characterId,
                    characterSpec: characterId,
                    currentAmmo: maxAmmo,
                    maxAmmo: maxAmmo,
                    attackCount: 0,
                    shotsFired: 0,
                    pelletsHit: 0,
                    totalDamage: 0,
                    coreHitCount: 0,
                    critCount: 0,
                    totalPellets: 0,
                    reloadCount: 0,
                    skill1Count: 0,
                    replaceAttack: null
                });
            }
        });
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        eventBus.on(Events.START, () => this.startSimulation());
        eventBus.on(Events.STOP, () => this.stopSimulation());
        eventBus.on(Events.RUN_COMPLETE, (event) => this.handleRunComplete(event));
        eventBus.on(Events.SIMULATION_COMPLETE, (event) => this.handleSimulationComplete(event));
    }
    
    /**
     * 시뮬레이션 시작
     */
    async startSimulation() {
        try {
            // 초기화
            this.multiRunResults = [];
            this.totalRuns = configManager.config.simulation.runCount;
            
            logger.clear();
            simulationView.clearResults();
            
            // 멀티런 처리
            for (this.currentRun = 0; this.currentRun < this.totalRuns; this.currentRun++) {
                if (!timeManager.running && this.currentRun > 0) break;
                
                if (this.totalRuns > 1) {
                    logger.buff(0, `===== 시뮬레이션 ${this.currentRun + 1}/${this.totalRuns} 시작 =====`);
                }
                
                // 시스템 리셋
                this.resetSystems();
                
                // 초기 상태 재설정
                this.setupInitialState();
                
                // 시스템 초기화
                skillSystem.initialize();
                
                // 정적 버프 초기화
                const staticBuffs = {
                    ...configManager.calculateOverloadBuffs(),
                    ...this.getCubeBuffs()
                };
                
                stateStore.set('buffs.static', staticBuffs);
                
                // 전투 시작
                combatSystem.start();
                
                // 시뮬레이션 실행
                await timeManager.run(
                    configManager.config.simulation.duration,
                    configManager.config.simulation.speed,
                    (currentTime) => {
                        eventBus.emit(Events.PROGRESS_UPDATE, {
                            current: currentTime,
                            total: configManager.config.simulation.duration
                        });
                    }
                );
                
                // 실행 완료
                const result = this.collectResults();
                this.multiRunResults.push(result);
                
                eventBus.emit(Events.RUN_COMPLETE, { 
                    run: this.currentRun + 1,
                    result 
                });
                
                // 다음 실행 전 대기
                if (this.currentRun < this.totalRuns - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // 전체 완료
            eventBus.emit(Events.SIMULATION_COMPLETE, {
                results: this.multiRunResults
            });
            
        } catch (error) {
            console.error('Simulation error:', error);
            alert(`시뮬레이션 오류: ${error.message}`);
        } finally {
            simulationView.setSimulationRunning(false);
        }
    }
    
    /**
     * 시뮬레이션 중지
     */
    stopSimulation() {
        timeManager.stop();
        combatSystem.stop();
    }
    
    /**
     * 시스템 리셋
     */
    resetSystems() {
        timeManager.reset();
        buffSystem.reset();
        skillSystem.reset();
        
        // 상태 리셋
        stateStore.update(state => {
            state.combat = {
                time: 0,
                running: false,
                characters: {},
                globalCounters: { bulletsConsumed: 0 }
            };
            state.burst = {
                cycle: 0,
                ready: false,
                users: [],
                fullBurst: false,
                cooldowns: {}
            };
            state.buffs = {
                active: {},
                static: {}
            };
            return state;
        });
    }
    
    /**
     * 결과 수집
     */
    collectResults() {
        const combat = stateStore.get('combat');
        const targetIndex = stateStore.get('squad.targetIndex');
        const targetId = stateStore.get('squad.members')[targetIndex];
        const targetState = combat.characters[targetId];
        
        if (!targetState) {
            return {
                totalDamage: 0,
                dps: 0,
                shotCount: 0,
                coreHitRate: 0,
                critRate: 0,
                reloadCount: 0,
                skill1Count: 0,
                totalPellets: 0
            };
        }
        
        return {
            totalDamage: targetState.totalDamage,
            dps: combat.time > 0 ? Math.floor(targetState.totalDamage / combat.time) : 0,
            shotCount: targetState.shotsFired,
            coreHitRate: targetState.totalPellets > 0 ? 
                (targetState.coreHitCount / targetState.totalPellets * 100) : 0,
            critRate: targetState.totalPellets > 0 ? 
                (targetState.critCount / targetState.totalPellets * 100) : 0,
            reloadCount: targetState.reloadCount,
            skill1Count: targetState.skill1Count || 0,
            totalPellets: targetState.totalPellets
        };
    }
    
    /**
     * 큐브 버프 가져오기
     */
    getCubeBuffs() {
        const cubeType = configManager.config.simulation.cubeType;
        if (!cubeType || !CUBE_DATA[cubeType]) {
            return {};
        }
        
        return CUBE_DATA[cubeType].effects;
    }
    
    /**
     * 실행 완료 핸들러
     */
    handleRunComplete(event) {
        console.log(`Run ${event.data.run} complete:`, event.data.result);
    }
    
    /**
     * 시뮬레이션 완료 핸들러
     */
    handleSimulationComplete(event) {
        simulationView.showResults(event.data.results);
        
        // 최종 로그
        const results = event.data.results;
        const avgDPS = Math.floor(results.reduce((sum, r) => sum + r.dps, 0) / results.length);
        
        logger.buff(timeManager.currentTime,
            `[시뮬레이션 완료] 평균 DPS: ${formatNumber(avgDPS)}`,
            'buff'
        );
    }
}

// 전역 컨트롤러
const simulationController = new SimulationController();

// 페이지 로드 완료 후 초기화
window.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Nikke Simulator...');
    
    try {
        // 보안 코드
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        
        // 초기화
        await simulationController.initialize();
        
        console.log('Nikke Simulator ready');
    } catch (error) {
        console.error('Failed to initialize:', error);
        alert('시뮬레이터 초기화 실패: ' + error.message);
    }
});

// 기존 호환성을 위한 전역 함수
window.startSimulation = () => eventBus.emit(Events.START);
window.stopSimulation = () => eventBus.emit(Events.STOP);
window.downloadFullLog = () => logger.download();

// 전역 노출
window.simulationController = simulationController;