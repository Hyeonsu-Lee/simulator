/* nikke-sim-main.js - 메인 애플리케이션 */

// 전역 시뮬레이터 클래스 (기존 호환성 유지)
class GlobalSimulator {
    constructor(targetNikkeId, squadNikkeIds, config) {
        // UI State에서 실제 설정 가져오기
        const uiState = AppState._instance;
        
        // 스쿼드 구성
        const squad = [];
        let targetIndex = 0;
        
        // 타겟 니케 추가
        if (targetNikkeId) {
            const targetConfig = uiState.getCharacterConfig(targetNikkeId);
            const targetNikke = CHARACTER_REGISTRY.create(targetNikkeId, targetConfig);
            squad.push(targetNikke);
        }
        
        // 스쿼드 니케 추가
        squadNikkeIds.forEach(id => {
            if (id) {
                const config = uiState.getCharacterConfig(id);
                const nikke = CHARACTER_REGISTRY.create(id, config);
                squad.push(nikke);
            }
        });
        
        // 설정
        this.config = config;
        this.logger = new CombatLogger();
        
        // 오버로드 버프 계산
        this.overloadBuffs = this.calculateOverloadBuffs(config.overloadConfig);
        
        // 소장품 보너스 계산
        this.collectionBonus = this.calculateCollectionBonus();
        
        // 엔진 초기화
        this.initializeEngine(squad, targetIndex);
    }
    
    initializeEngine(squad, targetIndex) {
        this.engine = new CombatEngine({
            squad: squad,
            targetIndex: targetIndex,
            logger: this.logger,
            config: {
                ...this.config,
                overloadBuffs: this.overloadBuffs,
                collectionBonus: this.collectionBonus
            }
        });
        
        // 기존 인터페이스 호환
        this.targetNikke = squad[targetIndex];
        this.squadNikkes = squad.slice(1);
        this.combatSimulator = {
            simulate: (duration, speed, callback) => 
                this.engine.simulate(duration, speed, callback),
            stop: () => this.engine.stop(),
            state: { running: true }
        };
    }
    
    getAllNikkes() {
        return this.engine.squad;
    }
    
    calculateOverloadBuffs(overloadConfig) {
        const buffs = {
            atkPercent: 0,
            critRate: 0,
            critDamage: 0,
            accuracy: 0,
            maxAmmo: 0,
            eliteDamage: 0
        };
        
        Object.entries(overloadConfig).forEach(([equipment, slots]) => {
            Object.entries(slots).forEach(([slot, config]) => {
                if (config && config.type && config.level) {
                    const option = OVERLOAD_OPTIONS[config.type];
                    const value = option.values[config.level - 1] / 100;
                    
                    switch(config.type) {
                        case 'attack': buffs.atkPercent += value; break;
                        case 'critRate': buffs.critRate += value; break;
                        case 'critDamage': buffs.critDamage += value; break;
                        case 'accuracy': buffs.accuracy += option.values[config.level - 1]; break;
                        case 'maxAmmo': buffs.maxAmmo += value; break;
                        case 'eliteDamage': buffs.eliteDamage += value; break;
                    }
                }
            });
        });
        
        return buffs;
    }
    
