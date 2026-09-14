export class KeymapEngine {
  constructor(sendTouchCallback, sendCommandCallback) {
    this.activeProfile = null;
    this.sendTouch = sendTouchCallback;
    this.sendCommand = sendCommandCallback;
    
    // Virtual pointer IDs start at 10 to prevent conflict with native pointers (0-9 or -1)
    this.pointerIdBase = 10;
    this.activePointers = new Map(); // mapping.id -> pointerId
    
    // Joystick state record mapping.id -> { state: { up, down, left, right }, pointerId: number|null }
    this.joysticks = new Map(); 
    
    // Wheel state record mapping.id -> { pointerId1, pointerId2, timeoutId, accumulatedDelta }
    this.wheels = new Map();
  }

  updateProfile(profile) {
    this.activeProfile = profile;
    // When switching profiles, release all currently active simulated touches
    this.releaseAll();
  }

  releaseAll() {
    // Send ACTION_UP (1) to release all tap touches
    for (const [mapId, pointerId] of this.activePointers.entries()) {
      this.sendTouch(1, 0, 0, pointerId, { x: 0, y: 0, isRotated: true });
    }
    this.activePointers.clear();

    // Release all joystick touches
    for (const [mapId, joy] of this.joysticks.entries()) {
      if (joy.pointerId !== null) {
        this.sendTouch(1, 0, 0, joy.pointerId, { x: 0, y: 0, isRotated: true });
        joy.pointerId = null;
      }
      joy.state = { up: false, down: false, left: false, right: false };
    }
    
    // Release all wheel touches
    for (const [mapId, state] of this.wheels.entries()) {
      if (state.timeoutId) clearTimeout(state.timeoutId);
      if (state.pointerId1 !== null) {
        this.sendTouch(1, 0, 0, state.pointerId1, { x: 0, y: 0, isRotated: true });
      }
      if (state.pointerId2 !== null) {
        this.sendTouch(1, 0, 0, state.pointerId2, { x: 0, y: 0, isRotated: true });
      }
    }
    this.wheels.clear();
  }

  /**
   * Handle keyboard event
   * @param {KeyboardEvent} event 
   * @param {boolean} isDown 
   * @param {number} videoWidth 
   * @param {number} videoHeight 
   * @returns {boolean} Whether the event was consumed
   */
  handleKeyEvent(event, isDown, videoWidth, videoHeight) {
    if (!this.activeProfile || !this.activeProfile.mappings) return false;
    
    const key = event.key.toLowerCase();
    let consumed = false;
    
    for (const map of this.activeProfile.mappings) {
      if (map.type === 'tap' && map.key.toLowerCase() === key) {
        if (!event.repeat) {
          this.handleTap(map, isDown, videoWidth, videoHeight);
        }
        consumed = true;
      }
      else if (map.type === 'command' && map.key.toLowerCase() === key) {
        if (isDown && !event.repeat) {
          // console.log(`[Keymap] Executing command for key ${key}: ${map.cmd}`);
          this.sendCommand(map.cmd);
        }
        consumed = true;
      }
      else if (map.type === 'joystick') {
        const keys = map.keys;
        let direction = null;
        if (key === keys.up.toLowerCase()) direction = 'up';
        else if (key === keys.down.toLowerCase()) direction = 'down';
        else if (key === keys.left.toLowerCase()) direction = 'left';
        else if (key === keys.right.toLowerCase()) direction = 'right';
        
        if (direction) {
          if (!event.repeat) {
            this.handleJoystick(map, direction, isDown, videoWidth, videoHeight);
          }
          consumed = true;
        }
      }
      else if (map.type === 'swipe' && map.key.toLowerCase() === key) {
        if (!event.repeat) {
          this.handleSwipe(map, isDown, videoWidth, videoHeight);
        }
        consumed = true;
      }
    }
    
    return consumed;
  }

  handleTap(map, isDown, videoWidth, videoHeight) {
    // Coordinate calculation: pos.x/y is percentage relative to original video size
    const px = map.pos.x * videoWidth;
    const py = map.pos.y * videoHeight;
    const coord = { x: px, y: py, isRotated: true };

    if (isDown) {
      if (!this.activePointers.has(map.id)) {
        const ptrId = this.pointerIdBase++;
        this.activePointers.set(map.id, ptrId);
        // Action 0: ACTION_DOWN
        this.sendTouch(0, 0, 0, ptrId, coord); 
      }
    } else {
      if (this.activePointers.has(map.id)) {
        const ptrId = this.activePointers.get(map.id);
        // Action 1: ACTION_UP
        this.sendTouch(1, 0, 0, ptrId, coord);
        this.activePointers.delete(map.id);
      }
    }
  }

  handleJoystick(map, direction, isDown, videoWidth, videoHeight) {
    if (!this.joysticks.has(map.id)) {
      this.joysticks.set(map.id, { state: { up: false, down: false, left: false, right: false }, pointerId: null });
    }
    const joy = this.joysticks.get(map.id);
    
    // Update key pressed state
    joy.state[direction] = isDown;
    
    // Compute direction vector
    let dx = 0;
    let dy = 0;
    if (joy.state.up) dy -= 1;
    if (joy.state.down) dy += 1;
    if (joy.state.left) dx -= 1;
    if (joy.state.right) dx += 1;
    
    const isNeutral = (dx === 0 && dy === 0);
    
    const centerX = map.center.x * videoWidth;
    const centerY = map.center.y * videoHeight;
    const radiusPx = map.radius * videoWidth; // Radius based on width percentage
    
    if (isNeutral) {
      // State: active -> neutral (send ACTION_UP)
      if (joy.pointerId !== null) {
        const centerCoord = { x: centerX, y: centerY, isRotated: true };
        this.sendTouch(1, 0, 0, joy.pointerId, centerCoord);
        joy.pointerId = null;
      }
    } else {
      // Normalize vector to maintain uniform radius distance
      const length = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / length;
      const ny = dy / length;
      
      const targetX = centerX + nx * radiusPx;
      const targetY = centerY + ny * radiusPx;
      const coord = { x: targetX, y: targetY, isRotated: true };
      
      if (joy.pointerId === null) {
        // State: neutral -> active (ACTION_DOWN at center, immediately ACTION_MOVE to edge)
        joy.pointerId = this.pointerIdBase++;
        const centerCoord = { x: centerX, y: centerY, isRotated: true };
        this.sendTouch(0, 0, 0, joy.pointerId, centerCoord);
        this.sendTouch(2, 0, 0, joy.pointerId, coord);
      } else {
        // State: active -> active (direction changed, send ACTION_MOVE)
        this.sendTouch(2, 0, 0, joy.pointerId, coord);
      }
    }
  }

  handleSwipe(map, isDown, videoWidth, videoHeight) {
    if (isDown) {
      if (this.activePointers.has(map.id)) return;

      const ptrId = this.pointerIdBase++;
      this.activePointers.set(map.id, ptrId);

      const startX = map.startPos.x * videoWidth;
      const startY = map.startPos.y * videoHeight;
      const endX = map.endPos.x * videoWidth;
      const endY = map.endPos.y * videoHeight;
      
      const duration = map.duration || 150; 
      const startTime = Date.now();
      
      this.sendTouch(0, 0, 0, ptrId, { x: startX, y: startY, isRotated: true });
      
      const requestAnimFrame = (typeof requestAnimationFrame !== 'undefined') 
        ? requestAnimationFrame 
        : (cb) => setTimeout(cb, 16);

      const animate = () => {
        if (!this.activePointers.has(map.id) || this.activePointers.get(map.id) !== ptrId) {
          return;
        }
        
        const now = Date.now();
        const elapsed = now - startTime;
        let progress = elapsed / duration;
        if (progress >= 1) progress = 1;
        
        const currentX = startX + (endX - startX) * progress;
        const currentY = startY + (endY - startY) * progress;
        
        this.sendTouch(2, 0, 0, ptrId, { x: currentX, y: currentY, isRotated: true });
        
        if (progress < 1) {
          requestAnimFrame(animate);
        }
      };
      
      requestAnimFrame(animate);
      
    } else {
      if (this.activePointers.has(map.id)) {
        const ptrId = this.activePointers.get(map.id);
        const endX = map.endPos.x * videoWidth;
        const endY = map.endPos.y * videoHeight;
        this.sendTouch(1, 0, 0, ptrId, { x: endX, y: endY, isRotated: true });
        this.activePointers.delete(map.id);
      }
    }
  }

  /**
   * Handle wheel events
   */
  handleWheelEvent(event, videoWidth, videoHeight) {
    if (!this.activeProfile || !this.activeProfile.mappings) return false;
    
    let consumed = false;
    for (const map of this.activeProfile.mappings) {
      if (map.type === 'wheel') {
        this.handleWheel(map, event.deltaY, videoWidth, videoHeight);
        consumed = true;
      }
    }
    return consumed;
  }

  handleWheel(map, deltaY, videoWidth, videoHeight) {
    if (!this.wheels.has(map.id)) {
      this.wheels.set(map.id, { pointerId1: null, pointerId2: null, timeoutId: null, accumulatedDelta: 0 });
    }
    const state = this.wheels.get(map.id);
    const px = map.pos.x * videoWidth;
    const py = map.pos.y * videoHeight;

    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }

    if (map.action === 'scroll') {
      if (state.pointerId1 === null) {
        state.pointerId1 = this.pointerIdBase++;
        // Determine initial touch point based on wheel direction
        state.accumulatedDelta = Math.sign(deltaY) * (videoHeight * 0.15);
        let startY = py + state.accumulatedDelta;
        startY = Math.max(0, Math.min(videoHeight, startY));
        this.sendTouch(0, 0, 0, state.pointerId1, { x: px, y: startY, isRotated: true });
      }
      
      const step = Math.sign(deltaY) * (videoHeight * 0.06); 
      state.accumulatedDelta -= step;
      
      let currentY = py + state.accumulatedDelta;
      
      // If dragged beyond 30% screen height or reached edge, release finger to simulate realistic flick
      if (currentY <= 0 || currentY >= videoHeight || Math.abs(state.accumulatedDelta) > videoHeight * 0.3) {
        currentY = Math.max(0, Math.min(videoHeight, currentY));
        this.sendTouch(2, 0, 0, state.pointerId1, { x: px, y: currentY, isRotated: true });
        this.sendTouch(1, 0, 0, state.pointerId1, { x: px, y: currentY, isRotated: true });
        state.pointerId1 = null;
      } else {
        this.sendTouch(2, 0, 0, state.pointerId1, { x: px, y: currentY, isRotated: true });
        
        state.timeoutId = setTimeout(() => {
          if (state.pointerId1 !== null) {
            this.sendTouch(1, 0, 0, state.pointerId1, { x: px, y: currentY, isRotated: true });
            state.pointerId1 = null;
          }
        }, 200);
      }
      
    } else if (map.action === 'zoom') {
      // Anchor origin at screen center at 45-degree angle to simulate natural pinch gestures
      const centerX = videoWidth / 2;
      const centerY = videoHeight / 2;
      const minRadius = videoHeight * 0.05;
      const maxRadius = videoHeight * 0.40;

      if (state.pointerId1 === null) {
        state.pointerId1 = this.pointerIdBase++;
        state.pointerId2 = this.pointerIdBase++;
        
        // Zoom in: spread from center outwards; Zoom out: pinch inwards from perimeter
        if (deltaY < 0) { // scroll up -> zoom in
          state.accumulatedDelta = minRadius + (videoHeight * 0.02);
        } else { // scroll down -> zoom out
          state.accumulatedDelta = maxRadius - (videoHeight * 0.02);
        }
        
        const angle = Math.PI / 4; // 45 degree angle
        const offsetX = state.accumulatedDelta * Math.cos(angle);
        const offsetY = state.accumulatedDelta * Math.sin(angle);
        
        this.sendTouch(0, 0, 0, state.pointerId1, { x: centerX - offsetX, y: centerY - offsetY, isRotated: true });
        this.sendTouch(0, 0, 0, state.pointerId2, { x: centerX + offsetX, y: centerY + offsetY, isRotated: true });
      }

      const step = Math.sign(deltaY) * (videoHeight * 0.05); 
      // scroll up (deltaY<0) -> step < 0 -> accumulatedDelta increases (zoom in)
      // scroll down (deltaY>0) -> step > 0 -> accumulatedDelta decreases (zoom out)
      state.accumulatedDelta -= step;
      
      let outOfBounds = false;
      if (state.accumulatedDelta <= minRadius) {
        state.accumulatedDelta = minRadius;
        outOfBounds = true;
      }
      if (state.accumulatedDelta >= maxRadius) {
        state.accumulatedDelta = maxRadius;
        outOfBounds = true;
      }

      const angle = Math.PI / 4;
      const offsetX = state.accumulatedDelta * Math.cos(angle);
      const offsetY = state.accumulatedDelta * Math.sin(angle);

      this.sendTouch(2, 0, 0, state.pointerId1, { x: centerX - offsetX, y: centerY - offsetY, isRotated: true });
      this.sendTouch(2, 0, 0, state.pointerId2, { x: centerX + offsetX, y: centerY + offsetY, isRotated: true });

      if (outOfBounds) {
        // Reached pinch limit, release fingers immediately to allow next gesture cycle
        this.sendTouch(1, 0, 0, state.pointerId1, { x: centerX - offsetX, y: centerY - offsetY, isRotated: true });
        this.sendTouch(1, 0, 0, state.pointerId2, { x: centerX + offsetX, y: centerY + offsetY, isRotated: true });
        state.pointerId1 = null;
        state.pointerId2 = null;
      } else {
        state.timeoutId = setTimeout(() => {
          if (state.pointerId1 !== null) {
            this.sendTouch(1, 0, 0, state.pointerId1, { x: centerX - offsetX, y: centerY - offsetY, isRotated: true });
            this.sendTouch(1, 0, 0, state.pointerId2, { x: centerX + offsetX, y: centerY + offsetY, isRotated: true });
            state.pointerId1 = null;
            state.pointerId2 = null;
          }
        }, 200);
      }
    }
  }
}
