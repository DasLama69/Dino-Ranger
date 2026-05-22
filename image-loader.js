// ============================================
// IMAGE LOADING & PRELOADING SYSTEM
// ============================================

const ImageLoader = {
    images: {},
    loaded: false,
    loadProgress: 0,

    // Load a single image
    loadImage(src) {
        return new Promise((resolve, reject) => {
            if (this.images[src]) {
                resolve(this.images[src]);
                return;
            }

            const img = new Image();
            img.onload = () => {
                this.images[src] = img;
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Failed to load image: ${src}`);
                // Return null if image fails - will use emoji fallback
                resolve(null);
            };
            img.src = src;
        });
    },

    // Preload all dinosaur images
    async preloadDinosaurImages() {
        const species = Object.keys(GameConfig.DINOSAUR_SPECIES);
        const total = species.length;
        let loaded = 0;

        const promises = species.map(async (speciesName) => {
            const dinoSpecies = GameConfig.DINOSAUR_SPECIES[speciesName];
            const img = await this.loadImage(dinoSpecies.image);
            loaded++;
            this.loadProgress = Math.floor((loaded / total) * 100);
            return img;
        });

        await Promise.all(promises);
        this.loaded = true;
        console.log('All dinosaur images loaded');
    },

    // Get image for a dinosaur species
    getImage(speciesName) {
        const dinoSpecies = GameConfig.DINOSAUR_SPECIES[speciesName];
        if (!dinoSpecies) return null;

        const image = this.images[dinoSpecies.image];
        return image || null; // Return null if not loaded, will use emoji fallback
    },

    // Check if image is loaded
    isImageLoaded(speciesName) {
        const dinoSpecies = GameConfig.DINOSAUR_SPECIES[speciesName];
        if (!dinoSpecies) return false;
        return !!this.images[dinoSpecies.image];
    },

    // Preload all weapon images
    async preloadWeaponImages() {
        const weapons = Object.keys(GameConfig.WEAPONS);
        const promises = weapons.map(async (weaponId) => {
            const weaponConfig = GameConfig.WEAPONS[weaponId];
            if (weaponConfig && weaponConfig.image) {
                await this.loadImage(weaponConfig.image);
            }
        });
        await Promise.all(promises);
        console.log('All weapon images loaded');
    }
};
