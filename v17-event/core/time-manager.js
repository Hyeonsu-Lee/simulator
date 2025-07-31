// core/time-manager.js - 시뮬레이션 시간 관리

class TimeManager {
    constructor() {
        this.events = [];
        this.currentTime = 0;
        this.speedMultiplier = 1;
        this.running = false;
        this.eventId = 0;
        this.processingTime = 0; // 현재 처리 중인 이벤트의 시간
    }
    
    /**
     * 이벤트 스케줄
     * @param {number} time - 발생 시간
     * @param {string} type - 이벤트 타입
     * @param {Object} data - 이벤트 데이터
     * @param {number} priority - 우선순위 (낮을수록 먼저)
     */
    schedule(time, type, data = {}, priority = 5) {
        // 처리 중인 이벤트 시간을 기준으로 검증
        const referenceTime = this.processingTime || this.currentTime;
        
        if (time < referenceTime) {
            // 디버그용 로그 (프로덕션에서는 제거)
            // console.warn(`[TimeManager] Event scheduled in the past: ${type} at ${time}, reference: ${referenceTime}`);
            
            // 미세하게 미래로 조정
            time = referenceTime + 0.001;
        }
        
        const event = {
            id: ++this.eventId,
            time,
            type,
            data: { ...data }, // 데이터 복사
            priority
        };
        
        // console.log(`[TimeManager] Scheduling event ${type} at ${time}s`);
        
        // 이진 검색으로 삽입 위치 찾기 (성능 개선)
        const insertIndex = this.findInsertIndex(time, priority);
        this.events.splice(insertIndex, 0, event);
        
        return event.id;
    }
    
    /**
     * 이진 검색으로 삽입 위치 찾기
     */
    findInsertIndex(time, priority) {
        let left = 0;
        let right = this.events.length;
        
        while (left < right) {
            const mid = Math.floor((left + right) / 2);
            const event = this.events[mid];
            
            if (event.time < time || (event.time === time && event.priority < priority)) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }
        
        return left;
    }
    
    /**
     * 이벤트 취소
     * @param {number} eventId 
     */
    cancel(eventId) {
        const index = this.events.findIndex(e => e.id === eventId);
        if (index !== -1) {
            this.events.splice(index, 1);
        }
    }
    
    /**
     * 특정 시간까지 진행
     * @param {number} untilTime 
     * @returns {Array} 처리된 이벤트들
     */
    advance(untilTime) {
        const processed = [];
        
        while (this.events.length > 0 && this.events[0].time <= untilTime) {
            const event = this.events.shift();
            
            // 처리 중인 이벤트 시간 설정
            this.processingTime = event.time;
            this.currentTime = event.time;
            
            // 이벤트 데이터에 시간 추가
            const eventData = {
                ...event.data,
                time: event.time
            };
            
            processed.push({
                ...event,
                data: eventData
            });
        }
        
        // 모든 이벤트 처리 후 시간 업데이트
        this.currentTime = untilTime;
        this.processingTime = 0;
        
        return processed;
    }
    
