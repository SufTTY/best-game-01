// The DOM HUD: crosshair with spread bloom, hit marker, health, armour, ammo, money, the
// round score, round timer, objective status, roster dots, kill feed, banners and the one
// overlay panel. It never touches the simulation; main.js pushes numbers in and reads the
// play callback out.
const COPY = {
  start: {
    title: 'BREACH LINE',
    copy: 'Hold MERIDIAN STATION. EMBER pushes the demo charge every round — stop the arm, or defuse it before it blows. First to five rounds.',
    action: 'Click to play',
  },
  paused: {
    title: 'BREACH LINE',
    copy: 'Paused. Click to resume.',
    action: 'Click to resume',
  },
  dead: {
    title: 'DOWN',
    copy: 'You went down this round. Your squad fights on — the next round buys you back in.',
    action: 'Wait for the round',
  },
  match: {
    title: 'MATCH OVER',
    copy: 'The score is settled.',
    action: 'Play again',
  },
};

export function createHud() {
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const copy = document.getElementById('overlay-copy');
  const play = document.getElementById('play');
  const ammo = document.getElementById('ammo');
  const ammoMag = document.getElementById('ammo-mag');
  const ammoReserve = document.getElementById('ammo-reserve');
  const ammoLabel = document.getElementById('ammo-label');
  const moneyValue = document.getElementById('money-value');
  const scoreCobalt = document.getElementById('score-cobalt');
  const scoreEmber = document.getElementById('score-ember');
  const timerValue = document.getElementById('timer-value');
  const objective = document.getElementById('objective');
  const roster = document.getElementById('roster');
  const armorFill = document.getElementById('armor-fill');
  const armorRow = document.getElementById('armor');
  const healthFill = document.getElementById('health-fill');
  const healthValue = document.getElementById('health-value');
  const healthBar = document.getElementById('health');
  const banner = document.getElementById('banner');
  const bannerTitle = document.getElementById('banner-title');
  const bannerSub = document.getElementById('banner-sub');
  const feed = document.getElementById('feed');
  const crosshair = document.getElementById('crosshair');
  const vignette = document.getElementById('vignette');
  const hitmarker = document.getElementById('hitmarker');
  const weaponRow = document.getElementById('weapon-row');
  const fragRow = document.getElementById('frag-row');
  let hitTimer = 0;
  let bannerTimer = 0;
  let lastMag = -1;
  let lastReserve = -1;
  let lastHealth = -1;
  let lastArmor = -1;
  let lastMoney = -1;
  let lastTimer = -1;
  let lastScore = '';

  function feedLine(text, accent) {
    const line = document.createElement('div');
    line.className = 'feed-line' + (accent ? ' accent' : '');
    line.textContent = text;
    feed.prepend(line);
    while (feed.children.length > 4) feed.lastChild.remove();
    setTimeout(() => { line.classList.add('fade'); }, 2600);
    setTimeout(() => { line.remove(); }, 3200);
  }

  function setRoster(cobaltAlive, cobaltTotal, emberAlive, emberTotal) {
    let html = '';
    for (let index = 0; index < cobaltTotal; index += 1) {
      html += `<span class="dot cobalt${index < cobaltAlive ? ' on' : ''}"></span>`;
    }
    html += '<span class="roster-gap"></span>';
    for (let index = 0; index < emberTotal; index += 1) {
      html += `<span class="dot ember${index < emberAlive ? ' on' : ''}"></span>`;
    }
    roster.innerHTML = html;
  }

  return {
    feedLine,
    clearFeed() {
      feed.innerHTML = '';
    },
    setRoster,
    setAmmo(mag, reserve, name) {
      if (mag === lastMag && reserve === lastReserve) return;
      lastMag = mag;
      lastReserve = reserve;
      ammoMag.textContent = String(mag);
      ammoReserve.textContent = `/ ${reserve}`;
      ammoLabel.textContent = name;
      ammo.classList.toggle('empty', mag === 0);
    },
    setMoney(value) {
      if (value === lastMoney) return;
      lastMoney = value;
      moneyValue.textContent = `$${value}`;
    },
    setScore(cobalt, ember) {
      const text = `${cobalt} : ${ember}`;
      if (text === lastScore) return;
      lastScore = text;
      scoreCobalt.textContent = String(cobalt);
      scoreEmber.textContent = String(ember);
    },
    setTimer(seconds) {
      const rounded = Math.max(0, Math.ceil(seconds));
      if (rounded === lastTimer) return;
      lastTimer = rounded;
      timerValue.textContent = `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
    },
    setObjective(text, warn = false) {
      objective.textContent = text;
      objective.classList.toggle('warn', warn);
    },
    setWeaponRow(text) {
      weaponRow.textContent = text;
    },
    setFrags(count) {
      fragRow.textContent = `FRAGS ${'•'.repeat(count)}${'·'.repeat(Math.max(0, 2 - count))}`;
    },
    setArmor(value) {
      const rounded = Math.round(value);
      if (rounded === lastArmor) return;
      lastArmor = rounded;
      armorRow.classList.toggle('hidden', rounded <= 0);
      armorFill.style.width = `${Math.max(0, rounded)}%`;
    },
    setHealth(value) {
      const rounded = Math.round(value);
      if (rounded === lastHealth) return;
      lastHealth = rounded;
      healthFill.style.width = `${Math.max(0, rounded)}%`;
      healthValue.textContent = String(rounded);
      healthBar.classList.toggle('low', rounded <= 30);
      vignette.classList.toggle('hurt', rounded <= 30);
    },
    flashHurt() {
      vignette.classList.remove('hit');
      void vignette.offsetWidth;
      vignette.classList.add('hit');
      setTimeout(() => vignette.classList.remove('hit'), 220);
    },
    setSpread(scale) {
      crosshair.style.setProperty('--spread', `${scale.toFixed(2)}em`);
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.3)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        hitmarker.classList.remove('on');
        hitmarker.style.transform = '';
      }, holdMs);
    },
    bannerShow(main, sub, holdMs = 2200) {
      bannerTitle.textContent = main;
      bannerSub.textContent = sub;
      banner.classList.add('on');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => banner.classList.remove('on'), holdMs);
    },
    hideBanner() {
      clearTimeout(bannerTimer);
      banner.classList.remove('on');
    },
    showOverlay(mode, detail = '') {
      const text = COPY[mode];
      title.textContent = text.title;
      copy.textContent = detail || text.copy;
      play.textContent = text.action;
      overlay.hidden = false;
      play.focus();
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      play.addEventListener('click', handler);
    },
  };
}
