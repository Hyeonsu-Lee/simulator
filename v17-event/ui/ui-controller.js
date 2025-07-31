// ui/ui-controller.js - UI 컨트롤러

class UIController {
    constructor(dependencies = {}) {
        // 의존성 주입
        this.eventBus = dependencies.eventBus;
        this.stateStore = dependencies.stateStore;
        this.characterLoader = dependencies.characterLoader;
        this.configManager = dependencies.configManager;
        this.logger = dependencies.logger;
        
        this.elements = {};
        this.initialized = false;
    }
    
    /**
     * 캐릭터 스펙 로드 대기
     */
    async waitForCharacterData() {
        // characterLoader가 로드 완료될 때까지 대기
        let attempts = 0;
        while (!this.characterLoader.loaded && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!this.characterLoader.loaded) {
            console.warn('Character data not loaded after waiting');
        }
    }
    
    /**
     * UI 초기화
     */
    async initialize() {
        if (this.initialized) return;
        
        await this.waitForCharacterData();
        
        this.cacheElements();
        this.setupEventListeners();
        this.createSquadUI();
        this.createOverloadUI();
        this.subscribeToEvents();
        
        // 초기 상태 동기화
        this.syncUIWithState();
        
        this.initialized = true;
    }
    
    /**
     * UI와 상태 동기화
     */
    syncUIWithState() {
        // configManager의 스쿼드 정보로 UI 업데이트
        const squad = this.configManager.config.squad.members;
        const targetIndex = this.configManager.config.squad.targetIndex;
        
        squad.forEach((characterId, index) => {
            const select = document.getElementById(`squadSlot${index}`);
            if (select && characterId) {
                select.value = characterId;
                const configDiv = document.getElementById(`charConfig${index}`);
                if (configDiv) {
                    configDiv.classList.remove('hidden');
                }
            }
        });
        
        const targetSelect = document.getElementById('targetSelect');
        if (targetSelect) {
            targetSelect.value = targetIndex;
        }
    }
    
    /**
     * DOM 요소 캐싱
     */
    cacheElements() {
        // 버튼
        this.elements.startBtn = document.getElementById('startBtn');
        this.elements.stopBtn = document.getElementById('stopBtn');
        this.elements.downloadBtn = document.getElementById('downloadLogBtn');
        
        // 설정
        this.elements.distanceSelect = document.getElementById('distanceSelect');
        this.elements.coreSize = document.getElementById('coreSize');
        this.elements.cubeSelect = document.getElementById('cubeSelect');
        this.elements.eliteCode = document.getElementById('eliteCode');
        this.elements.simSpeed = document.getElementById('simSpeed');
        this.elements.runCount = document.getElementById('runCount');
        
        // 컨테이너
        this.elements.squadSettings = document.getElementById('squadSettings');
        this.elements.overloadContainer = document.getElementById('overloadContainer');
        this.elements.progressBar = document.getElementById('progressBar');
        this.elements.progressFill = document.getElementById('progressFill');
        this.elements.results = document.getElementById('results');
        
        // 로그
        this.elements.logTitle = document.getElementById('logTitle');
        this.elements.battleLog = document.getElementById('battleLog');
        
        // 통계
        this.elements.stats = {
            elapsedTime: document.getElementById('elapsedTime'),
            totalDamage: document.getElementById('totalDamage'),
            currentDPS: document.getElementById('currentDPS'),
            shotCount: document.getElementById('shotCount'),
            coreHitRate: document.getElementById('coreHitRate'),
            critRate: document.getElementById('critRate'),
            reloadCount: document.getElementById('reloadCount'),
            skill1Count: document.getElementById('skill1Count')
        };
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 버튼
        this.elements.startBtn.addEventListener('click', () => this.handleStart());
        this.elements.stopBtn.addEventListener('click', () => this.handleStop());
        this.elements.downloadBtn.addEventListener('click', () => this.handleDownload());
        
        // 설정 변경
        this.elements.distanceSelect.addEventListener('change', (e) => 
            this.configManager.set('simulation.distance', parseInt(e.target.value))
        );
        
        this.elements.coreSize.addEventListener('change', (e) => 
            this.configManager.set('simulation.coreSize', parseInt(e.target.value))
        );
        
        this.elements.cubeSelect.addEventListener('change', (e) => 
            this.configManager.set('simulation.cubeType', e.target.value)
        );
        
        this.elements.eliteCode.addEventListener('change', (e) => 
            this.configManager.set('simulation.eliteCode', e.target.value)
        );
        
        this.elements.simSpeed.addEventListener('change', (e) => 
            this.configManager.set('simulation.speed', parseInt(e.target.value))
        );
        
        this.elements.runCount.addEventListener('change', (e) => 
            this.configManager.set('simulation.runCount', parseInt(e.target.value))
        );
    }
    
