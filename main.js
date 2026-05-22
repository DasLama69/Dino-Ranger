// ============================================
// MAIN GAME LOOP & INITIALIZATION
// ============================================

const GameLoop = {
    interval: null,
    lastActivityTime: Date.now(),

    // Update last activity time
    updateActivity() {
        this.lastActivityTime = Date.now();
    },

    // Check if game is currently active (tab visible and recent activity)
    isActive() {
        // Check if tab is visible
        if (document.hidden) {
            return false;
        }
        
        // Check if user has been active within the timeout period
        const inactiveTime = Date.now() - this.lastActivityTime;
        return inactiveTime < GameConfig.GAME_LOOP.INACTIVE_INCOME_TIMEOUT;
    },

    // Start the main game loop
    start() {
        // Initialize activity tracking
        this.lastActivityTime = Date.now();
        
        // Set up activity listeners
        this.setupActivityListeners();
        
        this.interval = setInterval(() => {
            const state = GameState.get();
            
            // Calculate income from exhibits (only if game is active)
            if (this.isActive()) {
                let totalIncome = 0;
                state.exhibits.forEach(exhibit => {
                    totalIncome += ParkManager.getExhibitIncome(exhibit);
                });
                const incomeIncrease = totalIncome / GameConfig.GAME_LOOP.INCOME_CALCULATION_INTERVAL;
                // Round to 2 decimal places to avoid floating point precision issues
                state.money += Math.round(incomeIncrease * 100) / 100;
            }

            // Calculate total visitors
            let totalVisitors = 0;
            state.exhibits.forEach(exhibit => {
                totalVisitors += ParkManager.getExhibitVisitors(exhibit);
            });
            state.visitors = totalVisitors;

            // Calculate total dinos
            let totalDinos = 0;
            state.exhibits.forEach(exhibit => {
                totalDinos += exhibit.dinos.length;
            });
            state.dinoCount = totalDinos;

            UI.updateStats();
            // Don't re-render park manager - it causes filter resets
            // Only update stats, not the full render
            if (typeof Upgrades !== 'undefined') {
                Upgrades.render();
            }
            GameState.save();
        }, GameConfig.GAME_LOOP.UPDATE_INTERVAL);
    },

    // Stop the game loop
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.removeActivityListeners();
    },

    // Set up activity listeners to track user interaction
    setupActivityListeners() {
        // Track user activity events
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'keydown', 'click', 'touchstart', 'touchmove'];
        const updateActivity = () => this.updateActivity();
        
        activityEvents.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });
        
        // Track tab visibility
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Tab became visible - update activity time
                this.updateActivity();
            }
        });
        
        // Store listeners for cleanup
        this.activityListeners = activityEvents;
        this.activityHandler = updateActivity;
    },

    // Remove activity listeners
    removeActivityListeners() {
        if (this.activityListeners && this.activityHandler) {
            this.activityListeners.forEach(event => {
                document.removeEventListener(event, this.activityHandler);
            });
        }
        this.activityListeners = null;
        this.activityHandler = null;
    }
};

