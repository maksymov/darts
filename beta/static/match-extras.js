/* Match commentary and export statistics. No DOM, storage, or network access. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./game.js'));
  else root.DartsExtras = factory(root.DartsGame);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (G) {
  'use strict';
  const LINES = {
    win: { mood: 'proud', label: 'ГОРДИТСЯ', lines: ['{player}, мишень покорена. Скромность можешь выключить.', '{player}, вот это финиш! Остальным — тренировать удивлённое лицо.', '{player}, записываю в легенды. Автографы после игры, пожалуйста.'] },
    draw: { mood: 'amazed', label: 'ВИДИТ НИЧЬЮ', lines: ['{player}, делите славу честно. Мишень уже устала выбирать фаворита.', '{player}, вот это ничья! Корону придётся передавать по очереди.'] },
    maximum: { mood: 'amazed', label: 'ПОТЕРЯЛ ДАР РЕЧИ', lines: ['{player}, сто восемьдесят! Уши встали по стойке смирно.', '{player}, три дротика — три попадания. Мишень уже просит тайм-аут.'] },
    big: { mood: 'amazed', label: 'ВПЕЧАТЛЁН', lines: ['{player}, мишень, кажется, только что передумала спорить.', '{player}, вот это заход! Даже мои уши аплодируют.', '{player}, красиво. Подозрительно красиво. Проверю мишень на сговор.'] },
    hundred: { mood: 'happy', label: 'ОДОБРЯЕТ', lines: ['{player}, сотня есть. Главное — не рассказывай, что случайно.', '{player}, плечи расправил? Мишень уже заметила.', '{player}, одобряю. Но корону пока не выносил.'] },
    bust: { mood: 'oops', label: 'СЛЕГКА УДИВЛЁН', lines: ['{player}, разогнался красиво. Тормоза, вижу, остались дома.', '{player}, перебор! Щедрость хорошая, но табло её не принимает.', '{player}, мишень цела, счёт тоже. План был такой?'] },
    lead: { mood: 'happy', label: 'ЗАМЕТИЛ ИНТРИГУ', lines: ['{player}, вырвался вперёд! Корону держи крепче — тут завистливые взгляды.', '{player}, новый лидер! Соперникам можно начинать нервно улыбаться.', '{player}, смена лидера. Вот теперь стало шумно, даже без зрителей.'] },
    best: { mood: 'proud', label: 'ЗАПОМНИЛ', lines: ['{player}, лучший ход партии! Теперь делай вид, что так и планировал.', '{player}, личный рекорд обновлён. Соперники уже ищут оправдания.'] },
    close: { mood: 'focused', label: 'ЗАТАИЛ ДЫХАНИЕ', lines: ['{player}, финиш рядом. Я не дышу. Ну, почти.', '{player}, осталось чуть-чуть. Не дай мишени устроить камбэк.'] },
    miss: { mood: 'support', label: 'ВЕРИТ В ВАС', lines: ['{player}, это была разведка. Мишень пока ничего не заподозрила.', '{player}, ноль — круглая цель. Жаль, не та, что на стене.', '{player}, разминку засчитали. Теперь можно попадать.'] },
    low: { mood: 'support', label: 'ПОДБАДРИВАЕТ', lines: ['{player}, потихоньку тоже считается. Мишень не убежит — у неё крепление.', '{player}, скромный вклад принят. Соперники пока не празднуют.', '{player}, мишень на месте. Следующий заход — без экскурсий.'] },
    sector: { mood: 'happy', label: 'СЧИТАЕТ СЕКТОРА', lines: ['{player}, ещё сектор в коллекцию. Мишень уже нервничает.', '{player}, маршрут пройден ещё на шаг. Навигатору можно отдохнуть.', '{player}, сектор сдался без лишних разговоров. Учись, остальные.'] },
    bull: { mood: 'focused', label: 'СМОТРИТ В ЦЕНТР', lines: ['{player}, круг пройден. Теперь самое вкусное — серединка.', '{player}, осталось яблочко. Компот потом, сначала попадание.'] }
  };

  function analyze(game) {
    const rows = G.standings(game).map(p => ({ ...p, best: 0, points: 0, busts: 0, misses: 0, hits: 0 }));
    const remaining = Object.fromEntries(game.players.map(p => [p.id, game.total]));
    for (const turn of game.turns) {
      const row = rows.find(p => p.id === turn.playerId);
      if (!row) continue;
      if (game.mode === 'sectors') {
        if (turn.kind === 'hit') row.hits++;
      } else if (turn.kind === 'bust' || turn.score > remaining[row.id]) {
        row.busts++;
      } else {
        remaining[row.id] -= turn.score;
        row.points += turn.score;
        row.best = Math.max(row.best, turn.score);
        if (turn.score === 0) row.misses++;
      }
    }
    return rows;
  }

  function leader(game) {
    const rows = G.standings(game);
    if (rows.length < 2) return null;
    const best = game.mode === 'x01' ? Math.min(...rows.map(p => p.remaining)) : Math.max(...rows.map(p => p.progress));
    const leaders = rows.filter(p => (game.mode === 'x01' ? p.remaining : p.progress) === best);
    return leaders.length === 1 ? leaders[0].id : null;
  }

  function eventFor(game) {
    if (!game.turns.length) return null;
    if (G.winners(game).length > 1) return 'draw';
    if (G.winner(game)) return 'win';
    const last = game.turns[game.turns.length - 1];
    const row = G.standings(game).find(p => p.id === last.playerId);
    if (game.mode === 'sectors') {
      if (last.kind !== 'hit') return null;
      if (row.progress >= 20) return 'bull';
      return row.progress % 5 === 0 ? 'sector' : null;
    }
    if (row.last === 'Перебор') return 'bust';
    if (last.score === 180) return 'maximum';
    if (last.score >= 140) return 'big';
    if (last.score >= 100) return 'hundred';
    const before = { ...game, turns: game.turns.slice(0, -1) };
    if (game.turns.length > game.players.length && leader(game) === last.playerId && leader(before) !== last.playerId) return 'lead';
    const previousBest = analyze(before).find(p => p.id === last.playerId).best;
    if (last.score >= 60 && previousBest > 0 && last.score > previousBest) return 'best';
    if (last.score > 0 && row.remaining <= 60) return 'close';
    if (last.score === 0) return 'miss';
    if (last.score < 26) return 'low';
    return null;
  }

  function commentFor(game, previousText) {
    const event = eventFor(game);
    if (!event) return null;
    const entry = LINES[event];
    const id = event === 'win' ? G.winner(game).id : game.turns[game.turns.length - 1].playerId;
    const player = event === 'draw' ? G.winners(game).map(p => p.name).join(', ') : game.players.find(p => p.id === id).name;
    let i = game.turns.length % entry.lines.length;
    let text = entry.lines[i].replace('{player}', player);
    if (text === previousText) {
      i = (i + 1) % entry.lines.length;
      text = entry.lines[i].replace('{player}', player);
    }
    return { event, mood: entry.mood, label: entry.label, text, player };
  }

  function summarize(game) {
    const win = G.winner(game);
    if (!win) return null;
    const rows = analyze(game);
    const champion = rows.find(p => p.id === win.id);
    const winners = G.winners(game).map(p => rows.find(row => row.id === p.id));
    const best = Math.max(...rows.map(p => p.best));
    const bestPlayers = best > 0 ? rows.filter(p => p.best === best).map(p => p.name) : [];
    let award = { title: 'Мишень одобряет', reason: 'Дошёл до нуля. Забрал победу.', quote: 'Я бы похлопал, но у меня копыта.' };
    if (winners.length > 1) award = { title: 'На равных', reason: 'Несколько игроков закончили круг с нулём.', quote: 'Мишень попросила ничью. Я поддержал.' };
    else if (game.mode === 'sectors') award = { title: 'Коллекционер секторов', reason: 'Все 22 цели закрыты — от 1 до 50.', quote: 'Всё собрал. Даже яблочко не оставил.' };
    else if (champion.best === 180) award = { title: 'Повелитель двадцаток', reason: '180 за ход и победа в партии.', quote: 'Уши до сих пор стоят по стойке смирно.' };
    else if (champion.busts >= 2) award = { title: 'Упрямство — тоже стратегия', reason: 'Переборов: ' + champion.busts + '. Но победа всё равно ваша.', quote: 'Сначала разгон. Потом точность. План сработал.' };
    else if (champion.misses >= 2) award = { title: 'Долгая пристрелка', reason: 'Нулевых ходов: ' + champion.misses + '. Финал — победный.', quote: 'Я же говорил: это была разведка.' };
    else if (champion.best >= 100) award = { title: 'Сотня в кармане', reason: 'Лучший ход победителя — ' + champion.best + ' очков.', quote: 'Скромность можно выключить. Есть за что.' };
    const sorted = rows.slice().sort((a, b) => {
      const aWinner = winners.some(p => p.id === a.id), bWinner = winners.some(p => p.id === b.id);
      return aWinner !== bWinner ? (aWinner ? -1 : 1) : game.mode === 'x01' ? a.remaining - b.remaining : b.progress - a.progress;
    });
    return { mode: game.mode, total: game.total, createdAt: game.createdAt, winner: champion, winners, rows: sorted, best, bestPlayers, award };
  }
  return { analyze, eventFor, commentFor, summarize };
});