    /**
     * 이벤트 구독
     */
    subscribeToEvents() {
        if (!this.eventBus) return;
        
        this.eventBus.on(Events.UI_UPDATE, (event) => this.updateStats(event.data.stats));
        this.eventBus.on(Events.LOG_MESSAGE, (event) => this.updateLog(event.data));
        this.eventBus.on(Events.PROGRESS_UPDATE, (event) => this.updateProgress(event.data));
        this.eventBus.on(Events.SIMULATION_COMPLETE, (event) => this.showResults(event.data));
        
        // 스쿼드 변경 이벤트 구독
        this.eventBus.on(Events.SQUAD_CHANGE, (event) => {
            console.log('[UIController] Squad changed:', event.data);
        });
    }
    
    /**
     * 스쿼드 UI 생성
     */
    createSquadUI() {
        const container = this.elements.squadSettings;
        if (!container) return;
        
        let html = '<h2>스쿼드 구성</h2><div class="settings-grid">';
        
        for (let i = 0; i < 5; i++) {
            html += `
                <div class="setting-group">
                    <label>슬롯 ${i + 1}</label>
                    <select id="squadSlot${i}" data-slot="${i}">
                        <option value="">비어있음</option>
                    </select>
                    <div id="charConfig${i}" class="character-config hidden">
                        <input type="number" id="level${i}" placeholder="레벨" value="200" min="1" max="200">
                        <input type="number" id="core${i}" placeholder="코어" value="10" min="0" max="10">
                    </div>
                </div>
            `;
        }
        
        html += `
            </div>
            <div class="setting-group" style="margin-top: 20px;">
                <label>타겟 니케 선택</label>
                <select id="targetSelect">
                    <option value="0">슬롯 1</option>
                    <option value="1">슬롯 2</option>
                    <option value="2">슬롯 3</option>
                    <option value="3">슬롯 4</option>
                    <option value="4">슬롯 5</option>
                </select>
            </div>
        `;
        
        container.innerHTML = html;
        
        // 캐릭터 옵션 추가
        this.characterLoader.getAllIds().forEach(id => {
            const spec = this.characterLoader.getSpec(id);
            for (let i = 0; i < 5; i++) {
                const select = document.getElementById(`squadSlot${i}`);
                const option = document.createElement('option');
                option.value = id;
                option.textContent = spec.name;
                select.appendChild(option);
            }
        });
        
        // 스쿼드 변경 리스너
        for (let i = 0; i < 5; i++) {
            const select = document.getElementById(`squadSlot${i}`);
            const levelInput = document.getElementById(`level${i}`);
            const coreInput = document.getElementById(`core${i}`);
            const configDiv = document.getElementById(`charConfig${i}`);
            
            select.addEventListener('change', (e) => {
                const characterId = e.target.value;
                
                console.log(`[UIController] Squad slot ${i} changed to:`, characterId || 'empty');
                
                // ConfigManager와 StateStore 모두 업데이트
                this.configManager.setSquadMember(i, characterId || null);
                
                // StateStore 직접 업데이트 (추가 보장)
                this.stateStore.update(state => {
                    if (!state.squad) state.squad = { members: [null, null, null, null, null], targetIndex: 0 };
                    state.squad.members[i] = characterId || null;
                    return state;
                });
                
                if (characterId) {
                    configDiv.classList.remove('hidden');
                    
                    levelInput.onchange = () => {
                        this.configManager.setCharacterConfig(characterId, {
                            level: parseInt(levelInput.value)
                        });
                    };
                    
                    coreInput.onchange = () => {
                        this.configManager.setCharacterConfig(characterId, {
                            coreLevel: parseInt(coreInput.value)
                        });
                    };
                } else {
                    configDiv.classList.add('hidden');
                }
                
                // 디버그 로그
                console.log('[UIController] Current squad state:', this.stateStore.get('squad'));
            });
        }
        
        // 타겟 변경 리스너
        document.getElementById('targetSelect').addEventListener('change', (e) => {
            const index = parseInt(e.target.value);
            console.log(`[UIController] Target changed to slot ${index + 1}`);
            
            this.configManager.setTargetIndex(index);
            
            // StateStore 직접 업데이트 (추가 보장)
            this.stateStore.update(state => {
                if (!state.squad) state.squad = { members: [null, null, null, null, null], targetIndex: 0 };
                state.squad.targetIndex = index;
                return state;
            });
        });
    }
    
