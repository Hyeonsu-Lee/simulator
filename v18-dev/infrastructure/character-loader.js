// infrastructure/character-loader.js - 캐릭터 데이터 로더

class CharacterLoader {
    constructor() {
        this.registry = new Map();        // 메타데이터 (id, name)
        this.pendingLoads = new Set();    // 로드 예정 목록
        this.loadedCharacters = new Map(); // 실제 로드된 캐릭터 데이터
        this.loaded = false;              // 레지스트리 로드 완료 여부
    }
    
    /**
     * 레지스트리 및 캐릭터 파일 로드
     */
    async loadAll() {
        if (this.loaded) return;
        
        try {
            // 1. character-registry.js 동적 로드
            await this.loadRegistry();
            
            // 2. 모든 캐릭터 파일 로드 대기
            await this.waitForAllCharacters();
            
            console.log(`Loaded ${this.registry.size} characters`);
            this.loaded = true;
            
        } catch (error) {
            console.error('Failed to load characters:', error);
            this.loadBuiltInSpecs();
            this.loaded = true;
        }
    }
    
    /**
     * 레지스트리 파일 로드
     */
    loadRegistry() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            // 상대 경로 수정 (현재 페이지 기준)
            script.src = './data/characters/character-registry.js';
            
            script.onload = () => {
                if (typeof CHARACTER_REGISTRY !== 'undefined') {
                    // 레지스트리 정보를 Map에 저장
                    CHARACTER_REGISTRY.forEach(char => {
                        this.registry.set(char.id, char);
                    });
                    console.log('Character registry loaded');
                    resolve();
                } else {
                    reject(new Error('CHARACTER_REGISTRY not found'));
                }
            };
            
