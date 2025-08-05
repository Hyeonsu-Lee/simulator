// infrastructure/character-loader.js - 캐릭터 데이터 로더

class CharacterLoader {
    constructor() {
        this.registry = new Map();
        this.loaded = false;
    }
    
    /**
     * 캐릭터 스펙 로드
     */
    async loadAll() {
        if (this.loaded) return;
        
        try {
            // CHARACTER_DATA가 전역에 있는지 확인
            if (typeof CHARACTER_DATA !== 'undefined' && typeof CHARACTER_LIST !== 'undefined') {
                // JS 파일에서 직접 로드
                CHARACTER_LIST.forEach(characterId => {
                    if (CHARACTER_DATA[characterId]) {
                        this.registry.set(characterId, CHARACTER_DATA[characterId]);
                        console.log(`Loaded ${characterId} from character-data.js`);
                    }
                });
                
                console.log(`Loaded ${CHARACTER_LIST.length} characters from JS data`);
                this.loaded = true;
                return;
            }
            
            // JSON 파일에서 로드 시도 (HTTP 서버 환경)
            const response = await fetch('data/characters/character-list.json');
            if (response.ok) {
                const characterList = await response.json();
                
                // 병렬로 모든 캐릭터 로드
                const loadPromises = characterList.map(characterId => 
                    this.loadCharacter(characterId)
                );
                
                await Promise.all(loadPromises);
                
                console.log(`Loaded ${characterList.length} characters from JSON`);
            } else {
                throw new Error('Failed to load character-list.json');
            }
        } catch (error) {
            console.warn('Failed to load character data:', error);
            // 폴백으로 내장 데이터 사용
            this.loadBuiltInSpecs();
        }
        
        this.loaded = true;
    }
    
    /**
     * 개별 캐릭터 로드
     */
    async loadCharacter(characterId) {
        try {
            const response = await fetch(`data/characters/${characterId}.json`);
            if (response.ok) {
                const spec = await response.json();
                this.registry.set(characterId, spec);
                console.log(`Loaded ${characterId} from JSON`);
            } else {
                throw new Error(`Failed to load ${characterId}.json`);
            }
        } catch (error) {
            console.warn(`Failed to load ${characterId}.json:`, error);
        }
    }
    
    /**
     * 내장 스펙 로드 (폴백)
     */
    loadBuiltInSpecs() {
        // 최소한의 내장 데이터
        const fallbackData = {
            dorothy: {
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
                    reloadTime: 1.5
                },
                skills: {}
            }
        };
        
        Object.entries(fallbackData).forEach(([id, spec]) => {
            this.registry.set(id, spec);
        });
        
        console.log('Loaded fallback character specs');
    }
    
    /**
     * 캐릭터 스펙 가져오기
     */
    getSpec(characterId) {
        return this.registry.get(characterId);
    }
    
    /**
     * 모든 캐릭터 ID
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
