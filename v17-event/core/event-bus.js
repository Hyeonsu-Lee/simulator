// core/event-bus.js - 중앙 이벤트 시스템 (개선된 버전)

class EventBus {
    constructor() {
        this.events = new Map();
        this.eventQueue = [];
        this.processing = false;
        this.eventId = 0;
        this.batchSize = 100; // 배치 처리 크기
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
     * 이벤트 발행
     * @param {string} eventType 
     * @param {Object} data 
     * @param {Object} options - { immediate: boolean }
     */
    emit(eventType, data = {}, options = {}) {
        if (this.destroyed) {
            console.warn('EventBus has been destroyed');
            return;
        }
        
        const { immediate = false } = options;
        
        // 구독자가 없으면 조기 종료 (성능 최적화)
        if (!this.hasHandlers(eventType) && !immediate) {
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
        
        if (immediate) {
            // 즉시 처리
            this.processEvent(event);
        } else {
            // 큐에 추가
            this.eventQueue.push(event);
            
            if (!this.processing) {
                this.processQueue();
            }
        }
    }
    
    /**
     * 이벤트 큐 처리 (배치 처리 지원)
     */
    async processQueue() {
        if (this.processing || this.eventQueue.length === 0) {
            return;
        }
        
        this.processing = true;
        
        try {
            while (this.eventQueue.length > 0) {
                // 배치 추출
                const batch = this.eventQueue.splice(0, this.batchSize);
                
                // 배치 처리
                await this.processBatch(batch);
                
                // CPU 양보
                if (this.eventQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
        } finally {
            this.processing = false;
        }
    }
    
    /**
     * 배치 처리
     * @param {Array} batch - 이벤트 배열
     */
    async processBatch(batch) {
        // 이벤트 타입별로 그룹화
        const groupedEvents = new Map();
        
        batch.forEach(event => {
            if (!groupedEvents.has(event.type)) {
                groupedEvents.set(event.type, []);
            }
            groupedEvents.get(event.type).push(event);
        });
        
        // 타입별로 병렬 처리
        const promises = [];
        
        for (const [eventType, events] of groupedEvents) {
            const handlers = this.events.get(eventType);
            if (!handlers || handlers.length === 0) continue;
            
            // 동일 타입의 이벤트들을 순차 처리
            const promise = this.processEventGroup(events, handlers);
            promises.push(promise);
        }
        
        await Promise.all(promises);
    }
    
    /**
     * 이벤트 그룹 처리
     * @param {Array} events - 동일 타입의 이벤트들
     * @param {Array} handlers - 핸들러 배열
     */
    async processEventGroup(events, handlers) {
        for (const event of events) {
            await this.executeHandlers(event, [...handlers]);
        }
    }
    
    /**
     * 단일 이벤트 처리
     * @param {Object} event - 이벤트 객체
     */
    processEvent(event) {
        const handlers = this.events.get(event.type);
        if (handlers && handlers.length > 0) {
            this.executeHandlers(event, [...handlers]);
        }
    }
    
    /**
     * 핸들러 실행
     * @param {Object} event - 이벤트 객체
     * @param {Array} handlers - 핸들러 배열
     */
    async executeHandlers(event, handlers) {
        const toRemove = [];
        
        for (const handlerInfo of handlers) {
            try {
                await handlerInfo.handler(event);
                this.metrics.processedEvents++;
                
                // once 옵션인 경우 제거 대상에 추가
                if (handlerInfo.once) {
                    toRemove.push(handlerInfo.id);
                }
            } catch (error) {
                this.metrics.failedEvents++;
                console.error(`Error in handler for ${event.type}:`, error);
                
                // 에러 이벤트 발생
                if (event.type !== 'error') {
                    this.emit('error', {
                        originalEvent: event,
                        error: error.message,
                        stack: error.stack
                    }, { immediate: true });
                }
            }
        }
        
        // once 핸들러 제거
        if (toRemove.length > 0) {
            const currentHandlers = this.events.get(event.type);
            if (currentHandlers) {
                this.events.set(
                    event.type,
                    currentHandlers.filter(h => !toRemove.includes(h.id))
                );
            }
        }
    }
    
    /**
     * 이벤트 대기
     * @param {string} eventType - 대기할 이벤트 타입
     * @param {Function} condition - 조건 함수 (선택적)
     * @param {number} timeout - 타임아웃 (밀리초)
     * @returns {Promise} 이벤트 데이터
     */
    waitFor(eventType, condition = null, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                unsubscribe();
                reject(new Error(`Timeout waiting for ${eventType}`));
            }, timeout);
            
            const unsubscribe = this.once(eventType, (event) => {
                if (!condition || condition(event)) {
                    clearTimeout(timer);
                    resolve(event);
                } else {
                    // 조건이 맞지 않으면 다시 대기
                    unsubscribe();
                    this.waitFor(eventType, condition, timeout - (Date.now() - event.timestamp))
                        .then(resolve)
                        .catch(reject);
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
        this.eventQueue = [];
    }
    
    /**
     * 메트릭 조회
     * @returns {Object} 메트릭 정보
     */
    getMetrics() {
        return {
            ...this.metrics,
            queueLength: this.eventQueue.length,
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
     * 배치 크기 설정
     * @param {number} size - 배치 크기
     */
    setBatchSize(size) {
        this.batchSize = Math.max(1, size);
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
        this.eventQueue = [];
        this.processing = false;
    }
}

// 전역 노출
window.EventBus = EventBus;

// 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBus;
}