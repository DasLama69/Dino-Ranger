// ============================================
// UPGRADE SYSTEM
// ============================================

// Format money with K, M, B, T abbreviations (no decimals)
function formatMoney(amount) {
    if (amount >= 1e12) {
        // Trillions
        return (amount / 1e12).toFixed(0) + 'T';
    } else if (amount >= 1e9) {
        // Billions
        return (amount / 1e9).toFixed(0) + 'B';
    } else if (amount >= 1e6) {
        // Millions
        return (amount / 1e6).toFixed(0) + 'M';
    } else if (amount >= 1000) {
        // Thousands
        return (amount / 1000).toFixed(0) + 'K';
    }
    // Less than 1000 - show as integer
    return Math.floor(amount).toString();
}

const Upgrades = {
    // Calculate upgrade cost for a weapon stat
    getWeaponUpgradeCost(weaponId, stat) {
        const state = GameState.get();
        const weaponConfig = GameConfig.WEAPONS[weaponId];
        
        if (!weaponConfig || !weaponConfig.upgrades || !weaponConfig.upgrades[stat]) {
            return Infinity;
        }
        
        const upgradeConfig = weaponConfig.upgrades[stat];
        const weapon = state.weapons[weaponId];
        
        if (!weapon) return Infinity;
        
        // Get starting value from weapon config
        const startingValue = weaponConfig[stat];
        const currentValue = weapon[stat];
        
        // Calculate level based on value difference
        let level = 0;
        if (stat === 'reloadSpeed') {
            // For reloadSpeed, higher starting means more upgrades
            level = Math.floor((startingValue - currentValue) / upgradeConfig.value);
        } else if (stat === 'clipSize') {
            level = Math.floor((currentValue - startingValue) / upgradeConfig.value);
        } else if (stat === 'fireRate') {
            level = Math.floor((currentValue - startingValue) / upgradeConfig.value);
        } else {
            level = Math.floor((currentValue - startingValue) / upgradeConfig.value);
        }
        
        // Calculate cost: baseCost * (multiplier ^ level)
        const cost = Math.floor(upgradeConfig.baseCost * Math.pow(upgradeConfig.costMultiplier, level));
        return cost;
    },
    
    // Calculate upgrade cost based on level (legacy support)
    getUpgradeCost(stat, category = 'gun') {
        const state = GameState.get();
        const upgradeConfig = category === 'gun' 
            ? GameConfig.GUN.UPGRADES[stat] 
            : GameConfig.CHARACTER.UPGRADES[stat];
        
        if (!upgradeConfig) return Infinity;
        
        // Calculate current upgrade level
        const startingValue = category === 'gun'
            ? (stat === 'damage' ? GameConfig.GUN.STARTING_DAMAGE :
               stat === 'accuracy' ? GameConfig.GUN.STARTING_ACCURACY :
               stat === 'reloadSpeed' ? GameConfig.GUN.STARTING_RELOAD_SPEED :
               GameConfig.GUN.STARTING_RANGE)
            : (stat === 'health' ? GameConfig.CHARACTER.STARTING_HEALTH :
               stat === 'speed' ? GameConfig.CHARACTER.STARTING_SPEED :
               GameConfig.CHARACTER.STARTING_STEALTH);
        
        const currentValue = category === 'gun' 
            ? state.gun[stat] 
            : state.character[stat];
        
        // Calculate level based on value difference
        let level = 0;
        if (stat === 'reloadSpeed') {
            // For reloadSpeed, higher starting means more upgrades
            level = Math.floor((GameConfig.GUN.STARTING_RELOAD_SPEED - currentValue) / upgradeConfig.value);
        } else {
            level = Math.floor((currentValue - startingValue) / upgradeConfig.value);
        }
        
        // Calculate cost: baseCost * (multiplier ^ level)
        const cost = Math.floor(upgradeConfig.baseCost * Math.pow(upgradeConfig.costMultiplier, level));
        return cost;
    },

    // Upgrade weapon stat
    upgradeWeapon(weaponId, stat) {
        const state = GameState.get();
        const weaponConfig = GameConfig.WEAPONS[weaponId];
        
        if (!weaponConfig || !weaponConfig.upgrades || !weaponConfig.upgrades[stat]) {
            return false;
        }
        
        const upgrade = weaponConfig.upgrades[stat];
        const weapon = state.weapons[weaponId];
        
        if (!weapon) return false;
        
        const cost = this.getWeaponUpgradeCost(weaponId, stat);
        if (state.money < cost) return false;

        // Check max values
        if (upgrade.max !== undefined) {
            if (stat === 'accuracy' && weapon.accuracy >= upgrade.max) return false;
            if (stat === 'range' && upgrade.max !== Infinity && weapon.range >= upgrade.max) return false;
            if (stat === 'clipSize' && weapon.clipSize >= upgrade.max) return false;
            if (stat === 'fireRate' && weapon.fireRate >= upgrade.max) return false;
        }
        
        if (upgrade.min !== undefined) {
            if (stat === 'reloadSpeed' && weapon.reloadSpeed <= upgrade.min) return false;
        }

        state.money -= cost;
        state.totalUpgradeSpending += cost; // Track spending for difficulty scaling
        
        if (stat === 'damage') {
            weapon.damage += upgrade.value;
        } else if (stat === 'accuracy') {
            weapon.accuracy = Math.min(upgrade.max || 100, weapon.accuracy + upgrade.value);
        } else if (stat === 'reloadSpeed') {
            weapon.reloadSpeed = Math.max(upgrade.min || 0.2, weapon.reloadSpeed - upgrade.value);
        } else if (stat === 'range') {
            weapon.range += upgrade.value;
        } else if (stat === 'clipSize') {
            weapon.clipSize += upgrade.value;
        } else if (stat === 'fireRate') {
            weapon.fireRate = Math.min(upgrade.max || 15, weapon.fireRate + upgrade.value);
        }

        // Play purchase sound
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playSound('purchase');
        }
        
        GameState.save();
        UI.updateWeaponStats();
        this.render();
        UI.updateStats();
        UI.showNotification(`${weaponConfig.name} ${stat} upgraded!`);
        return true;
    },
    
    // Upgrade gun stat (legacy support - upgrades current weapon)
    upgradeGun(stat) {
        const state = GameState.get();
        const currentWeaponId = state.currentWeapon || 'pistol';
        
        // Use new weapon upgrade system if weapon exists
        if (state.weapons && state.weapons[currentWeaponId]) {
            return this.upgradeWeapon(currentWeaponId, stat);
        }
        
        // Fallback to legacy gun system
        const upgrade = GameConfig.GUN.UPGRADES[stat];
        
        if (!upgrade) return false;
        
        const cost = this.getUpgradeCost(stat, 'gun');
        if (state.money < cost) return false;

        // Check max values
        if (upgrade.max !== undefined) {
            if (stat === 'accuracy' && state.gun.accuracy >= upgrade.max) return false;
            if (stat === 'range' && upgrade.max !== Infinity && state.gun.range >= upgrade.max) return false;
        }
        
        if (upgrade.min !== undefined) {
            if (stat === 'reloadSpeed' && state.gun.reloadSpeed <= upgrade.min) return false;
        }

        state.money -= cost;
        state.totalUpgradeSpending += cost; // Track spending for difficulty scaling
        
        if (stat === 'damage') {
            state.gun.damage += upgrade.value;
        } else if (stat === 'accuracy') {
            state.gun.accuracy = Math.min(upgrade.max || 100, state.gun.accuracy + upgrade.value);
        } else if (stat === 'reloadSpeed') {
            state.gun.reloadSpeed = Math.max(upgrade.min || 0.2, state.gun.reloadSpeed - upgrade.value);
        } else if (stat === 'range') {
            state.gun.range += upgrade.value;
        }

        // Play purchase sound
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playSound('purchase');
        }
        
        UI.updateGunStats();
        this.render();
        UI.updateStats();
        UI.showNotification(`Gun ${stat} upgraded!`);
        return true;
    },

    // Upgrade character stat
    upgradeCharacter(stat) {
        const state = GameState.get();
        const upgrade = GameConfig.CHARACTER.UPGRADES[stat];
        
        if (!upgrade) return false;
        
        const cost = this.getUpgradeCost(stat, 'character');
        if (state.money < cost) return false;

        // Check max values
        if (upgrade.max !== undefined) {
            if (stat === 'stealth' && state.character.stealth >= upgrade.max) return false;
            if (stat === 'health' && upgrade.max !== Infinity && state.character.health >= upgrade.max) return false;
            if (stat === 'speed' && upgrade.max !== Infinity && state.character.speed >= upgrade.max) return false;
        }

        state.money -= cost;
        state.totalUpgradeSpending += cost; // Track spending for difficulty scaling
        
        if (stat === 'health') {
            state.character.health += upgrade.value;
        } else if (stat === 'speed') {
            state.character.speed += upgrade.value;
        } else if (stat === 'stealth') {
            state.character.stealth = Math.min(upgrade.max || 100, state.character.stealth + upgrade.value);
        }

        // Play purchase sound
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playSound('purchase');
        }
        
        this.render();
        UI.updateStats();
        UI.showNotification(`Character ${stat} upgraded!`);
        return true;
    },

    // Render upgrades view
    render() {
        const state = GameState.get();
        const currentWeaponId = state.currentWeapon || 'pistol';
        const weaponConfig = GameConfig.WEAPONS[currentWeaponId];
        const weapon = state.weapons && state.weapons[currentWeaponId];
        
        // Render weapon upgrades (if weapon system is active)
        const gunUpgrades = document.getElementById('gun-upgrades');
        if (weapon && weaponConfig && weaponConfig.upgrades) {
            // Show weapon selector and current weapon upgrades
            const weaponSelector = Object.keys(GameConfig.WEAPONS).map(wId => {
                const wConfig = GameConfig.WEAPONS[wId];
                const isUnlocked = state.unlockedWeapons && state.unlockedWeapons.includes(wId);
                const isCurrent = wId === currentWeaponId;
                
                // Get weapon image or fallback to emoji
                let weaponIconHtml = '';
                if (wConfig.image) {
                    const imagePath = wConfig.image;
                    weaponIconHtml = `<img src="${imagePath}" alt="${wConfig.name}" onerror="this.outerHTML='${wConfig.icon} '" style="width: 20px; height: 20px; object-fit: contain; vertical-align: middle; margin-right: 4px;">`;
                } else {
                    weaponIconHtml = wConfig.icon + ' ';
                }
                
                return `
                    <button class="weapon-select-btn ${isCurrent ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}" 
                            onclick="Upgrades.selectWeaponForUpgrade('${wId}')"
                            ${!isUnlocked ? 'disabled title="Weapon not unlocked"' : ''}>
                        ${weaponIconHtml}${wConfig.name}
                    </button>
                `;
            }).join('');
            
            gunUpgrades.innerHTML = `
                <div class="weapon-selector">
                    <h4>Select Weapon to Upgrade:</h4>
                    <div class="weapon-selector-buttons">
                        ${weaponSelector}
                    </div>
                </div>
                ${(() => {
                    // Get weapon image or fallback to emoji for heading
                    let headingIcon = '';
                    if (weaponConfig.image) {
                        const imagePath = weaponConfig.image;
                        headingIcon = `<img src="${imagePath}" alt="${weaponConfig.name}" onerror="this.outerHTML='${weaponConfig.icon} '" style="width: 24px; height: 24px; object-fit: contain; vertical-align: middle; margin-right: 8px;">`;
                    } else {
                        headingIcon = weaponConfig.icon + ' ';
                    }
                    return `<h3>${headingIcon}${weaponConfig.name} Upgrades</h3>`;
                })()}
                ${Object.entries(weaponConfig.upgrades).map(([stat, upgrade]) => {
                    const statNames = {
                        damage: 'Increase Damage',
                        accuracy: 'Increase Accuracy',
                        reloadSpeed: 'Faster Reload',
                        range: 'Increase Range',
                        clipSize: 'Increase Clip Size',
                        fireRate: 'Increase Fire Rate'
                    };
                    
                    const statIcons = {
                        damage: '🔫',
                        accuracy: '🎯',
                        reloadSpeed: '⚡',
                        range: '📏',
                        clipSize: '📦',
                        fireRate: '💨'
                    };
                    
                    const currentValue = weapon[stat];
                    let isMaxed = false;
                    if (upgrade.max !== undefined) {
                        if (stat === 'accuracy' && currentValue >= upgrade.max) isMaxed = true;
                        else if (stat === 'range' && upgrade.max !== Infinity && currentValue >= upgrade.max) isMaxed = true;
                        else if (stat === 'clipSize' && currentValue >= upgrade.max) isMaxed = true;
                        else if (stat === 'fireRate' && currentValue >= upgrade.max) isMaxed = true;
                    }
                    if (upgrade.min !== undefined && stat === 'reloadSpeed' && currentValue <= upgrade.min) {
                        isMaxed = true;
                    }
                    
                    const cost = Upgrades.getWeaponUpgradeCost(currentWeaponId, stat);
                    const canAfford = state.money >= cost;
                    const valueText = stat === 'reloadSpeed' 
                        ? `(-${upgrade.value}s)` 
                        : stat === 'accuracy' || stat === 'range'
                        ? `(+${upgrade.value}${stat === 'accuracy' ? '%' : 'px'})`
                        : stat === 'fireRate'
                        ? `(+${upgrade.value}/s)`
                        : `(+${upgrade.value})`;
                    
                    const unitText = stat === 'accuracy' ? '%' : 
                                   stat === 'reloadSpeed' ? 's' : 
                                   stat === 'range' ? 'px' :
                                   stat === 'fireRate' ? '/s' : '';
                    
                    return `
                        <div class="shop-item" ${isMaxed ? 'style="opacity: 0.6;"' : ''}>
                            <div class="shop-item-info">
                                <h3>${statIcons[stat] || '⚙️'} ${statNames[stat] || stat} ${valueText}</h3>
                                <p>Current: ${currentValue}${unitText}${isMaxed ? ' <strong style="color: #4CAF50;">(MAXED)</strong>' : ''}</p>
                            </div>
                            <button class="btn" onclick="Upgrades.upgradeWeapon('${currentWeaponId}', '${stat}')" 
                                    ${!canAfford || isMaxed ? 'disabled' : ''}
                                    style="${isMaxed ? 'background: #ccc; color: #666; cursor: not-allowed;' : ''}">
                                ${isMaxed ? 'Maxed' : '$' + formatMoney(cost)}
                            </button>
                        </div>
                    `;
                }).join('')}
            `;
        } else {
            // Fallback to legacy gun upgrades
            gunUpgrades.innerHTML = Object.entries(GameConfig.GUN.UPGRADES).map(([stat, upgrade]) => {
                const statNames = {
                    damage: 'Increase Damage',
                    accuracy: 'Increase Accuracy',
                    reloadSpeed: 'Faster Reload',
                    range: 'Increase Range'
                };
                
                const statIcons = {
                    damage: '🔫',
                    accuracy: '🎯',
                    reloadSpeed: '⚡',
                    range: '📏'
                };
                
                const currentValue = state.gun[stat];
                const isMaxed = upgrade.max !== undefined && 
                    ((stat === 'accuracy' && currentValue >= upgrade.max) ||
                     (stat === 'reloadSpeed' && currentValue <= (upgrade.min || 0)));
                
                const cost = Upgrades.getUpgradeCost(stat, 'gun');
                const canAfford = state.money >= cost;
                const valueText = stat === 'reloadSpeed' 
                    ? `(-${upgrade.value}s)` 
                    : stat === 'accuracy' || stat === 'range'
                    ? `(+${upgrade.value}${stat === 'accuracy' ? '%' : 'px'})`
                    : `(+${upgrade.value})`;
                
                return `
                    <div class="shop-item" ${isMaxed ? 'style="opacity: 0.6;"' : ''}>
                        <div class="shop-item-info">
                            <h3>${statIcons[stat]} ${statNames[stat]} ${valueText}</h3>
                            <p>Current: ${currentValue}${stat === 'accuracy' ? '%' : stat === 'reloadSpeed' ? 's' : stat === 'range' ? 'px' : ''}${isMaxed ? ' <strong style="color: #4CAF50;">(MAXED)</strong>' : ''}</p>
                        </div>
                        <button class="btn" onclick="Upgrades.upgradeGun('${stat}')" 
                                ${!canAfford || isMaxed ? 'disabled' : ''}
                                style="${isMaxed ? 'background: #ccc; color: #666; cursor: not-allowed;' : ''}">
                            ${isMaxed ? 'Maxed' : '$' + formatMoney(cost)}
                        </button>
                    </div>
                `;
            }).join('');
        }

        // Render character upgrades
        const charUpgrades = document.getElementById('character-upgrades');
        charUpgrades.innerHTML = Object.entries(GameConfig.CHARACTER.UPGRADES).map(([stat, upgrade]) => {
            const statNames = {
                health: 'Increase Health',
                speed: 'Increase Speed',
                stealth: 'Increase Stealth'
            };
            
            const statIcons = {
                health: '❤️',
                speed: '🏃',
                stealth: '🥷'
            };
            
            const currentValue = state.character[stat];
            const isMaxed = upgrade.max !== undefined && currentValue >= upgrade.max;
            const cost = Upgrades.getUpgradeCost(stat, 'character');
            const canAfford = state.money >= cost;
            const valueText = stat === 'stealth' 
                ? `(+${upgrade.value}%)` 
                : stat === 'speed'
                ? `(+${upgrade.value}x)`
                : `(+${upgrade.value})`;
            
            return `
                <div class="shop-item" ${isMaxed ? 'style="opacity: 0.6;"' : ''}>
                    <div class="shop-item-info">
                        <h3>${statIcons[stat]} ${statNames[stat]} ${valueText}</h3>
                        <p>Current: ${currentValue}${stat === 'stealth' ? '%' : stat === 'speed' ? 'x' : ''}${isMaxed ? ' <strong style="color: #4CAF50;">(MAXED)</strong>' : ''}</p>
                    </div>
                    <button class="btn" onclick="Upgrades.upgradeCharacter('${stat}')" 
                            ${!canAfford || isMaxed ? 'disabled' : ''}
                            style="${isMaxed ? 'background: #ccc; color: #666; cursor: not-allowed;' : ''}">
                        ${isMaxed ? 'Maxed' : '$' + formatMoney(cost)}
                    </button>
                </div>
            `;
        }).join('');
    },

    // Purchase a weapon
    purchaseWeapon(weaponId) {
        const state = GameState.get();
        const weaponConfig = GameConfig.WEAPONS[weaponId];
        
        if (!weaponConfig) {
            UI.showNotification('Weapon not found!', 2000);
            return false;
        }
        
        // Check if already unlocked
        if (state.unlockedWeapons && state.unlockedWeapons.includes(weaponId)) {
            UI.showNotification('Weapon already unlocked!', 2000);
            return false;
        }
        
        // Check if player has enough money
        if (state.money < weaponConfig.purchaseCost) {
            UI.showNotification(`Not enough money! Need $${formatMoney(weaponConfig.purchaseCost)}`, 2000);
            return false;
        }
        
        // Deduct cost
        state.money -= weaponConfig.purchaseCost;
        
        // Unlock weapon
        if (!state.unlockedWeapons) {
            state.unlockedWeapons = [];
        }
        state.unlockedWeapons.push(weaponId);
        
        // Initialize weapon stats if not already initialized
        if (!state.weapons) {
            state.weapons = {};
        }
        if (!state.weapons[weaponId]) {
            state.weapons[weaponId] = {
                damage: weaponConfig.damage,
                accuracy: weaponConfig.accuracy,
                reloadSpeed: weaponConfig.reloadSpeed,
                range: weaponConfig.range,
                clipSize: weaponConfig.clipSize,
                fireRate: weaponConfig.fireRate
            };
        }
        
        // Save state
        GameState.save();
        
        // Play purchase sound
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playSound('purchase');
        }
        
        // Update UI
        UI.updateStats();
        if (typeof UI.renderWeaponSelector === 'function') {
            UI.renderWeaponSelector();
        }
        UI.showNotification(`${weaponConfig.name} unlocked!`, 3000);
        
        return true;
    },
    
    // Select weapon for upgrading
    selectWeaponForUpgrade(weaponId) {
        const state = GameState.get();
        
        // Check if weapon is unlocked
        if (!state.unlockedWeapons || !state.unlockedWeapons.includes(weaponId)) {
            UI.showNotification('Weapon not unlocked!', 2000);
            return;
        }
        
        // Switch to this weapon for upgrades (doesn't change active weapon in hunt)
        state.currentWeapon = weaponId;
        GameState.save();
        
        // Re-render upgrades view
        this.render();
        UI.showNotification(`Now upgrading ${GameConfig.WEAPONS[weaponId].name}`, 2000);
    },
    
    // Reset all upgrades to starting values
    resetUpgrades() {
        const state = GameState.get();
        
        // Confirm reset
        if (!confirm('Are you sure you want to reset all upgrades? This will restore all gun and character stats to their starting values. This action cannot be undone.')) {
            return;
        }
        
        // Reset gun stats to starting values
        state.gun.damage = GameConfig.GUN.STARTING_DAMAGE;
        state.gun.accuracy = GameConfig.GUN.STARTING_ACCURACY;
        state.gun.reloadSpeed = GameConfig.GUN.STARTING_RELOAD_SPEED;
        state.gun.range = GameConfig.GUN.STARTING_RANGE;
        
        // Reset character stats to starting values
        state.character.health = GameConfig.CHARACTER.STARTING_HEALTH;
        state.character.speed = GameConfig.CHARACTER.STARTING_SPEED;
        state.character.stealth = GameConfig.CHARACTER.STARTING_STEALTH;
        
        // Save state
        GameState.save();
        
        // Re-render and update UI
        this.render();
        UI.updateGunStats();
        UI.updateStats();
        UI.showNotification('All upgrades have been reset to starting values.', 3000);
    }
};
