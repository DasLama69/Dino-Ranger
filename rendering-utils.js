// ============================================
// RENDERING UTILITIES
// Shared rendering functions for drawing game elements
// ============================================

const RenderingUtils = {
    // Draw sleeping Z's above captured dinosaurs
    drawSleepingZees(ctx, dino) {
        const timeSinceCapture = Date.now() - (dino.capturedTime || Date.now());
        const animationSpeed = 500; // Milliseconds per Z animation cycle
        
        // Draw 3 Z's with slight offset and animation
        for (let i = 0; i < 3; i++) {
            const offset = (timeSinceCapture / animationSpeed + i * 0.3) % 1;
            const yOffset = dino.y - dino.size / 2 - 20 - (i * 15) - (Math.sin(offset * Math.PI * 2) * 3);
            const alpha = 0.7 + Math.sin(offset * Math.PI * 2) * 0.3;
            
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeText('Z', dino.x + (i - 1) * 12, yOffset);
            ctx.fillText('Z', dino.x + (i - 1) * 12, yOffset);
            ctx.restore();
        }
    },

    // Draw red dot laser and range circle
    drawLaserDot(ctx, player, mouse, gun) {
        if (!mouse) return;
        // Use last known position if mouse left canvas
        const mouseX = mouse.inCanvas ? (mouse.x || mouse.lastX || 0) : (mouse.lastX || player.x);
        const mouseY = mouse.inCanvas ? (mouse.y || mouse.lastY || 0) : (mouse.lastY || player.y);
        
        // Create a mouse position object for calculations
        const mousePos = { x: mouseX, y: mouseY };

        // Calculate distance using mousePos
        const dx = mousePos.x - player.x;
        const dy = mousePos.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Determine if in range
        const inRange = distance <= gun.range;

        // Draw red dot laser at player position (pointing toward mouse)
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(angle);
        
        // Draw red laser dot
        const laserGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
        laserGradient.addColorStop(0, 'rgba(255, 0, 0, 1)');
        laserGradient.addColorStop(0.5, 'rgba(255, 0, 0, 0.6)');
        laserGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = laserGradient;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw small red line extending from player
        ctx.strokeStyle = inRange ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.min(distance, gun.range), 0);
        ctx.stroke();
        
        ctx.restore();

        // Draw range circle (dotted circle showing max range)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(player.x, player.y, gun.range, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    },

    // Draw scope reticle with zoom
    // renderCallback: function(ctx) that draws game elements in zoomed view
    drawScopeZoom(ctx, player, mouse, gun, zoomLevel, renderCallback) {
        const canvas = ctx.canvas; // Get canvas from context
        const zoom = zoomLevel || 2.0; // Default to 2x zoom if not specified
        if (!mouse) return;
        // Use last known position if mouse left canvas
        const mouseX = mouse.inCanvas ? (mouse.x || mouse.lastX || 0) : (mouse.lastX || player.x);
        const mouseY = mouse.inCanvas ? (mouse.y || mouse.lastY || 0) : (mouse.lastY || player.y);
        
        // Debug: Log mouse position vs what we're using
        if (window.DEBUG_SCOPE) {
            const rect = canvas.getBoundingClientRect();
            console.log('Scope debug:', {
                mouseState: { x: mouseX, y: mouseY },
                mouseObj: { x: mouse.x, y: mouse.y, lastX: mouse.lastX, lastY: mouse.lastY },
                canvas: { width: canvas.width, height: canvas.height },
                rect: { width: rect.width, height: rect.height },
                scale: { x: canvas.width / rect.width, y: canvas.height / rect.height }
            });
        }
        
        // Create a mouse position object for calculations
        const mousePos = { x: mouseX, y: mouseY };

        // Calculate distance using mousePos
        const dx = mousePos.x - player.x;
        const dy = mousePos.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Determine if in range
        const inRange = distance <= gun.range;

        // Calculate scope position (clamp to max range if mouse is beyond)
        let scopeX, scopeY;
        if (distance > gun.range) {
            scopeX = player.x + Math.cos(angle) * gun.range;
            scopeY = player.y + Math.sin(angle) * gun.range;
        } else {
            scopeX = mousePos.x;
            scopeY = mousePos.y;
        }
        
        const scopeRadius = 60; // Radius of the scope circle
        
        // Draw zoomed view inside scope circle
        ctx.save();
        
        // Create circular clipping path
        ctx.beginPath();
        ctx.arc(scopeX, scopeY, scopeRadius, 0, Math.PI * 2);
        ctx.clip();
        
        // Scale and translate for zoom centered on scope position
        ctx.translate(scopeX, scopeY);
        ctx.scale(zoom, zoom);
        ctx.translate(-scopeX, -scopeY);
        
        // Call render callback to draw game elements in zoomed view
        if (renderCallback) {
            renderCallback(ctx);
        }
        
        ctx.restore();
        
        // Draw scope reticle overlay
        ctx.save();
        ctx.translate(scopeX, scopeY);
        
        // Draw outer circle frame (thick black border)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, scopeRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw inner circle (slightly smaller, for depth)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, scopeRadius - 2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw crosshair - thick bars at edges tapering to thin center
        const barThickness = 8; // Thickness at outer edge
        const centerThickness = 1; // Thickness at center
        const barLength = scopeRadius - 10; // Length of each bar
        const taperStart = barLength * 0.6; // Where tapering begins
        
        ctx.strokeStyle = inRange ? '#FFFFFF' : '#FF0000';
        ctx.lineCap = 'round';
        
        // Top bar (vertical, top)
        ctx.beginPath();
        ctx.moveTo(0, -barLength);
        ctx.lineTo(0, -taperStart);
        ctx.lineWidth = barThickness;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -taperStart);
        ctx.lineTo(0, 0);
        ctx.lineWidth = centerThickness + (barThickness - centerThickness) * (1 - (taperStart / barLength));
        ctx.stroke();
        
        // Bottom bar (vertical, bottom)
        ctx.beginPath();
        ctx.moveTo(0, barLength);
        ctx.lineTo(0, taperStart);
        ctx.lineWidth = barThickness;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, taperStart);
        ctx.lineTo(0, 0);
        ctx.lineWidth = centerThickness + (barThickness - centerThickness) * (1 - (taperStart / barLength));
        ctx.stroke();
        
        // Left bar (horizontal, left)
        ctx.beginPath();
        ctx.moveTo(-barLength, 0);
        ctx.lineTo(-taperStart, 0);
        ctx.lineWidth = barThickness;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-taperStart, 0);
        ctx.lineTo(0, 0);
        ctx.lineWidth = centerThickness + (barThickness - centerThickness) * (1 - (taperStart / barLength));
        ctx.stroke();
        
        // Right bar (horizontal, right)
        ctx.beginPath();
        ctx.moveTo(barLength, 0);
        ctx.lineTo(taperStart, 0);
        ctx.lineWidth = barThickness;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(taperStart, 0);
        ctx.lineTo(0, 0);
        ctx.lineWidth = centerThickness + (barThickness - centerThickness) * (1 - (taperStart / barLength));
        ctx.stroke();
        
        // Draw hash marks (tick marks) along the crosshair lines
        const hashMarkLength = 4;
        const hashMarkSpacing = 8;
        ctx.strokeStyle = inRange ? '#FFFFFF' : '#FF0000';
        ctx.lineWidth = 1;
        
        // Hash marks on top vertical line
        for (let i = 1; i <= 3; i++) {
            const yPos = -taperStart - (i * hashMarkSpacing);
            ctx.beginPath();
            ctx.moveTo(-hashMarkLength / 2, yPos);
            ctx.lineTo(hashMarkLength / 2, yPos);
            ctx.stroke();
        }
        
        // Hash marks on bottom vertical line
        for (let i = 1; i <= 3; i++) {
            const yPos = taperStart + (i * hashMarkSpacing);
            ctx.beginPath();
            ctx.moveTo(-hashMarkLength / 2, yPos);
            ctx.lineTo(hashMarkLength / 2, yPos);
            ctx.stroke();
        }
        
        // Hash marks on left horizontal line
        for (let i = 1; i <= 3; i++) {
            const xPos = -taperStart - (i * hashMarkSpacing);
            ctx.beginPath();
            ctx.moveTo(xPos, -hashMarkLength / 2);
            ctx.lineTo(xPos, hashMarkLength / 2);
            ctx.stroke();
        }
        
        // Hash marks on right horizontal line
        for (let i = 1; i <= 3; i++) {
            const xPos = taperStart + (i * hashMarkSpacing);
            ctx.beginPath();
            ctx.moveTo(xPos, -hashMarkLength / 2);
            ctx.lineTo(xPos, hashMarkLength / 2);
            ctx.stroke();
        }
        
        // Draw center dot
        ctx.fillStyle = inRange ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 0, 0, 0.9)';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    },

    // Draw dinosaur with rarity glow, health bar, etc.
    drawDino(ctx, dino, options = {}) {
        const {
            showHealthBar = true,
            showAlertMark = true,
            showSleepingZees = true
        } = options;

        // Draw rarity glow/border
        const rarity = GameConfig.RARITY[dino.rarity] || GameConfig.RARITY.common;
        ctx.shadowColor = rarity.color;
        ctx.shadowBlur = 15;
        
        // Draw aquatic dino (shadow when underwater, normal when surfaced)
        if (dino.isAquatic && dino.isUnderwater) {
            // Draw shadow circle when underwater
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.ellipse(dino.x, dino.y, dino.size * 0.8, dino.size * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            // Draw dino normally (image or emoji fallback)
            const image = ImageLoader.getImage(dino.species);
            if (image && image.complete && image.naturalWidth > 0) {
                // Determine if vision cone is facing right (flip) or left (normal)
                // direction is in radians: 0 = right, PI/2 = down, PI = left, -PI/2 = up
                // The vision cone uses dino.direction, so we use that to determine facing
                // If cos(direction) > 0, vision cone facing right (flip horizontally)
                // If cos(direction) < 0, vision cone facing left (normal, facing left)
                // Default to facing left if direction is undefined
                const isFacingRight = dino.direction !== undefined && Math.cos(dino.direction) > 0;
                
                // Draw image
                ctx.save();
                ctx.translate(dino.x, dino.y);
                
                // Flip horizontally if vision cone is facing right
                if (isFacingRight) {
                    ctx.scale(-1, 1);
                }
                
                const imgSize = dino.size;
                ctx.drawImage(image, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
                ctx.restore();
            } else {
                // Fallback to emoji
                ctx.font = `${dino.size}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(dino.emoji, dino.x, dino.y);
            }
        }
        
        ctx.shadowBlur = 0; // Reset shadow

        // Draw health bar
        if (showHealthBar && !dino.captured && (!dino.isAquatic || !dino.isUnderwater)) {
            const barWidth = dino.size;
            const barHeight = 5;
            ctx.fillStyle = 'red';
            ctx.fillRect(dino.x - barWidth/2, dino.y - dino.size/2 - 15, barWidth, barHeight);
            ctx.fillStyle = 'green';
            ctx.fillRect(dino.x - barWidth/2, dino.y - dino.size/2 - 15, barWidth * (dino.health / dino.maxHealth), barHeight);
        }

        // Draw Z's above captured dinosaurs (tranquilized)
        if (showSleepingZees && dino.captured) {
            this.drawSleepingZees(ctx, dino);
        }
        
        // Draw exclamation mark above alerted dinosaurs (but not if captured or underwater)
        if (showAlertMark && dino.alerted && !dino.captured && (!dino.isAquatic || !dino.isUnderwater)) {
            ctx.fillStyle = '#FF0000';
            ctx.font = 'bold 30px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', dino.x, dino.y - dino.size/2 - 30);
            // Draw shadow/outline for visibility
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.strokeText('!', dino.x, dino.y - dino.size/2 - 30);
        }
    },

    // Draw bullet (dart) with glow and tracer
    drawBullet(ctx, bullet, bulletImage) {
        // Draw tracer trail
        if (bullet.trail && bullet.trail.length > 1) {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 255, 0, ${GameConfig.GUN.DART_TRACER_OPACITY})`;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(bullet.trail[0].x, bullet.trail[0].y);
            for (let j = 1; j < bullet.trail.length; j++) {
                ctx.lineTo(bullet.trail[j].x, bullet.trail[j].y);
            }
            ctx.stroke();
            ctx.restore();
        }
        
        // Draw bullet (dart sprite) with glow
        if (bulletImage && bulletImage.complete && bulletImage.naturalWidth > 0) {
            ctx.save();
            ctx.translate(bullet.x, bullet.y);
            // Rotate dart to match velocity direction
            const angle = bullet.angle !== undefined ? bullet.angle : Math.atan2(bullet.vy, bullet.vx);
            ctx.rotate(angle);
            
            // Draw glow effect
            const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, GameConfig.GUN.DART_GLOW_SIZE / 2);
            glowGradient.addColorStop(0, `rgba(255, 255, 0, ${GameConfig.GUN.DART_GLOW_INTENSITY})`);
            glowGradient.addColorStop(0.5, `rgba(255, 200, 0, ${GameConfig.GUN.DART_GLOW_INTENSITY * 0.5})`);
            glowGradient.addColorStop(1, 'rgba(255, 200, 0, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(0, 0, GameConfig.GUN.DART_GLOW_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw dart sprite (centered)
            const dartSize = GameConfig.GUN.DART_SIZE;
            ctx.drawImage(
                bulletImage,
                -dartSize / 2,
                -dartSize / 2,
                dartSize,
                dartSize
            );
            ctx.restore();
        } else {
            // Fallback to yellow circle with glow if image not loaded
            ctx.save();
            // Draw glow
            const glowGradient = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, GameConfig.GUN.DART_GLOW_SIZE / 2);
            glowGradient.addColorStop(0, `rgba(255, 255, 0, ${GameConfig.GUN.DART_GLOW_INTENSITY})`);
            glowGradient.addColorStop(0.5, `rgba(255, 200, 0, ${GameConfig.GUN.DART_GLOW_INTENSITY * 0.5})`);
            glowGradient.addColorStop(1, 'rgba(255, 200, 0, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, GameConfig.GUN.DART_GLOW_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
            // Draw bullet
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, GameConfig.GUN.BULLET_SIZE, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
};

// Expose globally
window.RenderingUtils = RenderingUtils;
