// The match: short rounds won by eliminating the other side or by the objective, an
// economy between rounds, and a buy phase before every round. COBALT defends, EMBER
// attacks: the charge must be armed on the site platform and defused within 40 seconds.
// First team to five round wins takes the match.
import { SITE } from './world.js';

const ROUND_TIME = 95;
const BUY_TIME = 12;
const DETONATE_TIME = 40;
const WIN_TARGET = 5;

const REWARDS = {
  win: 2800,
  lossBase: 1900,
  lossStep: 500,
  lossCap: 3400,
  kill: 300,
  plant: 300,
};

export function createRounds(rng) {
  const state = {
    round: 0,
    phase: 'buy',          // buy | live | planted | end
    timer: BUY_TIME,
    planted: false,
    plantPos: null,
    detonation: 0,
    score: { cobalt: 0, ember: 0 },
    money: 800,
    lossStreak: 0,
    wins: { cobalt: [], ember: [] },
    roundWinner: null,
    roundReason: '',
    matchOver: false,
    endTimer: 0,
    carrierIndex: 0,
  };

  const hooks = {
    onRoundStart: null,
    onPhaseChange: null,
    onRoundEnd: null,
    onMatchEnd: null,
  };

  function startRound() {
    state.round += 1;
    state.phase = 'buy';
    state.timer = BUY_TIME;
    state.planted = false;
    state.plantPos = null;
    state.roundWinner = null;
    state.roundReason = '';
    state.carrierIndex = state.round % 5;
    if (hooks.onRoundStart) hooks.onRoundStart(state);
  }

  function endRound(winner, reason) {
    state.phase = 'end';
    state.roundWinner = winner;
    state.roundReason = reason;
    state.score[winner] += 1;
    state.wins[winner].push(reason);
    if (winner === 'cobalt') {
      state.money += REWARDS.win;
      state.lossStreak = 0;
    } else {
      state.money += Math.min(REWARDS.lossCap, REWARDS.lossBase + state.lossStreak * REWARDS.lossStep);
      state.lossStreak = Math.min(3, state.lossStreak + 1);
    }
    if (state.score[winner] >= WIN_TARGET) {
      state.matchOver = true;
      if (hooks.onMatchEnd) hooks.onMatchEnd(winner);
    }
    state.endTimer = 4;
    if (hooks.onRoundEnd) hooks.onRoundEnd(winner, reason);
  }

  function startLive() {
    state.phase = 'live';
    state.timer = ROUND_TIME;
    if (hooks.onPhaseChange) hooks.onPhaseChange('live');
  }

  function step(dt, context) {
    if (state.phase === 'end') {
      state.endTimer -= dt;
      if (state.endTimer <= 0 && !state.matchOver) startRound();
      return;
    }
    if (state.phase === 'buy') {
      state.timer -= dt;
      if (state.timer <= 0) startLive();
      return;
    }
    if (state.phase === 'live') {
      state.timer -= dt;
      // Objective: attackers armed the charge.
      if (context.planted) {
        state.phase = 'planted';
        state.plantPos = context.plantPos;
        state.detonation = DETONATE_TIME;
        if (hooks.onPhaseChange) hooks.onPhaseChange('planted');
      } else if (state.timer <= 0) {
        endRound('cobalt', 'Time expired — site held');
      }
      return;
    }
    if (state.phase === 'planted') {
      state.detonation -= dt;
      if (state.detonation <= 0) endRound('ember', 'Charge detonated');
    }
  }

  return {
    state,
    hooks,
    startRound,
    startLive,
    endRound,
    step,
    SITE,
    REWARDS,
    // Elimination checks, called by main after damage resolution.
    checkElimination(cobaltAlive, emberAlive) {
      if (state.phase !== 'live' && state.phase !== 'planted') return;
      if (emberAlive === 0) endRound('cobalt', 'Attackers eliminated');
      else if (cobaltAlive === 0) {
        if (state.phase === 'planted') {
          // Charge still armed: it detonates on schedule.
          state.phase = 'planted';
        } else {
          endRound('ember', 'Defenders eliminated');
        }
      }
    },
    playerMoney() { return state.money; },
    spend(amount) {
      if (state.money < amount) return false;
      state.money -= amount;
      return true;
    },
    plantBonus() { state.money += REWARDS.plant; },
    killReward() { state.money += REWARDS.kill; },
  };
}
