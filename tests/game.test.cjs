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
    G.record(g,40);assert.equal(G.winner(g).id,'p0');assert.throws(()=>G.record(g,0));
    G.undo(g);assert.equal(G.winner(g),undefined);assert.equal(g.activeId,'p0');
  });
  check('Invalid input cannot mutate the game',()=>{
    const g=G.create('x01',501,players);for(const n of [-1,181,1.5,NaN,Infinity])assert.throws(()=>G.record(g,n));assert.equal(g.turns.length,0);
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
    G.undo(g);assert.equal(G.winner(g),undefined);assert.equal(G.standings(g)[0].progress,21);
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
