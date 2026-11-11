/* Render the same local PNG for preview, download and native sharing. */
(function () {
  'use strict';
  const WIDTH = 1080;
  const C = { bg:'#151916', panel:'#222b23', ink:'#f0f1e6', muted:'#a4afa3', green:'#d0ed8b', amber:'#edc47c', line:'#3b463b' };
  function portrait() {
    return new Promise(resolve => {
      const img = new Image();
      const timer = setTimeout(() => resolve(null), 2500);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = 'static/img/ishak2.png';
    });
  }
  function font(ctx, size, weight) { ctx.font = (weight || 400) + ' ' + size + 'px Arial, Helvetica, sans-serif'; }
  function text(ctx, value, x, y, size, color, maxWidth, weight) {
    ctx.fillStyle = color || C.ink; font(ctx, size, weight);
    let result = String(value);
    if (maxWidth && ctx.measureText(result).width > maxWidth) {
      const chars = Array.from(result);
      while (chars.length && ctx.measureText(chars.join('') + '…').width > maxWidth) chars.pop();
      result = chars.join('') + '…';
    }
    ctx.fillText(result, x, y);
  }
  function wrap(ctx, value, x, y, width, size, color, lineHeight) {
    font(ctx, size); ctx.fillStyle = color;
    let line = '', lines = [];
    for (const word of value.split(' ')) {
      const candidate = line ? line + ' ' + word : word;
      if (line && ctx.measureText(candidate).width > width) { lines.push(line); line = word; } else line = candidate;
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => text(ctx, l, x, y + i * lineHeight, size, color, width));
    return lines.length * lineHeight;
  }
  function box(ctx, x, y, w, h, color, radius) {
    const r = radius || 20;
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
    ctx.fillStyle=color;ctx.fill();
  }
  async function render(summary) {
    const height = Math.max(1350, 1080 + summary.rows.length * 82);
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Этот браузер не поддерживает создание изображения.');
    const donkey = await portrait();
    ctx.fillStyle=C.bg;ctx.fillRect(0,0,WIDTH,height);
    ctx.strokeStyle=C.line;ctx.lineWidth=2;
    [115,150,185].forEach(r=>{ctx.beginPath();ctx.arc(990,235,r,0,Math.PI*2);ctx.stroke();});
    ctx.strokeStyle=C.green;ctx.lineWidth=3;
    [14,22].forEach(r=>{ctx.beginPath();ctx.arc(94,86,r,0,Math.PI*2);ctx.stroke();});
    text(ctx,'дартс.',132,102,44,C.ink,400,700);
    text(ctx,'ВАШ ДОМАШНИЙ КЛУБ',650,92,17,C.muted,358,700);
    const mode=summary.mode==='x01'?summary.total+' / X01':'ПО СЕКТОРАМ';
    const date=new Date(summary.createdAt);
    const dateText=Number.isFinite(date.getTime())?date.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}):'';
    text(ctx,mode,72,159,20,C.green,500,700);
    text(ctx,dateText,650,159,20,C.muted,358);
    text(ctx,'ПОБЕДИТЕЛЬ МАТЧА',72,249,21,C.green,850,700);
    let winnerSize=90;
    while(winnerSize>44){font(ctx,winnerSize,700);if(ctx.measureText(summary.winner.name).width<=936)break;winnerSize-=2;}
    text(ctx,summary.winner.name,72,356,winnerSize,C.ink,936,700);
    text(ctx,'Мишень покорена. Хорошая игра.',76,411,28,C.muted,900);
    box(ctx,72,459,454,134,C.panel);box(ctx,546,459,462,134,C.panel);
    text(ctx,summary.mode==='x01'?'ЛУЧШИЙ ЗАСЧИТАННЫЙ ХОД':'ЦЕЛИ ПОБЕДИТЕЛЯ',96,491,15,C.muted,406,700);
    text(ctx,summary.mode==='x01'?summary.best:'22 / 22',96,544,48,C.green,406,700);
    const bestNames=summary.bestPlayers.length>2?summary.bestPlayers.slice(0,2).join(', ')+' и ещё '+(summary.bestPlayers.length-2):summary.bestPlayers.join(' · ');
    text(ctx,summary.mode==='x01'?bestNames:'От единицы до яблочка',96,574,18,C.muted,406);
    text(ctx,summary.mode==='x01'?'ХОДОВ У ПОБЕДИТЕЛЯ':'ИГРОКОВ У МИШЕНИ',570,491,15,C.muted,414,700);
    text(ctx,summary.mode==='x01'?summary.winner.visits:summary.rows.length,570,548,48,C.ink,414,700);
    text(ctx,summary.mode==='x01'?'Включая промахи и переборы':'Победила хорошая компания',570,574,18,C.muted,414);
    text(ctx,'ИТОГИ ПАРТИИ',72,646,19,C.muted,600,700);
    ctx.textAlign='right';text(ctx,summary.mode==='x01'?'ОСТАТОК':'ЗАКРЫТО ЦЕЛЕЙ',1008,646,16,C.muted,280,700);ctx.textAlign='left';
    let y=677;
    summary.rows.forEach(row=>{
      if(row.id===summary.winner.id)box(ctx,72,y-5,936,74,C.panel,12);
      const champion=row.id===summary.winner.id;
      text(ctx,champion?'★':'·',94,y+43,29,champion?C.green:C.muted,30,700);
      text(ctx,row.name,139,y+43,29,champion?C.green:C.ink,605,champion?700:400);
      ctx.textAlign='right';text(ctx,summary.mode==='x01'?row.remaining:row.progress+' / 22',984,y+43,32,champion?C.green:C.ink,220,700);ctx.textAlign='left';
      y+=82;
    });
    text(ctx,'На момент победного хода',72,y+18,18,C.muted,900);
    const awardY=Math.max(y+52,height-310);
    box(ctx,72,awardY,936,220,C.panel);
    text(ctx,'НАГРАДА ОТ ИШАКА',96,awardY+36,16,C.amber,710,700);
    text(ctx,summary.award.title,96,awardY+84,32,C.ink,710,700);
    text(ctx,summary.award.reason,96,awardY+119,19,C.muted,710);
    wrap(ctx,'«'+summary.award.quote+'»',96,awardY+160,690,23,C.green,30);
    if(donkey)ctx.drawImage(donkey,820,awardY+55,168,158);
    text(ctx,'ХОРОШАЯ КОМПАНИЯ. ТОЧНЫЙ БРОСОК.',72,height-40,16,C.muted,900,700);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Не удалось подготовить PNG.')),'image/png'));
    return {blob,width:WIDTH,height};
  }
  window.DartsMatchCard={render};
})();
