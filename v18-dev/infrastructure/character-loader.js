// infrastructure/character-loader.js - 캐릭터 데이터 로더 (개선된 버전)

class CharacterLoader {
    constructor() {
        this.registry = new Map();        // 메타데이터 (id, name)
        this.loadedCharacters = new Map(); // 로드된 캐릭터 데이터
        this.registryLoaded = false;      // 레지스트리 로드 완료 여부
    }
    
    /**
     * 레지스트리만 로드 (초기화 시)
     */
    async loadRegistry() {
        if (this.registryLoaded) return;
        
        try {
            await this.loadRegistryFile();
            console.log(`Character registry loaded: ${this.registry.size} characters`);
            this.registryLoaded = true;
        } catch (error) {
            console.error('Failed to load character registry:', error);
            throw error;
        }
    }
    
    /**
     * 레지스트리 파일 로드
     */
    loadRegistryFile() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = './data/characters/character-registry.js';
            
            script.onload = () => {
                if (typeof CHARACTER_REGISTRY !== 'undefined') {
                    // 레지스트리 정보를 Map에 저장
                    CHARACTER_REGISTRY.forEach(char => {
                        this.registry.set(char.id, char);
                    });
                    resolve();
                } else {
                    reject(new Error('CHARACTER_REGISTRY not found'));
                }
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load character-registry.js'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * 선택된 캐릭터들 로드 (시뮬레이션 시작 시)
     * @param {string[]} characterIds - 로드할 캐릭터 ID 배열
     * @returns {boolean} 성공 여부
     */
    loadSelectedCharacters(characterIds) {
        console.log('[CharacterLoader] Loading characters:', characterIds);
        
        // 중복 제거
        const uniqueIds = [...new Set(characterIds.filter(id => id))];
        
        for (const charId of uniqueIds) {
            // 이미 로드된 경우 스킵
            if (this.loadedCharacters.has(charId)) {
                console.log(`[CharacterLoader] ${charId} already loaded, skipping`);
                continue;
            }
            
            try {
                // 캐릭터 데이터 로드 (동기적)
                const charData = this.loadCharacterData(charId);
                
                // 데이터 검증
                this.validateCharacterData(charId, charData);
                
                // 로드 성공
                this.loadedCharacters.set(charId, charData);
                console.log(`[CharacterLoader] Loaded ${charId} successfully`);
                
            } catch (error) {
                console.error(`[CharacterLoader] Failed to load ${charId}:`, error.message);
                return false; // 하나라도 실패하면 false 반환
            }
        }
        
        return true; // 모두 성공
    }
    
    /**
     * 개별 캐릭터 데이터 로드 (동기적)
     */
    loadCharacterData(characterId) {
        // 전역 변수명 규칙: CHARACTERID_CHARACTER
        const globalVarName = `${characterId.toUpperCase()}_CHARACTER`;
        
        if (typeof window[globalVarName] === 'undefined') {
            // 파일이 아직 로드되지 않았을 수 있으므로 동기적 로드 시도
            const script = document.createElement('script');
            script.src = `./data/characters/${characterId}.js`;
            script.async = false; // 동기적 로드
            document.head.appendChild(script);
            
            // 다시 확인
            if (typeof window[globalVarName] === 'undefined') {
                throw new Error(`Character data not found: ${globalVarName}`);
            }
        }
        
        return window[globalVarName];
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
     * 캐릭터 언로드
     * @param {string} characterId 
     */
    unloadCharacter(characterId) {
        if (this.loadedCharacters.has(characterId)) {
            this.loadedCharacters.delete(characterId);
            console.log(`[CharacterLoader] Unloaded ${characterId}`);
        }
    }
    
    /**
     * 캐릭터 스펙 가져오기
     */
    getSpec(characterId) {
        // 로드된 데이터에서 가져오기
        return this.loadedCharacters.get(characterId) || null;
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
     * 로드 상태 확인
     */
    isLoaded(characterId) {
        return this.loadedCharacters.has(characterId);
    }
    
    /**
     * 모든 로드된 캐릭터 언로드
     */
    unloadAll() {
        this.loadedCharacters.clear();
        console.log('[CharacterLoader] All characters unloaded');
    }
    
    /**
     * 디버그 정보
     */
    getDebugInfo() {
        return {
            registrySize: this.registry.size,
            loadedCount: this.loadedCharacters.size,
            loadedList: Array.from(this.loadedCharacters.keys()),
            registryLoaded: this.registryLoaded
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

// 전역 노출
window.CharacterLoader = CharacterLoader;
window.Character = Character;