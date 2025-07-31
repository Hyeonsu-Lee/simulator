// infrastructure/logger.js - 로깅 시스템 (개선된 버전)

class Logger {
    constructor() {
        this.logs = [];
        this.maxDisplayLogs = 50;
        this.logHandlers = new Set();
        this.logLevel = (typeof LogLevel !== 'undefined' ? LogLevel.INFO : 1); // LogLevel이 있으면 사용, 없으면 기본값
        this.maxLogs = 10000; // 최대 로그 수 제한
    }
    
    /**
     * 로그 레벨 설정
     * @param {number} level - LogLevel 상수
     */
    setLogLevel(level) {
        this.logLevel = level;
    }
    
    /**
     * 로그 추가
     * @param {number} time 
     * @param {string} message 
     * @param {string} type 
     * @param {number} level 
     */
    log(time, message, type = 'info', level = LogLevel.INFO) {
        // 로그 레벨 체크
        if (level < this.logLevel) {
            return;
        }
        
        const entry = {
            time,
            message,
            type,
            level,
            timestamp: Date.now()
        };
        
        // 최대 로그 수 체크
        if (this.logs.length >= this.maxLogs) {
            this.logs.shift(); // 가장 오래된 로그 제거
        }
        
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
        if (typeof eventBus !== 'undefined' && typeof Events !== 'undefined') {
            eventBus.emit(Events.LOG_MESSAGE, entry);
        }
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
     * @param {number} minLevel - 최소 로그 레벨
     */
    getRecentLogs(count = this.maxDisplayLogs, minLevel = LogLevel.DEBUG) {
        return this.logs
            .filter(log => log.level >= minLevel)
            .slice(-count);
    }
    
    /**
     * 전체 로그 반환
     * @param {number} minLevel - 최소 로그 레벨
     */
    getAllLogs(minLevel = LogLevel.DEBUG) {
        return this.logs.filter(log => log.level >= minLevel);
    }
    
    /**
     * 로그 초기화
     */
    clear() {
        this.logs = [];
        if (typeof eventBus !== 'undefined' && typeof Events !== 'undefined') {
            eventBus.emit(Events.LOG_MESSAGE, null);
        }
    }
    
    /**
     * 로그 내보내기
     * @param {number} minLevel - 최소 로그 레벨
     */
    export(minLevel = LogLevel.DEBUG) {
        return this.logs
            .filter(log => log.level >= minLevel)
            .map(log => {
                const levelName = this.getLevelName(log.level);
                return `[${log.time.toFixed(3)}s] [${levelName}] ${log.message}`;
            })
            .join('\n');
    }
    
    /**
     * 로그 다운로드
     * @param {number} minLevel - 최소 로그 레벨
     */
    download(minLevel = LogLevel.DEBUG) {
        const content = this.export(minLevel);
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
    
    /**
     * 로그 레벨 이름 가져오기
     * @param {number} level 
     * @returns {string}
     */
    getLevelName(level) {
        if (typeof LogLevel !== 'undefined') {
            switch(level) {
                case LogLevel.DEBUG: return 'DEBUG';
                case LogLevel.INFO: return 'INFO';
                case LogLevel.WARN: return 'WARN';
                case LogLevel.ERROR: return 'ERROR';
                case LogLevel.CRITICAL: return 'CRITICAL';
                default: return 'UNKNOWN';
            }
        } else {
            // LogLevel이 없으면 숫자로 처리
            switch(level) {
                case 0: return 'DEBUG';
                case 1: return 'INFO';
                case 2: return 'WARN';
                case 3: return 'ERROR';
                case 4: return 'CRITICAL';
                default: return 'UNKNOWN';
            }
        }
    }
    
    // 타입별 로그 메서드 (레벨 포함)
    debug(time, message) {
        this.log(time, message, 'debug', typeof LogLevel !== 'undefined' ? LogLevel.DEBUG : 0);
    }
    
    info(time, message) {
        this.log(time, message, 'info', typeof LogLevel !== 'undefined' ? LogLevel.INFO : 1);
    }
    
    damage(time, message) {
        this.log(time, message, 'damage', typeof LogLevel !== 'undefined' ? LogLevel.INFO : 1);
    }
    
    crit(time, message) {
        this.log(time, message, 'crit', typeof LogLevel !== 'undefined' ? LogLevel.INFO : 1);
    }
    
    buff(time, message) {
        this.log(time, message, 'buff', typeof LogLevel !== 'undefined' ? LogLevel.INFO : 1);
    }
    
    skill(time, message) {
        this.log(time, message, 'skill', typeof LogLevel !== 'undefined' ? LogLevel.INFO : 1);
    }
    
    reload(time, message) {
        this.log(time, message, 'reload', typeof LogLevel !== 'undefined' ? LogLevel.INFO : 1);
    }
    
    warn(time, message) {
        this.log(time, message, 'warn', typeof LogLevel !== 'undefined' ? LogLevel.WARN : 2);
    }
    
    error(time, message) {
        this.log(time, message, 'error', typeof LogLevel !== 'undefined' ? LogLevel.ERROR : 3);
    }
    
    critical(time, message) {
        this.log(time, message, 'critical', typeof LogLevel !== 'undefined' ? LogLevel.CRITICAL : 4);
    }
    
    /**
     * 로그 통계
     * @returns {Object} 로그 통계 정보
     */
    getStatistics() {
        const stats = {
            total: this.logs.length,
            byLevel: {},
            byType: {}
        };
        
        // 레벨별 통계
        if (typeof LogLevel !== 'undefined') {
            for (const level in LogLevel) {
                const levelValue = LogLevel[level];
                stats.byLevel[level] = this.logs.filter(log => log.level === levelValue).length;
            }
        } else {
            // LogLevel이 없으면 숫자로 처리
            stats.byLevel['DEBUG'] = this.logs.filter(log => log.level === 0).length;
            stats.byLevel['INFO'] = this.logs.filter(log => log.level === 1).length;
            stats.byLevel['WARN'] = this.logs.filter(log => log.level === 2).length;
            stats.byLevel['ERROR'] = this.logs.filter(log => log.level === 3).length;
            stats.byLevel['CRITICAL'] = this.logs.filter(log => log.level === 4).length;
        }
        
        // 타입별 통계
        this.logs.forEach(log => {
            if (!stats.byType[log.type]) {
                stats.byType[log.type] = 0;
            }
            stats.byType[log.type]++;
        });
        
        return stats;
    }
    
    /**
     * 리소스 정리
     */
    destroy() {
        this.logs = [];
        this.logHandlers.clear();
    }
}

// 전역 노출 (LogLevel 중복 선언 제거)
window.Logger = Logger;
window.logger = null; // main.js에서 인스턴스 생성

// 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Logger;
}