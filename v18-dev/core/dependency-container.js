// core/dependency-container.js - 의존성 주입 컨테이너

class DependencyContainer {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
        this.factories = new Map();
    }
    
    /**
     * 서비스 등록
     * @param {string} name - 서비스 이름
     * @param {Function|Object} implementation - 구현체 또는 팩토리
     * @param {Object} options - { singleton: boolean, dependencies: string[] }
     */
    register(name, implementation, options = {}) {
        const { singleton = true, dependencies = [] } = options;
        
        if (singleton) {
            // 싱글톤 서비스
            this.services.set(name, {
                implementation,
                dependencies,
                singleton: true
            });
        } else {
            // 팩토리 서비스
            this.factories.set(name, {
                implementation,
                dependencies
            });
        }
    }
    
    /**
     * 서비스 획득
     * @param {string} name - 서비스 이름
     * @returns {Object} 서비스 인스턴스
     */
    get(name) {
        // 이미 생성된 싱글톤 확인
        if (this.singletons.has(name)) {
            return this.singletons.get(name);
        }
        
        // 서비스 정보 확인
        const serviceInfo = this.services.get(name) || this.factories.get(name);
        if (!serviceInfo) {
            throw new Error(`Service not found: ${name}`);
        }
        
        // 의존성 해결
        const resolvedDeps = serviceInfo.dependencies.map(dep => this.get(dep));
        
        // 인스턴스 생성
        let instance;
        if (typeof serviceInfo.implementation === 'function') {
            // 생성자 함수인 경우
            instance = new serviceInfo.implementation(...resolvedDeps);
        } else {
            // 이미 생성된 객체인 경우
            instance = serviceInfo.implementation;
        }
        
        // 싱글톤인 경우 저장
        if (serviceInfo.singleton) {
            this.singletons.set(name, instance);
        }
        
        return instance;
    }
    
    /**
     * 여러 서비스 동시 획득
     * @param {string[]} names - 서비스 이름 배열
     * @returns {Object} 서비스 맵
     */
    getMultiple(names) {
        const services = {};
        names.forEach(name => {
            services[name] = this.get(name);
        });
        return services;
    }
    
    /**
     * 서비스 존재 여부 확인
     * @param {string} name - 서비스 이름
     * @returns {boolean}
     */
    has(name) {
        return this.services.has(name) || this.factories.has(name);
    }
    
    /**
     * 컨테이너 초기화
     */
    clear() {
        this.services.clear();
        this.singletons.clear();
        this.factories.clear();
    }
    
    /**
     * 서비스 목록 반환
     * @returns {string[]}
     */
    list() {
        return [
            ...Array.from(this.services.keys()),
            ...Array.from(this.factories.keys())
        ];
    }
    
    /**
     * 의존성 그래프 생성
     * @returns {Object} 의존성 그래프
     */
    getDependencyGraph() {
        const graph = {};
        
        this.services.forEach((info, name) => {
            graph[name] = info.dependencies;
        });
        
        this.factories.forEach((info, name) => {
            graph[name] = info.dependencies;
        });
        
        return graph;
    }
    
    /**
     * 순환 의존성 검사
     * @returns {boolean} 순환 의존성 존재 여부
     */
    hasCircularDependency() {
        const graph = this.getDependencyGraph();
        const visited = new Set();
        const recursionStack = new Set();
        
        const hasCycle = (node) => {
            visited.add(node);
            recursionStack.add(node);
            
            const dependencies = graph[node] || [];
            for (const dep of dependencies) {
                if (!visited.has(dep)) {
                    if (hasCycle(dep)) return true;
                } else if (recursionStack.has(dep)) {
                    return true;
                }
            }
            
            recursionStack.delete(node);
            return false;
        };
        
        for (const node in graph) {
            if (!visited.has(node)) {
                if (hasCycle(node)) return true;
            }
        }
        
        return false;
    }
}

// 전역 컨테이너 생성
const container = new DependencyContainer();

// 전역 노출
window.DependencyContainer = DependencyContainer;
window.container = container;

// 내보내기 (ES6 모듈 방식으로 변경 예정)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DependencyContainer, container };
}