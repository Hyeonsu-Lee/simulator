// core/event-recorder.js - 이벤트 기록/재생 시스템

class EventRecorder {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.recordings = new Map();
        this.currentRecording = null;
        this.isRecording = false;
        this.isReplaying = false;
        this.replaySpeed = 1;
        this.filters = new Set();
    }
    
    /**
     * 기록 시작
     * @param {string} recordingName - 기록 이름
     * @param {Object} options - 기록 옵션
     */
    startRecording(recordingName, options = {}) {
        if (this.isRecording) {
            throw new Error('Already recording');
        }
        
        const {
            includeTypes = null,
            excludeTypes = null,
            maxEvents = 10000,
            maxDuration = 300000 // 5분
        } = options;
        
        this.currentRecording = {
            name: recordingName,
            startTime: Date.now(),
            events: [],
            metadata: {
                includeTypes,
                excludeTypes,
                maxEvents,
                maxDuration
            }
        };
        
        this.isRecording = true;
        
        // 이벤트 리스너 등록
        this.recordingHandler = (eventType) => (event) => {
            if (this.shouldRecordEvent(eventType, event)) {
                this.recordEvent(eventType, event);
            }
        };
        
        // 모든 이벤트 타입에 대해 리스너 등록
        const allEventTypes = Object.values(Events);
        allEventTypes.forEach(eventType => {
            this.eventBus.on(eventType, this.recordingHandler(eventType));
        });
        
        console.log(`Recording started: ${recordingName}`);
    }
    
    /**
     * 기록 중지
     * @returns {Object} 기록 데이터
     */
    stopRecording() {
        if (!this.isRecording) {
            throw new Error('Not recording');
        }
        
        this.isRecording = false;
        
        const recording = {
            ...this.currentRecording,
            endTime: Date.now(),
            duration: Date.now() - this.currentRecording.startTime
        };
        
        // 기록 저장
        this.recordings.set(recording.name, recording);
        
        // 리스너 정리 (실제로는 더 정교한 정리 필요)
        console.log(`Recording stopped: ${recording.name} (${recording.events.length} events)`);
        
        this.currentRecording = null;
        return recording;
    }
    
    /**
     * 이벤트 기록 여부 결정
     * @param {string} eventType - 이벤트 타입
     * @param {Object} event - 이벤트 객체
     * @returns {boolean}
     */
    shouldRecordEvent(eventType, event) {
        if (!this.isRecording) return false;
        
        const { includeTypes, excludeTypes } = this.currentRecording.metadata;
        
        // 필터 적용
        if (includeTypes && !includeTypes.includes(eventType)) return false;
        if (excludeTypes && excludeTypes.includes(eventType)) return false;
        if (this.filters.size > 0 && !this.filters.has(eventType)) return false;
        
        // 최대 이벤트 수 확인
        if (this.currentRecording.events.length >= this.currentRecording.metadata.maxEvents) {
            console.warn('Max events reached, stopping recording');
            this.stopRecording();
            return false;
        }
        
        // 최대 시간 확인
        const elapsed = Date.now() - this.currentRecording.startTime;
        if (elapsed >= this.currentRecording.metadata.maxDuration) {
            console.warn('Max duration reached, stopping recording');
            this.stopRecording();
            return false;
        }
        
        return true;
    }
    
    /**
     * 이벤트 기록
     * @param {string} eventType - 이벤트 타입
     * @param {Object} event - 이벤트 객체
     */
    recordEvent(eventType, event) {
        const recordedEvent = {
            type: eventType,
            data: this.cloneEventData(event.data),
            timestamp: event.timestamp || Date.now(),
            relativeTime: Date.now() - this.currentRecording.startTime
        };
        
        this.currentRecording.events.push(recordedEvent);
    }
    
    /**
     * 이벤트 데이터 복제
     * @param {*} data - 원본 데이터
     * @returns {*} 복제된 데이터
     */
    cloneEventData(data) {
        // 순환 참조 방지를 위한 간단한 복제
        try {
            return JSON.parse(JSON.stringify(data));
        } catch (error) {
            // JSON 직렬화 불가능한 경우 얕은 복사
            return { ...data };
        }
    }
    
    /**
     * 기록 재생
     * @param {string} recordingName - 기록 이름
     * @param {Object} options - 재생 옵션
     */
    async replay(recordingName, options = {}) {
        if (this.isReplaying) {
            throw new Error('Already replaying');
        }
        
        const recording = this.recordings.get(recordingName);
        if (!recording) {
            throw new Error(`Recording not found: ${recordingName}`);
        }
        
        const {
            speed = 1,
            startFrom = 0,
            endAt = recording.events.length,
            beforeEvent = null,
            afterEvent = null
        } = options;
        
        this.isReplaying = true;
        this.replaySpeed = speed;
        
        console.log(`Replaying: ${recordingName} at ${speed}x speed`);
        
        // 이벤트 재생
        for (let i = startFrom; i < endAt && this.isReplaying; i++) {
            const event = recording.events[i];
            const nextEvent = recording.events[i + 1];
            
            // 이벤트 전 콜백
            if (beforeEvent) {
                await beforeEvent(event, i);
            }
            
            // 이벤트 발생
            this.eventBus.emit(event.type, event.data);
            
            // 이벤트 후 콜백
            if (afterEvent) {
                await afterEvent(event, i);
            }
            
            // 다음 이벤트까지 대기
            if (nextEvent && speed > 0) {
                const delay = (nextEvent.relativeTime - event.relativeTime) / speed;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        this.isReplaying = false;
        console.log('Replay completed');
    }
    
    /**
     * 재생 중지
     */
    stopReplay() {
        this.isReplaying = false;
    }
    
    /**
     * 기록 내보내기
     * @param {string} recordingName - 기록 이름
     * @returns {string} JSON 문자열
     */
    exportRecording(recordingName) {
        const recording = this.recordings.get(recordingName);
        if (!recording) {
            throw new Error(`Recording not found: ${recordingName}`);
        }
        
        return JSON.stringify(recording, null, 2);
    }
    
    /**
     * 기록 가져오기
     * @param {string} jsonData - JSON 문자열
     * @returns {string} 기록 이름
     */
    importRecording(jsonData) {
        const recording = JSON.parse(jsonData);
        this.recordings.set(recording.name, recording);
        return recording.name;
    }
    
    /**
     * 기록 분석
     * @param {string} recordingName - 기록 이름
     * @returns {Object} 분석 결과
     */
    analyzeRecording(recordingName) {
        const recording = this.recordings.get(recordingName);
        if (!recording) {
            throw new Error(`Recording not found: ${recordingName}`);
        }
        
        const analysis = {
            totalEvents: recording.events.length,
            duration: recording.duration,
            eventsPerSecond: recording.events.length / (recording.duration / 1000),
            eventTypes: {},
            timeline: []
        };
        
        // 이벤트 타입별 통계
        recording.events.forEach(event => {
            if (!analysis.eventTypes[event.type]) {
                analysis.eventTypes[event.type] = {
                    count: 0,
                    averageInterval: 0,
                    lastTime: 0
                };
            }
            
            const typeStats = analysis.eventTypes[event.type];
            typeStats.count++;
            
            if (typeStats.lastTime > 0) {
                const interval = event.relativeTime - typeStats.lastTime;
                typeStats.averageInterval = 
                    (typeStats.averageInterval * (typeStats.count - 1) + interval) / typeStats.count;
            }
            typeStats.lastTime = event.relativeTime;
        });
        
        // 타임라인 생성 (1초 단위)
        const timelineBuckets = Math.ceil(recording.duration / 1000);
        for (let i = 0; i < timelineBuckets; i++) {
            analysis.timeline.push({
                second: i,
                events: 0
            });
        }
        
        recording.events.forEach(event => {
            const bucket = Math.floor(event.relativeTime / 1000);
            if (bucket < analysis.timeline.length) {
                analysis.timeline[bucket].events++;
            }
        });
        
        return analysis;
    }
    
    /**
     * 기록 목록
     * @returns {Array} 기록 정보 배열
     */
    listRecordings() {
        return Array.from(this.recordings.entries()).map(([name, recording]) => ({
            name,
            eventCount: recording.events.length,
            duration: recording.duration,
            startTime: new Date(recording.startTime).toISOString(),
            endTime: new Date(recording.endTime).toISOString()
        }));
    }
    
    /**
     * 기록 삭제
     * @param {string} recordingName - 기록 이름
     */
    deleteRecording(recordingName) {
        return this.recordings.delete(recordingName);
    }
    
    /**
     * 모든 기록 삭제
     */
    clearRecordings() {
        this.recordings.clear();
    }
    
    /**
     * 필터 추가
     * @param {string} eventType - 이벤트 타입
     */
    addFilter(eventType) {
        this.filters.add(eventType);
    }
    
    /**
     * 필터 제거
     * @param {string} eventType - 이벤트 타입
     */
    removeFilter(eventType) {
        this.filters.delete(eventType);
    }
    
    /**
     * 모든 필터 제거
     */
    clearFilters() {
        this.filters.clear();
    }
}

// 전역 노출
window.EventRecorder = EventRecorder;