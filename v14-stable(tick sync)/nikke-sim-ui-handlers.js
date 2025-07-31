/* nikke-sim-ui-handlers.js - UI 핸들러 함수들 */

// UI 업데이트 함수들
function updateStats(stats) {
    document.getElementById('elapsedTime').textContent = `${stats.time.toFixed(1)}s`;
    document.getElementById('totalDamage').textContent = formatNumber(stats.totalDamage);
    document.getElementById('currentDPS').textContent = formatNumber(stats.dps);
    document.getElementById('shotCount').textContent = stats.shotCount;
    document.getElementById('coreHitRate').textContent = `${stats.coreHitRate.toFixed(1)}%`;
    document.getElementById('critRate').textContent = `${stats.critRate.toFixed(1)}%`;
    document.getElementById('reloadCount').textContent = stats.reloadCount;
    document.getElementById('skill1Count').textContent = stats.skill1Count;
}

function updateProgress(current, total) {
    const percent = (current / total * 100).toFixed(1);
    const progressFill = document.getElementById('progressFill');
    
    if (AppState.runtime.isFirstUpdate) {
        progressFill.style.transition = 'none';
        AppState.runtime.isFirstUpdate = false;
        setTimeout(() => {
            progressFill.style.transition = 'width 0.1s linear';
        }, 10);
    }
    
    progressFill.style.width = `${percent}%`;
    progressFill.textContent = `${percent}%`;
}

function showResults() {
    document.getElementById('results').classList.remove('hidden');
    const results = AppState.runtime.multiRunResults;
    
    if (results.length === 1) {
        const result = results[0];
        const resultsHTML = `
            <div class="result-card">
                <h3>총 대미지</h3>
                <div class="result-value">${formatNumber(result.totalDamage)}</div>
            </div>
            <div class="result-card">
                <h3>평균 DPS</h3>
                <div class="result-value">${formatNumber(result.dps)}</div>
            </div>
            <div class="result-card">
                <h3>코어히트율</h3>
                <div class="result-value">${result.coreHitRate.toFixed(1)}%</div>
            </div>
            <div class="result-card">
                <h3>크리티컬률</h3>
                <div class="result-value">${result.critRate.toFixed(1)}%</div>
            </div>
            <div class="result-card">
                <h3>총 발사 수</h3>
                <div class="result-value">${result.shotCount}</div>
            </div>
            <div class="result-card">
                <h3>재장전 횟수</h3>
                <div class="result-value">${result.reloadCount}</div>
            </div>
            <div class="result-card">
                <h3>스킬1 발동</h3>
                <div class="result-value">${result.skill1Count}회</div>
            </div>
            <div class="result-card">
                <h3>펠릿당 평균 대미지</h3>
                <div class="result-value">${formatNumber(Math.floor(result.totalDamage / result.totalPellets))}</div>
            </div>
        `;
        document.getElementById('finalResults').innerHTML = resultsHTML;
        document.getElementById('distributionChart').classList.add('hidden');
    } else {
        const avgDPS = Math.floor(results.reduce((sum, r) => sum + r.dps, 0) / results.length);
        const avgDamage = Math.floor(results.reduce((sum, r) => sum + r.totalDamage, 0) / results.length);
        const avgCoreHit = results.reduce((sum, r) => sum + r.coreHitRate, 0) / results.length;
        const avgCrit = results.reduce((sum, r) => sum + r.critRate, 0) / results.length;
        
        const maxDPS = Math.max(...results.map(r => r.dps));
        const minDPS = Math.min(...results.map(r => r.dps));
        const stdDev = Math.sqrt(results.reduce((sum, r) => sum + Math.pow(r.dps - avgDPS, 2), 0) / results.length);
        
        const resultsHTML = `
            <div class="result-card">
                <h3>평균 DPS</h3>
                <div class="result-value">${formatNumber(avgDPS)}</div>
            </div>
            <div class="result-card">
                <h3>평균 총 대미지</h3>
                <div class="result-value">${formatNumber(avgDamage)}</div>
            </div>
            <div class="result-card">
                <h3>평균 코어히트율</h3>
                <div class="result-value">${avgCoreHit.toFixed(1)}%</div>
            </div>
            <div class="result-card">
                <h3>평균 크리티컬률</h3>
                <div class="result-value">${avgCrit.toFixed(1)}%</div>
            </div>
            <div class="result-card">
                <h3>최고 DPS</h3>
                <div class="result-value">${formatNumber(maxDPS)}</div>
            </div>
            <div class="result-card">
                <h3>최저 DPS</h3>
                <div class="result-value">${formatNumber(minDPS)}</div>
            </div>
            <div class="result-card">
                <h3>표준편차</h3>
                <div class="result-value">±${formatNumber(Math.floor(stdDev))}</div>
            </div>
            <div class="result-card">
                <h3>변동계수</h3>
                <div class="result-value">${(stdDev / avgDPS * 100).toFixed(1)}%</div>
            </div>
        `;
        document.getElementById('finalResults').innerHTML = resultsHTML;
        
        showDPSDistribution();
    }
}

