export class Input {
  constructor() {
    this.keys = new Set();
    this.mouse = { x: 640, y: 400, down: false };
    this.pressed = new Set();
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) { this.keys.add(e.key.toLowerCase()); this.pressed.add(e.key.toLowerCase()); }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    const cnv = document.getElementById('game');
    const toLogic = (e) => {
      const r = cnv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (1280 / r.width), y: (e.clientY - r.top) * (800 / r.height) };
    };
    cnv.addEventListener('mousemove', (e) => { const p = toLogic(e); this.mouse.x = p.x; this.mouse.y = p.y; });
    cnv.addEventListener('mousedown', (e) => { this.mouse.down = true; this.pressed.add('click'); const p = toLogic(e); this.mouse.x = p.x; this.mouse.y = p.y; });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    cnv.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(...ks) { return ks.some((k) => this.keys.has(k)); }
  hit(k) { return this.pressed.has(k); }
  endFrame() { this.pressed.clear(); }
}
