export class AnimatePlugin {
  constructor(viewport) {
    this.viewport = viewport;
  }

  generateAnimationFrames(spriteId, spriteSize, animationType, frameCount, intensity, smoothness, canvas) {
    // Get the sprite image
    const spriteData = this.viewport.generator.spriteStorage.getSprite(spriteId, spriteSize);
    if (!spriteData) {
      console.error("Sprite data not found");
      return [];
    }
    
    // Create array to hold the generated frames
    const frames = [];
    
    // Load the sprite into an image
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        console.log("Base sprite image loaded for animation");
        
        // Create a canvas to work with the sprite
        const spriteCanvas = document.createElement('canvas');
        const ctx = spriteCanvas.getContext('2d');
        spriteCanvas.width = img.width;
        spriteCanvas.height = img.height;
        
        // Draw the original sprite
        ctx.drawImage(img, 0, 0);
        
        // Get the pixel data
        const imageData = ctx.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height);
        const pixelData = this.extractPixelData(imageData);
        
        console.log(`Generating ${frameCount} frames for ${animationType} animation (intensity: ${intensity}, smoothness: ${smoothness})`);
        
        // Generate frames based on animation type
        let generatedFrames = [];
        
        switch(animationType) {
          case 'breathe':
            generatedFrames = this.generateBreathingAnimation(pixelData, frameCount, intensity, smoothness, spriteCanvas);
            break;
          case 'hit':
            generatedFrames = this.generateHitAnimation(pixelData, frameCount, intensity, smoothness, spriteCanvas);
            break;
          case 'run':
            generatedFrames = this.generateRunAnimation(pixelData, frameCount, intensity, smoothness, spriteCanvas);
            break;
          case 'jump':
            generatedFrames = this.generateJumpAnimation(pixelData, frameCount, intensity, smoothness, spriteCanvas);
            break;
          case 'attack':
            generatedFrames = this.generateAttackAnimation(pixelData, frameCount, intensity, smoothness, spriteCanvas);
            break;
          case 'attack-2':
            generatedFrames = this.generateAttackAnimation2(pixelData, frameCount, intensity, smoothness, spriteCanvas);
            break;            
          case 'death':
            generatedFrames = this.generateDeathAnimation(pixelData, frameCount, intensity, smoothness, spriteCanvas);
            break;
          case 'bounce':
            generatedFrames = this.generateBounceAnimation(pixelData, frameCount, intensity, smoothness, spriteCanvas);
            break;
          case 'bounce-2':
            generatedFrames = this.generateBounce2Animation(pixelData, frameCount, intensity, smoothness, spriteCanvas); 
            break;            
          case 'side-wave':
            generatedFrames = this.generateSideWaveAnimation(pixelData, frameCount, intensity, smoothness, spriteCanvas);
            break;
          case 'side-wave-2':
            generatedFrames = this.generateSideWave2Animation(pixelData, frameCount, intensity, smoothness, spriteCanvas);
            break;
          case 'finale':
            generatedFrames = this.generateFinaleAnimation(pixelData, frameCount, intensity, smoothness, spriteCanvas);
            break;
          default:
            // Default to breathing animation
            generatedFrames = this.generateBreathingAnimation(pixelData, frameCount, intensity, smoothness, spriteCanvas);
        }
        
