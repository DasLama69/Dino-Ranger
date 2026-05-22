// ============================================
// HUNTING MINIGAME
// ============================================

// Non-blocking debug log helper - MINIMAL logging to prevent browser blocking
const debugLog = (location, message, data, hypothesisId = 'A') => {
    // Only log critical operations to reduce overhead
    const criticalMessages = ['shoot ENTRY', 'shoot EXIT', 'BEFORE shootAdvanced', 'AFTER shootAdvanced', 'BEFORE GameState.get', 'AFTER GameState.get', 'BEFORE cooldown check', 'AFTER cooldown check', 'Too soon - EXIT', 'animate frame', 'queuing shoot', 'setTimeout callback', 'throttled', 'clearing isShooting', 'continuous fire', 'continuous fire check', 'passed initial check', 'checking fireRate', 'blocked', 'BEFORE shootAdvanced call', 'already shooting', 'sprinting', 'reloading', 'not active', 'hasActiveDinos'];
    if (!criticalMessages.some(msg => message.includes(msg))) {
        return; // Skip non-critical logs
    }
    setTimeout(() => {
        fetch('http://127.0.0.1:7242/ingest/55cbd83e-c52f-4653-adee-fe5f37e0e2c1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location,
                message,
                data,
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId
            })
        }).catch(() => {});
    }, 0);
};

