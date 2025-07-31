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
 * 산포도 계산
 * @param {string} weaponType - 무기 타입
 * @param {number} accuracy - 명중률 보정
 * @returns {number} 산포도 직경
 */
function calculateSpreadDiameter(weaponType, accuracy) {
    const baseAccuracy = BASE_ACCURACY[weaponType] || 50;
    const coefficient = SPREAD_COEFFICIENT[weaponType] || 0.5;
    
    // 명중률이 높을수록 산포도가 작아짐
    const totalAccuracy = baseAccuracy + accuracy;
    const spread = 100 / (1 + totalAccuracy / 100) * coefficient;
    
    return Math.max(5, spread); // 최소 산포도 5
}

/**
 * 코어 히트율 계산
 * @param {number} spread - 산포도
 * @param {number} coreSize - 코어 크기
 * @param {string} weaponType - 무기 타입
 * @returns {number} 0~1 사이의 확률
 */
function calculateCoreHitRate(spread, coreSize, weaponType) {
    if (coreSize === 0) return 0;
    
    // 산포도가 작을수록, 코어가 클수록 히트율 증가
    let hitRate = coreSize / spread;
    
    // 무기별 보정
    if (weaponType === 'SR' || weaponType === 'RL') {
        hitRate *= 1.2; // 저격총/로켓은 명중률 보정
    } else if (weaponType === 'SG') {
        hitRate *= 0.8; // 샷건은 펠릿 분산으로 인한 페널티
    }
    
    return Math.min(1, Math.max(0, hitRate));
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