// Initialize game
async function init() {
    // Preload images if enabled
    if (GameConfig.IMAGES.PRELOAD_IMAGES) {
        console.log('Loading dinosaur images...');
        await ImageLoader.preloadDinosaurImages();
    }
    
    // Always preload weapon images (they're small and needed for UI)
    console.log('Loading weapon images...');
    await ImageLoader.preloadWeaponImages();

    // Get current profile and load it
    GameState.getCurrentProfile();
    UI.updateProfileDisplay(); // Update profile UI
    
    // Load saved game or initialize new
    const loaded = GameState.load();
        if (!loaded) {
            // New game - initialize with starting state
            GameState.init();
        } else {
            // Loaded game - ensure unlock state exists
            const state = GameState.get();
            if (!state.unlockedExhibitTypes) {
                state.unlockedExhibitTypes = {
                    plant: true,
                    meat: false,
                    aquarium: false,
                    aviary: false
                };
            } else {
                // Ensure aviary is in unlock state (for existing saves)
                if (!state.unlockedExhibitTypes.hasOwnProperty('aviary')) {
                    state.unlockedExhibitTypes.aviary = false;
                }
            }
            // Clean up duplicate exhibits (for existing saves with duplicates)
            const hadDuplicates = GameState.cleanupDuplicateExhibits();
            if (hadDuplicates) {
                UI.showNotification('Duplicate exhibits removed. Only one of each type is allowed.', 4000);
            }
            
            // Validate and fix incorrectly placed dinosaurs
            const validationResult = GameState.validateDinoPlacements();
            if (validationResult) {
                let message = '';
                if (validationResult.moved > 0) {
                    message += `${validationResult.moved} dinosaur(s) moved to correct exhibits. `;
                }
                if (validationResult.removed > 0) {
                    message += `${validationResult.removed} dinosaur(s) removed (no suitable exhibit).`;
                }
                if (message) {
                    UI.showNotification(message.trim(), 5000);
                }
            }
            
            // Ensure at least one exhibit exists
            if (state.exhibits.length === 0) {
                GameState.init();
            }
        }

    // Initialize systems
    if (typeof SoundManager !== 'undefined') {
        SoundManager.init();
    }
    HuntingGame.init();
    if (typeof Sandbox !== 'undefined') {
        Sandbox.init();
    }
    UI.updateGunStats();
    
    // Render initial views
    ParkManager.render();
    if (typeof Upgrades !== 'undefined') {
        Upgrades.render();
    } else {
        console.error('Upgrades object not defined! Check upgrades.js loading order.');
    }
    if (typeof UI.renderWeaponSelector === 'function') {
        UI.renderWeaponSelector();
    }
    if (typeof UI.renderWeaponShop === 'function') {
        UI.renderWeaponShop();
    }
    
    // Start game loop
    GameLoop.start();
    
    // Update stats
    UI.updateStats();
    
    // Check dev mode state and update UI
    const devModeCheckbox = document.getElementById('dev-mode-checkbox');
    if (devModeCheckbox) {
        // Check if dev mode was previously enabled (optional - you can remove this if you want it to default to off)
        // For now, we'll just sync the UI with the checkbox state
        toggleDevMode();
    }
}

// Initialize on load
window.addEventListener('load', init);

// Expose functions for onclick handlers
window.switchView = (view) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    document.getElementById(view + '-view').classList.add('active');
    
    // Find and activate the corresponding tab button
    const tabButtons = document.querySelectorAll('.tab');
    tabButtons.forEach(tab => {
        if (tab.getAttribute('onclick') && tab.getAttribute('onclick').includes(`'${view}'`)) {
            tab.classList.add('active');
        }
    });
    
    // If switching to hunt view, automatically start a new hunt
    if (view === 'hunt') {
        // Update hunt title with profile name
        const huntTitle = document.getElementById('hunt-title');
        if (huntTitle) {
            const profileName = GameState.getProfileName(GameState.currentProfile);
            huntTitle.textContent = `${profileName}'s Dinosaur Hunting`;
        }
        
        // Stop any existing hunt first
        if (typeof HuntingGame !== 'undefined') {
            HuntingGame.stop();
        }
        // Stop sandbox if active
        if (typeof Sandbox !== 'undefined') {
            Sandbox.stop();
        }
        // Start a new hunt (fullscreen will be requested in start())
        setTimeout(() => {
            if (typeof HuntingGame !== 'undefined' && typeof HuntingGame.start === 'function') {
                HuntingGame.start();
            }
        }, 100); // Small delay to ensure view is ready
    } else {
        // If switching away from hunt view, exit fullscreen
        if (typeof HuntingGame !== 'undefined' && HuntingGame.exitFullscreen) {
            try {
                HuntingGame.exitFullscreen();
            } catch (err) {
                // Silently handle - prevents freeze if fullscreen exit fails
                console.warn('Failed to exit fullscreen:', err);
            }
        }
    }
    
    // If switching to sandbox view, start sandbox
    if (view === 'sandbox') {
        // Stop any existing hunt first
        if (typeof HuntingGame !== 'undefined') {
            HuntingGame.stop();
        }
        // Start sandbox
        setTimeout(() => {
            if (typeof Sandbox !== 'undefined') {
                if (!Sandbox.state.canvas) {
                    Sandbox.init();
                }
                Sandbox.start();
            }
        }, 100);
    } else {
        // Stop sandbox if switching away
        if (typeof Sandbox !== 'undefined') {
            Sandbox.stop();
        }
    }
};
window.startHunt = () => HuntingGame.start();
window.stopHunt = () => HuntingGame.stop();
window.sendToZoo = () => HuntingGame.sendToZoo();
window.sellDino = () => HuntingGame.sellDino();
window.returnToPark = () => {
    // Send all captured dinos to park before returning
    if (HuntingGame.state.capturedDinos && HuntingGame.state.capturedDinos.length > 0) {
        HuntingGame.sendAllCapturedDinosToPark();
    }
    
    // Close capture popup first (before exiting fullscreen)
    const overlay = document.getElementById('capture-result-overlay');
    const popup = document.getElementById('capture-result');
    
    if (overlay && popup) {
        // Restore popup to original parent if it was moved for fullscreen
        if (overlay.dataset.originalParent) {
            let originalParent = overlay.dataset.originalParentNode;
            if (!originalParent) {
                originalParent = overlay.dataset.originalParent === 'body' ? document.body : 
                                document.getElementById(overlay.dataset.originalParent) ||
                                document.querySelector(`#${overlay.dataset.originalParent}`) ||
                                document.body;
            }
            if (originalParent && overlay.parentNode !== originalParent) {
                originalParent.appendChild(overlay);
            }
            // Restore original positioning
            overlay.style.position = '';
            overlay.style.top = '';
            overlay.style.left = '';
            overlay.style.width = '';
            overlay.style.height = '';
            delete overlay.dataset.originalParent;
            delete overlay.dataset.originalParentNode;
        }
        if (popup.dataset.originalParent) {
            let originalParent = popup.dataset.originalParentNode;
            if (!originalParent) {
                originalParent = popup.dataset.originalParent === 'body' ? document.body : 
                                document.getElementById(popup.dataset.originalParent) ||
                                document.querySelector(`#${popup.dataset.originalParent}`) ||
                                document.body;
            }
            if (originalParent && popup.parentNode !== originalParent) {
                originalParent.appendChild(popup);
            }
            // Restore original positioning
            popup.style.position = '';
            popup.style.top = '';
            popup.style.left = '';
            popup.style.transform = '';
            delete popup.dataset.originalParent;
            delete popup.dataset.originalParentNode;
        }
        
        overlay.classList.remove('show');
        popup.classList.remove('show');
    }
    
    // Exit fullscreen when returning to park
    if (typeof HuntingGame !== 'undefined' && HuntingGame.exitFullscreen) {
        try {
            HuntingGame.exitFullscreen();
        } catch (err) {
            // Silently handle - prevents freeze if fullscreen exit fails
            console.warn('Failed to exit fullscreen:', err);
        }
    }
    
    // Switch to park view
    switchView('park');
};

