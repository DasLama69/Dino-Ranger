// ============================================
// PARK MANAGEMENT SYSTEM
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

const ParkManager = {
    // Track which exhibit lists are open
    openExhibits: new Set(),

    // Get visitor count for an exhibit
    getExhibitVisitors(exhibit) {
        let total = 0;
        exhibit.dinos.forEach(dino => {
            const dinoSpecies = GameConfig.DINOSAUR_SPECIES[dino.species];
            const rarity = GameConfig.RARITY[dino.rarity] || GameConfig.RARITY.common;
            const appeal = dino.appeal; // Already calculated with rarity
            total += Math.floor(
                appeal * 
                dino.level * 
                exhibit.level * 
                GameConfig.PARK.VISITORS_PER_APPEAL_MULTIPLIER
            );
        });
        return total;
    },

    // Get income per minute for an exhibit
    getExhibitIncome(exhibit) {
        let income = 0;
        exhibit.dinos.forEach(dino => {
            const appeal = dino.appeal; // Already calculated with rarity
            const baseIncome = appeal * dino.level * exhibit.level;
            income += baseIncome * GameConfig.PARK.INCOME_PER_VISITOR_PER_MINUTE;
        });
        return income;
    },

    // Get upgrade cost for an exhibit level
    getExhibitUpgradeCost(level) {
        const cost = GameConfig.PARK.EXHIBIT_UPGRADE_BASE_COST * 
                     Math.pow(GameConfig.PARK.EXHIBIT_UPGRADE_MULTIPLIER, level - 1);
        // Round to 2 decimal places to avoid floating point precision issues
        return Math.round(cost * 100) / 100;
    },

    // Upgrade an exhibit
    upgradeExhibit(exhibitIdx) {
        const state = GameState.get();
        const exhibit = state.exhibits[exhibitIdx];
        const cost = this.getExhibitUpgradeCost(exhibit.level);
        
        if (state.money >= cost) {
            state.money -= cost;
            exhibit.level += 1;
            
            // Play purchase sound
            if (typeof SoundManager !== 'undefined') {
                SoundManager.playSound('purchase');
            }
            
            this.render();
            UI.updateStats();
            UI.showNotification(`Exhibit upgraded to level ${exhibit.level}!`);
            return true;
        }
        return false;
    },


    // Add dinosaur to exhibit (checks if compatible)
    addDinoToExhibit(dino, exhibitIdx) {
        const state = GameState.get();
        if (exhibitIdx >= state.exhibits.length) return false;
        
        const exhibit = state.exhibits[exhibitIdx];
        const dinoSpecies = GameConfig.DINOSAUR_SPECIES[dino.species];
        
        // Check if dinosaur category matches exhibit type
        const exhibitType = GameConfig.EXHIBIT_TYPES[exhibit.type];
        if (!exhibitType.allowedCategories.includes(dinoSpecies.category)) {
            UI.showNotification(`${dinoSpecies.name} cannot be placed in a ${exhibitType.name}!`, 4000);
            return false;
        }
        
        // Check for duplicate (same species and rarity)
        const existingDino = exhibit.dinos.find(existing => 
            existing.species === dino.species && existing.rarity === dino.rarity
        );
        
        if (existingDino) {
            // Duplicate found - increase level instead of adding new one
            const maxLevel = GameConfig.PARK.DINO_MAX_LEVEL || 10;
            if (existingDino.level < maxLevel) {
                existingDino.level++;
                // Recalculate appeal based on new level
                const rarity = GameConfig.RARITY[existingDino.rarity] || GameConfig.RARITY.common;
                const baseAppeal = dinoSpecies.baseAppeal + rarity.appealBonus;
                // Appeal scales with level (you might want to adjust this formula)
                existingDino.appeal = baseAppeal * existingDino.level;
                
                this.render();
                UI.updateStats();
                UI.showNotification(`${dinoSpecies.name} leveled up to Level ${existingDino.level}!`);
                return true;
            } else {
                UI.showNotification(`${dinoSpecies.name} is already at max level (${maxLevel})!`);
                return false;
            }
        } else {
            // New dinosaur - add to exhibit
            exhibit.dinos.push(dino);
            this.render();
            UI.updateStats();
            UI.showNotification('Dinosaur added to exhibit!');
            return true;
        }
    },

    // Render park view
    render() {
        const state = GameState.get();
        
        // Update park title with profile name
        const parkTitle = document.getElementById('park-title');
        if (parkTitle) {
            const profileName = GameState.getProfileName(GameState.currentProfile);
            parkTitle.textContent = `${profileName}'s Dinosaur Park`;
        }
        
        // Save which exhibits have open lists before clearing
        const previouslyOpen = new Set();
        state.exhibits.forEach((exhibit, idx) => {
            const display = document.getElementById(`dino-display-${idx}`);
            if (display && display.style.display !== 'none' && window.getComputedStyle(display).display !== 'none') {
                previouslyOpen.add(idx);
            }
        });
        
        // Update our tracking set
        this.openExhibits = previouslyOpen;
        
        const grid = document.getElementById('exhibit-grid');
        grid.innerHTML = '';
        
        state.exhibits.forEach((exhibit, idx) => {
            const exhibitDiv = document.createElement('div');
            exhibitDiv.className = 'exhibit';
            
            // Get exhibit type info
            const exhibitType = GameConfig.EXHIBIT_TYPES[exhibit.type] || GameConfig.EXHIBIT_TYPES.meat;
            
            const visitors = this.getExhibitVisitors(exhibit);
            const income = this.getExhibitIncome(exhibit);
            const upgradeCost = this.getExhibitUpgradeCost(exhibit.level);
            
            // Round income to avoid floating point precision issues
            const roundedIncome = Math.round(income * 100) / 100;
            
            // Build dinosaur management UI
            const dinoCount = exhibit.dinos.length;
            const dinoHTML = this.renderDinoList(exhibit.dinos, idx);
            
            exhibitDiv.innerHTML = `
                <h3>${exhibitType.icon} ${exhibitType.name} (Level ${exhibit.level})</h3>
                <div class="exhibit-stats">
                    <div class="visitor-count">👥 Visitors: ${visitors}</div>
                    <div class="income-display">💰 Income: $${formatMoney(roundedIncome)}/min</div>
                    <div class="dino-count">🦕 Dinosaurs: ${dinoCount}</div>
                </div>
                ${dinoHTML}
                <button class="upgrade-btn" onclick="ParkManager.upgradeExhibit(${idx})" 
                        ${state.money < upgradeCost ? 'disabled' : ''}>
                    Upgrade Exhibit ($${formatMoney(upgradeCost)})
                </button>
            `;
            grid.appendChild(exhibitDiv);
            
            // Restore open state if it was previously open
            if (this.openExhibits.has(idx)) {
                setTimeout(() => {
                    const display = document.getElementById(`dino-display-${idx}`);
                    const filters = document.getElementById(`dino-filters-${idx}`);
                    const icon = document.getElementById(`dino-toggle-icon-${idx}`);
                    const listView = document.getElementById(`dino-list-view-${idx}`);
                    const groupView = document.getElementById(`dino-group-view-${idx}`);
                    const compactBtn = document.getElementById(`compact-view-btn-${idx}`);
                    const listBtn = document.getElementById(`list-view-btn-${idx}`);
                    if (display && icon) {
                        display.style.display = 'block';
                        icon.textContent = '▲';
                        // Ensure compact view is shown by default (filters hidden)
                        if (listView && groupView) {
                            listView.style.display = 'none';
                            groupView.style.display = 'grid';
                            if (filters) filters.style.display = 'none';
                        }
                        // Set button states
                        if (compactBtn) compactBtn.classList.add('active');
                        if (listBtn) listBtn.classList.remove('active');
                    }
                }, 0);
            }
        });

        this.renderShop();
    },

    // Render park shop
    renderShop() {
        const state = GameState.get();
        const shop = document.getElementById('park-shop');
        
        // Check unlock status
        if (!state.unlockedExhibitTypes) {
            state.unlockedExhibitTypes = {
                plant: true,   // Starting exhibit
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
        
        const exhibitTypes = Object.keys(GameConfig.EXHIBIT_TYPES);
        
        shop.innerHTML = exhibitTypes.map(exhibitType => {
            const typeData = GameConfig.EXHIBIT_TYPES[exhibitType];
            const isUnlocked = state.unlockedExhibitTypes[exhibitType] || false;
            const existingCount = state.exhibits.filter(e => e.type === exhibitType).length;
            
            // If locked, show unlock button
            if (!isUnlocked) {
                const unlockCost = typeData.unlockCost || 1000;
                const canAfford = state.money >= unlockCost;
                
                return `
                    <div class="shop-item" style="opacity: 0.7;">
                        <div class="shop-item-info">
                            <h3>🔒 ${typeData.icon} ${typeData.name} (Locked)</h3>
                            <p>${typeData.description}</p>
                        </div>
                        <button class="btn" onclick="ParkManager.unlockExhibitType('${exhibitType}')" 
                                ${!canAfford ? 'disabled' : ''}>
                            Unlock ($${formatMoney(unlockCost)})
                        </button>
                    </div>
                `;
            }
            
            // If unlocked, show buy button only if no exhibit of this type exists
            const hasExhibit = existingCount > 0;
            
            if (hasExhibit) {
                // Already have an exhibit of this type - don't show buy button
                return `
                    <div class="shop-item" style="opacity: 0.7;">
                        <div class="shop-item-info">
                            <h3>${typeData.icon} ${typeData.name}</h3>
                            <p>${typeData.description} (Owned)</p>
                        </div>
                        <button class="btn" disabled>
                            Owned
                        </button>
                    </div>
                `;
            }
            
            // Don't have this exhibit yet - show buy button
            const cost = GameConfig.PARK.NEW_EXHIBIT_COST;
            const canAfford = state.money >= cost;
            
            return `
                <div class="shop-item">
                    <div class="shop-item-info">
                        <h3>${typeData.icon} New ${typeData.name}</h3>
                        <p>${typeData.description}</p>
                    </div>
                    <button class="btn" onclick="ParkManager.buyExhibit('${exhibitType}')" 
                            ${!canAfford ? 'disabled' : ''}>
                        Buy ($${formatMoney(cost)})
                    </button>
                </div>
            `;
        }).join('');
    },
    
    // Unlock an exhibit type
    unlockExhibitType(exhibitType) {
        const state = GameState.get();
        const typeData = GameConfig.EXHIBIT_TYPES[exhibitType];
        
        if (!typeData) return false;
        
        // Initialize unlock state if needed
        if (!state.unlockedExhibitTypes) {
            state.unlockedExhibitTypes = {
                plant: true,
                meat: false,
                aquarium: false
            };
        }
        
        // Check if already unlocked
        if (state.unlockedExhibitTypes[exhibitType]) {
            UI.showNotification(`${typeData.name} is already unlocked!`);
            return false;
        }
        
        const unlockCost = typeData.unlockCost || 1000;
        if (state.money < unlockCost) {
            UI.showNotification(`Not enough money! Need $${formatMoney(unlockCost)}`);
            return false;
        }
        
        state.money -= unlockCost;
        state.unlockedExhibitTypes[exhibitType] = true;
        
        // Play purchase sound
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playSound('purchase');
        }
        
        this.render();
        UI.updateStats();
        UI.showNotification(`${typeData.name} unlocked! You can now build ${typeData.name}s.`);
        return true;
    },
    
    // Buy a new exhibit of specific type
    buyExhibit(exhibitType) {
        const state = GameState.get();
        const cost = GameConfig.PARK.NEW_EXHIBIT_COST;
        const typeData = GameConfig.EXHIBIT_TYPES[exhibitType];
        
        if (!typeData) return false;
        if (state.money < cost) return false;
        
        // Check if an exhibit of this type already exists - only allow one per type
        const existingCount = state.exhibits.filter(e => e.type === exhibitType).length;
        if (existingCount > 0) {
            UI.showNotification(`You already have a ${typeData.name}! Upgrade your existing exhibit instead.`, 3000);
            return false;
        }
        
        state.money -= cost;
        state.exhibits.push({
            id: state.exhibits.length,
            type: exhibitType,
            level: 1,
            dinos: []
        });
        
        // Play purchase sound
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playSound('purchase');
        }
        
        this.render();
        UI.updateStats();
        UI.showNotification(`New ${typeData.name} built!`);
        return true;
    },

    // Render dinosaur list with management controls
    renderDinoList(dinos, exhibitIdx) {
        if (dinos.length === 0) {
            const exhibit = GameState.get().exhibits[exhibitIdx];
            const exhibitType = GameConfig.EXHIBIT_TYPES[exhibit.type] || GameConfig.EXHIBIT_TYPES.meat;
            return `<p class="empty-exhibit">Empty ${exhibitType.name}</p>`;
        }

        // Group by species for compact view
        const groupedBySpecies = {};
        dinos.forEach(dino => {
            if (!groupedBySpecies[dino.species]) {
                groupedBySpecies[dino.species] = [];
            }
            groupedBySpecies[dino.species].push(dino);
        });

        // Build filter and sort controls
        const controlsHTML = `
            <div class="dino-controls">
                <div class="dino-controls-row">
                    <button class="dino-toggle-btn" onclick="event.stopPropagation(); event.preventDefault(); ParkManager.toggleDinoList(${exhibitIdx}, event)">
                        <span id="dino-toggle-icon-${exhibitIdx}">▼</span> Show Dinosaurs (${dinos.length})
                    </button>
                    <div class="view-buttons">
                        <button class="view-btn active" id="compact-view-btn-${exhibitIdx}" onclick="ParkManager.setDinoView(${exhibitIdx}, 'compact')" title="Compact view">
                            📊 Compact
                        </button>
                        <button class="view-btn" id="list-view-btn-${exhibitIdx}" onclick="ParkManager.setDinoView(${exhibitIdx}, 'list')" title="List view">
                            📋 List
                        </button>
                    </div>
                </div>
                <div class="dino-filters" id="dino-filters-${exhibitIdx}" style="display: none;">
                    <input type="text" class="dino-search" id="dino-search-${exhibitIdx}" 
                           placeholder="Search dinosaurs..." 
                           oninput="ParkManager.filterDinos(${exhibitIdx})">
                    <div class="filter-buttons">
                        <button class="filter-btn active" onclick="ParkManager.setDinoFilter(${exhibitIdx}, 'all')">All</button>
                        <button class="filter-btn" onclick="ParkManager.setDinoFilter(${exhibitIdx}, 'common')">Common</button>
                        <button class="filter-btn" onclick="ParkManager.setDinoFilter(${exhibitIdx}, 'rare')">Rare</button>
                        <button class="filter-btn" onclick="ParkManager.setDinoFilter(${exhibitIdx}, 'epic')">Epic</button>
                        <button class="filter-btn" onclick="ParkManager.setDinoFilter(${exhibitIdx}, 'legendary')">Legendary</button>
                    </div>
                    <div class="sort-buttons">
                        <span class="sort-label">Sort:</span>
                        <button class="sort-btn" onclick="ParkManager.sortDinos(${exhibitIdx}, 'level')">Level</button>
                        <button class="sort-btn" onclick="ParkManager.sortDinos(${exhibitIdx}, 'name')">Name</button>
                        <button class="sort-btn" onclick="ParkManager.sortDinos(${exhibitIdx}, 'rarity')">Rarity</button>
                    </div>
                </div>
            </div>
        `;

        // Build dinosaur list HTML
        const dinoListHTML = dinos.map((dino, dinoIdx) => {
            const dinoSpecies = GameConfig.DINOSAUR_SPECIES[dino.species];
            const rarity = GameConfig.RARITY[dino.rarity] || GameConfig.RARITY.common;
            const displayContent = `<img src="${dinoSpecies.image}" alt="${dinoSpecies.name}" class="dino-image-small" style="border: 2px solid ${rarity.color};" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" />
                <span class="dino-emoji" style="display:none;">${dinoSpecies.emoji}</span>`;
            
            const rarityBadge = dino.rarity !== 'common' 
                ? `<span class="rarity-badge" style="background: ${rarity.color};">${rarity.name}</span>`
                : '';
            
            return `<div class="dino-info" data-rarity="${dino.rarity}" data-species="${dino.species}" data-name="${dinoSpecies.name.toLowerCase()}" data-level="${dino.level}" data-exhibit-idx="${exhibitIdx}" data-dino-idx="${dinoIdx}" onclick="ParkManager.showDinoDetails(${exhibitIdx}, ${dinoIdx})">
                ${displayContent}
                <div class="dino-name-container">
                    <span class="dino-name">${dinoSpecies.name} (Level ${dino.level})</span>
                    ${rarityBadge}
                </div>
            </div>`;
        }).join('');

        // Build grouped view HTML (compact) - grouped by species, then by rarity
        const groupedHTML = Object.entries(groupedBySpecies).map(([species, speciesDinos]) => {
            const dinoSpecies = GameConfig.DINOSAUR_SPECIES[species];
            
            // Group by rarity within this species
            const byRarity = {};
            speciesDinos.forEach(dino => {
                if (!byRarity[dino.rarity]) {
                    byRarity[dino.rarity] = [];
                }
                byRarity[dino.rarity].push(dino);
            });
            
            // Build rarity list in order: Legendary, Epic, Rare, Common
            const rarityOrder = ['legendary', 'epic', 'rare', 'common'];
            const rarityList = rarityOrder
                .filter(rarity => byRarity[rarity])
                .map(rarity => {
                    const rarityData = GameConfig.RARITY[rarity];
                    const rarityLetter = rarity.charAt(0).toUpperCase();
                    const levels = byRarity[rarity].map(d => d.level).join(', ');
                    // Show first level if multiple of same rarity
                    const levelDisplay = byRarity[rarity].length > 1 
                        ? `Lvls ${levels}` 
                        : `Lvl ${byRarity[rarity][0].level}`;
                    return `<div class="rarity-level-item" style="border-left: 3px solid ${rarityData.color};">
                        <span class="rarity-letter" style="color: ${rarityData.color}; font-weight: bold;">${rarityLetter}</span>
                        <span class="rarity-equals">=</span>
                        <span class="rarity-level">${levelDisplay}</span>
                    </div>`;
                }).join('');
            
            // For grouped view, clicking shows details of the first dino of that species
            // Find the first dino index in the original dinos array
            const firstDino = speciesDinos[0];
            const firstDinoIdx = dinos.findIndex(d => d === firstDino);
            
            return `<div class="dino-group" data-species="${species}" data-name="${dinoSpecies.name.toLowerCase()}" data-exhibit-idx="${exhibitIdx}" onclick="ParkManager.showSpeciesDetails(${exhibitIdx}, '${species}')">
                <div class="dino-group-image">
                    <img src="${dinoSpecies.image}" alt="${dinoSpecies.name}" class="dino-image-tiny" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" />
                    <span class="dino-emoji-tiny" style="display:none;">${dinoSpecies.emoji}</span>
                </div>
                <div class="dino-group-info">
                    <div class="dino-group-name">${dinoSpecies.name}</div>
                    <div class="dino-group-rarities">
                        ${rarityList}
                    </div>
                </div>
            </div>`;
        }).join('');

        return `
            ${controlsHTML}
            <div class="dino-display" id="dino-display-${exhibitIdx}" style="display: none;">
                <div class="dino-list-view" id="dino-list-view-${exhibitIdx}" style="display: none;">
                    ${dinoListHTML}
                </div>
                <div class="dino-group-view" id="dino-group-view-${exhibitIdx}">
                    ${groupedHTML}
                </div>
            </div>
        `;
    },

    // Toggle dinosaur list visibility
    toggleDinoList(exhibitIdx, evt) {
        // Prevent event propagation
        if (evt) {
            evt.stopPropagation();
            evt.preventDefault();
        } else if (window.event) {
            window.event.stopPropagation();
            window.event.preventDefault();
        }
        
        const display = document.getElementById(`dino-display-${exhibitIdx}`);
        const filters = document.getElementById(`dino-filters-${exhibitIdx}`);
        const icon = document.getElementById(`dino-toggle-icon-${exhibitIdx}`);
        
        if (!display || !filters || !icon) {
            console.warn('Could not find dinosaur display elements for exhibit', exhibitIdx);
            return;
        }
        
        // Check current state more reliably
        const computedStyle = window.getComputedStyle(display);
        const isHidden = computedStyle.display === 'none' || display.style.display === 'none';
        
        if (isHidden) {
            display.style.display = 'block';
            icon.textContent = '▲';
            this.openExhibits.add(exhibitIdx);
            // Only show filters if in list view
            const listView = document.getElementById(`dino-list-view-${exhibitIdx}`);
            if (listView && listView.style.display !== 'none') {
                filters.style.display = 'block';
            } else {
                filters.style.display = 'none';
            }
        } else {
            display.style.display = 'none';
            filters.style.display = 'none';
            icon.textContent = '▼';
            this.openExhibits.delete(exhibitIdx);
        }
    },

    // Set dinosaur view (compact or list)
    setDinoView(exhibitIdx, viewType) {
        const listView = document.getElementById(`dino-list-view-${exhibitIdx}`);
        const groupView = document.getElementById(`dino-group-view-${exhibitIdx}`);
        const filters = document.getElementById(`dino-filters-${exhibitIdx}`);
        const compactBtn = document.getElementById(`compact-view-btn-${exhibitIdx}`);
        const listBtn = document.getElementById(`list-view-btn-${exhibitIdx}`);
        
        if (viewType === 'compact') {
            // Show compact view, hide list view
            listView.style.display = 'none';
            groupView.style.display = 'grid';
            // Hide filters (they only work in list view)
            if (filters) filters.style.display = 'none';
            // Update button states
            if (compactBtn) compactBtn.classList.add('active');
            if (listBtn) listBtn.classList.remove('active');
        } else {
            // Show list view, hide compact view
            listView.style.display = 'block';
            groupView.style.display = 'none';
            // Show filters (they work in list view)
            if (filters) filters.style.display = 'block';
            // Update button states
            if (compactBtn) compactBtn.classList.remove('active');
            if (listBtn) listBtn.classList.add('active');
        }
    },

    // Filter dinosaurs by rarity
    setDinoFilter(exhibitIdx, rarity) {
        const display = document.getElementById(`dino-display-${exhibitIdx}`);
        const dinos = display.querySelectorAll('.dino-info, .dino-group');
        const buttons = document.querySelectorAll(`#dino-filters-${exhibitIdx} .filter-btn`);
        
        // Update active button
        buttons.forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        
        // Filter dinosaurs
        dinos.forEach(dino => {
            if (rarity === 'all' || dino.dataset.rarity === rarity) {
                dino.style.display = '';
            } else {
                dino.style.display = 'none';
            }
        });
    },

    // Search dinosaurs
    filterDinos(exhibitIdx) {
        const searchInput = document.getElementById(`dino-search-${exhibitIdx}`);
        const searchTerm = searchInput.value.toLowerCase();
        const display = document.getElementById(`dino-display-${exhibitIdx}`);
        const dinos = display.querySelectorAll('.dino-info, .dino-group');
        
        dinos.forEach(dino => {
            const name = dino.dataset.name || '';
            const species = dino.dataset.species || '';
            if (name.includes(searchTerm) || species.includes(searchTerm)) {
                dino.style.display = '';
            } else {
                dino.style.display = 'none';
            }
        });
    },

    // Sort dinosaurs
    sortDinos(exhibitIdx, sortBy) {
        const display = document.getElementById(`dino-display-${exhibitIdx}`);
        const listView = document.getElementById(`dino-list-view-${exhibitIdx}`);
        const dinos = Array.from(listView.querySelectorAll('.dino-info'));
        
        dinos.sort((a, b) => {
            if (sortBy === 'level') {
                return parseInt(b.dataset.level) - parseInt(a.dataset.level);
            } else if (sortBy === 'name') {
                return a.dataset.name.localeCompare(b.dataset.name);
            } else if (sortBy === 'rarity') {
                const rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
                return rarityOrder[b.dataset.rarity] - rarityOrder[a.dataset.rarity];
            }
            return 0;
        });
        
        // Re-append in sorted order
        dinos.forEach(dino => listView.appendChild(dino));
    },
    
    // Show detailed dinosaur information modal
    showDinoDetails(exhibitIdx, dinoIdx) {
        const state = GameState.get();
        const exhibit = state.exhibits[exhibitIdx];
        if (!exhibit || !exhibit.dinos || dinoIdx >= exhibit.dinos.length || dinoIdx < 0) return;
        
        const dino = exhibit.dinos[dinoIdx];
        const dinoSpecies = GameConfig.DINOSAUR_SPECIES[dino.species];
        const rarity = GameConfig.RARITY[dino.rarity] || GameConfig.RARITY.common;
        const exhibitType = GameConfig.EXHIBIT_TYPES[exhibit.type] || GameConfig.EXHIBIT_TYPES.meat;
        
        // Calculate stats
        const baseAppeal = dinoSpecies.baseAppeal + rarity.appealBonus;
        const currentAppeal = dino.appeal || baseAppeal;
        const visitors = Math.floor(
            currentAppeal * 
            dino.level * 
            exhibit.level * 
            GameConfig.PARK.VISITORS_PER_APPEAL_MULTIPLIER
        );
        const income = currentAppeal * dino.level * exhibit.level * GameConfig.PARK.INCOME_PER_VISITOR_PER_MINUTE;
        
        // Calculate value
        const value = Math.floor(dinoSpecies.baseValue * rarity.valueMultiplier);
        const sellPrice = Math.floor(value * GameConfig.HUNTING.SELL_PRICE_MULTIPLIER);
        
        // Create modal HTML
        const modalHTML = `
            <div class="dino-detail-overlay" onclick="ParkManager.closeDinoDetails(event)">
                <div class="dino-detail-modal" onclick="event.stopPropagation()">
                    <button class="dino-detail-close" onclick="ParkManager.closeDinoDetails()">&times;</button>
                    <div class="dino-detail-header">
                        <div class="dino-detail-image-container">
                            <img src="${dinoSpecies.image}" alt="${dinoSpecies.name}" class="dino-detail-image" style="border: 4px solid ${rarity.color}; box-shadow: 0 0 30px ${rarity.color}; cursor: pointer;" onclick="ParkManager.showFullscreenImage('${dinoSpecies.image}', '${dinoSpecies.emoji}', '${dinoSpecies.name}', '${rarity.color}')" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                            <span class="dino-detail-emoji" style="display:none; font-size: 200px; border: 4px solid ${rarity.color}; box-shadow: 0 0 30px ${rarity.color}; padding: 20px; border-radius: 15px; cursor: pointer;" onclick="ParkManager.showFullscreenImage('${dinoSpecies.image}', '${dinoSpecies.emoji}', '${dinoSpecies.name}', '${rarity.color}')">${dinoSpecies.emoji}</span>
                        </div>
                        <div class="dino-detail-title">
                            <h2>${dinoSpecies.name}</h2>
                            <span class="dino-detail-rarity-badge" style="background: ${rarity.color}; color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 16px; display: inline-block; margin-top: 10px;">
                                ${rarity.name}
                            </span>
                        </div>
                    </div>
                    <div class="dino-detail-stats">
                        <div class="dino-detail-stat-row">
                            <div class="dino-detail-stat-item">
                                <strong>Level:</strong> ${dino.level}
                            </div>
                            <div class="dino-detail-stat-item">
                                <strong>Category:</strong> ${dinoSpecies.category.charAt(0).toUpperCase() + dinoSpecies.category.slice(1)}
                            </div>
                        </div>
                        <div class="dino-detail-stat-row">
                            <div class="dino-detail-stat-item">
                                <strong>Appeal:</strong> ${Math.floor(currentAppeal)}
                            </div>
                            <div class="dino-detail-stat-item">
                                <strong>Base Appeal:</strong> ${dinoSpecies.baseAppeal}
                            </div>
                        </div>
                        <div class="dino-detail-stat-row">
                            <div class="dino-detail-stat-item">
                                <strong>Rarity Bonus:</strong> +${rarity.appealBonus}
                            </div>
                            <div class="dino-detail-stat-item">
                                <strong>Exhibit Level:</strong> ${exhibit.level}
                            </div>
                        </div>
                        <div class="dino-detail-stat-row">
                            <div class="dino-detail-stat-item">
                                <strong>Visitors:</strong> ${visitors}
                            </div>
                            <div class="dino-detail-stat-item">
                                <strong>Income:</strong> $${formatMoney(Math.round(income * 100) / 100)}/min
                            </div>
                        </div>
                        <div class="dino-detail-stat-row">
                            <div class="dino-detail-stat-item">
                                <strong>Base Value:</strong> $${formatMoney(value)}
                            </div>
                            <div class="dino-detail-stat-item">
                                <strong>Sell Price:</strong> $${formatMoney(sellPrice)}
                            </div>
                        </div>
                        <div class="dino-detail-stat-row">
                            <div class="dino-detail-stat-item">
                                <strong>Exhibit:</strong> ${exhibitType.icon} ${exhibitType.name}
                            </div>
                            <div class="dino-detail-stat-item">
                                <strong>Location:</strong> Exhibit #${exhibitIdx + 1}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.querySelector('.dino-detail-overlay');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    // Show all dinosaurs of a species (for compact view)
    showSpeciesDetails(exhibitIdx, species) {
        const state = GameState.get();
        const exhibit = state.exhibits[exhibitIdx];
        if (!exhibit || !exhibit.dinos) return;
        
        // Get all dinos of this species
        const speciesDinos = exhibit.dinos.filter(d => d.species === species);
        if (speciesDinos.length === 0) return;
        
        const dinoSpecies = GameConfig.DINOSAUR_SPECIES[species];
        const exhibitType = GameConfig.EXHIBIT_TYPES[exhibit.type] || GameConfig.EXHIBIT_TYPES.meat;
        
        // Group by rarity
        const byRarity = {};
        speciesDinos.forEach(dino => {
            if (!byRarity[dino.rarity]) {
                byRarity[dino.rarity] = [];
            }
            byRarity[dino.rarity].push(dino);
        });
        
        // Build rarity sections
        const rarityOrder = ['legendary', 'epic', 'rare', 'common'];
        const raritySections = rarityOrder
            .filter(rarity => byRarity[rarity])
            .map(rarity => {
                const rarityData = GameConfig.RARITY[rarity];
                const rarityDinos = byRarity[rarity];
                
                const dinoCards = rarityDinos.map(dino => {
                    const baseAppeal = dinoSpecies.baseAppeal + rarityData.appealBonus;
                    const currentAppeal = dino.appeal || baseAppeal;
                    const visitors = Math.floor(
                        currentAppeal * 
                        dino.level * 
                        exhibit.level * 
                        GameConfig.PARK.VISITORS_PER_APPEAL_MULTIPLIER
                    );
                    const income = currentAppeal * dino.level * exhibit.level * GameConfig.PARK.INCOME_PER_VISITOR_PER_MINUTE;
                    const value = Math.floor(dinoSpecies.baseValue * rarityData.valueMultiplier);
                    const sellPrice = Math.floor(value * GameConfig.HUNTING.SELL_PRICE_MULTIPLIER);
                    const dinoIdx = exhibit.dinos.findIndex(d => d === dino);
                    
                    return `
                        <div class="dino-rarity-card" onclick="ParkManager.showDinoDetails(${exhibitIdx}, ${dinoIdx})">
                            <div class="dino-rarity-card-header" style="background: ${rarityData.color};">
                                <span class="dino-rarity-level">Level ${dino.level}</span>
                            </div>
                            <div class="dino-rarity-card-body">
                                <div class="dino-rarity-stat">
                                    <strong>Appeal:</strong> ${Math.floor(currentAppeal)}
                                </div>
                                <div class="dino-rarity-stat">
                                    <strong>Visitors:</strong> ${visitors}
                                </div>
                                <div class="dino-rarity-stat">
                                    <strong>Income:</strong> $${formatMoney(Math.round(income * 100) / 100)}/min
                                </div>
                                <div class="dino-rarity-stat">
                                    <strong>Sell Price:</strong> $${formatMoney(sellPrice)}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                return `
                    <div class="dino-rarity-section">
                        <h3 class="dino-rarity-section-title" style="color: ${rarityData.color}; border-bottom: 3px solid ${rarityData.color};">
                            ${rarityData.name} (${rarityDinos.length})
                        </h3>
                        <div class="dino-rarity-cards">
                            ${dinoCards}
                        </div>
                    </div>
                `;
            }).join('');
        
        // Create modal HTML
        const modalHTML = `
            <div class="dino-detail-overlay" onclick="ParkManager.closeDinoDetails(event)">
                <div class="dino-detail-modal species-modal" onclick="event.stopPropagation()">
                    <button class="dino-detail-close" onclick="ParkManager.closeDinoDetails()">&times;</button>
                    <div class="dino-detail-header">
                        <div class="dino-detail-image-container">
                            <img src="${dinoSpecies.image}" alt="${dinoSpecies.name}" class="dino-detail-image" style="border: 4px solid #4CAF50; box-shadow: 0 0 30px rgba(76, 175, 80, 0.5); cursor: pointer;" onclick="ParkManager.showFullscreenImage('${dinoSpecies.image}', '${dinoSpecies.emoji}', '${dinoSpecies.name}', '#4CAF50')" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                            <span class="dino-detail-emoji" style="display:none; font-size: 200px; border: 4px solid #4CAF50; box-shadow: 0 0 30px rgba(76, 175, 80, 0.5); padding: 20px; border-radius: 15px; cursor: pointer;" onclick="ParkManager.showFullscreenImage('${dinoSpecies.image}', '${dinoSpecies.emoji}', '${dinoSpecies.name}', '#4CAF50')">${dinoSpecies.emoji}</span>
                        </div>
                        <div class="dino-detail-title">
                            <h2>${dinoSpecies.name}</h2>
                            <p style="color: #666; margin-top: 10px;">All Captured Variants</p>
                            <div class="dino-detail-meta">
                                <span><strong>Category:</strong> ${dinoSpecies.category.charAt(0).toUpperCase() + dinoSpecies.category.slice(1)}</span>
                                <span><strong>Exhibit:</strong> ${exhibitType.icon} ${exhibitType.name}</span>
                            </div>
                        </div>
                    </div>
                    <div class="dino-species-rarities">
                        ${raritySections}
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.querySelector('.dino-detail-overlay');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    // Show fullscreen image viewer
    showFullscreenImage(imageSrc, emoji, name, rarityColor) {
        // Store current modal state (hide it temporarily)
        const currentModal = document.querySelector('.dino-detail-overlay');
        if (currentModal) {
            currentModal.style.display = 'none';
            currentModal.dataset.preserved = 'true';
        }
        
        // Create fullscreen image viewer
        const fullscreenHTML = `
            <div class="dino-fullscreen-overlay" id="dino-fullscreen-overlay" onclick="ParkManager.closeFullscreenImage()">
                <div class="dino-fullscreen-container" onclick="event.stopPropagation()">
                    <button class="dino-fullscreen-close" onclick="ParkManager.closeFullscreenImage()">&times;</button>
                    <div class="dino-fullscreen-image-wrapper">
                        <img src="${imageSrc}" alt="${name}" class="dino-fullscreen-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                        <span class="dino-fullscreen-emoji" style="display:none; font-size: 400px; border: 6px solid ${rarityColor}; box-shadow: 0 0 50px ${rarityColor}; padding: 30px; border-radius: 20px;">${emoji}</span>
                    </div>
                    <div class="dino-fullscreen-name">${name}</div>
                </div>
            </div>
        `;
        
        // Add fullscreen viewer to page
        document.body.insertAdjacentHTML('beforeend', fullscreenHTML);
        
        // Add ESC key handler
        const escHandler = (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                ParkManager.closeFullscreenImage();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    },
    
    // Close fullscreen image viewer
    closeFullscreenImage() {
        const fullscreen = document.getElementById('dino-fullscreen-overlay');
        if (fullscreen) {
            fullscreen.remove();
        }
        
        // Restore previous modal if it was preserved
        const preservedModal = document.querySelector('.dino-detail-overlay[data-preserved="true"]');
        if (preservedModal) {
            preservedModal.style.display = 'flex';
            delete preservedModal.dataset.preserved;
        }
    },
    
    // Close dinosaur details modal
    closeDinoDetails(event) {
        if (event && event.target !== event.currentTarget) return;
        const modal = document.querySelector('.dino-detail-overlay');
        if (modal) {
            modal.remove();
        }
        // Also close fullscreen if open
        this.closeFullscreenImage();
    }
};