function showDPSDistribution() {
    const dpsList = AppState.runtime.multiRunResults.map(r => r.dps);
    const minDPS = Math.min(...dpsList);
    const maxDPS = Math.max(...dpsList);
    const range = maxDPS - minDPS;
    const buckets = 5;
    const bucketSize = range / buckets;
    
    const distribution = Array(buckets).fill(0);
    dpsList.forEach(dps => {
        const bucket = Math.min(Math.floor((dps - minDPS) / bucketSize), buckets - 1);
        distribution[bucket]++;
    });
    
    let distributionHTML = '';
    for (let i = 0; i < buckets; i++) {
        const rangeStart = Math.floor(minDPS + i * bucketSize);
        const rangeEnd = Math.floor(minDPS + (i + 1) * bucketSize);
        const percent = (distribution[i] / dpsList.length * 100);
        const barWidth = percent;
        
        distributionHTML += `
            <div class="bar-container">
                <div class="bar-label">${formatNumber(rangeStart)}-${formatNumber(rangeEnd)}</div>
                <div class="bar" style="width: ${barWidth}%"></div>
                <div class="bar-value">${percent.toFixed(0)}%</div>
            </div>
        `;
    }
    
    document.getElementById('dpsDistribution').innerHTML = distributionHTML;
    document.getElementById('distributionChart').classList.remove('hidden');
}

// 오버로드 관련 함수들
function initializeOverloadOptions() {
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
        
        select.addEventListener('change', function() {
            validateOverloadSelection(this);
            updateLevelOptions(this);
        });
    });
    
    levels.forEach(levelSelect => {
        levelSelect.innerHTML = '<option value="">-</option>';
        levelSelect.disabled = true;
    });
}

function updateLevelOptions(selectElement) {
    const equipment = selectElement.dataset.equipment;
    const slot = selectElement.dataset.slot;
    const optionType = selectElement.value;
    const levelSelect = document.querySelector(`.overload-level[data-equipment="${equipment}"][data-slot="${slot}"]`);
    
    if (!optionType) {
        levelSelect.innerHTML = '<option value="">-</option>';
        levelSelect.disabled = true;
        levelSelect.value = '';
        updateOverloadConfig();
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
        
        // 레벨 변경 이벤트 추가
        levelSelect.onchange = updateOverloadConfig;
        updateOverloadConfig();
    }
}

function validateOverloadSelection(changedSelect) {
    const equipment = changedSelect.dataset.equipment;
    const slot = changedSelect.dataset.slot;
    const value = changedSelect.value;
    
    if (!value) return;
    
    const sameEquipmentSelects = document.querySelectorAll(`.overload-select[data-equipment="${equipment}"]`);
    sameEquipmentSelects.forEach(select => {
        if (select !== changedSelect && select.value === value) {
            alert('같은 부위에는 동일한 옵션을 선택할 수 없습니다.');
            changedSelect.value = '';
        }
    });
    
    updateOverloadConfig();
}

function updateOverloadConfig() {
    const selects = document.querySelectorAll('.overload-select');
    
    selects.forEach(select => {
        const equipment = select.dataset.equipment;
        const slot = parseInt(select.dataset.slot);
        const levelSelect = document.querySelector(`.overload-level[data-equipment="${equipment}"][data-slot="${slot}"]`);
        const level = levelSelect ? levelSelect.value : null;
        
        if (select.value && level) {
            AppState._instance.setOverloadSlot(equipment, slot, {
                type: select.value,
                level: parseInt(level)
            });
        } else {
            AppState._instance.setOverloadSlot(equipment, slot, null);
        }
    });
}

function resetOverload() {
    const selects = document.querySelectorAll('.overload-select');
    
    selects.forEach(select => {
        select.value = '';
        select.dispatchEvent(new Event('change'));
    });
}

