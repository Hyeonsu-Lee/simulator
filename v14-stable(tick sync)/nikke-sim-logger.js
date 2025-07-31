/* nikke-sim-logger.js - 전투 로거 */

class CombatLogger {
    constructor() {
        this.fullLog = [];
        this.displayLog = [];
        this.logContainer = null;
        this.logTitle = null;
    }
    
    setContainer(container, titleElement) {
        this.logContainer = container;
        this.logTitle = titleElement;
    }
    
    addLog(time, message, type = '') {
        const entry = `[${time.toFixed(3)}s] ${message}`;
        const logItem = { entry, type, time };
        
        this.fullLog.push(logItem);
        this.displayLog.push(logItem);
        
        if (this.displayLog.length > 50) {
            this.displayLog.shift();
        }
        
        this.updateDisplay();
    }
    
    // 새로운 log 메서드 (BuffSystem 호환성)
    log(time, message, type = '') {
        this.addLog(time, message, type);
    }
    
    updateDisplay() {
        const logContainer = this.logContainer || document.getElementById('battleLog');
        if (logContainer) {
            logContainer.innerHTML = this.displayLog.map(log => 
                `<div class="log-entry log-${log.type}">${log.entry}</div>`
            ).join('');
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        
        const logTitle = this.logTitle || document.getElementById('logTitle');
        if (logTitle) {
            logTitle.textContent = `전투 로그 (최근 50개 표시, 전체 ${this.fullLog.length}개 기록됨)`;
        }
    }
    
    getFullLog() {
        return this.fullLog;
    }
    
    clear() {
        this.fullLog = [];
        this.displayLog = [];
        this.updateDisplay();
    }
    
    // 로그 내보내기
    exportLogs() {
        return this.fullLog.map(log => log.entry).join('\n');
    }
    
    // 로그 다운로드
    downloadLogs() {
        if (this.fullLog.length === 0) {
            alert('다운로드할 로그가 없습니다.');
            return;
        }
        
        const logText = this.exportLogs();
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
}