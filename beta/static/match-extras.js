/* Match commentary and export statistics. No DOM, storage, or network access. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./game.js'));
  else root.DartsExtras = factory(root.DartsGame);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (G) {
  'use strict';
  const LINES = {
    win: { mood: 'proud', label: 'ГОРДИТСЯ', lines: ['Мишень покорена. Скромность можно выключить.', 'Вот это финиш. Я бы похлопал, но у меня копыта.', 'Записываем в легенды домашнего клуба.'] },
    maximum: { mood: 'amazed', label: 'ПОТЕРЯЛ ДАР РЕЧИ', lines: ['Сто восемьдесят! Уши встали по стойке смирно.', 'Все три — в цель. Я официально впечатлён.'] },
    big: { mood: 'amazed', label: 'ВПЕЧАТЛЁН', lines: ['Мишень, держись. Человек вошёл во вкус.', 'Вот это заход! Даже мои уши аплодируют.', 'Красиво. Очень красиво. Пересчитывать не буду.'] },
    hundred: { mood: 'happy', label: 'ОДОБРЯЕТ', lines: ['Сотня есть. Теперь главное — сделать вид, что так и задумано.', 'С таким набором можно и плечи расправить.', 'Мишень одобряет. Я тоже.'] },
    bust: { mood: 'oops', label: 'СЛЕГКА УДИВЛЁН', lines: ['Красиво разогнались. Тормоза остались у мишени.', 'Перебор. Щедрость сегодня не засчитывается.', 'Чуть меньше энтузиазма — и будет идеально.'] },
    lead: { mood: 'happy', label: 'ЗАМЕТИЛ ИНТРИГУ', lines: ['У нас новый лидер. Корону передавайте аккуратно.', 'Вот это поворот. Стало ещё интереснее.', 'Смена лидера! Я за красивую борьбу.'] },
    best: { mood: 'proud', label: 'ЗАПОМНИЛ', lines: ['Ваш лучший ход в этой партии. Планка стала выше.', 'Личный рекорд этой игры! Делайте вид, что это разминка.'] },
    close: { mood: 'focused', label: 'ЗАТАИЛ ДЫХАНИЕ', lines: ['Финиш рядом. Я даже ушами не шевелю.', 'Осталось немного. Спокойствие, точность и красивый финал.'] },
    miss: { mood: 'support', label: 'ВЕРИТ В ВАС', lines: ['Это была разведка. Мишень пока ничего не заподозрила.', 'Ноль — тоже круглое число. Следующий будет лучше.', 'Разминку засчитали. Теперь можно попадать.'] },
    low: { mood: 'support', label: 'ПОДБАДРИВАЕТ', lines: ['Потихоньку тоже считается. Мы никуда не спешим.', 'Скромный вклад в большую победу.', 'Мишень на месте. Следующий заход — ваш.'] },
    sector: { mood: 'happy', label: 'СЧИТАЕТ СЕКТОРА', lines: ['Ещё кусочек мишени ваш. Собираем коллекцию.', 'Маршрут пройден ещё на шаг. Уверенно идём.', 'Сектор сдался без лишних разговоров.'] },
    bull: { mood: 'focused', label: 'СМОТРИТ В ЦЕНТР', lines: ['Круг пройден. Теперь самое вкусное — серединка.', 'Осталось яблочко. Компот потом.'] }
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
    let i = game.turns.length % entry.lines.length;
    if (entry.lines[i] === previousText) i = (i + 1) % entry.lines.length;
    const id = event === 'win' ? G.winner(game).id : game.turns[game.turns.length - 1].playerId;
    return { event, mood: entry.mood, label: entry.label, text: entry.lines[i], player: game.players.find(p => p.id === id).name };
  }

  function summarize(game) {
    const win = G.winner(game);
    if (!win) return null;
    const rows = analyze(game);
    const champion = rows.find(p => p.id === win.id);
    const best = Math.max(...rows.map(p => p.best));
    const bestPlayers = best > 0 ? rows.filter(p => p.best === best).map(p => p.name) : [];
    let award = { title: 'Мишень одобряет', reason: 'Дошёл до нуля. Забрал победу.', quote: 'Я бы похлопал, но у меня копыта.' };
    if (game.mode === 'sectors') award = { title: 'Коллекционер секторов', reason: 'Все 22 цели закрыты — от 1 до 50.', quote: 'Всё собрал. Даже яблочко не оставил.' };
    else if (champion.best === 180) award = { title: 'Повелитель двадцаток', reason: '180 за ход и победа в партии.', quote: 'Уши до сих пор стоят по стойке смирно.' };
    else if (champion.busts >= 2) award = { title: 'Упрямство — тоже стратегия', reason: 'Переборов: ' + champion.busts + '. Но победа всё равно ваша.', quote: 'Сначала разгон. Потом точность. План сработал.' };
    else if (champion.misses >= 2) award = { title: 'Долгая пристрелка', reason: 'Нулевых ходов: ' + champion.misses + '. Финал — победный.', quote: 'Я же говорил: это была разведка.' };
    else if (champion.best >= 100) award = { title: 'Сотня в кармане', reason: 'Лучший ход победителя — ' + champion.best + ' очков.', quote: 'Скромность можно выключить. Есть за что.' };
    const sorted = rows.slice().sort((a, b) => a.id === win.id ? -1 : b.id === win.id ? 1 : game.mode === 'x01' ? a.remaining - b.remaining : b.progress - a.progress);
    return { mode: game.mode, total: game.total, createdAt: game.createdAt, winner: champion, rows: sorted, best, bestPlayers, award };
  }
  return { analyze, eventFor, commentFor, summarize };
});