const HuntingGame = {
    state: {
        active: false,
        canvas: null,
        ctx: null,
        dino: null, // Single dino (legacy support)
        dinos: [], // Array of dinosaurs for multiple spawns
        player: {
            x: GameConfig.HUNTING.PLAYER_START_X,
            y: GameConfig.HUNTING.PLAYER_START_Y,
            size: GameConfig.HUNTING.PLAYER_SIZE,
            speed: 3.0,
            health: GameConfig.HUNTING.PLAYER_MAX_HEALTH,
            maxHealth: GameConfig.HUNTING.PLAYER_MAX_HEALTH,
            lastDamageTime: 0,
            image: null // Will be loaded from images/player/player.png
        },
        keys: {
            w: false, a: false, s: false, d: false,
            ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
            Shift: false // Sprint key
        },
        mouse: {
            x: 0,
            y: 0,
            inCanvas: false,
            isDown: false, // Track if mouse button is held down
            isLocked: false, // Track if pointer is locked
            lastX: 0, // Last known mouse X position (for when mouse leaves)
            lastY: 0 // Last known mouse Y position (for when mouse leaves)
        },
        lastShot: 0,
        bullets: [],
        bulletImage: null, // Dart sprite for bullets
        // Weapon ammo system
        weaponAmmo: {}, // Maps weapon ID to current ammo count
        isReloading: false,
        reloadStartTime: 0,
        dinoProjectiles: [], // Projectiles fired by dinosaurs
        dinoAttackImages: {}, // Cache for dinosaur attack images
        gasGrenades: [], // Active gas grenade areas
        animationFrame: null,
        screenShake: {
            x: 0,
            y: 0,
            intensity: 0,
            duration: 0
        },
        criticalHitIndicator: {
            active: false,
            timer: 0
        },
        playerDamageIndicator: {
            active: false,
            timer: 0
        },
        missIndicator: {
            active: false,
            timer: 0,
            x: 0,
            y: 0
        },
        // Environment objects (bushes only)
        environment: {
            bushes: [],
            // Cached sandy texture pattern
            sandyPattern: null,
            // Background image
            backgroundImage: null,
            // Walkable area - simple rectangle bounds (light brown path area)
            walkableBounds: {
                x: 0,         // Left edge of walkable area
                y: 225,       // Top edge of walkable area
                width: 1200,  // Width of walkable area (right edge 1200)
                height: 425   // Height of walkable area (bottom edge 650: 650 - 225 = 425)
            },
            // Aquatic mode
            isAquaticMode: false,
            // Lake area (half the walkable area, on the right side)
            lakeBounds: null,
            // Extension area for aquatic mode (additional walkable zone)
            walkableExtension: null
        },
        // Developer mode
        devMode: false,
        // Hunt timer
        huntTimer: {
            startTime: null,
            duration: GameConfig.HUNTING.HUNT_DURATION_BASE_SECONDS * 1000, // Convert to milliseconds (will be recalculated on start)
            timeRemaining: 0,
            expired: false
        },
        // Captured dinos (for partial capture handling)
        capturedDinos: [],
        // All spawned dinos info (for showing results)
        allSpawnedDinos: [],
        // Capture results display (canvas-based for fullscreen)
        showCaptureResults: false,
        captureResultsData: null,
        // Performance monitoring
        performance: {
            frameCount: 0,
            lastFrameTime: 0,
            frameTimes: [], // Keep last 60 frame times for average
            slowFrames: 0, // Count of frames > 16ms (60fps threshold)
            lastLogTime: 0
        },
        // Sound throttling
        lastAlertSoundTime: 0,
        lastDamageSoundTime: 0,
    },

    capturedDino: null,

    // Initialize hunting game
    init() {
        this.state.canvas = document.getElementById('hunt-canvas');
        this.state.canvas.width = GameConfig.HUNTING.CANVAS_WIDTH;
        this.state.canvas.height = GameConfig.HUNTING.CANVAS_HEIGHT;
        this.state.ctx = this.state.canvas.getContext('2d');
        this.state.canvas.addEventListener('click', (e) => {
            // Handle click events for capture results buttons
            if (this.state.showCaptureResults && this.state.captureResultsData) {
                this.handleCaptureResultsClick(e);
            } else {
                this.shoot(e);
            }
        });
        this.state.canvas.addEventListener('mousedown', (e) => {
            this.state.mouse.isDown = true;
            // Don't shoot if capture results are showing
            if (!this.state.showCaptureResults) {
                this.shoot(e);
            }
        });
        this.state.canvas.addEventListener('mouseup', () => {
            this.state.mouse.isDown = false;
        });
        this.state.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.state.canvas.addEventListener('mouseleave', () => { 
            // Don't stop firing when mouse leaves - keep aiming at last position
            this.state.mouse.inCanvas = false;
        });
        this.state.canvas.addEventListener('mouseenter', () => { 
            this.state.mouse.inCanvas = true;
            // Initialize last position when mouse enters
            if (this.state.mouse.x === 0 && this.state.mouse.y === 0) {
                // Set to center of canvas if not yet initialized
                this.state.mouse.lastX = this.state.canvas.width / 2;
                this.state.mouse.lastY = this.state.canvas.height / 2;
            }
        });
        
        // Set up pointer lock event listeners
        document.addEventListener('pointerlockchange', () => this.handlePointerLockChange());
        document.addEventListener('pointerlockerror', () => {
            console.warn('Pointer lock failed');
            this.state.mouse.isLocked = false;
        });
        
        // Set up fullscreen change listeners
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());
        
        // Handle pointer lock movement (when locked, movement events are different)
        document.addEventListener('mousemove', (e) => {
            if (this.state.mouse.isLocked && this.state.active) {
                this.handlePointerLockMove(e);
            }
        });
        
        // Set up keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Reset player position
        this.state.player.x = GameConfig.HUNTING.PLAYER_START_X;
        this.state.player.y = GameConfig.HUNTING.PLAYER_START_Y;
        
        // Load player image (weapon-specific)
        this.loadPlayerSprite();
        
        // Load background image and create walkability map
        this.loadBackgroundImage();
    },
    
    // Load background image (different for land vs aquatic mode)
    async loadBackgroundImage() {
        try {
            // Determine which background to load based on mode
            const backgroundPath = this.state.environment.isAquaticMode 
                ? 'images/environment/background-lake.png'
                : 'images/environment/background-land.png';
            
            const bgImage = await ImageLoader.loadImage(backgroundPath);
            if (bgImage) {
                this.state.environment.backgroundImage = bgImage;
            } else {
                console.warn(`Background image not found: ${backgroundPath}, using fallback texture`);
            }
        } catch (error) {
            console.warn('Failed to load background image:', error);
        }
    },
    
    // Check if a position is within the walkable rectangle bounds
    isPositionWalkable(x, y) {
        const bounds = this.state.environment.walkableBounds;
        const inMainArea = x >= bounds.x && 
                          x <= bounds.x + bounds.width &&
                          y >= bounds.y && 
                          y <= bounds.y + bounds.height;
        
        // Check extension area if it exists (for aquatic mode)
        if (this.state.environment.walkableExtension) {
            const ext = this.state.environment.walkableExtension;
            const inExtension = x >= ext.x && 
                               x <= ext.x + ext.width &&
                               y >= ext.y && 
                               y <= ext.y + ext.height;
            return inMainArea || inExtension;
        }
        
        return inMainArea;
    },
    
    // Clamp a position to the walkable bounds (handles main area and extension)
    clampToWalkableBounds(x, y, size = 0) {
        const bounds = this.state.environment.walkableBounds;
        
        // If there's an extension, treat it as a compound L-shaped area
        if (this.state.environment.walkableExtension) {
            const ext = this.state.environment.walkableExtension;
            
            // Check if position is valid in either area
            const inMainArea = x >= bounds.x + size && x <= bounds.x + bounds.width - size &&
                              y >= bounds.y + size && y <= bounds.y + bounds.height - size;
            const inExtension = x >= ext.x + size && x <= ext.x + ext.width - size &&
                               y >= ext.y + size && y <= ext.y + ext.height - size;
            
            if (inMainArea || inExtension) {
                // Position is valid, return as-is
                return { x, y };
            }
            
            // Position is not valid, need to clamp
            // For the L-shape with hard edges:
            // - Top edge (y < 550): hard stop
            // - Right edge (x > 700): hard stop  
            // - Bottom edge (y > 650): hard stop
            // - Left edge (x < 500): can pass through to main area
            
            const inExtensionYRange = y >= ext.y + size && y <= ext.y + ext.height - size;
            const inExtensionXRange = x >= ext.x && x <= ext.x + ext.width - size; // Left edge is open (no size check)
            const pastRightEdge = x > ext.x + ext.width - size; // Past the right edge of extension
            
            // Check if we're trying to enter extension from the left (main area side)
            const enteringFromLeft = x < ext.x && inExtensionYRange;
            
            // If in extension Y range and past right edge, hard stop at right edge
            if (inExtensionYRange && pastRightEdge) {
                const clampedX = ext.x + ext.width - size; // Hard stop at right edge
                const clampedY = Math.max(ext.y + size, Math.min(ext.y + ext.height - size, y));
                return { x: clampedX, y: clampedY };
            }
            
            if (inExtensionYRange && inExtensionXRange) {
                // Y is in extension range and X is in extension range (including left edge)
                // Clamp X: allow through left edge, hard stop at right edge
                const clampedX = Math.max(bounds.x + size, Math.min(ext.x + ext.width - size, x));
                // Clamp Y: hard stops at top and bottom
                const clampedY = Math.max(ext.y + size, Math.min(ext.y + ext.height - size, y));
                return { x: clampedX, y: clampedY };
            } else if (inExtensionXRange && y < ext.y + size) {
                // X is in extension range but Y is above it - hard stop at extension top edge
                const clampedX = Math.max(ext.x, Math.min(ext.x + ext.width - size, x)); // Allow through left
                const clampedY = ext.y + size; // Hard stop at top edge
                return { x: clampedX, y: clampedY };
            } else if (inExtensionXRange && y > ext.y + ext.height - size) {
                // X is in extension range but Y is below it - hard stop at extension bottom edge
                const clampedX = Math.max(ext.x, Math.min(ext.x + ext.width - size, x)); // Allow through left
                const clampedY = ext.y + ext.height - size; // Hard stop at bottom edge
                return { x: clampedX, y: clampedY };
            } else if (enteringFromLeft) {
                // Trying to enter extension from left while in Y range - allow through
                const clampedX = Math.max(bounds.x + size, Math.min(ext.x, x)); // Can go up to left edge
                const clampedY = Math.max(ext.y + size, Math.min(ext.y + ext.height - size, y));
                return { x: clampedX, y: clampedY };
            } else {
                // Y is not in extension range, clamp to main area only
                const clampedX = Math.max(bounds.x + size, Math.min(bounds.x + bounds.width - size, x));
                const clampedY = Math.max(bounds.y + size, Math.min(bounds.y + bounds.height - size, y));
                return { x: clampedX, y: clampedY };
            }
        }
        
        // No extension, just clamp to main area
        return {
            x: Math.max(bounds.x + size, Math.min(bounds.x + bounds.width - size, x)),
            y: Math.max(bounds.y + size, Math.min(bounds.y + bounds.height - size, y))
        };
    },
    
    // Find a nearby walkable position (within bounds)
    findNearbyWalkablePosition(startX, startY, maxRadius = 200) {
        // If starting position is already walkable, return it
        if (this.isPositionWalkable(startX, startY)) {
            return { x: startX, y: startY };
        }
        
        // Otherwise, clamp to bounds
        const clamped = this.clampToWalkableBounds(startX, startY);
        return { x: clamped.x, y: clamped.y };
    },
    
    // Handle key press
    handleKeyDown(e) {
        // Handle ESC key to exit fullscreen
        if (e.key === 'Escape' || e.keyCode === 27) {
            // Exit fullscreen when ESC is pressed (during hunt or capture popup)
            this.exitFullscreen();
            // Also exit pointer lock if active
            this.exitPointerLock();
            return; // Don't process other ESC key behavior
        }
        // Fix caps lock - convert uppercase WASD to lowercase
        let key = e.key;
        if (key === 'W') key = 'w';
        else if (key === 'A') key = 'a';
        else if (key === 'S') key = 's';
        else if (key === 'D') key = 'd';
        
        // Prevent default browser behavior for movement keys (prevents scrolling)
        const isMovementKey = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift'].includes(key);
        if (isMovementKey) {
            e.preventDefault();
        }
        
        // Handle shift for sprint
        if (key === 'Shift') {
            this.state.keys.Shift = true;
            return;
        }
        
        // Weapon switching with number keys (1-6)
        if (this.state.active && !this.state.isReloading) {
            const weaponKeys = {
                '1': 'pistol',
                '2': 'shotgun',
                '3': 'rifle',
                '4': 'assaultRifle',
                '5': 'sniperRifle',
                '6': 'gasGrenade'
            };
            
            if (weaponKeys[key]) {
                this.switchWeapon(weaponKeys[key]);
                e.preventDefault();
                return;
            }
            
            // Manual reload with R key
            if (key === 'r' || key === 'R') {
                this.startReload();
                e.preventDefault();
                return;
            }
        }
        
        if (this.state.keys.hasOwnProperty(key)) {
            this.state.keys[key] = true;
        }
    },
    
    // Handle key release
    handleKeyUp(e) {
        // Fix caps lock - convert uppercase WASD to lowercase
        let key = e.key;
        if (key === 'W') key = 'w';
        else if (key === 'A') key = 'a';
        else if (key === 'S') key = 's';
        else if (key === 'D') key = 'd';
        
        // Handle shift for sprint
        if (key === 'Shift') {
            this.state.keys.Shift = false;
            return;
        }
        
        if (this.state.keys.hasOwnProperty(key)) {
            this.state.keys[key] = false;
        }
    },
    
    // Handle mouse movement (regular mouse events)
    handleMouseMove(e) {
        // Always use shared mouse movement handler (matches sandbox exactly)
        ShootingUtils.handleMouseMove(e, this.state.canvas, this.state.mouse);
    },

    // Handle pointer lock movement (when mouse is locked)
    handlePointerLockMove(e) {
        // Accumulate movement deltas - match sandbox behavior (no clamping)
        this.state.mouse.x += e.movementX || 0;
        this.state.mouse.y += e.movementY || 0;
        
        this.state.mouse.lastX = this.state.mouse.x;
        this.state.mouse.lastY = this.state.mouse.y;
        this.state.mouse.inCanvas = true;
    },

    // Handle pointer lock state changes
    handlePointerLockChange() {
        const isLocked = document.pointerLockElement === this.state.canvas;
        this.state.mouse.isLocked = isLocked;
        
        // Don't auto-relock - let user control when pointer is locked
    },

    // Start hunting
    start() {
        // Reset all keys to prevent stuck movement from previous state
        this.state.keys = {
            w: false, a: false, s: false, d: false,
            ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
            Shift: false
        };
        
        // Check if we should use aquatic mode (random chance if aquatic exhibit is unlocked)
        const state = GameState.get();
        if (!state.unlockedExhibitTypes) {
            state.unlockedExhibitTypes = {
                plant: true,
                meat: false,
                aquarium: false,
                aviary: false
            };
        }
        
        // Randomly choose map mode (land is more likely)
        // Land: 70%, Aquatic: 20%, Aviary: 10% (if unlocked)
        const mapRoll = Math.random();
        if (state.unlockedExhibitTypes.aviary && mapRoll < 0.1) {
            // Aviary mode (10% chance if unlocked)
            this.state.environment.isAquaticMode = false; // Will need separate aviary mode flag later
            // For now, aviary uses land mode
        } else if (state.unlockedExhibitTypes.aquarium && mapRoll < 0.3) {
            // Aquatic mode (20% chance if unlocked, 30% total - 10% aviary = 20%)
            this.state.environment.isAquaticMode = true;
        } else {
            // Land mode (70% chance, or 100% if others not unlocked)
            this.state.environment.isAquaticMode = false;
        }
        
        // Set up lake bounds if in aquatic mode
        if (this.state.environment.isAquaticMode) {
            // Main walkable area: 500x425
            this.state.environment.walkableBounds = {
                x: 0,
                y: 225,
                width: 500,        // 500 wide
                height: 425        // 425 tall
            };
            // Extension area: bottom 100 pixels extend right 200 pixels
            // Main area bottom is at y: 225 + 425 = 650
            // Bottom 100 pixels: from y: 550 to y: 650
            // Extends right 200 pixels: from x: 500 to x: 700
            this.state.environment.walkableExtension = {
                x: 500,            // Start at end of main area
                y: 550,            // Bottom 100 pixels (650 - 100 = 550)
                width: 200,       // Extends right 200 pixels
                height: 100        // Bottom 100 pixels
            };
            // Lake covers the right side (starting after main walkable area)
            this.state.environment.lakeBounds = {
                x: 500,            // Start after main walkable area
                y: 225,
                width: 700,        // Extend to edge (1200 - 500 = 700)
                height: 425
            };
        } else {
            this.state.environment.lakeBounds = null;
            this.state.environment.walkableExtension = null;
            // Reset to full walkable area
            this.state.environment.walkableBounds = {
                x: 0,
                y: 225,
                width: 1200,
                height: 425
            };
        }
        
        // Always reload background image (in case mode changed between hunts)
        // Clear existing background to force reload with correct mode
        this.state.environment.backgroundImage = null;
        
        // Load the appropriate background for this mode
        this.loadBackgroundImage().then(() => {
            // Place environment objects (bushes only, not in aquatic mode)
            if (!this.state.environment.isAquaticMode) {
                this.placeEnvironment();
            }
            
        // Initialize weapon ammo for current weapon
        const currentWeaponId = state.currentWeapon || 'pistol';
        const weapon = state.weapons[currentWeaponId];
        if (weapon) {
            this.state.weaponAmmo[currentWeaponId] = weapon.clipSize;
            this.state.isReloading = false;
            this.state.reloadStartTime = 0;
        }
        
        this.state.active = true;
            // Request fullscreen for canvas
            this.requestFullscreen();
            // Hide gun stats during hunt
            const gunStatsElement = document.querySelector('.gun-stats');
            if (gunStatsElement) {
                gunStatsElement.style.display = 'none';
            }
            // Initialize mouse position to center of canvas if not set (so crosshair is visible from start)
            if (this.state.mouse.x === 0 && this.state.mouse.y === 0) {
                this.state.mouse.x = this.state.canvas.width / 2;
                this.state.mouse.y = this.state.canvas.height / 2;
                this.state.mouse.lastX = this.state.mouse.x;
                this.state.mouse.lastY = this.state.mouse.y;
            }
            // Ensure pointer is unlocked so cursor is visible
            if (this.state.mouse.isLocked || document.pointerLockElement === this.state.canvas) {
                this.exitPointerLock();
                this.state.mouse.isLocked = false;
            }
            // Calculate hunt timer duration based on difficulty (starts at 3 mins, gets shorter)
            const difficulty = this.calculateDifficulty();
            const baseDuration = GameConfig.HUNTING.HUNT_DURATION_BASE_SECONDS;
            const reduction = difficulty.threshold * GameConfig.HUNTING.HUNT_DURATION_REDUCTION_PER_THRESHOLD;
            const durationSeconds = Math.max(
                baseDuration - reduction,
                GameConfig.HUNTING.HUNT_DURATION_MIN_SECONDS
            );
            // Initialize hunt timer
            this.state.huntTimer.startTime = Date.now();
            this.state.huntTimer.duration = durationSeconds * 1000;
            this.state.huntTimer.timeRemaining = this.state.huntTimer.duration;
            this.state.huntTimer.expired = false;
            this.state.capturedDinos = [];
            this.state.allSpawnedDinos = [];
        this.spawnDino();
        this.animate();
        });
    },

    // Request pointer lock
    requestPointerLock() {
        if (this.state.canvas && this.state.canvas.requestPointerLock) {
            this.state.canvas.requestPointerLock().catch(err => {
                console.warn('Pointer lock request failed:', err);
            });
        }
    },

    // Exit pointer lock
    exitPointerLock() {
        if (document.exitPointerLock) {
            document.exitPointerLock();
        }
    },

    // Request fullscreen for canvas
    requestFullscreen() {
        const canvas = this.state.canvas;
        if (!canvas) return;
        
        // Try different fullscreen API methods for browser compatibility
        if (canvas.requestFullscreen) {
            canvas.requestFullscreen().catch(err => {
                console.warn('Fullscreen request failed:', err);
            });
        } else if (canvas.webkitRequestFullscreen) {
            canvas.webkitRequestFullscreen();
        } else if (canvas.mozRequestFullScreen) {
            canvas.mozRequestFullScreen();
        } else if (canvas.msRequestFullscreen) {
            canvas.msRequestFullscreen();
        }
    },

    // Exit fullscreen
    exitFullscreen() {
        try {
            // Check if we're actually in fullscreen before trying to exit
            const isFullscreen = document.fullscreenElement || 
                                document.webkitFullscreenElement || 
                                document.mozFullScreenElement || 
                                document.msFullscreenElement;
            
            if (!isFullscreen) {
                // Not in fullscreen, nothing to do
                return;
            }
            
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => {
                    // Silently handle - document might not be active
                    console.warn('Exit fullscreen failed:', err);
                });
            } else if (document.webkitExitFullscreen) {
                try {
                    document.webkitExitFullscreen();
                } catch (err) {
                    console.warn('Exit fullscreen (webkit) failed:', err);
                }
            } else if (document.mozCancelFullScreen) {
                try {
                    document.mozCancelFullScreen();
                } catch (err) {
                    console.warn('Exit fullscreen (moz) failed:', err);
                }
            } else if (document.msExitFullscreen) {
                try {
                    document.msExitFullscreen();
                } catch (err) {
                    console.warn('Exit fullscreen (ms) failed:', err);
                }
            }
        } catch (err) {
            // Catch any unexpected errors to prevent freezes
            console.warn('Exit fullscreen error:', err);
        }
    },

    // Handle fullscreen change events
    handleFullscreenChange() {
        // Fullscreen state is handled automatically by the browser
        // No need to resize canvas - browser will scale it appropriately
    },

    // Stop hunting
    stop() {
        this.state.active = false;
        // Don't exit fullscreen here - keep it for capture popup
        // Exit pointer lock when hunt stops
        this.exitPointerLock();
        // Only cancel animation if we're not showing capture results (which need to keep rendering)
        if (!this.state.showCaptureResults) {
        if (this.state.animationFrame) {
            cancelAnimationFrame(this.state.animationFrame);
            }
        }
        if (this.state.dino) {
            this.state.dino = null;
        }
        // Show gun stats again when hunt stops (but not if showing capture results)
        if (!this.state.showCaptureResults) {
            const gunStatsElement = document.querySelector('.gun-stats');
            if (gunStatsElement) {
                gunStatsElement.style.display = '';
            }
        }
        // Clear environment objects
        this.state.environment.bushes = [];
        this.state.bullets = [];
        this.state.dinoProjectiles = [];
        // Reset player position and health (ensure on walkable area)
        const bounds = this.state.environment.walkableBounds;
        const playerStart = this.clampToWalkableBounds(
            GameConfig.HUNTING.PLAYER_START_X,
            GameConfig.HUNTING.PLAYER_START_Y,
            this.state.player.size
        );
        this.state.player.x = playerStart.x;
        this.state.player.y = playerStart.y;
        this.state.player.health = GameConfig.HUNTING.PLAYER_MAX_HEALTH;
        
        // Load player image if not already loaded (weapon-specific)
        if (!this.state.player.image) {
            this.loadPlayerSprite();
        }
        
        // Load bullet (dart) image if not already loaded
        if (!this.state.bulletImage) {
            ImageLoader.loadImage('images/player/dart.png').then(img => {
                this.state.bulletImage = img;
            });
        }
        this.state.player.maxHealth = GameConfig.HUNTING.PLAYER_MAX_HEALTH;
        this.state.player.lastDamageTime = 0;
    },

    // Calculate difficulty multipliers based on upgrade spending
    calculateDifficulty() {
        const state = GameState.get();
        const config = GameConfig.HUNTING.DIFFICULTY;
        const spending = state.totalUpgradeSpending || 0;
        
        // Calculate which threshold we're at
        let threshold = 0;
        let currentThreshold = config.BASE_THRESHOLD;
        
        while (spending >= currentThreshold) {
            threshold++;
            currentThreshold *= config.THRESHOLD_MULTIPLIER;
        }
        
        // Calculate multipliers (don't fully negate upgrades - cap them)
        const healthMultiplier = Math.min(
            1.0 + (threshold * config.HEALTH_MULTIPLIER_PER_THRESHOLD),
            config.MAX_HEALTH_MULTIPLIER
        );
        const speedMultiplier = Math.min(
            1.0 + (threshold * config.SPEED_MULTIPLIER_PER_THRESHOLD),
            config.MAX_SPEED_MULTIPLIER
        );
        const sizeMultiplier = Math.min(
            1.0 + (threshold * config.SIZE_MULTIPLIER_PER_THRESHOLD),
            config.MAX_SIZE_MULTIPLIER
        );
        
        // Calculate number of dinosaurs to spawn
        let dinoCount = 1;
        for (let i = 0; i < config.MULTI_DINO_MILESTONES.length; i++) {
            if (spending >= config.MULTI_DINO_MILESTONES[i]) {
                dinoCount = i + 2; // 2, 3, 4, 5, or 6 dinos
            }
        }
        
        return {
            healthMultiplier,
            speedMultiplier,
            sizeMultiplier,
            dinoCount,
            threshold
        };
    },

    // Spawn a single dinosaur with difficulty scaling
    spawnSingleDino(difficulty) {
        const state = GameState.get();
        
        // Ensure unlock state exists
        if (!state.unlockedExhibitTypes) {
            state.unlockedExhibitTypes = {
                plant: true,
                meat: false,
                aquarium: false,
                aviary: false
            };
        }
        
        // In aquatic mode, only spawn aquatic dinos; in land mode, exclude aquatic dinos
        let availableSpecies;
        if (this.state.environment.isAquaticMode) {
            availableSpecies = Object.keys(GameConfig.DINOSAUR_SPECIES).filter(species => {
                const dinoSpecies = GameConfig.DINOSAUR_SPECIES[species];
                return dinoSpecies.category === 'aquarium' && state.unlockedExhibitTypes.aquarium === true;
            });
        } else {
            // Filter available species based on unlocked exhibits (exclude aquatic in land mode)
            availableSpecies = Object.keys(GameConfig.DINOSAUR_SPECIES).filter(species => {
                const dinoSpecies = GameConfig.DINOSAUR_SPECIES[species];
                
                // Skip aquatic dinos in land mode
                if (dinoSpecies.category === 'aquarium') {
                    return false;
                }
                
                // Only allow dinosaurs whose exhibit type is unlocked
                if (dinoSpecies.category === 'plant') {
                    return state.unlockedExhibitTypes.plant === true;
                } else if (dinoSpecies.category === 'meat') {
                    return state.unlockedExhibitTypes.meat === true;
                } else if (dinoSpecies.category === 'flying') {
                    return state.unlockedExhibitTypes.aviary === true;
                }
                
                return false; // Unknown category
            });
        }
        
        // If no species available (shouldn't happen, plant should always be unlocked), fallback to herbivores
        if (availableSpecies.length === 0) {
            availableSpecies = Object.keys(GameConfig.DINOSAUR_SPECIES).filter(species => 
                GameConfig.DINOSAUR_SPECIES[species].category === 'plant'
            );
        }
        
        // Select a species from available ones
        const totalSpeciesWeight = availableSpecies.reduce((sum, species) => 
            sum + GameConfig.DINOSAUR_SPECIES[species].spawnWeight, 0);
        
        let randSpecies = Math.random() * totalSpeciesWeight;
        let selectedSpecies = availableSpecies[0] || 'stegosaurus'; // Default to herbivore
        let currentWeight = 0;
        
        for (let species of availableSpecies) {
            currentWeight += GameConfig.DINOSAUR_SPECIES[species].spawnWeight;
            if (randSpecies <= currentWeight) {
                selectedSpecies = species;
                break;
            }
        }

        // Then, select a rarity
        const rarities = Object.keys(GameConfig.RARITY);
        const totalRarityWeight = rarities.reduce((sum, rarity) => 
            sum + GameConfig.RARITY[rarity].spawnWeight, 0);
        
        let randRarity = Math.random() * totalRarityWeight;
        let selectedRarity = 'common'; // Default
        currentWeight = 0;
        
        for (let rarity of rarities) {
            currentWeight += GameConfig.RARITY[rarity].spawnWeight;
            if (randRarity <= currentWeight) {
                selectedRarity = rarity;
                break;
            }
        }

        const dinoSpecies = GameConfig.DINOSAUR_SPECIES[selectedSpecies];
        const rarity = GameConfig.RARITY[selectedRarity];
        const config = GameConfig.HUNTING;
        
        // Calculate base stats with rarity modifiers
        let speed = dinoSpecies.baseSpeed * rarity.multiplier;
        let health = config.DINO_BASE_HEALTH * rarity.multiplier;
        
        // Apply difficulty multipliers
        health *= difficulty.healthMultiplier;
        speed *= difficulty.speedMultiplier;
        
        // Calculate size based on dinosaur species (not speed)
        // Use species-specific baseSize if available, otherwise fall back to default
        let baseSize = dinoSpecies.baseSize || config.DINO_BASE_SIZE;
        // Apply difficulty multiplier
        baseSize *= difficulty.sizeMultiplier;
        
        // Spawn position (will be adjusted for multiple dinos)
        let spawnX, spawnY;
        const isAquatic = dinoSpecies.category === 'aquarium';
        
        if (isAquatic && this.state.environment.lakeBounds) {
            // Aquatic dinos spawn in the lake (random position in water, ensuring they're fully in water)
            const lake = this.state.environment.lakeBounds;
            const halfSize = baseSize / 2;
            spawnX = lake.x + halfSize + Math.random() * (lake.width - baseSize);
            spawnY = lake.y + halfSize + Math.random() * (lake.height - baseSize);
        } else {
            // Land dinos spawn in walkable area
            const bounds = this.state.environment.walkableBounds;
            const clampedPos = this.clampToWalkableBounds(
                bounds.x + bounds.width * 0.75, // 75% across (right side)
                bounds.y + bounds.height / 2,   // Middle vertically
                baseSize
            );
            spawnX = clampedPos.x;
            spawnY = clampedPos.y;
        }
        
        // Initialize attack cooldown if dinosaur has attack
        const attackConfig = dinoSpecies.attack;
        const attackCooldown = attackConfig ? Math.floor(attackConfig.cooldown / (1000 / 60)) : 0; // Convert ms to frames at 60fps
        
        const dino = {
            species: selectedSpecies,
            rarity: selectedRarity,
            category: dinoSpecies.category,
            x: spawnX,
            y: spawnY,
            size: baseSize,
            baseSpeed: speed * config.DINO_BASE_SPEED,
            speed: speed * config.DINO_BASE_SPEED,
            health: health,
            maxHealth: health,
            direction: Math.random() * Math.PI * 2,
            emoji: dinoSpecies.emoji,
            image: null, // Will be set during render
            alerted: false, // Whether dino has seen player or been shot
            alertTimer: 0, // How long to stay alerted
            // Carnivore attack/retreat state
            attackState: 'idle', // 'idle', 'attacking', 'retreating'
            attackCooldown: attackCooldown, // Initialize with attack cooldown if has attack
            lastAttackTime: 0, // Track last attack time in milliseconds
            retreatTarget: null, // Target position when retreating
            // Direction smoothing to prevent edge jitter
            lastDirectionToPlayer: null,
            lastFleeAngle: null,
            directionRecalcTimer: 0,
            // Panic mode flag for herbivores (screensaver-style bouncing)
            panicDirectionSet: false,
            // Aquatic dino behavior
            isAquatic: dinoSpecies.category === 'aquarium',
            isUnderwater: dinoSpecies.category === 'aquarium', // Start underwater
            surfaceTimer: 0, // Timer for surfacing/submerging
            surfaceDuration: 120 + Math.random() * 120, // 2-4 seconds at surface
            underwaterDuration: 180 + Math.random() * 180 // 3-6 seconds underwater
        };
        
        // Try to load image immediately
        ImageLoader.loadImage(dinoSpecies.image).then(img => {
            // Find this dino in the dinos array and set its image
            const dinoIndex = this.state.dinos.findIndex(d => d.species === selectedSpecies && !d.image);
            if (img && dinoIndex !== -1) {
                this.state.dinos[dinoIndex].image = img;
            }
            // Also update state.dino for backward compatibility
            if (img && this.state.dino && this.state.dino.species === selectedSpecies) {
                this.state.dino.image = img;
            }
        });
        
        return dino;
    },

    // Spawn a dinosaur with species and rarity (supports multiple dinos)
    spawnDino() {
        // Calculate difficulty based on upgrade spending
        const difficulty = this.calculateDifficulty();
        
        // Clear existing dinosaurs
        this.state.dino = null;
        this.state.dinos = [];
        this.state.allSpawnedDinos = [];
        
        // Spawn the appropriate number of dinosaurs
        for (let i = 0; i < difficulty.dinoCount; i++) {
            const dino = this.spawnSingleDino(difficulty);
            
            // Store info about this dino for results display
            const dinoSpecies = GameConfig.DINOSAUR_SPECIES[dino.species];
            const rarity = GameConfig.RARITY[dino.rarity] || GameConfig.RARITY.common;
            this.state.allSpawnedDinos.push({
                species: dino.species,
                rarity: dino.rarity,
                name: dinoSpecies.name,
                emoji: dinoSpecies.emoji,
                image: dinoSpecies.image,
                rarityColor: rarity.color,
                rarityName: rarity.name,
                appeal: dinoSpecies.baseAppeal + rarity.appealBonus,
                value: Math.floor(dinoSpecies.baseValue * rarity.valueMultiplier),
                captured: false
            });
            
            // Distribute spawn positions for multiple dinos
            if (difficulty.dinoCount > 1) {
                if (dino.isAquatic && this.state.environment.lakeBounds) {
                    // Aquatic dinos: distribute in lake area
                    const lake = this.state.environment.lakeBounds;
                    const angle = (Math.PI * 2 * i) / difficulty.dinoCount; // Distribute in circle
                    const radius = Math.min(lake.width * 0.3, lake.height * 0.3);
                    const centerX = lake.x + lake.width / 2;
                    const centerY = lake.y + lake.height / 2;
                    
                    dino.x = centerX + Math.cos(angle) * radius;
                    dino.y = centerY + Math.sin(angle) * radius;
                    
                    // Clamp to lake bounds (ensure fully in water)
                    const halfSize = dino.size / 2;
                    dino.x = Math.max(lake.x + halfSize, Math.min(lake.x + lake.width - halfSize, dino.x));
                    dino.y = Math.max(lake.y + halfSize, Math.min(lake.y + lake.height - halfSize, dino.y));
                } else {
                    // Land dinos: distribute in walkable area
                    const bounds = this.state.environment.walkableBounds;
                    const angle = (Math.PI * 2 * i) / difficulty.dinoCount; // Distribute in circle
                    const radius = Math.min(bounds.width * 0.2, bounds.height * 0.2);
                    const centerX = bounds.x + bounds.width * 0.75;
                    const centerY = bounds.y + bounds.height / 2;
                    
                    dino.x = centerX + Math.cos(angle) * radius;
                    dino.y = centerY + Math.sin(angle) * radius;
                    
                    // Clamp to walkable bounds
                    const clampedPos = this.clampToWalkableBounds(dino.x, dino.y, dino.size);
                    dino.x = clampedPos.x;
                    dino.y = clampedPos.y;
                }
            }
            
            // Add to dinos array
            this.state.dinos.push(dino);
            
            // For backward compatibility, set first dino as state.dino
            if (i === 0) {
                this.state.dino = dino;
            }
        }
    },

    // Main animation loop
    animate() {
        // Start frame profiling
        const frameNumber = this.state.performance.frameCount;
        if (typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled) {
            DebugProfiler.startFrame(frameNumber);
        }
        
        // #region agent log
        if (frameNumber % 60 === 0) { // Log every 60 frames (~1 second at 60fps)
            debugLog('hunting-game.js:1034', 'animate frame', {frameNumber, bullets:this.state.bullets.length, active:this.state.active}, 'A');
        }
        // #endregion
        
        try {
            // Performance monitoring
            const perfSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
                ? DebugProfiler.startSection('Performance Monitoring') : null;
            const perf = this.state.performance;
            const now = performance.now();
            if (perf.lastFrameTime > 0) {
                const frameTime = now - perf.lastFrameTime;
                perf.frameTimes.push(frameTime);
                if (perf.frameTimes.length > 60) {
                    perf.frameTimes.shift(); // Keep only last 60 frames
                }
                if (frameTime > 16.67) { // > 60fps threshold
                    perf.slowFrames++;
                }
                
                // Log performance issues every 10 seconds if there are problems (less frequent to reduce overhead)
                if (now - perf.lastLogTime > 10000 && perf.slowFrames > 20) {
                    const avgFrameTime = perf.frameTimes.reduce((a, b) => a + b, 0) / perf.frameTimes.length;
                    const fps = 1000 / avgFrameTime;
                    console.warn(`Performance warning: ${perf.slowFrames} slow frames, avg FPS: ${fps.toFixed(1)}, bullets: ${this.state.bullets.length}, dinos: ${this.state.dinos.length}`);
                    perf.slowFrames = 0; // Reset counter
                    perf.lastLogTime = now;
                }
            }
            perf.lastFrameTime = now;
            perf.frameCount++;
            if (perfSection) DebugProfiler.endSection(perfSection);
            
            // Continue animating if showing capture results (even if not active)
            if (!this.state.active && !this.state.showCaptureResults) {
                if (typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled) {
                    DebugProfiler.endFrame();
                }
                return;
            }

        const ctx = this.state.ctx;
        const canvas = this.state.canvas;
        
        // Cache game state and current weapon config at start of frame (used multiple times)
        const stateCacheSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('State Caching') : null;
        const cachedState = GameState.get();
        const cachedWeaponId = cachedState.currentWeapon || 'pistol';
        const cachedWeapon = cachedState.weapons && cachedState.weapons[cachedWeaponId];
        const cachedWeaponConfig = GameConfig.WEAPONS[cachedWeaponId];
        
        // Validate cached state
        if (typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled) {
            DebugProfiler.validateState(cachedState, 'cachedState');
            DebugProfiler.validateState(cachedWeapon, 'cachedWeapon');
        }
        if (stateCacheSection) DebugProfiler.endSection(stateCacheSection);

        // Update hunt timer
        const timerSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Timer Updates') : null;
        if (this.state.huntTimer.startTime && !this.state.huntTimer.expired) {
            const elapsed = Date.now() - this.state.huntTimer.startTime;
            this.state.huntTimer.timeRemaining = Math.max(0, this.state.huntTimer.duration - elapsed);
            
            // Check if timer expired
            if (this.state.huntTimer.timeRemaining <= 0 && !this.state.huntTimer.expired) {
                this.state.huntTimer.expired = true;
                this.handleTimerExpiration();
            }
        }
        if (timerSection) DebugProfiler.endSection(timerSection);
        
        // Check if player is dead - end hunt automatically
        if (this.state.player.health <= 0) {
            this.state.player.health = 0;
            UI.showNotification('You were defeated! Hunt ended.', 3000);
            this.stop();
            if (typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled) {
                DebugProfiler.endFrame();
            }
            return;
        }

        // Update screen shake
        const shakeSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Screen Shake') : null;
        this.updateScreenShake();
        if (shakeSection) DebugProfiler.endSection(shakeSection);

        // Update critical hit indicator
        const indicatorsSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Indicator Updates') : null;
        if (this.state.criticalHitIndicator.active) {
            this.state.criticalHitIndicator.timer--;
            if (this.state.criticalHitIndicator.timer <= 0) {
                this.state.criticalHitIndicator.active = false;
            }
        }

        // Update player damage indicator
        if (this.state.playerDamageIndicator.active) {
            this.state.playerDamageIndicator.timer--;
            if (this.state.playerDamageIndicator.timer <= 0) {
                this.state.playerDamageIndicator.active = false;
            }
        }

        // Update miss indicator
        if (this.state.missIndicator.active) {
            this.state.missIndicator.timer--;
            if (this.state.missIndicator.timer <= 0) {
                this.state.missIndicator.active = false;
            }
        }
        if (indicatorsSection) DebugProfiler.endSection(indicatorsSection);
        
        // Update reload state
        const reloadSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Reload Update') : null;
        this.updateReload();
        if (reloadSection) DebugProfiler.endSection(reloadSection);
        
        // Update gas grenades
        const grenadesSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Gas Grenades Update') : null;
        this.updateGasGrenades();
        if (grenadesSection) DebugProfiler.endSection(grenadesSection);
        
        // Continuous fire removed - simplified shooting

        // Update bush detection and cooldown timers
        const bushSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Bush States Update') : null;
        this.updateBushStates();
        if (bushSection) DebugProfiler.endSection(bushSection);

        // Apply screen shake offset
        const drawingSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Drawing') : null;
        ctx.save();
        ctx.translate(this.state.screenShake.x, this.state.screenShake.y);

        // Clear canvas
        const clearSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Canvas Clear') : null;
        ctx.clearRect(-100, -100, canvas.width + 200, canvas.height + 200);
        if (clearSection) DebugProfiler.endSection(clearSection);

        // Draw background image or fallback to sandy texture
        const bgSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Background Drawing') : null;
        if (this.state.environment.backgroundImage) {
            ctx.drawImage(
                this.state.environment.backgroundImage,
                0, 0,
                canvas.width, canvas.height
            );
        } else {
            this.drawSandyBackground(ctx, canvas);
        }
        if (bgSection) DebugProfiler.endSection(bgSection);
        
        // Note: Lake is now part of background-lake.png, so we don't draw it separately
        // The background-lake.png should have both land and water zones
        
        // Draw environment objects (bushes only, not in aquatic mode)
        const envSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Environment Drawing') : null;
        if (!this.state.environment.isAquaticMode) {
            this.drawEnvironment(ctx);
        }
        if (envSection) DebugProfiler.endSection(envSection);

        // Update player movement
        const playerUpdateSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Player Update') : null;
        this.updatePlayer();
        if (playerUpdateSection) DebugProfiler.endSection(playerUpdateSection);

        // Draw player
        const playerDrawSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Player Drawing') : null;
        this.drawPlayer(ctx);
        if (playerDrawSection) DebugProfiler.endSection(playerDrawSection);
        
        // Draw player health bar
        this.drawPlayerHealth(ctx);

        // Draw weapon-specific aiming mechanics
        // Only draw during active hunt, not during capture results
        const aimingSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Weapon Aiming Drawing') : null;
        if (!this.state.showCaptureResults) {
            this.drawWeaponAiming(ctx);
        }
        if (aimingSection) DebugProfiler.endSection(aimingSection);
        
        // Draw reload indicator
        this.drawReloadIndicator(ctx);
        
        // Draw weapon indicator (fullscreen HUD)
        this.drawWeaponIndicator(ctx);
        
        // Draw miss indicator
        this.drawMissIndicator(ctx);
        
        // Draw hunt timer at top of canvas
        this.drawHuntTimer(ctx);
        if (drawingSection) DebugProfiler.endSection(drawingSection);

        // Update and draw dinos (support multiple)
        const dinoSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection(`Dino Updates (${this.state.dinos.length})`) : null;
        const activeDinos = this.state.dinos.length > 0 ? this.state.dinos : (this.state.dino ? [this.state.dino] : []);
        
        // Track resource usage
        if (typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled && GameConfig.DEBUG.RESOURCE_TRACKING) {
            DebugProfiler.logOperation('resource_check', {
                bullets: this.state.bullets.length,
                dinos: activeDinos.length,
                gasGrenades: this.state.gasGrenades ? this.state.gasGrenades.length : 0
            });
        }
        
        // First, update non-captured dinos (AI, movement, etc.)
        for (let dinoIdx = 0; dinoIdx < activeDinos.length; dinoIdx++) {
            const dinoUpdateSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
                ? DebugProfiler.startSection(`Dino ${dinoIdx} Update`) : null;
            const d = activeDinos[dinoIdx];
            if (!d) continue; // Skip invalid dinos
            if (d.captured) continue; // Skip captured dinos (they're already tranquilized and stopped)
            if (d.health <= 0 && !d.captured) {
                // Health reached zero but not yet captured - capture it now
                this.captureDino(d);
                continue; // Skip to next dino
            }
            
            // Update aquatic dino behavior (pop-up/submerge)
            if (d.isAquatic) {
                d.surfaceTimer++;
                if (d.isUnderwater) {
                    // Underwater - wait for timer, then surface
                    if (d.surfaceTimer >= d.underwaterDuration) {
                        d.isUnderwater = false;
                        d.surfaceTimer = 0;
                        // Randomize next underwater duration
                        d.underwaterDuration = 180 + Math.random() * 180;
                    }
                } else {
                    // On surface - wait for timer, then submerge
                    if (d.surfaceTimer >= d.surfaceDuration) {
                        d.isUnderwater = true;
                        d.surfaceTimer = 0;
                        // Randomize next surface duration
                        d.surfaceDuration = 120 + Math.random() * 120;
                    }
                }
            }
            
            const player = this.state.player;
            const config = GameConfig.HUNTING;
            
            // Check if player is in a usable bush (safe zone) - reset alert timer
            const currentBush = this.getPlayerBush();
            if (currentBush && this.isBushUsable(currentBush)) {
                d.alerted = false;
                d.alertTimer = 0;
            } else {
                // Check vision cone and update alert status
                const canSeePlayer = this.checkVisionCone(d, player, config.DINO_VISION_RANGE, config.DINO_VISION_ANGLE);
                if (canSeePlayer && !d.alerted) {
                    // Just became alerted - play sound (throttled to prevent spam)
                    if (typeof SoundManager !== 'undefined') {
                        const now = Date.now();
                        const lastAlertSound = this.state.lastAlertSoundTime || 0;
                        if (now - lastAlertSound > 500) { // Only play alert sound once per 500ms
                            SoundManager.playSound('alert');
                            this.state.lastAlertSoundTime = now;
                        }
                    }
                }
                if (canSeePlayer) {
                    d.alerted = true;
                    d.alertTimer = 300; // Stay alerted for 5 seconds at 60fps
                } else if (d.alertTimer > 0) {
                    d.alertTimer--;
                } else {
                    d.alerted = false;
                }
            }
            
            // Update attack cooldown (in frames)
            if (d.attackCooldown > 0) {
                d.attackCooldown--;
            }
            
            // Handle projectile attacks
            const dinoSpecies = GameConfig.DINOSAUR_SPECIES[d.species];
            if (dinoSpecies.attack && d.alerted && d.attackCooldown === 0) {
                const dist = this.getToroidalDistance(d.x, d.y, player.x, player.y, canvas.width, canvas.height);
                const attackConfig = dinoSpecies.attack;
                
                // Check if player is in attack range
                if (dist <= attackConfig.range) {
                    // Fire projectile at player
                    this.fireDinoProjectile(d, player, attackConfig);
                    
                    // Reset cooldown
                    d.attackCooldown = Math.floor(attackConfig.cooldown / (1000 / 60)); // Convert ms to frames
                    d.lastAttackTime = Date.now();
                }
            }
            
            // Update behavior based on category and alert status
            if (d.alerted) {
                const dist = this.getToroidalDistance(d.x, d.y, player.x, player.y, canvas.width, canvas.height);
                
                // Only recalculate direction periodically to avoid jitter at edges (every 10 frames)
                let directionToPlayer = d.lastDirectionToPlayer || 0;
                if (!d.directionRecalcTimer || d.directionRecalcTimer <= 0) {
                    directionToPlayer = this.getToroidalDirection(d.x, d.y, player.x, player.y, canvas.width, canvas.height);
                    d.lastDirectionToPlayer = directionToPlayer;
                    d.directionRecalcTimer = 10; // Recalculate every 10 frames
                } else {
                    d.directionRecalcTimer--;
                }
                
                if (d.category === 'meat') {
                    // Carnivore: attack then retreat pattern (melee attack only if no projectile attack)
                    if (dist <= config.CARNIVORE_ATTACK_RANGE && d.attackCooldown === 0 && !dinoSpecies.attack) {
                        // Attack player
                        d.attackState = 'attacking';
                        const now = Date.now();
                        const cooldownMs = config.PLAYER_DAMAGE_COOLDOWN * (1000 / 60); // Convert frames to milliseconds at 60fps
                        if (now - player.lastDamageTime >= cooldownMs) {
                            player.health -= config.CARNIVORE_ATTACK_DAMAGE;
                            player.lastDamageTime = now;
                            
                            // Play damage sound (throttled to prevent spam)
                            if (typeof SoundManager !== 'undefined') {
                                const now = Date.now();
                                const lastDamageSound = this.state.lastDamageSoundTime || 0;
                                if (now - lastDamageSound > 200) { // Only play damage sound once per 200ms
                                    SoundManager.playSound('damage');
                                    this.state.lastDamageSoundTime = now;
                                }
                            }
                            
                            // Visual feedback for player damage
                            this.triggerScreenShake(8, 15); // Shake for damage
                            this.state.playerDamageIndicator.active = true;
                            this.state.playerDamageIndicator.timer = 30; // Show for 0.5 seconds
                            
                            if (player.health <= 0) {
                                player.health = 0;
                                // Game over or reset - could stop hunt here if desired
                            }
                        }
                        d.attackCooldown = config.CARNIVORE_ATTACK_COOLDOWN;
                        
                        // Set retreat target (away from player) - use toroidal direction
                        const retreatAngle = directionToPlayer + Math.PI + (Math.random() - 0.5) * Math.PI / 2;
                        let retreatX = d.x + Math.cos(retreatAngle) * config.CARNIVORE_RETREAT_DISTANCE;
                        let retreatY = d.y + Math.sin(retreatAngle) * config.CARNIVORE_RETREAT_DISTANCE;
                        
                        // Wrap retreat target coordinates (toroidal space) - use same wrapping as movement
                        if (retreatX < 0) retreatX += canvas.width;
                        else if (retreatX >= canvas.width) retreatX -= canvas.width;
                        if (retreatY < 0) retreatY += canvas.height;
                        else if (retreatY >= canvas.height) retreatY -= canvas.height;
                        
                        d.retreatTarget = {
                            x: retreatX,
                            y: retreatY
                        };
                    }
                    
                    if (d.retreatTarget) {
                        const retreatDist = this.getToroidalDistance(d.x, d.y, d.retreatTarget.x, d.retreatTarget.y, canvas.width, canvas.height);
                        
                        if (retreatDist > 10) {
                            // Still retreating
                            d.attackState = 'retreating';
                            d.direction = this.getToroidalDirection(d.x, d.y, d.retreatTarget.x, d.retreatTarget.y, canvas.width, canvas.height);
                            d.speed = d.baseSpeed * 1.0; // Slower retreat
                        } else {
                            // Finished retreating, can attack again
                            d.retreatTarget = null;
                            if (dist <= config.CARNIVORE_ATTACK_RANGE * 1.5) {
                                // Move toward player slowly
                                d.direction = directionToPlayer;
                                d.speed = d.baseSpeed * config.CARNIVORE_CHASE_SPEED_MULTIPLIER;
                            } else {
                                d.attackState = 'idle';
                            }
                        }
                    } else if (dist > config.CARNIVORE_ATTACK_RANGE) {
                        // Move toward player slowly
                        d.direction = directionToPlayer;
                        d.speed = d.baseSpeed * config.CARNIVORE_CHASE_SPEED_MULTIPLIER;
                        d.attackState = 'attacking';
                    }
                } else {
                    // Herbivore: panic mode - move in straight lines bouncing off walls (like old screensaver)
                    // Use lake bounds for aquatic dinos, walkable bounds for land dinos
                    const bounds = d.isAquatic && this.state.environment.lakeBounds 
                        ? this.state.environment.lakeBounds 
                        : this.state.environment.walkableBounds;
                    
                    // Initialize direction if not set (first time entering panic)
                    if (!d.panicDirectionSet) {
                        // Start with a random direction away from player
                        const baseFleeAngle = directionToPlayer + Math.PI;
                        const randomVariation = (Math.random() - 0.5) * Math.PI / 2; // -45 to +45 degrees variation
                        d.direction = baseFleeAngle + randomVariation;
                        d.panicDirectionSet = true;
                    }
                    
                    // Check for wall collisions and bounce
                    const moveX = Math.cos(d.direction) * d.speed;
                    const moveY = Math.sin(d.direction) * d.speed;
                    const nextX = d.x + moveX;
                    const nextY = d.y + moveY;
                    const halfSize = d.size / 2;
                    
                    // Check left/right bounds
                    if (nextX - halfSize <= bounds.x || nextX + halfSize >= bounds.x + bounds.width) {
                        // Bounce horizontally - reverse x direction
                d.direction = Math.PI - d.direction;
                        // Normalize angle
                        while (d.direction > Math.PI) d.direction -= Math.PI * 2;
                        while (d.direction < -Math.PI) d.direction += Math.PI * 2;
            }
                    
                    // Check top/bottom bounds
                    if (nextY - halfSize <= bounds.y || nextY + halfSize >= bounds.y + bounds.height) {
                        // Bounce vertically - reverse y direction
                d.direction = -d.direction;
                        // Normalize angle
                        while (d.direction > Math.PI) d.direction -= Math.PI * 2;
                        while (d.direction < -Math.PI) d.direction += Math.PI * 2;
                    }
                    
                    // Increased speed in panic state (1.5x base speed)
                    d.speed = d.baseSpeed * 1.5;
                    
                    // Check for contact with player - apply damage
                    const contactDistance = d.size / 2 + player.size;
                    if (dist < contactDistance) {
                        const now = Date.now();
                        const cooldownMs = config.PLAYER_DAMAGE_COOLDOWN * (1000 / 60); // Convert frames to milliseconds at 60fps
                        if (now - player.lastDamageTime >= cooldownMs) {
                            // Apply herbivore contact damage (less than carnivore attack)
                            const herbivoreDamage = config.CARNIVORE_ATTACK_DAMAGE * 0.5; // Half of carnivore damage
                            player.health -= herbivoreDamage;
                            player.lastDamageTime = now;
                            
                            // Play damage sound (throttled to prevent spam)
                            if (typeof SoundManager !== 'undefined') {
                                const now = Date.now();
                                const lastDamageSound = this.state.lastDamageSoundTime || 0;
                                if (now - lastDamageSound > 200) { // Only play damage sound once per 200ms
                                    SoundManager.playSound('damage');
                                    this.state.lastDamageSoundTime = now;
                                }
                            }
                            
                            // Visual feedback for player damage
                            this.triggerScreenShake(8, 15); // Shake for damage
                            this.state.playerDamageIndicator.active = true;
                            this.state.playerDamageIndicator.timer = 30; // Show for 0.5 seconds
                            
                            if (player.health <= 0) {
                                player.health = 0;
                                // Game over or reset - could stop hunt here if desired
                            }
                        }
                    }
                }
            } else {
                // Normal wandering behavior - random movement within bounds (lake for aquatic, walkable for land)
                const bounds = d.isAquatic && this.state.environment.lakeBounds 
                    ? this.state.environment.lakeBounds 
                    : this.state.environment.walkableBounds;
                const edgeDetectionZone = d.size + 10; // Detect edges before hitting them
                
                // Check if near edges and adjust direction to move away
                const nearLeftEdge = d.x - bounds.x < edgeDetectionZone;
                const nearRightEdge = (bounds.x + bounds.width) - d.x < edgeDetectionZone;
                const nearTopEdge = d.y - bounds.y < edgeDetectionZone;
                const nearBottomEdge = (bounds.y + bounds.height) - d.y < edgeDetectionZone;
                
                // Adjust direction away from edges if too close
                if (nearLeftEdge || nearRightEdge || nearTopEdge || nearBottomEdge) {
                    // Calculate direction away from nearest edge(s)
                    let avoidanceAngle = d.direction;
                    
                    if (nearLeftEdge) {
                        // Steer right (positive x direction)
                        avoidanceAngle = 0; // 0 radians = right
                    } else if (nearRightEdge) {
                        // Steer left (negative x direction)
                        avoidanceAngle = Math.PI; // 180 degrees = left
                    }
                    
                    if (nearTopEdge) {
                        // Steer down (positive y direction)
                        avoidanceAngle = Math.PI / 2; // 90 degrees = down
                    } else if (nearBottomEdge) {
                        // Steer up (negative y direction)
                        avoidanceAngle = -Math.PI / 2; // -90 degrees = up
                    }
                    
                    // If near multiple edges, use average or diagonal avoidance
                    if ((nearLeftEdge || nearRightEdge) && (nearTopEdge || nearBottomEdge)) {
                        // Near corner - move diagonally away
                        if (nearLeftEdge && nearTopEdge) avoidanceAngle = Math.PI / 4; // Down-right
                        else if (nearRightEdge && nearTopEdge) avoidanceAngle = 3 * Math.PI / 4; // Down-left
                        else if (nearLeftEdge && nearBottomEdge) avoidanceAngle = -Math.PI / 4; // Up-right
                        else if (nearRightEdge && nearBottomEdge) avoidanceAngle = -3 * Math.PI / 4; // Up-left
                    }
                    
                    // Blend current direction with avoidance direction (70% current, 30% avoidance)
                    const blendWeight = 0.3;
                    const angleDiff = avoidanceAngle - d.direction;
                    // Normalize angle difference to [-PI, PI]
                    let normalizedDiff = angleDiff;
                    while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
                    while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;
                    d.direction += normalizedDiff * blendWeight;
                } else {
                    // Not near edges - normal random wandering
                    if (!d.directionRecalcTimer || d.directionRecalcTimer <= 0) {
            if (Math.random() < GameConfig.HUNTING.DINO_DIRECTION_CHANGE_CHANCE) {
                d.direction = Math.random() * Math.PI * 2;
                        }
                        d.directionRecalcTimer = 60; // Change direction check every 60 frames (~1 second)
                    } else {
                        d.directionRecalcTimer--;
                    }
                }
                
                d.speed = d.baseSpeed;
                d.attackState = 'idle';
                d.retreatTarget = null;
                d.lastDirectionToPlayer = null;
                d.lastFleeAngle = null;
                d.panicDirectionSet = false; // Reset panic direction when no longer alerted
            }
            
            // Move dino
            const moveX = Math.cos(d.direction) * d.speed;
            const moveY = Math.sin(d.direction) * d.speed;
            
            // Calculate new position
            let newX = d.x + moveX;
            let newY = d.y + moveY;
            
            // For aquatic dinos, bounce off lake edges like panicked herbivores
            if (d.isAquatic && this.state.environment.lakeBounds) {
                const lake = this.state.environment.lakeBounds;
                const halfSize = d.size / 2;
                
                // Check for wall collisions and bounce (screensaver-style)
                // Check left/right bounds
                if (newX - halfSize <= lake.x || newX + halfSize >= lake.x + lake.width) {
                    // Bounce horizontally - reverse x direction
                    d.direction = Math.PI - d.direction;
                    // Normalize angle
                    while (d.direction > Math.PI) d.direction -= Math.PI * 2;
                    while (d.direction < -Math.PI) d.direction += Math.PI * 2;
                    // Recalculate position with new direction
                    newX = d.x + Math.cos(d.direction) * d.speed;
                    newY = d.y + Math.sin(d.direction) * d.speed;
                }
                
                // Check top/bottom bounds
                if (newY - halfSize <= lake.y || newY + halfSize >= lake.y + lake.height) {
                    // Bounce vertically - reverse y direction
                    d.direction = -d.direction;
                    // Normalize angle
                    while (d.direction > Math.PI) d.direction -= Math.PI * 2;
                    while (d.direction < -Math.PI) d.direction += Math.PI * 2;
                    // Recalculate position with new direction
                    newX = d.x + Math.cos(d.direction) * d.speed;
                    newY = d.y + Math.sin(d.direction) * d.speed;
                }
                
                // Clamp to ensure they stay within bounds (safety check)
                d.x = Math.max(lake.x + halfSize, Math.min(lake.x + lake.width - halfSize, newX));
                d.y = Math.max(lake.y + halfSize, Math.min(lake.y + lake.height - halfSize, newY));
            } else {
                // Clamp dino to walkable bounds (rectangle) - but with minimal buffer to allow full zone usage
                const clampedPos = this.clampToWalkableBounds(newX, newY, d.size / 2);
                d.x = clampedPos.x;
                d.y = clampedPos.y;
            }

            // Use RenderingUtils.drawDino for consistent sprite flipping
            RenderingUtils.drawDino(ctx, d, {
                showHealthBar: !d.captured && (!d.isAquatic || !d.isUnderwater),
                showAlertMark: d.alerted && !d.captured && (!d.isAquatic || !d.isUnderwater),
                showSleepingZees: d.captured
            });
            
            // Draw exclamation mark above alerted dinosaurs (but not if captured or underwater)
            if (d.alerted && !d.captured && (!d.isAquatic || !d.isUnderwater)) {
                ctx.fillStyle = '#FF0000';
                ctx.font = 'bold 30px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('!', d.x, d.y - d.size/2 - 30);
                // Draw shadow/outline for visibility
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.strokeText('!', d.x, d.y - d.size/2 - 30);
            }

            // Draw vision cone (always visible, but not for captured dinos)
            if (!d.captured) {
                if (d.alerted) {
                    this.drawVisionCone(ctx, d, config.DINO_VISION_RANGE, config.DINO_VISION_ANGLE, 'rgba(255, 0, 0, 0.3)');
                } else {
                    // Lighter color when not alerted
                    this.drawVisionCone(ctx, d, config.DINO_VISION_RANGE, config.DINO_VISION_ANGLE, 'rgba(100, 100, 100, 0.15)');
                }
            }
            if (dinoUpdateSection) DebugProfiler.endSection(dinoUpdateSection);
        } // End of dino update loop
        if (dinoSection) DebugProfiler.endSection(dinoSection);
        
        // Draw captured dinos separately (they don't move but should still be visible)
        const capturedDinoSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Captured Dinos Drawing') : null;
        for (let dinoIdx = 0; dinoIdx < activeDinos.length; dinoIdx++) {
            const d = activeDinos[dinoIdx];
            if (!d || !d.captured) continue; // Only draw captured dinos here

            // Draw rarity glow/border
            const rarity = GameConfig.RARITY[d.rarity] || GameConfig.RARITY.common;
            ctx.shadowColor = rarity.color;
            ctx.shadowBlur = 15;
            
            // Draw dino (image or emoji fallback)
            const image = ImageLoader.getImage(d.species);
            if (image && image.complete && image.naturalWidth > 0) {
                // Draw image
                ctx.save();
                ctx.translate(d.x, d.y);
                const imgSize = d.size;
                ctx.drawImage(image, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
                ctx.restore();
            } else {
                // Fallback to emoji
                ctx.font = `${d.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(d.emoji, d.x, d.y);
            }
            
            ctx.shadowBlur = 0; // Reset shadow

            // Draw health bar (should be empty/full red since health is 0)
            const barWidth = d.size;
            const barHeight = 5;
            ctx.fillStyle = 'red';
            ctx.fillRect(d.x - barWidth/2, d.y - d.size/2 - 15, barWidth, barHeight);
            ctx.fillStyle = 'green';
            ctx.fillRect(d.x - barWidth/2, d.y - d.size/2 - 15, barWidth * (d.health / d.maxHealth), barHeight);

            // Draw Z's above captured dinosaurs (tranquilized)
            this.drawSleepingZees(ctx, d);
        } // End of captured dino draw loop
        if (capturedDinoSection) DebugProfiler.endSection(capturedDinoSection);

        // Update and draw bullets
        const bulletSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection(`Bullet Updates (${this.state.bullets.length})`) : null;
        for (let i = this.state.bullets.length - 1; i >= 0; i--) {
            const bullet = this.state.bullets[i];
            if (!bullet) continue; // Skip undefined bullets
            
            // Validate bullet state
            if (typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled && GameConfig.DEBUG.STATE_VALIDATION) {
                if (!DebugProfiler.validateState(bullet, `bullet[${i}]`)) {
                    // Remove invalid bullet
                    this.state.bullets.splice(i, 1);
                    continue;
                }
            }
            
            // Store previous positions for tracer effect
            if (!bullet.trail) {
                bullet.trail = [];
            }
            bullet.trail.push({ x: bullet.x, y: bullet.y });
            // Keep only last N positions
            if (bullet.trail.length > GameConfig.GUN.DART_TRACER_LENGTH) {
                bullet.trail.shift();
            }
            
            // Draw tracer trail
            if (bullet.trail.length > 1) {
                ctx.save();
                ctx.strokeStyle = `rgba(255, 255, 0, ${GameConfig.GUN.DART_TRACER_OPACITY})`;
            ctx.lineWidth = 2;
                ctx.lineCap = 'round';
            ctx.beginPath();
                ctx.moveTo(bullet.trail[0].x, bullet.trail[0].y);
                for (let j = 1; j < bullet.trail.length; j++) {
                    ctx.lineTo(bullet.trail[j].x, bullet.trail[j].y);
                }
            ctx.stroke();
                ctx.restore();
            }
            
            // Draw bullet (dart sprite) with glow
            if (this.state.bulletImage && this.state.bulletImage.complete && this.state.bulletImage.naturalWidth > 0) {
                ctx.save();
                ctx.translate(bullet.x, bullet.y);
                // Rotate dart to match velocity direction
                const angle = Math.atan2(bullet.vy, bullet.vx);
                ctx.rotate(angle);
                
                // Draw glow effect
                const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, GameConfig.GUN.DART_GLOW_SIZE / 2);
                glowGradient.addColorStop(0, `rgba(255, 255, 0, ${GameConfig.GUN.DART_GLOW_INTENSITY})`);
                glowGradient.addColorStop(0.5, `rgba(255, 200, 0, ${GameConfig.GUN.DART_GLOW_INTENSITY * 0.5})`);
                glowGradient.addColorStop(1, 'rgba(255, 200, 0, 0)');
                ctx.fillStyle = glowGradient;
                ctx.beginPath();
                ctx.arc(0, 0, GameConfig.GUN.DART_GLOW_SIZE / 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw dart sprite (centered)
                const dartSize = GameConfig.GUN.DART_SIZE;
                ctx.drawImage(
                    this.state.bulletImage,
                    -dartSize / 2,
                    -dartSize / 2,
                    dartSize,
                    dartSize
                );
                ctx.restore();
            } else {
                // Fallback to yellow circle with glow if image not loaded
                ctx.save();
                // Draw glow
                const glowGradient = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, GameConfig.GUN.DART_GLOW_SIZE / 2);
                glowGradient.addColorStop(0, `rgba(255, 255, 0, ${GameConfig.GUN.DART_GLOW_INTENSITY})`);
                glowGradient.addColorStop(0.5, `rgba(255, 200, 0, ${GameConfig.GUN.DART_GLOW_INTENSITY * 0.5})`);
                glowGradient.addColorStop(1, 'rgba(255, 200, 0, 0)');
                ctx.fillStyle = glowGradient;
                ctx.beginPath();
                ctx.arc(bullet.x, bullet.y, GameConfig.GUN.DART_GLOW_SIZE / 2, 0, Math.PI * 2);
                ctx.fill();
                // Draw bullet
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, GameConfig.GUN.BULLET_SIZE, 0, Math.PI * 2);
            ctx.fill();
                ctx.restore();
            }

            try {
                bullet.x += bullet.vx;
                bullet.y += bullet.vy;

                const player = this.state.player;
                // Use cached weapon stats from start of frame
                const weapon = cachedWeapon || cachedState.gun; // Fallback to legacy gun if weapon not found
                
                // Check collision with dinos (using toroidal distance for wraparound) before checking bounds
                let hitDino = false;
                const activeDinos = this.state.dinos.length > 0 ? this.state.dinos : (this.state.dino ? [this.state.dino] : []);
                
                for (let dinoIdx = 0; dinoIdx < activeDinos.length; dinoIdx++) {
                    const dino = activeDinos[dinoIdx];
                    if (!dino || dino.captured || dino.health <= 0) continue; // Skip captured or already dead dinos
                    if (dino.isAquatic && dino.isUnderwater) continue; // Can't hit aquatic dinos when underwater
                    
                    const dist = this.getToroidalDistance(bullet.x, bullet.y, dino.x, dino.y, canvas.width, canvas.height);
                    
                    // Check for hit - normal collision or proximity hit for sniper
                    let hit = false;
                    const weaponConfig = cachedWeaponConfig;
                    if (weaponConfig && weaponConfig.proximityHit && bullet.proximityHit) {
                        // Sniper proximity hit: check if dino is within proximity radius of aim point
                        if (!bullet.aimPoint) {
                            console.error('[DEBUG] Bullet has proximityHit but no aimPoint!', bullet);
                            continue; // Skip this dino check if aimPoint is missing
                        }
                        const aimPoint = bullet.aimPoint;
                        const aimDist = this.getToroidalDistance(aimPoint.x, aimPoint.y, dino.x, dino.y, canvas.width, canvas.height);
                        const proximityRadius = weaponConfig.proximityRadius || 30;
                        hit = aimDist <= proximityRadius;
                    } else {
                        // Normal collision detection
                        hit = dist < dino.size / 2;
                    }
                
                if (hit) {
                    hitDino = true;
                    
                    // Check for critical hit (dino not alerted = sneaked up on them)
                    // Disable critical hits when shooting from bushes (camping is not sneaking)
                    const playerInBush = this.isPlayerInBush();
                    const isCritical = !dino.alerted && !playerInBush;
                    // Use bullet's stored damage (for spread weapons, this is per-pellet damage)
                    const baseDamage = bullet.damage !== undefined ? bullet.damage : weapon.damage;
                    const finalDamage = isCritical ? baseDamage * 3 : baseDamage;
                    
                    dino.health -= finalDamage;
                    this.state.bullets.splice(i, 1);

                    // Alert dino when hit
                    dino.alerted = true;
                    dino.alertTimer = 300; // 5 seconds at 60fps

                    // Play sound for hit
                    if (typeof SoundManager !== 'undefined') {
                        if (isCritical) {
                            SoundManager.playSound('critical');
                        } else {
                            SoundManager.playSound('hit');
                        }
                    }

                    // Visual feedback for critical hit
                    if (isCritical) {
                        this.triggerScreenShake(15, 20); // Strong shake for critical
                        this.state.criticalHitIndicator.active = true;
                        this.state.criticalHitIndicator.timer = 60; // Show for 1 second at 60fps
                    }

                    if (dino.health <= 0 && !dino.captured) {
                        // Health reached zero - capture the dino (it will stop and show Z's)
                        this.captureDino(dino);
                    }
                    break; // Exit dino loop, continue to next bullet
                }
            }
            if (hitDino) {
                continue; // Skip miss check if hit
            }

            // Remove bullets out of bounds (after checking for hit)
            if (!hitDino) {
                // Check if bullet is out of bounds
                const outOfBounds = bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height;
                
                // Also check if bullet has traveled too far without hitting (missed)
                const bulletTravelDistance = Math.sqrt(
                    Math.pow(bullet.x - (bullet.startX || player.x), 2) + 
                    Math.pow(bullet.y - (bullet.startY || player.y), 2)
                );
                const maxTravelDistance = weapon.range * 3; // Max travel distance before considering it missed
                
                if (outOfBounds || bulletTravelDistance > maxTravelDistance) {
                    // Show miss indication if bullet went out of bounds or too far without hitting
                    if (bullet.missed || outOfBounds) {
                        // Show miss indicator above the first dino (if it exists)
                        const firstDino = this.state.dinos.length > 0 ? this.state.dinos[0] : (this.state.dino || null);
                        if (firstDino) {
                            this.state.missIndicator.active = true;
                            this.state.missIndicator.timer = 60; // Show for 1 second
                            this.state.missIndicator.x = firstDino.x;
                            this.state.missIndicator.y = firstDino.y - firstDino.size - 30; // Position above dino
                        } else {
                            // Fallback to bullet position if no dino
                            this.state.missIndicator.active = true;
                            this.state.missIndicator.timer = 60;
                            this.state.missIndicator.x = Math.max(0, Math.min(canvas.width, bullet.x));
                            this.state.missIndicator.y = Math.max(0, Math.min(canvas.height, bullet.y));
                        }
                    }
                        this.state.bullets.splice(i, 1);
                continue;
                }
            }
            } catch (error) {
                // Enhanced error logging
                if (typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled) {
                    DebugProfiler.logOperation('bullet_error', {
                        error: error.message,
                        stack: error.stack,
                        bullet: bullet,
                        bulletIndex: i,
                        totalBullets: this.state.bullets.length,
                        state: DebugProfiler.getStateSnapshot()
                    });
                }
                console.error('[DEBUG] ERROR in bullet update loop:', error, error.stack, 'Bullet:', bullet);
                // Remove problematic bullet to prevent infinite loop
                this.state.bullets.splice(i, 1);
                continue;
            }
        }
        if (bulletSection) DebugProfiler.endSection(bulletSection);

        // Draw scope zoom overlay is now handled in drawWeaponAiming (removed old drawScopeZoom call)
        
        // Update and draw dino projectiles (after scope zoom so they appear on top)
        // Only update during active hunt, not during capture results
        const projectileSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Dino Projectiles Update') : null;
        if (!this.state.showCaptureResults) {
            this.updateDinoProjectiles(ctx);
        }
        if (projectileSection) DebugProfiler.endSection(projectileSection);
        
        // Draw gas grenades (after dino projectiles)
        const grenadeDrawSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Gas Grenades Drawing') : null;
        this.drawGasGrenades(ctx);
        if (grenadeDrawSection) DebugProfiler.endSection(grenadeDrawSection);

        // Draw debug overlay if dev mode is enabled
        if (this.state.devMode) {
            this.drawDebugOverlay(ctx);
        }

        ctx.restore(); // Restore from screen shake transform
        
        // Draw capture results overlay AFTER screen shake is restored (so buttons aren't affected by shake)
        const captureSection = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? DebugProfiler.startSection('Capture Results Drawing') : null;
        if (this.state.showCaptureResults && this.state.captureResultsData) {
            this.drawCaptureResults(ctx);
        }
        if (captureSection) DebugProfiler.endSection(captureSection);

        // End frame profiling
        if (typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled) {
            DebugProfiler.endFrame();
        }

            this.state.animationFrame = requestAnimationFrame(() => this.animate());
        } catch (error) {
            // Enhanced error logging with full context
            if (typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled) {
                DebugProfiler.logOperation('animate_fatal_error', {
                    error: error.message,
                    stack: error.stack,
                    state: DebugProfiler.getStateSnapshot(),
                    recentOperations: DebugProfiler.recentOperations.slice(-10)
                });
            }
            console.error('[DEBUG] FATAL ERROR in animate():', error, error.stack);
            console.error('State at error:', {
                bullets: this.state.bullets ? this.state.bullets.length : 0,
                dinos: this.state.dinos ? this.state.dinos.length : 0,
                active: this.state.active,
                weapon: typeof cachedState !== 'undefined' && cachedState ? cachedState.currentWeapon : 'unknown'
            });
            // Don't re-throw - try to continue animation
            if (typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled) {
                DebugProfiler.endFrame();
            }
            this.state.animationFrame = requestAnimationFrame(() => this.animate());
        }
    },

    // Update screen shake
    updateScreenShake() {
        const shake = this.state.screenShake;
        if (shake.duration > 0) {
            shake.duration--;
            shake.x = (Math.random() - 0.5) * shake.intensity;
            shake.y = (Math.random() - 0.5) * shake.intensity;
            shake.intensity *= 0.9; // Decay
        } else {
            shake.x = 0;
            shake.y = 0;
            shake.intensity = 0;
        }
    },

    // Trigger screen shake
    triggerScreenShake(intensity, duration) {
        this.state.screenShake.intensity = intensity;
        this.state.screenShake.duration = duration;
    },

    // Update player movement
    updatePlayer() {
        const updatePlayerStartTime = typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled 
            ? performance.now() : null;
        const player = this.state.player;
        const keys = this.state.keys;
        const canvas = this.state.canvas;
        
        // State validation
        if (typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled && GameConfig.DEBUG.STATE_VALIDATION) {
            DebugProfiler.validateState(player, 'player');
        }
        
        let dx = 0;
        let dy = 0;
        
        // Check movement keys (works with caps lock now)
        if (keys.w || keys.ArrowUp) dy -= 1;
        if (keys.s || keys.ArrowDown) dy += 1;
        if (keys.a || keys.ArrowLeft) dx -= 1;
        if (keys.d || keys.ArrowRight) dx += 1;
        
        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            dx *= 0.707; // 1/sqrt(2)
            dy *= 0.707;
        }
        
        // Sprint multiplier (hold Shift to sprint)
        const isSprinting = keys.Shift;
        const speedMultiplier = isSprinting ? 1.8 : 1.0; // Sprint is 80% faster
        player.isSprinting = isSprinting; // Store sprint state for shooting check
        
        // Calculate new position
        const newX = player.x + dx * player.speed * speedMultiplier;
        const newY = player.y + dy * player.speed * speedMultiplier;
        
        // Clamp player to walkable bounds (rectangle)
        const clampedPos = this.clampToWalkableBounds(newX, newY, player.size);
        player.x = clampedPos.x;
        player.y = clampedPos.y;
        
        // Additional check: prevent player from entering water area
        // But allow entry into the extension area (which overlaps with lake)
        if (this.state.environment.isAquaticMode && this.state.environment.lakeBounds) {
            const lake = this.state.environment.lakeBounds;
            const playerLeft = player.x - player.size;
            const playerRight = player.x + player.size;
            const playerTop = player.y - player.size;
            const playerBottom = player.y + player.size;
            
            // Check if player is in the extension area (which is walkable even though it's in lake bounds)
            let inExtension = false;
            if (this.state.environment.walkableExtension) {
                const ext = this.state.environment.walkableExtension;
                inExtension = playerRight > ext.x && playerLeft < ext.x + ext.width &&
                              playerBottom > ext.y && playerTop < ext.y + ext.height;
            }
            
            // Only prevent entry if player would overlap with lake AND is not in extension
            if (!inExtension && playerRight > lake.x && playerLeft < lake.x + lake.width &&
                playerBottom > lake.y && playerTop < lake.y + lake.height) {
                // Push player back to walkable area
                if (player.x >= lake.x) {
                    player.x = lake.x - player.size;
                }
            }
        }
        
        if (updatePlayerStartTime && typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled) {
            DebugProfiler.recordFunctionTiming('updatePlayer', performance.now() - updatePlayerStartTime);
        }
    },

    // Draw player
    drawPlayer(ctx) {
        const player = this.state.player;
        const mouse = this.state.mouse;
        
        // Draw player image if loaded, otherwise fallback to circle
        if (player.image) {
            ctx.save();
            
            // Calculate angle to mouse cursor for rotation
            let rotationAngle = 0;
            if (mouse.inCanvas) {
                const dx = mouse.x - player.x;
                const dy = mouse.y - player.y;
                rotationAngle = Math.atan2(dy, dx);
            }
            
            // Translate to player position, rotate, then draw image
            ctx.translate(player.x, player.y);
            ctx.rotate(rotationAngle);
            
            // Draw image centered on player position (after rotation, so centered on origin)
            const imageSize = player.size * 2; // Make image slightly larger than old circle
            ctx.drawImage(
                player.image,
                -imageSize / 2, // Center horizontally
                -imageSize / 2, // Center vertically
                imageSize,
                imageSize
            );
            ctx.restore();
        } else {
            // Fallback: Draw player circle if image not loaded yet
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw player outline
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Draw direction indicator (small line)
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(player.x, player.y);
            ctx.lineTo(player.x, player.y - player.size - 5);
            ctx.stroke();
        }
    },

    // Draw player health bar
    drawPlayerHealth(ctx) {
        const player = this.state.player;
        const barWidth = 150;
        const barHeight = 20;
        const x = 20;
        const y = 20;
        
        // Damage indicator overlay (red flash)
        if (this.state.playerDamageIndicator.active) {
            const alpha = this.state.playerDamageIndicator.timer / 30;
            ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.3})`;
            ctx.fillRect(0, 0, this.state.canvas.width, this.state.canvas.height);
        }
        
        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);
        
        // Draw health bar background
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Draw health bar fill
        const healthPercent = player.health / player.maxHealth;
        ctx.fillStyle = healthPercent > 0.6 ? '#4CAF50' : healthPercent > 0.3 ? '#FFC107' : '#F44336';
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        
        // Draw health text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`HP: ${Math.max(0, Math.ceil(player.health))}/${player.maxHealth}`, x + barWidth / 2 - 40, y + barHeight / 2);
    },

    // Draw weapon indicator (shows current weapon in fullscreen)
    drawWeaponIndicator(ctx) {
        if (!this.state.active) return;
        
        const state = GameState.get();
        const currentWeaponId = state.currentWeapon || 'pistol';
        const weaponConfig = GameConfig.WEAPONS[currentWeaponId];
        const weapon = state.weapons && state.weapons[currentWeaponId];
        
        if (!weaponConfig || !weapon) return;
        
        const x = this.state.canvas.width - 200;
        const y = 20;
        const width = 180;
        const height = 60;
        
        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - 2, y - 2, width + 4, height + 4);
        
        // Draw weapon icon (image or emoji fallback)
        const iconX = x + 10;
        const iconY = y + 5;
        const iconSize = 24;
        
        if (weaponConfig.image) {
            const weaponImage = ImageLoader.images[weaponConfig.image];
            if (weaponImage && weaponImage.complete && weaponImage.naturalWidth > 0) {
                // Draw weapon image
                ctx.drawImage(weaponImage, iconX, iconY, iconSize, iconSize);
            } else {
                // Fallback to emoji
                ctx.fillStyle = 'white';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(weaponConfig.icon, iconX, iconY);
            }
        } else {
            // No image path, use emoji
            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(weaponConfig.icon, iconX, iconY);
        }
        
        // Draw weapon name
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(weaponConfig.name, x + 50, y + 8);
        
        // Draw ammo count
        const currentAmmo = this.state.weaponAmmo[currentWeaponId] || 0;
        const ammoText = `${currentAmmo}/${weapon.clipSize}`;
        ctx.font = '14px Arial';
        ctx.fillText(`Ammo: ${ammoText}`, x + 10, y + 35);
        
        // Draw reload status if reloading
        if (this.state.isReloading) {
        const now = Date.now();
            const reloadTimeMs = weapon.reloadSpeed * 1000;
            const elapsed = now - this.state.reloadStartTime;
            const progress = Math.min(100, (elapsed / reloadTimeMs) * 100);
            ctx.fillStyle = '#FF9800';
            ctx.font = '12px Arial';
            ctx.fillText(`Reloading ${Math.floor(progress)}%`, x + 10, y + 52);
        }
    },
    
    // Draw reload indicator
    drawReloadIndicator(ctx) {
        if (!this.state.active) return;

        const state = GameState.get();
        const currentWeaponId = state.currentWeapon || 'pistol';
        const weapon = state.weapons && state.weapons[currentWeaponId];
        
        // Use weapon stats if available, otherwise fallback to legacy gun
        const reloadSpeed = weapon ? weapon.reloadSpeed : GameState.get().gun.reloadSpeed;
        const now = Date.now();
        const timeSinceLastShot = now - this.state.lastShot;
        const reloadTimeMs = reloadSpeed * 1000;
        // For weapon system, use isReloading state; for legacy, use time-based check
        const isReloading = weapon ? this.state.isReloading : (timeSinceLastShot < reloadTimeMs);
        
        // Draw critical hit indicator
        if (this.state.criticalHitIndicator.active) {
            const alpha = this.state.criticalHitIndicator.timer / 60;
            const x = this.state.canvas.width / 2;
            const y = this.state.canvas.height / 2;
            
            ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.8})`;
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
            ctx.lineWidth = 3;
            ctx.strokeText('CRITICAL HIT!', x, y);
            ctx.fillText('CRITICAL HIT!', x, y);
        }
        
        if (isReloading) {
            // Calculate reload progress
            let reloadPercent = 0;
            if (weapon && this.state.isReloading) {
                // Weapon system: use reload start time
                const elapsed = now - this.state.reloadStartTime;
                reloadPercent = Math.min(1, elapsed / reloadTimeMs);
            } else {
                // Legacy system: use time since last shot
                reloadPercent = timeSinceLastShot / reloadTimeMs;
            }
            const barWidth = 200;
            const barHeight = 25;
            const x = this.state.canvas.width / 2 - barWidth / 2;
            const y = 20;
            
            // Draw background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);
            
            // Draw reload bar background
            ctx.fillStyle = '#333';
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw reload bar fill
            ctx.fillStyle = '#FFC107';
            ctx.fillRect(x, y, barWidth * reloadPercent, barHeight);
            
            // Draw reload text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const timeLeft = ((reloadTimeMs - timeSinceLastShot) / 1000).toFixed(1);
            ctx.fillText(`Reloading... ${timeLeft}s`, x + barWidth / 2, y + barHeight / 2);
        } else {
            // Show ready indicator
            const x = this.state.canvas.width / 2;
            const y = 20;
            ctx.fillStyle = 'rgba(76, 175, 80, 0.8)';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✓ Ready to Fire', x, y);
        }
    },

    // Draw miss indicator
    drawMissIndicator(ctx) {
        if (!this.state.missIndicator.active || !this.state.active) return;
        
        const indicator = this.state.missIndicator;
        const alpha = indicator.timer / 60; // Fade out over 1 second
        
        // Draw "MISS" text at the miss location
        ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.9})`;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MISS', indicator.x, indicator.y);
        
        // Draw outline for visibility
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
        ctx.lineWidth = 3;
        ctx.strokeText('MISS', indicator.x, indicator.y);
        
        // Draw small X mark
        const xSize = 15;
        ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(indicator.x - xSize, indicator.y - xSize);
        ctx.lineTo(indicator.x + xSize, indicator.y + xSize);
        ctx.moveTo(indicator.x + xSize, indicator.y - xSize);
        ctx.lineTo(indicator.x - xSize, indicator.y + xSize);
        ctx.stroke();
    },

    // Draw weapon-specific aiming mechanics
    drawWeaponAiming(ctx) {
        if (!this.state.active) return;
        
        const state = GameState.get();
        const currentWeaponId = state.currentWeapon || 'pistol';
        const weaponConfig = GameConfig.WEAPONS[currentWeaponId];
        
        if (!weaponConfig) {
            // Fallback to legacy laser dot
            RenderingUtils.drawLaserDot(ctx, this.state.player, this.state.mouse, state.gun);
            return;
        }
        
        // Sniper rifle: scope zoom
        if (weaponConfig.zoom) {
            this.drawSniperScope(ctx);
        }
        // Assault rifle: red dot sight
        else if (weaponConfig.redDot) {
            this.drawRedDotSight(ctx);
        }
        // Pistol, shotgun, rifle: basic iron sights (simple crosshair)
        else {
            this.drawIronSights(ctx);
        }
    },
    
    // Draw basic iron sights (pistol, shotgun, rifle)
    drawIronSights(ctx) {
        if (!this.state.mouse || !this.state.mouse.inCanvas) return;
        
        const mouse = this.state.mouse;
        const crosshairSize = 15;
        const crosshairThickness = 2;
        
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = crosshairThickness;
        
        // Draw simple crosshair
        ctx.beginPath();
        // Horizontal line
        ctx.moveTo(mouse.x - crosshairSize, mouse.y);
        ctx.lineTo(mouse.x + crosshairSize, mouse.y);
        // Vertical line
        ctx.moveTo(mouse.x, mouse.y - crosshairSize);
        ctx.lineTo(mouse.x, mouse.y + crosshairSize);
        ctx.stroke();
        
        ctx.restore();
    },
    
    // Draw red dot sight (assault rifle)
    drawRedDotSight(ctx) {
        if (!this.state.mouse || !this.state.mouse.inCanvas) return;
        
        const mouse = this.state.mouse;
        const dotSize = 4;
        const ringSize = 20;
        
        ctx.save();
        
        // Draw outer ring
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, ringSize, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw red dot
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, dotSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    },
    
    // Draw sniper scope with zoom (sniper rifle)
    drawSniperScope(ctx) {
        if (!this.state.active) return;
        if (!this.state.mouse || !this.state.mouse.inCanvas) return;

        const state = GameState.get();
        const currentWeaponId = state.currentWeapon || 'pistol';
        const weaponConfig = GameConfig.WEAPONS[currentWeaponId];
        const zoomLevel = weaponConfig.zoomLevel || 3.0;
        
        const canvas = this.state.canvas;
        const activeDinos = this.state.dinos.length > 0 ? this.state.dinos : (this.state.dino ? [this.state.dino] : []);
        const dartImage = ImageLoader.getImage('dart');

        // Create render callback for zoomed view
        const renderZoomedView = (zoomCtx) => {
            // Background
            if (this.state.environment.backgroundImage) {
                zoomCtx.drawImage(
                    this.state.environment.backgroundImage,
                    0, 0,
                    canvas.width, canvas.height
                );
            }
            
            // Environment (bushes)
            if (!this.state.environment.isAquaticMode) {
                this.drawEnvironment(zoomCtx);
            }
            
            // Dinosaurs
            for (const d of activeDinos) {
                if (!d) continue;
                RenderingUtils.drawDino(zoomCtx, d, {
                    showHealthBar: !d.captured,
                    showAlertMark: false,
                    showSleepingZees: d.captured
                });
            }
            
            // Bullets
            for (let i = 0; i < this.state.bullets.length; i++) {
                const bullet = this.state.bullets[i];
                if (!bullet) continue;
                RenderingUtils.drawBullet(zoomCtx, bullet, dartImage);
            }
            
            // Gas grenades
            this.drawGasGrenades(zoomCtx);
            
            // Player
            this.drawPlayer(zoomCtx);
        };

        // Debug: Draw a marker at the actual mouse position to compare with scope position
        if (this.state.devMode) {
            ctx.save();
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.state.mouse.x, this.state.mouse.y, 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        
        RenderingUtils.drawScopeZoom(
            ctx,
            this.state.player,
            this.state.mouse,
            state.weapons[currentWeaponId] || state.gun,
            zoomLevel,
            renderZoomedView
        );
    },

    // Calculate toroidal (wraparound) distance between two points
    // Use shared helper functions
    getToroidalDistance(x1, y1, x2, y2, canvasWidth, canvasHeight) {
        return GameHelpers.getToroidalDistance(x1, y1, x2, y2, canvasWidth, canvasHeight);
    },

    getToroidalDirection(x1, y1, x2, y2, canvasWidth, canvasHeight) {
        return GameHelpers.getToroidalDirection(x1, y1, x2, y2, canvasWidth, canvasHeight);
    },

    normalizeAngle(angle) {
        return GameHelpers.normalizeAngle(angle);
    },

    // Check if dino can see player (vision cone) - with bush checking
    checkVisionCone(dino, player, range, angle) {
        const canvas = this.state.canvas;
        
        // If player is in a bush, they can't be seen
        if (this.isPlayerInBush()) {
            return false;
        }
        
        // Use shared helper for basic vision check
        if (!GameHelpers.checkVisionCone(dino, player, range, angle, canvas.width, canvas.height)) {
            return false;
        }
        
        // Check if line of sight is blocked by a bush
        if (this.isLineOfSightBlocked(dino.x, dino.y, player.x, player.y)) {
            return false;
        }
        
        return true;
    },

    // Draw vision cone (for debugging/visual aid)
    drawVisionCone(ctx, dino, range, angle, color) {
        ctx.save();
        ctx.translate(dino.x, dino.y);
        ctx.rotate(dino.direction);
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, range, -angle / 2, angle / 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    },

    // Shoot tranq gun
    // Switch to a different weapon
    switchWeapon(weaponId) {
        if (this.state.isReloading) return; // Can't switch while reloading
        
        const state = GameState.get();
        
        // Check if weapon is unlocked
        if (!state.unlockedWeapons || !state.unlockedWeapons.includes(weaponId)) {
            if (typeof UI !== 'undefined') {
                UI.showNotification(`Weapon not unlocked!`, 2000);
            }
            return;
        }
        
        // Check if weapon exists
        if (!state.weapons[weaponId]) {
            return;
        }
        
        // Switch weapon
        state.currentWeapon = weaponId;
        GameState.save();
        
        // Initialize ammo for new weapon if not already set
        if (!this.state.weaponAmmo[weaponId]) {
            const weapon = state.weapons[weaponId];
            this.state.weaponAmmo[weaponId] = weapon.clipSize;
        }
        
        // Reload player sprite for new weapon
        this.loadPlayerSprite();
        
        // Update UI if available
        if (typeof UI !== 'undefined') {
            UI.updateWeaponStats();
            UI.renderWeaponSelector();
        }
    },
    
    // Load player sprite based on current weapon
    loadPlayerSprite() {
        const state = GameState.get();
        const currentWeaponId = state.currentWeapon || 'pistol';
        
        // Map weapon IDs to sprite names
        const weaponSpriteMap = {
            'pistol': 'player-pistol',
            'shotgun': 'player-shotgun',
            'rifle': 'player-rifle',
            'assaultRifle': 'player-assault',
            'sniperRifle': 'player-sniper',
            'gasGrenade': 'player-grenade'
        };
        
        const spriteName = weaponSpriteMap[currentWeaponId] || 'player';
        const spritePath = `images/player/${spriteName}.png`;
        
        // Try to load weapon-specific sprite, fallback to default
        ImageLoader.loadImage(spritePath).then(img => {
            if (img) {
                // Weapon-specific sprite loaded successfully
                this.state.player.image = img;
            } else {
                // Weapon-specific sprite doesn't exist, fallback to default
                ImageLoader.loadImage('images/player/player.png').then(defaultImg => {
                    if (defaultImg) {
                        this.state.player.image = defaultImg;
                    } else {
                        // If default also fails, image will remain null and fallback circle will be drawn
                        console.warn('Failed to load player sprite, using fallback circle');
                    }
                });
            }
        });
    },
    
    // Start reload process
    startReload() {
        if (this.state.isReloading) return; // Already reloading
        
        const state = GameState.get();
        const currentWeaponId = state.currentWeapon || 'pistol';
        const weapon = state.weapons[currentWeaponId];
        
        if (!weapon) return;
        
        // Check if already at full clip
        const currentAmmo = this.state.weaponAmmo[currentWeaponId] || 0;
        if (currentAmmo >= weapon.clipSize) return;
        
        this.state.isReloading = true;
        this.state.reloadStartTime = Date.now();
    },
    
    // Update reload state (called in animate loop)
    updateReload() {
        if (!this.state.isReloading) return;
        
        const state = GameState.get();
        const currentWeaponId = state.currentWeapon || 'pistol';
        const weapon = state.weapons[currentWeaponId];
        
        if (!weapon) {
            this.state.isReloading = false;
            return;
        }
        
        const now = Date.now();
        const reloadTimeMs = weapon.reloadSpeed * 1000;
        
        if (now - this.state.reloadStartTime >= reloadTimeMs) {
            // Reload complete
            this.state.weaponAmmo[currentWeaponId] = weapon.clipSize;
            this.state.isReloading = false;
        }
    },
    
    shoot(event) {
        if (!this.state.active) return;
        
        // Check if there are any active dinos
        const activeDinos = this.state.dinos.length > 0 ? this.state.dinos : (this.state.dino ? [this.state.dino] : []);
        const hasActiveDinos = activeDinos.some(d => !d.captured && d.health > 0);
        if (!hasActiveDinos) return;
        
        // Can't shoot while sprinting or reloading
        if (this.state.player.isSprinting || this.state.isReloading) return;
        
        const state = GameState.get();
        if (!state || !state.weapons) return;
        
        const currentWeaponId = state.currentWeapon || 'pistol';
        const weapon = state.weapons[currentWeaponId];
        if (!weapon) return;
        
        // Get weapon config
        const weaponConfig = GameConfig.WEAPONS[currentWeaponId];
        if (!weaponConfig) return;
        
        // Merge weapon with config
        const fullWeapon = {
            ...weapon,
            ...weaponConfig
        };
        
        // Initialize ammo if needed
        if (!this.state.weaponAmmo[currentWeaponId]) {
            this.state.weaponAmmo[currentWeaponId] = fullWeapon.clipSize;
        }
        
        // Simple shoot - use shootAdvanced
        const result = ShootingUtils.shootAdvanced(
            event,
            this.state.canvas,
            this.state.player,
            this.state.mouse,
            this.state.bullets,
            fullWeapon,
            this.state.lastShot || 0
        );
        
        if (result && result.lastShot) {
            this.state.lastShot = result.lastShot;
            // Decrement ammo
            if (this.state.weaponAmmo[currentWeaponId] > 0) {
                this.state.weaponAmmo[currentWeaponId]--;
            }
            // Auto-reload when empty
            if (this.state.weaponAmmo[currentWeaponId] <= 0) {
                this.startReload();
            }
        }
    },

    // Capture dinosaur
    captureDino(dino) {
        // Play capture sound
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playSound('capture');
        }
        
        // Mark dino as captured (stop movement, show Z's)
        dino.captured = true;
        dino.capturedTime = Date.now();
        dino.speed = 0; // Stop movement
        dino.alerted = false; // No longer alerted
        
        // Add to captured dinos array
        const dinoSpecies = GameConfig.DINOSAUR_SPECIES[dino.species];
        const rarity = GameConfig.RARITY[dino.rarity] || GameConfig.RARITY.common;
        const appeal = dinoSpecies.baseAppeal + rarity.appealBonus;
        
        const capturedDinoData = {
            species: dino.species,
            rarity: dino.rarity,
            level: 1,
            appeal: appeal
        };

        this.state.capturedDinos.push(capturedDinoData);
        
        // Mark as captured in allSpawnedDinos
        const spawnedDinoInfo = this.state.allSpawnedDinos.find(sd => sd.species === dino.species && !sd.captured);
        if (spawnedDinoInfo) {
            spawnedDinoInfo.captured = true;
        }
        
        // Set as primary captured dino (for UI display)
        this.capturedDino = capturedDinoData;
        
        // Check if all dinos are captured
        const activeDinos = this.state.dinos.length > 0 ? this.state.dinos : (this.state.dino ? [this.state.dino] : []);
        const allCaptured = activeDinos.every(d => d.captured || d.health <= 0);
        
        // Only show popup if all dinos are captured
        if (allCaptured) {
            this.showCaptureResults();
        }
    },
    
    // Send all captured dinos to park
    sendAllCapturedDinosToPark() {
        const state = GameState.get();
        this.state.capturedDinos.forEach(capturedDino => {
            const dinoSpecies = GameConfig.DINOSAUR_SPECIES[capturedDino.species];
            
            // Find compatible exhibit
            let compatibleExhibit = state.exhibits.findIndex(e => {
                const exhibitType = GameConfig.EXHIBIT_TYPES[e.type];
                return exhibitType && exhibitType.allowedCategories.includes(dinoSpecies.category);
            });
            
            if (compatibleExhibit !== -1) {
                ParkManager.addDinoToExhibit(capturedDino, compatibleExhibit);
            }
        });
    },
    
    // Show capture results with all dinos (captured in color, fled greyed out)
    showCaptureResults() {
        // Set primary captured dino for UI
        if (this.state.capturedDinos.length > 0) {
            this.capturedDino = this.state.capturedDinos[0];
        }
        
        // Group dinos by species and rarity, counting duplicates
        const groupedDinos = new Map();
        
        this.state.allSpawnedDinos.forEach((dinoInfo) => {
            const key = `${dinoInfo.species}_${dinoInfo.rarity}_${dinoInfo.captured ? 'captured' : 'fled'}`;
            
            if (!groupedDinos.has(key)) {
                groupedDinos.set(key, {
                    ...dinoInfo,
                    count: 1
                });
            } else {
                groupedDinos.get(key).count++;
            }
        });
        
        // Calculate total sell price from captured dinos only
        let totalSellPrice = 0;
        this.state.capturedDinos.forEach(capturedDino => {
            const dinoSpecies = GameConfig.DINOSAUR_SPECIES[capturedDino.species];
            const rarity = GameConfig.RARITY[capturedDino.rarity] || GameConfig.RARITY.common;
            const value = Math.floor(dinoSpecies.baseValue * rarity.valueMultiplier);
            totalSellPrice += Math.floor(value * GameConfig.HUNTING.SELL_PRICE_MULTIPLIER);
        });
        
        // Store data for canvas rendering
        const groupedDinosArray = Array.from(groupedDinos.values());
        this.state.captureResultsData = {
            groupedDinos: groupedDinosArray,
            totalSellPrice: totalSellPrice,
            buttonRects: {
                sell: null,
                huntAgain: null,
                return: null
            } // Will be populated in drawCaptureResults
        };
        
        // Check if fullscreen - if so, use canvas rendering, otherwise use HTML popup
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || 
                               document.mozFullScreenElement || document.msFullscreenElement);
        
        if (isFullscreen) {
            // Use canvas-based display for fullscreen
            this.state.showCaptureResults = true;
            // Don't stop the hunt - keep rendering so we can show results
        } else {
            // Use HTML popup for non-fullscreen
            this.showCaptureResultsHTML(groupedDinosArray, totalSellPrice);
            this.stop();
        }
    },
    
    // Show capture results as HTML popup (for non-fullscreen mode)
    showCaptureResultsHTML(groupedDinosArray, totalSellPrice) {
        // Build results display showing grouped dinos in landscape layout
        let resultsHTML = '<div class="capture-results-list landscape">';
        
        groupedDinosArray.forEach((dinoInfo) => {
            const isCaptured = dinoInfo.captured;
            const opacity = isCaptured ? '1' : '0.4';
            const filter = isCaptured ? '' : 'filter: grayscale(100%);';
            const countDisplay = dinoInfo.count > 1 ? `<span class="dino-count-badge">x${dinoInfo.count}</span>` : '';
            
            const displayContent = `<img src="${dinoInfo.image}" alt="${dinoInfo.name}" class="dino-image-captured" style="border: 3px solid ${dinoInfo.rarityColor}; box-shadow: 0 0 20px ${dinoInfo.rarityColor}; opacity: ${opacity}; ${filter}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                <span class="dino-emoji-large" style="display:none; opacity: ${opacity}; ${filter}">${dinoInfo.emoji}</span>`;
            
            const rarityBadge = dinoInfo.rarity !== 'common' 
                ? `<span class="rarity-badge-large" style="background: ${dinoInfo.rarityColor}; color: white; padding: 5px 15px; border-radius: 15px; font-weight: bold; display: inline-block; margin: 10px 0; opacity: ${opacity};">${dinoInfo.rarityName}</span>`
                : '';
            
            const statusText = isCaptured 
                ? `<span style="color: #4CAF50; font-weight: bold;">✓ Captured</span>` 
                : `<span style="color: #999; font-weight: bold;">✗ Fled</span>`;
            
            const totalValue = dinoInfo.value * dinoInfo.count;
            
            resultsHTML += `
                <div class="captured-dino-item landscape-item" style="opacity: ${opacity}; padding: 15px; background: rgba(255, 255, 255, 0.1); border-radius: 10px; border: 2px solid ${isCaptured ? dinoInfo.rarityColor : '#666'};">
            <div class="captured-dino-display">
                ${displayContent}
                        ${countDisplay}
            </div>
                    <p><strong>${dinoInfo.name}</strong> ${statusText}</p>
            ${rarityBadge}
                    <p>Appeal: ${dinoInfo.appeal}</p>
                    <p>Value: ${formatMoney(totalValue)}</p>
                </div>
            `;
        });
        
        resultsHTML += '</div>';
        
        document.getElementById('captured-dino-info').innerHTML = resultsHTML;
        document.getElementById('sell-price').textContent = formatMoney(totalSellPrice);
        
        const overlay = document.getElementById('capture-result-overlay');
        const popup = document.getElementById('capture-result');
        
        if (overlay) overlay.classList.add('show');
        if (popup) popup.classList.add('show');
        
        // Reset button states
        const sellBtn = document.getElementById('sell-dino-btn');
        const returnToParkBtn = document.getElementById('return-to-park-btn');
        
        if (sellBtn) {
            sellBtn.disabled = false;
            sellBtn.style.opacity = '1';
            sellBtn.style.cursor = 'pointer';
        }
        
        if (returnToParkBtn) {
            returnToParkBtn.style.display = 'inline-block';
            returnToParkBtn.disabled = false;
            returnToParkBtn.style.opacity = '1';
            returnToParkBtn.style.cursor = 'pointer';
        }
    },

    // Send captured dino to zoo
    sendToZoo() {
        if (!this.capturedDino) return;

        const state = GameState.get();
        const dinoSpecies = GameConfig.DINOSAUR_SPECIES[this.capturedDino.species];
        
        // Find compatible exhibit for this dinosaur's category
        let compatibleExhibit = state.exhibits.findIndex(e => {
            const exhibitType = GameConfig.EXHIBIT_TYPES[e.type];
            return exhibitType && exhibitType.allowedCategories.includes(dinoSpecies.category);
        });
        
        // If no compatible exhibit found, show modal
        if (compatibleExhibit === -1) {
            this.showExhibitModal();
        } else {
            ParkManager.addDinoToExhibit(this.capturedDino, compatibleExhibit);
            this.capturedDino = null;
            
            // Disable "Sell" button
            const sellBtn = document.getElementById('sell-dino-btn');
            
            if (sellBtn) {
                sellBtn.disabled = true;
                sellBtn.style.opacity = '0.5';
                sellBtn.style.cursor = 'not-allowed';
            }
            
            // Return to Park button is always visible now
            // Keep popup open - don't close it
            // Don't automatically switch to park view - let user stay in hunting tab
        }
    },

    // Show exhibit selection modal (only compatible exhibits)
    showExhibitModal() {
        if (!this.capturedDino) return;
        
        const state = GameState.get();
        const dinoSpecies = GameConfig.DINOSAUR_SPECIES[this.capturedDino.species];
        
        // Filter to compatible exhibits only
        const compatibleExhibits = state.exhibits
            .map((exhibit, idx) => ({ exhibit, idx }))
            .filter(({ exhibit }) => {
                const exhibitType = GameConfig.EXHIBIT_TYPES[exhibit.type];
                return exhibitType && exhibitType.allowedCategories.includes(dinoSpecies.category);
            });
        
        if (compatibleExhibits.length === 0) {
            UI.showNotification(`No ${dinoSpecies.category} exhibit available! Build one first.`, 4000);
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.id = 'exhibit-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Choose a Compatible Exhibit</h2>
                <p style="color: #666; margin-bottom: 15px;">${dinoSpecies.name} must go in a ${dinoSpecies.category === 'meat' ? 'Carnivore' : 'Herbivore'} exhibit</p>
                <div class="dino-list">
                    ${compatibleExhibits.map(({ exhibit, idx }) => {
                        const exhibitType = GameConfig.EXHIBIT_TYPES[exhibit.type];
                        return `
                        <div class="dino-list-item">
                            <div>
                                <strong>${exhibitType.icon} ${exhibitType.name}</strong> (Level ${exhibit.level})
                                <br><small>${exhibit.dinos.length} dinosaur(s)</small>
                            </div>
                            <button class="btn" onclick="HuntingGame.addToExhibit(${idx}); HuntingGame.closeModal();">
                                Select
                            </button>
                        </div>
                    `;
                    }).join('')}
                </div>
                <button class="btn" onclick="HuntingGame.closeModal()" style="margin-top: 15px;">Cancel</button>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // Add to specific exhibit
    addToExhibit(exhibitIdx) {
        if (this.capturedDino) {
            ParkManager.addDinoToExhibit(this.capturedDino, exhibitIdx);
            this.capturedDino = null;
            
            // Close the modal
            this.closeModal();
            
            // Disable "Sell" button
            const sellBtn = document.getElementById('sell-dino-btn');
            
            if (sellBtn) {
                sellBtn.disabled = true;
                sellBtn.style.opacity = '0.5';
                sellBtn.style.cursor = 'not-allowed';
            }
            
            // Return to Park button is always visible now
            // Keep popup open - don't close it
            // Don't automatically switch to park view - let user stay in hunting tab
        }
    },

    // Close modal
    closeModal() {
        const modal = document.getElementById('exhibit-modal');
        if (modal) modal.remove();
    },

    // Sell captured dino
    sellDino() {
        if (!this.capturedDino) return;
        
        const state = GameState.get();
        const dinoSpecies = GameConfig.DINOSAUR_SPECIES[this.capturedDino.species];
        const rarity = GameConfig.RARITY[this.capturedDino.rarity] || GameConfig.RARITY.common;
        const value = Math.floor(dinoSpecies.baseValue * rarity.valueMultiplier);
        const price = Math.floor(value * GameConfig.HUNTING.SELL_PRICE_MULTIPLIER);
        
        state.money += price;
        this.capturedDino = null;
        
        // Disable "Sell" button
        const sellBtn = document.getElementById('sell-dino-btn');
        
        if (sellBtn) {
            sellBtn.disabled = true;
            sellBtn.style.opacity = '0.5';
            sellBtn.style.cursor = 'not-allowed';
            sellBtn.innerHTML = '✓ Sold';
        }
        
        // Return to Park button is always visible now
        
        // Keep popup open - don't close it
        UI.updateStats();
        UI.showNotification(`Sold for $${formatMoney(price)}!`);
    },
    
    // Sell all captured dinos
    sellAllCapturedDinos() {
        if (this.state.capturedDinos.length === 0) return;
        
        const state = GameState.get();
        let totalPrice = 0;
        
        this.state.capturedDinos.forEach(capturedDino => {
            const dinoSpecies = GameConfig.DINOSAUR_SPECIES[capturedDino.species];
            const rarity = GameConfig.RARITY[capturedDino.rarity] || GameConfig.RARITY.common;
            const value = Math.floor(dinoSpecies.baseValue * rarity.valueMultiplier);
            const price = Math.floor(value * GameConfig.HUNTING.SELL_PRICE_MULTIPLIER);
            totalPrice += price;
        });
        
        state.money += totalPrice;
        this.state.capturedDinos = [];
        this.capturedDino = null;
        
        UI.updateStats();
        UI.showNotification(`Sold all dinosaurs for $${formatMoney(totalPrice)}!`);
        
        // Close capture results
        this.closeCaptureResults();
    },

    // Draw lake (water area for aquatic mode)
    drawLake(ctx, lakeBounds) {
        // Draw water with a blue gradient
        const gradient = ctx.createLinearGradient(lakeBounds.x, lakeBounds.y, lakeBounds.x, lakeBounds.y + lakeBounds.height);
        gradient.addColorStop(0, '#4A90E2'); // Light blue at top
        gradient.addColorStop(1, '#2E5C8A'); // Darker blue at bottom
        
        ctx.fillStyle = gradient;
        ctx.fillRect(lakeBounds.x, lakeBounds.y, lakeBounds.width, lakeBounds.height);
        
        // Add some wave effects (simple lines)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const y = lakeBounds.y + (lakeBounds.height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(lakeBounds.x, y);
            for (let x = lakeBounds.x; x < lakeBounds.x + lakeBounds.width; x += 20) {
                const waveOffset = Math.sin((x + Date.now() * 0.001) * 0.1) * 3;
                ctx.lineTo(x, y + waveOffset);
            }
            ctx.stroke();
        }
    },

    // Create and draw sandy texture background
    drawSandyBackground(ctx, canvas) {
        // Create or reuse cached pattern
        if (!this.state.environment.sandyPattern) {
            // Create a small pattern canvas for texture
            const patternCanvas = document.createElement('canvas');
            patternCanvas.width = 200;
            patternCanvas.height = 200;
            const patternCtx = patternCanvas.getContext('2d');
            
            // Base sandy color
            patternCtx.fillStyle = '#E6D5B8'; // Light sandy beige
            patternCtx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
            
            // Add texture with random noise
            const imageData = patternCtx.getImageData(0, 0, patternCanvas.width, patternCanvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                // Add subtle random variation to create texture
                const noise = (Math.random() - 0.5) * 15; // Small variation
                data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
            }
            
            patternCtx.putImageData(imageData, 0, 0);
            
            // Create pattern from canvas
            this.state.environment.sandyPattern = ctx.createPattern(patternCanvas, 'repeat');
        }
        
        // Fill with sandy pattern
        ctx.fillStyle = this.state.environment.sandyPattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    },

    // Place environment objects (bushes only, max 3, only in light brown zone)
    placeEnvironment() {
        const canvas = this.state.canvas;
        const config = GameConfig.HUNTING.ENVIRONMENT;
        const bounds = this.state.environment.walkableBounds;
        const playerStartX = GameConfig.HUNTING.PLAYER_START_X;
        const playerStartY = GameConfig.HUNTING.PLAYER_START_Y;
        // Use center of walkable bounds for dino spawn location
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        
        // Clear existing environment
        this.state.environment.bushes = [];
        
        // Get available bush assets (only from images/environment folder)
        const availableBushes = this.getAvailableAssets('bush');
        
        // Helper function to check if position is valid (only in light brown zone)
        const isValidPosition = (x, y, existingBushes) => {
            // Check if position is walkable (on light brown path)
            if (!this.isPositionWalkable(x, y)) return false;
            
            // Check distance from player spawn
            const distFromPlayer = Math.sqrt(
                Math.pow(x - playerStartX, 2) + Math.pow(y - playerStartY, 2)
            );
            if (distFromPlayer < config.MIN_DISTANCE_FROM_PLAYER) return false;
            
            // Check distance from center (dino spawn)
            const distFromCenter = Math.sqrt(
                Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
            );
            if (distFromCenter < config.MIN_DISTANCE_FROM_CENTER) return false;
            
            // Check distance from other bushes
            for (const bush of existingBushes) {
                const dist = Math.sqrt(
                    Math.pow(x - bush.x, 2) + Math.pow(y - bush.y, 2)
                );
                if (dist < config.MIN_DISTANCE_BETWEEN) return false;
            }
            
            return true;
        };
        
        // Place bushes (max 3, only in light brown zone/rectangle)
        const maxBushes = 3;
        let bushAttempts = 0;
        const maxBushAttempts = maxBushes * 20; // Try up to 20x the desired count to find valid positions
        
        while (this.state.environment.bushes.length < maxBushes && bushAttempts < maxBushAttempts) {
            // Generate random position within walkable bounds rectangle
            const x = bounds.x + Math.random() * bounds.width;
            const y = bounds.y + Math.random() * bounds.height;
            
            if (isValidPosition(x, y, this.state.environment.bushes)) {
                // Randomly select a bush asset
                const assetName = availableBushes.length > 0 
                    ? availableBushes[Math.floor(Math.random() * availableBushes.length)]
                    : null;
                
                this.state.environment.bushes.push({
                    x: x,
                    y: y,
                    size: 60, // Default size if image not loaded
                    assetName: assetName,
                    image: null,
                    // Detection and cooldown tracking
                    detectionTime: 0, // Time player has been in this bush (0-5 seconds)
                    cooldownTime: 0, // Cooldown timer (proportional to detection time)
                    initialDetectionTime: 0, // Initial detection when cooldown started (for proportional decrease)
                    isDetected: false, // Whether this bush is currently detected
                    isOnCooldown: false // Whether this bush is on cooldown
                });
                
                // Load the image if asset exists
                if (assetName) {
                    ImageLoader.loadImage(`images/environment/${assetName}`).then(img => {
                        const bush = this.state.environment.bushes.find(b => b.assetName === assetName && !b.image);
                        if (bush) {
                            bush.image = img;
                            bush.size = Math.max(img.width, img.height) || 60;
                        }
                    }).catch(() => {
                        // Asset doesn't exist, that's okay - will use fallback
                    });
                }
            }
            bushAttempts++;
        }
    },

    // Get available assets for bushes (from images/environment folder)
    getAvailableAssets(type) {
        // Only return bush assets - files are named Bush_01.png, Bush_02.png, etc. (capital B)
        const assets = [];
        if (type === 'bush') {
            // Only check for Bush_01.png through Bush_05.png (matching actual files in folder)
            for (let i = 1; i <= 5; i++) {
                const num = i.toString().padStart(2, '0');
                assets.push(`Bush_${num}.png`);
            }
        }
        return assets;
    },

    // Draw environment objects (bushes and trees)
    // Draw environment objects (bushes only)
    drawEnvironment(ctx) {
        const DETECTION_TIME = 5 * 60; // 5 seconds at 60fps
        
        // Draw bushes
        for (const bush of this.state.environment.bushes) {
            ctx.save();
            if (bush.image && bush.image.complete && bush.image.naturalWidth > 0) {
                // Draw bush image
                const size = bush.size || 60;
                ctx.drawImage(
                    bush.image,
                    bush.x - size / 2,
                    bush.y - size / 2,
                    size,
                    size
                );
            } else {
                // Fallback: draw simple green circle
                ctx.fillStyle = '#2d5016';
                ctx.beginPath();
                ctx.arc(bush.x, bush.y, bush.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            
            // Draw detection/cooldown bar above bush
            const player = this.state.player;
            const config = GameConfig.HUNTING.ENVIRONMENT;
            const dist = this.getToroidalDistance(
                player.x, player.y,
                bush.x, bush.y,
                this.state.canvas.width, this.state.canvas.height
            );
            const playerInBush = dist < config.BUSH_SAFE_RADIUS;
            
            if (playerInBush || bush.isDetected || bush.isOnCooldown) {
                const barWidth = 80;
                const barHeight = 8;
                const barX = bush.x - barWidth / 2;
                const barY = bush.y - (bush.size || 60) / 2 - 20;
                
                // Draw background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
                
                if (bush.isOnCooldown) {
                    // Cooldown state - show detection decreasing (orange)
                    const detectionPercent = bush.detectionTime / DETECTION_TIME;
                    ctx.fillStyle = '#666';
                    ctx.fillRect(barX, barY, barWidth, barHeight);
                    ctx.fillStyle = '#FFA500';
                    ctx.fillRect(barX, barY, barWidth * detectionPercent, barHeight);
                } else if (bush.isDetected) {
                    // Detected state - red bar
                    ctx.fillStyle = '#F44336';
                    ctx.fillRect(barX, barY, barWidth, barHeight);
                } else if (playerInBush) {
                    // Detection buildup - smooth yellow to red gradient (0% yellow, 100% red)
                    const detectionPercent = bush.detectionTime / DETECTION_TIME;
                    // Interpolate from yellow (255,255,0) to red (255,0,0)
                    const red = 255;
                    const green = Math.floor(255 * (1 - detectionPercent));
                    const blue = 0;
                    ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, 0.8)`;
                    ctx.fillRect(barX, barY, barWidth * detectionPercent, barHeight);
                    ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
                    ctx.fillRect(barX + barWidth * detectionPercent, barY, barWidth * (1 - detectionPercent), barHeight);
                }
            }
        }
    },

    // Get the bush the player is currently in (if any)
    getPlayerBush() {
        const player = this.state.player;
        const config = GameConfig.HUNTING.ENVIRONMENT;
        const canvas = this.state.canvas;
        
        for (const bush of this.state.environment.bushes) {
            const dist = this.getToroidalDistance(
                player.x, player.y,
                bush.x, bush.y,
                canvas.width, canvas.height
            );
            
            if (dist < config.BUSH_SAFE_RADIUS) {
                return bush;
            }
        }
        return null;
    },

    // Check if player is in a bush (safe zone) - for backwards compatibility
    isPlayerInBush() {
        return this.getPlayerBush() !== null;
    },

    // Check if a bush is usable (not detected and not on cooldown)
    isBushUsable(bush) {
        return !bush.isDetected && !bush.isOnCooldown;
    },

    // Update bush detection and cooldown states
    updateBushStates() {
        const player = this.state.player;
        const config = GameConfig.HUNTING.ENVIRONMENT;
        const canvas = this.state.canvas;
        const DETECTION_TIME = 5 * 60; // 5 seconds at 60fps
        const MAX_COOLDOWN_TIME = 15 * 60; // 15 seconds at 60fps (for full 5 second detection)
        
        // Remove bushes that reached full detection (from previous frame)
        this.state.environment.bushes = this.state.environment.bushes.filter(bush => !bush.shouldRemove);
        
        for (const bush of this.state.environment.bushes) {
            const dist = this.getToroidalDistance(
                player.x, player.y,
                bush.x, bush.y,
                canvas.width, canvas.height
            );
            
            const playerInBush = dist < config.BUSH_SAFE_RADIUS;
            
            if (playerInBush) {
                // Player is in bush - always increase detection time
                if (bush.isOnCooldown) {
                    // Player re-entered during cooldown - stop cooldown and resume heating
                    bush.isOnCooldown = false;
                    bush.cooldownTime = 0;
                    bush.initialDetectionTime = 0;
                }
                
                bush.detectionTime++;
                
                if (bush.detectionTime >= DETECTION_TIME) {
                    // Bush is fully detected - remove it permanently
                    // Mark for removal (we'll remove it after the loop)
                    bush.shouldRemove = true;
                }
            } else if (!playerInBush && bush.detectionTime > 0 && !bush.isOnCooldown) {
                // Player left bush before full detection - start proportional cooldown
                // Cooldown time = (detectionTime / 5) * 15 = detectionTime * 3
                bush.isOnCooldown = true;
                bush.cooldownTime = Math.floor(bush.detectionTime * 3);
                bush.isDetected = bush.detectionTime >= DETECTION_TIME;
                bush.initialDetectionTime = bush.detectionTime; // Store initial for proportional decrease
            }
            
            // Handle cooldown - decrease detection time proportionally (only if player not in bush)
            if (bush.isOnCooldown && !playerInBush) {
                if (bush.cooldownTime > 0 && bush.initialDetectionTime > 0) {
                    // Decrease detection time proportionally during cooldown
                    // Each frame, decrease by initialDetectionTime / totalCooldownTime
                    const totalCooldownTime = bush.initialDetectionTime * 3;
                    const decreasePerFrame = bush.initialDetectionTime / totalCooldownTime;
                    bush.detectionTime = Math.max(0, bush.detectionTime - decreasePerFrame);
                }
                
                bush.cooldownTime--;
                
                if (bush.cooldownTime <= 0) {
                    // Cooldown finished - reset bush
                    bush.isDetected = false;
                    bush.isOnCooldown = false;
                    bush.cooldownTime = 0;
                    bush.detectionTime = 0;
                    bush.initialDetectionTime = 0;
                }
            }
        }
    },

    // Check if a line of sight is blocked by a bush
    isLineOfSightBlocked(x1, y1, x2, y2) {
        const canvas = this.state.canvas;
        const config = GameConfig.HUNTING.ENVIRONMENT;
        
        // Check if any usable bush blocks the line between two points
        for (const bush of this.state.environment.bushes) {
            // Only usable bushes block line of sight
            if (!this.isBushUsable(bush)) {
                continue;
            }
            
            // Calculate distance from bush center to the line segment
            const distToLine = this.distanceToLineSegment(
                bush.x, bush.y,
                x1, y1, x2, y2,
                canvas.width, canvas.height
            );
            
            // If bush is close enough to the line, it blocks vision
            if (distToLine < config.BUSH_SAFE_RADIUS) {
                return true;
            }
        }
        return false;
    },

    // Calculate distance from a point to a line segment (toroidal)
    distanceToLineSegment(px, py, x1, y1, x2, y2, canvasWidth, canvasHeight) {
        // For toroidal space, we need to check the shortest path
        // Simplified: check distance to closest point on line
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSq = dx * dx + dy * dy;
        
        if (lengthSq === 0) {
            // Line segment is a point
            return this.getToroidalDistance(px, py, x1, y1, canvasWidth, canvasHeight);
        }
        
        // Project point onto line
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        
        return this.getToroidalDistance(px, py, projX, projY, canvasWidth, canvasHeight);
    },

    // Draw debug overlay (grid, bounds, hit boxes)
    drawDebugOverlay(ctx) {
        // Enhanced debug overlay with performance metrics
        if (typeof DebugProfiler !== 'undefined' && DebugProfiler.enabled) {
            const summary = DebugProfiler.getPerformanceSummary();
            if (summary) {
                ctx.save();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(10, 10, 300, 200);
                
                ctx.fillStyle = '#00FF00';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                
                let y = 30;
                ctx.fillText(`FPS: ${summary.fps}`, 20, y);
                y += 20;
                ctx.fillText(`Avg Frame: ${summary.avgFrameTime}`, 20, y);
                y += 20;
                ctx.fillText(`Min Frame: ${summary.minFrameTime}`, 20, y);
                y += 20;
                ctx.fillText(`Max Frame: ${summary.maxFrameTime}`, 20, y);
                y += 20;
                ctx.fillText(`Slow Frames: ${summary.slowFrames}`, 20, y);
                y += 20;
                ctx.fillText(`Bullets: ${this.state.bullets.length}`, 20, y);
                y += 20;
                ctx.fillText(`Dinos: ${this.state.dinos.length}`, 20, y);
                y += 20;
                ctx.fillText(`Active: ${this.state.active ? 'Yes' : 'No'}`, 20, y);
                
                ctx.restore();
            }
        }
        
        // Original debug overlay
        const canvas = this.state.canvas;
        const bounds = this.state.environment.walkableBounds;
        const player = this.state.player;
        const dino = this.state.dino;

        // Draw grid with x, y coordinates
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

        const gridSize = 50; // Grid cell size in pixels

        // Draw vertical grid lines
        for (let x = 0; x <= canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();

            // Draw x coordinate labels at top
            if (x % 100 === 0) {
                ctx.fillText(`${x}`, x + 15, 12);
            }
        }

        // Draw horizontal grid lines
        for (let y = 0; y <= canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();

            // Draw y coordinate labels on left (shifted right for readability)
            if (y % 100 === 0) {
                ctx.fillText(`${y}`, 25, y + 12);
            }
        }

        // Draw walkable rectangle bounds
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.setLineDash([]);

        // Label the rectangle bounds
        ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`Bounds: (${bounds.x}, ${bounds.y})`, bounds.x + 5, bounds.y + 18);
        ctx.fillText(`Size: ${bounds.width} × ${bounds.height}`, bounds.x + 5, bounds.y + 35);
        
        // Draw extension area if it exists (for aquatic mode)
        if (this.state.environment.walkableExtension) {
            const ext = this.state.environment.walkableExtension;
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(ext.x, ext.y, ext.width, ext.height);
            ctx.setLineDash([]);
            
            // Label the extension
            ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`Extension: (${ext.x}, ${ext.y})`, ext.x + 5, ext.y + 18);
            ctx.fillText(`Size: ${ext.width} × ${ext.height}`, ext.x + 5, ext.y + 35);
        }

        // Draw player hit box
        ctx.strokeStyle = 'rgba(0, 0, 255, 0.6)';
        ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw player position coordinates
        ctx.fillStyle = 'rgba(0, 0, 255, 0.9)';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`Player: (${Math.round(player.x)}, ${Math.round(player.y)})`, player.x + player.size + 5, player.y - 5);

        // Draw dino hit box if exists
        if (dino) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(dino.x, dino.y, dino.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Draw dino position coordinates
            ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
            ctx.font = 'bold 11px monospace';
            ctx.fillText(`Dino: (${Math.round(dino.x)}, ${Math.round(dino.y)})`, dino.x + dino.size / 2 + 5, dino.y - 5);
            ctx.fillText(`Size: ${dino.size}`, dino.x + dino.size / 2 + 5, dino.y + 10);
        }

        // Draw bush hit boxes
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.6)';
        ctx.lineWidth = 2;
        const config = GameConfig.HUNTING.ENVIRONMENT;
        for (const bush of this.state.environment.bushes) {
            // Draw bush circle
            ctx.fillStyle = 'rgba(139, 69, 19, 0.2)';
            ctx.beginPath();
            ctx.arc(bush.x, bush.y, config.BUSH_SAFE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Draw bush position label
            ctx.fillStyle = 'rgba(139, 69, 19, 0.9)';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(`Bush: (${Math.round(bush.x)}, ${Math.round(bush.y)})`, bush.x + config.BUSH_SAFE_RADIUS + 5, bush.y);
        }

        ctx.restore(); // Restore debug drawing context
    },

    // Set developer mode
    setDevMode(enabled) {
        this.state.devMode = enabled;
    },
    
    // Draw hunt timer at top of canvas (centered)
    drawHuntTimer(ctx) {
        const timer = this.state.huntTimer;
        if (!timer.startTime) return;
        
        const seconds = Math.ceil(timer.timeRemaining / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeString = `${minutes}:${secs.toString().padStart(2, '0')}`;
        
        const canvas = this.state.canvas;
        const barWidth = 150;
        const barHeight = 40;
        const x = (canvas.width - barWidth) / 2; // Center horizontally
        const y = 10;
        
        // Draw timer background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Draw timer text
        ctx.fillStyle = timer.timeRemaining < 10000 ? '#FF0000' : '#FFFFFF'; // Red if less than 10 seconds
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`Time: ${timeString}`, x + barWidth / 2, y + 8);
    },
    
    // Draw sleeping Z's above captured dinosaur
    drawSleepingZees(ctx, dino) {
        RenderingUtils.drawSleepingZees(ctx, dino);
    },
    
    // Handle timer expiration
    handleTimerExpiration() {
        // Mark uncaptured dinos as fled in allSpawnedDinos
        const activeDinos = this.state.dinos.length > 0 ? this.state.dinos : (this.state.dino ? [this.state.dino] : []);
        const uncapturedDinos = activeDinos.filter(d => !d.captured);
        
        // Mark as fled in allSpawnedDinos
        uncapturedDinos.forEach(dino => {
            const spawnedDinoInfo = this.state.allSpawnedDinos.find(sd => sd.species === dino.species && !sd.captured);
            if (spawnedDinoInfo) {
                spawnedDinoInfo.captured = false; // Already false, but ensure it's marked
            }
        });
        
        // Remove uncaptured dinos from active array
        uncapturedDinos.forEach(dino => {
            const index = this.state.dinos.indexOf(dino);
            if (index !== -1) {
                this.state.dinos.splice(index, 1);
            }
            if (this.state.dino === dino) {
                this.state.dino = null;
            }
        });
        
        // Show results (will show all dinos, captured in color, fled greyed out)
        if (this.state.allSpawnedDinos.length > 0) {
            this.showCaptureResults();
            const capturedCount = this.state.capturedDinos.length;
            const totalCount = this.state.allSpawnedDinos.length;
            if (capturedCount > 0) {
                UI.showNotification(`Time's up! Captured ${capturedCount} of ${totalCount} dinosaur(s).`, 3000);
            } else {
                UI.showNotification('Time\'s up! No dinosaurs captured.', 3000);
            }
        } else {
            UI.showNotification('Time\'s up! No dinosaurs captured.', 3000);
            this.stop();
        }
    },
    
    // Helper to draw rounded rectangle
    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    },
    
    // Draw capture results on canvas (for fullscreen mode)
    drawCaptureResults(ctx) {
        const canvas = this.state.canvas;
        const data = this.state.captureResultsData;
        if (!data) return;
        
        // Initialize button rects if not already set
        if (!data.buttonRects) {
            data.buttonRects = {
                sell: null,
                huntAgain: null,
                return: null
            };
        }
        
        // Draw semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate panel dimensions
        const panelWidth = Math.min(1000, canvas.width - 80);
        const panelHeight = Math.min(700, canvas.height - 80);
        const panelX = (canvas.width - panelWidth) / 2;
        const panelY = (canvas.height - panelHeight) / 2;
        
        // Draw panel background
        ctx.fillStyle = 'rgba(30, 30, 40, 0.95)';
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 3;
        this.drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 15);
        ctx.fill();
        ctx.stroke();
        
        // Draw title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Hunt Results', canvas.width / 2, panelY + 20);
        
        // Draw dinosaur list (scrollable if needed)
        const listStartY = panelY + 70;
        const listHeight = panelHeight - 200;
        const itemHeight = 100;
        const itemSpacing = 10;
        const itemsPerRow = 2;
        const itemWidth = (panelWidth - 60) / itemsPerRow - itemSpacing;
        
        let itemIndex = 0;
        data.groupedDinos.forEach((dinoInfo) => {
            const row = Math.floor(itemIndex / itemsPerRow);
            const col = itemIndex % itemsPerRow;
            const itemX = panelX + 30 + col * (itemWidth + itemSpacing);
            const itemY = listStartY + row * (itemHeight + itemSpacing);
            
            if (itemY + itemHeight > listStartY + listHeight) return; // Skip if outside visible area
            
            const isCaptured = dinoInfo.captured;
            const opacity = isCaptured ? 1 : 0.4;
            
            // Draw item background
            ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * opacity})`;
            ctx.strokeStyle = isCaptured ? dinoInfo.rarityColor : '#666';
            ctx.lineWidth = 2;
            this.drawRoundedRect(ctx, itemX, itemY, itemWidth, itemHeight, 8);
            ctx.fill();
            ctx.stroke();
            
            // Draw dino image (load and draw actual image)
            const dinoImage = ImageLoader.getImage(dinoInfo.species);
            ctx.save();
            ctx.globalAlpha = opacity;
            if (dinoImage && dinoImage.complete && dinoImage.naturalWidth > 0) {
                // Draw actual image
                const imgSize = 60;
                ctx.drawImage(
                    dinoImage,
                    itemX + 10,
                    itemY + (itemHeight - imgSize) / 2,
                    imgSize,
                    imgSize
                );
            } else {
                // Fallback to emoji if image not loaded
                ctx.font = '48px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(dinoInfo.emoji, itemX + 10, itemY + itemHeight / 2);
            }
            ctx.restore();
            
            // Draw count badge if multiple
            if (dinoInfo.count > 1) {
                ctx.fillStyle = '#FF6B6B';
                ctx.beginPath();
                ctx.arc(itemX + 70, itemY + 20, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`x${dinoInfo.count}`, itemX + 70, itemY + 20);
            }
            
            // Draw dino name and status
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(dinoInfo.name, itemX + 90, itemY + 10);
            
            ctx.font = '14px Arial';
            ctx.fillStyle = isCaptured ? `rgba(76, 175, 80, ${opacity})` : `rgba(153, 153, 153, ${opacity})`;
            ctx.fillText(isCaptured ? '✓ Captured' : '✗ Fled', itemX + 90, itemY + 30);
            
            // Draw rarity badge
            if (dinoInfo.rarity !== 'common') {
                ctx.fillStyle = dinoInfo.rarityColor;
                this.drawRoundedRect(ctx, itemX + 90, itemY + 50, 80, 20, 10);
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(dinoInfo.rarityName, itemX + 130, itemY + 60);
            }
            
            // Draw value
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const totalValue = dinoInfo.value * dinoInfo.count;
            ctx.fillText(`Value: ${formatMoney(totalValue)}`, itemX + 90, itemY + 75);
            
            itemIndex++;
        });
        
        // Draw total sell price
        const totalY = panelY + panelHeight - 120;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Total Sell Price: ${formatMoney(data.totalSellPrice)}`, canvas.width / 2, totalY);
        
        // Draw buttons (3 buttons: Sell All, Hunt Again, Return to Base)
        const buttonY = panelY + panelHeight - 60;
        const buttonWidth = 180;
        const buttonHeight = 40;
        const buttonSpacing = 15;
        const totalButtonWidth = buttonWidth * 3 + buttonSpacing * 2;
        const buttonStartX = (canvas.width - totalButtonWidth) / 2;
        
        // Store button rects in CANVAS coordinates (same as drawing coordinates)
        // Also store the canvas dimensions at the time of drawing for debugging
        data.buttonRects.canvasWidth = canvas.width;
        data.buttonRects.canvasHeight = canvas.height;
        
        // Sell Button
        const sellBtnX = buttonStartX;
        data.buttonRects.sell = { 
            x: sellBtnX, 
            y: buttonY, 
            width: buttonWidth, 
            height: buttonHeight 
        };
        ctx.fillStyle = '#FF6B6B';
        this.drawRoundedRect(ctx, sellBtnX, buttonY, buttonWidth, buttonHeight, 8);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Sell All', sellBtnX + buttonWidth / 2, buttonY + buttonHeight / 2);
        
        // Hunt Again Button
        const huntAgainBtnX = buttonStartX + buttonWidth + buttonSpacing;
        data.buttonRects.huntAgain = { 
            x: huntAgainBtnX, 
            y: buttonY, 
            width: buttonWidth, 
            height: buttonHeight 
        };
        ctx.fillStyle = '#4A90E2';
        this.drawRoundedRect(ctx, huntAgainBtnX, buttonY, buttonWidth, buttonHeight, 8);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Hunt Again', huntAgainBtnX + buttonWidth / 2, buttonY + buttonHeight / 2);
        
        // Return to Park Button
        const returnBtnX = buttonStartX + (buttonWidth + buttonSpacing) * 2;
        data.buttonRects.return = { 
            x: returnBtnX, 
            y: buttonY, 
            width: buttonWidth, 
            height: buttonHeight 
        };
        ctx.fillStyle = '#4CAF50';
        this.drawRoundedRect(ctx, returnBtnX, buttonY, buttonWidth, buttonHeight, 8);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Return to Base', returnBtnX + buttonWidth / 2, buttonY + buttonHeight / 2);
    },
    
    // Handle clicks on canvas-based capture results
    handleCaptureResultsClick(e) {
        const canvas = this.state.canvas;
        const rect = canvas.getBoundingClientRect();
        
        // Get borders
        const computedStyle = getComputedStyle(canvas);
        const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
        const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
        
        // Content area (what we actually draw on)
        const contentWidth = rect.width - borderLeft - borderRight;
        const contentHeight = rect.height - borderTop - borderBottom;
        
        // Calculate letterbox offset (if canvas is letterboxed)
        const canvasAspect = canvas.width / canvas.height;
        const containerAspect = contentWidth / contentHeight;
        
        let letterboxTop = 0;
        let letterboxLeft = 0;
        let visibleWidth = contentWidth;
        let visibleHeight = contentHeight;
        
        if (canvasAspect > containerAspect) {
            // Canvas is wider - letterbox on top/bottom
            visibleHeight = contentWidth / canvasAspect;
            letterboxTop = (contentHeight - visibleHeight) / 2;
        } else {
            // Canvas is taller - letterbox on left/right
            visibleWidth = contentHeight * canvasAspect;
            letterboxLeft = (contentWidth - visibleWidth) / 2;
        }
        
        // Scale factors (use visible area, not full content area)
        const scaleX = canvas.width / visibleWidth;
        const scaleY = canvas.height / visibleHeight;
        
        // Calculate click position - try offsetX/offsetY first (most accurate)
        let relativeX, relativeY;
        if (typeof e.offsetX === 'number' && typeof e.offsetY === 'number') {
            // offsetX/offsetY behavior varies by browser:
            // - Chrome/Edge: relative to padding box (includes borders) - need to subtract borders
            // - Firefox: relative to content box (excludes borders) - don't subtract
            // Let's try NOT subtracting borders first (Firefox behavior)
            // If that doesn't work, we'll try subtracting
            relativeX = e.offsetX;
            relativeY = e.offsetY;
            
            // But if offsetX/offsetY are larger than content area, they include borders
            if (e.offsetX > contentWidth || e.offsetY > contentHeight) {
                relativeX = e.offsetX - borderLeft;
                relativeY = e.offsetY - borderTop;
            }
        } else {
            // Fallback: use clientX/clientY
            relativeX = e.clientX - rect.left - borderLeft;
            relativeY = e.clientY - rect.top - borderTop;
        }
        
        // Subtract letterbox offset
        relativeX -= letterboxLeft;
        relativeY -= letterboxTop;
        
        // Clamp to visible area (excluding letterbox)
        relativeX = Math.max(0, Math.min(visibleWidth, relativeX));
        relativeY = Math.max(0, Math.min(visibleHeight, relativeY));
        
        // Convert to canvas coordinates
        const clickX = relativeX * scaleX;
        const clickY = relativeY * scaleY;
        
        const data = this.state.captureResultsData;
        
        if (!data || !data.buttonRects) return;
        
        // Debug logging
        console.log('=== CLICK DEBUG ===');
        console.log('offsetX/Y:', e.offsetX, e.offsetY);
        console.log('contentWidth/Height:', contentWidth, contentHeight);
        console.log('relativeX/Y before clamp:', relativeX, relativeY);
        console.log('Click at canvas coords:', clickX, clickY);
        console.log('Button rects:', data.buttonRects);
        
        // Debug: Draw visual indicators for button positions and click location
        if (this.state.devMode) {
            const debugCtx = canvas.getContext('2d');
            debugCtx.save();
            // Draw click position
            debugCtx.fillStyle = 'red';
            debugCtx.beginPath();
            debugCtx.arc(clickX, clickY, 10, 0, Math.PI * 2);
            debugCtx.fill();
            // Draw button outlines
            if (data.buttonRects.sell) {
                debugCtx.strokeStyle = 'yellow';
                debugCtx.lineWidth = 2;
                debugCtx.strokeRect(data.buttonRects.sell.x, data.buttonRects.sell.y, data.buttonRects.sell.width, data.buttonRects.sell.height);
            }
            if (data.buttonRects.huntAgain) {
                debugCtx.strokeStyle = 'cyan';
                debugCtx.lineWidth = 2;
                debugCtx.strokeRect(data.buttonRects.huntAgain.x, data.buttonRects.huntAgain.y, data.buttonRects.huntAgain.width, data.buttonRects.huntAgain.height);
            }
            if (data.buttonRects.return) {
                debugCtx.strokeStyle = 'lime';
                debugCtx.lineWidth = 2;
                debugCtx.strokeRect(data.buttonRects.return.x, data.buttonRects.return.y, data.buttonRects.return.width, data.buttonRects.return.height);
            }
            debugCtx.restore();
        }
        
        // Check if click is on a button (with a small tolerance for easier clicking)
        const tolerance = 5; // Increased tolerance for easier clicking
        
        if (data.buttonRects.sell) {
            const btn = data.buttonRects.sell;
            const inBounds = clickX >= btn.x - tolerance && clickX <= btn.x + btn.width + tolerance &&
                           clickY >= btn.y - tolerance && clickY <= btn.y + btn.height + tolerance;
            console.log('Sell button check:', inBounds, 'btn:', btn, 'click:', clickX, clickY);
            if (inBounds) {
                // Sell all captured dinos
                this.sellAllCapturedDinos();
                return;
            }
        }
        
        if (data.buttonRects.huntAgain) {
            const btn = data.buttonRects.huntAgain;
            const inBounds = clickX >= btn.x - tolerance && clickX <= btn.x + btn.width + tolerance &&
                           clickY >= btn.y - tolerance && clickY <= btn.y + btn.height + tolerance;
            console.log('Hunt Again button check:', inBounds, 'btn:', btn, 'click:', clickX, clickY);
            if (inBounds) {
                // Start new hunt
                this.closeCaptureResults();
                startNewHunt();
                return;
            }
        }
        
        if (data.buttonRects.return) {
            const btn = data.buttonRects.return;
            const inBounds = clickX >= btn.x - tolerance && clickX <= btn.x + btn.width + tolerance &&
                           clickY >= btn.y - tolerance && clickY <= btn.y + btn.height + tolerance;
            console.log('Return button check:', inBounds, 'btn:', btn, 'click:', clickX, clickY);
            if (inBounds) {
                // Return to park
                this.closeCaptureResults();
                returnToPark();
                return;
            }
        }
    },
    
    // Close canvas-based capture results
    closeCaptureResults() {
        this.state.showCaptureResults = false;
        this.state.captureResultsData = null;
        // Don't stop if we're returning to park (let returnToPark handle it)
        // Only stop if we're just closing the results
        if (!document.fullscreenElement) {
            this.stop();
        }
    },
    
    // Fire a projectile from a dinosaur at the player
    fireDinoProjectile(dino, player, attackConfig) {
        // Calculate direction to player
        const dx = player.x - dino.x;
        const dy = player.y - dino.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // Create projectile
        const projectile = {
            x: dino.x,
            y: dino.y,
            vx: Math.cos(angle) * attackConfig.speed,
            vy: Math.sin(angle) * attackConfig.speed,
            angle: angle,
            damage: attackConfig.damage,
            range: attackConfig.range,
            maxDistance: attackConfig.range * 2, // Projectile travels up to 2x range
            distanceTraveled: 0,
            projectileType: attackConfig.projectileType,
            species: dino.species
        };
        
        this.state.dinoProjectiles.push(projectile);
        
        // Load attack image if not already loaded
        if (attackConfig.projectileType && !this.state.dinoAttackImages[attackConfig.projectileType]) {
            const imagePath = `images/dinos/${attackConfig.projectileType}.png`;
            ImageLoader.loadImage(imagePath).then(img => {
                if (img) {
                    this.state.dinoAttackImages[attackConfig.projectileType] = img;
                }
            }).catch(() => {
                // Image doesn't exist, will use default
            });
        }
    },
    
    // Update and draw dinosaur projectiles
    updateDinoProjectiles(ctx) {
        const canvas = this.state.canvas;
        const player = this.state.player;
        
        for (let i = this.state.dinoProjectiles.length - 1; i >= 0; i--) {
            const proj = this.state.dinoProjectiles[i];
            if (!proj) {
                this.state.dinoProjectiles.splice(i, 1);
                continue;
            }
            
            // Update position
            proj.x += proj.vx;
            proj.y += proj.vy;
            proj.distanceTraveled += Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
            
            // Check collision with player
            const distToPlayer = Math.sqrt(
                Math.pow(proj.x - player.x, 2) + 
                Math.pow(proj.y - player.y, 2)
            );
            
            if (distToPlayer < player.size / 2) {
                // Hit player - deal damage
                const now = Date.now();
                const cooldownMs = GameConfig.HUNTING.PLAYER_DAMAGE_COOLDOWN * (1000 / 60);
                if (now - player.lastDamageTime >= cooldownMs) {
                    player.health -= proj.damage;
                    player.lastDamageTime = now;
                    
                    // Play damage sound (throttled to prevent spam)
                    if (typeof SoundManager !== 'undefined') {
                        const now = Date.now();
                        const lastDamageSound = this.state.lastDamageSoundTime || 0;
                        if (now - lastDamageSound > 200) { // Only play damage sound once per 200ms
                            SoundManager.playSound('damage');
                            this.state.lastDamageSoundTime = now;
                        }
                    }
                    
                    // Visual feedback
                    this.triggerScreenShake(8, 15);
                    this.state.playerDamageIndicator.active = true;
                    this.state.playerDamageIndicator.timer = 30;
                    
                    if (player.health <= 0) {
                        player.health = 0;
                        // Game over handled elsewhere
                    }
                }
                
                // Remove projectile
                this.state.dinoProjectiles.splice(i, 1);
                continue;
            }
            
            // Remove if out of bounds or traveled too far
            if (proj.x < 0 || proj.x > canvas.width || 
                proj.y < 0 || proj.y > canvas.height ||
                proj.distanceTraveled > proj.maxDistance) {
                this.state.dinoProjectiles.splice(i, 1);
                continue;
            }
            
            // Draw projectile
            const attackImage = this.state.dinoAttackImages[proj.projectileType];
            const projectileSize = 20; // Default size
            
            ctx.save();
            ctx.translate(proj.x, proj.y);
            ctx.rotate(proj.angle);
            
            if (attackImage && attackImage.complete && attackImage.naturalWidth > 0) {
                // Draw custom attack image
                ctx.drawImage(
                    attackImage,
                    -projectileSize / 2,
                    -projectileSize / 2,
                    projectileSize,
                    projectileSize
                );
            } else {
                // Draw default projectile (green circle for enemy projectiles)
                ctx.fillStyle = '#00FF00';
                ctx.beginPath();
                ctx.arc(0, 0, projectileSize / 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Add glow effect
                const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, projectileSize);
                glowGradient.addColorStop(0, 'rgba(0, 255, 0, 0.8)');
                glowGradient.addColorStop(1, 'rgba(0, 255, 0, 0)');
                ctx.fillStyle = glowGradient;
                ctx.beginPath();
                ctx.arc(0, 0, projectileSize, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        }
    },
    
    // Update gas grenades (damage over time, remove expired)
    updateGasGrenades() {
        if (!this.state.active) return;
        
        const now = Date.now();
        const activeDinos = this.state.dinos.length > 0 ? this.state.dinos : (this.state.dino ? [this.state.dino] : []);
        
        // #region agent log
        if (this.state.gasGrenades.length > 0) {
            debugLog('hunting-game.js:3987', 'Updating gas grenades', {grenadeCount:this.state.gasGrenades.length,activeDinos:activeDinos.length}, 'C');
        }
        // #endregion
        
        for (let i = this.state.gasGrenades.length - 1; i >= 0; i--) {
            const grenade = this.state.gasGrenades[i];
            if (!grenade) {
                this.state.gasGrenades.splice(i, 1);
                continue;
            }
            
            // Check if grenade has expired
            if (now - grenade.startTime >= grenade.duration) {
                this.state.gasGrenades.splice(i, 1);
                continue;
            }
            
            // Apply damage to dinos in area every tick
            if (now - grenade.lastTick >= grenade.tickRate) {
                grenade.lastTick = now;
                
                for (const dino of activeDinos) {
                    if (!dino || dino.captured || dino.health <= 0) continue;
                    if (dino.isAquatic && dino.isUnderwater) continue; // Can't hit underwater dinos
                    
                    const dist = this.getToroidalDistance(grenade.x, grenade.y, dino.x, dino.y, 
                        this.state.canvas.width, this.state.canvas.height);
                    
                    if (dist <= grenade.radius) {
                        // #region agent log
                        debugLog('hunting-game.js:3979', 'Dino in gas cloud', {dinoX:dino.x,dinoY:dino.y,grenadeX:grenade.x,grenadeY:grenade.y,dist:dist,radius:grenade.radius,damage:grenade.damage}, 'C');
                        // #endregion
                        
                        // Dino is in gas cloud - apply damage
                        dino.health -= grenade.damage;
                        
                        // Alert dino
                        if (!dino.alerted) {
                            dino.alerted = true;
                            dino.alertTimer = 300;
                        }
                        
                        // Check if dino should be captured
                        if (dino.health <= 0 && !dino.captured) {
                            this.captureDino(dino);
                        }
                    }
                }
            }
        }
    },
    
    // Draw gas grenades
    drawGasGrenades(ctx) {
        if (!this.state.active) return;
        
        const now = Date.now();
        
        for (const grenade of this.state.gasGrenades) {
            if (!grenade) continue;
            
            const elapsed = now - grenade.startTime;
            const remaining = grenade.duration - elapsed;
            const alpha = Math.min(1, remaining / 1000); // Fade out in last second
            
            // Draw gas cloud (green/yellow cloud effect)
            ctx.save();
            
            // Outer glow
            const outerGradient = ctx.createRadialGradient(
                grenade.x, grenade.y, 0,
                grenade.x, grenade.y, grenade.radius
            );
            outerGradient.addColorStop(0, `rgba(144, 238, 144, ${alpha * 0.6})`);
            outerGradient.addColorStop(0.5, `rgba(255, 255, 0, ${alpha * 0.4})`);
            outerGradient.addColorStop(1, `rgba(144, 238, 144, ${alpha * 0.1})`);
            
            ctx.fillStyle = outerGradient;
            ctx.beginPath();
            ctx.arc(grenade.x, grenade.y, grenade.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner core
            ctx.fillStyle = `rgba(144, 238, 144, ${alpha * 0.8})`;
            ctx.beginPath();
            ctx.arc(grenade.x, grenade.y, grenade.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw duration indicator (optional - small text showing time remaining)
            if (remaining > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${(remaining / 1000).toFixed(1)}s`, grenade.x, grenade.y - grenade.radius - 15);
            }
            
            ctx.restore();
        }
    }

};
