// ============================================
// GAME HELPER FUNCTIONS
// Shared utility functions for math, distance, vision, etc.
// ============================================

const GameHelpers = {
    // Get toroidal distance (accounting for wraparound)
    getToroidalDistance(x1, y1, x2, y2, canvasWidth, canvasHeight) {
        let dx = Math.abs(x2 - x1);
        let dy = Math.abs(y2 - y1);
        
        // Account for wraparound - take the shorter path
        if (dx > canvasWidth / 2) {
            dx = canvasWidth - dx;
        }
        if (dy > canvasHeight / 2) {
            dy = canvasHeight - dy;
        }
        
        return Math.sqrt(dx * dx + dy * dy);
    },

    // Get toroidal direction (accounting for wraparound)
    getToroidalDirection(x1, y1, x2, y2, canvasWidth, canvasHeight) {
        let dx = x2 - x1;
        let dy = y2 - y1;
        
        // Account for wraparound
        if (dx > canvasWidth / 2) {
            dx = dx - canvasWidth;
        } else if (dx < -canvasWidth / 2) {
            dx = dx + canvasWidth;
        }
        
        if (dy > canvasHeight / 2) {
            dy = dy - canvasHeight;
        } else if (dy < -canvasHeight / 2) {
            dy = dy + canvasHeight;
        }
        
        return Math.atan2(dy, dx);
    },

    // Normalize angle to 0-2π
    normalizeAngle(angle) {
        while (angle < 0) angle += Math.PI * 2;
        while (angle >= Math.PI * 2) angle -= Math.PI * 2;
        return angle;
    },

    // Check if dino can see player (vision cone)
    // Note: This is a basic version. For full implementation with bush checking,
    // the calling code should handle that separately
    checkVisionCone(dino, player, range, angle, canvasWidth, canvasHeight) {
        const dist = this.getToroidalDistance(dino.x, dino.y, player.x, player.y, canvasWidth, canvasHeight);
        
        // Check if in range
        if (dist > range) return false;
        
        // Check if within vision angle (using toroidal direction)
        const angleToPlayer = this.getToroidalDirection(dino.x, dino.y, player.x, player.y, canvasWidth, canvasHeight);
        const angleDiff = Math.abs(this.normalizeAngle(angleToPlayer - dino.direction));
        
        return angleDiff <= angle / 2 || angleDiff >= (Math.PI * 2 - angle / 2);
    },

    // Clamp position to walkable bounds (basic rectangle version)
    clampToWalkableBounds(x, y, size, bounds) {
        return {
            x: Math.max(bounds.x + size, Math.min(bounds.x + bounds.width - size, x)),
            y: Math.max(bounds.y + size, Math.min(bounds.y + bounds.height - size, y))
        };
    }
};

// Expose globally
window.GameHelpers = GameHelpers;
