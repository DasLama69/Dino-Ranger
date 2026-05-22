// ============================================
// GAME STATE MANAGEMENT
// ============================================

const GameState = {
    state: {
        money: GameConfig.STARTING_MONEY,
        visitors: 0,
        exhibits: [],
        capturedDinos: [],
        unlockedExhibitTypes: {
            plant: true,   // Starting exhibit - unlocked
            meat: false,   // Locked - must unlock
            aquarium: false, // Locked - must unlock
            aviary: false   // Locked - must unlock
        },
        // Weapon system
        weapons: {}, // Will be initialized with weapon stats
        currentWeapon: 'pistol', // Default starting weapon
        unlockedWeapons: ['pistol'], // Pistol starts unlocked
        // Legacy gun (for backward compatibility during migration)
        gun: {
            damage: GameConfig.GUN.STARTING_DAMAGE,
            accuracy: GameConfig.GUN.STARTING_ACCURACY,
            reloadSpeed: GameConfig.GUN.STARTING_RELOAD_SPEED,
            range: GameConfig.GUN.STARTING_RANGE
        },
        character: {
            health: GameConfig.CHARACTER.STARTING_HEALTH,
            speed: GameConfig.CHARACTER.STARTING_SPEED,
            stealth: GameConfig.CHARACTER.STARTING_STEALTH
        },
        totalUpgradeSpending: 0 // Track total money spent on upgrades for difficulty scaling
    },
    
    // Initialize weapon stats from config
    initializeWeapons() {
        if (!this.state.weapons || Object.keys(this.state.weapons).length === 0) {
            this.state.weapons = {};
            // Initialize all weapons from config
            Object.keys(GameConfig.WEAPONS).forEach(weaponId => {
                const weaponConfig = GameConfig.WEAPONS[weaponId];
                this.state.weapons[weaponId] = {
                    damage: weaponConfig.damage,
                    accuracy: weaponConfig.accuracy,
                    reloadSpeed: weaponConfig.reloadSpeed,
                    range: weaponConfig.range,
                    clipSize: weaponConfig.clipSize,
                    fireRate: weaponConfig.fireRate
                };
            });
        }
    },
    
    // Migrate old gun state to new weapons system
    migrateGunToWeapons() {
        // If weapons system is already initialized, skip migration
        if (this.state.weapons && Object.keys(this.state.weapons).length > 0) {
            return;
        }
        
        // If old gun state exists, migrate it to pistol
        if (this.state.gun && this.state.gun.damage !== undefined) {
            // Initialize weapons first
            this.initializeWeapons();
            
            // Migrate old gun stats to pistol
            if (this.state.weapons.pistol) {
                this.state.weapons.pistol.damage = this.state.gun.damage;
                this.state.weapons.pistol.accuracy = this.state.gun.accuracy;
                this.state.weapons.pistol.reloadSpeed = this.state.gun.reloadSpeed;
                this.state.weapons.pistol.range = this.state.gun.range;
            }
            
            // Ensure pistol is unlocked and current
            if (!this.state.unlockedWeapons) {
                this.state.unlockedWeapons = ['pistol'];
            } else if (!this.state.unlockedWeapons.includes('pistol')) {
                this.state.unlockedWeapons.push('pistol');
            }
            this.state.currentWeapon = 'pistol';
        } else {
            // No old gun state, just initialize weapons
            this.initializeWeapons();
        }
    },

    // Get current state
    get() {
        return this.state;
    },

    // Clean up duplicate exhibits (keep first of each type, remove duplicates)
    cleanupDuplicateExhibits() {
        const seenTypes = new Set();
        const uniqueExhibits = [];
        
        this.state.exhibits.forEach(exhibit => {
            if (!seenTypes.has(exhibit.type)) {
                seenTypes.add(exhibit.type);
                uniqueExhibits.push(exhibit);
            }
        });
        
        if (uniqueExhibits.length !== this.state.exhibits.length) {
            this.state.exhibits = uniqueExhibits;
            // Reassign IDs
            this.state.exhibits.forEach((exhibit, idx) => {
                exhibit.id = idx;
            });
            this.save();
            return true; // Duplicates were removed
        }
        return false; // No duplicates found
    },

    // Validate and fix incorrectly placed dinosaurs in exhibits
    validateDinoPlacements() {
        const state = this.state;
        let movedCount = 0;
        let removedCount = 0;
        const movedDinos = [];
        const removedDinos = [];
        
        // Check each exhibit
        state.exhibits.forEach((exhibit, exhibitIdx) => {
            const exhibitType = GameConfig.EXHIBIT_TYPES[exhibit.type];
            if (!exhibitType) return; // Skip if exhibit type doesn't exist
            
            // Check each dinosaur in the exhibit
            const dinosToRemove = [];
            exhibit.dinos.forEach((dino, dinoIdx) => {
                const dinoSpecies = GameConfig.DINOSAUR_SPECIES[dino.species];
                if (!dinoSpecies) {
                    // Dinosaur species doesn't exist - remove it
                    dinosToRemove.push(dinoIdx);
                    removedDinos.push({ species: dino.species, reason: 'Species not found' });
                    removedCount++;
                    return;
                }
                
                // Check if dinosaur category matches exhibit type
                if (!exhibitType.allowedCategories.includes(dinoSpecies.category)) {
                    // Dinosaur is in wrong exhibit - try to find correct exhibit
                    const correctExhibitIdx = state.exhibits.findIndex(e => {
                        const eType = GameConfig.EXHIBIT_TYPES[e.type];
                        return eType && eType.allowedCategories.includes(dinoSpecies.category);
                    });
                    
                    if (correctExhibitIdx !== -1) {
                        // Found correct exhibit - move dinosaur there
                        const correctExhibit = state.exhibits[correctExhibitIdx];
                        dinosToRemove.push(dinoIdx);
                        correctExhibit.dinos.push(dino);
                        movedDinos.push({ 
                            species: dinoSpecies.name, 
                            from: exhibitType.name, 
                            to: GameConfig.EXHIBIT_TYPES[correctExhibit.type].name 
                        });
                        movedCount++;
                    } else {
                        // No correct exhibit found - remove dinosaur
                        dinosToRemove.push(dinoIdx);
                        removedDinos.push({ 
                            species: dinoSpecies.name, 
                            reason: `No ${dinoSpecies.category} exhibit available` 
                        });
                        removedCount++;
                    }
                }
            });
            
            // Remove incorrectly placed dinosaurs (in reverse order to maintain indices)
            dinosToRemove.reverse().forEach(idx => {
                exhibit.dinos.splice(idx, 1);
            });
        });
        
        if (movedCount > 0 || removedCount > 0) {
            this.save();
            return {
                moved: movedCount,
                removed: removedCount,
                movedDinos: movedDinos,
                removedDinos: removedDinos
            };
        }
        
        return null; // No issues found
    },

    // Initialize starting state
    init() {
        // Clean up any duplicate exhibits first (for existing saves)
        this.cleanupDuplicateExhibits();
        
        // Migrate gun to weapons system (handles both new and old saves)
        this.migrateGunToWeapons();
        
        // Start with only herbivore (plant) exhibit and one basic herbivore
        // Carnivore, Marine, and Aviary exhibits must be unlocked
        if (this.state.exhibits.length === 0) {
            // Plant Exhibit (Herbivores) - Starting exhibit with one basic herbivore
            // Start with a common Stegosaurus as the beginner dinosaur
            this.state.exhibits.push({
                id: 0,
                type: 'plant',
                level: 1,
                dinos: [{
                    species: 'stegosaurus',
                    rarity: 'common',
                    level: 1,
                    appeal: GameConfig.DINOSAUR_SPECIES.stegosaurus.baseAppeal + GameConfig.RARITY.common.appealBonus
                }]
            });
        }
    },

    // Current active profile (1, 2, or 3)
    currentProfile: 1,

    // Get current profile
    getCurrentProfile() {
        const profileKey = localStorage.getItem('dinosaurRangerCurrentProfile');
        if (profileKey && ['1', '2', '3', '4'].includes(profileKey)) {
            this.currentProfile = parseInt(profileKey);
        } else {
            this.currentProfile = 1;
            localStorage.setItem('dinosaurRangerCurrentProfile', '1');
        }
        return this.currentProfile;
    },

    // Set current profile
    setCurrentProfile(profileNum) {
        if (profileNum >= 1 && profileNum <= 4) {
            // Save current state before switching
            this.save();
            this.currentProfile = profileNum;
            localStorage.setItem('dinosaurRangerCurrentProfile', profileNum.toString());
            // Load the new profile
            this.load();
            return true;
        }
        return false;
    },

    // Save game to localStorage for current profile
    save() {
        const profileKey = `dinosaurRangerSave_${this.currentProfile}`;
        localStorage.setItem(profileKey, JSON.stringify(this.state));
    },

    // Load game from localStorage for current profile
    load() {
        const profileKey = `dinosaurRangerSave_${this.currentProfile}`;
        const save = localStorage.getItem(profileKey);
        if (save) {
            const loadedState = JSON.parse(save);
            // Merge with defaults to ensure all properties exist
            this.state = {
                ...this.state,
                ...loadedState,
                gun: { ...this.state.gun, ...(loadedState.gun || {}) },
                character: { ...this.state.character, ...loadedState.character },
                unlockedExhibitTypes: { 
                    ...this.state.unlockedExhibitTypes, 
                    ...(loadedState.unlockedExhibitTypes || {}),
                    // Ensure aviary is in the unlock state (for existing saves)
                    aviary: loadedState.unlockedExhibitTypes?.aviary || false
                },
                // Initialize weapons if not present
                weapons: loadedState.weapons || {},
                currentWeapon: loadedState.currentWeapon || 'pistol',
                unlockedWeapons: loadedState.unlockedWeapons || ['pistol']
            };
            // Migrate old gun state to weapons if needed
            this.migrateGunToWeapons();
            return true;
        }
        return false;
    },

    // Check if a profile has save data
    hasProfileData(profileNum) {
        if (profileNum >= 1 && profileNum <= 4) {
            const profileKey = `dinosaurRangerSave_${profileNum}`;
            return localStorage.getItem(profileKey) !== null;
        }
        return false;
    },

    // Get profile name (returns custom name or default "Profile X")
    getProfileName(profileNum) {
        if (profileNum >= 1 && profileNum <= 4) {
            const nameKey = `dinosaurRangerProfileName_${profileNum}`;
            const customName = localStorage.getItem(nameKey);
            return customName || `Profile ${profileNum}`;
        }
        return `Profile ${profileNum}`;
    },

    // Set profile name
    setProfileName(profileNum, newName) {
        if (profileNum >= 1 && profileNum <= 4) {
            // Trim and validate name
            newName = newName.trim();
            if (newName.length === 0) {
                // If empty, remove custom name (use default)
                localStorage.removeItem(`dinosaurRangerProfileName_${profileNum}`);
                return true;
            }
            if (newName.length > 20) {
                // Limit name length
                newName = newName.substring(0, 20);
            }
            localStorage.setItem(`dinosaurRangerProfileName_${profileNum}`, newName);
            return true;
        }
        return false;
    },

    // Reset game state
    reset() {
        this.state = {
            money: GameConfig.STARTING_MONEY,
            visitors: 0,
            exhibits: [],
            capturedDinos: [],
            unlockedExhibitTypes: {
                plant: true,
                meat: false,
                aquarium: false,
                aviary: false
            },
            weapons: {},
            currentWeapon: 'pistol',
            unlockedWeapons: ['pistol'],
            gun: {
                damage: GameConfig.GUN.STARTING_DAMAGE,
                accuracy: GameConfig.GUN.STARTING_ACCURACY,
                reloadSpeed: GameConfig.GUN.STARTING_RELOAD_SPEED,
                range: GameConfig.GUN.STARTING_RANGE
            },
            character: {
                health: GameConfig.CHARACTER.STARTING_HEALTH,
                speed: GameConfig.CHARACTER.STARTING_SPEED,
                stealth: GameConfig.CHARACTER.STARTING_STEALTH
            },
            totalUpgradeSpending: 0
        };
        this.init();
    }
};