    /**
     * 오버로드 UI 생성
     */
    createOverloadUI() {
        const container = this.elements.overloadContainer;
        if (!container) return;
        
        const html = `
            <details style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 20px; margin-bottom: 30px;">
                <summary style="cursor: pointer; font-size: 1.2em; color: #00d4ff; margin-bottom: 10px;">⚙️ 오버로드 장비 설정</summary>
                <div style="margin-top: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;" id="overloadGrid">
                    </div>
                    <div style="margin-top: 20px; text-align: center;">
                        <button id="resetOverloadBtn" style="background: #666; padding: 12px 30px; border: none; border-radius: 5px; color: white; font-size: 1.1em; font-weight: bold; cursor: pointer;">초기화</button>
                    </div>
                </div>
            </details>
        `;
        
        container.innerHTML = html;
        
        const grid = document.getElementById('overloadGrid');
        const equipments = [
            { id: 'helmet', name: '🪖 투구' },
            { id: 'gloves', name: '🧤 장갑' },
            { id: 'armor', name: '🛡️ 갑옷' },
            { id: 'boots', name: '👟 신발' }
        ];
        
        equipments.forEach(eq => {
            const eqDiv = document.createElement('div');
            eqDiv.style.cssText = 'background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 8px;';
            
            let eqHTML = `<h3 style="color: #00d4ff; margin-bottom: 15px;">${eq.name}</h3><div class="overload-slots">`;
            
            for (let slot = 1; slot <= 3; slot++) {
                eqHTML += `
                    <div class="overload-slot">
                        <label>슬롯 ${slot}</label>
                        <select class="overload-select" data-equipment="${eq.id}" data-slot="${slot}">
                            <option value="">선택 안함</option>
                        </select>
                        <select class="overload-level" data-equipment="${eq.id}" data-slot="${slot}" disabled>
                            <option value="">-</option>
                        </select>
                    </div>
                `;
            }
            
            eqHTML += '</div>';
            eqDiv.innerHTML = eqHTML;
            grid.appendChild(eqDiv);
        });
        
        // 오버로드 옵션 초기화
        this.initializeOverloadOptions();
        
        // 리셋 버튼
        document.getElementById('resetOverloadBtn').addEventListener('click', () => {
            this.resetOverload();
        });
        
        // 기본값 설정
        this.setDefaultOverloadValues();
    }
    
