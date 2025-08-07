// data/characters/character-registry.js - 캐릭터 레지스트리

const CHARACTER_REGISTRY = [
    { id: "dorothy", name: "도로시" },
    { id: "crown", name: "크라운" },
    { id: "helm", name: "헬름" },
    { id: "siren", name: "세이렌" }
];

// 각 캐릭터 파일 동적 로드
CHARACTER_REGISTRY.forEach(char => {
    const script = document.createElement('script');
    script.src = `./data/characters/${char.id}.js`;
    script.onload = () => {
        console.log(`Loaded character file: ${char.id}.js`);
    };
    script.onerror = () => {
        console.error(`Failed to load character file: ${char.id}.js`);
    };
    document.head.appendChild(script);
});

// 전역 노출
window.CHARACTER_REGISTRY = CHARACTER_REGISTRY;