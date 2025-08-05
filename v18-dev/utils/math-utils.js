// utils/math-utils.js - 수학 관련 유틸리티 함수

/**
 * 확률 체크
 * @param {number} probability - 0~1 사이의 확률
 * @returns {boolean}
 */
function checkProbability(probability) {
    return Math.random() < probability;
}

/**
 * 숫자 포맷팅 (천 단위 콤마)
 * @param {number} num - 숫자
 * @returns {string}
 */
function formatNumber(num) {
    if (typeof num !== 'number') return '0';
    return Math.floor(num).toLocaleString('ko-KR');
}

/**
 * 표준편차 계산
 * @param {number[]} values - 숫자 배열
 * @returns {number}
 */
function standardDeviation(values) {
    if (values.length === 0) return 0;
    
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, value) => sum + value, 0) / values.length;
    
    return Math.sqrt(avgSquareDiff);
}

/**
 * 범위 내 랜덤 정수
 * @param {number} min - 최소값 (포함)
 * @param {number} max - 최대값 (포함)
 * @returns {number}
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 가중치 랜덤 선택
 * @param {Array} items - [{value, weight}] 형태의 배열
 * @returns {*} 선택된 아이템의 value
 */
function weightedRandom(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of items) {
        random -= item.weight;
        if (random <= 0) {
            return item.value;
        }
    }
    
    return items[items.length - 1].value;
}

/**
 * 선형 보간
 * @param {number} a - 시작값
 * @param {number} b - 종료값
 * @param {number} t - 0~1 사이의 보간 계수
 * @returns {number}
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * 값 제한
 * @param {number} value - 값
 * @param {number} min - 최소값
 * @param {number} max - 최대값
 * @returns {number}
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}