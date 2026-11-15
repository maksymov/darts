/* Pure game state: shared by the interface and the Node regression checks. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DartsGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SECTORS = Array.from({ length: 20 }, (_, i) => i + 1).concat([25, 50]);
  const AVATARS = ['🎯', '⚡', '🦊', '🐻', '🚀', '🫎', '🐼', '🔥'];
  function create(mode, total, names) {
    return {
      version: 2, mode, total: Number(total),
      players: names.map((p, i) => ({ id: 'p' + i, name: p.name || 'Игрок ' + (i + 1), avatar: AVATARS.includes(p.avatar) ? p.avatar : AVATARS[i % AVATARS.length], start: 0 })),
      activeId: 'p0', turns: [], winnerId: null, finishTurnIndex: null, finishOrder: [], finishQueue: [], finishingRound: false, createdAt: Date.now()
    };
  }
  function standings(game) {
    const rows = game.players.map(p => ({ ...p, remaining: game.total, progress: p.start || 0, visits: 0, last: null }));
    for (const turn of game.turns) {
      const p = rows.find(row => row.id === turn.playerId);
      if (!p) continue;
      if (game.mode === 'x01' || turn.kind !== 'hit') p.visits++;
      if (game.mode === 'sectors') {
        if (turn.kind === 'hit') p.progress = Math.min(SECTORS.length, p.progress + 1);
        p.last = turn.kind === 'hit' ? 'Попадание' : 'Ход передан';
      } else {
        const bust = turn.kind === 'bust' || turn.score > p.remaining;
        if (!bust) p.remaining -= turn.score;
        p.last = bust ? 'Перебор' : turn.score;
      }
    }
    return rows;
  }
  function findWinner(game) {
    const rows = game.players.map(p => ({ id:p.id, remaining:game.total, progress:p.start || 0, visits:0 }));
    for (let i = 0; i < game.turns.length; i++) {
      const turn = game.turns[i], row = rows.find(p => p.id === turn.playerId);
      if (!row) continue;
      if (game.mode === 'sectors') {
        if (turn.kind === 'hit') {
          row.progress = Math.min(SECTORS.length, row.progress + 1);
          if (row.progress >= SECTORS.length) return { id:row.id, turnIndex:i, visits:row.visits };
        } else row.visits++;
      } else {
        row.visits++;
        if (turn.kind !== 'bust' && turn.score <= row.remaining) row.remaining -= turn.score;
        if (row.remaining === 0) return { id:row.id, turnIndex:i, visits:row.visits };
      }
    }
    return null;
  }
  function winner(game) {
    if (game.winnerId) return game.players.find(p => p.id === game.winnerId);
    const found = findWinner(game);
    return found && game.players.find(p => p.id === found.id);
  }
  function winners(game) {
    const first = winner(game);
    if (!first) return [];
    if (game.mode !== 'x01') return [first];
    return standings(game).filter(p => p.remaining === 0);
  }
  function pendingFinish(game) {
    return Array.isArray(game.finishQueue) ? game.finishQueue.slice() : [];
  }
  function finished(game) {
    return !!winner(game) && pendingFinish(game).length === 0;
  }
  function clearFinish(game) {
    game.winnerId = null;
    game.finishTurnIndex = null;
    game.finishOrder = [];
    game.finishQueue = [];
    game.finishingRound = false;
  }
  function reconcileFinish(game) {
    const found = findWinner(game);
    const previousWinner = game.winnerId, previousFinishIndex = game.finishTurnIndex;
    const previousQueue = pendingFinish(game);
    clearFinish(game);
    if (!found) return;
    game.winnerId = found.id;
    game.finishTurnIndex = found.turnIndex;
    if (game.mode !== 'x01') return;
    const rows = standings({ ...game, turns:game.turns.slice(0, found.turnIndex + 1) });
    const winnerVisits = rows.find(p => p.id === found.id).visits;
    const index = game.players.findIndex(p => p.id === found.id);
    for (let step = 1; step < game.players.length; step++) {
      const id = game.players[(index + step) % game.players.length].id;
      if (rows.find(p => p.id === id).visits < winnerVisits) game.finishOrder.push(id);
    }
    const playedAfterWin = game.turns.slice(found.turnIndex + 1).map(turn => turn.playerId);
    game.finishQueue = game.finishOrder.filter(id => {
      const playedIndex = playedAfterWin.indexOf(id);
      if (playedIndex < 0) return true;
      playedAfterWin.splice(playedIndex, 1);
      return false;
    });
    if (previousWinner === found.id && previousFinishIndex === found.turnIndex) {
      game.finishQueue = previousQueue.filter(id => game.finishQueue.includes(id))
        .concat(game.finishQueue.filter(id => !previousQueue.includes(id)));
    }
    if (game.finishQueue.length) {
      game.finishingRound = true;
      game.activeId = game.finishQueue[0];
    }
  }
  function skipPlayer(game) {
    if (game.mode !== 'x01') throw new Error('Переключение доступно только в X01.');
    const win = winner(game);
    if (win) {
      if (!game.finishingRound || !game.finishQueue.length) throw new Error('Сначала начните доигрывать круг.');
      if (game.activeId !== game.finishQueue[0]) throw new Error('Сейчас ходит другой игрок.');
      if (game.finishQueue.length < 2) throw new Error('Остался только один игрок для доигрывания круга.');
      game.finishQueue.push(game.finishQueue.shift());
      game.activeId = game.finishQueue[0];
    } else {
      if (game.players.length < 2) throw new Error('В партии только один игрок.');
      const index = game.players.findIndex(p => p.id === game.activeId);
      if (index < 0) throw new Error('Выберите игрока.');
      game.activeId = game.players[(index + 1) % game.players.length].id;
    }
    return game;
  }
  function record(game, score, kind) {
    const currentWinner = winner(game);
    const finishQueue = pendingFinish(game);
    const finishingRound = !!currentWinner && finishQueue.length > 0 && game.finishingRound;
    if (currentWinner && !finishingRound) throw new Error('Партия уже завершена.');
    if (finishingRound && game.activeId !== finishQueue[0]) throw new Error('Сейчас ходит другой игрок.');
    if (!game.players.some(p => p.id === game.activeId)) throw new Error('Выберите игрока.');
    if (game.mode === 'x01' && (!Number.isInteger(score) || score < 0 || score > 180)) throw new Error('Введите целое число от 0 до 180.');
    game.turns.push({ playerId: game.activeId, score: score || 0, kind: kind || 'score' });
    const index = game.players.findIndex(p => p.id === game.activeId);
    if (game.mode !== 'sectors' || kind !== 'hit') game.activeId = game.players[(index + 1) % game.players.length].id;
    if (finishingRound) {
      game.finishQueue.shift();
      if (game.finishQueue.length) game.activeId = game.finishQueue[0];
      return game;
    }
    const found = findWinner(game);
    if (found) {
      game.winnerId = found.id;
      game.finishTurnIndex = found.turnIndex;
      if (game.mode === 'x01') {
        const rows = standings(game), winnerVisits = rows.find(p => p.id === found.id).visits;
        for (let step = 1; step < game.players.length; step++) {
          const id = game.players[(index + step) % game.players.length].id;
          if (rows.find(p => p.id === id).visits < winnerVisits) game.finishOrder.push(id);
        }
        game.finishQueue = game.finishOrder.slice();
      }
    }
    return game;
  }
  function undo(game) {
    const index = game.turns.length - 1;
    const turn = game.turns.pop();
    if (turn) {
      game.activeId = turn.playerId;
      if (index === game.finishTurnIndex) clearFinish(game);
      else if (game.winnerId && index > game.finishTurnIndex && game.finishOrder.includes(turn.playerId)) {
        if (!game.finishQueue.includes(turn.playerId)) game.finishQueue.unshift(turn.playerId);
      }
    }
    return game;
  }
  function edit(game, index, score, kind) {
    if (!game.turns[index]) throw new Error('Ход не найден.');
    if (!Number.isInteger(score) || score < 0 || score > 180) throw new Error('Введите целое число от 0 до 180.');
    game.turns[index] = { ...game.turns[index], score, kind: kind || 'score' };
    reconcileFinish(game);
    return game;
  }
  function migrate(storage) {
    try {
      const mode = storage.getItem('curr_game');
      const players = JSON.parse(storage.getItem('players') || 'null');
      if (!['501', 'sectors'].includes(mode) || !Array.isArray(players) || !players.length) return null;
      const total = Number(storage.getItem('total_score')) || 501;
      const game = create(mode === '501' ? 'x01' : 'sectors', total, players);
      if (mode === 'sectors') {
        game.players.forEach((p, i) => { p.start = Math.max(0, SECTORS.indexOf(players[i].score)); });
      } else {
        const circles = JSON.parse(storage.getItem('circles') || '[]');
        if (!Array.isArray(circles)) return null;
        let lastRow = circles.length - 1;
        while (lastRow >= 0 && (!Array.isArray(circles[lastRow]) || circles[lastRow].every(v => !Number(v)))) lastRow--;
        for (let r = 0; r <= lastRow; r++) {
          if (!Array.isArray(circles[r])) continue;
          let lastPlayer = game.players.length - 1;
          if (r === lastRow && lastRow === circles.length - 1) {
            while (lastPlayer >= 0 && !Number(circles[r][lastPlayer])) lastPlayer--;
          }
          for (let p = 0; p <= lastPlayer; p++) {
            const score = Number(circles[r][p]) || 0;
            game.turns.push({ playerId: game.players[p].id, score: Math.max(0, score), kind: 'score' });
            game.activeId = game.players[(p + 1) % game.players.length].id;
          }
        }
      }
      return game;
    } catch (_) { return null; }
  }
  function valid(game) {
    return game && game.version === 2 && ['x01', 'sectors'].includes(game.mode) && Number.isInteger(game.total) && game.total > 0 &&
      Array.isArray(game.players) && game.players.length > 0 && game.players.every(p => p && typeof p.id === 'string' && typeof p.name === 'string') &&
      game.players.some(p => p.id === game.activeId) && Array.isArray(game.turns) && game.turns.every(t => t && Number.isFinite(t.score) && t.score >= 0 && game.players.some(p => p.id === t.playerId));
  }
  return { SECTORS, AVATARS, create, standings, winner, winners, pendingFinish, finished, skipPlayer, record, undo, edit, reconcileFinish, migrate, valid };
});
