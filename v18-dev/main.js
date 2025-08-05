// main.js - 메인 애플리케이션 (하이브리드 방식)

class SimulationController {
    constructor(dependencies) {
        this.eventBus = dependencies.eventBus;
        this.mediator = dependencies.mediator;
        this.stateStore = dependencies.stateStore;
        this.timeManager = dependencies.timeManager;
        this.logger = dependencies.logger;
        this.characterLoader = dependencies.characterLoader;
        this.configManager = dependencies.configManager;
        this.combatSystem = dependencies.combatSystem;
        this.buffSystem = dependencies.buffSystem;
        this.skillSystem = dependencies.skillSystem;
        this.damageCalculator = dependencies.damageCalculator;
        this.uiController = dependencies.uiController;
        this.simulationView = dependencies.simulationView;
        
        this.multiRunResults = [];
        this.currentRun = 0;
        this.totalRuns = 1;
        
        // 프레임 루프 관련 추가
        this.frameLoopId = null;
        this.lastFrameTime = 0;
        this.runConfig = null;
    }
    
    /**
     * 초기화
     */
    async initialize() {
        // 캐릭터 데이터 로드
        await this.characterLoader.loadAll();
        
        // UI 초기화 (캐릭터 로드 완료 후)
        await this.uiController.initialize();
        
        // 초기 상태 설정
        this.setupInitialState();
        
        // 이벤트 리스너
        this.setupEventListeners();
        
        console.log('Simulation Controller initialized');
    }
    
    /**
     * 초기 상태 설정 (async 제거)
     */
    setupInitialState() {
        console.log('[SimulationController] Setting up initial state');
        
        // 캐릭터 상태 초기화
        const squad = this.configManager.config.squad.members;
        console.log('[SimulationController] Squad from config:', squad);
        
        squad.forEach((characterId, index) => {
            if (!characterId) return;
            
            console.log(`[SimulationController] Initializing character ${characterId} at index ${index}`);
            
            const charConfig = this.configManager.config.characters.get(characterId) || {
                level: 200,
                coreLevel: 10,
                skills: { skill1: 10, skill2: 10, burst: 10 }
            };
            
            // 캐릭터 생성
            const character = this.characterLoader.create(characterId, {
                level: charConfig.level,
                coreLevel: charConfig.coreLevel,
                skillLevels: charConfig.skills
            });
            
            if (character) {
                console.log(`[SimulationController] Created character:`, character);
                
                // 캐릭터 상태 생성
                const characterState = {
                    id: characterId,
                    index: index,
                    level: charConfig.level,
                    coreLevel: charConfig.coreLevel,
                    skillLevels: charConfig.skills,
                    shotsFired: 0,
                    totalDamage: 0,
                    critCount: 0,
                    coreHitCount: 0,
                    totalPellets: 0,
                    reloadCount: 0,
                    skill1Count: 0,
                    currentAmmo: character.baseStats.baseAmmo,
                    maxAmmo: character.baseStats.baseAmmo,
                    isReloading: false,
                    reloadEndTime: 0,
                    activeBuffs: new Map(),
                    passiveSkillsApplied: false
                };
                
                console.log(`[SimulationController] Character state for ${characterId}:`, characterState);
                
                this.stateStore.set(`combat.characters.${characterId}`, characterState);
            } else {
                console.error(`[SimulationController] Failed to create character ${characterId}`);
            }
        });
        
        // 전체 combat 상태 확인
        console.log('[SimulationController] Combat state after initialization:', 
            this.stateStore.get('combat'));
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        this.eventBus.on(Events.START, () => this.startSimulation());
        this.eventBus.on(Events.STOP, () => this.stopSimulation());
        this.eventBus.on(Events.RUN_COMPLETE, (event) => this.handleRunComplete(event));
        this.eventBus.on(Events.SIMULATION_COMPLETE, (event) => this.handleSimulationComplete(event));
    }
    
