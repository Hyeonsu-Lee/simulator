/* nikke-sim-burst-manager.js - 수정된 버스트 매니저 */

class BurstManager {
    constructor(getNikkesFn) {
        this.getNikkes = getNikkesFn;
        this.cooldowns = new Map();
        this.lastCycleTime = -1;
        this.burstHistory = new Map(); // 사이클별 버스트 사용자 기록
    }
    
    // 실제 쿨타임 변환
    getRealCooldown(nikke) {
        return nikke.burstCooldown === 40 ? 24.86 : 12.43;
    }
    
    // 쿨타임 업데이트
    updateCooldowns(currentTime) {
        if (this.lastCycleTime < 0) {
            this.lastCycleTime = currentTime;
            return;
        }
        
        const timePassed = currentTime - this.lastCycleTime;
        for (const [nikke, cooldown] of this.cooldowns) {
            const newCooldown = Math.max(0, cooldown - timePassed);
            if (newCooldown > 0) {
                this.cooldowns.set(nikke, newCooldown);
            } else {
                this.cooldowns.delete(nikke);
            }
        }
        
        this.lastCycleTime = currentTime;
    }
    
    // 버스트 사용자 배열 반환 - 수정된 버전
    getBurstUsers(time) {
        const cycle = Math.floor((time - BURST_START_TIME) / BURST_CYCLE_TIME);
        if (cycle < 0) return [];
        
        // 이미 계산된 사이클이면 캐시에서 반환
        if (this.burstHistory.has(cycle)) {
            return this.burstHistory.get(cycle);
        }
        
        // 사이클 시작 시간으로 쿨다운 업데이트
        const cycleStartTime = cycle * BURST_CYCLE_TIME + BURST_START_TIME;
        this.updateCooldowns(cycleStartTime);
        
        const allNikkes = this.getNikkes();
        const usedThisCycle = new Set();
        const hasReEntryAtPosition = new Set();
        const burstUsers = [];
        
        let currentPosition = 1;
        
        while (currentPosition <= 3) {
            const user = this.findBurstUser(currentPosition, allNikkes, usedThisCycle, hasReEntryAtPosition);
            
            if (!user) {
                // 해당 포지션 사용 불가
                if (currentPosition === 1) {
                    // 1버스트 없으면 전체 종료
                    break;
                } else if (currentPosition === 2) {
                    // 2버스트 없으면 3버스트도 불가
                    break;
                }
                break;
            }
            
            // 버스트 사용자 추가
            burstUsers.push(user);
            usedThisCycle.add(user);
            
            // 쿨타임 설정 - 사이클 시작 시점 기준
            this.cooldowns.set(user, this.getRealCooldown(user));
            
            // 재진입 처리
            if (user.burstReEntry) {
                hasReEntryAtPosition.add(currentPosition);
                // 같은 포지션부터 다시 탐색
                continue;
            }
            
            currentPosition++;
        }
        
        // 결과 캐싱
        this.burstHistory.set(cycle, burstUsers);
        
        return burstUsers;
    }
    
    findBurstUser(position, allNikkes, usedThisCycle, hasReEntryAtPosition) {
        // 스쿼드 위치 순서대로 탐색 (1→2→3→4→5)
        for (const nikke of allNikkes) {
            // 포지션 체크
            if (nikke.burstPosition !== position) continue;
            
            // 이미 사용했는지 체크
            if (usedThisCycle.has(nikke)) continue;
            
            // 쿨타임 체크
            const remainingCooldown = this.cooldowns.get(nikke) || 0;
            if (remainingCooldown > 0.1) continue; // 부동소수점 오차 고려
            
            // 재진입 후 같은 포지션 재진입 니케 제외
            if (hasReEntryAtPosition.has(position) && nikke.burstReEntry) continue;
            
            return nikke;
        }
        
        return null;
    }
    
    // 현재 사이클 반환
    getCurrentCycle(time) {
        return Math.floor((time - BURST_START_TIME) / BURST_CYCLE_TIME);
    }
    
    // 풀버스트 타임 여부
    isFullBurstTime(time) {
        const burstUsers = this.getBurstUsers(time);
        return burstUsers.length === 3;
    }
    
    // 기존 호환성을 위한 메서드
    getBurstUsersForCycle(cycle, time) {
        const users = this.getBurstUsers(time);
        
        return {
            burst1User: users.find(u => u.burstPosition === 1) || null,
            burst2User: users.find(u => u.burstPosition === 2) || null,
            burst3User: users.find(u => u.burstPosition === 3) || null,
            isFullBurst: users.length === 3,
            activeBurstUsers: users
        };
    }
    
    // 디버그용 정보
    getDebugInfo() {
        const info = {
            cooldowns: {},
            history: {}
        };
        
        this.cooldowns.forEach((cd, nikke) => {
            info.cooldowns[nikke.name] = cd.toFixed(2);
        });
        
        this.burstHistory.forEach((users, cycle) => {
            info.history[`cycle_${cycle}`] = users.map(u => u.name);
        });
        
        return info;
    }
}