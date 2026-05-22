// ============================================
// DEBUG PROFILER - Comprehensive debugging system
// ============================================

const DebugProfiler = {
    enabled: false,
    level: 'normal',
    frameHistory: [],
    recentOperations: [],
    functionTimings: {},
    functionCallCounts: {},
    currentFrame: null,
    freezeDetected: false,
    
    // Initialize profiler
    init() {
        this.enabled = GameConfig.DEBUG && GameConfig.DEBUG.ENABLED;
        this.level = GameConfig.DEBUG ? GameConfig.DEBUG.LEVEL : 'normal';
        this.frameHistory = [];
        this.recentOperations = [];
        this.functionTimings = {};
        this.functionCallCounts = {};
        this.currentFrame = null;
        this.freezeDetected = false;
        
        if (this.enabled) {
            console.log('[DEBUG] DebugProfiler initialized, level:', this.level);
        }
    },
    
    // Start timing a section
    startSection(name) {
        if (!this.enabled || !this.currentFrame) return null;
        
        const section = {
            name,
            startTime: performance.now(),
            subsections: []
        };
        
        if (!this.currentFrame.sections) {
            this.currentFrame.sections = [];
        }
        this.currentFrame.sections.push(section);
        
        return section;
    },
    
    // End timing a section
    endSection(section) {
        if (!this.enabled || !section) return;
        
        section.endTime = performance.now();
        section.duration = section.endTime - section.startTime;
    },
    
    // Start a new frame
    startFrame(frameNumber) {
        if (!this.enabled) return;
        
        this.currentFrame = {
            frameNumber,
            startTime: performance.now(),
            sections: [],
            state: null,
            errors: []
        };
    },
    
    // End frame and process
    endFrame() {
        if (!this.enabled || !this.currentFrame) return;
        
        const frame = this.currentFrame;
        frame.endTime = performance.now();
        frame.totalTime = frame.endTime - frame.startTime;
        
        // Add to history
        this.frameHistory.push(frame);
        if (this.frameHistory.length > (GameConfig.DEBUG.MAX_FRAME_HISTORY || 100)) {
            this.frameHistory.shift();
        }
        
        // Check for freeze
        if (GameConfig.DEBUG.FREEZE_DETECTION && frame.totalTime > (GameConfig.DEBUG.FREEZE_THRESHOLD || 100)) {
            this.detectFreeze(frame);
        }
        
        // Log if needed
        if (GameConfig.DEBUG.LOG_SLOW_FRAMES && frame.totalTime > (GameConfig.DEBUG.PERFORMANCE_THRESHOLD || 20)) {
            this.logSlowFrame(frame);
        } else if (GameConfig.DEBUG.LOG_FRAMES) {
            this.logFrame(frame);
        }
        
        this.currentFrame = null;
    },
    
    // Profile a function call
    profileFunction(functionName, fn, context = null) {
        if (!this.enabled || !GameConfig.DEBUG.LOG_FUNCTIONS) {
            return fn;
        }
        
        const self = this;
        return function(...args) {
            const startTime = performance.now();
            const callId = `${functionName}_${Date.now()}_${Math.random()}`;
            
            // Track function entry
            self.logOperation('function_entry', {
                name: functionName,
                callId,
                args: args.length,
                stack: new Error().stack
            });
            
            try {
                const result = fn.apply(context || this, args);
                
                // Handle promises
                if (result && typeof result.then === 'function') {
                    return result.then(
                        (value) => {
                            const endTime = performance.now();
                            self.recordFunctionTiming(functionName, endTime - startTime);
                            self.logOperation('function_exit', {
                                name: functionName,
                                callId,
                                duration: endTime - startTime,
                                result: 'promise_resolved'
                            });
                            return value;
                        },
                        (error) => {
                            const endTime = performance.now();
                            self.recordFunctionTiming(functionName, endTime - startTime);
                            self.logOperation('function_error', {
                                name: functionName,
                                callId,
                                duration: endTime - startTime,
                                error: error.message
                            });
                            throw error;
                        }
                    );
                }
                
                const endTime = performance.now();
                self.recordFunctionTiming(functionName, endTime - startTime);
                self.logOperation('function_exit', {
                    name: functionName,
                    callId,
                    duration: endTime - startTime
                });
                
                return result;
            } catch (error) {
                const endTime = performance.now();
                self.recordFunctionTiming(functionName, endTime - startTime);
                self.logOperation('function_error', {
                    name: functionName,
                    callId,
                    duration: endTime - startTime,
                    error: error.message,
                    stack: error.stack
                });
                throw error;
            }
        };
    },
    
    // Record function timing
    recordFunctionTiming(functionName, duration) {
        if (!this.functionTimings[functionName]) {
            this.functionTimings[functionName] = {
                calls: 0,
                totalTime: 0,
                minTime: Infinity,
                maxTime: 0,
                avgTime: 0
            };
        }
        
        const stats = this.functionTimings[functionName];
        stats.calls++;
        stats.totalTime += duration;
        stats.minTime = Math.min(stats.minTime, duration);
        stats.maxTime = Math.max(stats.maxTime, duration);
        stats.avgTime = stats.totalTime / stats.calls;
        
        // Log slow functions (only if significantly slow, and throttle repeated messages)
        const slowThreshold = 10; // Only warn if function takes > 10ms
        if (duration > slowThreshold) {
            // Throttle: only log once per second per function
            const lastLogKey = `lastSlowLog_${functionName}`;
            const now = Date.now();
            if (!this[lastLogKey] || (now - this[lastLogKey]) > 1000) {
                if (this.level === 'verbose' || this.level === 'extreme') {
                    console.warn(`[DEBUG] Slow function: ${functionName} took ${duration.toFixed(2)}ms`);
                }
                this[lastLogKey] = now;
            }
        }
    },
    
    // Log an operation
    logOperation(type, data) {
        if (!this.enabled) return;
        
        const operation = {
            type,
            timestamp: performance.now(),
            data
        };
        
        this.recentOperations.push(operation);
        if (this.recentOperations.length > (GameConfig.DEBUG.MAX_RECENT_OPERATIONS || 50)) {
            this.recentOperations.shift();
        }
    },
    
    // Validate state
    validateState(state, context = '', depth = 0, visited = new WeakSet()) {
        if (!this.enabled || !GameConfig.DEBUG.STATE_VALIDATION) return true;
        
        // Prevent infinite recursion with depth limit and circular reference detection
        const MAX_DEPTH = 5;
        if (depth > MAX_DEPTH) {
            return true; // Skip deep validation to prevent stack overflow
        }
        
        let isValid = true;
        const issues = [];
        
        // Check for null/undefined
        if (state === null || state === undefined) {
            // null/undefined is valid, just return
            return true;
        }
        
        // Handle primitive types
        if (typeof state !== 'object') {
            // Check for NaN
            if (typeof state === 'number' && isNaN(state)) {
                issues.push(`${context}: NaN detected`);
                isValid = false;
            }
            
            // Check for Infinity
            if (typeof state === 'number' && !isFinite(state)) {
                issues.push(`${context}: Infinity detected`);
                isValid = false;
            }
            
            if (!isValid && issues.length > 0) {
                console.warn('[DEBUG] State validation failed:', issues);
                this.logOperation('state_validation_failed', {
                    context,
                    issues
                });
            }
            
            return isValid;
        }
        
        // Handle objects and arrays
        // Check for circular references
        if (visited.has(state)) {
            return true; // Already validated this object, skip to prevent infinite loop
        }
        
        // Add to visited set (only for objects, not primitives)
        try {
            visited.add(state);
        } catch (e) {
            // WeakSet can't hold some objects (like DOM elements), skip validation
            return true;
        }
        
        try {
            // Handle arrays
            if (Array.isArray(state)) {
                for (let i = 0; i < Math.min(state.length, 100); i++) { // Limit array checking
                    const value = state[i];
                    if (typeof value === 'number') {
                        if (isNaN(value)) {
                            issues.push(`${context}[${i}]: NaN detected`);
                            isValid = false;
                        }
                        if (!isFinite(value)) {
                            issues.push(`${context}[${i}]: Infinity detected`);
                            isValid = false;
                        }
                    }
                    // Recursive check for nested objects (with depth limit)
                    if (typeof value === 'object' && value !== null && depth < MAX_DEPTH) {
                        if (!this.validateState(value, `${context}[${i}]`, depth + 1, visited)) {
                            isValid = false;
                        }
                    }
                }
            } else {
                // Handle regular objects
                for (const key in state) {
                    // Skip certain properties that might cause issues
                    if (key === 'canvas' || key === 'ctx' || key.startsWith('_')) {
                        continue;
                    }
                    
                    try {
                        const value = state[key];
                        
                        // Check for NaN
                        if (typeof value === 'number' && isNaN(value)) {
                            issues.push(`${context}.${key}: NaN detected`);
                            isValid = false;
                        }
                        
                        // Check for Infinity
                        if (typeof value === 'number' && !isFinite(value)) {
                            issues.push(`${context}.${key}: Infinity detected`);
                            isValid = false;
                        }
                        
                        // Recursive check for objects (with depth limit and circular reference protection)
                        if (typeof value === 'object' && value !== null && depth < MAX_DEPTH) {
                            if (!this.validateState(value, `${context}.${key}`, depth + 1, visited)) {
                                isValid = false;
                            }
                        }
                    } catch (e) {
                        // Skip properties that can't be accessed (like getters that throw)
                        continue;
                    }
                }
            }
        } catch (e) {
            // If validation itself throws an error, just return true to prevent breaking the game
            console.warn('[DEBUG] State validation error:', e);
            return true;
        }
        
        if (!isValid && issues.length > 0) {
            console.warn('[DEBUG] State validation failed:', issues);
            this.logOperation('state_validation_failed', {
                context,
                issues
            });
        }
        
        return isValid;
    },
    
    // Detect freeze
    detectFreeze(frame) {
        if (this.freezeDetected) return; // Only log once per freeze
        
        this.freezeDetected = true;
        
        // Capture stack trace
        const stack = new Error().stack;
        
        // Get state snapshot
        const stateSnapshot = this.getStateSnapshot();
        
        // Get recent operations
        const recentOps = this.recentOperations.slice(-20);
        
        console.error('[FREEZE DETECTED]', {
            frame: frame.frameNumber,
            duration: frame.totalTime.toFixed(2) + 'ms',
            stack: stack.split('\n').slice(0, 10),
            state: stateSnapshot,
            recentOperations: recentOps,
            frameBreakdown: this.formatFrameBreakdown(frame)
        });
        
        this.logOperation('freeze_detected', {
            frame: frame.frameNumber,
            duration: frame.totalTime,
            stack,
            state: stateSnapshot
        });
        
        // Reset freeze flag after a delay
        setTimeout(() => {
            this.freezeDetected = false;
        }, 1000);
    },
    
    // Get state snapshot
    getStateSnapshot() {
        if (typeof HuntingGame === 'undefined' || !HuntingGame.state) {
            return { error: 'HuntingGame not available' };
        }
        
        const state = HuntingGame.state;
        const gameState = typeof GameState !== 'undefined' ? GameState.get() : null;
        
        return {
            active: state.active,
            bullets: state.bullets ? state.bullets.length : 0,
            dinos: state.dinos ? state.dinos.length : 0,
            weaponAmmo: state.weaponAmmo ? Object.keys(state.weaponAmmo).length : 0,
            gasGrenades: state.gasGrenades ? state.gasGrenades.length : 0,
            currentWeapon: gameState ? (gameState.currentWeapon || 'unknown') : 'unknown',
            playerHealth: state.player ? state.player.health : 'unknown',
            isReloading: state.isReloading || false
        };
    },
    
    // Log slow frame (throttled to prevent spam)
    logSlowFrame(frame) {
        // Throttle: only log slow frames once every 2 seconds
        const now = Date.now();
        if (!this.lastSlowFrameLog || (now - this.lastSlowFrameLog) > 2000) {
            console.warn(`[DEBUG] Slow frame #${frame.frameNumber} | Time: ${frame.totalTime.toFixed(2)}ms`);
            if (this.level === 'verbose' || this.level === 'extreme') {
                console.log(this.formatFrameBreakdown(frame));
            }
            this.lastSlowFrameLog = now;
        }
    },
    
    // Log frame
    logFrame(frame) {
        console.log(`[DEBUG] Frame #${frame.frameNumber} | Time: ${frame.totalTime.toFixed(2)}ms`);
        if (this.level === 'verbose' || this.level === 'extreme') {
            console.log(this.formatFrameBreakdown(frame));
        }
    },
    
    // Format frame breakdown
    formatFrameBreakdown(frame) {
        if (!frame.sections || frame.sections.length === 0) {
            return '  No sections timed';
        }
        
        let output = '  Frame Breakdown:\n';
        frame.sections.forEach(section => {
            const duration = section.duration || 0;
            output += `  ├─ ${section.name}: ${duration.toFixed(2)}ms\n`;
            if (section.subsections && section.subsections.length > 0) {
                section.subsections.forEach(sub => {
                    const subDuration = sub.duration || 0;
                    output += `  │  ├─ ${sub.name}: ${subDuration.toFixed(2)}ms\n`;
                });
            }
        });
        const totalTime = frame.totalTime || 0;
        output += `  └─ Total: ${totalTime.toFixed(2)}ms`;
        
        return output;
    },
    
    // Get performance summary
    getPerformanceSummary() {
        if (!this.enabled) return null;
        
        const recentFrames = this.frameHistory.slice(-60);
        if (recentFrames.length === 0) return null;
        
        const avgFrameTime = recentFrames.reduce((sum, f) => sum + f.totalTime, 0) / recentFrames.length;
        const maxFrameTime = Math.max(...recentFrames.map(f => f.totalTime));
        const minFrameTime = Math.min(...recentFrames.map(f => f.totalTime));
        const fps = 1000 / avgFrameTime;
        
        return {
            avgFrameTime: avgFrameTime.toFixed(2) + 'ms',
            minFrameTime: minFrameTime.toFixed(2) + 'ms',
            maxFrameTime: maxFrameTime.toFixed(2) + 'ms',
            fps: fps.toFixed(1),
            slowFrames: recentFrames.filter(f => f.totalTime > 16.67).length,
            functionTimings: this.functionTimings
        };
    },
    
    // Export debug data
    exportDebugData() {
        return {
            frameHistory: this.frameHistory,
            recentOperations: this.recentOperations,
            functionTimings: this.functionTimings,
            functionCallCounts: this.functionCallCounts,
            performanceSummary: this.getPerformanceSummary(),
            timestamp: Date.now()
        };
    }
};

// Initialize on load
if (typeof GameConfig !== 'undefined' && GameConfig.DEBUG) {
    DebugProfiler.init();
}
