// The buy menu: a DOM panel shown during the buy phase (and toggled with B). It reads the
// player's money, charges prices through rounds.spend and reports purchases back. Numbers
// in; the simulation stays in rounds.js and weapon.js.
import { WEAPONS } from './weapon.js';

const ARMOR_PRICE = 650;
const FRAG_PRICE = 350;

export function createBuy(rounds, hooks, audio) {
  const panel = document.getElementById('buy');
  const rows = document.getElementById('buy-rows');
  const moneyLabel = document.getElementById('buy-money');
  let open = false;

  const items = [
    ...WEAPONS.filter((weapon) => weapon.price > 0).map((weapon) => ({
      kind: 'weapon', id: weapon.id, name: weapon.name, price: weapon.price, key: String(WEAPONS.indexOf(weapon) + 1),
    })),
    { kind: 'armor', id: 'armor', name: 'KEVLAR WEAVE', price: ARMOR_PRICE, key: '5' },
    { kind: 'frag', id: 'frag', name: 'FRAG GRENADE', price: FRAG_PRICE, key: '6' },
  ];

  for (const item of items) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'buy-row';
    row.innerHTML = `<span class="buy-key">${item.key}</span><span class="buy-name">${item.name}</span><span class="buy-price">$${item.price}</span>`;
    row.addEventListener('click', () => tryPurchase(item));
    rows.appendChild(row);
    item.element = row;
  }

  function tryPurchase(item) {
    if (!open) return;
    if (hooks.canBuy(item) && rounds.spend(item.price)) {
      hooks.purchased(item);
      audio.empty();
      refresh();
    }
  }

  function refresh() {
    const money = rounds.playerMoney();
    moneyLabel.textContent = `$${money}`;
    for (const item of items) item.element.classList.toggle('too-poor', item.price > money);
  }

  return {
    items,
    ARMOR_PRICE,
    FRAG_PRICE,
    show() {
      open = true;
      panel.hidden = false;
      refresh();
    },
    hide() {
      open = false;
      panel.hidden = true;
    },
    isOpen() { return open; },
    toggle() {
      if (open) this.hide();
      else this.show();
    },
    refresh,
  };
}
