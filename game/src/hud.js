// The DOM HUD. It reads numbers pushed into it and never touches the simulation. One
// panel, one banner, one kill feed: every player action answers back somewhere on screen.

const COPY = {
  start: {
    title: 'BREACH LINE',
    copy: 'Hold MERIDIAN STATION. EMBER pushes the demo charge every round — stop the arm, or defuse it before it blows. First to five rounds.',
    action: 'Click to play',
  },
  paused: {
    title: 'PAUSED',
    copy: 'The match waits. Click to resume.',
    action: 'Click to resume',
  },
  dead: {
    title: 'DOWN',
    copy: 'You went down this round. Your squad fights on — the next round buys you back in.',
    action: 'Watch the round',
  },
  match: {
    title: 'MATCH OVER',
    copy: 'The score is settled.',
    action: 'Play again',
  },
};

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), title = $('overlay-title'), copy = $('overlay-copy'), play = $('play');
  const ammoMag = $('ammo-mag'), ammoReserve = $('ammo-reserve'), ammoLabel = $('ammo-label');
  const moneyValue = $('money-value'), scoreCobalt = $('score-cobalt'), scoreEmber = $('score-ember');
  const timerValue = $('timer-value'), objective = $('objective'), roster = $('roster');
  const armorRow = $('armor'), armorFill = $('armor-fill');
  const healthFill = $('health-fill'), healthValue = $('health-value');
  const banner = $('banner'), bannerTitle = $('banner-title'), bannerSub = $('banner-sub');
  const feed = $('feed'), crosshair = $('crosshair'), hitmarker = $('hitmarker');
  const vignette = $('vignette'), weaponRow = $('weapon-row'), fragRow = $('frag-row');
  let bannerTimer = 0;
  let hitTimer = 0;
  let rosterState = '';

  const api = {
    setAmmo(mag, reserve, weaponName) {
      ammoMag.textContent = mag;
      ammoReserve.textContent = ` / ${reserve}`;
      ammoLabel.textContent = weaponName;
    },
    setWeapon(name) { weaponRow.textContent = name; },
    setFrags(count) { fragRow.textContent = 'FRAGS ' + (count > 0 ? '·'.repeat(count) : '—'); },
    setMoney(amount) { moneyValue.textContent = `$${amount}`; },
    setScore(cobalt, ember) {
      scoreCobalt.textContent = cobalt;
      scoreEmber.textContent = ember;
    },
    setTimer(seconds, warn) {
      const s = Math.max(0, Math.ceil(seconds));
      timerValue.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      timerValue.style.color = warn ? '#ff5533' : '';
    },
    setObjective(text, warn) {
      objective.textContent = text;
      objective.classList.toggle('warn', !!warn);
    },
    setRoster(cobaltAlive, cobaltTotal, emberAlive, emberTotal) {
      const key = `${cobaltAlive}/${cobaltTotal}/${emberAlive}/${emberTotal}`;
      if (key === rosterState) return;
      rosterState = key;
      let html = '';
      for (let i = 0; i < cobaltTotal; i += 1) html += `<span class="dot cobalt ${i < cobaltAlive ? 'on' : ''}"></span>`;
      html += '<span class="roster-gap"></span>';
      for (let i = 0; i < emberTotal; i += 1) html += `<span class="dot ember ${i < emberAlive ? 'on' : ''}"></span>`;
      roster.innerHTML = html;
    },
    setHealth(health) {
      healthFill.style.width = `${Math.max(0, health)}%`;
      healthValue.textContent = Math.max(0, Math.round(health));
    },
    setArmor(amount) {
      armorRow.classList.toggle('hidden', !(amount > 0));
      armorFill.style.width = `${Math.max(0, Math.min(100, amount))}%`;
    },
    setSpread(degrees) {
      crosshair.style.setProperty('--spread', `${0.4 + degrees * 0.09}em`);
    },
    hitMarker(strong, ms) {
      hitmarker.style.opacity = '1';
      hitmarker.style.transform = `translate(-50%, -50%) scale(${strong ? 1.5 : 1})`;
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => { hitmarker.style.opacity = '0'; }, ms || 90);
    },
    damageFlash(amount) {
      vignette.style.opacity = String(Math.min(0.75, 0.25 + amount / 60));
      setTimeout(() => { vignette.style.opacity = '0'; }, 180);
    },
    banner(main, sub, holdMs) {
      bannerTitle.textContent = main;
      bannerSub.textContent = sub || '';
      banner.classList.add('on');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => banner.classList.remove('on'), holdMs || 2400);
    },
    hideBanner() { clearTimeout(bannerTimer); banner.classList.remove('on'); },
    feedLine(text, strong) {
      const row = document.createElement('div');
      row.className = 'feed-row' + (strong ? ' strong' : '');
      row.textContent = text;
      feed.appendChild(row);
      while (feed.children.length > 5) feed.removeChild(feed.firstChild);
      setTimeout(() => row.remove(), 4200);
    },
    clearFeed() { feed.innerHTML = ''; },
    showOverlay(mode, detail) {
      const text = COPY[mode];
      title.textContent = text.title;
      copy.textContent = detail || text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() { overlay.hidden = true; },
    onPlay(handler) { play.addEventListener('click', handler); },
  };

  return api;
}
