// Regression tests for the hand-rolled table renderer in public/markdown.js.
//
// The renderer used to drop empty cells (`split('|').filter(c => c.trim())`),
// which silently shifted every column after the empty one and de-aligned the
// header against the body. An empty leading header cell — the natural way to
// write a "dimension | before | after" comparison table — broke every row.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../public/markdown.js';

/** Column count of the header plus of every body row, in document order. */
function columns(html) {
  return [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map(row => (row[1].match(/<t[dh][ >]/g) || []).length);
}

function assertGrid(md, expectedColumns, note) {
  const html = renderMarkdown(md);
  const cols = columns(html);
  assert.ok(cols.length > 0, `${note}: no <tr> rendered`);
  for (const count of cols) {
    assert.equal(count, expectedColumns, `${note}: every row must have ${expectedColumns} cells, got ${cols.join('/')}\n${html}`);
  }
}

function cells(html, tag) {
  // `<th>` / `<td>` only: plain `<th[^>]*>` would also swallow `<thead>`.
  return [...html.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))]
    .map(m => m[1]);
}

test('empty leading header cell keeps the grid aligned', () => {
  const md = [
    '| | 直接用我 | story-cog |',
    '|---|---|---|',
    '| 成本 | 几美分 | $3–25 一次会话 |',
    '| 配置 | 零 | pip 装包 |',
  ].join('\n');

  const html = renderMarkdown(md);
  assertGrid(md, 3, 'three-column comparison');
  assert.equal(cells(html, 'th')[0], '', 'leading header cell stays empty');
  assert.deepEqual(cells(html, 'td').slice(0, 3), ['成本', '几美分', '$3–25 一次会话']);
});

test('empty cell in the middle of a row keeps its slot', () => {
  const md = ['| a | b | c |', '|---|---|---|', '| 1 |  | 3 |'].join('\n');
  assertGrid(md, 3, 'middle hole');
  assert.deepEqual(cells(renderMarkdown(md), 'td'), ['1', '', '3']);
});

test('a plain table still renders with the right column count', () => {
  const md = ['| 名称 | 值 |', '|---|---|', '| x | 1 |', '| y | 2 |'].join('\n');
  assertGrid(md, 2, 'plain table');
});

test('alignment comes from the delimiter row and survives empty cells', () => {
  const md = ['| | 项目 | 金额 |', '|:--|:--:|--:|', '| a | 1 | 100 |'].join('\n');
  const html = renderMarkdown(md);
  assertGrid(md, 3, 'aligned table');
  const aligns = [...html.matchAll(/<t[dh] style="text-align:(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(aligns.slice(0, 3), ['left', 'center', 'right']);
});

test('a row with more cells than the header does not destroy the grid', () => {
  // Malformed markdown: the widest row wins so no content is dropped.
  const md = ['| a | b |', '|---|---|', '| 1 | 2 | 3 |'].join('\n');
  assertGrid(md, 3, 'ragged row');
});

test('a short row is padded instead of shifting the next column', () => {
  const md = ['| a | b | c |', '|---|---|---|', '| 1 | 2 |'].join('\n');
  const html = renderMarkdown(md);
  assertGrid(md, 3, 'short row');
  assert.deepEqual(cells(html, 'td'), ['1', '2', '']);
});

test('escaped pipes stay inside one cell', () => {
  const md = ['| 表达式 | 说明 |', '|---|---|', '| a \\| b | 或 |'].join('\n');
  const html = renderMarkdown(md);
  assertGrid(md, 2, 'escaped pipe');
  assert.deepEqual(cells(html, 'td'), ['a | b', '或']);
});

test('inline markdown inside cells still works', () => {
  const md = ['| | A | B |', '|---|---|---|', '| x | **粗** | `code` |'].join('\n');
  const html = renderMarkdown(md);
  assertGrid(md, 3, 'inline markdown');
  assert.match(html, /<strong>粗<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
});
