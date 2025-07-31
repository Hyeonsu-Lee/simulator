// infrastructure/logger.js - 로깅 시스템

class Logger {
    constructor() {
        this.logs = [];
        this.maxDisplayLogs = 50;
        this.logHandlers = new Set();
    }
    
    /**
     * 로그 추가
     * @param {number} time 
     * @param {string} message 
     * @param {string} type 
     */
    log(time, message, type = 'info') {
        const entry = {
            time,
            message,
            type,
            timestamp: Date.now()
        };
        
        this.logs.push(entry);
        
        // 로그 핸들러들에게 알림
        this.logHandlers.forEach(handler => {
            try {
                handler(entry);
            } catch (error) {
                console.error('Error in log handler:', error);
            }
        });
        
        // UI 업데이트 이벤트
        eventBus.emit(Events.LOG_MESSAGE, entry);
    }
    
    /**
     * 로그 핸들러 등록
     * @param {Function} handler 
     * @returns {Function} unsubscribe
     */
    onLog(handler) {
        this.logHandlers.add(handler);
        return () => this.logHandlers.delete(handler);
    }
    
    /**
     * 최근 로그 반환
     * @param {number} count 
     */
    getRecentLogs(count = this.maxDisplayLogs) {
        return this.logs.slice(-count);
    }
    
    /**
     * 전체 로그 반환
     */
    getAllLogs() {
        return [...this.logs];
    }
    
    /**
     * 로그 초기화
     */
    clear() {
        this.logs = [];
        eventBus.emit(Events.LOG_MESSAGE, null);
    }
    
    /**
     * 로그 내보내기
     */
    export() {
        return this.logs.map(log => 
            `[${log.time.toFixed(3)}s] ${log.message}`
        ).join('\n');
    }
    
    /**
     * 로그 다운로드
     */
    download() {
        const content = this.export();
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `nikke_battle_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // 타입별 로그 메서드
    info(time, message) {
        this.log(time, message, 'info');
    }
    
    damage(time, message) {
        this.log(time, message, 'damage');
    }
    
    crit(time, message) {
        this.log(time, message, 'crit');
    }
    
    buff(time, message) {
        this.log(time, message, 'buff');
    }
    
    skill(time, message) {
        this.log(time, message, 'skill');
    }
    
    reload(time, message) {
        this.log(time, message, 'reload');
    }
}

// 전역 로거
const logger = new Logger();

// 내보내기
window.Logger = Logger;
window.logger = logger;