    /**
     * 시뮬레이션 시작
     */
    async startSimulation() {
        try {
            console.log('[SimulationController] Starting simulation');
            
            // 초기화
            this.multiRunResults = [];
            this.totalRuns = this.configManager.config.simulation.runCount;
            
            this.logger.clear();
            this.simulationView.clearResults();
            
            // 멀티런 처리
            for (this.currentRun = 0; this.currentRun < this.totalRuns; this.currentRun++) {
                if (!this.timeManager.running && this.currentRun > 0) break;
                
                if (this.totalRuns > 1) {
                    this.logger.buff(0, `===== 시뮬레이션 ${this.currentRun + 1}/${this.totalRuns} 시작 =====`);
                }
                
                console.log(`[SimulationController] Run ${this.currentRun + 1}/${this.totalRuns} starting`);
                
                // 시스템 리셋
                this.resetSystems();
                
                // 초기 상태 재설정
                this.setupInitialState();
                
                // 시스템 초기화
                this.skillSystem.initialize();
                
                // 정적 버프 초기화
                const staticBuffs = {
                    ...this.configManager.calculateOverloadBuffs(),
                    ...this.getCubeBuffs()
                };
                
                this.stateStore.set('buffs.static', staticBuffs);
                
                console.log('[SimulationController] Static buffs set:', staticBuffs);
                
                // 전투 시작
                this.combatSystem.start();
                
                // 시뮬레이션 실행 (수정된 부분)
                this.runConfig = this.timeManager.run(
                    this.configManager.config.simulation.duration,
                    this.configManager.config.simulation.speed,
                    (currentTime) => {
                        this.eventBus.emit(Events.PROGRESS_UPDATE, {
                            current: currentTime,
                            total: this.configManager.config.simulation.duration
                        });
                    }
                );
                
                // 프레임 루프 시작
                this.lastFrameTime = performance.now();
                await this.runFrameLoop();
                
                console.log(`[SimulationController] Run ${this.currentRun + 1} completed`);
                
                // 실행 완료
                const result = this.collectResults();
                this.multiRunResults.push(result);
                
                this.eventBus.emit(Events.RUN_COMPLETE, { 
                    run: this.currentRun + 1,
                    result 
                });
                
                // 다음 실행 전 대기
                if (this.currentRun < this.totalRuns - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // 전체 완료
            this.eventBus.emit(Events.SIMULATION_COMPLETE, {
                results: this.multiRunResults
            });
            
        } catch (error) {
            console.error('Simulation error:', error);
            this.stopSimulation();
        }
    }
    
    /**
     * 프레임 루프
     */
    runFrameLoop() {
        return new Promise((resolve) => {
            const frameLoop = () => {
                const currentTime = performance.now();
                const deltaTime = (currentTime - this.lastFrameTime) / 1000; // 초 단위
                this.lastFrameTime = currentTime;
                
                // 프레임 처리
                const continueRunning = this.runConfig.processFrame(deltaTime);
                
                if (continueRunning && this.timeManager.running) {
                    this.frameLoopId = requestAnimationFrame(frameLoop);
                } else {
                    // 완료
                    if (this.frameLoopId) {
                        cancelAnimationFrame(this.frameLoopId);
                        this.frameLoopId = null;
                    }
                    resolve();
                }
            };
            
            frameLoop();
        });
    }
    
    /**
     * 시뮬레이션 중지
     */
    stopSimulation() {
        console.log('[SimulationController] Stopping simulation');
        
        this.timeManager.stop();
        this.combatSystem.stop();
        
        // 프레임 루프 중지
        if (this.frameLoopId) {
            cancelAnimationFrame(this.frameLoopId);
            this.frameLoopId = null;
        }
    }
    
    /**
     * 시스템 리셋
     */
    resetSystems() {
        this.timeManager.reset();
        this.stateStore.reset();
        
        // 전투 상태 초기화
        this.stateStore.set('combat', {
            time: 0,
            targetIndex: this.configManager.config.squad.targetIndex,
            distance: this.configManager.config.simulation.distance,
            burstStartTime: 2.43,
            burstCycleTime: 20,
            started: false,
            characters: {}
        });
        
        // 버스트 상태 초기화
        this.stateStore.set('burst', {
            currentCycle: 0,
            burstStarted: false,
            burst1User: null,
            burst2User: null,
            burst3User: null,
            isFullBurst: false,
            lastBurstTimes: new Map()
        });
        
        // 버프 상태 초기화
        this.stateStore.set('buffs', {
            static: {},
            dynamic: new Map()
        });
    }
    
    /**
     * 결과 수집
     */
    collectResults() {
        const targetIndex = this.configManager.config.squad.targetIndex;
        const targetId = this.configManager.config.squad.members[targetIndex];
        const targetState = this.stateStore.get(`combat.characters.${targetId}`);
        const combat = this.stateStore.get('combat');
        
        return {
            time: combat.time,
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
        const cubeType = this.configManager.config.simulation.cubeType;
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
        this.simulationView.showResults(event.data.results);
        
        // 최종 로그
        const results = event.data.results;
        const avgDPS = Math.floor(results.reduce((sum, r) => sum + r.dps, 0) / results.length);
        
        this.logger.buff(this.timeManager.currentTime,
            `[시뮬레이션 완료] 평균 DPS: ${formatNumber(avgDPS)}`
        );
    }
}

/**
 * 유틸리티 함수
 */
function formatNumber(num) {
    return num.toLocaleString('ko-KR');
}

/**
 * 메인 초기화 함수
 */
async function initializeApplication() {
    console.log('Initializing Nikke Simulator...');
    
    try {
        // 1. 보안 코드
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        
        // 2. 의존성 컨테이너 생성
        const container = new DependencyContainer();
        
        // 3. 이벤트 버스 생성 (전역)
        window.eventBus = new EventBus();
        
        // 4. StateStore의 초기 상태 가져오기
        const initialState = typeof window.initialState !== 'undefined' ? window.initialState : {
            combat: {
                time: 0,
                targetIndex: 0,
                distance: 2,
                burstStartTime: 2.43,
                burstCycleTime: 20,
                started: false,
                characters: {}
            },
            burst: {
                currentCycle: 0,
                burstStarted: false,
                burst1User: null,
                burst2User: null,
                burst3User: null,
                isFullBurst: false,
                lastBurstTimes: new Map()
            },
            buffs: {
                static: {},
                dynamic: new Map()
            }
        };
        
        // 5. 코어 시스템 초기화
        const stateStore = new StateStore(initialState);
        const timeManager = new TimeManager();
        const logger = new Logger();
        
        // 전역 노출 (TimeManager에서 사용)
        window.timeManager = timeManager;
        
        // 6. 인프라 초기화
        const characterLoader = new CharacterLoader();
        const configManager = new ConfigManager();
        
        // 7. 미디에이터 초기화
        const mediator = new EventMediator(window.eventBus);
        
        // 8. 도메인 시스템 생성 (의존성 주입)
        const damageCalculator = new DamageCalculator({
            eventBus: window.eventBus,
            mediator
        });
        
        const buffSystem = new BuffSystem({
            eventBus: window.eventBus,
            mediator,
            stateStore,
            timeManager,
            characterLoader
        });
        
        const skillSystem = new SkillSystem({
            eventBus: window.eventBus,
            mediator,
            stateStore,
            timeManager,
            logger,
            characterLoader
        });
        
        const combatSystem = new CombatSystem({
            eventBus: window.eventBus,
            mediator,
            stateStore,
            timeManager,
            logger,
            characterLoader,
            configManager
        });
        
        // 9. UI 시스템 생성 (의존성 주입)
        const simulationView = new SimulationView();
        
        
        const uiController = new UIController({
            eventBus: window.eventBus,
            stateStore,
            characterLoader,
            configManager,
            logger
        });
        
        // 10. 시뮬레이션 컨트롤러 생성
        const simulationController = new SimulationController({
            eventBus: window.eventBus,
            mediator,
            stateStore,
            timeManager,
            logger,
            characterLoader,
            configManager,
            combatSystem,
            buffSystem,
            skillSystem,
            damageCalculator,
            uiController,
            simulationView
        });
        
        // 8. 의존성 컨테이너에 등록
        container.register('eventBus', window.eventBus);
        container.register('mediator', mediator);
        container.register('stateStore', stateStore);
        container.register('timeManager', timeManager);
        container.register('logger', logger);
        container.register('characterLoader', characterLoader);
        container.register('configManager', configManager);
        container.register('combatSystem', combatSystem);
        container.register('buffSystem', buffSystem);
        container.register('skillSystem', skillSystem);
        container.register('damageCalculator', damageCalculator);
        container.register('uiController', uiController);
        container.register('simulationView', simulationView);
        container.register('simulationController', simulationController);
        
        // 9. 이벤트 레코더 생성 (선택적)
        const eventRecorder = new EventRecorder(window.eventBus);
        container.register('eventRecorder', eventRecorder);
        
        // 10. 순환 의존성 검사 (hasCircularDependency가 없을 수 있음)
        if (container.hasCircularDependency && container.hasCircularDependency()) {
            throw new Error('Circular dependency detected!');
        }
        
        // 11. 시뮬레이션 컨트롤러 초기화
        await simulationController.initialize();
        
        // 12. 전역 함수 노출 (하위 호환성)
        window.startSimulation = () => window.eventBus.emit(Events.START);
        window.stopSimulation = () => window.eventBus.emit(Events.STOP);
        window.downloadFullLog = () => logger.download();
        
        // 디버그용 컨테이너 노출 (프로덕션에서는 제거)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            window.container = container;
            window.eventRecorder = eventRecorder;
        }
        
        // 종료 시 리소스 정리
        window.addEventListener('beforeunload', () => {
            // 모든 시스템 정리
            container.list().forEach(serviceName => {
                const service = container.get(serviceName);
                if (service && typeof service.destroy === 'function') {
                    service.destroy();
                }
            });
        });
        
        console.log('Nikke Simulator ready');
        
    } catch (error) {
        console.error('Failed to initialize:', error);
        alert('시뮬레이터 초기화 실패: ' + error.message);
    }
}

// 페이지 로드 완료 후 초기화
window.addEventListener('DOMContentLoaded', initializeApplication);