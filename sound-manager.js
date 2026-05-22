// ============================================
// SOUND MANAGER
// ============================================

const SoundManager = {
    enabled: true,
    audioContext: null,
    sounds: {},

    init() {
        // Initialize Web Audio API context
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('SoundManager: Initialized, state:', this.audioContext.state);
            
            // Set up user interaction handler to unlock audio
            // Many browsers require user interaction before playing sounds
            const unlockAudio = () => {
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => {
                        console.log('SoundManager: Audio unlocked by user interaction');
                        // Remove listeners after first unlock
                        document.removeEventListener('click', unlockAudio);
                        document.removeEventListener('keydown', unlockAudio);
                        document.removeEventListener('touchstart', unlockAudio);
                    }).catch(err => {
                        console.error('SoundManager: Failed to unlock audio:', err);
                    });
                }
            };
            
            // Add listeners for user interaction
            document.addEventListener('click', unlockAudio, { once: true });
            document.addEventListener('keydown', unlockAudio, { once: true });
            document.addEventListener('touchstart', unlockAudio, { once: true });
        } catch (e) {
            console.error('SoundManager: Web Audio API not supported, sounds disabled:', e);
            this.enabled = false;
        }
    },

    // Play a sound effect using Web Audio API
    playSound(soundName) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:43',message:'playSound ENTRY',data:{soundName,enabled:this.enabled,hasContext:!!this.audioContext,state:this.audioContext?this.audioContext.state:'none'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        if (!this.enabled) {
            return;
        }
        
        if (!this.audioContext) {
            return;
        }
        
        // Always use setTimeout to ensure this is completely non-blocking
        setTimeout(() => {
            try {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:57',message:'INSIDE playSound setTimeout',data:{state:this.audioContext?this.audioContext.state:'none'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                
                // Resume audio context if suspended (required by some browsers)
                // This is async, so we need to handle it properly
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:62',message:'BEFORE audioContext.resume',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                    // #endregion
                    
                    // Don't wait for resume - just try to resume and play sound later
                    this.audioContext.resume().then(() => {
                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:66',message:'AFTER audioContext.resume success',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                        // #endregion
                        
                        // Play sound after resume completes
                        setTimeout(() => {
                            try {
                                if (this.audioContext && this.audioContext.state !== 'closed') {
                                    this.playSoundInternal(soundName);
                                }
                            } catch (err) {
                                // Silently fail - don't block game
                                console.warn('SoundManager: Error in playSoundInternal after resume:', err);
                            }
                        }, 0);
                    }).catch(err => {
                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:78',message:'audioContext.resume ERROR',data:{error:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                        // #endregion
                        // Silently fail - don't block game
                        // Don't log to reduce console spam
                    });
                } else if (this.audioContext && this.audioContext.state !== 'closed') {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:84',message:'calling playSoundInternal directly',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                    // #endregion
                    // Context is already running, play sound immediately
                    this.playSoundInternal(soundName);
                }
            } catch (e) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:90',message:'playSound setTimeout ERROR',data:{error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                // Silently fail - don't block game
                // Don't log to reduce console spam
            }
        }, 0);
    },

    // Internal sound playing (called after context is resumed if needed)
    playSoundInternal(soundName) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:87',message:'playSoundInternal ENTRY',data:{soundName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:91',message:'BEFORE switch statement',data:{soundName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            switch (soundName) {
                case 'shoot':
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:95',message:'BEFORE playShootSound',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                    // #endregion
                    this.playShootSound();
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:99',message:'AFTER playShootSound',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                    // #endregion
                    break;
                case 'hit':
                    this.playHitSound();
                    break;
                case 'critical':
                    this.playCriticalSound();
                    break;
                case 'damage':
                    this.playDamageSound();
                    break;
                case 'capture':
                    this.playCaptureSound();
                    break;
                case 'purchase':
                    this.playPurchaseSound();
                    break;
                case 'alert':
                    this.playAlertSound();
                    break;
                default:
                    console.warn('SoundManager: Unknown sound:', soundName);
            }
            // Removed console.log to reduce overhead
        } catch (e) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:121',message:'playSoundInternal ERROR',data:{error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            console.error('SoundManager: Error in playSoundInternal:', e);
        }
    },

    // Generate a tone using oscillator
    playTone(frequency, duration, type = 'sine', volume = 0.3, startVolume = null, endVolume = null) {
        if (!this.audioContext) {
            return; // Silently fail
        }
        
        if (this.audioContext.state === 'closed') {
            return; // Silently fail
        }
        
        // Wrap in setTimeout to ensure non-blocking
        setTimeout(() => {
            try {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:173',message:'playTone setTimeout ENTRY',data:{frequency,duration,type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                
                // Double-check state after setTimeout
                if (!this.audioContext || this.audioContext.state === 'closed') {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:178',message:'playTone EXIT - no context',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                    // #endregion
                    return;
                }
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:183',message:'BEFORE createOscillator',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:188',message:'AFTER createOscillator/Gain',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:193',message:'AFTER connect',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                
                oscillator.type = type;
                oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
                
                // Set volume envelope
                const startVol = startVolume !== null ? startVolume : volume;
                // exponentialRampToValueAtTime cannot use 0, must use a very small value
                let endVol = endVolume !== null ? endVolume : 0.001;
                if (endVol <= 0 || endVol < 0.0001) {
                    endVol = 0.0001; // Minimum safe value for exponential ramp
                }
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:205',message:'BEFORE gain/start/stop',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                
                gainNode.gain.setValueAtTime(startVol, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(endVol, this.audioContext.currentTime + duration);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + duration);
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:213',message:'AFTER oscillator start/stop',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
            } catch (e) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:216',message:'playTone ERROR',data:{error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                // Silently fail - don't block game
                // Don't log to reduce console spam
            }
        }, 0);
    },

    // Play multiple tones in sequence or parallel
    playTones(tones) {
        tones.forEach((tone, index) => {
            setTimeout(() => {
                this.playTone(tone.freq, tone.duration, tone.type, tone.volume, tone.startVolume, tone.endVolume);
            }, index * (tone.delay || 0));
        });
    },

    // Shoot sound - short sharp pop
    playShootSound() {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:175',message:'playShootSound ENTRY',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:179',message:'BEFORE first playTone',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        this.playTone(200, 0.05, 'square', 0.2);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:184',message:'AFTER first playTone',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:188',message:'BEFORE second playTone',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        this.playTone(150, 0.08, 'square', 0.15, 0.15, 0.0001);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sound-manager.js:193',message:'AFTER second playTone',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
    },

    // Hit sound - medium impact
    playHitSound() {
        this.playTone(400, 0.1, 'sine', 0.25);
        this.playTone(300, 0.15, 'sine', 0.2, 0.2, 0.0001);
    },

    // Critical hit sound - higher pitch with multiple tones
    playCriticalSound() {
        this.playTone(600, 0.08, 'sine', 0.3);
        this.playTone(800, 0.1, 'sine', 0.25, 0.25, 0.0001);
        this.playTone(1000, 0.12, 'sine', 0.2, 0.2, 0.0001);
    },

    // Damage sound - lower warning tone
    playDamageSound() {
        this.playTone(150, 0.2, 'sawtooth', 0.3);
        this.playTone(100, 0.25, 'sawtooth', 0.25, 0.25, 0.0001);
    },

    // Capture sound - success chime
    playCaptureSound() {
        this.playTones([
            { freq: 523, duration: 0.1, type: 'sine', volume: 0.25 }, // C
            { freq: 659, duration: 0.1, type: 'sine', volume: 0.25, delay: 50 }, // E
            { freq: 784, duration: 0.2, type: 'sine', volume: 0.3, delay: 100 } // G
        ]);
    },

    // Purchase sound - short positive beep
    playPurchaseSound() {
        this.playTone(440, 0.1, 'sine', 0.2);
        this.playTone(554, 0.15, 'sine', 0.15, 0.15, 0.0001);
    },

    // Alert sound - attention-getting tone
    playAlertSound() {
        this.playTone(300, 0.15, 'sawtooth', 0.3);
        this.playTone(400, 0.15, 'sawtooth', 0.25, 0.25, 0.0001);
    },

    setEnabled(enabled) {
        this.enabled = enabled;
    }
};
