// ============================================
// UI HELPERS
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

const UI = {
    // Switch between views
    switchView(view) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        
        document.getElementById(view + '-view').classList.add('active');
        event.target.classList.add('active');
    },

    // Track previous money for animation
    previousMoney: 0,
    
    // Update stats display
    updateStats() {
        const state = GameState.get();
        const moneyElement = document.getElementById('money');
        const visitorsElement = document.getElementById('visitors');
        const dinoCountElement = document.getElementById('dinoCount');
        
        // Update money with animation if it increased
        const currentMoney = state.money;
        if (currentMoney > this.previousMoney && this.previousMoney > 0) {
            // Money increased - add pulse animation
            moneyElement.classList.add('money-pulse');
            setTimeout(() => {
                moneyElement.classList.remove('money-pulse');
            }, 600);
        }
        moneyElement.textContent = formatMoney(currentMoney);
        this.previousMoney = currentMoney;
        
        // Update other stats
        visitorsElement.textContent = state.visitors;
        dinoCountElement.textContent = state.dinoCount;
        
        // Update exhibit stats without full re-render
        this.updateExhibitStats();
    },
    
    // Update exhibit stats without full re-render (to preserve filters)
    updateExhibitStats() {
        const state = GameState.get();
        state.exhibits.forEach((exhibit, idx) => {
            const visitors = ParkManager.getExhibitVisitors(exhibit);
            const income = ParkManager.getExhibitIncome(exhibit);
            const roundedIncome = Math.round(income * 100) / 100;
            
            // Find and update visitor count
            const exhibitDiv = document.querySelector(`.exhibit:nth-child(${idx + 1})`);
            if (exhibitDiv) {
                const visitorElement = exhibitDiv.querySelector('.visitor-count');
                const incomeElement = exhibitDiv.querySelector('.income-display');
                const dinoCountElement = exhibitDiv.querySelector('.dino-count');
                
                if (visitorElement) {
                    visitorElement.textContent = `👥 Visitors: ${visitors}`;
                }
                if (incomeElement) {
                    incomeElement.textContent = `💰 Income: $${formatMoney(roundedIncome)}/min`;
                }
                if (dinoCountElement) {
                    dinoCountElement.textContent = `🦕 Dinosaurs: ${exhibit.dinos.length}`;
                }
            }
        });
    },

    // Show notification
    showNotification(message, duration = GameConfig.UI.NOTIFICATION_DURATION) {
        const notif = document.getElementById('notification');
        notif.textContent = message;
        
        // Remove any existing animation classes
        notif.classList.remove('show');
        notif.style.animation = '';
        
        // Calculate fade-up start time (0.5s before end)
        const fadeUpStart = Math.max(0, duration - 500);
        
        // Set up the fade-up animation timing
        notif.style.setProperty('--fade-up-delay', `${fadeUpStart}ms`);
        
        // Trigger reflow to reset animation
        void notif.offsetWidth;
        
        notif.classList.add('show');
        
        setTimeout(() => {
            notif.classList.remove('show');
            notif.style.animation = '';
        }, duration);
    },

    // Update gun stats display
    updateGunStats() {
        const state = GameState.get();
        const currentWeaponId = state.currentWeapon || 'pistol';
        const weapon = state.weapons && state.weapons[currentWeaponId];
        const weaponConfig = GameConfig.WEAPONS[currentWeaponId];
        
        if (weapon && weaponConfig) {
            // Use weapon stats
            document.getElementById('gun-name').textContent = weaponConfig.name;
            document.getElementById('gun-damage').textContent = weapon.damage;
            document.getElementById('gun-accuracy').textContent = weapon.accuracy;
            document.getElementById('gun-reload').textContent = weapon.reloadSpeed.toFixed(1);
            document.getElementById('gun-range').textContent = weapon.range;
            
            // Update ammo display (if hunting game is active)
            if (typeof HuntingGame !== 'undefined' && HuntingGame.state && HuntingGame.state.active) {
                const currentAmmo = HuntingGame.state.weaponAmmo[currentWeaponId] || 0;
                const isReloading = HuntingGame.state.isReloading;
                const ammoElement = document.getElementById('gun-ammo');
                if (ammoElement) {
                    if (isReloading) {
                        const state = GameState.get();
                        const weapon = state.weapons[currentWeaponId];
                        const now = Date.now();
                        const reloadTimeMs = weapon.reloadSpeed * 1000;
                        const elapsed = now - HuntingGame.state.reloadStartTime;
                        const progress = Math.min(100, (elapsed / reloadTimeMs) * 100);
                        ammoElement.textContent = `Reloading... ${Math.floor(progress)}%`;
                        ammoElement.style.color = '#FF9800';
                    } else {
                        ammoElement.textContent = `${currentAmmo}/${weapon.clipSize}`;
                        ammoElement.style.color = '';
                    }
                }
            } else {
                document.getElementById('gun-ammo').textContent = `${weapon.clipSize}/${weapon.clipSize}`;
            }
        } else {
            // Fallback to legacy gun
            const gun = state.gun;
            document.getElementById('gun-name').textContent = 'Gun';
            document.getElementById('gun-damage').textContent = gun.damage;
            document.getElementById('gun-accuracy').textContent = gun.accuracy;
            document.getElementById('gun-reload').textContent = gun.reloadSpeed.toFixed(1);
            document.getElementById('gun-range').textContent = gun.range;
            document.getElementById('gun-ammo').textContent = '∞';
        }
    },
    
    // Render weapon selector
    renderWeaponSelector() {
        const container = document.getElementById('weapon-selector-container');
        if (!container) return;
        
        const state = GameState.get();
        const currentWeaponId = state.currentWeapon || 'pistol';
        
        const weaponSelector = Object.keys(GameConfig.WEAPONS).map(wId => {
            const wConfig = GameConfig.WEAPONS[wId];
            const isUnlocked = state.unlockedWeapons && state.unlockedWeapons.includes(wId);
            const isCurrent = wId === currentWeaponId;
            
            // Get ammo info if hunting game is active
            let ammoDisplay = '';
            if (typeof HuntingGame !== 'undefined' && HuntingGame.state && HuntingGame.state.active) {
                const weapon = state.weapons[wId];
                if (weapon) {
                    const currentAmmo = HuntingGame.state.weaponAmmo[wId] || 0;
                    const isReloading = HuntingGame.state.isReloading && isCurrent;
                    ammoDisplay = `<div class="weapon-ammo-overlay ${isReloading ? 'reloading' : ''}">${currentAmmo}/${weapon.clipSize}</div>`;
                }
            }
            
            // Get weapon image or fallback to emoji
            let weaponIconHtml = '';
            if (wConfig.image) {
                const imagePath = wConfig.image;
                weaponIconHtml = `<img src="${imagePath}" alt="${wConfig.name}" onerror="this.outerHTML='${wConfig.icon}'" class="weapon-image">`;
            } else {
                weaponIconHtml = `<div class="weapon-icon-fallback">${wConfig.icon}</div>`;
            }
            
            const opacityClass = isCurrent ? '' : 'semi-opaque';
            const cursorStyle = isUnlocked ? 'cursor: pointer;' : 'cursor: not-allowed;';
            
            return `
                <div class="weapon-card-image ${isCurrent ? 'active' : ''} ${!isUnlocked ? 'locked' : ''} ${opacityClass}" 
                     onclick="${isUnlocked ? `HuntingGame.switchWeapon('${wId}')` : ''}"
                     title="${!isUnlocked ? 'Press ' + (Object.keys(GameConfig.WEAPONS).indexOf(wId) + 1) + ' to unlock' : wConfig.name}"
                     style="${cursorStyle}">
                    <div class="weapon-image-container">
                        ${weaponIconHtml}
                        ${ammoDisplay}
                        ${!isUnlocked ? '<div class="weapon-locked">🔒</div>' : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `
            <div class="weapon-selector">
                <div class="weapon-selector-title">Weapons (Press 1-6 to switch)</div>
                <div class="weapon-selector-cards">
                    ${weaponSelector}
                </div>
            </div>
        `;
    },
    
    // Update weapon stats (called during hunt)
    updateWeaponStats() {
        this.updateGunStats();
        this.renderWeaponSelector();
    },
    
    // Update ammo display
    updateAmmoDisplay() {
        const state = GameState.get();
        const currentWeaponId = state.currentWeapon || 'pistol';
        const weapon = state.weapons && state.weapons[currentWeaponId];
        
        if (weapon && typeof HuntingGame !== 'undefined' && HuntingGame.state && HuntingGame.state.active) {
            const currentAmmo = HuntingGame.state.weaponAmmo[currentWeaponId] || 0;
            const isReloading = HuntingGame.state.isReloading;
            const ammoElement = document.getElementById('gun-ammo');
            
            if (ammoElement) {
                if (isReloading) {
                    const now = Date.now();
                    const reloadTimeMs = weapon.reloadSpeed * 1000;
                    const elapsed = now - HuntingGame.state.reloadStartTime;
                    const progress = Math.min(100, (elapsed / reloadTimeMs) * 100);
                    ammoElement.textContent = `Reloading... ${Math.floor(progress)}%`;
                    ammoElement.style.color = '#FF9800';
                } else {
                    ammoElement.textContent = `${currentAmmo}/${weapon.clipSize}`;
                    ammoElement.style.color = '';
                }
            }
            
            // Update weapon card ammo display
            this.renderWeaponSelector();
        }
    },
    
    // Render weapon shop
    renderWeaponShop() {
        const container = document.getElementById('weapon-shop');
        if (!container) return;
        
        const state = GameState.get();
        
        const weaponShop = Object.keys(GameConfig.WEAPONS).map(wId => {
            const wConfig = GameConfig.WEAPONS[wId];
            const isUnlocked = state.unlockedWeapons && state.unlockedWeapons.includes(wId);
            const canAfford = state.money >= wConfig.purchaseCost;
            
            // Get weapon image or fallback to emoji
            let weaponIconHtml = '';
            if (wConfig.image) {
                const imagePath = wConfig.image;
                weaponIconHtml = `<img src="${imagePath}" alt="${wConfig.name}" onerror="this.outerHTML='${wConfig.icon}'" style="width: 24px; height: 24px; object-fit: contain; vertical-align: middle; margin-right: 8px;">`;
            } else {
                weaponIconHtml = wConfig.icon + ' ';
            }
            
            if (isUnlocked) {
                return `
                    <div class="shop-item" style="opacity: 0.6;">
                        <div class="shop-item-info">
                            <h3>${weaponIconHtml}${wConfig.name}</h3>
                            <p>Unlocked</p>
                        </div>
                        <button class="btn" disabled style="background: #ccc; color: #666; cursor: not-allowed;">
                            Owned
                        </button>
                    </div>
                `;
            }
            
            return `
                <div class="shop-item">
                    <div class="shop-item-info">
                        <h3>${weaponIconHtml}${wConfig.name}</h3>
                        <p>Damage: ${wConfig.damage} | Accuracy: ${wConfig.accuracy}% | Range: ${wConfig.range}px</p>
                        <p>Clip: ${wConfig.clipSize} | Reload: ${wConfig.reloadSpeed}s</p>
                    </div>
                    <button class="btn" onclick="Upgrades.purchaseWeapon('${wId}')" 
                            ${!canAfford ? 'disabled' : ''}
                            style="${!canAfford ? 'background: #ccc; color: #666; cursor: not-allowed;' : ''}">
                        $${formatMoney(wConfig.purchaseCost)}
                    </button>
                </div>
            `;
        }).join('');
        
        container.innerHTML = weaponShop;
    },

    // Update profile display
    updateProfileDisplay() {
        const currentProfile = GameState.currentProfile;
        
        // Update profile buttons
        for (let i = 1; i <= 4; i++) {
            const btn = document.getElementById(`profile-${i}-btn`);
            if (btn) {
                if (i === currentProfile) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
                
                // Get profile name and show checkmark if has data
                const profileName = GameState.getProfileName(i);
                const hasData = GameState.hasProfileData(i);
                const label = hasData ? `${profileName} ✓` : profileName;
                btn.innerHTML = label;
            }
        }
        
        // Update reset button (single button for current profile)
        const resetBtn = document.getElementById('reset-profile-btn');
        if (resetBtn) {
            resetBtn.style.display = 'inline-block';
            const profileName = GameState.getProfileName(currentProfile);
            resetBtn.title = `Reset ${profileName}`;
        }
    }
};
