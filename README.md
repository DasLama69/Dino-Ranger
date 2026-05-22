# Dinosaur Ranger - Game Structure

This game has been split into separate, maintainable modules for easier development and debugging.

## File Structure

### Core Files
- **`index.html`** - Main HTML structure (markup only)
- **`styles.css`** - All CSS styling
- **`game-config.js`** - **ALL GAME VARIABLES** - Costs, stats, configurations (edit here to adjust game balance)

### Game Systems (JavaScript Modules)

1. **`game-state.js`** - Game state management
   - Handles save/load functionality
   - Manages the game state object
   - Initializes starting state

2. **`ui.js`** - UI helper functions
   - View switching
   - Stats display updates
   - Notifications
   - Gun stats display

3. **`park-manager.js`** - Park management system
   - Exhibit management (upgrade, buy new)
   - Visitor calculations
   - Income calculations
   - Dinosaur placement in exhibits
   - Rendering park view

4. **`hunting-game.js`** - Hunting minigame
   - Canvas-based hunting mechanics
   - Dinosaur spawning
   - Shooting mechanics
   - Capture handling
   - Animation loop

5. **`upgrades.js`** - Upgrade system
   - Gun upgrades
   - Character upgrades
   - Upgrade rendering
   - Upgrade validation

6. **`main.js`** - Main game loop and initialization
   - Game loop (income, visitors, etc.)
   - Initialization
   - Exposes functions for onclick handlers

## How to Adjust Game Variables

**ALL game variables are in `game-config.js`**. Edit this file to adjust:
- Starting money
- Exhibit costs
- Upgrade costs and values
- **Dinosaur species** - All specific dinosaurs with their stats
- **Rarity system** - Common, Rare, Epic, Legendary modifiers
- **Exhibit types** - Meat, Plant, Aquarium categories
- Gun stats
- Character stats
- Income rates
- Game loop intervals

## Dinosaur System

The game now uses:
- **Specific Species**: Allosaurus, Tyrannosaurus, Triceratops, etc.
- **Rarity System**: Each dinosaur can spawn as Common, Rare, Epic, or Legendary
  - Rarity affects appeal, value, and stats
  - A Legendary Triceratops is possible!
- **Exhibit Categories**: 
  - 🥩 **Meat Exhibit** - For carnivores
  - 🌿 **Plant Exhibit** - For herbivores
  - 🌊 **Aquatic Exhibit** - For aquatic dinosaurs

## Development Workflow

- **Park Management**: Edit `park-manager.js`
- **Hunting Game**: Edit `hunting-game.js`
- **Upgrades**: Edit `upgrades.js`
- **UI**: Edit `ui.js` or `styles.css`
- **Game Balance**: Edit `game-config.js`

Each module is self-contained and communicates through the `GameState` object and helper functions.