// Start new hunt function (from capture popup)
window.startNewHunt = () => {
    // Send all captured dinos to park before starting new hunt
    if (HuntingGame.state.capturedDinos && HuntingGame.state.capturedDinos.length > 0) {
        HuntingGame.sendAllCapturedDinosToPark();
    }
    
    // Restore popup to original parent if it was moved for fullscreen
    const overlay = document.getElementById('capture-result-overlay');
    const popup = document.getElementById('capture-result');
    if (overlay && overlay.dataset.originalParent) {
        const originalParent = overlay.dataset.originalParent === 'body' ? document.body : document.getElementById(overlay.dataset.originalParent);
        if (originalParent && overlay.parentNode !== originalParent) {
            originalParent.appendChild(overlay);
        }
        delete overlay.dataset.originalParent;
    }
    if (popup && popup.dataset.originalParent) {
        const originalParent = popup.dataset.originalParent === 'body' ? document.body : document.getElementById(popup.dataset.originalParent);
        if (originalParent && popup.parentNode !== originalParent) {
            originalParent.appendChild(popup);
        }
        delete popup.dataset.originalParent;
    }
    
    // Close capture popup
    if (overlay) overlay.classList.remove('show');
    if (popup) popup.classList.remove('show');
    
    // Also handle single captured dino (for backward compatibility)
    if (HuntingGame.capturedDino) {
        HuntingGame.sendToZoo();
        // Note: sendToZoo() will clear capturedDino if successfully sent
        // If a modal appears (no compatible exhibit), the dino remains but we'll start new hunt anyway
    }
    
    // Close capture popup
    document.getElementById('capture-result-overlay').classList.remove('show');
    document.getElementById('capture-result').classList.remove('show');
    
    // Reset "Sell" button state for next capture
    const sellBtn = document.getElementById('sell-dino-btn');
    const returnToParkBtn = document.getElementById('return-to-park-btn');
    
    // Reset Return to Park button
    if (returnToParkBtn) {
        returnToParkBtn.disabled = false;
        returnToParkBtn.style.opacity = '1';
        returnToParkBtn.style.cursor = 'pointer';
    }
    
    if (sellBtn) {
        sellBtn.disabled = false;
        sellBtn.style.opacity = '1';
        sellBtn.style.cursor = 'pointer';
        // Restore original sell button text (will be updated when dino is captured)
        const sellPrice = document.getElementById('sell-price');
        if (sellPrice) {
            sellBtn.innerHTML = `Sell ($<span id="sell-price">0</span>)`;
        }
    }
    
    // Hide "Return to Park" button
    if (returnToParkBtn) {
        returnToParkBtn.style.display = 'none';
    }
    
    // Stop current hunt and start new one
    HuntingGame.stop();
    setTimeout(() => {
        HuntingGame.start();
    }, 100);
};

