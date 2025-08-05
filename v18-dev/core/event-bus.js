// core/event-bus.js - 중앙 이벤트 시스템 (동기 처리 버전)

class EventBus {
    constructor() {
        this.events = new Map();
        this.eventId = 0;
        this.metrics = {
            totalEvents: 0,
            processedEvents: 0,
            failedEvents: 0,
            eventCounts: new Map()
        };
        this.destroyed = false;
    }
    
    /**
     * 이벤트 핸들러 등록
     * @param {string} eventType 
     * @param {Function} handler 
     * @param {Object} options - { priority: number, once: boolean }
     * @returns {Function} unsubscribe 함수
     */
    on(eventType, handler, options = {}) {
        const { priority = 5, once = false } = options;
        
        if (!this.events.has(eventType)) {
            this.events.set(eventType, []);
        }
        
        const handlerInfo = {
            handler,
            priority,
            once,
            id: ++this.eventId
        };
        
        // 우선순위에 따라 정렬하여 삽입
        const handlers = this.events.get(eventType);
        const insertIndex = handlers.findIndex(h => h.priority > priority);
        
        if (insertIndex === -1) {
            handlers.push(handlerInfo);
        } else {
            handlers.splice(insertIndex, 0, handlerInfo);
        }
        
        // unsubscribe 함수 반환
        return () => {
            const handlers = this.events.get(eventType);
            if (handlers) {
                const index = handlers.findIndex(h => h.id === handlerInfo.id);
                if (index !== -1) {
                    handlers.splice(index, 1);
                }
            }
        };
    }
    
    /**
     * 한 번만 실행되는 이벤트 핸들러
     * @param {string} eventType 
     * @param {Function} handler 
     * @param {Object} options 
     * @returns {Function} unsubscribe 함수
     */
    once(eventType, handler, options = {}) {
        return this.on(eventType, handler, { ...options, once: true });
    }
    
    /**
     * 이벤트 발행 (동기 처리)
     * @param {string} eventType 
     * @param {Object} data 
     * @param {Object} options - 호환성을 위해 유지하지만 사용하지 않음
     */
    emit(eventType, data = {}, options = {}) {
        if (this.destroyed) {
            console.warn('EventBus has been destroyed');
            return;
        }
        
        const handlers = this.events.get(eventType);
        if (!handlers || handlers.length === 0) {
            return;
        }
        
        const event = {
            id: ++this.eventId,
            type: eventType,
            data: data,
            timestamp: Date.now()
        };
        
        // 메트릭 업데이트
        this.metrics.totalEvents++;
        this.metrics.eventCounts.set(
            eventType, 
            (this.metrics.eventCounts.get(eventType) || 0) + 1
        );
        
        // 핸들러 복사본 생성 (once 처리를 위해)
        const handlersToProcess = [...handlers];
        
        // 동기 처리
        handlersToProcess.forEach(handlerInfo => {
            try {
                // once 옵션 처리
                if (handlerInfo.once) {
                    const index = handlers.findIndex(h => h.id === handlerInfo.id);
                    if (index !== -1) {
                        handlers.splice(index, 1);
                    }
                }
                
                // 핸들러 실행
                handlerInfo.handler(event);
                this.metrics.processedEvents++;
                
            } catch (error) {
                this.metrics.failedEvents++;
                console.error(`Error in handler for ${eventType}:`, error);
            }
        });
    }
    
    /**
     * 특정 이벤트 대기
     * @param {string} eventType - 대기할 이벤트 타입
     * @param {Function} predicate - 조건 함수 (선택적)
     * @param {number} timeout - 타임아웃 (ms)
     * @returns {Promise} 이벤트 데이터
     */
    waitFor(eventType, predicate = null, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                unsubscribe();
                reject(new Error(`Timeout waiting for ${eventType}`));
            }, timeout);
            
            const unsubscribe = this.once(eventType, (event) => {
                if (!predicate || predicate(event)) {
                    clearTimeout(timer);
                    resolve(event);
                }
            });
        });
    }
    
    /**
     * 여러 이벤트 대기
     * @param {Array} eventTypes - 대기할 이벤트 타입들
     * @param {number} timeout - 타임아웃
     * @returns {Promise} 첫 번째 발생한 이벤트
     */
    waitForAny(eventTypes, timeout = 5000) {
        return Promise.race(
            eventTypes.map(eventType => this.waitFor(eventType, null, timeout))
        );
    }
    
    /**
     * 모든 이벤트 핸들러 제거
     * @param {string} eventType - 이벤트 타입 (선택적)
     */
    clear(eventType = null) {
        if (eventType) {
            this.events.delete(eventType);
        } else {
            this.events.clear();
        }
    }
    
    /**
     * 메트릭 조회
     * @returns {Object} 메트릭 정보
     */
    getMetrics() {
        return {
            ...this.metrics,
            handlerCounts: Array.from(this.events.entries()).map(([type, handlers]) => ({
                type,
                count: handlers.length
            }))
        };
    }
    
    /**
     * 메트릭 리셋
     */
    resetMetrics() {
        this.metrics = {
            totalEvents: 0,
            processedEvents: 0,
            failedEvents: 0,
            eventCounts: new Map()
        };
    }
    
    /**
     * 이벤트 타입 존재 여부 확인
     * @param {string} eventType - 이벤트 타입
     * @returns {boolean}
     */
    hasHandlers(eventType) {
        const handlers = this.events.get(eventType);
        return handlers && handlers.length > 0;
    }
    
    /**
     * 이벤트 버스 종료
     */
    destroy() {
        this.destroyed = true;
        this.clear();
    }
}

// 전역 노출
window.EventBus = EventBus;
