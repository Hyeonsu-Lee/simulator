// core/event-mediator.js - 이벤트 미디에이터 (순환 참조 방지)

class EventMediator {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.requestHandlers = new Map();
        this.responseCallbacks = new Map();
        this.requestId = 0;
        this.cache = new Map();
        this.cacheTimeout = 1000;
        
        this.setupInternalHandlers();
    }
    
    /**
     * 내부 핸들러 설정
     */
    setupInternalHandlers() {
        // Events가 정의되어 있는지 확인
        const REQUEST_EVENT = (typeof Events !== 'undefined') ? Events.MEDIATOR_REQUEST : 'mediator.request';
        const RESPONSE_EVENT = (typeof Events !== 'undefined') ? Events.MEDIATOR_RESPONSE : 'mediator.response';
        
        // 요청 처리
        this.eventBus.on(REQUEST_EVENT, (event) => {
            this.handleRequest(event.data);
        });
        
        // 응답 처리
        this.eventBus.on(RESPONSE_EVENT, (event) => {
            this.handleResponse(event.data);
        });
    }
    
    /**
     * 요청 핸들러 등록
     * @param {string} requestType - 요청 타입
     * @param {Function} handler - 핸들러 함수
     */
    registerHandler(requestType, handler) {
        if (!this.requestHandlers.has(requestType)) {
            this.requestHandlers.set(requestType, new Set());
        }
        this.requestHandlers.get(requestType).add(handler);
    }
    
    /**
     * 요청 전송
     * @param {string} requestType - 요청 타입
     * @param {Object} data - 요청 데이터
     * @param {Object} options - { useCache: boolean, cacheTime: number }
     * @returns {Promise} 응답 Promise
     */
    async request(requestType, data, options = {}) {
        const { useCache = false, cacheTime = this.cacheTimeout } = options;
        
        // 캐시 확인
        if (useCache) {
            const cacheKey = `${requestType}-${JSON.stringify(data)}`;
            const cached = this.cache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < cacheTime) {
                return cached.value;
            }
        }
        
        return new Promise((resolve, reject) => {
            const requestId = ++this.requestId;
            
            // 타임아웃 설정
            const timeout = setTimeout(() => {
                this.responseCallbacks.delete(requestId);
                reject(new Error(`Request timeout: ${requestType}`));
            }, 5000);
            
            // 콜백 저장
            this.responseCallbacks.set(requestId, {
                resolve: (value) => {
                    // 캐시 저장
                    if (useCache) {
                        const cacheKey = `${requestType}-${JSON.stringify(data)}`;
                        this.cache.set(cacheKey, {
                            value,
                            timestamp: Date.now()
                        });
                    }
                    resolve(value);
                },
                reject,
                timeout
            });
            
            // 요청 발송
            const REQUEST_EVENT = (typeof Events !== 'undefined') ? Events.MEDIATOR_REQUEST : 'mediator.request';
            this.eventBus.emit(REQUEST_EVENT, {
                requestId,
                requestType,
                data,
                timestamp: Date.now()
            });
        });
    }
    
    /**
     * 요청 처리
     * @param {Object} request - 요청 객체
     */
    async handleRequest(request) {
        const { requestId, requestType, data } = request;
        const handlers = this.requestHandlers.get(requestType);
        
        const RESPONSE_EVENT = (typeof Events !== 'undefined') ? Events.MEDIATOR_RESPONSE : 'mediator.response';
        
        if (!handlers || handlers.size === 0) {
            this.eventBus.emit(RESPONSE_EVENT, {
                requestId,
                error: `No handler for request type: ${requestType}`
            });
            return;
        }
        
        try {
            // 모든 핸들러 실행 (첫 번째 유효한 응답 사용)
            let result = null;
            for (const handler of handlers) {
                try {
                    result = await handler(data);
                    if (result !== undefined) break;
                } catch (error) {
                    console.error(`Handler error for ${requestType}:`, error);
                }
            }
            
            // 응답 전송
            this.eventBus.emit(RESPONSE_EVENT, {
                requestId,
                result,
                timestamp: Date.now()
            });
        } catch (error) {
            this.eventBus.emit(RESPONSE_EVENT, {
                requestId,
                error: error.message
            });
        }
    }
    
    /**
     * 응답 처리
     * @param {Object} response - 응답 객체
     */
    handleResponse(response) {
        const { requestId, result, error } = response;
        const callback = this.responseCallbacks.get(requestId);
        
        if (!callback) return;
        
        // 타임아웃 클리어
        clearTimeout(callback.timeout);
        this.responseCallbacks.delete(requestId);
        
        // 콜백 실행
        if (error) {
            callback.reject(new Error(error));
        } else {
            callback.resolve(result);
        }
    }
    
    /**
     * 비동기 이벤트 체인 실행
     * @param {Array} chain - [{type, data, transform}] 배열
     * @returns {Promise} 최종 결과
     */
    async executeChain(chain) {
        let result = null;
        
        for (const step of chain) {
            const { type, data, transform } = step;
            
            // 이전 결과를 현재 데이터에 병합
            const requestData = typeof data === 'function' 
                ? data(result) 
                : { ...data, previousResult: result };
            
            // 요청 실행
            result = await this.request(type, requestData);
            
            // 결과 변환
            if (transform && typeof transform === 'function') {
                result = transform(result);
            }
        }
        
        return result;
    }
    
    /**
     * 병렬 요청 실행
     * @param {Array} requests - [{type, data}] 배열
     * @returns {Promise<Array>} 결과 배열
     */
    async requestParallel(requests) {
        const promises = requests.map(req => 
            this.request(req.type, req.data)
        );
        return Promise.all(promises);
    }
    
    /**
     * 조건부 요청 실행
     * @param {string} requestType - 요청 타입
     * @param {Object} data - 요청 데이터
     * @param {Function} condition - 조건 함수
     * @param {*} defaultValue - 조건 미충족 시 기본값
     * @returns {Promise} 결과
     */
    async requestIf(requestType, data, condition, defaultValue = null) {
        if (condition(data)) {
            return this.request(requestType, data);
        }
        return defaultValue;
    }
    
    /**
     * 캐시된 요청
     */
    createCachedRequest(requestType, cacheTime = 1000) {
        let cache = null;
        let cacheExpiry = 0;
        
        return async (data) => {
            const now = Date.now();
            if (cache && now < cacheExpiry) {
                return cache;
            }
            
            cache = await this.request(requestType, data);
            cacheExpiry = now + cacheTime;
            return cache;
        };
    }
    
    /**
     * 핸들러 제거
     * @param {string} requestType - 요청 타입
     * @param {Function} handler - 핸들러 함수
     */
    removeHandler(requestType, handler) {
        const handlers = this.requestHandlers.get(requestType);
        if (handlers) {
            handlers.delete(handler);
        }
    }
    
    /**
     * 모든 핸들러 제거
     */
    clearHandlers() {
        this.requestHandlers.clear();
    }
    
    /**
     * 캐시 초기화
     */
    clearCache() {
        this.cache.clear();
    }
    
    /**
     * 특정 캐시 삭제
     * @param {string} requestType - 요청 타입
     * @param {Object} data - 요청 데이터
     */
    invalidateCache(requestType, data) {
        const cacheKey = `${requestType}-${JSON.stringify(data)}`;
        this.cache.delete(cacheKey);
    }
    
    /**
     * 리소스 정리
     */
    destroy() {
        this.clearHandlers();
        this.clearCache();
        this.responseCallbacks.clear();
    }
}

// 전역 노출
window.EventMediator = EventMediator;

// 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventMediator;
}