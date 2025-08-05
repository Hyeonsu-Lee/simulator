// core/time-manager.js - 시뮬레이션 시간 관리 (하이브리드 버전)

class TimeManager {
    constructor() {
        this.events = [];
        this.currentTime = 0;
        this.speedMultiplier = 1;
        this.running = false;
        this.eventId = 0;
        this.processingTime = 0; // 현재 처리 중인 이벤트의 시간
        this.frameCallbacks = []; // 프레임 콜백
        this.repeatingEvents = new Map(); // 반복 이벤트 관리
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
            // console.warn(`Event scheduled in the past: ${type} at ${time}, reference: ${referenceTime}`);
            
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
        
        // 이진 검색으로 삽입 위치 찾기 (성능 개선)
        const insertIndex = this.findInsertIndex(time, priority);
        this.events.splice(insertIndex, 0, event);
        
        return event.id;
    }
    
    /**
     * 반복 이벤트 스케줄
     * @param {number} startTime - 시작 시간
     * @param {number} interval - 반복 간격
     * @param {string} type - 이벤트 타입
     * @param {Object} data - 이벤트 데이터
     * @param {number} count - 반복 횟수 (Infinity 가능)
     * @param {number} priority - 우선순위
     */
    scheduleRepeating(startTime, interval, type, data = {}, count = Infinity, priority = 5) {
        const repeatingId = ++this.eventId;
        
        this.repeatingEvents.set(repeatingId, {
            type,
            data,
            interval,
            count,
            priority,
            currentCount: 0,
            nextTime: startTime
        });
        
        // 첫 번째 이벤트 스케줄
        this.schedule(startTime, type, { ...data, repeatingId }, priority);
        
        return repeatingId;
    }
    
    /**
     * 반복 이벤트 취소
     * @param {number} repeatingId
     */
    cancelRepeating(repeatingId) {
        this.repeatingEvents.delete(repeatingId);
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
     * 시간 진행
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
            
            // 반복 이벤트 처리
            if (event.data.repeatingId) {
                const repeating = this.repeatingEvents.get(event.data.repeatingId);
                if (repeating) {
                    repeating.currentCount++;
                    
                    if (repeating.currentCount < repeating.count) {
                        // 다음 반복 스케줄
                        repeating.nextTime += repeating.interval;
                        this.schedule(
                            repeating.nextTime,
                            repeating.type,
                            { ...repeating.data, repeatingId: event.data.repeatingId },
                            repeating.priority
                        );
                    } else {
                        // 반복 완료
                        this.repeatingEvents.delete(event.data.repeatingId);
                    }
                }
            }
        }
        
        // 모든 이벤트 처리 후 시간 업데이트
        this.currentTime = untilTime;
        this.processingTime = 0;
        
        return processed;
    }
    
    /**
     * 프레임 콜백 등록
     */
    onFrame(callback) {
        this.frameCallbacks.push(callback);
        return () => {
            const index = this.frameCallbacks.indexOf(callback);
            if (index > -1) {
                this.frameCallbacks.splice(index, 1);
            }
        };
    }
    
    /**
     * 현재 이벤트 시간 반환
     * @returns {number}
     */
    getEventTime() {
        return this.processingTime || this.currentTime;
    }
    
    /**
     * 시뮬레이션 실행 (하이브리드 - 외부에서 프레임 루프 관리)
     * @param {number} duration 
     * @param {number} speed 
     * @param {Function} onTick 
     */
    run(duration, speed = 1, onTick = null) {
        console.log(`[TimeManager] Starting run for ${duration}s at ${speed}x speed`);
        
        this.running = true;
        this.speedMultiplier = speed;
        
        // 실제 프레임 루프는 외부(main.js)에서 관리
        // 여기서는 상태만 설정하고 프레임 처리 메서드 제공
        
        return {
            duration,
            speed,
            processFrame: (deltaTime) => this.processFrame(deltaTime, duration, onTick)
        };
    }
    
    /**
     * 프레임 처리 (동기)
     */
    processFrame(deltaTime, duration, onTick) {
        if (!this.running) return false;
        
        const simulatedDelta = deltaTime * this.speedMultiplier;
        const targetTime = Math.min(this.currentTime + simulatedDelta, duration);
        
        // 이벤트 처리
        const events = this.advance(targetTime);
        
        // 이벤트를 시간 순서대로 처리
        for (const event of events) {
            // 각 이벤트 처리 전에 시간 동기화
            this.processingTime = event.time;
            
            // 전역 eventBus 사용
            if (window.eventBus) {
                window.eventBus.emit(event.type, event.data);
            }
        }
        this.processingTime = 0;
        
        // 틱 콜백
        if (onTick) {
            onTick(this.currentTime);
        }
        
        // TICK 이벤트
        if (window.eventBus && typeof Events !== 'undefined') {
            window.eventBus.emit(Events.TICK, { time: this.currentTime });
        }
        
        // 프레임 콜백 실행
        this.frameCallbacks.forEach(callback => {
            try {
                callback(this.currentTime, deltaTime);
            } catch (error) {
                console.error('Error in frame callback:', error);
            }
        });
        
        // 완료 여부 반환
        if (this.currentTime >= duration) {
            console.log(`[TimeManager] Run completed at ${this.currentTime}s`);
            this.running = false;
            return false;
        }
        
        return true;
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
        this.repeatingEvents.clear();
    }
    
    /**
     * 다음 이벤트 시간
     */
    getNextEventTime() {
        return this.events.length > 0 ? this.events[0].time : Infinity;
    }
    
    /**
     * 현재 큐 크기
     */
    getQueueSize() {
        return this.events.length;
    }
    
    /**
     * 시뮬레이션 진행률
     */
    getProgress(duration) {
        return Math.min(this.currentTime / duration, 1.0);
    }
}

// 전역 노출
if (typeof window !== 'undefined') {
    window.TimeManager = TimeManager;
}

// 내보내기
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeManager;
}