// Switch profile function
window.switchProfile = (profileNum) => {
    if (GameState.setCurrentProfile(profileNum)) {
        UI.updateProfileDisplay();
        UI.updateStats();
        UI.updateGunStats();
        if (typeof UI.renderWeaponSelector === 'function') {
            UI.renderWeaponSelector();
        }
        if (typeof UI.renderWeaponShop === 'function') {
            UI.renderWeaponShop();
        }
        if (typeof Upgrades !== 'undefined') {
            Upgrades.render();
        }
        if (typeof ParkManager !== 'undefined') {
            ParkManager.render(); // This will update the park title
        }
        if (typeof Upgrades !== 'undefined') {
            Upgrades.render();
        }
        
        // Update hunt title if hunt view is currently active
        const huntView = document.getElementById('hunt-view');
        if (huntView && huntView.classList.contains('active')) {
            const huntTitle = document.getElementById('hunt-title');
            if (huntTitle) {
                const profileName = GameState.getProfileName(profileNum);
                huntTitle.textContent = `${profileName}'s Dinosaur Hunting`;
            }
        }
        
        const profileName = GameState.getProfileName(profileNum);
        UI.showNotification(`Switched to ${profileName}`, 2000);
    }
};

// Rename profile function
window.renameProfile = (profileNum) => {
    const currentName = GameState.getProfileName(profileNum);
    const newName = prompt(`Enter a new name for ${currentName}:`, currentName);
    
    if (newName !== null) { // User didn't cancel
        if (newName.trim().length === 0) {
            // Empty name - remove custom name
            GameState.setProfileName(profileNum, '');
            UI.showNotification('Profile name reset to default', 2000);
        } else {
            // Set new name
            GameState.setProfileName(profileNum, newName);
            UI.showNotification(`Profile renamed to "${newName}"`, 2000);
        }
        UI.updateProfileDisplay();
    }
};

// Expose ParkManager functions
window.ParkManager = ParkManager;
if (typeof Upgrades !== 'undefined') {
    window.Upgrades = Upgrades;
} else {
    console.error('Upgrades not defined - check if upgrades.js loaded correctly');
}

// Toggle developer mode function
window.toggleDevMode = function() {
    const checkbox = document.getElementById('dev-mode-checkbox');
    const isEnabled = checkbox ? checkbox.checked : false;
    
    if (typeof HuntingGame !== 'undefined') {
        HuntingGame.setDevMode(isEnabled);
    }
    
    // Show/hide sandbox tab and view
    const sandboxTab = document.getElementById('sandbox-tab');
    const sandboxView = document.getElementById('sandbox-view');
    const devOnlyElements = document.querySelectorAll('.dev-only');
    
    devOnlyElements.forEach(el => {
        if (el) {
            el.style.display = isEnabled ? '' : 'none';
        }
    });
    
    // If sandbox was active and dev mode is disabled, switch to park view
    if (!isEnabled && sandboxView && sandboxView.classList.contains('active')) {
        switchView('park');
        if (typeof Sandbox !== 'undefined') {
            Sandbox.stop();
        }
    }
};

// Reset game function (resets current profile)
window.resetGame = function() {
    const currentProfile = GameState.currentProfile;
    if (confirm(`Are you sure you want to reset Profile ${currentProfile}? This will clear all progress for this profile and start fresh.`)) {
        // Reset game state for current profile
        GameState.reset();
        
        // Stop game loop
        GameLoop.stop();
        
        // Re-render everything
        ParkManager.render();
        if (typeof Upgrades !== 'undefined') {
            Upgrades.render();
        }
        UI.updateStats();
        UI.updateGunStats();
        UI.updateProfileDisplay();
        if (typeof UI.renderWeaponSelector === 'function') {
            UI.renderWeaponSelector();
        }
        if (typeof UI.renderWeaponShop === 'function') {
            UI.renderWeaponShop();
        }
        
        // Restart game loop
        GameLoop.start();
        
        UI.showNotification(`Profile ${currentProfile} reset! Starting fresh...`, 3000);
    }
};
