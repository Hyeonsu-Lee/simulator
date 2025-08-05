// ui/simulation-view.js - 시뮬레이션 뷰

class SimulationView {
    constructor() {
        this.multiRunResults = [];
        this.isFirstUpdate = true;
    }
    
    /**
     * 결과 표시
     */
    showResults(results) {
        const resultsContainer = document.getElementById('results');
        const finalResults = document.getElementById('finalResults');
        const distributionChart = document.getElementById('distributionChart');
        
        resultsContainer.classList.remove('hidden');
        
        if (results.length === 1) {
            // 단일 실행 결과
            this.showSingleRunResults(results[0], finalResults);
            distributionChart.classList.add('hidden');
        } else {
            // 멀티런 결과
            this.showMultiRunResults(results, finalResults);
            this.showDPSDistribution(results, distributionChart);
        }
    }
    
    /**
     * 단일 실행 결과 표시
     */
    showSingleRunResults(result, container) {
        const html = `
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
        
        container.innerHTML = html;
    }
    
    /**
     * 멀티런 결과 표시
     */
    showMultiRunResults(results, container) {
        const avgDPS = Math.floor(results.reduce((sum, r) => sum + r.dps, 0) / results.length);
        const avgDamage = Math.floor(results.reduce((sum, r) => sum + r.totalDamage, 0) / results.length);
        const avgCoreHit = results.reduce((sum, r) => sum + r.coreHitRate, 0) / results.length;
        const avgCrit = results.reduce((sum, r) => sum + r.critRate, 0) / results.length;
        
        const maxDPS = Math.max(...results.map(r => r.dps));
        const minDPS = Math.min(...results.map(r => r.dps));
        const stdDev = standardDeviation(results.map(r => r.dps));
        
        const html = `
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
        
        container.innerHTML = html;
    }
    
    /**
     * DPS 분포도 표시
     */
    showDPSDistribution(results, container) {
        const dpsList = results.map(r => r.dps);
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
        container.classList.remove('hidden');
    }
    
    /**
     * 진행률 업데이트
     */
    updateProgress(current, total) {
        const percent = (current / total * 100).toFixed(1);
        const progressFill = document.getElementById('progressFill');
        
        if (this.isFirstUpdate) {
            progressFill.style.transition = 'none';
            this.isFirstUpdate = false;
            setTimeout(() => {
                progressFill.style.transition = 'width 0.1s linear';
            }, 10);
        }
        
        progressFill.style.width = `${percent}%`;
        progressFill.textContent = `${percent}%`;
    }
    
    /**
     * 통계 창 업데이트
     */
    updateStatsDisplay(stats) {
        document.getElementById('elapsedTime').textContent = `${stats.time.toFixed(1)}s`;
        document.getElementById('totalDamage').textContent = formatNumber(stats.totalDamage);
        document.getElementById('currentDPS').textContent = formatNumber(stats.dps);
        document.getElementById('shotCount').textContent = stats.shotCount;
        document.getElementById('coreHitRate').textContent = `${stats.coreHitRate.toFixed(1)}%`;
        document.getElementById('critRate').textContent = `${stats.critRate.toFixed(1)}%`;
        document.getElementById('reloadCount').textContent = stats.reloadCount;
        document.getElementById('skill1Count').textContent = stats.skill1Count;
    }
    
    /**
     * 로그 표시 업데이트
     */
    updateLogDisplay(logs, totalCount) {
        const battleLog = document.getElementById('battleLog');
        const logTitle = document.getElementById('logTitle');
        
        const html = logs.map(log => 
            `<div class="log-entry log-${log.type}">[${log.time.toFixed(3)}s] ${log.message}</div>`
        ).join('');
        
        battleLog.innerHTML = html;
        battleLog.scrollTop = battleLog.scrollHeight;
        
        logTitle.textContent = `전투 로그 (최근 50개 표시, 전체 ${totalCount}개 기록됨)`;
    }
    
    /**
     * UI 상태 변경
     */
    setSimulationRunning(running) {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const progressBar = document.getElementById('progressBar');
        
        if (running) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            progressBar.classList.remove('hidden');
        } else {
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
        }
    }
    
    /**
     * 결과 초기화
     */
    clearResults() {
        document.getElementById('results').classList.add('hidden');
        document.getElementById('finalResults').innerHTML = '';
        document.getElementById('dpsDistribution').innerHTML = '';
        this.multiRunResults = [];
        this.isFirstUpdate = true;
    }
}

// 내보내기
window.SimulationView = SimulationView;