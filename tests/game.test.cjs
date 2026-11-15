const assert = require('node:assert/strict');
const G = require('../beta/static/game.js');
function run() {
  let count=0;
  function check(name,fn){fn();count++;}
  const players=[{name:'Аня'},{name:'Борис'}];
  check('A recorded turn changes only its player and advances the turn',()=>{
    const g=G.create('x01',501,players);G.record(g,100);
    assert.deepEqual(G.standings(g).map(p=>p.remaining),[401,501]);assert.equal(g.activeId,'p1');
    G.undo(g);assert.equal(g.activeId,'p0');assert.equal(G.standings(g)[0].remaining,501);
  });
  check('Bust does not subtract points; exact finish wins',()=>{
    const g=G.create('x01',40,[players[0]]);G.record(g,60);assert.equal(G.standings(g)[0].remaining,40);
    G.record(g,0,'bust');assert.equal(G.standings(g)[0].remaining,40);
    G.record(g,40);assert.equal(G.winner(g).id,'p0');assert.ok(G.finished(g));assert.throws(()=>G.record(g,0));
    G.undo(g);assert.equal(G.winner(g),null);assert.equal(g.activeId,'p0');
  });
  check('The winner can finish before the round ends and remaining players get one final turn',()=>{
    const g=G.create('x01',8,[...players,{name:'Вера'}]);G.record(g,8);
    assert.equal(G.winner(g).id,'p0');assert.deepEqual(G.pendingFinish(g),['p1','p2']);assert.equal(G.finished(g),false);
    assert.throws(()=>G.record(g,0));g.finishingRound=true;G.record(g,8);
    assert.deepEqual(G.pendingFinish(g),['p2']);assert.equal(G.winner(g).id,'p0');assert.equal(g.activeId,'p2');
    assert.deepEqual(G.winners(g).map(p=>p.id),['p0','p1']);
    G.record(g,8);assert.equal(G.pendingFinish(g).length,0);assert.equal(G.finished(g),true);assert.deepEqual(G.winners(g).map(p=>p.id),['p0','p1','p2']);
  });
  check('Draw includes only players finishing in the same round and undo and edits recalculate it',()=>{
    const g=G.create('x01',8,Array.from({length:5},(_,i)=>({name:'Игрок '+i})));
    G.record(g,0);G.record(g,8);
    assert.deepEqual(G.pendingFinish(g),['p2','p3','p4']);assert.deepEqual(G.winners(g).map(p=>p.id),['p1']);
    g.finishingRound=true;G.record(g,8);G.record(g,0);G.record(g,8);
    assert.equal(G.finished(g),true);assert.deepEqual(G.winners(g).map(p=>p.id),['p1','p2','p4']);
    G.undo(g);assert.equal(G.finished(g),false);assert.equal(g.activeId,'p4');assert.deepEqual(G.winners(g).map(p=>p.id),['p1','p2']);
    G.record(g,0);assert.equal(G.finished(g),true);assert.deepEqual(G.winners(g).map(p=>p.id),['p1','p2']);
    G.edit(g,2,0);assert.deepEqual(G.winners(g).map(p=>p.id),['p1']);
    G.edit(g,3,8);assert.deepEqual(G.winners(g).map(p=>p.id),['p1','p3']);
    const saved=JSON.parse(JSON.stringify(g));assert.ok(G.valid(saved));assert.deepEqual(G.winners(saved).map(p=>p.id),['p1','p3']);
  });
  check('A winner who finishes last in the round ends the game immediately',()=>{
    const g=G.create('x01',8,[...players,{name:'Вера'}]);G.record(g,0);G.record(g,0);G.record(g,8);
    assert.equal(G.winner(g).id,'p2');assert.deepEqual(G.pendingFinish(g),[]);assert.equal(G.finished(g),true);
  });
  check('Undoing a finish-round turn restores that player to the pending queue',()=>{
    const g=G.create('x01',8,[...players,{name:'Вера'}]);G.record(g,8);
    g.finishingRound=true;G.record(g,8);G.undo(g);
    assert.deepEqual(G.pendingFinish(g),['p1','p2']);assert.equal(g.activeId,'p1');assert.equal(G.finished(g),false);
  });
  check('Skipping in X01 changes only the active player and does not create a visit',()=>{
    const g=G.create('x01',501,players);const rows=G.standings(g);
    G.skipPlayer(g);assert.equal(g.activeId,'p1');assert.equal(g.turns.length,0);assert.deepEqual(G.standings(g),rows);
    G.record(g,60);assert.equal(g.turns[0].playerId,'p1');G.undo(g);assert.equal(g.activeId,'p1');
    assert.throws(()=>G.skipPlayer(G.create('x01',501,[players[0]])));
    assert.throws(()=>G.skipPlayer(G.create('sectors',501,players)));
  });
  check('Postponed final turns remain pending across undo, edit and persistence',()=>{
    const g=G.create('x01',8,[...players,{name:'Вера'},{name:'Глеб'}]);G.record(g,8);
    assert.throws(()=>G.skipPlayer(g));g.finishingRound=true;
    G.skipPlayer(g);assert.deepEqual(G.pendingFinish(g),['p2','p3','p1']);assert.equal(g.activeId,'p2');
    const saved=JSON.parse(JSON.stringify(g));assert.ok(G.valid(saved));assert.deepEqual(G.pendingFinish(saved),['p2','p3','p1']);
    G.record(saved,8);G.undo(saved);assert.deepEqual(G.pendingFinish(saved),['p2','p3','p1']);assert.equal(saved.activeId,'p2');
    G.record(saved,8);G.edit(saved,1,8);assert.deepEqual(G.pendingFinish(saved),['p3','p1']);assert.equal(saved.activeId,'p3');
    G.record(saved,0);assert.equal(saved.activeId,'p1');assert.throws(()=>G.skipPlayer(saved));
    G.record(saved,8);assert.equal(G.finished(saved),true);assert.deepEqual(G.winners(saved).map(p=>p.id),['p0','p1','p2']);
  });
  check('Invalid input cannot mutate the game',()=>{
    const g=G.create('x01',501,players);for(const n of [-1,181,1.5,NaN,Infinity])assert.throws(()=>G.record(g,n));assert.equal(g.turns.length,0);
  });
  check('180 is accepted, 181 is rejected, and a valid 180 can still bust',()=>{
    const g=G.create('x01',301,players);G.record(g,180);
    assert.equal(G.standings(g)[0].remaining,121);assert.equal(g.activeId,'p1');
    assert.throws(()=>G.record(g,181));assert.equal(g.turns.length,1);assert.equal(g.activeId,'p1');
    G.record(g,0);G.record(g,180);assert.equal(G.standings(g)[0].remaining,121);assert.equal(G.standings(g)[0].last,'Перебор');
    assert.throws(()=>G.edit(g,0,181));G.edit(g,0,180);assert.equal(g.turns[0].score,180);
  });
  check('Editing history recalculates subsequent busts without moving the turn',()=>{
    const g=G.create('x01',100,players);G.record(g,80);G.record(g,20);G.record(g,50);assert.equal(G.standings(g)[0].remaining,20);
    G.edit(g,0,40);assert.equal(G.standings(g)[0].remaining,10);assert.equal(g.activeId,'p1');
  });
  check('Sector hits stay with the player until they pass the turn',()=>{
    const g=G.create('sectors',501,players);G.record(g,0,'hit');G.record(g,0,'hit');assert.equal(g.activeId,'p0');assert.equal(G.standings(g)[0].progress,2);assert.equal(G.standings(g)[0].visits,0);
    G.record(g,0,'miss');assert.equal(g.activeId,'p1');assert.equal(G.standings(g)[0].visits,1);G.undo(g);assert.equal(g.activeId,'p0');assert.equal(G.standings(g)[0].progress,2);
  });
  check('Sector hits, misses, final bull and undo',()=>{
    const g=G.create('sectors',501,[players[0]]);G.record(g,0,'miss');assert.equal(G.standings(g)[0].progress,0);
    for(let i=0;i<20;i++)G.record(g,0,'hit');assert.equal(G.SECTORS[G.standings(g)[0].progress],25);
    G.record(g,0,'hit');assert.equal(G.SECTORS[G.standings(g)[0].progress],50);G.record(g,0,'hit');assert.ok(G.winner(g));
    G.undo(g);assert.equal(G.winner(g),null);assert.equal(G.standings(g)[0].progress,21);
  });
  function legacy(data){return {getItem:key=>data[key]===undefined?null:typeof data[key]==='string'?data[key]:JSON.stringify(data[key])};}
  check('Migration preserves a partly entered legacy round and its next player',()=>{
    const g=G.migrate(legacy({curr_game:'501',total_score:'501',players,circles:[[100,60],[140,0]]}));
    assert.deepEqual(G.standings(g).map(p=>p.remaining),[261,441]);assert.equal(g.activeId,'p1');assert.equal(g.turns.length,3);assert.ok(G.valid(g));
  });
  check('Migration preserves zero visits in completed rounds and ignores empty new rounds',()=>{
    const g=G.migrate(legacy({curr_game:'501',total_score:'301',players,circles:[[100,0],[0,0]]}));
    assert.equal(g.turns.length,2);assert.equal(g.activeId,'p0');assert.deepEqual(G.standings(g).map(p=>p.remaining),[201,301]);
  });
  check('Migration preserves sector targets and tolerates corrupt data',()=>{
    const g=G.migrate(legacy({curr_game:'sectors',players:[{name:'A',score:25},{name:'B',score:7}]}));
    assert.deepEqual(G.standings(g).map(p=>G.SECTORS[p.progress]),[25,7]);assert.equal(G.migrate({getItem:()=>'{broken'}),null);
  });
  check('Persisted state round trips and malformed state is rejected',()=>{
    const g=G.create('x01',501,players);G.record(g,0);assert.ok(G.valid(JSON.parse(JSON.stringify(g))));assert.equal(G.valid({...g,activeId:'missing'}),false);
  });
  return `${count} regression checks passed`;
}
module.exports=run;
if(require.main===module) console.log(run());
