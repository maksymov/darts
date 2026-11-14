/* Darts UI. No network or account is required to play. */
(function () {
  'use strict';
  const G = window.DartsGame;
  const E = window.DartsExtras;
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const storage = {
    getItem(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    setItem(key, value) { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } }
  };
  let game = null;
  try { const saved = JSON.parse(storage.getItem('darts.v2')); if (G.valid(saved)) game = saved; } catch (_) {}
  if (!game) game = G.migrate(storage);
  let view = 'home', buffer = '', historyExpanded = false;
  let theme = storage.getItem('theme') || 'dark';
  let effects = storage.getItem('darts.effects') !== 'false';
  let commentator = storage.getItem('darts.commentator') === null ? effects : storage.getItem('darts.commentator') !== 'false';
  let comment = idleComment('', game ? game.players.find(p=>p.id===game.activeId).name : ''), lastCommentAt = 0, cardRequest = 0, cardExport = null;
  let draft = { mode: 'x01', total: 501, players: game ? game.players.map(p => ({ name:p.name, avatar:p.avatar })) : [{name:'Игрок 1',avatar:'🎯'},{name:'Игрок 2',avatar:'⚡'}] };
  let modalType = '', modalData = {}, returnFocus = '', toastTimer;
  const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
  function persist() {
    if (game && !storage.setItem('darts.v2', JSON.stringify(game))) {
      toast('Память браузера недоступна. Не закрывайте вкладку до конца партии.');
      return false;
    }
    return true;
  }
  function applyTheme() {
    document.documentElement.dataset.theme = theme === 'auto' ? (themeMedia.matches ? 'dark' : 'light') : theme;
    document.documentElement.classList.add('tv');
    document.documentElement.classList.toggle('game-active', view === 'game' && !!game && !G.finished(game));
    document.documentElement.classList.toggle('tv-results', view === 'game' && !!game && G.finished(game));
    document.documentElement.classList.toggle('nine-players-game', view === 'game' && !!game && game.players.length === 9);
    document.querySelector('meta[name="theme-color"]').content = document.documentElement.dataset.theme === 'dark' ? '#212529' : '#f8f9fa';
  }
  if (themeMedia.addEventListener) themeMedia.addEventListener('change', applyTheme);
  function token(el) { return el && (el.id || [el.dataset.action,el.dataset.player,el.dataset.value,el.dataset.index].join('|')); }
  function controls(root) { return Array.from((root || document).querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')).filter(el => el.getClientRects().length && !el.closest('[hidden]') && !el.classList.contains('skip-link')); }
  function focusTo(key, scroll) {
    const root = $('modal').hidden ? document : $('modal');
    const target = controls(root).find(el => token(el) === key) || controls(root)[0];
    if (target) {
      target.focus({preventScroll:true});
      if (scroll !== false) target.scrollIntoView({block:'nearest',inline:'nearest'});
    }
  }
  function toast(message) {
    $('toast').textContent = message; $('toast').classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').classList.remove('visible'); $('toast').textContent=''; }, 4200);
  }
  function announce(message) { $('announcement').textContent = message; }
  function modeName(g) { return g.mode === 'sectors' ? 'По секторам' : String(g.total) + ' · X01'; }
  function render(focus, scrollFocus) {
    $('main').innerHTML = view === 'home' ? homeHTML() : gameHTML();
    applyTheme();
    fitPlayers();
    if (focus) focusTo(focus, scrollFocus);
  }
  function fitPlayers() {
    const grid = document.querySelector('.players-grid');
    if (!grid || !game || !grid.children.length) return;
    const main = $('main');
    const savedMainScroll = main.scrollTop, savedWindowScroll = window.scrollY;
    function restoreScroll() {
      main.scrollTop = savedMainScroll;
      if (window.scrollY !== savedWindowScroll) window.scrollTo(window.scrollX, savedWindowScroll);
    }
    grid.style.removeProperty('--player-columns');
    grid.style.removeProperty('--player-scale');
    grid.style.removeProperty('--player-height');
    const count = grid.children.length;
    grid.classList.remove('adaptive-players');
    grid.classList.add('fill-players');
    const scrollOffset = window.scrollY + main.scrollTop;
    const available = Math.min(window.innerHeight, main.getBoundingClientRect().bottom + window.scrollY) - 8;
    const height = Math.max(0, available - grid.getBoundingClientRect().top - scrollOffset);
    if (count <= 4 && grid.getBoundingClientRect().bottom + scrollOffset <= available) {
      grid.style.setProperty('--player-height', `${height}px`);
      restoreScroll();
      return;
    }
    grid.classList.add('adaptive-players');
    const desired = count === 9 ? 3 : Math.ceil(Math.sqrt(count * 1.6));
    const maxColumns = Math.min(count, 15, Math.max(1, Math.floor(grid.clientWidth / 60)));
    const center = Math.min(desired, maxColumns);
    const columnsToTry = Array.from(new Set([center, center - 1, center + 1, center - 2, center + 2, maxColumns, maxColumns - 1]))
      .filter(columns => columns >= 1 && columns <= maxColumns);
    const scales = count === 9
      ? [3, 2.8, 2.6, 2.4, 2.2, 2, 1.8, 1.6, 1.4, 1.2, 1, .9, .8, .7, .6, .5, .4, .3]
      : [1, .9, .8, .7, .6, .5, .4, .3];
    let best = null, preferred = null;
    for (const columns of columnsToTry) {
      grid.style.setProperty('--player-columns', columns);
      const measurements = [];
      function measure(index) {
        if (measurements[index]) return measurements[index];
        const scale = scales[index];
        grid.style.setProperty('--player-scale', `${16 * scale}px`);
        const gridRect = grid.getBoundingClientRect();
        const bottom = gridRect.bottom + window.scrollY + main.scrollTop;
        const cardsFit = bottom <= available;
        const score = (cardsFit ? 5000 : 0) + scale * 1000 -
          Math.max(0, bottom - available) * 20 -
          Math.abs(columns - desired) * 35 - (count % columns ? 10 : 0);
        return measurements[index] = {columns, scale, score, cardsFit};
      }
      function largestFit(property) {
        if (!measure(scales.length - 1)[property]) return null;
        let low = 0, high = scales.length - 1;
        while (low < high) {
          const middle = Math.floor((low + high) / 2);
          if (measure(middle)[property]) high = middle;
          else low = middle + 1;
        }
        return measure(low);
      }
      const candidate = largestFit('cardsFit') || measure(scales.length - 1);
      if (!best || candidate.score > best.score) best = candidate;
      if (count === 9 && columns === 3) preferred = candidate;
    }
    if (preferred && preferred.cardsFit) best = preferred;
    grid.style.setProperty('--player-columns', best.columns);
    grid.style.setProperty('--player-scale', `${16 * best.scale}px`);
    if (best.cardsFit) grid.style.setProperty('--player-height', `${height}px`);
    restoreScroll();
  }
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitPlayers, 100);
  });
  function homeHTML() {
    const resume = game ? `<div class="resume-banner"><span class="avatar" aria-hidden="true">${G.winner(game) ? '🏆' : '↗'}</span><div><strong>${G.winner(game) ? 'Последняя партия' : 'Ваша партия ждёт'}</strong><p>${esc(modeName(game))} · ${game.players.length} ${plural(game.players.length,'игрок','игрока','игроков')} · ${game.turns.length} ${game.mode==='sectors'?plural(game.turns.length,'событие','события','событий'):plural(game.turns.length,'ход','хода','ходов')}</p></div><button id="resume" class="primary" data-action="resume">${G.winner(game) ? 'Посмотреть итог' : 'Продолжить игру'} →</button></div>` : '';
    const modes = [{mode:'x01',total:301,title:'Быстрая партия',sub:'Разминка или первый матч',symbol:'301'},{mode:'x01',total:501,title:'Классика',sub:'Большая игра до нуля',symbol:'501'},{mode:'sectors',total:501,title:'По секторам',sub:'Путь от 1 до яблочка',symbol:'◎'}];
    return `${resume}<div class="intro"><div><div class="eyebrow"><span class="live-dot"></span> ВЕЧЕР НАЧИНАЕТСЯ С БРОСКА</div><h1>Соберите своих.<br><span>Попадите в момент.</span></h1></div><p>Вы бросаете — мы считаем.<br>Выберите игру и позовите соперников.</p></div><div class="setup-grid"><section><div class="step-label"><span class="step-number">01</span> Во что играем?</div><div class="mode-grid">${modes.map((m,i) => { const selected = draft.mode === m.mode && (m.mode === 'sectors' || draft.total === m.total); return `<button id="mode-${i}" class="mode-card ${selected?'selected':''}" data-action="mode" data-value="${m.mode}" data-total="${m.total}" aria-pressed="${selected}"><span class="mode-symbol">${m.symbol}</span><span><strong>${m.title}</strong><small>${m.sub}</small></span></button>`; }).join('')}</div><button class="custom-mode ${draft.mode==='x01' && ![301,501].includes(draft.total)?'selected':''}" data-action="custom-total"><span>Свой стартовый счёт${draft.mode==='x01' && ![301,501].includes(draft.total)?': '+draft.total:''}</span><span>↗</span></button><p class="mode-description">${draft.mode==='sectors'?'По очереди закройте секторы 1–20, затем 25 и 50. После попадания переходите к следующей цели. После бросков передайте ход сопернику.':'Набирайте очки за три броска и дойдите ровно до нуля. Если набрали больше остатка — ход не засчитывается.'}</p></section><section><div class="step-label"><span class="step-number">02</span> Кто у мишени?</div><div class="party-panel"><div class="roster">${draft.players.map((p,i)=>`<div class="roster-row"><button class="roster-player" data-action="edit-draft" data-player="${i}" aria-label="Изменить имя и аватар: ${esc(p.name)}"><span class="avatar" aria-hidden="true">${p.avatar}</span><span class="name">${esc(p.name)}</span><span class="pencil" aria-hidden="true">✎</span></button><button class="icon-button" data-action="remove-draft" data-player="${i}" aria-label="Убрать ${esc(p.name)}" ${draft.players.length===1?'disabled':''}>×</button></div>`).join('')}</div><button class="add-player" data-action="add-draft">＋ Добавить игрока</button><div class="setup-start"><p>Без регистрации.<br>Партия сохранится здесь.</p><button id="start-game" class="primary start-button" data-action="start">Начать игру ↗</button></div></div></section></div>`;
  }
  function gameHTML() {
    const rows = G.standings(game), win = G.winner(game);
    const complete = G.finished(game), finishingRound = !!win && !complete && game.finishingRound;
    const pendingFinish = G.pendingFinish(game);
    const active = rows.find(p=>p.id===game.activeId);
    const best = game.mode==='x01' ? Math.min(...rows.map(p=>p.remaining)) : Math.max(...rows.map(p=>p.progress));
    const leaders = rows.filter(p=>(game.mode==='x01'?p.remaining:p.progress)===best);
    const round = active ? active.visits+1 : 1;
    const gridClass = rows.length === 9 ? 'nine-players' : rows.length === 3 ? 'three-players' : '';
    const cards = rows.map(p => {
      const isActive = !complete && (!win || finishingRound) && p.id === game.activeId, leader = leaders.length === 1 && leaders[0].id === p.id && rows.length > 1;
      const remaining = game.mode === 'x01' ? p.remaining : (G.SECTORS[p.progress] || '✓');
      const gap = game.mode === 'x01' ? p.remaining - best : best - p.progress;
      const turnLabel = isActive ? '● Ваш ход' : win && win.id === p.id ? 'Победитель' : game.mode === 'sectors' ? 'Следующая цель' : '';
      return `<article class="player-card ${isActive?'active':''}" aria-label="${esc(p.name)}, ${game.mode==='x01'?'осталось '+remaining:'цель '+remaining}${isActive?', сейчас ходит':''}"><div class="player-top"><span class="avatar" aria-hidden="true">${p.avatar}</span><div class="player-title"><h2 class="${leader?'leader-name':''}">${esc(p.name)} ${leader?'<span aria-label="лидер">♛</span>':''}</h2></div><button class="icon-button" data-action="player-menu" data-player="${p.id}" aria-label="Настройки игрока ${esc(p.name)}">⋯</button></div>${turnLabel?`<div class="turn-label">${turnLabel}</div>`:''}<div class="remaining">${remaining}</div>${game.mode==='sectors'?`<div class="progress-bar" aria-label="Пройдено ${p.progress} из 22"><span style="width:${p.progress/22*100}%"></span></div>`:''}<div class="player-bottom"><span>Последний: <strong>${p.last===null?'—':esc(p.last)}</strong></span><span class="leader-gap ${gap?'has-gap':''}">${gap?`${game.mode==='x01'?'+':''}${gap} отстал`:leader?'Лидер':'На равных'}</span></div></article>`;
    }).join('');
    const controller = win && !finishingRound
      ? '<aside class="controller"><div class="eyebrow">ДО НОВОЙ ВСТРЕЧИ У МИШЕНИ</div><h2>Отличная партия.</h2><p class="mode-description">Результаты сохранены. Можно сыграть ещё раз с тем же составом или выбрать новый режим.</p><button class="submit-score" data-action="home">Выбрать игру →</button></aside>'
      : game.mode === 'x01' ? controllerHTML(active) : sectorControllerHTML(active);
    const winBanner = !win ? '' : `<div class="win-banner"><div><h2>🏆 ${esc(win.name)} — победа!</h2><p>${complete?'Мишень покорена. Хорошая игра.':finishingRound?`Доигрываем круг: ходит ${esc(active.name)}.`:`До конца круга осталось: ${pendingFinish.map(id=>esc(game.players.find(p=>p.id===id).name)).join(', ')}.`}</p></div><div class="win-controls">${complete?`<button id="match-card-open" class="primary" data-action="match-card">Карточка матча ↗</button><button id="rematch" data-action="rematch">Ещё партию</button><button data-action="undo">Отменить ход</button>`:finishingRound?'':`<button class="primary" data-action="continue-round">Доиграть круг · ${pendingFinish.length}</button>`}</div></div>`;
    return `<div class="tv-game-toolbar"><h1>${esc(modeName(game))}</h1><div class="tv-game-tools"><button data-action="home">← Назад</button><button data-action="restart">↶ Заново</button><button data-action="shuffle-players">Перемешать</button><button class="primary" data-action="add-match-player">＋ Игрок</button></div></div><div class="match-top"><div><div class="eyebrow"><span class="live-dot"></span> ${complete?'ПАРТИЯ ЗАВЕРШЕНА':'ИГРА ИДЁТ'}</div><div class="match-meta"><h1>${esc(modeName(game))}</h1><span class="pill">${complete?'Финиш':'Круг '+round}</span></div></div><div class="match-tools"><button class="quiet-button" data-action="home">← <span class="new-game-label">Новая игра</span><span class="mobile-menu-label">Меню</span></button><button class="icon-button" data-action="match-menu" aria-label="Меню партии">⋯</button></div></div>${winBanner}<div class="game-layout ${rows.length>4?'many-players-layout':''}"><div class="scoreboard"><div class="players-grid ${rows.length>4?'many-players':''} ${gridClass}">${cards}</div></div><div class="game-sidebar">${controller}${win?commentatorHTML():''}</div><section class="history ${rows.length>4?'many-players-history':''}"><div class="section-head"><h2>История партии</h2><span>Нажмите на ход, чтобы исправить</span></div>${historyHTML()}</section></div>`;
  }
  function plural(n,a,b,c) { return n%10===1&&n%100!==11?a:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?b:c; }
  function keypadHTML(inDialog) { return `<div class="keypad" aria-label="Цифровая панель">${['1','2','3','4','5','6','7','8','9','clear','0','delete'].map(v=>`<button ${v==='5'?'id="'+(inDialog?'dialog-five':'key-five')+'"':''} data-action="digit" data-value="${v}" ${v==='clear'||v==='delete'?'class="small-key"':''} aria-label="${v==='clear'?'Очистить ввод':v==='delete'?'Удалить последнюю цифру':v}">${v==='clear'?'Сброс':v==='delete'?'⌫':v}</button>`).join('')}</div>`; }
  function controllerHTML(active) {
    return `<aside class="controller"><div class="controller-heading"><strong>Ход: ${esc(active.name)}</strong><span>3 дротика</span></div><label class="score-display"><span>Очки<br>за ход</span><input id="score-input" type="text" inputmode="none" pattern="[0-9]*" maxlength="3" autocomplete="off" aria-label="Очки за ход, от 0 до 180" placeholder="—" value="${buffer}" readonly></label>${keypadHTML()}<button id="submit-score" class="primary submit-score" data-action="submit">Записать ход →</button><div class="visit-actions"><button data-action="miss">Промах · 0</button><button data-action="bust">Перебор</button></div><button class="undo-button" data-action="undo" ${!game.turns.length?'disabled':''}>↶ Отменить последний ход</button>${commentatorHTML()}<div class="controller-foot">Цифры на клавиатуре тоже работают · Enter ↵</div></aside>`;
  }
  function sectorControllerHTML(active) {
    return `<aside class="controller sector-controller"><div class="controller-heading"><strong>Ход: ${esc(active.name)}</strong><span>По секторам</span></div><div class="dartboard">${dartboardSVG(G.SECTORS[active.progress])}</div><div class="sector-side"><p class="sector-target">Ваша цель <strong>${G.SECTORS[active.progress]===50?'Яблочко · 50':G.SECTORS[active.progress]===25?'Внешний центр · 25':'Сектор '+G.SECTORS[active.progress]}</strong></p><div class="sector-buttons"><button id="sector-hit" class="primary" data-action="hit">✓ Попал! Следующий сектор</button><button data-action="sector-miss">Передать ход →</button></div><button class="undo-button" data-action="undo" ${!game.turns.length?'disabled':''}>↶ Отменить последний ход</button></div>${commentatorHTML()}</aside>`;
  }
  function dartboardSVG(target) {
    const order=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
    const point=(r,a)=>[150+r*Math.cos(a*Math.PI/180),150+r*Math.sin(a*Math.PI/180)];
    const ring=(inner,outer,a,b)=>{const A=point(outer,a),B=point(outer,b),C=point(inner,b),D=point(inner,a);return `M${A} A${outer},${outer} 0 0 1 ${B} L${C} A${inner},${inner} 0 0 0 ${D} Z`;};
    return `<svg viewBox="0 0 300 300" role="img" aria-label="Мишень, подсвечена цель ${target}"><circle cx="150" cy="150" r="148" fill="#212529" stroke="#495057"/>${order.map((n,i)=>{const a=-99+i*18,b=a+18,selected=n===target,pos=point(134,a+9);return `<path d="${ring(16,119,a,b)}" fill="${selected?'#ffc107':i%2?'#e9ecef':'#343a40'}" stroke="#212529" stroke-width="1.2"/><path d="${ring(109,119,a,b)}" fill="${selected?'#ffc107':i%2?'#dc3545':'#198754'}"/><path d="${ring(66,75,a,b)}" fill="${selected?'#ffc107':i%2?'#dc3545':'#198754'}"/><text x="${pos[0]}" y="${pos[1]+5}" text-anchor="middle" fill="${selected?'#ffc107':'#f8f9fa'}" font-size="${selected?'19':'13'}">${n}</text>`;}).join('')}<circle cx="150" cy="150" r="16" fill="${target===25?'#ffc107':'#198754'}" stroke="#212529"/><circle cx="150" cy="150" r="7" fill="${target===50?'#ffc107':'#dc3545'}" stroke="#212529"/></svg>`;
  }
  function historyHTML() {
    if (!game.turns.length) return '<div class="empty-history">Здесь появятся ваши ходы.<br>Первый бросок — за вами.</div>';
    if(game.mode==='sectors') {
      const entries=game.turns.map((t,i)=>({...t,index:i})).slice(historyExpanded?0:Math.max(0,game.turns.length-6)).reverse();
      return `<div class="history-scroll"><table><thead><tr><th>№</th><th>Игрок</th><th>Событие</th></tr></thead><tbody>${entries.map(t=>`<tr><td>${t.index+1}</td><td>${esc(game.players.find(p=>p.id===t.playerId).name)}</td><td><button data-action="edit-turn" data-index="${t.index}" aria-label="Исправить событие ${t.index+1}">${t.kind==='hit'?'✓ Попал':'Ход передан'}</button></td></tr>`).join('')}</tbody></table></div>${game.turns.length>6?`<button class="history-more" data-action="history">${historyExpanded?'Свернуть историю':'Все события · '+game.turns.length}</button>`:''}`;
    }
    const visits={},remaining={}; game.players.forEach(p=>{visits[p.id]=[];remaining[p.id]=game.total;});
    game.turns.forEach((t,i)=>{if(visits[t.playerId]){const bust=game.mode==='x01'&&(t.kind==='bust'||t.score>remaining[t.playerId]);if(!bust)remaining[t.playerId]-=t.score;visits[t.playerId].push({...t,index:i,displayBust:bust});}});
    const count=Math.max(...Object.values(visits).map(v=>v.length));
    const start=historyExpanded?0:Math.max(0,count-5);
    let html=`<div class="history-scroll"><table style="min-width:${Math.max(300,game.players.length*115+65)}px"><thead><tr><th>Круг</th>${game.players.map(p=>`<th scope="col" title="${esc(p.name)}">${esc(p.name)}</th>`).join('')}</tr></thead><tbody>`;
    for(let r=count-1;r>=start;r--) html+=`<tr><td>${r+1}</td>${game.players.map(p=>{const t=visits[p.id][r];if(!t)return '<td>—</td>';const label=game.mode==='sectors'?(t.kind==='hit'?'✓ Попал':'Мимо'):t.displayBust?'Перебор':t.score;return `<td><button data-action="edit-turn" data-index="${t.index}" class="${t.displayBust?'bust':''}" aria-label="Исправить: ${esc(p.name)}, круг ${r+1}, ${label}">${label}</button></td>`;}).join('')}</tr>`;
    return html+`</tbody></table></div>${count>5?`<button class="history-more" data-action="history">${historyExpanded?'Свернуть историю':'Все круги · '+count}</button>`:''}`;
  }
  function openModal(title,html,type,data) {
    if(modalType==='card')releaseCard();
    document.querySelector('.dialog').classList.toggle('match-card-dialog',type==='card');
    if($('modal').hidden)returnFocus=token(document.activeElement);
    modalType=type||'';modalData=data||{};
    $('dialog-title').textContent=title;$('dialog-content').innerHTML=html;$('modal').hidden=false;
    $('main').setAttribute('aria-hidden','true');
    document.querySelectorAll('body > header,body > main,body > footer,body > .remote-hint').forEach(el=>el.inert=true);
    document.body.style.overflow='hidden';
    const first=controls($('dialog-content'))[0];if(first)first.focus();else focusTo('close|||');
  }
  function closeModal() {
    if(modalType==='card')releaseCard();
    document.querySelector('.dialog').classList.remove('match-card-dialog');
    $('modal').hidden=true;modalType='';modalData={};$('main').removeAttribute('aria-hidden');
    document.querySelectorAll('[inert]').forEach(el=>el.inert=false);document.body.style.overflow='';focusTo(returnFocus);
  }
  function confirmAction(title,text,action) { openModal(title,`<p>${esc(text)}</p><div class="dialog-actions"><button data-action="close">Отмена</button><button class="primary" data-action="${action}">Да, продолжить</button></div>`,'confirm'); }
  function nameDialog(index,source,pendingPlayer) {
    const p=pendingPlayer||(source==='draft'?draft.players[index]:game.players.find(p=>p.id===index));
    openModal('Имя и аватар',`<label class="field-label" for="player-name">Как вас записать?</label><input id="player-name" maxlength="24" inputmode="none" readonly value="${esc(p.name)}"><div class="avatar-picker" aria-label="Выберите аватар">${G.AVATARS.map(a=>`<button data-action="avatar" data-value="${a}" class="${a===p.avatar?'selected':''}" aria-label="Аватар ${a}" aria-pressed="${a===p.avatar}">${a}</button>`).join('')}</div><div id="letter-board">${lettersHTML('ru')}</div><div class="dialog-actions"><button data-action="close">Отмена</button><button class="primary" data-action="save-name">Сохранить</button></div>`,'name',{index,source,player:pendingPlayer,avatar:p.avatar,lang:'ru'});
  }
  function lettersHTML(lang) { return `<div class="name-keyboard" aria-label="Буквы имени">${(lang==='ru'?'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ':'ABCDEFGHIJKLMNOPQRSTUVWXYZ').split('').map(c=>`<button data-action="letter" data-value="${c}">${c}</button>`).join('')}<button class="wide" data-action="letter" data-value="space">Пробел</button><button class="wide" data-action="letter" data-value="delete">⌫</button><button class="wide" data-action="letter" data-value="clear">Очистить</button><button class="wide" data-action="alphabet">${lang==='ru'?'ABC':'АБВ'}</button></div>`; }
  function numberDialog(title,value,type,data) {
    openModal(title,`<label class="field-label" for="dialog-number">${type==='custom'?'Стартовый счёт от 1 до 9999':'Очки за ход: от 0 до 180'}</label><label class="score-display"><input id="dialog-number" aria-label="${type==='custom'?'Стартовый счёт':'Исправленный результат'}" inputmode="none" maxlength="${type==='custom'?4:3}" value="${value}" readonly></label>${keypadHTML(true)}<div class="dialog-actions"><button data-action="close">Отмена</button><button class="primary" data-action="save-number">Сохранить</button></div>${type==='edit'?'<button class="undo-button" data-action="edit-bust">Отметить как перебор</button>':''}`,type,data);
  }
  function settingsDialog() {
    openModal('Ваше табло',`<p>Выберите оформление. Управление стрелками доступно в любой теме.</p><span class="field-label">Цветовая схема</span><div class="settings-choices">${[['dark','Тёмная'],['light','Светлая'],['auto','Системная']].map(([v,t])=>`<button data-action="theme" data-value="${v}" class="${theme===v?'selected':''}" aria-pressed="${theme===v}">${t}</button>`).join('')}</div><div class="menu-stack"><button data-action="effects" aria-pressed="${effects}">Анимации и конфетти: ${effects?'вкл.':'выкл.'}</button><button data-action="commentator" aria-pressed="${commentator}">Ишак-комментатор: ${commentator?'вкл.':'выкл.'}</button></div>`,'settings');
  }
  function idleComment(text, player) {
    return {event:'idle',mood:'friendly',label:'У МИШЕНИ',player:player||'',text:text||(player?`${player}, мишень уже в курсе твоих планов. Я пока присматриваюсь.`:'Вы бросайте. Я посмотрю с умным видом.')};
  }
  function commentatorHTML() {
    if(!commentator)return '';
    const win=G.winner(game);
    if(win && (comment.event!=='win'||comment.player!==win.name))comment=E.commentFor(game,comment.text);
    if(!win && comment.event==='win') {
      const active=game.players.find(p=>p.id===game.activeId);
      comment=idleComment(`${active.name}, пересчёт принят. Никто ничего не видел.`,active.name);
    }
    return `<aside class="donkey-commentator mood-${comment.mood}" aria-label="Ишак-комментатор"><div class="donkey-portrait" aria-hidden="true"><img src="static/img/ishak2.png" alt=""><span class="donkey-mood">${comment.mood==='proud'?'★':comment.mood==='amazed'?'!':comment.mood==='oops'?'?':'•'}</span></div><div class="donkey-copy"><div class="donkey-label">ИШАК ${esc(comment.label)}${comment.player?`<span> · ${esc(comment.player)}</span>`:''}</div><p>${esc(comment.text)}</p></div></aside>`;
  }
  function updateComment() {
    if(!commentator)return;
    const next=E.commentFor(game,comment.text);
    if(!next)return;
    const urgent=['win','maximum','bust'].includes(next.event);
    if(!urgent&&Date.now()-lastCommentAt<6000)return;
    comment=next;lastCommentAt=Date.now();
  }
  function releaseCard() {
    cardRequest++;
    if(cardExport)URL.revokeObjectURL(cardExport.url);
    cardExport=null;
  }
  async function openMatchCard() {
    const summary=E.summarize(game);
    if(!summary){toast('Карточка появится после завершения партии.');return;}
    openModal('Карточка матча',`<div class="match-card-layout"><div class="card-preview"><div id="card-loading" role="status">Рисуем вашу победу…</div><img id="card-image" alt="Карточка матча: победитель ${esc(summary.winner.name)}, ${esc(modeName(game))}" hidden></div><div class="card-details"><div class="eyebrow">ЭТО СТОИТ СОХРАНИТЬ</div><h3>${esc(summary.winner.name)} — победа!</h3><p>${esc(modeName(game))}. Результаты всей компании, лучший момент и награда от ишака — в одной картинке.</p><div class="card-award"><span>НАГРАДА ОТ ИШАКА</span><strong>${esc(summary.award.title)}</strong><p>${esc(summary.award.reason)}</p></div><div class="card-export-actions"><button id="download-card" class="primary" data-action="download-card" disabled>↓ Сохранить PNG</button><button id="share-card" data-action="share-card" disabled>Отправить…</button></div><p id="card-share-note" class="card-export-note">Картинка готовится на вашем устройстве.</p><div class="sr-only">Результаты на момент финиша: ${summary.rows.map(p=>`${esc(p.name)} — ${summary.mode==='x01'?'остаток '+p.remaining:p.progress+' из 22 целей'}`).join('; ')}.</div></div></div>`,'card');
    const request=cardRequest;
    try {
      const result=await window.DartsMatchCard.render(summary);
      if(modalType!=='card'||request!==cardRequest)return;
      const url=URL.createObjectURL(result.blob);
      const filename='darts-'+(summary.mode==='x01'?summary.total:'sectors')+'-'+String(summary.createdAt||'match')+'.png';
      let file=null,canShare=false;
      try { file=new File([result.blob],filename,{type:'image/png'});canShare=!!(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})); } catch(_) {}
      cardExport={url,blob:result.blob,file,filename,canShare};
      $('card-image').src=url;$('card-image').hidden=false;$('card-loading').hidden=true;
      $('download-card').disabled=false;$('share-card').disabled=!canShare;
      $('card-share-note').textContent=canShare?'PNG · '+result.width+' × '+result.height+'. Выберите, куда отправить.':'PNG · '+result.width+' × '+result.height+'. На этом устройстве сохраните картинку и отправьте её из галереи или файлов.';
    } catch(_) {
      if(modalType==='card'&&request===cardRequest)$('card-loading').textContent='Не удалось создать картинку. Закройте карточку и попробуйте ещё раз.';
    }
  }
  function downloadCard() {
    if(!cardExport)return;
    // A separate URL survives closing the preview while the download starts.
    const url=URL.createObjectURL(cardExport.blob),link=document.createElement('a');
    link.href=url;link.download=cardExport.filename;link.rel='noopener';document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    $('card-share-note').textContent='PNG передан браузеру для сохранения. Проверьте загрузки устройства.';
  }
  async function shareCard() {
    if(!cardExport||!cardExport.canShare)return;
    const button=$('share-card');button.disabled=true;
    try {
      // The File is prepared before the click, preserving transient user activation.
      await navigator.share({files:[cardExport.file],title:'Дартс — карточка матча'});
    } catch(error) {
      if(error.name!=='AbortError'&&modalType==='card')$('card-share-note').textContent='Не получилось открыть отправку. Сохраните PNG и отправьте его из файлов.';
    } finally {if(modalType==='card'&&$('share-card')===button)button.disabled=false;}
  }

  function record(score,kind) {
    try {
      const previousWinner=G.winner(game),p=game.players.find(p=>p.id===game.activeId);const busted=game.mode==='x01'&&(kind==='bust'||score>G.standings(game).find(row=>row.id===p.id).remaining);G.record(game,score,kind);buffer='';persist();
      const win=G.winner(game),complete=G.finished(game);if(!previousWinner)updateComment();render(complete?'match-card-open':win?(game.finishingRound?'key-five':'continue-round'):game.mode==='x01'?'key-five':'sector-hit',false);
      const next=game.players.find(p=>p.id===game.activeId);
      announce(complete?`${win.name} побеждает! Круг доигран.`:win?previousWinner?`Ход записан. Осталось игроков: ${G.pendingFinish(game).length}.`:`${win.name} побеждает! Осталось доиграть круг.`:kind==='hit'?`Сектор закрыт. Следующая цель: ${G.SECTORS[G.standings(game).find(row=>row.id===p.id).progress]}.`:`Ход записан. Сейчас ходит ${next.name}.`);
      if(win&&!previousWinner)celebrate();else if(!win&&!busted&&kind!=='miss')react(score);
      if(busted)toast(`${p.name}: перебор. Остаток не изменился.`);
    } catch(error) { toast(error.message); }
  }
  function digit(value) {
    const input=$('modal').hidden?$('score-input'):$('dialog-number');if(!input)return;
    let next=input.value;if(value==='clear')next='';else if(value==='delete')next=next.slice(0,-1);else if(next.length<Number(input.maxLength))next=(next==='0'?'':next)+value;
    input.value=next;if($('modal').hidden)buffer=next;
  }
  function editReadOnlyInput(field, key) {
    const start=field.selectionStart,end=field.selectionEnd;
    if(start===null||end===null)return;
    const previous=Array.from(field.value.slice(0,start)).pop()||'';
    const next=Array.from(field.value.slice(end))[0]||'';
    const from=key==='Backspace'&&start===end?start-previous.length:start;
    const to=key==='Delete'&&start===end?end+next.length:end;
    const text=key==='Backspace'||key==='Delete'?'':key;
    if(field.value.length-(to-from)+text.length<=field.maxLength)field.setRangeText(text,from,to,'end');
    if(field.id==='score-input')buffer=field.value;
  }
  function startGame() { game=G.create(draft.mode,draft.total,draft.players);comment=idleComment('',game.players[0].name);lastCommentAt=0;view='game';buffer='';historyExpanded=false;persist();render(game.mode==='x01'?'key-five':'sector-hit',false);announce('Партия началась. Ходит '+game.players[0].name); }
  function goHome() { buffer='';view='home';render(game?'resume':'mode-1'); }
  function celebrate() {
    if(!effects||motionMedia.matches)return;
    for(let i=0;i<40;i++){const el=document.createElement('i');el.className='confetti-piece';el.style.left=(Math.random()*100)+'%';el.style.background=['#198754','#ffc107','#dc3545'][i%3];el.style.animationDelay=(Math.random()*.4)+'s';$('confetti').append(el);setTimeout(()=>el.remove(),2700);}
  }
  function react(score) {
    if(game.mode==='x01'&&score>=100)celebrate();
  }
  function handleAction(button) {
    const action=button.dataset.action,value=button.dataset.value,player=button.dataset.player,index=Number(button.dataset.index);
    if(action==='close'){closeModal();return;}
    if(action==='home'){if(!$('modal').hidden)closeModal();goHome();return;}
    if(action==='settings'){settingsDialog();return;}
    if(action==='match-card'){openMatchCard();return;}
    if(action==='download-card'){downloadCard();return;}
    if(action==='share-card'){shareCard();return;}
    if(action==='commentator'){commentator=!commentator;storage.setItem('darts.commentator',String(commentator));render();settingsDialog();focusTo(token(button));return;}
    if(action==='theme'){theme=value;storage.setItem('theme',theme);applyTheme();settingsDialog();focusTo(token(button));return;}
    if(action==='effects'){effects=!effects;storage.setItem('darts.effects',String(effects));settingsDialog();focusTo(token(button));return;}
    if(action==='help'){openModal('Играйте с любого экрана',`<p>Телефон, планшет, компьютер или телевизор — все действия доступны кнопками.</p><div class="help-row"><strong>Стрелки ↑ ↓ ← →</strong><span>Перемещают фокус</span></div><div class="help-row"><strong>OK / Enter</strong><span>Нажимают кнопку; во время игры по секторам засчитывают попадание</span></div><div class="help-row"><strong>Назад / Esc</strong><span>Закрывают окно или открывают главное меню</span></div><div class="help-row"><strong>Цифры 0–9</strong><span>Вводят очки; 0 передаёт ход в игре по секторам</span></div><div class="help-row"><strong>Tab / Shift + Tab</strong><span>Следующий / предыдущий элемент</span></div><p style="margin-top:18px">Для ввода используйте клавиатуру приложения. Если браузер использует стрелки для указателя, переключите пульт в режим навигации. Кнопка браузера «Назад» может работать по правилам самого телевизора.</p><button class="primary submit-score" data-action="close">Понятно</button>`,'help');return;}
    if(action==='about'){openModal('Дартс. Ваш домашний клуб.',`<p>Счёт для игр с друзьями, без регистрации. Текущая партия хранится только в этом браузере.</p><div class="menu-stack"><a href="https://github.com/maksymov/darts" target="_blank" rel="noopener">Код проекта на GitHub ↗</a><a href="https://vk.com/maksymov.vlad" target="_blank" rel="noopener">Автор ВКонтакте ↗</a><a href="https://t.me/MaKcuMoB" target="_blank" rel="noopener">Написать автору ↗</a><a href="https://yoomoney.ru/to/410011276146968" target="_blank" rel="noopener">Поддержать проект ↗</a></div>`,'about');return;}
    if(action==='mode'){draft.mode=value;draft.total=Number(button.dataset.total);render(token(button));return;}
    if(action==='custom-total'){numberDialog('Свой стартовый счёт',draft.total,'custom');return;}
    if(action==='add-draft'){const index=draft.players.length,p={name:'Игрок '+(index+1),avatar:G.AVATARS[index%G.AVATARS.length]};nameDialog(index,'new-draft',p);return;}
    if(action==='remove-draft'){if(draft.players.length>1)draft.players.splice(Number(player),1);render('start-game');return;}
    if(action==='edit-draft'){nameDialog(Number(player),'draft');return;}
    if(action==='avatar'){modalData.avatar=value;document.querySelectorAll('.avatar-picker button').forEach(b=>{b.classList.toggle('selected',b.dataset.value===value);b.setAttribute('aria-pressed',String(b.dataset.value===value));});return;}
    if(action==='toggle-letters'){$('letter-board').hidden=!$('letter-board').hidden;return;}
    if(action==='alphabet'){modalData.lang=modalData.lang==='ru'?'en':'ru';$('letter-board').innerHTML=lettersHTML(modalData.lang);focusTo('alphabet|||');return;}
    if(action==='letter'){const input=$('player-name');if(value==='delete')input.value=Array.from(input.value).slice(0,-1).join('');else if(value==='clear')input.value='';else if(input.value.length<24)input.value+=value==='space'?' ':value;return;}
    if(action==='save-name'){const name=$('player-name').value.trim();if(!name){toast('Введите имя или оставьте «Игрок».');return;}const p=modalData.source==='new-draft'||modalData.source==='new-game'?modalData.player:modalData.source==='draft'?draft.players[modalData.index]:game.players.find(p=>p.id===modalData.index);p.name=name.slice(0,24);p.avatar=modalData.avatar;if(modalData.source==='new-draft')draft.players.push(p);else if(modalData.source==='new-game'){game.players.push(p);persist();}else if(modalData.source==='game')persist();closeModal();render(returnFocus);return;}
    if(action==='start'){if(game&&game.turns.length&&!G.winner(game))confirmAction('Начать новую партию?','Сохранённая партия будет заменена. Можно отменить и продолжить её.','confirm-start');else startGame();return;}
    if(action==='confirm-start'){closeModal();startGame();return;}
    if(action==='resume'){view='game';render(G.winner(game)?'match-card-open':game.mode==='x01'?'key-five':'sector-hit');return;}
    if(action==='digit'){digit(value);return;}
    if(action==='submit'){if(buffer===''){toast('Введите очки или нажмите «Промах».');return;}record(Number(buffer),'score');return;}
    if(action==='miss'){record(0,'score');return;}
    if(action==='bust'){record(0,'bust');return;}
    if(action==='hit'){record(0,'hit');return;}
    if(action==='sector-miss'){record(0,'miss');return;}
    if(action==='undo'){if(!game.turns.length)return;G.undo(game);comment=idleComment('Пересчёт принят. Никто ничего не видел.');buffer='';persist();render(game.mode==='x01'?'key-five':'sector-hit');toast('Ход отменён. Очередь возвращена игроку.');return;}
    if(action==='continue-round'){const queue=G.pendingFinish(game);if(!queue.length)return;game.finishingRound=true;game.activeId=queue[0];buffer='';persist();render(game.mode==='x01'?'key-five':'sector-hit');announce(`Доигрываем круг. Сейчас ходит ${game.players.find(p=>p.id===game.activeId).name}.`);return;}
    if(action==='history'){historyExpanded=!historyExpanded;render(token(button));return;}
    if(action==='edit-turn'){const t=game.turns[index];if(game.mode==='x01')numberDialog('Исправить ход',t.score,'edit',{index});else openModal('Исправить ход','<p>Что произошло в этот момент?</p><div class="dialog-actions"><button data-action="edit-sector" data-value="miss">Передача хода</button><button class="primary" data-action="edit-sector" data-value="hit">Попадание</button></div>','edit',{index});return;}
    if(action==='edit-sector'||action==='edit-bust'){G.edit(game,modalData.index,0,action==='edit-bust'?'bust':value);persist();closeModal();render(returnFocus);return;}
    if(action==='save-number'){const text=$('dialog-number').value,number=Number(text);if(!text||!/^\d+$/.test(text)||!Number.isInteger(number)){toast('Введите целое число.');return;}if(modalType==='custom'){if(number<1||number>9999){toast('Стартовый счёт: от 1 до 9999.');return;}draft.total=number;draft.mode='x01';}else{try{G.edit(game,modalData.index,number,'score');persist();}catch(e){toast(e.message);return;}}closeModal();render(returnFocus);return;}
    if(action==='match-menu'){openModal('Меню партии',`<div class="menu-stack">${G.winner(game)?'<button data-action="match-card">Карточка матча ↗</button>':''}<button data-action="add-match-player">＋ Добавить игрока</button><button data-action="restart">↶ Начать эту партию заново</button><button data-action="home">← Выбрать другую игру</button></div>`,'match-menu');return;}
    if(action==='add-match-player'){const index=game.players.length,p={id:'p'+Date.now().toString(36),name:'Игрок '+(index+1),avatar:G.AVATARS[index%G.AVATARS.length],start:0};nameDialog(p.id,'new-game',p);return;}
    if(action==='shuffle-players'){if(game.players.length>1){const original=game.players.map(p=>p.id);do{for(let i=game.players.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[game.players[i],game.players[j]]=[game.players[j],game.players[i]];}}while(game.players.every((p,i)=>p.id===original[i]));persist();render(token(button));}return;}
    if(action==='player-menu'){const p=game.players.find(p=>p.id===player);openModal(p.name,`<div class="menu-stack"><button data-action="rename" data-player="${player}">✎ Имя и аватар</button><button data-action="move" data-player="${player}" data-value="-1" ${game.players[0].id===player?'disabled':''}>← Раньше в очереди</button><button data-action="move" data-player="${player}" data-value="1" ${game.players[game.players.length-1].id===player?'disabled':''}>Позже в очереди →</button><button class="danger" data-action="remove-player" data-player="${player}" ${game.players.length===1?'disabled':''}>Убрать игрока из партии</button></div>`,'player-menu',{player});return;}
    if(action==='rename'){nameDialog(player,'game');return;}
    if(action==='move'){const from=game.players.findIndex(p=>p.id===player),to=from+Number(value);if(to>=0&&to<game.players.length)game.players.splice(to,0,game.players.splice(from,1)[0]);persist();closeModal();render(returnFocus);return;}
    if(action==='remove-player'){const p=game.players.find(p=>p.id===player);confirmAction('Убрать игрока?',`Результаты ${p.name} будут удалены из этой партии.`,'confirm-remove');modalData={player};return;}
    if(action==='confirm-remove'){const id=modalData.player;if(game.players.length>1){const next=game.players[(game.players.findIndex(p=>p.id===id)+1)%game.players.length].id;game.players=game.players.filter(p=>p.id!==id);game.turns=game.turns.filter(t=>t.playerId!==id);if(game.activeId===id)game.activeId=next;G.reconcileFinish(game);persist();}closeModal();render(game.mode==='x01'?'key-five':'sector-hit');return;}
    if(action==='restart'){confirmAction('Начать заново?','Очки и история этой партии будут сброшены. Состав игроков сохранится.','confirm-restart');return;}
    if(action==='rematch'||action==='confirm-restart'){const old=game;game=G.create(old.mode,old.total,old.players);comment=idleComment('Реванш? Вот это я понимаю — характер.');lastCommentAt=0;buffer='';persist();if(!$('modal').hidden)closeModal();render(game.mode==='x01'?'key-five':'sector-hit');return;}
  }
  document.addEventListener('click',event=>{const b=event.target.closest('button[data-action]');if(b&&!b.disabled)handleAction(b);});
  document.addEventListener('input',event=>{if(event.target.id==='score-input'){event.target.value=event.target.value.replace(/\D/g,'').slice(0,3);buffer=event.target.value;}if(event.target.id==='dialog-number')event.target.value=event.target.value.replace(/\D/g,'').slice(0,modalType==='custom'?4:3);});
  function moveFocus(direction) {
    const scope=$('modal').hidden?document:$('modal'),list=controls(scope).filter(el=>!el.classList.contains('skip-link'));
    const current=document.activeElement;
    if(!list.includes(current)){focusTo(view==='game'?(game.mode==='x01'?'key-five':'sector-hit'):'start-game');return;}
    const rect=current.getBoundingClientRect(),cx=(rect.left+rect.right)/2,cy=(rect.top+rect.bottom)/2;
    const horizontal=direction==='ArrowLeft'||direction==='ArrowRight';
    const sign=direction==='ArrowRight'||direction==='ArrowDown'?1:-1;
    let best=null,bestScore=Infinity;
    list.forEach(el=>{if(el===current)return;const r=el.getBoundingClientRect(),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2,forward=(horizontal?x-cx:y-cy)*sign,side=Math.abs(horizontal?y-cy:x-cx);if(forward<4)return;
      const overlap=horizontal?r.bottom>rect.top+3&&r.top<rect.bottom-3:r.right>rect.left+3&&r.left<rect.right-3;
      const score=forward+(overlap?side*.15:side*2.5+1000);if(score<bestScore){best=el;bestScore=score;}});
    if(best){best.focus({preventScroll:true});best.scrollIntoView({block:'nearest',inline:'nearest'});}
  }
  function back() {if(!$('modal').hidden)closeModal();else if(view==='game'){if(buffer){buffer='';if($('score-input'))$('score-input').value='';}else goHome();}}
  document.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    const map={37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',13:'Enter',27:'Escape',10009:'BrowserBack',461:'BrowserBack'};
    const zero=event.key==='0'||event.code==='Numpad0'||event.keyCode===96||(event.keyCode===45&&event.location===3)||
      (event.keyCode===48&&(!event.key||event.key==='Unidentified'));
    const key=zero?'0':map[event.keyCode]||event.key||'';
    const input=event.target.tagName==='INPUT';
    const editing=input&&!event.target.readOnly;
    if(key==='Tab'&&!$('modal').hidden){const list=controls($('modal')),i=list.indexOf(document.activeElement);if(event.shiftKey&&i<=0){event.preventDefault();list[list.length-1].focus();}else if(!event.shiftKey&&i===list.length-1){event.preventDefault();list[0].focus();}return;}
    if(key==='Escape'||key==='BrowserBack'||key==='GoBack'){event.preventDefault();back();return;}
    if((key==='0'||key==='Enter') && event.target.id!=='update-reload' && $('modal').hidden && view==='game' && game && game.mode==='sectors' && !G.winner(game)){
      event.preventDefault();if(!event.repeat)record(0,key==='0'?'miss':'hit');return;
    }
    if((event.target.id==='player-name' && (key==='Backspace'||key==='Delete'||Array.from(key).length===1)) ||
       (['score-input','dialog-number'].includes(event.target.id) && (key==='Backspace'||key==='Delete'||/^\d$/.test(key)))) {
      editReadOnlyInput(event.target,key);
      event.preventDefault();return;
    }
    if(key.indexOf('Arrow')===0){if(editing&&(key==='ArrowLeft'||key==='ArrowRight'))return;event.preventDefault();document.documentElement.classList.add('remote-navigation');moveFocus(key);return;}
    if(key==='Enter'){
      if(event.repeat){event.preventDefault();return;}
      if(input){event.preventDefault();if(event.target.id==='player-name')handleAction(document.querySelector('[data-action="save-name"]'));else if(event.target.id==='dialog-number')handleAction(document.querySelector('[data-action="save-number"]'));else if(event.target.id==='score-input')handleAction($('submit-score'));return;}
      if(event.key!=='Enter'&&event.target.tagName==='BUTTON'){event.preventDefault();event.target.click();}return;
    }
    if(editing)return;
    if(/^\d$/.test(key)&&(($('modal').hidden&&view==='game'&&$('score-input'))||['custom','edit'].includes(modalType))){event.preventDefault();digit(key);const target=$('modal').hidden?$('score-input'):$('dialog-number');if(target)target.focus();return;}
    if(key==='Backspace'&&(($('modal').hidden&&view==='game')||['custom','edit'].includes(modalType))){event.preventDefault();digit('delete');}
  });
  document.addEventListener('pointerdown',()=>document.documentElement.classList.remove('remote-navigation'));
  // Preserve current state before the browser or the device goes into the background.
  document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();});
  applyTheme();render();if(game)persist();
  if('serviceWorker' in navigator && (location.protocol==='https:'||['localhost','127.0.0.1','::1'].includes(location.hostname))) {
    let registration, reloading = false, hadController = !!navigator.serviceWorker.controller;
    const notice = $('update-notice');
    const showUpdate = () => { notice.hidden = false; };
    $('update-reload').addEventListener('click', () => {
      if ((view === 'home' || buffer || !$('modal').hidden) && !window.confirm('Незавершённый ввод будет потерян. Перезагрузить приложение?')) return;
      if (!persist()) return;
      if (registration && registration.waiting) {
        reloading = true;
        registration.waiting.postMessage({type:'skipWaiting'});
      } else location.reload();
    });
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if (reloading) location.reload();
      else if (hadController) showUpdate();
      hadController = true;
    });
    navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'})
      .then(reg => {
        registration = reg;
        const check = () => reg.update().catch(error=>console.error('Не удалось проверить обновление:',error));
        if (reg.waiting && navigator.serviceWorker.controller) showUpdate();
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (worker) worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
          });
        });
        check();
        setInterval(check, 60000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      })
      .catch(error=>console.error('Не удалось обновить приложение:',error));
  }
})();
