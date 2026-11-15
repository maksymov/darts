/* Stable, balanced rows without shrinking text to fit more players. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DartsLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function arrange(count, width, height, compact) {
    if (!Number.isInteger(count) || count < 1) return { columns: 1, rows: [], cells: [] };
    let columns;
    if (count <= 4) columns = count;
    else if (count <= 8) columns = Math.ceil(count / 2);
    else {
      const maxColumns = Math.max(1, Math.floor(width / (compact ? 88 : 180)));
      const preferred = Math.ceil(Math.sqrt(count * width / Math.max(height, 180)));
      columns = Math.min(count, maxColumns, Math.max(1, preferred));
    }
    const rowCount = Math.ceil(count / columns);
    const rows = Array.from({ length: rowCount }, (_, i) => Math.floor(count / rowCount) + (i < count % rowCount ? 1 : 0));
    columns = Math.max(...rows);
    const cells = [];
    rows.forEach((size, row) => {
      for (let i = 0; i < size; i++) cells.push({ row: row + 1, column: columns - size + 1 + i * 2 });
    });
    return { columns, rows, cells };
  }
  return { arrange };
});
