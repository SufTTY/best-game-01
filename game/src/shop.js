// The buy menu: a DOM panel shown during the buy phase and toggled with B. It prices every
// rifle, armour and a frag against the round purse; purchases run through rounds.spend, so
// the economy stays in one place. Keys 1-6 buy, B closes.

import { WEAPONS, ARMOR_PRICE, FRAG_PRICE } from './config.js';

export function createShop(rounds, hooks, audio) {
  const panel = document.getElementById('buy');
  const rows = document.getElementById('buy-rows');
  const moneyLabel = document.getElementById('buy-money');
  let open = false;

  const items = [
    ...WEAPONS.filter((w) => w.price > 0).map((w, i) => ({ kind: 'weapon', id: w.id, name: w.name, price: w.price, key: String(i + 1) })),
    { kind: 'armor', id: 'armor', name: 'KEVLAR WEAVE', price: ARMOR_PRICE, key: '5' },
    { kind: 'frag', id: 'frag', name: 'FRAG GRENADE', price: FRAG_PRICE, key: '6' },
  ];

  for (const item of items) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'buy-row';
    row.innerHTML = `<span class="buy-key">${item.key}</span><span class="buy-name">${item.name}</span><span class="buy-price">$${item.price}</span>`;
    row.addEventListener('click', () => buy(item));
    rows.appendChild(row);
    item.element = row;
  }

  function buy(item) {
    if (!open) return false;
    const money = rounds.playerMoney();
    if (item.price > money) { audio.empty(); return false; }
    if (item.kind === 'weapon' && hooks.hasWeapon(item.id)) { audio.empty(); return false; }
    if (item.kind === 'armor' && hooks.armorLevel() >= 100) { audio.empty(); return false; }
    if (item.kind === 'frag' && hooks.fragCount() >= 2) { audio.empty(); return false; }
    if (!rounds.spend('cobalt', item.price)) return false;
    hooks.purchased(item);
    audio.buy();
    refresh();
    return true;
  }

  function refresh() {
    const money = rounds.playerMoney();
    moneyLabel.textContent = `$${money}`;
    for (const item of items) item.element.classList.toggle('too-poor', item.price > money);
  }

  return {
    items,
    buyByKey(key) {
      const item = items.find((i) => i.key === key);
      return item ? buy(item) : false;
    },
    show() { open = true; panel.hidden = false; refresh(); },
    hide() { open = false; panel.hidden = true; },
    isOpen() { return open; },
    toggle() { if (open) this.hide(); else this.show(); },
    refresh,
  };
}