        console.log(`Successfully generated ${generatedFrames.length} frames`);
        resolve(generatedFrames);
      };
      
      img.onerror = () => {
        console.error("Failed to load sprite image");
        resolve([]);
      };
      
      img.src = spriteData;
    });
  }
  
  generateBreathingAnimation(pixelData, frameCount, intensity, smoothness, canvas) {
    console.log("Starting breathing animation generation with new algorithm");
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Find non-transparent pixels to determine actual sprite boundaries
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    // Calculate center based on actual pixels
    const centerX = Math.floor((minX + maxX) / 2);
    const centerY = Math.floor((minY + maxY) / 2);
    console.log(`Sprite center calculated at (${centerX}, ${centerY})`);
    
    // Calculate sprite height for scaling purposes
    const spriteHeight = maxY - minY;
    console.log(`Sprite height: ${spriteHeight}`);
    
    // Group pixels by y-coordinate for line-by-line processing
    const pixelsByRow = {};
    pixels.forEach(pixel => {
      if (!pixelsByRow[pixel.y]) {
        pixelsByRow[pixel.y] = [];
      }
      pixelsByRow[pixel.y].push(pixel);
    });
    
    // Calculate max displacement based on intensity and sprite size
    const sizeMultiplier = parseInt(canvas.width) / 32; // Scale factor based on sprite size
    const maxDisplacement = Math.max(1, Math.round(intensity * 3 * sizeMultiplier));
    console.log(`Max displacement: ${maxDisplacement} pixels`);
    
    // Creating frames for the breathing cycle
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      // Create phase for the breathing cycle (0 to 1 to 0)
      // Add pauses at top and bottom of breath
      let phase;
      if (frameIndex < frameCount * 0.1 || frameIndex > frameCount * 0.9) {
        // Pause at beginning and end (exhaled state)
        phase = 0;
      } else if (frameIndex > frameCount * 0.45 && frameIndex < frameCount * 0.55) {
        // Pause at peak inhale
        phase = 1;
      } else if (frameIndex <= frameCount * 0.45) {
        // Inhale phase (0 to 1) with ease-in/ease-out
        const normalizedProgress = (frameIndex - frameCount * 0.1) / (frameCount * 0.35);
        
        // Apply easing based on smoothness parameter (0-1)
        // Higher smoothness means more pronounced ease-in/ease-out
        const easeFactor = Math.min(1, smoothness * 2); // Scale up for more effect
        
        // Cubic bezier easing, more pronounced with higher smoothness
        if (easeFactor > 0) {
          // Ease in during first half, ease out during second half
          if (normalizedProgress < 0.5) {
            // Ease in (starts slower)
            phase = normalizedProgress * normalizedProgress * (3.0 - 2.0 * normalizedProgress) * 2 * easeFactor + 
                   normalizedProgress * (1 - easeFactor);
            phase = Math.min(0.5, phase);
          } else {
            // Ease out (ends slower)
            const adjustedProgress = (normalizedProgress - 0.5) * 2; // Scale to 0-1 range
            phase = 0.5 + ((1.0 - (1.0 - adjustedProgress) * (1.0 - adjustedProgress)) * 0.5 * easeFactor +
                   adjustedProgress * 0.5 * (1 - easeFactor));
          }
        } else {
          // No easing, linear interpolation
          phase = normalizedProgress;
        }
      } else {
        // Exhale phase (1 to 0) with ease-in/ease-out
        const normalizedProgress = (frameIndex - frameCount * 0.55) / (frameCount * 0.35);
        
        // Apply easing based on smoothness parameter (0-1)
        const easeFactor = Math.min(1, smoothness * 2);
        
        // With easing, the exhale mirrors the inhale
        if (easeFactor > 0) {
          // Ease in during first half of exhale, ease out during second half
          if (normalizedProgress < 0.5) {
            // Ease in (starts slower)
            const easeValue = normalizedProgress * normalizedProgress * (3.0 - 2.0 * normalizedProgress) * 2 * easeFactor +
                             normalizedProgress * (1 - easeFactor);
            phase = 1.0 - (easeValue * 0.5);
          } else {
            // Ease out (ends slower)
            const adjustedProgress = (normalizedProgress - 0.5) * 2; // Scale to 0-1 range
            const easeValue = 0.5 + ((1.0 - (1.0 - adjustedProgress) * (1.0 - adjustedProgress)) * 0.5 * easeFactor +
                             adjustedProgress * 0.5 * (1 - easeFactor));
            phase = 1.0 - easeValue;
          }
        } else {
          // No easing, linear interpolation
          phase = 1 - normalizedProgress;
        }
      }
      
      // Create a new canvas for this frame
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      // Draw the original image first (to handle background)
      ctx.drawImage(canvas, 0, 0);
      
      // Clear the canvas
      ctx.clearRect(0, 0, width, height);
      
      // Process each row of pixels
      Object.keys(pixelsByRow).forEach(rowY => {
        const y = parseInt(rowY);
        
        // Calculate vertical distance from center (as a ratio)
        const distanceFromCenter = Math.abs(y - centerY) / (spriteHeight / 2);
        
        // Gradient effect - more movement for pixels further from center
        // Increase movement for upper pixels to simulate head movement
        const gradientFactor = y < centerY 
          ? (1 - distanceFromCenter) * 1.5 + (y <= minY + spriteHeight * 0.2 ? 0.5 : 0) // Additional factor for "head" pixels
          : (1 - distanceFromCenter) * 0.5;
        
        // Calculate displacement for this row
        const displacement = maxDisplacement * phase * gradientFactor;
        
        pixelsByRow[y].forEach(pixel => {
          // Apply displacement (move up for breathing)
          const newY = y - Math.round(displacement);
          
          // Draw the pixel at the new position and keep original
          ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a / 255})`;
          
          // Draw the original pixel (don't erase it)
          ctx.fillRect(pixel.x, pixel.y, 1, 1);
          
          // Draw the displaced pixel - even if it goes beyond original bounds
          ctx.fillRect(pixel.x, newY, 1, 1);
          
          // Fill in gaps by duplicating pixels between original and new positions
          if (displacement > 1) {
            for (let fillY = Math.min(y, newY) + 1; fillY < Math.max(y, newY); fillY++) {
              // Reduce alpha for filler pixels to create smoother transitions
              const alphaFactor = 1;
              ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a * alphaFactor / 255})`;
              ctx.fillRect(pixel.x, fillY, 1, 1);
            }
          }
        });
      });
      
      // Create an image from the canvas
      const frameImg = new Image();
      frameImg.src = frameCanvas.toDataURL();
      
      // Add completed frame to the array
      frames.push(frameImg);
    }
    
    console.log(`Generated ${frames.length} breathing animation frames with new algorithm`);
    return frames;
  }
  
  extractPixelData(imageData) {
    const { data, width, height } = imageData;
    const pixels = [];
    
    // Find non-transparent pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        
        if (alpha > 0) {
          pixels.push({
            x, y,
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            a: alpha
          });
        }
      }
    }
    
    return {
      pixels,
      width,
      height,
      originalData: data.slice()
    };
  }
  
  generateWalkAnimation(pixelData, frameCount, intensity, smoothness, canvas) {
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Identify the sprite boundary
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    // Calculate center point and height
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const spriteHeight = maxY - minY;
    
    for (let i = 0; i < frameCount; i++) {
      // Create horizontal shift and vertical bounce
      const phase = i / frameCount * Math.PI * 2;
      const horizontalShift = 2 * intensity * Math.cos(phase);
      const verticalBounce = 0.5 * intensity * Math.abs(Math.sin(phase));
      
      // Create a new canvas for this frame
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      // Apply the transformation to each pixel
      pixels.forEach(pixel => {
        // Apply the bounce based on height position (feet move less than head)
        const heightRatio = (maxY - pixel.y) / spriteHeight;
        const bounceAmount = verticalBounce * heightRatio;
        
        // Apply horizontal movement with some sway
        const swayEffect = 0.5 * intensity * (pixel.y - minY) / spriteHeight * Math.sin(phase);
        
        const newX = pixel.x + horizontalShift + swayEffect;
        const newY = pixel.y - bounceAmount;
        
        // Draw the pixel at the new position
        ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a / 255})`;
        ctx.fillRect(Math.round(newX), Math.round(newY), 1, 1);
      });
      
      // Create an image from the canvas
      const frameImage = new Image();
      frameImage.src = frameCanvas.toDataURL();
      
      // Add to frames array
      frames.push(frameImage);
    }
    
    return frames;
  }
  
  generateRunAnimation(pixelData, frameCount, intensity, smoothness, canvas) {
    console.log("Starting run animation generation");
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Identify the sprite boundary using non-transparent pixels
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    // Calculate center points and dimensions
    const centerX = Math.floor((minX + maxX) / 2);
    const centerY = Math.floor((minY + maxY) / 2);
    const spriteWidth = maxX - minX;
    const spriteHeight = maxY - minY;
    
    console.log(`Sprite dimensions: ${spriteWidth}x${spriteHeight}, center at (${centerX},${centerY})`);
    
    // Group pixels by position for leg identification and wave effect
    const pixelsByRow = {};
    pixels.forEach(pixel => {
      if (!pixelsByRow[pixel.y]) {
        pixelsByRow[pixel.y] = [];
      }
      pixelsByRow[pixel.y].push(pixel);
    });
    
    // Calculate max displacement based on intensity and sprite size
    const sizeMultiplier = parseInt(canvas.width) / 32;
    const maxLegDisplacement = Math.max(1, Math.round(intensity * 5 * sizeMultiplier));
    const maxTorsoDisplacement = Math.max(1, Math.round(intensity * 2 * sizeMultiplier));
    const maxRotation = intensity * 0.2; // Max rotation factor
    
    console.log(`Max displacements - leg: ${maxLegDisplacement}px, torso: ${maxTorsoDisplacement}px`);
    
    // Calculate phases for complete run cycle (right leg, then left leg)
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      // Determine cycle progress (0-1 for full cycle)
      const progress = frameIndex / frameCount;
      
      // Separate into right leg and left leg cycle (0-0.5 for right leg, 0.5-1 for left leg)
      const legCycle = progress < 0.5 ? 
        { leg: 'right', innerProgress: progress * 2 } : 
        { leg: 'left', innerProgress: (progress - 0.5) * 2 };
      
      // Apply easing to inner progress based on smoothness
      let easedProgress;
      
      // More smoothness means more pronounced ease-in/ease-out
      const easeFactor = Math.min(1, smoothness * 2);
      
      // For leg up phase (0-0.25 for right, 0.5-0.75 for full cycle)
      if (legCycle.innerProgress < 0.5) {
        // Create hold at top with easing
        if (legCycle.innerProgress < 0.2) {
          // Leg going up - ease in
          const p = legCycle.innerProgress / 0.2;
          easedProgress = easeFactor ? p * p * (3 - 2 * p) : p;
        } else if (legCycle.innerProgress > 0.3) {
          // Leg going down - ease out
          const p = (legCycle.innerProgress - 0.3) / 0.2;
          easedProgress = easeFactor ? 1 - (1 - p) * (1 - p) : p;
          easedProgress = 0.5 + easedProgress * 0.5; // Range 0.5-1
        } else {
          // Hold leg up
          easedProgress = 0.5;
        }
      } else {
        // For recovery phase - simple linear with slight easing
        easedProgress = 0.5 + 0.5 * (legCycle.innerProgress - 0.5) / 0.5;
      }
      
      // Create a new canvas for this frame
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      // Clear the canvas
      ctx.clearRect(0, 0, width, height);
      
      // Process each row of pixels with wave-like motion
      Object.keys(pixelsByRow).sort((a, b) => parseInt(a) - parseInt(b)).forEach(rowY => {
        const y = parseInt(rowY);
        
        // Determine if we're in the torso region, transition region, or leg region
        const isTorso = y < centerY;
        const isTransition = y >= centerY && y < centerY + spriteHeight * 0.15; // 15% transition zone
        const legSide = legCycle.leg; // 'right' or 'left'
        
        // Calculate vertical position ratio (0 at top, 1 at bottom)
        const verticalPositionRatio = (y - minY) / spriteHeight;
        
        // For torso (above centerY) or transition zone
        if (isTorso || isTransition) {
          // Calculate torso displacement
          // Max displacement at centerY - 25%, reduces toward top of sprite
          const torsoDisplacementRatio = isTorso ? 
            Math.min(1, (centerY - y) / (spriteHeight * 0.25)) : // For upper body
            Math.max(0, 1 - ((y - centerY) / (spriteHeight * 0.15))); // For transition zone
           
          let torsoDisplacement = 0;
          
          if (easedProgress <= 0.5) {
            // Leg going up - torso shifts up
            torsoDisplacement = -maxTorsoDisplacement * easedProgress * torsoDisplacementRatio;
          } else {
            // Leg going down - torso recovers
            torsoDisplacement = -maxTorsoDisplacement * (1 - easedProgress) * torsoDisplacementRatio;
          }
          
          // Calculate rotation for torso - opposite side from active leg
          const rotationFactor = legSide === 'right' ? -maxRotation : maxRotation;
          const horizontalRotation = (easedProgress <= 0.5 ? 
              easedProgress * 2 : (1 - easedProgress) * 2) * 
              rotationFactor * (centerX - minX);
          
          // Apply different rotation based on height (less at top, more at middle)
          // Create gradient effect for rotation - max at centerY, less at top and in transition zone
          let heightRotationFactor;
          if (isTorso) {
            heightRotationFactor = (y - minY) / (centerY - minY);
          } else {
            // Gradually reduce rotation in transition zone
            heightRotationFactor = 1 - ((y - centerY) / (spriteHeight * 0.15));
          }
          
          const adjustedRotation = horizontalRotation * heightRotationFactor;
          
          pixelsByRow[y].forEach(pixel => {
            // Apply vertical displacement for all torso pixels
            let newY = y + Math.round(torsoDisplacement);
            
            // Apply horizontal shift based on rotation
            const distanceFromCenterX = pixel.x - centerX;
            const newX = Math.round(pixel.x + adjustedRotation * (distanceFromCenterX / (centerX - minX)));
            
            // Draw the pixel at the new position
            ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a / 255})`;
            ctx.fillRect(newX, newY, 1, 1);
          });
        } 
        // For legs (below centerY + transition zone)
        else {
          pixelsByRow[y].forEach(pixel => {
            // Determine which side of the sprite this pixel is on
            const isRightSide = pixel.x >= centerX;
            const isActiveLeg = (legSide === 'right' && isRightSide) || (legSide === 'left' && !isRightSide);
            
            // Calculate leg displacement based on vertical position
            // More displacement at bottom, less near transition zone
            const legPositionRatio = (y - (centerY + spriteHeight * 0.15)) / ((maxY - centerY) - spriteHeight * 0.15);
            let legDisplacement = 0;
            
            if (isActiveLeg) {
              // Active leg movement - up during up phase, down during down phase
              if (easedProgress <= 0.5) {
                // Leg going up
                legDisplacement = -maxLegDisplacement * easedProgress * legPositionRatio;
              } else {
                // Leg going down
                legDisplacement = -maxLegDisplacement * (1 - easedProgress) * legPositionRatio;
              }
            } else {
              // Inactive leg - small opposite movement to simulate weight shift
              if (easedProgress <= 0.5) {
                // Slight down as active leg goes up
                legDisplacement = maxLegDisplacement * 0.1 * easedProgress * legPositionRatio;
              } else {
                // Recovery as active leg comes down
                legDisplacement = maxLegDisplacement * 0.1 * (1 - easedProgress) * legPositionRatio;
              }
            }
            
            // Wave-like horizontal movement
            let horizontalShift = 0;
            if (isActiveLeg) {
              // Forward movement for active leg
              horizontalShift = (legSide === 'right' ? 1 : -1) * 
                               maxLegDisplacement * 0.3 * 
                               (easedProgress <= 0.5 ? easedProgress : (1 - easedProgress)) * 
                               legPositionRatio;
            }
            
            const newY = y + Math.round(legDisplacement);
            const newX = pixel.x + Math.round(horizontalShift);
            
            // Draw the pixel at the new position
            ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a / 255})`;
            ctx.fillRect(newX, newY, 1, 1);
          });
        }
      });
      
      // Fill in any gaps that might have formed during pixel movement
      this.fillVerticalGaps(ctx, width, height);
      this.fillHorizontalGaps(ctx, width, height);
      
      // Create an image from the canvas
      const frameImg = new Image();
      frameImg.src = frameCanvas.toDataURL();
      
      // Add completed frame to the array
      frames.push(frameImg);
    }
    
    console.log(`Generated ${frames.length} run animation frames`);
    return frames;
  }

  generateJumpAnimation(pixelData, frameCount, intensity, smoothness, canvas) {
    console.log("Starting jump animation generation");
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Identify the sprite boundary using non-transparent pixels
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    // Calculate center based on actual pixels and sprite dimensions
    const centerX = Math.floor((minX + maxX) / 2);
    const centerY = Math.floor((minY + maxY) / 2);
    const spriteHeight = maxY - minY;
    const spriteWidth = maxX - minX;
    console.log(`Sprite center at (${centerX}, ${centerY}), size: ${spriteWidth}x${spriteHeight}`);
    
    // Group pixels by y-coordinate for line-by-line processing
    const pixelsByRow = {};
    pixels.forEach(pixel => {
      if (!pixelsByRow[pixel.y]) {
        pixelsByRow[pixel.y] = [];
      }
      pixelsByRow[pixel.y].push(pixel);
    });
    
    // Calculate max displacement based on intensity and sprite size
    const sizeMultiplier = parseInt(canvas.width) / 32; // Scale factor based on sprite size
    const maxVerticalDisplacement = Math.max(1, Math.round(intensity * 5 * sizeMultiplier));
    const maxHorizontalSquish = Math.max(1, Math.round(intensity * 2 * sizeMultiplier));
    console.log(`Max vertical displacement: ${maxVerticalDisplacement}, max horizontal squish: ${maxHorizontalSquish}`);
    
    // Define jump animation phases:
    // 0-20%: Initial squish (preparation)
    // 20-40%: Vertical stretch (jump)
    // 40-60%: Air time (peak of jump)
    // 60-80%: Landing impact (squish from bottom up)
    // 80-100%: Return to neutral
    
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const progress = frameIndex / (frameCount - 1);
      
      // Create a new canvas for this frame
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      // Clear the canvas
      ctx.clearRect(0, 0, width, height);
      
      // Process each row of pixels
      Object.keys(pixelsByRow).sort((a, b) => parseInt(a) - parseInt(b)).forEach(rowY => {
        const y = parseInt(rowY);
        
        // Calculate vertical position ratio (0 at top, 1 at bottom)
        const verticalPositionRatio = (y - minY) / spriteHeight;
        
        // Determine if this row is in upper or lower half of sprite
        const isUpperHalf = y < centerY;
        
        // Calculate vertical displacement based on animation phase
        let verticalDisplacement = 0;
        let horizontalDisplacement = 0;
        
        if (progress < 0.2) {
          // Phase 1: Initial squish - compress sprite
          const squishProgress = progress / 0.2;
          
          // Apply easing based on smoothness
          const easedProgress = smoothness > 0.5 ? 
            squishProgress * squishProgress * (3 - 2 * squishProgress) : squishProgress;
          
          if (isUpperHalf) {
            // Upper half moves down
            verticalDisplacement = maxVerticalDisplacement * 0.3 * easedProgress * (1 - verticalPositionRatio);
          } else {
            // Lower half compresses upward
            verticalDisplacement = -maxVerticalDisplacement * 0.3 * easedProgress * verticalPositionRatio;
          }
          
          // Horizontal squish - wider during compression
          horizontalDisplacement = maxHorizontalSquish * easedProgress;
        } 
        else if (progress < 0.4) {
          // Phase 2: Vertical stretch - extending upward
          const stretchProgress = (progress - 0.2) / 0.2;
          
          // Apply ease-out for smoother transition
          const easedProgress = smoothness > 0.5 ?
            1 - (1 - stretchProgress) * (1 - stretchProgress) : stretchProgress;
          
          // Entire sprite moves upward with more movement at the top
          verticalDisplacement = -maxVerticalDisplacement * easedProgress * (1 + (1 - verticalPositionRatio) * 0.5);
          
          // Horizontal stretch - thinner during extension
          horizontalDisplacement = -maxHorizontalSquish * easedProgress;
        }
        else if (progress < 0.6) {
          // Phase 3: Air time - at peak of jump
          const airProgress = (progress - 0.4) / 0.2;
          
          // Slight bobbing at the top of the jump
          const bobFactor = Math.sin(airProgress * Math.PI) * 0.1;
          
          // Entire sprite is elevated
          verticalDisplacement = -maxVerticalDisplacement * (1.0 - bobFactor * verticalPositionRatio);
          
          // Maintain slight horizontal stretch
          horizontalDisplacement = -maxHorizontalSquish * 0.2;
        }
        else if (progress < 0.8) {
          // Phase 4: Landing impact - squish from bottom to top as a wave
          const landingProgress = (progress - 0.6) / 0.2;
          
          // Create a wave effect moving from bottom to top
          // Impact propagates from feet upward
          const wavePosition = 1.0 - landingProgress; // 1.0 at start, 0.0 at end
          
          // Calculate how much this row is affected by the wave
          // More effect as the wave passes through this row
          const waveEffect = Math.max(0, 1.0 - Math.abs(verticalPositionRatio - wavePosition) * 5);
          
          // Apply vertical displacement based on wave effect
          if (verticalPositionRatio > wavePosition) {
            // Below wave - already compressed
            verticalDisplacement = maxVerticalDisplacement * 0.3 * waveEffect;
          } else {
            // Above wave - still elevated or just starting to compress
            verticalDisplacement = -maxVerticalDisplacement * (1.0 - landingProgress) * (1.0 - waveEffect);
          }
          
          // Horizontal squish - wider during landing, especially at bottom
          horizontalDisplacement = maxHorizontalSquish * landingProgress * waveEffect;
        }
        else {
          // Phase 5: Return to neutral
          const recoveryProgress = (progress - 0.8) / 0.2;
          
          // Oscillating spring-like motion using damped cosine
          const springFactor = Math.exp(-recoveryProgress * 3) * Math.cos(recoveryProgress * 6 * Math.PI * intensity);
          
          // Apply vertical spring effect, with more movement at the bottom
          verticalDisplacement = maxVerticalDisplacement * 0.2 * springFactor * verticalPositionRatio;
          
          // Return horizontal scale to normal with some elastic wobble
          horizontalDisplacement = maxHorizontalSquish * springFactor;
        }
        
        // Apply horizontal scaling effect
        pixelsByRow[y].forEach(pixel => {
          // Calculate horizontal displacement based on distance from center
          const distanceFromCenterX = (pixel.x - centerX);
          
          // Apply horizontal scaling for squish/stretch effect
          const scaledHorizontalPosition = distanceFromCenterX * (1 + horizontalDisplacement / spriteWidth);
          horizontalDisplacement = scaledHorizontalPosition - distanceFromCenterX;
          
          // Apply final displacements
          const newY = Math.round(y + verticalDisplacement);
          const newX = Math.round(pixel.x + horizontalDisplacement);
          
          // Draw the pixel at the new position with its original color
          ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a / 255})`;
          ctx.fillRect(newX, newY, 1, 1);
          
          // Fill in potential gaps between original and new positions
          if (Math.abs(newY - y) > 1 || Math.abs(newX - pixel.x) > 1) {
            // Interpolate pixels along the path to avoid gaps
            const steps = Math.max(
              Math.abs(newY - y),
              Math.abs(newX - pixel.x)
            );
            
            for (let step = 1; step < steps; step++) {
              const fillX = Math.round(pixel.x + (newX - pixel.x) * step / steps);
              const fillY = Math.round(y + (newY - y) * step / steps);
              
              // Use slightly reduced alpha for interpolated pixels
              const alphaFactor = 1;
              ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a * alphaFactor / 255})`;
              ctx.fillRect(fillX, fillY, 1, 1);
            }
          }
        });
      });
      
      // Fill any remaining gaps
      this.fillVerticalGaps(ctx, width, height);
      this.fillHorizontalGaps(ctx, width, height);
      
      // Create an image from the canvas
      const frameImg = new Image();
      frameImg.src = frameCanvas.toDataURL();
      
      // Add completed frame to the array
      frames.push(frameImg);
    }
    
    console.log(`Generated ${frames.length} jump animation frames`);
    return frames;
  }

  generateAttackAnimation(pixelData, frameCount, intensity, smoothness, canvas) {
    console.log("Starting attack animation generation");
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Identify the sprite boundary using only non-transparent pixels
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    // Calculate center based on actual pixels
    const centerX = Math.floor((minX + maxX) / 2);
    const centerY = Math.floor((minY + maxY) / 2);
    console.log(`Sprite center calculated at (${centerX}, ${centerY})`);
    
    // Calculate sprite dimensions
    const spriteHeight = maxY - minY;
    const spriteWidth = maxX - minX;
    console.log(`Sprite size: ${spriteWidth}x${spriteHeight}`);
    
    // Group pixels by y-coordinate for line-by-line processing
    const pixelsByRow = {};
    pixels.forEach(pixel => {
      if (!pixelsByRow[pixel.y]) {
        pixelsByRow[pixel.y] = [];
      }
      pixelsByRow[pixel.y].push(pixel);
    });
    
    // Calculate maximum displacement based on intensity and sprite size
    const sizeMultiplier = parseInt(canvas.width) / 32; // Scale factor based on sprite size
    const maxDisplacement = Math.max(1, Math.round(intensity * 4 * sizeMultiplier));
    console.log(`Max displacement: ${maxDisplacement} pixels`);
    
    // Phase distribution for attack animation
    // 0-15%: Initial squish inward (preparation)
    // 15-40%: Fast upward stretch (attack)
    // 40-60%: Impact frames with color change (hit)
    // 60-100%: Rebound and return to neutral (recovery)
    
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      // Determine which phase of the animation we're in
      const progress = frameIndex / (frameCount - 1);
      let phase;
      let isImpactFrame = false;
      let colorMultiplier = 1.0;  // How red to make the sprite
      let horizontalScaleFactor = 1.0;
      
      if (progress < 0.15) {
        // Initial squish phase (0 to -1)
        const squishProgress = progress / 0.15;
        
        // Create a wave-like motion by applying a sine wave
        // Different rows will reach max squish at slightly different times
        phase = -0.8 * squishProgress; // Negative means squish in
        
        // Scale inward horizontally during initial squish
        horizontalScaleFactor = 1.0 - 0.2 * squishProgress * intensity;
      } else if (progress < 0.4) {
        // Fast upward stretch (attack phase, -1 to 1)
        const stretchProgress = (progress - 0.15) / 0.25;
        
        // Apply easing based on smoothness parameter for attack
        // Lower smoothness = more sudden movement
        const easeFactor = Math.max(0, 1 - smoothness);
        
        // Apply an ease-in cubic function for faster initial movement
        if (easeFactor > 0) {
          phase = -0.8 + stretchProgress * stretchProgress * (3 - 2 * stretchProgress) * (1.8 + easeFactor);
        } else {
          phase = -0.8 + 1.8 * stretchProgress; // Linear transition from squish to stretch
        }
        
        // Apply horizontal scaling (get thinner during stretch)
        horizontalScaleFactor = 1.0 - 0.2 * (1 - stretchProgress) * intensity - 0.2 * phase * intensity;
      } else if (progress < 0.6) {
        // Impact frames
        isImpactFrame = false;
        phase = 1.0 - ((progress - 0.4) / 0.2) * 0.3; // Slight decrease from fully stretched
        
        // Calculate how "white" the sprite should become
        const impactProgress = (progress - 0.4) / 0.2; // 0 to 1 within impact phase
        
        // Pulsing effect with peak in the middle
        // Highest impact effect at 50% of impact phase
        colorMultiplier = 1.0 + (intensity * 2.0 * Math.sin(impactProgress * Math.PI));
        
        // Maintain slight horizontal squish during impact
        horizontalScaleFactor = 0.9 - 0.1 * phase * intensity;
      } else {
        // Rebound and recovery (1 to 0)
        const reboundProgress = (progress - 0.6) / 0.4;
        
        // Oscillating spring-like motion using damped cosine
        const springFactor = Math.exp(-reboundProgress * 5) * Math.cos(reboundProgress * 10 * intensity);
        phase = 0.7 * springFactor; // Rebound with diminishing amplitude
        
        // Return horizontal scale to normal with some elastic wobble
        horizontalScaleFactor = 1.0 + 0.1 * springFactor * intensity;
      }
      
      // Create a new canvas for this frame
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      // Clear the canvas
      ctx.clearRect(0, 0, width, height);
      
      // Process each row of pixels with wave-like motion for vertical displacement
      Object.keys(pixelsByRow).forEach(rowY => {
        const y = parseInt(rowY);
        
        // Calculate row's position ratio within the sprite
        const verticalPositionRatio = (y - minY) / spriteHeight;
        
        // Wave-like effect: rows reach max displacement at different times
        // Add row-specific phase shift for the wave effect during initial squish
        let rowPhaseShift = 0;
        
        if (progress < 0.15) {
          // During squish phase, create a wave effect from bottom to top
          rowPhaseShift = Math.sin(verticalPositionRatio * Math.PI) * 0.3;
        }
        
        // Calculate vertical displacement factor based on distance from center
        // Different for upper/lower parts of sprite
        let verticalDisplacementFactor;
        
        if (progress < 0.15) {
          // During squish phase, move top and bottom inward
          if (y < centerY) {
            // Upper part - moves down
            verticalDisplacementFactor = (1 - verticalPositionRatio) * 1.2;
          } else {
            // Lower part - moves up
            verticalDisplacementFactor = -(verticalPositionRatio) * 1.2;
          }
        } else {
          // For stretching phase and beyond
          if (y < centerY) {
            // Upper part - more displacement closer to top (head moves more)
            verticalDisplacementFactor = (1 - verticalPositionRatio) * 1.5;
          } else {
            // Lower part - less displacement for feet
            verticalDisplacementFactor = verticalPositionRatio * 0.7;
          }
        }
        
        // Apply row-specific phase for wave-like motion
        const effectivePhase = phase + (progress < 0.15 ? rowPhaseShift : 0);
        
        // Calculate vertical displacement for this row
        const verticalDisplacement = maxDisplacement * effectivePhase * verticalDisplacementFactor;
        
        pixelsByRow[y].forEach(pixel => {
          // Calculate horizontal displacement based on horizontal scaling
          const distanceFromCenterX = (pixel.x - centerX);
          
          // Apply horizontal scaling for squish/stretch effect
          const horizontalDisplacement = distanceFromCenterX * (horizontalScaleFactor - 1.0);
          
          // Apply displacements
          const newY = y + Math.round(verticalDisplacement);
          const newX = centerX + Math.round((distanceFromCenterX) * horizontalScaleFactor);
          
          // Apply color changes for impact frames
          let r = pixel.r, g = pixel.g, b = pixel.b;
          
          if (isImpactFrame) {
            // Brighten colors while keeping black as black
            const brightenThreshold = 40; // Pixels darker than this stay darker
            const isNotDark = Math.max(r, g, b) > brightenThreshold;
            
            if (isNotDark) {
              // Convert to red (increase red, decrease green and blue)
              r = Math.min(255, Math.round(r + (255 - r) * colorMultiplier));
              g = Math.max(0, Math.round(g * (1 - colorMultiplier * 0.8)));
              b = Math.max(0, Math.round(b * (1 - colorMultiplier * 0.8)));
            }
          }
          
          // Draw the pixel with potentially modified color
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${pixel.a / 255})`;
          
          // Draw the displaced pixel
          ctx.fillRect(newX, newY, 1, 1);
          
          // Fill in gaps between original and new positions
          if (Math.abs(newY - y) > 1 || Math.abs(newX - pixel.x) > 1) {
            // Interpolate pixels along the path
            const steps = Math.max(
              Math.abs(newY - y),
              Math.abs(newX - pixel.x)
            );
            
            for (let step = 1; step < steps; step++) {
              const fillX = Math.round(pixel.x + (newX - pixel.x) * step / steps);
              const fillY = Math.round(y + (newY - y) * step / steps);
              
              // Reduce alpha for filler pixels for smoother transitions
              const alphaFactor = 1;
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${pixel.a * alphaFactor / 255})`;
              ctx.fillRect(fillX, fillY, 1, 1);
            }
          }
        });
      });
      
      // Add a gap-filling pass to detect and fix vertical tears
      this.fillVerticalGaps(ctx, width, height);
      this.fillHorizontalGaps(ctx, width, height);
      
      // Create an image from the canvas
      const frameImg = new Image();
      frameImg.src = frameCanvas.toDataURL();
      
      // Add completed frame to the array
      frames.push(frameImg);
    }
    
    console.log(`Generated ${frames.length} attack animation frames`);
    return frames;
  }
  
  generateDeathAnimation(pixelData, frameCount, intensity, smoothness, canvas) {
    console.log("Starting death animation generation");
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Find non-transparent pixels to determine actual sprite boundaries
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    // Calculate sprite dimensions
    const spriteHeight = maxY - minY;
    const spriteWidth = maxX - minX;
    
    // Group pixels by y-coordinate for top-to-bottom processing
    const pixelsByRow = {};
    pixels.forEach(pixel => {
      if (!pixelsByRow[pixel.y]) {
        pixelsByRow[pixel.y] = [];
      }
      pixelsByRow[pixel.y].push(pixel);
    });
    
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      // Calculate current progress (0 to 1)
      const progress = frameIndex / (frameCount - 1);
      
      // Create a new canvas for this frame
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      // Process each row from top to bottom
      const sortedRows = Object.keys(pixelsByRow).map(y => parseInt(y)).sort((a, b) => a - b);
      
      sortedRows.forEach(y => {
        // Calculate how far the "disintegration wave" has traveled down the sprite
        // The wave moves from top (0) to bottom (1) as progress increases
        const rowPosition = (y - minY) / spriteHeight; // 0 at top, 1 at bottom
        
        // Determine if this row should start disintegrating
        // Higher intensity means faster disintegration
        const disintegrationThreshold = progress * (1 + intensity * 0.5);
        
        // This row starts disintegrating when the wave reaches it
        const shouldDisintegrate = rowPosition < disintegrationThreshold;
        
        // Calculate how much this row has disintegrated (0 = not at all, 1 = completely)
        // Creates a gradient effect where rows gradually disintegrate as the wave passes
        const disintegrationAmount = Math.min(1, Math.max(0, 
          (disintegrationThreshold - rowPosition) * (10 + intensity * 10)
        ));
        
        pixelsByRow[y].forEach(pixel => {
          // For pixels that haven't disintegrated yet
          if (!shouldDisintegrate || Math.random() > disintegrationAmount) {
            // Convert to grayscale based on progress
            // Earlier frames have more color, later frames more grayscale
            const grayscaleAmount = Math.min(1, progress * 2);
            const r = pixel.r;
            const g = pixel.g;
            const b = pixel.b;
            
            // Calculate grayscale value (weighted RGB for perceptual accuracy)
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            
            // Blend original color with grayscale based on progress
            const blendedR = Math.round(r * (1 - grayscaleAmount) + gray * grayscaleAmount);
            const blendedG = Math.round(g * (1 - grayscaleAmount) + gray * grayscaleAmount);
            const blendedB = Math.round(b * (1 - grayscaleAmount) + gray * grayscaleAmount);
            
            // Draw the pixel in its original position with the blended color
            ctx.fillStyle = `rgba(${blendedR}, ${blendedG}, ${blendedB}, ${pixel.a / 255})`;
            ctx.fillRect(pixel.x, pixel.y, 1, 1);
          } 
          // For pixels that should disintegrate
          else if (shouldDisintegrate && disintegrationAmount > 0) {
            // Only draw some pixels as "falling particles"
            // Higher intensity means more particles
            if (Math.random() < (0.3 + intensity * 0.2)) {
              // Calculate a grayscale value for the falling particle
              const gray = Math.round(0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b);
              
              // Make particles darker as they fall
              const darknessFactor = 0.7 - (disintegrationAmount * 0.5);
              const particleGray = Math.round(gray * darknessFactor);
              
              // Calculate falling distance based on disintegration amount
              // Farther from disintegration wave = falling farther
              const fallDistance = (disintegrationAmount * (10 + intensity * 30)) * Math.random();
              
              // Add some horizontal drift to particles
              const horizontalDrift = (Math.random() * 2 - 1) * fallDistance * 0.5;
              
              // Apply slight randomization to make it less uniform
              const jitterX = (Math.random() * 2 - 1) * 2;
              const jitterY = (Math.random() * 2 - 1) * 2;
              
              // Draw the falling pixel
              const particleX = pixel.x + horizontalDrift + jitterX;
              const particleY = pixel.y + fallDistance + jitterY;
              
              // Make particles fade out as they fall
              // Ensure particles completely fade out in the last ~10% of frames
              let alpha;
              if (progress > 0.9) {
                // Force complete transparency in the final frames
                const finalFadeout = 1 - ((1 - progress) * 10); // 0 at 0.9 progress, 1 at 1.0 progress
                alpha = Math.max(0, pixel.a * (1 - disintegrationAmount * 0.8) * (1 - finalFadeout)) / 255;
              } else {
                alpha = Math.max(0, pixel.a * (1 - disintegrationAmount * 0.8)) / 255;
              }
              
              // Don't render particles with very low alpha to ensure clean final frames
              if (alpha > 0.02) {
                ctx.fillStyle = `rgba(${particleGray}, ${particleGray}, ${particleGray}, ${alpha})`;
                ctx.fillRect(particleX, particleY, 1, 1);
              }
            }
          }
        });
      });
      
      // Create an image from the canvas
      const frameImg = new Image();
      frameImg.src = frameCanvas.toDataURL();
      
      // Add completed frame to the array
      frames.push(frameImg);
    }
    
    console.log(`Generated ${frames.length} death animation frames`);
    return frames;
  }

  generateBounceAnimation(pixelData, frameCount, intensity, smoothness, canvas) {
    console.log("Starting bounce animation generation");
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Find sprite boundaries
    let minX = width, maxX = 0, minY = height, maxY = 0;
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    const centerX = Math.floor((minX + maxX) / 2);
    const spriteHeight = maxY - minY;
    const spriteWidth = maxX - minX;
    
    // Group pixels by row for line-by-line processing
    const pixelsByRow = {};
    pixels.forEach(pixel => {
      if (!pixelsByRow[pixel.y]) {
        pixelsByRow[pixel.y] = [];
      }
      pixelsByRow[pixel.y].push(pixel);
    });
    
    // Calculate max displacement based on intensity and sprite size
    const sizeMultiplier = parseInt(canvas.width) / 32;
    const maxStretch = Math.max(1, Math.round(intensity * 3 * sizeMultiplier));
    
    // Animation phases:
    // 0-30%: Stretch up gradually (line by line from bottom)
    // 30-45%: Hold at maximum stretch
    // 45-60%: Quick drop
    // 60-100%: Bouncy settling
    
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const progress = frameIndex / (frameCount - 1);
      
      // Create frame canvas
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      // Process each row from bottom to top
      const sortedRows = Object.keys(pixelsByRow).map(y => parseInt(y)).sort((a, b) => a - b);
      
      for (const y of sortedRows) {
        const rowPositionFromBottom = (y - minY) / spriteHeight; // 0 at top, 1 at bottom
        
        let verticalDisplacement = 0;
        let squishFactor = 1.0;
        
        if (progress < 0.3) {
          // Stretching phase - gradual upward stretch from bottom to top
          const stretchProgress = progress / 0.6;
          
          // Apply easing based on smoothness
          const easedProgress = smoothness > 0.5 ? 
            stretchProgress * stretchProgress * (3 - 2 * stretchProgress) : 
            stretchProgress;
          
          // More stretch at the top, no movement at bottom
          const stretchAmount = easedProgress * maxStretch * (1 - Math.pow(rowPositionFromBottom, 2));
          verticalDisplacement = -stretchAmount;
          
          // Slight horizontal squish during stretch
          squishFactor = 1.0 - 0.2 * easedProgress;
        }
        else if (progress < 0.45) {
          // Hold phase - maintain maximum stretch
          const holdProgress = (progress - 0.3) / 0.15;
          
          // Add slight wobble during hold
          const wobble = Math.sin(holdProgress * Math.PI) * 0.05 * maxStretch;
          verticalDisplacement = -maxStretch * (1 - Math.pow(rowPositionFromBottom, 2)) + wobble;
          
          // Maintain slight squish
          squishFactor = 0.9;
        }
        else if (progress < 0.6) {
          // Quick drop phase
          const dropProgress = (progress - 0.45) / 0.15;
          const easeInQuint = 1 - Math.pow(1 - dropProgress, 5); // Sharp easing for quick drop
          
          verticalDisplacement = -maxStretch * (1 - easeInQuint) * (1 - Math.pow(rowPositionFromBottom, 2));
          
          // Gradually return to normal width
          squishFactor = 0.9 + (0.1 * dropProgress);
        }
        else {
          // Bouncy settling phase
          const settleProgress = (progress - 0.6) / 0.6;
          
          // Create bouncy effect with damped sine wave
          const bounce = Math.sin(settleProgress * Math.PI * 3) * 
                        Math.exp(-settleProgress * 3) * 
                        maxStretch * 0.3;
          
          // Apply bounce effect with more movement in middle of sprite
          const bounceDistribution = 1 - Math.abs(rowPositionFromBottom - 0.5) * 2;
          verticalDisplacement = bounce * bounceDistribution * 5;
          
          // Add horizontal squish/stretch during bounce
          const squishPhase = Math.cos(settleProgress * Math.PI * 3) * 
                             Math.exp(-settleProgress * 3) * 0.15;
          squishFactor = 1.0 + squishPhase;
        }
        
        // Apply transformations to pixels in this row
        pixelsByRow[y].forEach(pixel => {
          // Calculate horizontal displacement based on squish factor
          const distanceFromCenter = pixel.x - centerX;
          const horizontalDisplacement = distanceFromCenter * (squishFactor - 1);
          
          // Apply displacements
          const newX = Math.round(pixel.x + horizontalDisplacement);
          const newY = Math.round(y + verticalDisplacement);
          
          // Draw the pixel
          ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a / 255})`;
          ctx.fillRect(newX, newY, 1, 1);
          
          // Fill gaps if displacement is large
          if (Math.abs(verticalDisplacement) > 1 || Math.abs(horizontalDisplacement) > 1) {
            const steps = Math.max(
              Math.abs(Math.round(verticalDisplacement)),
              Math.abs(Math.round(horizontalDisplacement))
            );
            
            for (let step = 1; step < steps; step++) {
              const fillX = Math.round(pixel.x + (horizontalDisplacement * step / steps));
              const fillY = Math.round(y + (verticalDisplacement * step / steps));
              
              ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a * 0.7 / 255})`;
              ctx.fillRect(fillX, fillY, 1, 1);
            }
          }
        });
      }
      
      // Fill any remaining gaps
      this.fillVerticalGaps(ctx, width, height);
      this.fillHorizontalGaps(ctx, width, height);
      
      // Create frame image
      const frameImg = new Image();
      frameImg.src = frameCanvas.toDataURL();
      frames.push(frameImg);
    }
    
    console.log(`Generated ${frames.length} bounce animation frames`);
    return frames;
  }

  generateBounce2Animation(pixelData, frameCount, intensity, smoothness, canvas) {
    console.log("Starting bounce-2 animation generation");
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Find sprite boundaries
    let minX = width, maxX = 0, minY = height, maxY = 0;
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    const centerX = Math.floor((minX + maxX) / 2);
    const centerY = Math.floor((minY + maxY) / 2);
    const spriteHeight = maxY - minY;
    const spriteWidth = maxX - minX;
    
    // Group pixels by row for line-by-line processing
    const pixelsByRow = {};
    pixels.forEach(pixel => {
      if (!pixelsByRow[pixel.y]) {
        pixelsByRow[pixel.y] = [];
      }
      pixelsByRow[pixel.y].push(pixel);
    });
    
    // Calculate max displacement based on intensity and sprite size
    const sizeMultiplier = parseInt(canvas.width) / 32;
    const maxBounceHeight = Math.max(1, Math.round(intensity * 8 * sizeMultiplier));
    const maxSquish = Math.max(1, Math.round(intensity * 4 * sizeMultiplier));
    
    // Animation phases:
    // 0-15%: Initial crouch (squish)
    // 15-40%: Launch upward with stretch
    // 40-55%: Peak height with slight wave motion
    // 55-70%: Fast drop with stretch
    // 70-85%: Impact squish with wave effect
    // 85-100%: Recovery bounce
    
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const progress = frameIndex / (frameCount - 1);
      
      // Create frame canvas
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      // Process each row from bottom to top
      const sortedRows = Object.keys(pixelsByRow).map(y => parseInt(y)).sort((a, b) => b - a);
      
      let globalVerticalOffset = 0;
      let horizontalScale = 1.0;
      let wavePhase = 0;
      
      if (progress < 0.15) {
        // Initial crouch phase
        const crouchProgress = progress / 0.15;
        const easedProgress = smoothness > 0.5 ? 
          crouchProgress * crouchProgress * (3 - 2 * crouchProgress) : 
          crouchProgress;
        
        globalVerticalOffset = maxBounceHeight * 0.2 * easedProgress;
        horizontalScale = 1 + (maxSquish * 0.01 * easedProgress);
        
      } else if (progress < 0.4) {
        // Launch phase
        const launchProgress = (progress - 0.15) / 0.25;
        const easedProgress = smoothness > 0.5 ? 
          1 - Math.pow(1 - launchProgress, 3) : 
          launchProgress;
        
        globalVerticalOffset = -maxBounceHeight * easedProgress;
        horizontalScale = 1 - (maxSquish * 0.005 * easedProgress);
        wavePhase = launchProgress * Math.PI;
        
      } else if (progress < 0.55) {
        // Peak height phase
        const peakProgress = (progress - 0.4) / 0.15;
        
        globalVerticalOffset = -maxBounceHeight;
        horizontalScale = 0.95 + (0.05 * Math.sin(peakProgress * Math.PI * 2));
        wavePhase = Math.PI + (peakProgress * Math.PI);
        
      } else if (progress < 0.7) {
        // Fast drop phase
        const dropProgress = (progress - 0.55) / 0.15;
        const easedProgress = smoothness > 0.5 ? 
          dropProgress * dropProgress : 
          dropProgress;
        
        globalVerticalOffset = -maxBounceHeight * (1 - easedProgress);
        horizontalScale = 0.95 + (maxSquish * 0.005 * easedProgress);
        
      } else if (progress < 0.85) {
        // Impact squish with wave
        const impactProgress = (progress - 0.7) / 0.15;
        const wavePosition = impactProgress * 2; // Wave moves up through sprite
        
        horizontalScale = 1 + (maxSquish * 0.01 * (1 - impactProgress));
        
        for (const y of sortedRows) {
          const rowPositionFromBottom = (y - minY) / spriteHeight;
          const waveEffect = Math.max(0, 1 - Math.abs(rowPositionFromBottom - wavePosition) * 4);
          
          // Apply vertical displacement based on wave position
          const rowVerticalOffset = maxBounceHeight * 0.3 * waveEffect;
          
          pixelsByRow[y].forEach(pixel => {
            // Scale horizontally from center
            const distanceFromCenter = pixel.x - centerX;
            const scaledX = centerX + (distanceFromCenter * horizontalScale);
            
            // Apply displacements
            const newX = Math.round(scaledX);
            const newY = Math.round(y + rowVerticalOffset);
            
            // Draw pixel
            ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a / 255})`;
            ctx.fillRect(newX, newY, 1, 1);
            
            // Fill gaps if displacement is large
            this.fillPixelGaps(ctx, pixel, newX, newY, pixel.x, y);
          });
        }
        
        // Skip default row processing for this phase
        continue;
        
      } else {
        // Recovery bounce
        const recoveryProgress = (progress - 0.85) / 0.15;
        
        // Create damped bounce effect
        const bounce = Math.sin(recoveryProgress * Math.PI * 3) * 
                      Math.exp(-recoveryProgress * 3);
        
        globalVerticalOffset = maxBounceHeight * 0.2 * bounce;
        horizontalScale = 1 + (maxSquish * 0.005 * bounce);
      }
      
      // Apply transformations to each row
      for (const y of sortedRows) {
        const rowPositionFromBottom = (y - minY) / spriteHeight;
        
        // Calculate row-specific vertical offset including wave effect
        let rowVerticalOffset = globalVerticalOffset;
        
        if (wavePhase > 0) {
          // Add wave motion during certain phases
          const waveEffect = Math.sin(wavePhase + rowPositionFromBottom * Math.PI) *
                           maxBounceHeight * 0.1;
          rowVerticalOffset += waveEffect;
        }
        
        pixelsByRow[y].forEach(pixel => {
          // Scale horizontally from center
          const distanceFromCenter = pixel.x - centerX;
          const scaledX = centerX + (distanceFromCenter * horizontalScale);
          
          // Calculate final positions
          const newX = Math.round(scaledX);
          const newY = Math.round(y + rowVerticalOffset);
          
          // Draw pixel
          ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a / 255})`;
          ctx.fillRect(newX, newY, 1, 1);
          
          // Fill gaps if displacement is large
          this.fillPixelGaps(ctx, pixel, newX, newY, pixel.x, y);
        });
      }
      
      // Fill remaining gaps
      this.fillVerticalGaps(ctx, width, height);
      this.fillHorizontalGaps(ctx, width, height);
      
      // Create frame image
      const frameImg = new Image();
      frameImg.src = frameCanvas.toDataURL();
      frames.push(frameImg);
    }
    
    console.log(`Generated ${frames.length} bounce-2 animation frames`);
    return frames;
  }

  generateSideWaveAnimation(pixelData, frameCount, intensity, smoothness, canvas) {
    console.log("Starting side wave animation generation");
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Find sprite boundaries
    let minX = width, maxX = 0, minY = height, maxY = 0;
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    const centerX = Math.floor((minX + maxX) / 2);
    const spriteHeight = maxY - minY;
    const spriteWidth = maxX - minX;
    
    // Group pixels by x-coordinate for column-by-column processing
    const pixelsByColumn = {};
    pixels.forEach(pixel => {
      if (!pixelsByColumn[pixel.x]) {
        pixelsByColumn[pixel.x] = [];
      }
      pixelsByColumn[pixel.x].push(pixel);
    });
    
    // Calculate max displacement based on intensity and sprite size
    const sizeMultiplier = parseInt(canvas.width) / 32;
    const maxWaveDisplacement = Math.max(1, Math.round(intensity * 6 * sizeMultiplier));
    
    // Animation phases:
    // 0-15%: Initial impact (quick skew)
    // 15-50%: Wave travels left (compression wave)
    // 50-100%: Elastic return with bounce
    
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const progress = frameIndex / (frameCount - 1);
      
      // Create frame canvas
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      // Calculate wave position (starts from right)
      const wavePosition = maxX - (progress * (maxX - minX));
      
      // Process each column from right to left
      const sortedColumns = Object.keys(pixelsByColumn).map(x => parseInt(x)).sort((a, b) => b - a);
      
      for (const x of sortedColumns) {
        const columnPositionFromRight = (maxX - x) / spriteWidth; // 0 at right, 1 at left
        
        let horizontalDisplacement = 0;
        let verticalDisplacement = 0;
        let skewFactor = 0;
        
        if (progress < 0.05) {
          // Initial impact phase
          const impactProgress = progress / 0.15;
          
          // Apply easing based on smoothness for initial push
          const easedProgress = smoothness > 0.5 ? 
            impactProgress * impactProgress * (3 - 2 * impactProgress) : 
            impactProgress;
          
          // Initial skew from right impact
          skewFactor = (1 - columnPositionFromRight) * easedProgress * maxWaveDisplacement * 0.3;
          
          // Horizontal compression from impact
          horizontalDisplacement = -maxWaveDisplacement * easedProgress * (1 - columnPositionFromRight);
        }
        else if (progress < 0.5) {
          // Wave travel phase
          const waveProgress = (progress - 0.15) / 0.35;
          
          // Calculate distance from wave front
          const distanceFromWave = Math.abs(x - wavePosition) / spriteWidth;
          
          // Wave effect is strongest near the wave front
          const waveEffect = Math.exp(-distanceFromWave * 8);
          
          // Apply wave displacement
          horizontalDisplacement = -maxWaveDisplacement * waveEffect * Math.cos(waveProgress * Math.PI);
          
          // Add vertical displacement for wave effect
          verticalDisplacement = maxWaveDisplacement * 0.5 * waveEffect * Math.sin(waveProgress * Math.PI);
        }
        else {
          // Elastic return phase
          const returnProgress = (progress - 0.5) / 0.5;
          
          // Create bouncy return effect
          const bounce = Math.sin(returnProgress * Math.PI * 3) * 
                        Math.exp(-returnProgress * 3) * 
                        maxWaveDisplacement * 0.4;
          
          // Apply bounce with column-based distribution
          const bounceDistribution = 1 - Math.abs(columnPositionFromRight - 0.5) * 2;
          horizontalDisplacement = bounce * bounceDistribution;
        }
        
        // Apply transformations to pixels in this column
        pixelsByColumn[x].forEach(pixel => {
          // More effect at the top, pinned at bottom
          const heightRatio = 1 - ((pixel.y - minY) / spriteHeight);
          
          // Calculate final positions with height-based scaling
          const skewY = skewFactor * heightRatio;
          const finalHorizontal = horizontalDisplacement * heightRatio;
          const finalVertical = verticalDisplacement * heightRatio;
          
          // Apply displacements
          const newX = Math.round(pixel.x + finalHorizontal);
          const newY = Math.round(pixel.y + skewY + finalVertical);
          
          // Draw the pixel
          ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a / 255})`;
          ctx.fillRect(newX, newY, 1, 1);
          
          // Fill gaps if displacement is large
          if (Math.abs(finalHorizontal) > 1 || Math.abs(skewY + finalVertical) > 1) {
            const steps = Math.max(
              Math.abs(Math.round(finalHorizontal)),
              Math.abs(Math.round(skewY + finalVertical))
            );
            
            for (let step = 1; step < steps; step++) {
              const fillX = Math.round(pixel.x + (finalHorizontal * step / steps));
              const fillY = Math.round(pixel.y + ((skewY + finalVertical) * step / steps));
              
              ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a * 0.7 / 255})`;
              ctx.fillRect(fillX, fillY, 1, 1);
            }
          }
        });
      }
      
      // Fill any remaining gaps
      this.fillVerticalGaps(ctx, width, height);
      this.fillHorizontalGaps(ctx, width, height);
      
      // Create frame image
      const frameImg = new Image();
      frameImg.src = frameCanvas.toDataURL();
      frames.push(frameImg);
    }
    
    console.log(`Generated ${frames.length} side wave animation frames`);
    return frames;
  }
  
  generateHitAnimation(pixelData, frameCount, intensity, smoothness, canvas) {
    console.log("Starting hit animation generation");
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Identify the sprite boundary using non-transparent pixels
    let minX = width, maxX = 0, minY = height, maxY = 0;
    
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    // Calculate center based on actual pixels
    const centerX = Math.floor((minX + maxX) / 2);
    const centerY = Math.floor((minY + maxY) / 2);
    console.log(`Sprite center calculated at (${centerX}, ${centerY})`);
    
    // Calculate sprite dimensions
    const spriteHeight = maxY - minY;
    const spriteWidth = maxX - minX;
    console.log(`Sprite size: ${spriteWidth}x${spriteHeight}`);
    
    // Group pixels by y-coordinate for line-by-line processing
    const pixelsByRow = {};
    pixels.forEach(pixel => {
      if (!pixelsByRow[pixel.y]) {
        pixelsByRow[pixel.y] = [];
      }
      pixelsByRow[pixel.y].push(pixel);
    });
    
    // Calculate maximum displacement based on intensity and sprite size
    const sizeMultiplier = parseInt(canvas.width) / 32; // Scale factor based on sprite size
    const maxDisplacement = Math.max(1, Math.round(intensity * 4 * sizeMultiplier));
    console.log(`Max displacement: ${maxDisplacement} pixels`);
    
    // Phase distribution for hit animation
    // 0-15%: Initial flash red (impact)
    // 15-70%: Intense shaking with disintegration effect
    // 70-100%: Recovery back to normal
    
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      // Calculate current progress (0 to 1)
      const progress = frameIndex / (frameCount - 1);
      
      // Create a new canvas for this frame
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      // Clear the canvas
      ctx.clearRect(0, 0, width, height);
      
      // Determine animation phase parameters
      let colorMultiplier = 1.0;  // How red to make the sprite
      let displacementFactor = 0; // How much to shake
      let messinessFactor = 0;    // How much to "disintegrate"
      let shakeAmplitude = 0;     // Global camera shake amplitude
      let wavePosition = 0;       // Position of the wave from bottom (0) to top (1)
      
      if (progress < 0.15) {
        // Initial flash red phase
        const flashProgress = progress / 0.15;
        
        // Linear increase in redness
        colorMultiplier = 1.5 * flashProgress * intensity;
        
        // Initial small random displacement
        displacementFactor = 0.2 * flashProgress * intensity;
        
        // Initial camera shake
        shakeAmplitude = flashProgress * maxDisplacement * 0.8 * intensity;
        
        // Wave starts from bottom
        wavePosition = flashProgress * 0.2; // Only moves slightly up at first
      } 
      else if (progress < 0.7) {
        // Main shaking phase
        const shakeProgress = (progress - 0.15) / 0.55;
        
        // Color transitions from full red to normal
        colorMultiplier = 1.5 * intensity * (1 - Math.pow(shakeProgress, 2));
        
        // Shaking increases quickly then gradually decreases
        displacementFactor = intensity * (1 - Math.pow(shakeProgress - 0.5, 2));
        
        // Messiness peaks in the middle
        messinessFactor = intensity * Math.sin(shakeProgress * Math.PI);
        
        // Camera shake is strongest in the middle
        shakeAmplitude = maxDisplacement * intensity * Math.sin(shakeProgress * Math.PI * 1.5);
        
        // Wave moves from bottom to top throughout this phase
        wavePosition = 0.2 + shakeProgress; // 0.2 to 1.0
      }
      else {
        // Recovery phase
        const recoveryProgress = (progress - 0.7) / 0.3;
        
        // Small-amplitude damped oscillation for recovery
        displacementFactor = 0.3 * intensity * Math.exp(-4 * recoveryProgress) * Math.cos(recoveryProgress * 8 * Math.PI);
        
        // Slight residual redness
        colorMultiplier = 0.2 * intensity * (1 - recoveryProgress);
        
        // Residual camera shake with damped oscillation
        shakeAmplitude = maxDisplacement * 0.3 * intensity * Math.exp(-3 * recoveryProgress) * Math.cos(recoveryProgress * 6 * Math.PI);
        
        // Wave is complete (at top)
        wavePosition = 1.1;
      }
      
      // Apply global camera shake to the entire frame
      const cameraShakeX = Math.round((Math.random() * 2 - 1) * shakeAmplitude);
      const cameraShakeY = Math.round((Math.random() * 2 - 1) * shakeAmplitude);
      
      // Process each row of pixels from bottom to top for the wave effect
      const sortedRows = Object.keys(pixelsByRow).map(y => parseInt(y)).sort((a, b) => b - a); // Sort from bottom to top
      
      for (const y of sortedRows) {
        // Calculate the row's position relative to the sprite (0 at bottom, 1 at top)
        const rowPositionFromBottom = 1 - ((y - minY) / spriteHeight);
        
        // Determine if this row is affected by the wave
        // Wave affects rows from bottom up based on wavePosition
        const rowAffectedByWave = rowPositionFromBottom <= wavePosition;
        
        // Calculate how strongly this row is affected by the wave
        // Strongest at the wave front, fading out above and below
        const waveDistanceFactor = Math.max(0, 1 - Math.abs(rowPositionFromBottom - wavePosition) * 10);
        const waveStrength = rowAffectedByWave ? waveDistanceFactor : 0;
        
        // Calculate a row-specific phase shift for wave-like effect
        const rowFactor = (y - minY) / spriteHeight; // 0 at top, 1 at bottom
        const rowPhaseShift = Math.sin(rowFactor * Math.PI * 3) * 0.5; // Wave-like pattern
        
        // Apply to each pixel in the row
        pixelsByRow[y].forEach(pixel => {
          // Determine which side of the sprite this pixel is on
          const isRightSide = pixel.x >= centerX;
          const distanceFromCenterX = (pixel.x - centerX) / (spriteWidth / 2); // -1 to 1
          const distanceFromCenterY = (pixel.y - centerY) / (spriteHeight / 2); // -1 to 1
          const distanceFromCenter = Math.sqrt(distanceFromCenterX * distanceFromCenterX + distanceFromCenterY * distanceFromCenterY);
          
          // Apply wave-like displacement modified by row and intensity
          const effectiveDisplacement = displacementFactor * maxDisplacement * (1 + rowPhaseShift);
          
          // Calculate random displacements for shaking
          let xShake = 0, yShake = 0;
          
          if (displacementFactor > 0) {
            // Add random horizontal displacement
            xShake = Math.round((Math.random() * 2 - 1) * effectiveDisplacement);
            
            // Add random vertical displacement
            yShake = Math.round((Math.random() * 2 - 1) * effectiveDisplacement * 0.7); // Less vertical shake
            
            // Add position-based displacement (outer parts move more)
            const positionFactor = Math.pow(distanceFromCenter, 1.5) * 0.5;
            xShake += Math.round(distanceFromCenterX * effectiveDisplacement * positionFactor);
            yShake += Math.round(distanceFromCenterY * effectiveDisplacement * positionFactor);
            
            // Add wave effect displacement
            // Wave pushes pixels upward with stronger effect at the wavefront
            if (waveStrength > 0) {
              // Wave displacement is upward (negative y)
              const waveDisplacement = -Math.round(waveStrength * intensity * maxDisplacement * 0.8);
              yShake += waveDisplacement;
              
              // Wave also creates a slight horizontal compression effect
              xShake += Math.round(distanceFromCenterX * waveStrength * intensity * maxDisplacement * 0.4);
            }
          }
          
          // Apply messiness - skip some pixels at random for disintegration effect
          const shouldDrawPixel = Math.random() > (messinessFactor * 0.2 * distanceFromCenter);
          
          if (shouldDrawPixel) {
            // Apply color transformation (non-black pixels turn red)
            let r = pixel.r, g = pixel.g, b = pixel.b;
            
            // Only modify non-black pixels
            const isBlack = pixel.r < 30 && pixel.g < 30 && pixel.b < 30;
            
            if (!isBlack && colorMultiplier > 0) {
              // Convert to red (increase red, decrease green and blue)
              r = Math.min(255, Math.round(pixel.r + (255 - pixel.r) * colorMultiplier));
              g = Math.max(0, Math.round(pixel.g * (1 - colorMultiplier * 0.8)));
              b = Math.max(0, Math.round(pixel.b * (1 - colorMultiplier * 0.8)));
            }
            
            // Calculate final pixel position with shake and camera shake effects
            const newX = Math.min(width - 1, Math.max(0, pixel.x + xShake + cameraShakeX));
            const newY = Math.min(height - 1, Math.max(0, pixel.y + yShake + cameraShakeY));
            
            // Make particles fade out as they fall
            // Ensure particles completely fade out in the last ~10% of frames
            let alpha;
            if (progress > 0.9) {
              // Force complete transparency in the final frames
              const finalFadeout = 1 - ((1 - progress) * 10); // 0 at 0.9 progress, 1 at 1.0 progress
              alpha = Math.max(0, pixel.a * (1 - displacementFactor * 0.8) * (1 - finalFadeout)) / 255;
            } else {
              alpha = Math.max(0, pixel.a * (1 - displacementFactor * 0.8)) / 255;
            }
            
            // Don't render particles with very low alpha to ensure clean final frames
            if (alpha > 0.02) {
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
              ctx.fillRect(newX, newY, 1, 1);
            }
          }
        });
      }
      
      // Create an image from the canvas
      const frameImg = new Image();
      frameImg.src = frameCanvas.toDataURL();
      
      // Add completed frame to the array
      frames.push(frameImg);
    }
    
    console.log(`Generated ${frames.length} hit animation frames`);
    return frames;
  }
  
  generateAttackAnimation2(pixelData, frameCount, intensity, smoothness, canvas) {
    console.log("Starting attack-2 animation generation");
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Find sprite boundaries
    let minX = width, maxX = 0, minY = height, maxY = 0;
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    const centerX = Math.floor((minX + maxX) / 2);
    const centerY = Math.floor((minY + maxY) / 2);
    const spriteHeight = maxY - minY;
    const spriteWidth = maxX - minX;
    
    // Group pixels by row for processing
    const pixelsByRow = {};
    pixels.forEach(pixel => {
      if (!pixelsByRow[pixel.y]) {
        pixelsByRow[pixel.y] = [];
      }
      pixelsByRow[pixel.y].push(pixel);
    });
    
    // Calculate max displacement
    const sizeMultiplier = parseInt(canvas.width) / 32;
    const maxDisplacement = Math.max(1, Math.round(intensity * 5 * sizeMultiplier));
    
    // Distinct attack-2 animation phases
    // 0-20%: Wind-up / preparation phase
    // 20-40%: Forward thrust phase
    // 40-60%: Impact phase
    // 60-80%: Recoil phase
    // 80-100%: Recovery phase
    
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const progress = frameIndex / (frameCount - 1);
      
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      ctx.clearRect(0, 0, width, height);
      
      const sortedRows = Object.keys(pixelsByRow).map(y => parseInt(y)).sort((a, b) => a - b);
      
      for (const y of sortedRows) {
        const rowPositionFromBottom = 1 - ((y - minY) / spriteHeight);
        
        let horizontalDisplacement = 0;
        let verticalDisplacement = 0;
        let skewFactor = 0;
        let colorMultiplier = 1.0;
        
        if (progress < 0.2) {
          // Wind-up phase: Pull back slightly
          const windUpProgress = progress / 0.2;
          skewFactor = -maxDisplacement * 0.3 * windUpProgress * (1 - rowPositionFromBottom);
          horizontalDisplacement = -maxDisplacement * 0.2 * windUpProgress;
        }
        else if (progress < 0.4) {
          // Forward thrust phase
          const thrustProgress = (progress - 0.2) / 0.2;
          horizontalDisplacement = maxDisplacement * 1.5 * thrustProgress * (1 - rowPositionFromBottom);
          skewFactor = maxDisplacement * 0.4 * thrustProgress * (1 - rowPositionFromBottom);
          colorMultiplier = 1.2 * thrustProgress; // Slight color intensity increase
        }
        else if (progress < 0.6) {
          // Impact phase
          const impactProgress = (progress - 0.4) / 0.2;
          horizontalDisplacement = maxDisplacement * (1 - impactProgress);
          verticalDisplacement = Math.sin(impactProgress * Math.PI) * maxDisplacement * 0.5 * rowPositionFromBottom;
          skewFactor = maxDisplacement * 0.2 * (1 - impactProgress);
          colorMultiplier = 1.2 * (1 - impactProgress);
        }
        else if (progress < 0.8) {
          // Recoil phase
          const recoilProgress = (progress - 0.6) / 0.2;
          horizontalDisplacement = -maxDisplacement * 0.5 * (1 - Math.cos(recoilProgress * Math.PI));
          verticalDisplacement = -maxDisplacement * 0.3 * recoilProgress * rowPositionFromBottom;
        }
        else {
          // Recovery phase
          const recoveryProgress = (progress - 0.8) / 0.2;
          horizontalDisplacement = -maxDisplacement * 0.2 * (1 - recoveryProgress);
          verticalDisplacement = maxDisplacement * 0.1 * Math.sin(recoveryProgress * Math.PI) * rowPositionFromBottom;
        }
        
        pixelsByRow[y].forEach(pixel => {
          const distanceFromCenterX = pixel.x - centerX;
          const rowFactor = (pixel.y - minY) / spriteHeight;
          
          // Apply horizontal / vertical displacement with height scaling
          const scaledHorizontalDisplacement = horizontalDisplacement * (1 - rowFactor);
          const scaledVerticalDisplacement = verticalDisplacement * (1 - rowFactor);
          
          // Add slight skew
          const skewAmount = skewFactor * (1 - Math.abs(distanceFromCenterX / (spriteWidth / 2)));
          
          const newX = Math.round(pixel.x + scaledHorizontalDisplacement + skewAmount);
          const newY = Math.round(pixel.y + scaledVerticalDisplacement);
          
          // Apply color transformation
          let r = pixel.r, g = pixel.g, b = pixel.b;

          
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${pixel.a / 255})`;
          ctx.fillRect(newX, newY, 1, 1);
        });
      }
      
      // Fill any pixel gaps
      this.fillVerticalGaps(ctx, width, height);
      this.fillHorizontalGaps(ctx, width, height);
      
      const frameImg = new Image();
      frameImg.src = frameCanvas.toDataURL();
      frames.push(frameImg);
    }
    
    console.log(`Generated ${frames.length} attack-2 animation frames`);
    return frames;
  }

  generateSideWave2Animation(pixelData, frameCount, intensity, smoothness, canvas) {
    console.log("Starting side-wave-2 animation generation");
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Find sprite boundaries
    let minX = width, maxX = 0, minY = height, maxY = 0;
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    const centerX = Math.floor((minX + maxX) / 2);
    const centerY = Math.floor((minY + maxY) / 2);
    const spriteHeight = maxY - minY;
    const spriteWidth = maxX - minX;
    
    // Group pixels by column for wave processing
    const pixelsByColumn = {};
    pixels.forEach(pixel => {
      if (!pixelsByColumn[pixel.x]) {
        pixelsByColumn[pixel.x] = [];
      }
      pixelsByColumn[pixel.x].push(pixel);
    });
    
    // Calculate max displacement based on intensity and sprite size
    const sizeMultiplier = parseInt(canvas.width) / 32;
    const maxSkew = Math.max(1, Math.round(intensity * 6 * sizeMultiplier));
    const maxWaveDisplacement = Math.max(1, Math.round(intensity * 4 * sizeMultiplier));
    
    // Animation phases:
    // 0-15%: Initial push from left with skew
    // 15-50%: Wave travels through sprite
    // 50-100%: Spring-like recoil
    
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const progress = frameIndex / (frameCount - 1);
      
      // Create frame canvas
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      let wavePosition = 0;
      let globalSkew = 0;
      let globalHorizontalOffset = 0;
      
      if (progress < 0.15) {
        // Initial push phase
        const pushProgress = progress / 0.15;
        
        // Apply easing based on smoothness for initial push
        const easedProgress = smoothness > 0.5 ? 
          pushProgress * pushProgress * (3 - 2 * pushProgress) : 
          pushProgress;
        
        globalSkew = maxSkew * easedProgress;
        globalHorizontalOffset = maxWaveDisplacement * 0.5 * easedProgress;
        
      } else if (progress < 0.5) {
        // Wave travel phase
        const waveProgress = (progress - 0.15) / 0.35;
        
        // Wave starts from left (0) and moves to right (1)
        wavePosition = waveProgress;
        
        // Maintain some skew and gradually reduce it
        globalSkew = maxSkew * (1 - waveProgress * 0.7);
        globalHorizontalOffset = maxWaveDisplacement * 0.5 * (1 - waveProgress);
        
      } else {
        // Spring recoil phase
        const recoilProgress = (progress - 0.5) / 0.5;
        
        // Create oscillating spring motion
        const springFactor = Math.sin(recoilProgress * Math.PI * 3) * 
                           Math.exp(-recoilProgress * 3);
        
        globalSkew = maxSkew * 0.3 * springFactor;
        globalHorizontalOffset = maxWaveDisplacement * 0.2 * springFactor;
      }
      
      // Process each column of pixels
      const sortedColumns = Object.keys(pixelsByColumn).map(x => parseInt(x)).sort((a, b) => a - b);
      
      for (const x of sortedColumns) {
        const columnPosition = (x - minX) / spriteWidth; // 0 at left, 1 at right
        
        // Calculate wave effect for this column
        let waveEffect = 0;
        if (progress >= 0.15 && progress < 0.5) {
          // Calculate distance from wave front
          const distanceFromWave = Math.abs(columnPosition - wavePosition);
          // Wave effect strongest near wave front, falls off quickly
          waveEffect = Math.max(0, 1 - distanceFromWave * 5);
        }
        
        pixelsByColumn[x].forEach(pixel => {
          // Calculate vertical position ratio (0 at bottom, 1 at top)
          const verticalRatio = 1 - ((pixel.y - minY) / spriteHeight);
          
          // Base horizontal displacement from global offset
          let horizontalDisplacement = globalHorizontalOffset;
          
          // Add wave displacement
          if (waveEffect > 0) {
            horizontalDisplacement += maxWaveDisplacement * waveEffect * verticalRatio;
          }
          
          // Calculate skew based on height (more at top, pinned at bottom)
          const skewAmount = globalSkew * verticalRatio * verticalRatio;
          
          // Apply transformations
          const newX = Math.round(pixel.x + horizontalDisplacement + skewAmount);
          const newY = pixel.y; // Y position stays the same
          
          // Draw pixel
          ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a / 255})`;
          ctx.fillRect(newX, newY, 1, 1);
          
          // Fill gaps if displacement is large
          this.fillPixelGaps(ctx, pixel, newX, newY, pixel.x, pixel.y);
        });
      }
      
      // Fill remaining gaps
      this.fillVerticalGaps(ctx, width, height);
      this.fillHorizontalGaps(ctx, width, height);
      
      // Create frame image
      const frameImg = new Image();
      frameImg.src = frameCanvas.toDataURL();
      frames.push(frameImg);
    }
    
    console.log(`Generated ${frames.length} side-wave-2 animation frames`);
    return frames;
  }

  // Add helper method for filling pixel gaps
  fillPixelGaps(ctx, pixel, newX, newY, oldX, oldY) {
    if (Math.abs(newX - oldX) > 1 || Math.abs(newY - oldY) > 1) {
      const steps = Math.max(
        Math.abs(newX - oldX),
        Math.abs(newY - oldY)
      );
      
      for (let step = 1; step < steps; step++) {
        const fillX = Math.round(oldX + (newX - oldX) * step / steps);
        const fillY = Math.round(oldY + (newY - oldY) * step / steps);
        
        // Use slightly reduced alpha for interpolated pixels
        const alphaFactor = 1;
        ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a * alphaFactor / 255})`;
        ctx.fillRect(fillX, fillY, 1, 1);
      }
    }
  }

  fillHorizontalGaps(ctx, width, height) {
    // Get the pixel data from the canvas
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let modified = false;
    
    // Process row by row for horizontal gaps
    for (let y = 0; y < height; y++) {
      let lastPixelX = -1;
      let lastPixelColor = null;
      
      // Scan across each row looking for gaps
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        
        if (alpha > 0) {
          // If we have a pixel, check if there's a small gap from the last pixel
          if (lastPixelX !== -1 && x - lastPixelX <= 3 && x - lastPixelX > 1) {
            // We found a small gap! Fill it with the last pixel's color
            for (let fillX = lastPixelX + 1; fillX < x; fillX++) {
              const fillIdx = (y * width + fillX) * 4;
              data[fillIdx] = lastPixelColor[0];     // R
              data[fillIdx + 1] = lastPixelColor[1]; // G
              data[fillIdx + 2] = lastPixelColor[2]; // B
              data[fillIdx + 3] = lastPixelColor[3]; // A
              modified = true;
            }
          }
          
          // Remember this pixel for potential future gaps
          lastPixelX = x;
          lastPixelColor = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
        }
      }
    }
    
    // If we made changes, update the canvas
    if (modified) {
      ctx.putImageData(imageData, 0, 0);
    }
  }

  fillVerticalGaps(ctx, width, height) {
    // Get the pixel data from the canvas
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let modified = false;
    
    // Process column by column for vertical gaps
    for (let x = 0; x < width; x++) {
      let lastPixelY = -1;
      let lastPixelColor = null;
      
      // Scan down each column looking for gaps
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        
        if (alpha > 0) {
          // If we have a pixel, check if there's a small gap from the last pixel
          if (lastPixelY !== -1 && y - lastPixelY <= 3 && y - lastPixelY > 1) {
            // We found a small gap! Fill it with the last pixel's color
            for (let fillY = lastPixelY + 1; fillY < y; fillY++) {
              const fillIdx = (fillY * width + x) * 4;
              data[fillIdx] = lastPixelColor[0];     // R
              data[fillIdx + 1] = lastPixelColor[1]; // G
              data[fillIdx + 2] = lastPixelColor[2]; // B
              data[fillIdx + 3] = lastPixelColor[3]; // A
              modified = true;
            }
          }
          
          // Remember this pixel for potential future gaps
          lastPixelY = y;
          lastPixelColor = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
        }
      }
    }
    
    // If we made changes, update the canvas
    if (modified) {
      ctx.putImageData(imageData, 0, 0);
    }
  }
  
  generateIdleAnimation(pixelData, frameCount, intensity, smoothness, canvas) {
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Create subtle idle animation (slight movement)
    for (let i = 0; i < frameCount; i++) {
      const phase = i / frameCount * Math.PI * 2;
      const subtleShift = intensity * 0.5 * Math.sin(phase);
      
      // Create a new canvas for this frame
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      // Apply subtle shift to each pixel
      pixels.forEach(pixel => {
        // More movement at the top than the bottom (like breathing)
        const heightRatio = (height - pixel.y) / height;
        const shift = subtleShift * heightRatio;
        
        const newX = pixel.x;
        const newY = pixel.y + shift;
        
        // Draw the pixel at the new position
        ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a / 255})`;
        ctx.fillRect(Math.round(newX), Math.round(newY), 1, 1);
      });
      
      // Create an image from the canvas
      const frameImage = new Image();
      frameImage.src = frameCanvas.toDataURL();
      
      // Add to frames array
      frames.push(frameImage);
    }
    
    return frames;
  }

  generateFinaleAnimation(pixelData, frameCount, intensity, smoothness, canvas) {
    console.log("Starting finale animation generation");
    const frames = [];
    const { pixels, width, height } = pixelData;
    
    // Find sprite boundaries
    let minX = width, maxX = 0, minY = height, maxY = 0;
    pixels.forEach(pixel => {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    });
    
    const centerX = Math.floor((minX + maxX) / 2);
    const centerY = Math.floor((minY + maxY) / 2);
    const spriteWidth = maxX - minX;
    const spriteHeight = maxY - minY;
    
    // Initialize Perlin noise for patch generation
    const perlin = new PerlinNoise();
    
    // Group pixels by position for easier processing
    const pixelsByPos = {};
    pixels.forEach(pixel => {
      const key = `${pixel.x},${pixel.y}`;
      pixelsByPos[key] = pixel;
    });
    
    // Create paint patch patterns
    const patchCount = 103 + Math.floor(intensity * 3); // 3-6 patches based on intensity
    const patches = [];
    
    for (let i = 0; i < patchCount; i++) {
      // Generate random patch center within sprite bounds
      const centerPatchX = minX + Math.random() * spriteWidth;
      const centerPatchY = minY + Math.random() * spriteHeight;
      
      // Random patch size
      const patchSize = Math.max(spriteWidth, spriteHeight) * (0.3 + Math.random() * 0.4);
      
      // Random time offset for when this patch appears (0-0.7 progress)
      const timeOffset = Math.random() * 0.7;
      
      patches.push({
        x: centerPatchX,
        y: centerPatchY,
        size: patchSize,
        timeOffset,
        noiseOffset: Math.random() * 1000, // Random offset for noise variation
        angle: Math.random() * Math.PI * 2, // Random angle for directional spread
        whitePixels: new Set() // Track white pixels for this patch
      });
    }
    
    // Calculate max displacement for bouncing
    const sizeMultiplier = parseInt(canvas.width) / 32;
    const maxDisplacement = Math.max(1, Math.round(intensity * 4 * sizeMultiplier));
    
    // Keep track of white pixels across frames
    const persistentWhitePixels = new Set();
    
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const progress = frameIndex / (frameCount - 1);
      
      // Create frame canvas
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const ctx = frameCanvas.getContext('2d');
      
      // Calculate bounce and jiggle effects
      const bounceOffset = Math.sin(progress * Math.PI * 4) * 
                         Math.exp(-progress * 2) * 
                         maxDisplacement;
      
      const jiggleFrequency = 12 + progress * 8;
      const jiggleAmplitude = maxDisplacement * 0.5 * Math.exp(-progress * 2);
      
      // Draw each pixel with transformations
      pixels.forEach(pixel => {
        // NEW ADDITION: Check if pixel is black (very dark)
        const isBlackPixel = pixel.r < 20 && pixel.g < 20 && pixel.b < 20;
        
        // Calculate vertical position ratio (0 at bottom, 1 at top)
        const verticalRatio = (pixel.y - minY) / spriteHeight;
        
        // Apply bounce and jiggle
        let offsetX = Math.sin(progress * jiggleFrequency + pixel.y * 0.1) * jiggleAmplitude;
        let offsetY = bounceOffset * (1 - Math.pow(verticalRatio, 2));
        
        // Check if this pixel is already a persistent white pixel
        const pixelKey = `${pixel.x},${pixel.y}`;
        const isAlreadyWhite = persistentWhitePixels.has(pixelKey);
        
        // Calculate white paint coverage for this pixel
        let whiteCoverage = 0;
        
        // For non-black pixels
        if (!isBlackPixel) {
          // Check each patch's contribution
          patches.forEach(patch => {
            if (progress >= patch.timeOffset) {
              // Calculate distance from patch center
              const dx = pixel.x - patch.x;
              const dy = pixel.y - patch.y;
              
              // Rotate point based on patch angle
              const rotatedX = dx * Math.cos(patch.angle) - dy * Math.sin(patch.angle);
              const rotatedY = dx * Math.sin(patch.angle) + dy * Math.cos(patch.angle);
              
              // Scale coordinates for noise
              const noiseScale = 0.05;
              const noiseX = (rotatedX * noiseScale) + patch.noiseOffset;
              const noiseY = (rotatedY * noiseScale) + patch.noiseOffset;
              
              // Generate noise value
              const noiseValue = perlin.noise(noiseX, noiseY, progress * 5);
              
              // Calculate distance-based falloff
              const distance = Math.sqrt(dx * dx + dy * dy);
              const falloff = Math.max(0, 1 - distance / patch.size);
              
              // Combine noise and falloff with sharp transition
              const patchEffect = (noiseValue * 0.5 + 0.5) * falloff;
              
              // Apply patch progress
              const patchProgress = Math.min(1, (progress - patch.timeOffset) * 3);
              
              // Add to total coverage with threshold for sharp edges
              if (patchEffect * patchProgress > 0.5) {
                whiteCoverage = Math.max(whiteCoverage, patchEffect * patchProgress);
                
                // Track this pixel for the patch and for persistent white
                patch.whitePixels.add(pixelKey);
              }
            }
          });
          
          // Force full white coverage in final frames
          if (progress > 1.9) {
            whiteCoverage = Math.max(whiteCoverage, (progress - 0.9) * 10);
          }
        }
        
        // Apply final position and color
        const newX = Math.round(pixel.x + offsetX);
        const newY = Math.round(pixel.y + offsetY);
        
        // Determine color based on white coverage
        let r, g, b, alpha;
        
        // Modify color only for non-black pixels
        if (!isBlackPixel) {
          // Use persistent white pixels or newly calculated white pixels
          if (isAlreadyWhite || whiteCoverage > 0.5) {
            // Fully white
            r = 255;
            g = 255;
            b = 255;
            alpha = 255; // Full opacity
            
            // Add to persistent white pixels if newly added
            if (!isAlreadyWhite && whiteCoverage > 0.5) {
              persistentWhitePixels.add(pixelKey);
            }
          } else {
            // Original pixel color
            r = pixel.r;
            g = pixel.g;
            b = pixel.b;
            alpha = pixel.a;
          }
        } else {
          // Black pixels remain completely unchanged
          r = pixel.r;
          g = pixel.g;
          b = pixel.b;
          alpha = pixel.a;
        }
        
        // Draw the pixel
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha / 255})`;
        ctx.fillRect(newX, newY, 1, 1);
        
        // Fill gaps caused by pixel movement
        this.fillPixelGaps(ctx, { r, g, b, a: alpha }, newX, newY, pixel.x, pixel.y);
      });
      
      // Fill any remaining gaps
      this.fillVerticalGaps(ctx, width, height);
      this.fillHorizontalGaps(ctx, width, height);
      
      // Create frame image
      const frameImg = new Image();
      frameImg.src = frameCanvas.toDataURL();
      frames.push(frameImg);
    }
    
    console.log(`Generated ${frames.length} finale animation frames`);
    return frames;
  }
}

class PerlinNoise {
  constructor() {
    this.permutation = new Array(256).fill(0).map((_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
    }
    this.p = [...this.permutation, ...this.permutation];
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(t, a, b) {
    return a + t * (b - a);
  }

  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x, y, z = 0) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    const A = this.p[X] + Y;
    const AA = this.p[A] + Z;
    const AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y;
    const BA = this.p[B] + Z;
    const BB = this.p[B + 1] + Z;

    return this.lerp(w,
      this.lerp(v,
        this.lerp(u,
          this.grad(this.p[AA], x, y, z),
          this.grad(this.p[BA], x - 1, y, z)
        ),
        this.lerp(u,
          this.grad(this.p[AB], x, y - 1, z),
          this.grad(this.p[BB], x - 1, y - 1, z)
        )
      ),
      this.lerp(v,
        this.lerp(u,
          this.grad(this.p[AA + 1], x, y, z - 1),
          this.grad(this.p[BA + 1], x - 1, y, z - 1)
        ),
        this.lerp(u,
          this.grad(this.p[AB + 1], x, y - 1, z - 1),
          this.grad(this.p[BB + 1], x - 1, y - 1, z - 1)
        )
      )
    );
  }
}