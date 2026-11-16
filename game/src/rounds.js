// The round referee. Phases: buy -> live -> planted -> over. It owns the clock, the score,
// the economy ledger and the demo charge; modules report into it through callbacks
// (registerKill, armed, defused) and read from its state. Win rules: elimination, clock
// expiry (defenders), detonation (attackers), defuse (defenders), or first to TIMING.roundsToWin.

import { TIMING, ECONOMY, ROSTER, SITE } from './config.js';
import { clamp } from './util.js';

export function createRounds(rng, hooks) {
  const state = {
    round: 0,
    phase: 'buy',           // buy | live | planted | over
    timer: TIMING.buyPhase,
    score: { cobalt: 0, ember: 0 },
    money: { cobalt: ECONOMY.start, ember: ECONOMY.start },
    lossStreak: { cobalt: 0, ember: 0 },
    planted: false,
    planter: null,
    defuseProgress: 0,
    armProgress: 0,
    winner: null,           // 'cobalt' | 'ember' after match over
    route: null,
  };

  function startRound() {
    state.round += 1;
    state.phase = 'buy';
    state.timer = TIMING.buyPhase;
    state.planted = false;
    state.planter = null;
    state.defuseProgress = 0;
    state.armProgress = 0;
    state.route = Math.floor(rng() * 3);
    if (state.round > 1) {
      // Between rounds: match purse stays, round purse resets to the last settled buy money.
      state.money.cobalt = clamp(state.money.cobalt, 800, 12000);
      state.money.ember = clamp(state.money.ember, 800, 12000);
    }
    if (hooks.onRoundStart) hooks.onRoundStart(state);
  }

  function startLive() {
    state.phase = 'live';
    state.timer = TIMING.livePhase;
    if (hooks.onPhaseChange) hooks.onPhaseChange('live');
  }

  function goPlanted(planter) {
    state.phase = 'planted';
    state.planted = true;
    state.planter = planter;
    state.timer = TIMING.detonation;
    state.armProgress = 0;
    if (hooks.onPhaseChange) hooks.onPhaseChange('planted');
    if (hooks.onArm) hooks.onArm();
  }

  function spend(team, amount) {
    if (state.money[team] < amount) return false;
    state.money[team] -= amount;
    return true;
  }

  function earn(team, amount) {
    state.money[team] = clamp(state.money[team] + amount, 0, 12000);
  }

  function settleRound(winner, reason) {
    const loser = winner === 'cobalt' ? 'ember' : 'cobalt';
    state.score[winner] += 1;
    state.lossStreak[winner] = 0;
    state.lossStreak[loser] = Math.min(state.lossStreak[loser] + 1, 4);
    const winPay = ECONOMY.winRound;
    const losePay = Math.min(ECONOMY.loseRound + ECONOMY.lossStreak * state.lossStreak[loser], ECONOMY.lossStreakCap);
    earn(winner, winPay);
    earn(loser, losePay);
    state.phase = 'over';
    state.timer = 0;
    state.lastResult = { winner, reason };
    if (hooks.onRoundEnd) hooks.onRoundEnd(winner, reason);
    if (state.score[winner] >= TIMING.roundsToWin || state.round >= TIMING.maxRounds) {
      state.winner = state.score.cobalt === state.score.ember ? 'cobalt' : (state.score.cobalt > state.score.ember ? 'cobalt' : 'ember');
      if (hooks.onMatchEnd) hooks.onMatchEnd(state.winner, state.score);
    }
    return state.lastResult;
  }

  // One fixed step of the referee. Deaths are reported by the combat code; this only moves
  // the clock and the charge.
  function step(dt, alive) {
    if (state.phase === 'over' || state.phase === 'buy') {
      if (state.phase === 'buy') {
        state.timer -= dt;
        if (state.timer <= 0) startLive();
      }
      return;
    }
    state.timer -= dt;
    if (state.phase === 'live') {
      const attackersLeft = alive('ember');
      const defendersLeft = alive('cobalt');
      if (attackersLeft === 0) return settleRound('cobalt', 'Attackers eliminated');
      if (defendersLeft === 0) return settleRound('ember', 'Defenders eliminated');
      if (state.timer <= 0) return settleRound('cobalt', 'Time expired — site held');
      return;
    }
    if (state.phase === 'planted') {
      if (state.timer <= 0) {
        if (hooks.onDetonation) hooks.onDetonation();
        return settleRound('ember', 'The charge detonated');
      }
      return;
    }
  }

  return {
    state,
    startRound,
    startLive,
    goPlanted,
    spend,
    earn,
    settleRound,
    step,
    playerMoney: () => state.money.cobalt,
    ROSTER,
    SITE,
  };
}