    /**
     * 시뮬레이션 실행
     * @param {number} duration 
     * @param {number} speed 
     * @param {Function} onTick 
     */
    async run(duration, speed = 1, onTick = null) {
        console.log(`[TimeManager] Starting run for ${duration}s at ${speed}x speed`);
        
        this.running = true;
        this.speedMultiplier = speed;
        
        const startRealTime = performance.now();
        const targetRealDuration = (duration * 1000) / speed; // 실제로 걸려야 하는 시간 (ms)
        
        // 프레임 타임 설정 (속도에 따라 조정)
        const baseFrameTime = 16; // 60fps
        const frameTime = speed > 60 ? baseFrameTime / 2 : baseFrameTime; // 고속에서는 더 자주 업데이트
        
        let lastRealTime = startRealTime;
        let lastSimTime = 0;
        
        while (this.running && this.currentTime < duration) {
            const now = performance.now();
            const elapsedReal = now - startRealTime;
            
            // 목표 시뮬레이션 시간 계산
            const targetSimTime = Math.min((elapsedReal / targetRealDuration) * duration, duration);
            
            if (targetSimTime > lastSimTime) {
                // 이벤트 처리
                const events = this.advance(targetSimTime);
                
                // 이벤트를 시간 순서대로 처리
                for (const event of events) {
                    // 각 이벤트 처리 전에 시간 동기화
                    this.processingTime = event.time;
                    
                    // eventBus가 전역이 아닌 container에서 가져오기
                    const eventBus = window.container?.get('eventBus');
                    if (eventBus) {
                        eventBus.emit(event.type, event.data);
                    }
                }
                this.processingTime = 0;
                
                // 틱 콜백
                if (onTick) {
                    onTick(this.currentTime);
                }
                
                // TICK 이벤트 (0.1초마다)
                const lastTickTime = Math.floor(lastSimTime * 10) / 10;
                const currentTickTime = Math.floor(this.currentTime * 10) / 10;
                if (currentTickTime > lastTickTime) {
                    const eventBus = window.container?.get('eventBus');
                    if (eventBus && typeof Events !== 'undefined') {
                        eventBus.emit(Events.TICK, { time: this.currentTime });
                    }
                }
                
                lastSimTime = targetSimTime;
            }
            
            // 프레임 제한
            const frameElapsed = now - lastRealTime;
            if (frameElapsed < frameTime) {
                await new Promise(resolve => setTimeout(resolve, frameTime - frameElapsed));
            } else {
                // CPU 양보
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            
            lastRealTime = performance.now();
        }
        
        // 마지막으로 duration까지 진행
        if (this.currentTime < duration) {
            const events = this.advance(duration);
            for (const event of events) {
                this.processingTime = event.time;
                const eventBus = window.container?.get('eventBus');
                if (eventBus) {
                    eventBus.emit(event.type, event.data);
                }
            }
            this.currentTime = duration;
        }
        
        console.log(`[TimeManager] Run completed at ${this.currentTime}s`);
        this.running = false;
    }
    
    /**
     * 실행 중지
     */
    stop() {
        console.log('[TimeManager] Stopping');
        this.running = false;
    }
    
    /**
     * 리셋
     */
    reset() {
        console.log('[TimeManager] Resetting');
        this.events = [];
        this.currentTime = 0;
        this.processingTime = 0;
        this.running = false;
        this.eventId = 0;
    }
    
    /**
     * 다음 이벤트 시간
     */
    getNextEventTime() {
        return this.events.length > 0 ? this.events[0].time : Infinity;
    }
    
    /**
     * 반복 이벤트 스케줄
     * @param {number} startTime 
     * @param {number} interval 
     * @param {string} type 
     * @param {Object} data 
     * @param {number} count - 반복 횟수 (Infinity 가능)
     */
    scheduleRepeating(startTime, interval, type, data = {}, count = Infinity) {
        let scheduled = 0;
        let time = startTime;
        
        // console.log(`[TimeManager] Scheduling repeating event ${type} every ${interval}s`);
        
        while (scheduled < count && time <= 180) { // 최대 180초
            this.schedule(time, type, data);
            time += interval;
            scheduled++;
        }
        
        return scheduled;
    }
    
    /**
     * 조건부 이벤트 스케줄
     * @param {Function} condition - () => boolean
     * @param {string} type 
     * @param {Object} data 
     * @param {number} checkInterval 
     */
    scheduleConditional(condition, type, data = {}, checkInterval = 0.1) {
        const check = () => {
            if (condition()) {
                const eventBus = window.container?.get('eventBus');
                if (eventBus) {
                    eventBus.emit(type, { ...data, time: this.currentTime });
                }
            } else {
                this.schedule(this.currentTime + checkInterval, 'internal.conditional_check', {
                    originalType: type,
                    originalData: data,
                    condition,
                    checkInterval
                });
            }
        };
        
        check();
    }
    
    /**
     * 현재 처리 중인 시간 가져오기
     * 이벤트 핸들러 내에서 정확한 시간 참조용
     */
    getEventTime() {
        return this.processingTime || this.currentTime;
    }
}

// 전역 노출
window.TimeManager = TimeManager;

// 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeManager;
}