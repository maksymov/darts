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
      activeId: 'p0', turns: [], createdAt: Date.now()
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
  function winner(game) {
    return standings(game).find(p => game.mode === 'sectors' ? p.progress >= SECTORS.length : p.remaining === 0);
  }
  function record(game, score, kind) {
    if (winner(game)) throw new Error('Партия уже завершена.');
    if (!game.players.some(p => p.id === game.activeId)) throw new Error('Выберите игрока.');
    if (game.mode === 'x01' && (!Number.isInteger(score) || score < 0 || score > 180)) throw new Error('Введите целое число от 0 до 180.');
    game.turns.push({ playerId: game.activeId, score: score || 0, kind: kind || 'score' });
    const index = game.players.findIndex(p => p.id === game.activeId);
    if (game.mode !== 'sectors' || kind !== 'hit') game.activeId = game.players[(index + 1) % game.players.length].id;
    return game;
  }
  function undo(game) {
    const turn = game.turns.pop();
    if (turn) game.activeId = turn.playerId;
    return game;
  }
  function edit(game, index, score, kind) {
    if (!game.turns[index]) throw new Error('Ход не найден.');
    if (!Number.isInteger(score) || score < 0 || score > 180) throw new Error('Введите целое число от 0 до 180.');
    game.turns[index] = { ...game.turns[index], score, kind: kind || 'score' };
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
  return { SECTORS, AVATARS, create, standings, winner, record, undo, edit, migrate, valid };
});
