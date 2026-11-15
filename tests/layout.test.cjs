const assert = require('node:assert/strict');
const L = require('../beta/static/layout.js');
function run() {
  let checks = 0;
  for (const [count, expected] of [[1,[1]],[2,[2]],[3,[3]],[4,[4]],[5,[3,2]],[6,[3,3]],[7,[4,3]],[8,[4,4]]]) {
    for (const width of [296, 780, 1200]) {
      assert.deepEqual(L.arrange(count,width,600,width<600).rows,expected);checks++;
    }
  }
  for (const width of [296, 390, 850, 1500]) for (const count of [9,10,11,12,13,17,24,50]) {
    const layout=L.arrange(count,width,560,width<600);
    assert.equal(layout.rows.reduce((a,b)=>a+b,0),count);
    assert.ok(Math.max(...layout.rows)-Math.min(...layout.rows)<=1);
    assert.equal(layout.cells.length,count);
    layout.rows.forEach((size,row)=>{
      const cells=layout.cells.filter(cell=>cell.row===row+1);
      assert.equal(cells[0].column-1,layout.columns*2-(cells.at(-1).column+1));
      assert.equal(new Set(cells.map(cell=>cell.column)).size,size);
    });checks++;
  }
  assert.deepEqual(L.arrange(0,400,600,true).cells,[]);checks++;
  return `${checks} balanced layout checks passed`;
}
if(require.main===module)console.log(run());
module.exports=run;
