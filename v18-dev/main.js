// main.js - v18 하이브리드 메인 진입점

class SimulationController {
    constructor(dependencies = {}) {
        // 의존성 주입
        Object.assign(this, dependencies);
        
        // 프레임 루프 관련
        this.frameLoopId = null;
        this.lastFrameTime = 0;
        
        // 이벤트 핸들러 설정
        this.setupEventListeners();
    }
    
    /**
     * 초기 상태 설정
     */
    setupInitialState() {
        console.log('[SimulationController] Setting up initial state');
        
        // 현재 설정된 스쿼드 가져오기
        const squad = this.configManager.config.squad.members;
        const targetIndex = this.configManager.config.squad.targetIndex;
        
        console.log('[SimulationController] Squad:', squad);
        console.log('[SimulationController] Target index:', targetIndex);
        
        // 스쿼드 상태 설정
        this.stateStore.set('squad', {
            members: squad,
            targetIndex: targetIndex
        });
        
        // 전투 상태 설정
        this.stateStore.set('combat', {
            time: 0,
            targetIndex: targetIndex,
            distance: this.configManager.config.simulation.distance,
            burstStartTime: 2.43,
            burstCycleTime: 20,
            started: false,
            characters: {},
            globalCounters: {
                bulletsConsumed: 0
            }
        });
        
        // 버스트 상태 설정
        this.stateStore.set('burst', {
            currentCycle: 0,
            burstStarted: false,
            burst1User: null,
            burst2User: null,
            burst3User: null,
            isFullBurst: false,
            lastBurstTimes: new Map(),
            cooldowns: new Map()  // cooldowns 추가
        });
        
        // 버프 상태 설정
        this.stateStore.set('buffs', {
            static: {},
            dynamic: new Map()
        });
        
        // 각 캐릭터 초기화
        squad.forEach((characterId, index) => {
            if (!characterId) return;
            
            // 캐릭터 설정 가져오기
            const charConfig = this.configManager.config.characters[characterId] || {
                level: 200,
                coreLevel: 10,
                skills: { skill1: 10, skill2: 10, burst: 10 }
            };
            
            // 캐릭터 생성 - createCharacter 메서드 사용
            const character = this.characterLoader.createCharacter(characterId, {
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
                    passiveSkillsApplied: false,
                    attackCount: 0  // attackCount 추가
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
        this.eventBus.on(Events.RESET, () => this.resetSystems());
        this.eventBus.on(Events.COMPLETE, (event) => this.handleComplete(event));
    }
    
    /**
     * 시뮬레이션 시작
     */
    async startSimulation() {
        console.log('[SimulationController] Starting simulation');
        
        try {
            // 시스템 리셋
            this.resetSystems();
            
            // 초기 상태 설정
            this.setupInitialState();
            
            // UI 초기화
            this.simulationView.clearResults();
            this.simulationView.setSimulationRunning(true);
            
            // 전투 시스템 시작
            this.combatSystem.start();
            
            // 시뮬레이션 설정
            const duration = this.configManager.config.simulation.duration || 30;
            const speed = this.configManager.config.simulation.speed || 1;
            
            // TimeManager 실행 (하이브리드 모드)
            const runConfig = this.timeManager.run(duration, speed, (currentTime) => {
                // 프로그레스 업데이트
                if (Math.floor(currentTime * 10) % 10 === 0) {
                    this.updateProgress(currentTime, duration);
                }
            });
            
            // 프레임 루프 시작
            await this.runFrameLoop(runConfig);
            
            // 시뮬레이션 완료
            console.log('[SimulationController] Simulation completed');
            this.handleSimulationComplete();
            
        } catch (error) {
            console.error('[SimulationController] Simulation error:', error);
            this.eventBus.emit(Events.ERROR, { error });
        }
    }
    
    /**
     * 프레임 루프 실행
     */
    async runFrameLoop(runConfig) {
        return new Promise((resolve) => {
            this.lastFrameTime = performance.now();
            
            const frameLoop = () => {
                const currentFrameTime = performance.now();
                const deltaTime = (currentFrameTime - this.lastFrameTime) / 1000;
                this.lastFrameTime = currentFrameTime;
                
                // TimeManager 프레임 처리
                const shouldContinue = runConfig.processFrame(deltaTime);
                
                if (shouldContinue) {
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
            characters: {},
            globalCounters: {
                bulletsConsumed: 0
            }
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
            skill1Count: targetState.skill1Count
        };
    }
    
    /**
     * 시뮬레이션 완료 처리
     */
    handleSimulationComplete() {
        const results = this.collectResults();
        console.log('[SimulationController] Results:', results);
        
        // 결과 화면 렌더링
        this.simulationView.showResults([results]);
        this.simulationView.setSimulationRunning(false);
        
        // 완료 이벤트
        this.eventBus.emit(Events.SIMULATION_COMPLETE, { results });
    }
    
    /**
     * 완료 이벤트 핸들러
     */
    handleComplete(event) {
        console.log('[SimulationController] Simulation complete event received');
    }
    
    /**
     * 진행률 업데이트
     */
    updateProgress(currentTime, duration) {
        const progress = Math.min((currentTime / duration) * 100, 100);
        this.simulationView.updateProgress(currentTime, duration);
    }
}

// DOMContentLoaded 이벤트
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Main] Initializing...');
    
    try {
        // 1. 보안 코드
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        
        // 2. 의존성 컨테이너 생성
        const container = new DependencyContainer();
        
        // 3. 이벤트 버스 생성
        window.eventBus = new EventBus();
        
        // Events가 정의되어 있는지 확인
        console.log('[Main] Events.START:', Events.START);
        console.log('[Main] Events available:', typeof Events !== 'undefined');
        
        // 4. 초기 상태 정의
        const initialState = {
            squad: {
                members: [null, null, null, null, null],
                targetIndex: 0
            },
            combat: {
                time: 0,
                targetIndex: 0,
                distance: 250,
                burstStartTime: 2.43,
                burstCycleTime: 20,
                started: false,
                characters: {},
                globalCounters: {
                    bulletsConsumed: 0
                }
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
        
        // 캐릭터 데이터 로드
        await characterLoader.loadAll();
        
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
        
        // 11. 의존성 컨테이너에 등록
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
        
        // 12. 전역 노출 (호환성)
        window.container = container;
        
        // 13. UI 초기화
        await uiController.initialize();
        
        console.log('[Main] Initialization complete');
        
    } catch (error) {
        console.error('[Main] Initialization error:', error);
    }
});