function setDefaultOverloadValues() {
    // 투구 설정
    document.querySelector('.overload-select[data-equipment="helmet"][data-slot="1"]').value = 'critDamage';
    document.querySelector('.overload-select[data-equipment="helmet"][data-slot="1"]').dispatchEvent(new Event('change'));
    document.querySelector('.overload-level[data-equipment="helmet"][data-slot="1"]').value = '3';

    document.querySelector('.overload-select[data-equipment="helmet"][data-slot="2"]').value = 'eliteDamage';
    document.querySelector('.overload-select[data-equipment="helmet"][data-slot="2"]').dispatchEvent(new Event('change'));
    document.querySelector('.overload-level[data-equipment="helmet"][data-slot="2"]').value = '10';

    document.querySelector('.overload-select[data-equipment="helmet"][data-slot="3"]').value = 'maxAmmo';
    document.querySelector('.overload-select[data-equipment="helmet"][data-slot="3"]').dispatchEvent(new Event('change'));
    document.querySelector('.overload-level[data-equipment="helmet"][data-slot="3"]').value = '4';
    
    // 장갑 설정
    document.querySelector('.overload-select[data-equipment="gloves"][data-slot="1"]').value = 'maxAmmo';
    document.querySelector('.overload-select[data-equipment="gloves"][data-slot="1"]').dispatchEvent(new Event('change'));
    document.querySelector('.overload-level[data-equipment="gloves"][data-slot="1"]').value = '4';
    
    document.querySelector('.overload-select[data-equipment="gloves"][data-slot="3"]').value = 'eliteDamage';
    document.querySelector('.overload-select[data-equipment="gloves"][data-slot="3"]').dispatchEvent(new Event('change'));
    document.querySelector('.overload-level[data-equipment="gloves"][data-slot="3"]').value = '9';
    
    // 갑옷 설정
    document.querySelector('.overload-select[data-equipment="armor"][data-slot="1"]').value = 'eliteDamage';
    document.querySelector('.overload-select[data-equipment="armor"][data-slot="1"]').dispatchEvent(new Event('change'));
    document.querySelector('.overload-level[data-equipment="armor"][data-slot="1"]').value = '8';
    
    document.querySelector('.overload-select[data-equipment="armor"][data-slot="2"]').value = 'attack';
    document.querySelector('.overload-select[data-equipment="armor"][data-slot="2"]').dispatchEvent(new Event('change'));
    document.querySelector('.overload-level[data-equipment="armor"][data-slot="2"]').value = '7';
    
    document.querySelector('.overload-select[data-equipment="armor"][data-slot="3"]').value = 'maxAmmo';
    document.querySelector('.overload-select[data-equipment="armor"][data-slot="3"]').dispatchEvent(new Event('change'));
    document.querySelector('.overload-level[data-equipment="armor"][data-slot="3"]').value = '5';
    
    // 신발 설정
    document.querySelector('.overload-select[data-equipment="boots"][data-slot="1"]').value = 'critDamage';
    document.querySelector('.overload-select[data-equipment="boots"][data-slot="1"]').dispatchEvent(new Event('change'));
    document.querySelector('.overload-level[data-equipment="boots"][data-slot="1"]').value = '6';
    
    document.querySelector('.overload-select[data-equipment="boots"][data-slot="2"]').value = 'maxAmmo';
    document.querySelector('.overload-select[data-equipment="boots"][data-slot="2"]').dispatchEvent(new Event('change'));
    document.querySelector('.overload-level[data-equipment="boots"][data-slot="2"]').value = '3';
    
    document.querySelector('.overload-select[data-equipment="boots"][data-slot="3"]').value = 'eliteDamage';
    document.querySelector('.overload-select[data-equipment="boots"][data-slot="3"]').dispatchEvent(new Event('change'));
    document.querySelector('.overload-level[data-equipment="boots"][data-slot="3"]').value = '9';
    
    updateOverloadConfig();
}

function createOverloadUI() {
    const container = document.getElementById('overloadContainer');
    if (!container) return;
    
    const html = `
        <details style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 20px; margin-bottom: 30px;">
            <summary style="cursor: pointer; font-size: 1.2em; color: #00d4ff; margin-bottom: 10px;">⚙️ 오버로드 장비 설정</summary>
            <div style="margin-top: 20px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;" id="overloadGrid">
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <button onclick="resetOverload()" style="background: #666; padding: 12px 30px; border: none; border-radius: 5px; color: white; font-size: 1.1em; font-weight: bold; cursor: pointer;">초기화</button>
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
    
    initializeOverloadOptions();
    setDefaultOverloadValues();
}

// 스쿼드 관련 함수들 (기존 호환성)
function initializeSquadNikkeSelects() {
    // 기존 호환성을 위한 빈 함수
}

function validateSquadSelection(changedSelect) {
    // 새로운 UI에서는 handleSquadChange에서 처리
}

function getSelectedSquadNikkes() {
    const uiState = AppState._instance;
    return uiState.state.squad.filter(id => id !== null);
}