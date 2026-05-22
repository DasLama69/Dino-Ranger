// ============================================
// SANDBOX MODE (DEV ONLY)
// ============================================

const Sandbox = {
    state: {
        active: false,
        canvas: null,
        ctx: null,
        player: {
            x: GameConfig.HUNTING.PLAYER_START_X,
            y: GameConfig.HUNTING.PLAYER_START_Y,
            size: GameConfig.HUNTING.PLAYER_SIZE,
            speed: 3.0,
            health: GameConfig.HUNTING.PLAYER_MAX_HEALTH,
            maxHealth: GameConfig.HUNTING.PLAYER_MAX_HEALTH,
            lastDamageTime: 0,
            image: null,
            isSprinting: false
        },
        keys: {
            w: false, a: false, s: false, d: false,
            ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false,
            Shift: false
        },
        mouse: {
            x: 0,
            y: 0,
            inCanvas: false,
            isDown: false
        },
        dinos: [],
        bullets: [],
        lastShot: 0,
        bulletImage: null, // Dart sprite for bullets
        dinoProjectiles: [], // Projectiles fired by dinosaurs
        dinoAttackImages: {}, // Cache for dinosaur attack images
        animationFrame: null,
        backgroundImage: null,
        environment: {
            walkableBounds: {
                x: 0,
                y: 225,
                width: 1200,
                height: 425
            },
            isAquaticMode: false,
            lakeBounds: null,
            walkableExtension: null,
            bushes: []
        },
        mapStyle: 'land' // 'land' or 'aquatic'
    },

    // Initialize sandbox
    init() {
        this.state.canvas = document.getElementById('sandbox-canvas');
        if (!this.state.canvas) return;
        
        this.state.canvas.width = GameConfig.HUNTING.CANVAS_WIDTH;
        this.state.canvas.height = GameConfig.HUNTING.CANVAS_HEIGHT;
        this.state.ctx = this.state.canvas.getContext('2d');
        
        // Set up event listeners
        this.state.canvas.addEventListener('click', (e) => this.shoot(e));
        this.state.canvas.addEventListener('mousedown', (e) => {
            this.state.mouse.isDown = true;
            this.shoot(e);
        });
        this.state.canvas.addEventListener('mouseup', () => {
            this.state.mouse.isDown = false;
        });
        this.state.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.state.canvas.addEventListener('mouseleave', () => { 
            this.state.mouse.inCanvas = false;
            this.state.mouse.isDown = false;
        });
        this.state.canvas.addEventListener('mouseenter', () => { this.state.mouse.inCanvas = true; });
        
        // Set up keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Load player image
        ImageLoader.loadImage('images/player/player.png').then(img => {
            this.state.player.image = img;
        });
        
        // Load bullet (dart) image
        ImageLoader.loadImage('images/player/dart.png').then(img => {
            this.state.bulletImage = img;
        });
        
        // Load initial background
        this.loadBackgroundImage();
        
        // Populate dinosaur dropdown
        this.populateDinoDropdown();
        
        // Set up map style selector
        const mapStyleSelect = document.getElementById('sandbox-map-style');
        if (mapStyleSelect) {
            mapStyleSelect.addEventListener('change', (e) => {
                this.setMapStyle(e.target.value);
            });
        }
    },

    // Set map style (land or aquatic)
    setMapStyle(style) {
        this.state.mapStyle = style;
        this.state.environment.isAquaticMode = (style === 'aquatic');
        
        // Set up bounds based on map style
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
                width: 200,        // Extends right 200 pixels
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
        
        // Reload background
        this.state.backgroundImage = null;
        this.loadBackgroundImage();
        
        // Reset player position
        const playerStart = this.clampToWalkableBounds(
            GameConfig.HUNTING.PLAYER_START_X,
            GameConfig.HUNTING.PLAYER_START_Y,
            this.state.player.size
        );
        this.state.player.x = playerStart.x;
        this.state.player.y = playerStart.y;
    },

    // Load background image
    async loadBackgroundImage() {
        try {
            const backgroundPath = this.state.environment.isAquaticMode 
                ? 'images/environment/background-lake.png'
                : 'images/environment/background-land.png';
            
            const img = await ImageLoader.loadImage(backgroundPath);
            this.state.backgroundImage = img;
        } catch (e) {
            console.warn('Could not load background image:', e);
        }
    },

    // Populate dinosaur dropdown
    populateDinoDropdown() {
        const dropdown = document.getElementById('sandbox-dino-select');
        if (!dropdown) return;
        
        dropdown.innerHTML = '<option value="">Select Dinosaur...</option>';
        
        Object.entries(GameConfig.DINOSAUR_SPECIES).forEach(([key, species]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${species.emoji} ${species.name}`;
            dropdown.appendChild(option);
        });
    },

    // Clamp position to walkable bounds
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

    // Start sandbox
    start() {
        if (this.state.active) return;
        
        this.state.active = true;
        const playerStart = this.clampToWalkableBounds(
            GameConfig.HUNTING.PLAYER_START_X,
            GameConfig.HUNTING.PLAYER_START_Y,
            this.state.player.size
        );
        this.state.player.x = playerStart.x;
        this.state.player.y = playerStart.y;
        this.state.dinos = [];
        this.state.bullets = [];
        this.state.environment.bushes = [];
        
        this.loop();
    },

    // Stop sandbox
    stop() {
        this.state.active = false;
        if (this.state.animationFrame) {
            cancelAnimationFrame(this.state.animationFrame);
            this.state.animationFrame = null;
        }
    },

    // Main loop
    loop() {
        if (!this.state.active) return;
        
        this.update();
        this.render();
        
        this.state.animationFrame = requestAnimationFrame(() => this.loop());
    },

    // Update game state
    update() {
        // Update player movement
        this.updatePlayer();
        
        // Update bullets
        this.updateBullets();
        
        // Update dinosaurs
        this.updateDinos();
    },

    // Update player movement (same as hunting game)
    updatePlayer() {
        const player = this.state.player;
        const keys = this.state.keys;
        
        let dx = 0;
        let dy = 0;
        
        if (keys.w || keys.ArrowUp) dy -= 1;
        if (keys.s || keys.ArrowDown) dy += 1;
        if (keys.a || keys.ArrowLeft) dx -= 1;
        if (keys.d || keys.ArrowRight) dx += 1;
        
        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            dx *= 0.707;
            dy *= 0.707;
        }
        
        // Sprint multiplier
        const isSprinting = keys.Shift;
        const speedMultiplier = isSprinting ? 1.8 : 1.0;
        player.isSprinting = isSprinting;
        
        // Calculate new position
        const newX = player.x + dx * player.speed * speedMultiplier;
        const newY = player.y + dy * player.speed * speedMultiplier;
        
        // Clamp to walkable bounds
        const clampedPos = this.clampToWalkableBounds(newX, newY, player.size);
        player.x = clampedPos.x;
        player.y = clampedPos.y;
        
        // Prevent entering water in aquatic mode
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
                if (player.x >= lake.x) {
                    player.x = lake.x - player.size;
                }
            }
        }
        
        // Handle continuous fire
        if (this.state.mouse.isDown && this.state.mouse.inCanvas && this.state.active) {
            // Use mouse position directly (already in canvas coordinates, no need for synthetic event)
            // Use shared shooting utility
            const gun = GameState.get().gun;
            const newLastShot = ShootingUtils.shootSimple(
                null, // No event - use mouseState directly
                this.state.canvas,
                this.state.player,
                this.state.mouse,
                this.state.bullets,
                gun,
                this.state.lastShot
            );
            if (newLastShot) {
                this.state.lastShot = newLastShot;
            }
        }
    },

    // Update bullets
    updateBullets() {
        const canvas = this.state.canvas;
        const gun = GameState.get().gun;
        
        for (let i = this.state.bullets.length - 1; i >= 0; i--) {
            const bullet = this.state.bullets[i];
            
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            
            // Check collision with dinos
            let hitDino = false;
            for (let dinoIdx = 0; dinoIdx < this.state.dinos.length; dinoIdx++) {
                const dino = this.state.dinos[dinoIdx];
                if (!dino || dino.captured || dino.health <= 0) continue;
                if (dino.isAquatic && dino.isUnderwater) continue; // Can't hit underwater
                
                const dist = Math.sqrt(
                    Math.pow(bullet.x - dino.x, 2) + 
                    Math.pow(bullet.y - dino.y, 2)
                );
                
                if (dist < dino.size / 2) {
                    hitDino = true;
                    const isCritical = !dino.alerted;
                    const baseDamage = gun.damage;
                    const finalDamage = isCritical ? baseDamage * 3 : baseDamage;
                    
                    dino.health -= finalDamage;
                    this.state.bullets.splice(i, 1);
                    
                    dino.alerted = true;
                    dino.alertTimer = 300;
                    
                    // Play sound
                    if (typeof SoundManager !== 'undefined') {
                        SoundManager.playSound(isCritical ? 'critical' : 'hit');
                    }
                    
                    if (dino.health <= 0 && !dino.captured) {
                        this.captureDino(dino);
                    }
                    break;
                }
            }
            
            // Remove bullets out of bounds
            if (!hitDino) {
                if (bullet.x < 0 || bullet.x > canvas.width || 
                    bullet.y < 0 || bullet.y > canvas.height) {
                    this.state.bullets.splice(i, 1);
                }
            }
        }
    },

    // Update dinosaurs (full AI from hunting game)
    updateDinos() {
        const player = this.state.player;
        const config = GameConfig.HUNTING;
        const canvas = this.state.canvas;
        
        this.state.dinos.forEach(d => {
            if (!d || d.captured) return;
            if (d.health <= 0 && !d.captured) {
                this.captureDino(d);
                return;
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
            
            // Check vision cone and update alert status
            const canSeePlayer = this.checkVisionCone(d, player, config.DINO_VISION_RANGE, config.DINO_VISION_ANGLE);
            if (canSeePlayer && !d.alerted) {
                // Just became alerted - play sound
                if (typeof SoundManager !== 'undefined') {
                    SoundManager.playSound('alert');
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
                            
                            // Play damage sound
                            if (typeof SoundManager !== 'undefined') {
                                SoundManager.playSound('damage');
                            }
                            
                            if (player.health <= 0) {
                                player.health = 0;
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
                            
                            // Play damage sound
                            if (typeof SoundManager !== 'undefined') {
                                SoundManager.playSound('damage');
                            }
                            
                            if (player.health <= 0) {
                                player.health = 0;
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
        });
    },

    // Shoot (same as hunting game)
    shoot(event) {
        if (!this.state.active) return;
        
        // Allow shooting even without dinos (for testing)
        if (this.state.player.isSprinting) return;
        
        const gun = GameState.get().gun;
        const newLastShot = ShootingUtils.shootSimple(
            event,
            this.state.canvas,
            this.state.player,
            this.state.mouse,
            this.state.bullets,
            gun,
            this.state.lastShot
        );
        
        if (newLastShot) {
            this.state.lastShot = newLastShot;
        }
    },

    // Capture dino
    captureDino(dino) {
        dino.captured = true;
        dino.speed = 0;
        dino.alerted = false;
        
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playSound('capture');
        }
    },

    // Handle mouse movement
    handleMouseMove(e) {
        ShootingUtils.handleMouseMove(e, this.state.canvas, this.state.mouse);
    },

    // Handle keyboard input
    handleKeyDown(e) {
        let key = e.key;
        if (key === 'W') key = 'w';
        else if (key === 'A') key = 'a';
        else if (key === 'S') key = 's';
        else if (key === 'D') key = 'd';
        
        if (key === 'Shift') {
            this.state.keys.Shift = true;
            return;
        }
        
        if (this.state.keys.hasOwnProperty(key)) {
            this.state.keys[key] = true;
        }
    },

    handleKeyUp(e) {
        let key = e.key;
        if (key === 'W') key = 'w';
        else if (key === 'A') key = 'a';
        else if (key === 'S') key = 's';
        else if (key === 'D') key = 'd';
        
        if (key === 'Shift') {
            this.state.keys.Shift = false;
            return;
        }
        
        if (this.state.keys.hasOwnProperty(key)) {
            this.state.keys[key] = false;
        }
    },

    // Render everything
    render() {
        const ctx = this.state.ctx;
        const canvas = this.state.canvas;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background
        if (this.state.backgroundImage) {
            ctx.drawImage(this.state.backgroundImage, 0, 0, canvas.width, canvas.height);
        } else {
            // Fallback
            ctx.fillStyle = '#8B7355';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Draw bushes
        this.state.environment.bushes.forEach(bush => {
            if (bush.image) {
                ctx.drawImage(bush.image, bush.x - bush.size / 2, bush.y - bush.size / 2, bush.size, bush.size);
            }
        });
        
        // Draw dinosaurs
        this.state.dinos.forEach(d => {
            if (!d) return;
            RenderingUtils.drawDino(ctx, d, {
                showHealthBar: !d.captured && (!d.isAquatic || !d.isUnderwater),
                showAlertMark: false,
                showSleepingZees: d.captured
            });
        });
        
        // Draw bullets
        this.state.bullets.forEach(bullet => {
            // Store previous positions for tracer effect
            if (!bullet.trail) {
                bullet.trail = [];
            }
            bullet.trail.push({ x: bullet.x, y: bullet.y });
            // Keep only last N positions
            if (bullet.trail.length > GameConfig.GUN.DART_TRACER_LENGTH) {
                bullet.trail.shift();
            }
            
            // Use shared rendering function
            RenderingUtils.drawBullet(ctx, bullet, this.state.bulletImage);
        });
        
        // Draw player
        if (this.state.player.image) {
            ctx.save();
            ctx.translate(this.state.player.x, this.state.player.y);
            const mouse = this.state.mouse;
            if (mouse.inCanvas) {
                const dx = mouse.x - this.state.player.x;
                const dy = mouse.y - this.state.player.y;
                ctx.rotate(Math.atan2(dy, dx));
            }
            ctx.drawImage(
                this.state.player.image,
                -this.state.player.size / 2,
                -this.state.player.size / 2,
                this.state.player.size,
                this.state.player.size
            );
            ctx.restore();
        } else {
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(this.state.player.x, this.state.player.y, this.state.player.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw player health bar
        const barWidth = 100;
        const barHeight = 10;
        ctx.fillStyle = 'red';
        ctx.fillRect(10, 10, barWidth, barHeight);
        ctx.fillStyle = 'green';
        ctx.fillRect(10, 10, barWidth * (this.state.player.health / this.state.player.maxHealth), barHeight);
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(`Health: ${Math.ceil(this.state.player.health)}/${this.state.player.maxHealth}`, 10, 25);
        
        // Draw laser dot and range circle (scope zoom will be drawn after all game elements)
        if (this.state.mouse.inCanvas && this.state.active) {
            RenderingUtils.drawLaserDot(ctx, this.state.player, this.state.mouse, GameState.get().gun);
        }
        
        // Draw scope zoom overlay (after all game elements so it appears on top)
        if (this.state.mouse.inCanvas && this.state.active) {
            const renderZoomedView = (zoomCtx) => {
                // Background
                if (this.state.backgroundImage) {
                    zoomCtx.drawImage(this.state.backgroundImage, 0, 0, this.state.canvas.width, this.state.canvas.height);
                }
                
                // Bushes
                this.state.environment.bushes.forEach(bush => {
                    if (bush.image) {
                        zoomCtx.drawImage(bush.image, bush.x - bush.size / 2, bush.y - bush.size / 2, bush.size, bush.size);
                    }
                });
                
                // Dinosaurs
                for (const d of this.state.dinos) {
                    if (!d) continue;
                    RenderingUtils.drawDino(zoomCtx, d, {
                        showHealthBar: !d.captured && (!d.isAquatic || !d.isUnderwater),
                        showAlertMark: false,
                        showSleepingZees: d.captured
                    });
                }
                
                // Bullets
                for (let i = 0; i < this.state.bullets.length; i++) {
                    const bullet = this.state.bullets[i];
                    if (!bullet) continue;
                    RenderingUtils.drawBullet(zoomCtx, bullet, this.state.bulletImage);
                }
                
                // Player
                if (this.state.player.image) {
                    zoomCtx.save();
                    zoomCtx.translate(this.state.player.x, this.state.player.y);
                    if (this.state.mouse.inCanvas) {
                        const dx = this.state.mouse.x - this.state.player.x;
                        const dy = this.state.mouse.y - this.state.player.y;
                        zoomCtx.rotate(Math.atan2(dy, dx));
                    }
                    zoomCtx.drawImage(
                        this.state.player.image,
                        -this.state.player.size / 2,
                        -this.state.player.size / 2,
                        this.state.player.size,
                        this.state.player.size
                    );
                    zoomCtx.restore();
                } else {
                    zoomCtx.fillStyle = '#FF0000';
                    zoomCtx.beginPath();
                    zoomCtx.arc(this.state.player.x, this.state.player.y, this.state.player.size / 2, 0, Math.PI * 2);
                    zoomCtx.fill();
                }
            };
            
            RenderingUtils.drawScopeZoom(
                ctx,
                this.state.player,
                this.state.mouse,
                GameState.get().gun,
                this.state.canvas,
                renderZoomedView
            );
        }
        
        // Update and draw dino projectiles (after scope zoom so they appear on top)
        this.updateDinoProjectiles(ctx);
        
        // Draw debug overlay (grid, bounds, hitboxes) - always on in sandbox
        this.drawDebugOverlay(ctx);
    },

    // Use shared rendering function
    drawSleepingZees(ctx, dino) {
        RenderingUtils.drawSleepingZees(ctx, dino);
    },

    // Spawn dinosaur
    spawnDino(speciesKey) {
        if (!speciesKey || !GameConfig.DINOSAUR_SPECIES[speciesKey]) return;
        
        const species = GameConfig.DINOSAUR_SPECIES[speciesKey];
        const rarity = this.getRandomRarity();
        const rarityData = GameConfig.RARITY[rarity];
        const config = GameConfig.HUNTING;
        
        // Calculate stats
        const speed = species.baseSpeed * rarityData.multiplier;
        const health = config.DINO_BASE_HEALTH * rarityData.multiplier;
        const baseSize = config.DINO_BASE_SIZE + (speed * config.DINO_SIZE_PER_SPEED);
        
        // Spawn position
        let spawnX, spawnY;
        const isAquatic = species.category === 'aquarium';
        
        if (isAquatic && this.state.environment.lakeBounds) {
            const lake = this.state.environment.lakeBounds;
            const halfSize = baseSize / 2;
            spawnX = lake.x + halfSize + Math.random() * (lake.width - baseSize);
            spawnY = lake.y + halfSize + Math.random() * (lake.height - baseSize);
        } else {
            const bounds = this.state.environment.walkableBounds;
            const clampedPos = this.clampToWalkableBounds(
                bounds.x + bounds.width * 0.5,
                bounds.y + bounds.height * 0.5,
                baseSize
            );
            spawnX = clampedPos.x;
            spawnY = clampedPos.y;
        }
        
        // Load image
        let image = null;
        ImageLoader.loadImage(species.image).then(img => {
            const dinoIndex = this.state.dinos.findIndex(d => d.species === speciesKey && !d.image);
            if (img && dinoIndex !== -1) {
                this.state.dinos[dinoIndex].image = img;
            }
        });
        
        const dino = {
            species: speciesKey,
            name: species.name,
            category: species.category,
            rarity: rarity,
            x: spawnX,
            y: spawnY,
            size: baseSize,
            baseSpeed: speed * config.DINO_BASE_SPEED,
            speed: speed * config.DINO_BASE_SPEED,
            health: health,
            maxHealth: health,
            direction: Math.random() * Math.PI * 2,
            emoji: species.emoji,
            image: image,
            alerted: false,
            alertTimer: 0,
            directionRecalcTimer: 0,
            isAquatic: isAquatic,
            isUnderwater: isAquatic,
            surfaceTimer: 0,
            surfaceDuration: 120 + Math.random() * 120,
            underwaterDuration: 180 + Math.random() * 180,
            captured: false,
            // Additional properties for full AI
            attackCooldown: species.attack ? Math.floor(species.attack.cooldown / (1000 / 60)) : 0, // Initialize attack cooldown
            lastAttackTime: 0, // Track last attack time in milliseconds
            attackState: 'idle',
            retreatTarget: null,
            lastDirectionToPlayer: null,
            lastFleeAngle: null,
            panicDirectionSet: false
        };
        
        this.state.dinos.push(dino);
    },

    // Get random rarity
    getRandomRarity() {
        const rand = Math.random() * 100;
        if (rand < 50) return 'common';
        if (rand < 80) return 'rare';
        if (rand < 95) return 'epic';
        return 'legendary';
    },

    // Spawn bush
    spawnBush() {
        const availableBushes = [
            'images/environment/Bush_01.png',
            'images/environment/Bush_02.png',
            'images/environment/Bush_03.png',
            'images/environment/Bush_04.png',
            'images/environment/Bush_05.png'
        ];
        
        const imagePath = availableBushes[Math.floor(Math.random() * availableBushes.length)];
        const bounds = this.state.environment.walkableBounds;
        
        // Random position in walkable area
        const x = bounds.x + Math.random() * bounds.width;
        const y = bounds.y + Math.random() * bounds.height;
        
        let image = null;
        ImageLoader.loadImage(imagePath).then(img => {
            const bushIndex = this.state.environment.bushes.findIndex(b => !b.image);
            if (img && bushIndex !== -1) {
                this.state.environment.bushes[bushIndex].image = img;
            }
        });
        
        const bush = {
            x: x,
            y: y,
            size: 60,
            image: image
        };
        
        this.state.environment.bushes.push(bush);
    },

    // Clear all
    clearAll() {
        this.state.dinos = [];
        this.state.bullets = [];
        this.state.dinoProjectiles = [];
        this.state.environment.bushes = [];
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
                    
                    // Play damage sound
                    if (typeof SoundManager !== 'undefined') {
                        SoundManager.playSound('damage');
                    }
                    
                    if (player.health <= 0) {
                        player.health = 0;
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

    // Test sound
    testSound(soundName) {
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playSound(soundName);
        }
    },

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

    // Check if dino can see player (vision cone)
    checkVisionCone(dino, player, range, angle) {
        const canvas = this.state.canvas;
        return GameHelpers.checkVisionCone(dino, player, range, angle, canvas.width, canvas.height);
    },

    // Draw debug overlay (grid, bounds, hitboxes) - same as hunting game
    drawDebugOverlay(ctx) {
        const canvas = this.state.canvas;
        const bounds = this.state.environment.walkableBounds;
        const player = this.state.player;
        const activeDinos = this.state.dinos.filter(d => !d.captured);

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

            // Draw x coordinate labels at top (only every 100px for readability)
            if (x % 100 === 0) {
                ctx.textAlign = 'center';
                ctx.fillText(`${x}`, x + 15, 12);
            }
        }

        // Draw horizontal grid lines
        for (let y = 0; y <= canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();

            // Draw y coordinate labels on left (only every 100px for readability, shifted right)
            if (y % 100 === 0) {
                ctx.textAlign = 'left';
                ctx.fillText(`${y}`, 25, y + 12);
            }
        }

        ctx.restore();

        // Draw walkable bounds rectangle
        ctx.save();
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
        ctx.restore();

        // Draw lake bounds if in aquatic mode
        if (this.state.environment.isAquaticMode && this.state.environment.lakeBounds) {
            const lake = this.state.environment.lakeBounds;
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 100, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(lake.x, lake.y, lake.width, lake.height);
            ctx.setLineDash([]);
            ctx.restore();
        }

        // Draw player hitbox
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 255, 0.6)';
        ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Draw player position label
        ctx.fillStyle = 'rgba(0, 0, 255, 0.9)';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Player: (${Math.round(player.x)}, ${Math.round(player.y)})`, player.x + player.size + 5, player.y - 5);
        ctx.restore();

        // Draw dino hitboxes
        activeDinos.forEach(dino => {
            ctx.save();
            const rarity = GameConfig.RARITY[dino.rarity] || GameConfig.RARITY.common;
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(dino.x, dino.y, dino.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Draw dino position label
            ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'left';
            const label = dino.isAquatic && dino.isUnderwater ? 'UW' : dino.name.substring(0, 8);
            ctx.fillText(`${label}: (${Math.round(dino.x)}, ${Math.round(dino.y)})`, dino.x + dino.size / 2 + 5, dino.y - 5);
            ctx.fillText(`Size: ${dino.size}`, dino.x + dino.size / 2 + 5, dino.y + 10);
            ctx.restore();
        });

        // Draw bush hitboxes
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.6)';
        ctx.lineWidth = 2;
        const config = GameConfig.HUNTING.ENVIRONMENT;
        this.state.environment.bushes.forEach(bush => {
            ctx.save();
            // Draw bush circle
            ctx.fillStyle = 'rgba(139, 69, 19, 0.2)';
            ctx.beginPath();
            ctx.arc(bush.x, bush.y, config.BUSH_SAFE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Draw bush position label
            ctx.fillStyle = 'rgba(139, 69, 19, 0.9)';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`Bush: (${Math.round(bush.x)}, ${Math.round(bush.y)})`, bush.x + config.BUSH_SAFE_RADIUS + 5, bush.y);
            ctx.restore();
        });
    }
};

// Expose functions for UI
window.Sandbox = Sandbox;

window.spawnSandboxDino = function() {
    const dropdown = document.getElementById('sandbox-dino-select');
    if (dropdown && dropdown.value) {
        Sandbox.spawnDino(dropdown.value);
    }
};

window.spawnSandboxBush = function() {
    Sandbox.spawnBush();
};

window.testSandboxSound = function(soundName) {
    Sandbox.testSound(soundName);
};

window.clearSandbox = function() {
    Sandbox.clearAll();
};
