// Keyboard, mouse and pointer-lock input. The simulation only reads this state; the DOM
// events write it. Pointer lock is the whole mouse-look story: no lock, no look.

export function createInput(canvas, hooks) {
  const state = {
    keys: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    firing: false,
    locked: false,
  };

  const blocked = new Set(['Tab', 'F1', 'F5', 'F12']);

  window.addEventListener('keydown', (event) => {
    if (blocked.has(event.key)) event.preventDefault();
    state.keys.add(event.code);
    if (event.code === 'Tab') event.preventDefault();
    if (hooks.key) hooks.key(event.code);
  });
  window.addEventListener('keyup', (event) => state.keys.delete(event.code));
  window.addEventListener('blur', () => { state.keys.clear(); state.firing = false; });

  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      if (!state.locked) { canvas.requestPointerLock?.(); return; }
      state.firing = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.mouseDX += event.movementX || 0;
    state.mouseDY += event.movementY || 0;
  });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) state.firing = false;
    if (hooks.lockChange) hooks.lockChange(state.locked);
  });

  // Drain() hands the accumulated look delta to the frame and zeroes it.
  return {
    state,
    drain() {
      const delta = { dx: state.mouseDX, dy: state.mouseDY };
      state.mouseDX = 0;
      state.mouseDY = 0;
      return delta;
    },
  };
}
