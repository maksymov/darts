const assert = require('node:assert/strict');
const G = require('../static/game.js');
const E = require('../static/match-extras.js');
function run() {
  let count=0;
  function check(name,fn){fn();count++;}
  const players=[{name:'Аня'},{name:'Борис'}];
  check('Winning with eight points gets congratulations, not a low-score joke',()=>{
    const g=G.create('x01',8,players);G.record(g,8);assert.equal(E.eventFor(g),'win');assert.equal(E.commentFor(g).player,'Аня');
  });
  check('An overshoot and explicit bust are classified before big-score or miss reactions',()=>{
    const g=G.create('x01',40,players);G.record(g,180);assert.equal(E.eventFor(g),'bust');G.record(g,0,'bust');assert.equal(E.eventFor(g),'bust');
  });
  check('Only legal visits contribute to the best score; ties keep all player names',()=>{
    const g=G.create('x01',100,players);G.record(g,140);G.record(g,60);G.record(g,60);G.record(g,40);
    const s=E.summarize(g);assert.equal(s.best,60);assert.deepEqual(s.bestPlayers,['Аня','Борис']);assert.equal(s.winner.name,'Борис');assert.equal(s.rows[1].remaining,40);assert.equal(s.rows[1].busts,1);
  });
  check('Awards are grounded in winner statistics and recalculate after corrections',()=>{
    const g=G.create('x01',40,[players[0]]);G.record(g,60);G.record(g,60);G.record(g,40);
    assert.equal(E.summarize(g).award.title,'Упрямство — тоже стратегия');
    G.edit(g,0,0);G.edit(g,1,0);assert.equal(E.summarize(g).award.title,'Долгая пристрелка');
    G.undo(g);assert.equal(E.summarize(g),null);
  });
  check('An unfinished game cannot produce a winner card',()=>{
    assert.equal(E.summarize(G.create('x01',501,players)),null);
  });
  check('A new leader is detected after a full opening round',()=>{
    const g=G.create('x01',501,players);G.record(g,60);G.record(g,90);G.record(g,60);assert.equal(E.eventFor(g),'lead');
  });
  check('Routine sector hits stay quiet; milestones and finishing the bull get reactions',()=>{
    const g=G.create('sectors',501,[players[0]]);G.record(g,0,'hit');assert.equal(E.eventFor(g),null);
    for(let i=1;i<5;i++)G.record(g,0,'hit');assert.equal(E.eventFor(g),'sector');
    for(let i=5;i<20;i++)G.record(g,0,'hit');assert.equal(E.eventFor(g),'bull');
    G.record(g,0,'hit');G.record(g,0,'hit');assert.equal(E.eventFor(g),'win');
    const s=E.summarize(g);assert.equal(s.winner.progress,22);assert.equal(s.award.title,'Коллекционер секторов');
  });
  check('No consecutive identical quote for the same event',()=>{
    const g=G.create('x01',501,players);G.record(g,0);const first=E.commentFor(g);assert.notEqual(E.commentFor(g,first.text).text,first.text);
  });
  check('Summary does not mutate the game, handles long names and includes every player',()=>{
    const names=Array.from({length:8},(_,i)=>({name:'Игрок '+i+' с длинным именем'}));const g=G.create('x01',40,names);G.record(g,40);
    const before=JSON.stringify(g);const s=E.summarize(g);assert.equal(s.rows.length,8);assert.equal(JSON.stringify(g),before);
  });
  return `${count} commentary and card checks passed`;
}
module.exports=run;
if(require.main===module)console.log(run());
