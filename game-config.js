// ============================================
// GAME CONFIGURATION - All game variables
// ============================================

const GameConfig = {
    // Starting values
    STARTING_MONEY: 300, // Increased for early dopamine hit
    
    // Park Management
    PARK: {
        // Exhibit costs
        NEW_EXHIBIT_COST: 400, // Slightly cheaper first exhibit
        EXHIBIT_UPGRADE_BASE_COST: 150, // Cheaper early upgrades
        EXHIBIT_UPGRADE_MULTIPLIER: 2.2, // Steeper scaling later
        
        // Income calculation
        INCOME_PER_VISITOR_PER_MINUTE: 0.6, // Slightly more income early
        VISITORS_PER_APPEAL_MULTIPLIER: 2.2, // More visitors = more income
        
        // Dinosaur leveling
        DINO_MAX_LEVEL: 10,
        DINO_LEVEL_UP_COST_MULTIPLIER: 1.5
    },
    
DINOSAUR_SPECIES: {

    // ==================================================
    // 🌿 HERBIVORES (25)
    // ==================================================

    hypsilophodon: { name:'Hypsilophodon', category:'plant', baseAppeal:1, baseValue:120, baseSpeed:5, baseSize:45, emoji:'🦕', image:'images/dinos/Hypsilophodon.png', spawnWeight:25 },
    psittacosaurus: { name:'Psittacosaurus', category:'plant', baseAppeal:2, baseValue:150, baseSpeed:4, baseSize:42, emoji:'🦕', image:'images/dinos/Psittacosaurus.png', spawnWeight:23 },
    dryosaurus: { name:'Dryosaurus', category:'plant', baseAppeal:2, baseValue:160, baseSpeed:5, baseSize:45, emoji:'🦕', image:'images/dinos/Dryosaurus.png', spawnWeight:22 },
    leaellynasaura: { name:'Leaellynasaura', category:'plant', baseAppeal:2, baseValue:170, baseSpeed:5, baseSize:40, emoji:'🦕', image:'images/dinos/Leaellynasaura.png', spawnWeight:22 },

    stegosaurus: { name:'Stegosaurus', category:'plant', baseAppeal:4, baseValue:300, baseSpeed:3, baseSize:65, emoji:'🦕', image:'images/dinos/Stegosaurus.png', spawnWeight:16 },
    kentrosaurus: { name:'Kentrosaurus', category:'plant', baseAppeal:4, baseValue:320, baseSpeed:3, baseSize:60, emoji:'🦕', image:'images/dinos/Kentrosaurus.png', spawnWeight:15 },
    palaeoscincus: { name:'Palaeoscincus', category:'plant', baseAppeal:4, baseValue:280, baseSpeed:2, baseSize:55, emoji:'🦕', image:'images/dinos/Palaeoscincus.png', spawnWeight:16 },
    ankylosaurus: { name:'Ankylosaurus', category:'plant', baseAppeal:5, baseValue:420, baseSpeed:2, baseSize:70, emoji:'🦕', image:'images/dinos/Ankylosaurus.png', spawnWeight:13 },

    apatosaurus: { name:'Apatosaurus', category:'plant', baseAppeal:5, baseValue:420, baseSpeed:2, baseSize:90, emoji:'🦕', image:'images/dinos/Apatosaurus.png', spawnWeight:12 },
    diplodocus: { name:'Diplodocus', category:'plant', baseAppeal:6, baseValue:520, baseSpeed:2, baseSize:95, emoji:'🦕', image:'images/dinos/Diplodocus.png', spawnWeight:10 },
    camarasaurus: { name:'Camarasaurus', category:'plant', baseAppeal:6, baseValue:540, baseSpeed:2, baseSize:85, emoji:'🦕', image:'images/dinos/Camarasaurus.png', spawnWeight:9 },

    styracosaurus: { name:'Styracosaurus', category:'plant', baseAppeal:5, baseValue:480, baseSpeed:3, baseSize:60, emoji:'🦕', image:'images/dinos/Styracosaurus.png', spawnWeight:10 },
    triceratops: { name:'Triceratops', category:'plant', baseAppeal:6, baseValue:600, baseSpeed:3, baseSize:70, emoji:'🦕', image:'images/dinos/Triceratops.png', spawnWeight:8 },
    torosaurus: { name:'Torosaurus', category:'plant', baseAppeal:7, baseValue:650, baseSpeed:3, baseSize:75, emoji:'🦕', image:'images/dinos/Torosaurus.png', spawnWeight:7 },

    parasaurolophus: { name:'Parasaurolophus', category:'plant', baseAppeal:6, baseValue:560, baseSpeed:4, baseSize:65, emoji:'🦕', image:'images/dinos/Parasaurolophus.png', spawnWeight:9 },
    edmontosaurus: { name:'Edmontosaurus', category:'plant', baseAppeal:6, baseValue:580, baseSpeed:4, baseSize:70, emoji:'🦕', image:'images/dinos/Edmontosaurus.png', spawnWeight:8 },
    iguanodon: { name:'Iguanodon', category:'plant', baseAppeal:5, baseValue:500, baseSpeed:4, baseSize:60, emoji:'🦕', image:'images/dinos/Iguanodon.png', spawnWeight:10 },

    shantungosaurus: { name:'Shantungosaurus', category:'plant', baseAppeal:8, baseValue:780, baseSpeed:2, baseSize:85, emoji:'🦕', image:'images/dinos/Shantungosaurus.png', spawnWeight:4 },
    argentinosaurus: { name:'Argentinosaurus', category:'plant', baseAppeal:9, baseValue:900, baseSpeed:1, baseSize:100, emoji:'🦕', image:'images/dinos/Argentinosaurus.png', spawnWeight:3 },
    alamosaurus: { name:'Alamosaurus', category:'plant', baseAppeal:8, baseValue:820, baseSpeed:2, baseSize:90, emoji:'🦕', image:'images/dinos/Alamosaurus.png', spawnWeight:4 },

    // ==================================================
    // 🦖 CARNIVORES (20)
    // ==================================================

    procompsognathus: { name:'Procompsognathus', category:'meat', baseAppeal:1, baseValue:100, baseSpeed:6, baseSize:30, emoji:'🦖', image:'images/dinos/Procompsognathus.png', spawnWeight:26 },
    hallopus: { name:'Hallopus', category:'meat', baseAppeal:2, baseValue:150, baseSpeed:5, baseSize:35, emoji:'🦖', image:'images/dinos/Hallopus.png', spawnWeight:24 },
    coelophysis: { name:'Coelophysis', category:'meat', baseAppeal:2, baseValue:160, baseSpeed:6, baseSize:40, emoji:'🦖', image:'images/dinos/Coelophysis.png', spawnWeight:22 },

    dilophosaurus: { name:'Dilophosaurus', category:'meat', baseAppeal:4, baseValue:360, baseSpeed:5, baseSize:55, emoji:'🦖', image:'images/dinos/Dilophosaurus.png', spawnWeight:14, attack: { type: 'spit', projectileType: 'attack1', cooldown: 2000, damage: 10, speed: 4, range: 400 } },
    ceratosaurus: { name:'Ceratosaurus', category:'meat', baseAppeal:4, baseValue:380, baseSpeed:4, baseSize:60, emoji:'🦖', image:'images/dinos/Ceratosaurus.png', spawnWeight:13 },

    allosaurus: { name:'Allosaurus', category:'meat', baseAppeal:4, baseValue:350, baseSpeed:4, baseSize:65, emoji:'🦖', image:'images/dinos/Allosaurus.png', spawnWeight:14 },
    megalosaurus: { name:'Megalosaurus', category:'meat', baseAppeal:5, baseValue:420, baseSpeed:4, baseSize:70, emoji:'🦖', image:'images/dinos/Megalosaurus.png', spawnWeight:12 },

    carnotaurus: { name:'Carnotaurus', category:'meat', baseAppeal:6, baseValue:620, baseSpeed:6, baseSize:70, emoji:'🦖', image:'images/dinos/Carnotaurus.png', spawnWeight:8 },
    albertosaurus: { name:'Albertosaurus', category:'meat', baseAppeal:6, baseValue:600, baseSpeed:5, baseSize:75, emoji:'🦖', image:'images/dinos/Albertosaurus.png', spawnWeight:8 },

    utahraptor: { name:'Utahraptor', category:'meat', baseAppeal:7, baseValue:680, baseSpeed:6, baseSize:50, emoji:'🦖', image:'images/dinos/Utahraptor.png', spawnWeight:6 },
    acrocanthosaurus: { name:'Acrocanthosaurus', category:'meat', baseAppeal:7, baseValue:720, baseSpeed:5, baseSize:80, emoji:'🦖', image:'images/dinos/Acrocanthosaurus.png', spawnWeight:6 },

    spinosaurus: { name:'Spinosaurus', category:'meat', baseAppeal:8, baseValue:850, baseSpeed:5, baseSize:85, emoji:'🦖', image:'images/dinos/Spinosaurus.png', spawnWeight:4 },
    giganotosaurus: { name:'Giganotosaurus', category:'meat', baseAppeal:8, baseValue:860, baseSpeed:5, baseSize:90, emoji:'🦖', image:'images/dinos/Giganotosaurus.png', spawnWeight:4 },

    tyrannosaurus: { name:'Tyrannosaurus', category:'meat', baseAppeal:9, baseValue:900, baseSpeed:5, baseSize:85, emoji:'🦖', image:'images/dinos/Tyrannosaurus.png', spawnWeight:3 },
    carcharodontosaurus: { name:'Carcharodontosaurus', category:'meat', baseAppeal:9, baseValue:920, baseSpeed:5, baseSize:90, emoji:'🦖', image:'images/dinos/Carcharodontosaurus.png', spawnWeight:3 },

    // ==================================================
    // 🐋 AQUATIC (15)
    // ==================================================

    keichousaurus: { name:'Keichousaurus', category:'aquarium', baseAppeal:1, baseValue:140, baseSpeed:6, baseSize:35, emoji:'🐋', image:'images/dinos/Keichousaurus.png', spawnWeight:24 },
    nothosaurus: { name:'Nothosaurus', category:'aquarium', baseAppeal:2, baseValue:200, baseSpeed:6, baseSize:45, emoji:'🐋', image:'images/dinos/Nothosaurus.png', spawnWeight:20 },

    ichthyosaurus: { name:'Ichthyosaurus', category:'aquarium', baseAppeal:2, baseValue:220, baseSpeed:7, baseSize:50, emoji:'🐋', image:'images/dinos/Ichthyosaurus.png', spawnWeight:18 },
    clidastes: { name:'Clidastes', category:'aquarium', baseAppeal:3, baseValue:260, baseSpeed:6, baseSize:55, emoji:'🐋', image:'images/dinos/Clidastes.png', spawnWeight:16 },

    plesiosaur: { name:'Plesiosaur', category:'aquarium', baseAppeal:5, baseValue:500, baseSpeed:5, baseSize:70, emoji:'🐋', image:'images/dinos/Plesiosaur.png', spawnWeight:10 },
    elasmosaurus: { name:'Elasmosaurus', category:'aquarium', baseAppeal:6, baseValue:580, baseSpeed:4, baseSize:80, emoji:'🐋', image:'images/dinos/Elasmosaurus.png', spawnWeight:9 },

    liopleurodon: { name:'Liopleurodon', category:'aquarium', baseAppeal:7, baseValue:700, baseSpeed:6, baseSize:85, emoji:'🐋', image:'images/dinos/Liopleurodon.png', spawnWeight:6 },
    kronosaurus: { name:'Kronosaurus', category:'aquarium', baseAppeal:8, baseValue:820, baseSpeed:5, baseSize:90, emoji:'🐋', image:'images/dinos/Kronosaurus.png', spawnWeight:5 },

    mosasaur: { name:'Mosasaur', category:'aquarium', baseAppeal:9, baseValue:950, baseSpeed:6, baseSize:95, emoji:'🐋', image:'images/dinos/Mosasaur.png', spawnWeight:3 },

    // ==================================================
    // 🦅 FLYING (15)
    // ==================================================

    eudimorphodon: { name:'Eudimorphodon', category:'flying', baseAppeal:1, baseValue:140, baseSpeed:6, baseSize:30, emoji:'🦅', image:'images/dinos/Eudimorphodon.png', spawnWeight:24 },
    peteinosaurus: { name:'Peteinosaurus', category:'flying', baseAppeal:2, baseValue:170, baseSpeed:6, baseSize:32, emoji:'🦅', image:'images/dinos/Peteinosaurus.png', spawnWeight:22 },
    anurognathus: { name:'Anurognathus', category:'flying', baseAppeal:2, baseValue:180, baseSpeed:7, baseSize:28, emoji:'🦅', image:'images/dinos/Anurognathus.png', spawnWeight:21 },

    dimorphodon: { name:'Dimorphodon', category:'flying', baseAppeal:3, baseValue:260, baseSpeed:6, baseSize:40, emoji:'🦅', image:'images/dinos/Dimorphodon.png', spawnWeight:16 },
    rhamphorhynchus: { name:'Rhamphorhynchus', category:'flying', baseAppeal:4, baseValue:350, baseSpeed:6, baseSize:45, emoji:'🦅', image:'images/dinos/Rhamphorhynchus.png', spawnWeight:14 },

    pteranodon: { name:'Pteranodon', category:'flying', baseAppeal:5, baseValue:480, baseSpeed:6, baseSize:60, emoji:'🦅', image:'images/dinos/Pteranodon.png', spawnWeight:10 },
    tapejara: { name:'Tapejara', category:'flying', baseAppeal:5, baseValue:460, baseSpeed:5, baseSize:55, emoji:'🦅', image:'images/dinos/Tapejara.png', spawnWeight:10 },

    nyctosaurus: { name:'Nyctosaurus', category:'flying', baseAppeal:6, baseValue:540, baseSpeed:7, baseSize:50, emoji:'🦅', image:'images/dinos/Nyctosaurus.png', spawnWeight:8 },
    dsungaripterus: { name:'Dsungaripterus', category:'flying', baseAppeal:6, baseValue:560, baseSpeed:5, baseSize:55, emoji:'🦅', image:'images/dinos/Dsungaripterus.png', spawnWeight:7 },

    quetzalcoatlus: { name:'Quetzalcoatlus', category:'flying', baseAppeal:9, baseValue:1000, baseSpeed:5, baseSize:75, emoji:'🦅', image:'images/dinos/Quetzalcoatlus.png', spawnWeight:3 },
    hatzegopteryx: { name:'Hatzegopteryx', category:'flying', baseAppeal:10, baseValue:1100, baseSpeed:5, baseSize:80, emoji:'🦅', image:'images/dinos/Hatzegopteryx.png', spawnWeight:2 }

},
    
    // Rarity System - Applies to all dinosaur species
    RARITY: {
        common: {
            name: 'Common',
            multiplier: 1.0,      // No change
            appealBonus: 0,
            valueMultiplier: 1.0,
            spawnWeight: 50,      // 50% chance
            color: '#9E9E9E'      // Gray
        },
        rare: {
            name: 'Rare',
            multiplier: 1.5,      // +50% stats
            appealBonus: 2,
            valueMultiplier: 1.8,
            spawnWeight: 30,      // 30% chance
            color: '#2196F3'      // Blue
        },
        epic: {
            name: 'Epic',
            multiplier: 2.0,      // +100% stats
            appealBonus: 5,
            valueMultiplier: 3.0,
            spawnWeight: 15,      // 15% chance
            color: '#9C27B0'      // Purple
        },
        legendary: {
            name: 'Legendary',
            multiplier: 3.0,      // +200% stats
            appealBonus: 10,
            valueMultiplier: 5.0,
            spawnWeight: 5,       // 5% chance
            color: '#FFD700'      // Gold
        }
    },
    
    // Exhibit Types
    EXHIBIT_TYPES: {
        meat: {
            name: 'Carnivore Exhibit',
            icon: '🥩',
            description: 'House meat-eating dinosaurs',
            allowedCategories: ['meat'],
            unlockCost: 1000,  // Cost to unlock this exhibit type
            unlocked: false     // Starts locked
        },
        plant: {
            name: 'Herbivore Exhibit',
            icon: '🌿',
            description: 'House plant-eating dinosaurs',
            allowedCategories: ['plant'],
            unlockCost: 0,      // Free - starting exhibit
            unlocked: true      // Starts unlocked
        },
        aquarium: {
            name: 'Aquatic Exhibit',
            icon: '🌊',
            description: 'House aquatic dinosaurs',
            allowedCategories: ['aquarium'],
            unlockCost: 1500,   // Cost to unlock this exhibit type
            unlocked: false     // Starts locked
        },
        aviary: {
            name: 'Aviary',
            icon: '🦅',
            description: 'House flying dinosaurs',
            allowedCategories: ['flying'],
            unlockCost: 1200,   // Cost to unlock this exhibit type
            unlocked: false     // Starts locked
        }
    },
    
    // Image settings
    IMAGES: {
        // Dinosaur image sizes (for canvas rendering)
        DINO_SIZE_SMALL: 64,   // For exhibit displays
        DINO_SIZE_MEDIUM: 128, // Default hunting canvas
        DINO_SIZE_LARGE: 256,  // Large displays
        // Preload all images on game start
        PRELOAD_IMAGES: true
    },
    
    // Hunting Game
    HUNTING: {
        // Player
        PLAYER_SIZE: 30, // Player size (radius)
        // Dinosaur spawn
        DINO_BASE_SIZE: 50,
        DINO_SIZE_PER_SPEED: 5,
        DINO_BASE_HEALTH: 100,
        DINO_BASE_SPEED: 0.5, // Reduced initial speed
        // Difficulty Scaling (based on upgrade spending)
        DIFFICULTY: {
            // Base spending thresholds (in dollars)
            BASE_THRESHOLD: 10000, // First difficulty increase at $10K spent
            THRESHOLD_MULTIPLIER: 2.5, // Each threshold is 2.5x the previous
            // Multiplier growth per threshold
            HEALTH_MULTIPLIER_PER_THRESHOLD: 0.15, // +15% health per threshold
            SPEED_MULTIPLIER_PER_THRESHOLD: 0.10, // +10% speed per threshold
            SIZE_MULTIPLIER_PER_THRESHOLD: 0.08, // +8% size per threshold
            // Maximum multipliers (caps to prevent impossible difficulty)
            MAX_HEALTH_MULTIPLIER: 3.0, // Max 3x health
            MAX_SPEED_MULTIPLIER: 2.5, // Max 2.5x speed
            MAX_SIZE_MULTIPLIER: 2.0, // Max 2x size
            // Multiple dinosaur milestones (spending thresholds)
            MULTI_DINO_MILESTONES: [
                50000,   // 2 dinos at $50K spent
                200000,  // 3 dinos at $200K spent
                750000,  // 4 dinos at $750K spent
                2500000, // 5 dinos at $2.5M spent
                10000000 // 6 dinos at $10M spent
            ]
        },
        DINO_DIRECTION_CHANGE_CHANCE: 0.02, // 2% per frame
        DINO_FLEE_SPEED_MULTIPLIER: 2.0, // Speed multiplier when fleeing/chasing
        CARNIVORE_CHASE_SPEED_MULTIPLIER: 1.0, // Slower chase speed for carnivores (same as base speed)
        CARNIVORE_ATTACK_RANGE: 60, // Distance at which carnivore attacks
        CARNIVORE_ATTACK_DAMAGE: 10, // Damage per attack
        CARNIVORE_ATTACK_COOLDOWN: 60, // Frames between attacks
        CARNIVORE_RETREAT_DISTANCE: 100, // Distance to retreat after attack
        
        // Canvas settings
        CANVAS_WIDTH: 1200,
        CANVAS_HEIGHT: 700,
        
        // Hunt timer settings
        HUNT_DURATION_BASE_SECONDS: 180, // Base hunt duration (3 minutes) - beginner friendly
        HUNT_DURATION_REDUCTION_PER_THRESHOLD: 15, // Reduce by 15 seconds per difficulty threshold
        HUNT_DURATION_MIN_SECONDS: 60, // Minimum hunt duration (1 minute) - never go below this
        
        // Vision cone settings
        DINO_VISION_RANGE: 200,
        DINO_VISION_ANGLE: Math.PI / 3, // 60 degrees
        
        // Player starting position (left side of canvas)
        PLAYER_START_X: 200,
        PLAYER_START_Y: 350,
        
        // Player settings
        PLAYER_MAX_HEALTH: 100,
        PLAYER_DAMAGE_COOLDOWN: 60, // Frames between taking damage
        
        // Sell price multiplier (40% of base value - more rewarding early game)
        SELL_PRICE_MULTIPLIER: 0.4,
        
        // Environment settings
        ENVIRONMENT: {
            // Number of bushes/trees to spawn per hunt (sparingly placed)
            BUSH_COUNT: 8,
            TREE_COUNT: 4,
            // Safe zone radius (how close player needs to be to bush to hide)
            BUSH_SAFE_RADIUS: 40,
            // Minimum distance between environment objects
            MIN_DISTANCE_BETWEEN: 100,
            // Minimum distance from player spawn
            MIN_DISTANCE_FROM_PLAYER: 150,
            // Minimum distance from center (dino spawn)
            MIN_DISTANCE_FROM_CENTER: 150
        }
    },
    
    // Weapon System
    WEAPONS: {
        pistol: {
            name: 'Pistol',
            icon: '🔫',
            image: 'images/player/pistol.png',
            // Starting stats
            damage: 10,
            accuracy: 70, // percentage
            reloadSpeed: 2.0, // seconds
            range: 300, // pixels
            clipSize: 7, // rounds
            fireRate: 0, // 0 = single shot only (no rapid fire)
            bulletSpeed: 10, // Default bullet speed
            purchaseCost: 0, // Free - starting weapon
            unlocked: true, // Starts unlocked
            // Upgrade configs
            upgrades: {
                damage: {
                    baseCost: 500,
                    costMultiplier: 2.0,
                    value: 5, // +5 damage per upgrade
                    max: Infinity
                },
                accuracy: {
                    baseCost: 400,
                    costMultiplier: 1.9,
                    value: 3, // +3% per upgrade
                    max: 100 // percentage max
                },
                reloadSpeed: {
                    baseCost: 600,
                    costMultiplier: 2.1,
                    value: 0.2, // -0.2s per upgrade
                    min: 0.5 // minimum reload speed (slower than other weapons)
                },
                range: {
                    baseCost: 450,
                    costMultiplier: 1.8,
                    value: 25, // +25px per upgrade
                    max: Infinity
                },
                clipSize: {
                    baseCost: 300,
                    costMultiplier: 1.7,
                    value: 1, // +1 round per upgrade
                    max: 15 // max clip size
                }
            }
        },
        shotgun: {
            name: 'Shotgun',
            icon: '💥',
            image: 'images/player/shotgun.png',
            damage: 25, // High damage
            accuracy: 40, // Low accuracy (spread shot)
            reloadSpeed: 3.0, // Slow reload
            range: 200, // Short range
            clipSize: 3, // Small clip
            fireRate: 0, // Single shot
            spread: true, // Spread fire mechanic
            spreadCount: 5, // Number of pellets
            spreadAngle: 0.4, // Spread angle in radians (~23 degrees)
            bulletSpeed: 10, // Default bullet speed
            purchaseCost: 2000,
            unlocked: false,
            upgrades: {
                damage: {
                    baseCost: 800,
                    costMultiplier: 2.2,
                    value: 8, // +8 damage per upgrade
                    max: Infinity
                },
                accuracy: {
                    baseCost: 600,
                    costMultiplier: 2.0,
                    value: 2, // +2% per upgrade (lower than other weapons)
                    max: 70 // Lower max accuracy
                },
                reloadSpeed: {
                    baseCost: 700,
                    costMultiplier: 2.2,
                    value: 0.3, // -0.3s per upgrade
                    min: 1.5 // Minimum reload speed
                },
                range: {
                    baseCost: 500,
                    costMultiplier: 1.9,
                    value: 20, // +20px per upgrade
                    max: 400 // Max range (shorter than other weapons)
                },
                clipSize: {
                    baseCost: 400,
                    costMultiplier: 1.8,
                    value: 1, // +1 round per upgrade
                    max: 6 // Max clip size
                }
            }
        },
        rifle: {
            name: 'Rifle',
            icon: '🎯',
            image: 'images/player/rifle.png',
            damage: 15, // Medium damage
            accuracy: 85, // High accuracy
            reloadSpeed: 2.5, // Medium reload
            range: 450, // Long range
            clipSize: 12, // Medium clip
            fireRate: 0, // Single shot
            bulletSpeed: 11, // Slightly faster than default
            purchaseCost: 3000,
            unlocked: false,
            upgrades: {
                damage: {
                    baseCost: 600,
                    costMultiplier: 2.1,
                    value: 6, // +6 damage per upgrade
                    max: Infinity
                },
                accuracy: {
                    baseCost: 450,
                    costMultiplier: 1.9,
                    value: 3, // +3% per upgrade
                    max: 100
                },
                reloadSpeed: {
                    baseCost: 650,
                    costMultiplier: 2.1,
                    value: 0.25, // -0.25s per upgrade
                    min: 0.3
                },
                range: {
                    baseCost: 500,
                    costMultiplier: 1.8,
                    value: 30, // +30px per upgrade
                    max: Infinity
                },
                clipSize: {
                    baseCost: 350,
                    costMultiplier: 1.7,
                    value: 2, // +2 rounds per upgrade
                    max: 20
                }
            }
        },
        assaultRifle: {
            name: 'Assault Rifle',
            icon: '⚔️',
            image: 'images/player/assault.png',
            damage: 12, // Medium damage
            accuracy: 65, // Medium accuracy
            reloadSpeed: 1.5, // Fast reload
            range: 350, // Medium range
            clipSize: 25, // Large clip
            fireRate: 15, // 15 rounds per second max (rapid fire with cap) - increased from 10 for better feel
            redDot: true, // Has red dot sight
            bulletSpeed: 12, // Slightly faster for rapid fire feel
            purchaseCost: 4000,
            unlocked: false,
            upgrades: {
                damage: {
                    baseCost: 550,
                    costMultiplier: 2.0,
                    value: 4, // +4 damage per upgrade
                    max: Infinity
                },
                accuracy: {
                    baseCost: 400,
                    costMultiplier: 1.9,
                    value: 3, // +3% per upgrade
                    max: 85 // Lower max accuracy (rapid fire tradeoff)
                },
                reloadSpeed: {
                    baseCost: 600,
                    costMultiplier: 2.0,
                    value: 0.15, // -0.15s per upgrade
                    min: 0.3 // Minimum reload speed
                },
                range: {
                    baseCost: 450,
                    costMultiplier: 1.8,
                    value: 25, // +25px per upgrade
                    max: Infinity
                },
                clipSize: {
                    baseCost: 300,
                    costMultiplier: 1.7,
                    value: 3, // +3 rounds per upgrade
                    max: 40
                },
                fireRate: {
                    baseCost: 500,
                    costMultiplier: 2.0,
                    value: 1, // +1 round per second per upgrade
                    max: 15 // Max 15 rounds per second
                }
            }
        },
        sniperRifle: {
            name: 'Sniper Rifle',
            icon: '🎖️',
            image: 'images/player/sniper.png',
            damage: 35, // Very high damage
            accuracy: 100, // Perfect accuracy
            reloadSpeed: 0.5, // Fast reload (shots are fast)
            range: 800, // Extreme range
            clipSize: 2, // Tiny clip
            fireRate: 0, // Single shot
            zoom: true, // Has zoom mechanic
            zoomLevel: 3.0, // 3x zoom
            proximityHit: true, // Proximity hit detection
            proximityRadius: 30, // Hit if dino is within 30px of aim point
            bulletSpeed: 25, // Very fast projectiles
            purchaseCost: 5000,
            unlocked: false,
            upgrades: {
                damage: {
                    baseCost: 1000,
                    costMultiplier: 2.5,
                    value: 10, // +10 damage per upgrade
                    max: Infinity
                },
                accuracy: {
                    baseCost: 0, // Already at 100%, no upgrades
                    costMultiplier: 1.0,
                    value: 0,
                    max: 100
                },
                reloadSpeed: {
                    baseCost: 800,
                    costMultiplier: 2.3,
                    value: 0.1, // -0.1s per upgrade (already fast)
                    min: 0.2 // Minimum reload speed (very fast)
                },
                range: {
                    baseCost: 700,
                    costMultiplier: 2.0,
                    value: 50, // +50px per upgrade
                    max: Infinity
                },
                clipSize: {
                    baseCost: 600,
                    costMultiplier: 2.0,
                    value: 1, // +1 round per upgrade
                    max: 5 // Max clip size (still small)
                }
            }
        },
        gasGrenade: {
            name: 'Gas Grenade',
            icon: '💨',
            image: 'images/player/grenade.png',
            damage: 5, // Low damage per tick
            accuracy: 100, // Always hits target area
            reloadSpeed: 2.0, // Medium reload
            range: 400, // Medium range
            clipSize: 3, // Small clip
            fireRate: 0, // Single shot
            isGrenade: true, // Special weapon type
            aoeRadius: 80, // Area of effect radius
            aoeDuration: 5000, // Duration in ms (5 seconds)
            aoeTickRate: 200, // Damage tick every 200ms
            bulletSpeed: 10, // Default speed (not used for grenades, but for consistency)
            purchaseCost: 8000, // Most expensive - most unique weapon
            unlocked: false,
            upgrades: {
                damage: {
                    baseCost: 700,
                    costMultiplier: 2.0,
                    value: 2, // +2 damage per tick per upgrade
                    max: Infinity
                },
                accuracy: {
                    baseCost: 0, // Always 100%
                    costMultiplier: 1.0,
                    value: 0,
                    max: 100
                },
                reloadSpeed: {
                    baseCost: 600,
                    costMultiplier: 2.0,
                    value: 0.2, // -0.2s per upgrade
                    min: 0.5
                },
                range: {
                    baseCost: 500,
                    costMultiplier: 1.8,
                    value: 30, // +30px per upgrade
                    max: Infinity
                },
                clipSize: {
                    baseCost: 500,
                    costMultiplier: 1.8,
                    value: 1, // +1 grenade per upgrade
                    max: 6
                },
                aoeRadius: {
                    baseCost: 600,
                    costMultiplier: 2.0,
                    value: 10, // +10px radius per upgrade
                    max: 150
                },
                aoeDuration: {
                    baseCost: 800,
                    costMultiplier: 2.1,
                    value: 500, // +500ms duration per upgrade
                    max: 10000 // Max 10 seconds
                }
            }
        }
    },
    
    // Legacy Gun config (kept for backward compatibility during migration)
    GUN: {
        // Starting stats
        STARTING_DAMAGE: 10,
        STARTING_ACCURACY: 70, // percentage
        STARTING_RELOAD_SPEED: 2.0, // seconds
        STARTING_RANGE: 300, // pixels
        
        // Upgrade costs and values (steeper scaling to prevent easy maxing)
        UPGRADES: {
            damage: {
                baseCost: 500, // Increased base cost
                costMultiplier: 2.0, // Steeper exponential scaling
                value: 5, // +5 damage per upgrade
                max: Infinity
            },
            accuracy: {
                baseCost: 400, // Increased base cost
                costMultiplier: 1.9,
                value: 3, // +3% per upgrade (reduced from 10%)
                max: 100 // percentage max
            },
            reloadSpeed: {
                baseCost: 600, // Increased base cost
                costMultiplier: 2.1,
                value: 0.2, // -0.2s per upgrade
                min: 0.2 // minimum reload speed
            },
            range: {
                baseCost: 450, // Increased base cost
                costMultiplier: 1.8,
                value: 25, // +25px per upgrade (reduced from 50px)
                max: Infinity
            }
        },
        
        // Bullet settings
        BULLET_SPEED: 10,
        BULLET_SIZE: 5,
        MAX_BULLETS: 100, // Maximum bullets in flight to prevent performance issues
        MISS_ANGLE_OFFSET: 0.3, // radians when accuracy check fails
        
        // Dart sprite settings
        DART_SIZE: 20, // Size of dart sprite (larger than bullet for visibility)
        DART_GLOW_SIZE: 30, // Size of glow effect around dart
        DART_GLOW_INTENSITY: 0.4, // Glow opacity (0-1)
        DART_TRACER_LENGTH: 8, // Number of previous positions to draw for tracer effect
        DART_TRACER_OPACITY: 0.3 // Tracer trail opacity
    },
    
    // Character Upgrades
    CHARACTER: {
        // Starting stats
        STARTING_HEALTH: 100,
        STARTING_SPEED: 1.0,
        STARTING_STEALTH: 50, // percentage
        
        // Upgrade costs and values (steeper scaling to prevent easy maxing)
        UPGRADES: {
            health: {
                baseCost: 350, // Increased base cost
                costMultiplier: 1.9,
                value: 20, // +20 health per upgrade
                max: Infinity
            },
            speed: {
                baseCost: 500, // Increased base cost
                costMultiplier: 2.0,
                value: 0.1, // +0.1x per upgrade
                max: Infinity
            },
            stealth: {
                baseCost: 400, // Increased base cost
                costMultiplier: 1.8,
                value: 10, // +10% per upgrade
                max: 100 // percentage max
            }
        }
    },
    
    // Game Loop
    GAME_LOOP: {
        UPDATE_INTERVAL: 1000, // milliseconds (1 second)
        INCOME_CALCULATION_INTERVAL: 60, // income is per minute, divide by this
        INACTIVE_INCOME_TIMEOUT: 30 * 60 * 1000 // 30 minutes in milliseconds - income stops after this
    },
    
    // UI/Notifications
    UI: {
        NOTIFICATION_DURATION: 3000 // milliseconds
    },
    
    // Debug Configuration
    DEBUG: {
        ENABLED: true, // Master switch for all debug features
        LEVEL: 'normal', // 'minimal' | 'normal' | 'verbose' | 'extreme'
        LOG_FRAMES: false, // Log every frame (very verbose)
        LOG_SLOW_FRAMES: true, // Log frames exceeding threshold
        LOG_FUNCTIONS: false, // Log function entry/exit for critical functions (disabled by default to reduce noise)
        FREEZE_DETECTION: true, // Auto-detect and log freezes
        PERFORMANCE_THRESHOLD: 20, // Log frames exceeding this time (ms)
        FREEZE_THRESHOLD: 100, // Consider freeze if frame exceeds this (ms)
        STATE_VALIDATION: false, // Validate state for invalid data (disabled by default - was causing stack overflow)
        RESOURCE_TRACKING: true, // Track resource usage
        MAX_RECENT_OPERATIONS: 50, // Number of recent operations to track
        MAX_FRAME_HISTORY: 100 // Number of frames to keep in history
    }
};