    calculateCollectionBonus() {
        const bonus = {
            coreBonus: 0,
            chargeRatio: 0,
            damageMultiplier: 1,
            maxAmmo: 0
        };
        
        if (!this.targetNikke) return bonus;
        
        switch(this.targetNikke.weaponType) {
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
        return await this.combatSimulator.simulate(duration, speedMultiplier, updateCallback);
    }
    
    stop() {
        this.combatSimulator.stop();
    }
}

// 메인 시뮬레이션 함수
async function startSimulation() {
    try {
        // UI State에서 설정 가져오기
        const uiState = AppState._instance;
        const setup = uiState.getSimulationSetup();
        
        // UI 상태 변경
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('stopBtn').style.display = 'inline-block';
        document.getElementById('progressBar').classList.remove('hidden');
        document.getElementById('results').classList.add('hidden');
        
        // 런타임 초기화
        AppState.clearRuntime();
        
        // 멀티런 처리
        const runCount = setup.config.runCount || 1;
        
        for (let i = 0; i < runCount; i++) {
            if (runCount > 1) {
                AppState.runtime.logger.log(0, `===== 시뮬레이션 ${i + 1}/${runCount} 시작 =====`, 'buff');
            }
            
            // 엔진 생성
            const engine = new CombatEngine({
                squad: setup.squad,
                targetIndex: setup.targetIndex,
                logger: AppState.runtime.logger,
                config: setup.config
            });
            
            AppState.setCurrentSimulator(engine);
            
            // 시뮬레이션 실행
            const result = await engine.simulate(
                setup.config.duration,
                setup.config.speed,
                (stats) => {
                    updateStats(stats);
                    updateProgress(stats.time, setup.config.duration);
                }
            );
            
            if (!engine.running) break;
            
            AppState.runtime.multiRunResults.push(result);
            
            if (i < runCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        // 결과 표시
        if (AppState.runtime.currentSimulator?.running) {
            showResults();
        }
        
    } catch (error) {
        console.error('시뮬레이션 오류:', error);
        alert(`시뮬레이션 오류: ${error.message}`);
    } finally {
        // UI 상태 복원
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('stopBtn').style.display = 'none';
    }
}

function stopSimulation() {
    if (AppState.runtime.currentSimulator) {
        AppState.runtime.currentSimulator.stop();
    }
    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('stopBtn').style.display = 'none';
}

function downloadFullLog() {
    const fullLog = AppState.runtime.logger.getFullLog();
    if (fullLog.length === 0) {
        alert('다운로드할 로그가 없습니다.');
        return;
    }
    
    const logText = fullLog.map(log => log.entry).join('\n');
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nikke_battle_log_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 스쿼드 UI 초기화 (새로운 방식)
function initializeSquadUI() {
    const container = document.getElementById('squadSettings');
    if (!container) return;
    
    let html = '<h2>스쿼드 구성</h2><div class="settings-grid">';
    
    for (let i = 0; i < 5; i++) {
        html += `
            <div class="setting-group">
                <label>슬롯 ${i + 1}</label>
                <select id="squadSlot${i}" onchange="handleSquadChange(${i}, this.value)">
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
            <select id="targetSelect" onchange="handleTargetChange(this.value)">
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
    CHARACTER_REGISTRY.forEach((creator, id) => {
        const character = creator();
        for (let i = 0; i < 5; i++) {
            const select = document.getElementById(`squadSlot${i}`);
            const option = document.createElement('option');
            option.value = id;
            option.textContent = character.name;
            select.appendChild(option);
        }
    });
}

// 스쿼드 변경 핸들러
function handleSquadChange(index, characterId) {
    const uiState = AppState._instance;
    uiState.setSquadMember(index, characterId || null);
    
    // 캐릭터 설정 UI 표시/숨김
    const configDiv = document.getElementById(`charConfig${index}`);
    if (characterId) {
        configDiv.classList.remove('hidden');
        
        // 레벨/코어 변경 리스너
        document.getElementById(`level${index}`).onchange = (e) => {
            uiState.setCharacterConfig(characterId, { level: parseInt(e.target.value) });
        };
        document.getElementById(`core${index}`).onchange = (e) => {
            uiState.setCharacterConfig(characterId, { coreLevel: parseInt(e.target.value) });
        };
    } else {
        configDiv.classList.add('hidden');
    }
    
    // 기존 호환성을 위한 설정
    updateLegacySelectors();
}

// 타겟 변경 핸들러
function handleTargetChange(index) {
    AppState._instance.setTargetIndex(parseInt(index));
}

// 기존 셀렉터 업데이트 (호환성)
function updateLegacySelectors() {
    const uiState = AppState._instance;
    const squad = uiState.state.squad;
    
    // 타겟 니케 셀렉터
    const targetSelect = document.getElementById('characterSelect');
    if (targetSelect && squad[uiState.state.targetIndex]) {
        targetSelect.value = squad[uiState.state.targetIndex];
    }
    
    // 스쿼드 니케 셀렉터
    let squadIndex = 0;
    for (let i = 0; i < 5; i++) {
        if (i === uiState.state.targetIndex) continue;
        
        const squadSelect = document.getElementById(`squadNikke${squadIndex + 1}`);
        if (squadSelect) {
            squadSelect.value = squad[i] || '';
        }
        squadIndex++;
    }
}

// 기존 호환성을 위한 빈 함수
function validateSquadSelection() {
    // 새로운 UI에서는 handleSquadChange에서 처리
}

// 전역 함수로 노출
window.startSimulation = startSimulation;
window.stopSimulation = stopSimulation;
window.downloadFullLog = downloadFullLog;
window.validateSquadSelection = validateSquadSelection;
window.resetOverload = resetOverload;
window.handleSquadChange = handleSquadChange;
window.handleTargetChange = handleTargetChange;

// 페이지 로드 완료 후 초기화
window.addEventListener('load', function() {
    // 보안 코드
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
    
    // UI 초기화
    createOverloadUI();
    initializeSquadUI();
    
    // 로거 컨테이너 설정
    if (AppState.runtime.logger) {
        AppState.runtime.logger.setContainer(
            document.getElementById('battleLog'),
            document.getElementById('logTitle')
        );
    }
});