    /**
     * 오버로드 옵션 초기화
     */
    initializeOverloadOptions() {
        const selects = document.querySelectorAll('.overload-select');
        const levels = document.querySelectorAll('.overload-level');
        
        selects.forEach(select => {
            select.innerHTML = '<option value="">선택 안함</option>';
            Object.entries(OVERLOAD_OPTIONS).forEach(([key, option]) => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = option.name;
                select.appendChild(opt);
            });
            
            select.addEventListener('change', (e) => {
                this.validateOverloadSelection(select);
                this.updateLevelOptions(select);
            });
        });
        
        levels.forEach(levelSelect => {
            levelSelect.innerHTML = '<option value="">-</option>';
            levelSelect.disabled = true;
        });
    }
    
    /**
     * 오버로드 레벨 옵션 업데이트
     */
    updateLevelOptions(selectElement) {
        const equipment = selectElement.dataset.equipment;
        const slot = selectElement.dataset.slot;
        const optionType = selectElement.value;
        const levelSelect = document.querySelector(`.overload-level[data-equipment="${equipment}"][data-slot="${slot}"]`);
        
        if (!optionType) {
            levelSelect.innerHTML = '<option value="">-</option>';
            levelSelect.disabled = true;
            levelSelect.value = '';
            this.updateOverloadConfig();
        } else {
            const option = OVERLOAD_OPTIONS[optionType];
            levelSelect.innerHTML = '';
            levelSelect.disabled = false;
            
            for (let i = 14; i >= 0; i--) {
                const opt = document.createElement('option');
                opt.value = i + 1;
                opt.textContent = `+${option.values[i].toFixed(2)}%`;
                levelSelect.appendChild(opt);
            }
            
            levelSelect.value = '15';
            levelSelect.onchange = () => this.updateOverloadConfig();
            this.updateOverloadConfig();
        }
    }
    
    /**
     * 오버로드 선택 검증
     */
    validateOverloadSelection(changedSelect) {
        const equipment = changedSelect.dataset.equipment;
        const value = changedSelect.value;
        
        if (!value) return;
        
        const sameEquipmentSelects = document.querySelectorAll(`.overload-select[data-equipment="${equipment}"]`);
        sameEquipmentSelects.forEach(select => {
            if (select !== changedSelect && select.value === value) {
                alert('같은 부위에는 동일한 옵션을 선택할 수 없습니다.');
                changedSelect.value = '';
            }
        });
    }
    
    /**
     * 오버로드 설정 업데이트
     */
    updateOverloadConfig() {
        const selects = document.querySelectorAll('.overload-select');
        
        selects.forEach(select => {
            const equipment = select.dataset.equipment;
            const slot = parseInt(select.dataset.slot);
            const levelSelect = document.querySelector(`.overload-level[data-equipment="${equipment}"][data-slot="${slot}"]`);
            const level = levelSelect ? levelSelect.value : null;
            
            if (select.value && level) {
                this.configManager.setOverloadOption(equipment, slot, {
                    type: select.value,
                    level: parseInt(level)
                });
            } else {
                this.configManager.setOverloadOption(equipment, slot, null);
            }
        });
    }
    
    /**
     * 오버로드 리셋
     */
    resetOverload() {
        const selects = document.querySelectorAll('.overload-select');
        
        selects.forEach(select => {
            select.value = '';
            select.dispatchEvent(new Event('change'));
        });
    }
    
    /**
     * 오버로드 기본값 설정
     */
    setDefaultOverloadValues() {
        const defaults = {
            helmet: {
                1: { type: 'critDamage', level: 3 },
                2: { type: 'eliteDamage', level: 10 },
                3: { type: 'maxAmmo', level: 4 }
            },
            gloves: {
                1: { type: 'maxAmmo', level: 4 },
                3: { type: 'eliteDamage', level: 9 }
            },
            armor: {
                1: { type: 'eliteDamage', level: 8 },
                2: { type: 'attack', level: 7 },
                3: { type: 'maxAmmo', level: 5 }
            },
            boots: {
                1: { type: 'critDamage', level: 6 },
                2: { type: 'maxAmmo', level: 3 },
                3: { type: 'eliteDamage', level: 9 }
            }
        };
        
        Object.entries(defaults).forEach(([equipment, slots]) => {
            Object.entries(slots).forEach(([slot, config]) => {
                const select = document.querySelector(`.overload-select[data-equipment="${equipment}"][data-slot="${slot}"]`);
                if (select) {
                    select.value = config.type;
                    select.dispatchEvent(new Event('change'));
                    
                    const levelSelect = document.querySelector(`.overload-level[data-equipment="${equipment}"][data-slot="${slot}"]`);
                    if (levelSelect) {
                        levelSelect.value = config.level;
                    }
                }
            });
        });
        
        this.updateOverloadConfig();
    }
    
    /**
     * 시작 핸들러
     */
    handleStart() {
        // 현재 상태 디버그
        console.log('[UIController] Starting simulation with state:', {
            squad: this.stateStore.get('squad'),
            config: this.configManager.config.squad
        });
        
        this.elements.startBtn.style.display = 'none';
        this.elements.stopBtn.style.display = 'inline-block';
        this.elements.progressBar.classList.remove('hidden');
        this.elements.results.classList.add('hidden');
        
        if (this.eventBus) {
            this.eventBus.emit(Events.START);
        }
    }
    
    /**
     * 중지 핸들러
     */
    handleStop() {
        this.elements.startBtn.style.display = 'inline-block';
        this.elements.stopBtn.style.display = 'none';
        
        if (this.eventBus) {
            this.eventBus.emit(Events.STOP);
        }
    }
    
    /**
     * 다운로드 핸들러
     */
    handleDownload() {
        if (this.logger) {
            this.logger.download();
        }
    }
    
    /**
     * 통계 업데이트
     */
    updateStats(stats) {
        this.elements.stats.elapsedTime.textContent = `${stats.time.toFixed(1)}s`;
        this.elements.stats.totalDamage.textContent = this.formatNumber(stats.totalDamage);
        this.elements.stats.currentDPS.textContent = this.formatNumber(stats.dps);
        this.elements.stats.shotCount.textContent = stats.shotCount;
        this.elements.stats.coreHitRate.textContent = `${stats.coreHitRate.toFixed(1)}%`;
        this.elements.stats.critRate.textContent = `${stats.critRate.toFixed(1)}%`;
        this.elements.stats.reloadCount.textContent = stats.reloadCount;
        this.elements.stats.skill1Count.textContent = stats.skill1Count;
    }
    
    /**
     * 로그 업데이트
     */
    updateLog(logEntry) {
        if (!logEntry) {
            this.elements.battleLog.innerHTML = '';
            return;
        }
        
        const logs = this.logger.getRecentLogs();
        const html = logs.map(log => 
            `<div class="log-entry log-${log.type}">[${log.time.toFixed(3)}s] ${log.message}</div>`
        ).join('');
        
        this.elements.battleLog.innerHTML = html;
        this.elements.battleLog.scrollTop = this.elements.battleLog.scrollHeight;
        
        this.elements.logTitle.textContent = 
            `전투 로그 (최근 50개 표시, 전체 ${this.logger.logs.length}개 기록됨)`;
    }
    
    /**
     * 진행률 업데이트
     */
    updateProgress(data) {
        const percent = (data.current / data.total * 100).toFixed(1);
        this.elements.progressFill.style.width = `${percent}%`;
        this.elements.progressFill.textContent = `${percent}%`;
    }
    
    /**
     * 결과 표시
     */
    showResults(results) {
        this.elements.results.classList.remove('hidden');
        
        // 결과 표시 로직...
        // (기존 showResults 함수 로직 재사용)
    }
    
    /**
     * 숫자 포맷팅
     */
    formatNumber(num) {
        if (typeof num !== 'number') return '0';
        return Math.floor(num).toLocaleString('ko-KR');
    }
}

// 전역 UI 컨트롤러 - 더 이상 사용하지 않음
// const uiController = new UIController();

// 내보내기
window.UIController = UIController;
// window.uiController = uiController; // 제거