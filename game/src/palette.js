// The look plan, in one place. BREACH LINE uses a cool slate field with two team hues:
// cobalt (defenders, the player's side) and ember (attackers). The same six names are
// the CSS custom properties in index.html.
export const PALETTE = {
  canvas: '#20242c',
  surface: '#2c333d',
  hairline: '#3a4450',
  ink: '#e8e4da',
  muted: '#9aa5b1',
  accent: '#3f9b8f',
};

export const TEAMS = {
  cobalt: 0x3d6fb8,
  ember: 0xc4572e,
};

export function shade(name) {
  return PALETTE[name];
}
