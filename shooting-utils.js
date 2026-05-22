// ============================================
// SHOOTING UTILS - Shared shooting and aiming functions
// ============================================

const ShootingUtils = {
    // Handle mouse movement (simple version - no clamping)
    handleMouseMove(e, canvas, mouseState) {
        const rect = canvas.getBoundingClientRect();
        
        // Account for borders - getBoundingClientRect includes borders, but we need content area
        const computedStyle = getComputedStyle(canvas);
        const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
        const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
        
        // Content area (excluding borders)
        const contentWidth = rect.width - borderLeft - borderRight;
        const contentHeight = rect.height - borderTop - borderBottom;
        
        // Calculate letterbox offset (if canvas is letterboxed)
        // Canvas aspect ratio
        const canvasAspect = canvas.width / canvas.height;
        // Container aspect ratio (content area)
        const containerAspect = contentWidth / contentHeight;
        
        let letterboxTop = 0;
        let letterboxLeft = 0;
        let visibleWidth = contentWidth;
        let visibleHeight = contentHeight;
        
        if (canvasAspect > containerAspect) {
            // Canvas is wider - letterbox on top/bottom
            visibleHeight = contentWidth / canvasAspect;
            letterboxTop = (contentHeight - visibleHeight) / 2;
        } else {
            // Canvas is taller - letterbox on left/right
            visibleWidth = contentHeight * canvasAspect;
            letterboxLeft = (contentWidth - visibleWidth) / 2;
        }
        
        // Calculate scale factor (canvas might be scaled/stretched)
        const scaleX = canvas.width / visibleWidth;
        const scaleY = canvas.height / visibleHeight;
        
        // Calculate mouse position relative to content area
        let relativeX = e.clientX - rect.left - borderLeft;
        let relativeY = e.clientY - rect.top - borderTop;
        
        // Subtract letterbox offset
        relativeX -= letterboxLeft;
        relativeY -= letterboxTop;
        
        // Clamp to visible area bounds (so crosshair stays at edge when mouse goes into letterbox)
        relativeX = Math.max(0, Math.min(visibleWidth, relativeX));
        relativeY = Math.max(0, Math.min(visibleHeight, relativeY));
        
        // Convert to canvas coordinates
        mouseState.x = relativeX * scaleX;
        mouseState.y = relativeY * scaleY;
        
        // Clamp to canvas bounds (safety check)
        mouseState.x = Math.max(0, Math.min(canvas.width, mouseState.x));
        mouseState.y = Math.max(0, Math.min(canvas.height, mouseState.y));
        
        mouseState.lastX = mouseState.x;
        mouseState.lastY = mouseState.y;
        mouseState.inCanvas = true;
    },

    // Calculate target position from event or mouse state
    getTargetPosition(event, canvas, mouseState) {
        // If event has clientX/clientY, it's a real mouse event - convert to canvas coordinates
        // If event has x/y or we use mouseState, it's already in canvas coordinates
        if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
            const rect = canvas.getBoundingClientRect();
            
            // Account for borders - getBoundingClientRect includes borders, but we need content area
            const computedStyle = getComputedStyle(canvas);
            const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
            const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
            const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
            const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
            
            // Content area (excluding borders)
            const contentWidth = rect.width - borderLeft - borderRight;
            const contentHeight = rect.height - borderTop - borderBottom;
            
            // Calculate letterbox offset (if canvas is letterboxed)
            const canvasAspect = canvas.width / canvas.height;
            const containerAspect = contentWidth / contentHeight;
            
            let letterboxTop = 0;
            let letterboxLeft = 0;
            let visibleWidth = contentWidth;
            let visibleHeight = contentHeight;
            
            if (canvasAspect > containerAspect) {
                // Canvas is wider - letterbox on top/bottom
                visibleHeight = contentWidth / canvasAspect;
                letterboxTop = (contentHeight - visibleHeight) / 2;
            } else {
                // Canvas is taller - letterbox on left/right
                visibleWidth = contentHeight * canvasAspect;
                letterboxLeft = (contentWidth - visibleWidth) / 2;
            }
            
            // Calculate scale factor
            const scaleX = canvas.width / visibleWidth;
            const scaleY = canvas.height / visibleHeight;
            
            // Calculate position relative to content area
            let relativeX = event.clientX - rect.left - borderLeft;
            let relativeY = event.clientY - rect.top - borderTop;
            
            // Subtract letterbox offset
            relativeX -= letterboxLeft;
            relativeY -= letterboxTop;
            
            // Clamp to visible area bounds
            relativeX = Math.max(0, Math.min(visibleWidth, relativeX));
            relativeY = Math.max(0, Math.min(visibleHeight, relativeY));
            
            return {
                x: relativeX * scaleX,
                y: relativeY * scaleY
            };
        } else {
            // Use mouse state directly (already in canvas coordinates)
            return {
                x: mouseState.x || mouseState.lastX || 0,
                y: mouseState.y || mouseState.lastY || 0
            };
        }
    },

    // Simple shoot function (like sandbox - no accuracy calculations)
    shootSimple(event, canvas, player, mouseState, bullets, gun, lastShot) {
        const now = Date.now();
        if (now - lastShot < gun.reloadSpeed * 1000) return false;

        const target = this.getTargetPosition(event, canvas, mouseState);
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const angle = Math.atan2(dy, dx);

        // Play sound
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playSound('shoot');
        }

        // Get weapon-specific bullet speed
        const bulletSpeed = gun.bulletSpeed || GameConfig.GUN.BULLET_SPEED;
        
        // Create bullet
        const bullet = {
            x: player.x,
            y: player.y,
            vx: Math.cos(angle) * bulletSpeed,
            vy: Math.sin(angle) * bulletSpeed,
            angle: angle,
            trail: [] // For tracer effect
        };

        bullets.push(bullet);
        return now; // Return new lastShot time
    },

    // Advanced shoot function (with accuracy calculations for hunting game)
    shootAdvanced(event, canvas, player, mouseState, bullets, gun, lastShot) {
        const now = Date.now();
        if (now - lastShot < gun.reloadSpeed * 1000) return { lastShot, bullet: null };

        const target = this.getTargetPosition(event, canvas, mouseState);
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const angle = Math.atan2(dy, dx);
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Calculate accuracy based on distance
        let actualAccuracy = 100; // Within range is always 100%
        let isInRange = dist <= gun.range;
        
        if (!isInRange) {
            const excessDistance = dist - gun.range;
            const falloffPercent = Math.max(0, 1 - (excessDistance / gun.range));
            actualAccuracy = gun.accuracy * falloffPercent;
        }

        // Accuracy check
        const accuracyRoll = Math.random() * 100;
        let finalAngle = angle;
        let willMiss = false;
        
        if (accuracyRoll > actualAccuracy) {
            willMiss = true;
            finalAngle += (Math.random() - 0.5) * GameConfig.GUN.MISS_ANGLE_OFFSET * 2;
        }

        // Play shoot sound
        if (typeof SoundManager !== 'undefined') {
            SoundManager.playSound('shoot');
        }

        // Create bullet with miss tracking
        const bullet = {
            x: player.x,
            y: player.y,
            startX: player.x,
            startY: player.y,
            vx: Math.cos(finalAngle) * GameConfig.GUN.BULLET_SPEED,
            vy: Math.sin(finalAngle) * GameConfig.GUN.BULLET_SPEED,
            missed: willMiss,
            trail: [] // For tracer effect
        };

        bullets.push(bullet);
        return { lastShot: now, bullet };
    }
};

// Expose globally
window.ShootingUtils = ShootingUtils;