            script.onerror = () => {
                console.error('Failed to load character-registry.js from:', script.src);
                reject(new Error('Failed to load character-registry.js'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * 모든 캐릭터 파일 로드 대기
     */
    async waitForAllCharacters() {
        const maxAttempts = 50; // 최대 5초 대기
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            const allLoaded = Array.from(this.registry.keys()).every(charId => {
                const globalVarName = `${charId.toUpperCase()}_CHARACTER`;
                return typeof window[globalVarName] !== 'undefined';
            });
            
            if (allLoaded) {
                // 모든 캐릭터 로드 완료
                console.log('All character files loaded');
                return;
            }
            
            // 100ms 대기
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        // 타임아웃 - 로드된 것만 사용
        console.warn('Timeout waiting for character files, using loaded ones');
    }
    
    /**
     * 내장 스펙 로드 (폴백)
     */
    loadBuiltInSpecs() {
        // 최소한의 폴백 데이터
        const fallbackRegistry = [
            { id: "dorothy", name: "도로시" }
        ];
        
        fallbackRegistry.forEach(char => {
            this.registry.set(char.id, char);
        });
        
        // 폴백 캐릭터 데이터도 설정
        if (!window.DOROTHY_CHARACTER) {
            window.DOROTHY_CHARACTER = {
                id: "dorothy",
                name: "도로시",
                weaponType: "SG",
                burstPosition: 3,
                burstCooldown: 40,
                baseStats: {
                    atk: 350254,
                    weaponCoef: 2.015,
                    baseAmmo: 9,
                    basePellets: 10,
                    attackInterval: 0.666,
                    reloadTime: 1.5,
                    chargeMultiplier: 0,
                    penetration: false
                },
                skills: {}
            };
        }
        
        console.log('Loaded fallback character specs');
    }
    
    /**
     * 선택된 캐릭터 로드 (시뮬레이션 시작 시)
     */
    loadSelectedCharacters() {
        const errors = [];
        
        // 중복 제거된 pendingLoads를 순회
        this.pendingLoads.forEach(charId => {
            // 이미 로드된 경우 스킵
            if (this.loadedCharacters.has(charId)) {
                console.log(`Character ${charId} already loaded, skipping`);
                return;
            }
            
            try {
                // 캐릭터 데이터 로드 시도
                const charData = this.loadCharacterData(charId);
                
                // 데이터 검증
                this.validateCharacterData(charId, charData);
                
                // 로드 성공
                this.loadedCharacters.set(charId, charData);
                console.log(`Loaded character ${charId} successfully`);
                
            } catch (error) {
                console.error(`Failed to load character ${charId}:`, error);
                errors.push({
                    characterId: charId,
                    error: error.message
                });
            }
        });
        
        // 에러가 있으면 시뮬레이션 중단
        if (errors.length > 0) {
            const errorMessage = errors.map(e => 
                `${e.characterId}: ${e.error}`
            ).join('\n');
            
            alert(`캐릭터 로드 실패:\n${errorMessage}`);
            throw new Error('Character loading failed');
        }
    }
    
    /**
     * 개별 캐릭터 데이터 로드
     */
    loadCharacterData(characterId) {
        // 전역 변수명 규칙: CHARACTERID_CHARACTER
        const globalVarName = `${characterId.toUpperCase()}_CHARACTER`;
        
        if (typeof window[globalVarName] !== 'undefined') {
            return window[globalVarName];
        }
        
        throw new Error(`Character data not found: ${characterId}`);
    }
    
    /**
     * 캐릭터 데이터 검증
     */
    validateCharacterData(characterId, data) {
        // 필수 필드 검증
        const requiredFields = ['id', 'name', 'weaponType', 'baseStats'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        
        // baseStats 검증
        const requiredStats = ['atk', 'weaponCoef', 'baseAmmo', 'attackInterval', 'reloadTime'];
        const missingStats = requiredStats.filter(stat => 
            data.baseStats[stat] === undefined || data.baseStats[stat] === null
        );
        
        if (missingStats.length > 0) {
            throw new Error(`Missing required baseStats: ${missingStats.join(', ')}`);
        }
        
        // ID 일치 검증
        if (data.id !== characterId) {
            throw new Error(`Character ID mismatch: expected ${characterId}, got ${data.id}`);
        }
    }
    
    /**
     * 펜딩 목록에 추가
     */
    addPending(characterId) {
        if (!characterId) return;
        
        // 레지스트리에 있는지 확인
        if (!this.registry.has(characterId)) {
            console.warn(`Character ${characterId} not in registry`);
            return;
        }
        
        this.pendingLoads.add(characterId);
        console.log(`Added ${characterId} to pending loads`);
    }
    
    /**
     * 펜딩 목록에서 제거
     */
    removePending(characterId) {
        this.pendingLoads.delete(characterId);
        console.log(`Removed ${characterId} from pending loads`);
    }
    
    /**
     * 로드된 캐릭터 제거
     */
    removeLoaded(characterId) {
        if (this.loadedCharacters.has(characterId)) {
            this.loadedCharacters.delete(characterId);
            console.log(`Removed loaded character data for ${characterId}`);
        }
    }
    
    /**
     * 펜딩 목록 초기화
     */
    clearPending() {
        this.pendingLoads.clear();
    }
    
    /**
     * 캐릭터 스펙 가져오기
     */
    getSpec(characterId) {
        // 먼저 로드된 데이터 확인
        if (this.loadedCharacters.has(characterId)) {
            return this.loadedCharacters.get(characterId);
        }
        
        // 전역 변수에서 직접 가져오기 시도
        try {
            const data = this.loadCharacterData(characterId);
            // 검증 없이 바로 반환 (UI용)
            return data;
        } catch (error) {
            console.error(`Failed to get spec for ${characterId}:`, error);
            return null;
        }
    }
    
    /**
     * 모든 캐릭터 ID (레지스트리 기반)
     */
    getAllIds() {
        return Array.from(this.registry.keys());
    }
    
    /**
     * 캐릭터 생성
     */
    createCharacter(characterId, config = {}) {
        const spec = this.getSpec(characterId);
        if (!spec) {
            console.error(`Character spec not found: ${characterId}`);
            return null;
        }
        
        return new Character(spec, config);
    }
    
    /**
     * 디버그 정보
     */
    getDebugInfo() {
        return {
            registrySize: this.registry.size,
            pendingCount: this.pendingLoads.size,
            loadedCount: this.loadedCharacters.size,
            pendingList: Array.from(this.pendingLoads),
            loadedList: Array.from(this.loadedCharacters.keys())
        };
    }
}

/**
 * 캐릭터 클래스
 */
class Character {
    constructor(spec, config = {}) {
        this.id = spec.id;
        this.name = spec.name;
        this.weaponType = spec.weaponType;
        this.burstPosition = spec.burstPosition;
        this.burstCooldown = spec.burstCooldown;
        this.baseStats = { ...spec.baseStats };
        this.skills = spec.skills;
        
        // 설정
        this.level = config.level || 200;
        this.coreLevel = config.coreLevel || 10;
        this.customAtk = config.customAtk || null;
    }
    
    /**
     * 현재 스탯 계산
     */
    getStats() {
        // 기본 스탯 복사
        const stats = { ...this.baseStats };
        
        // 커스텀 공격력이 있으면 적용
        if (this.customAtk !== null && this.customAtk > 0) {
            stats.atk = this.customAtk;
        }
        
        // 레벨과 코어 레벨 효과는 시뮬레이터에서 무시
        // 실제 게임에서는 여기서 계산해야 함
        
        return stats;
    }
}

// 내보내기
window.CharacterLoader = CharacterLoader;
window.Character = Character;