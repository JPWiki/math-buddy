import { test } from 'node:test';
import assert from 'node:assert/strict';
import { longMultiply, longDivide } from '../js/written.js';
import { solve } from '../js/solver.js';

const text = (html) => html.replace(/<[^>]+>/g, '');

test('long multiplication shows each row and carries', () => {
  const r = longMultiply(236, 45);
  assert.equal(r.p, 10620);
  const all = text(r.lines.join(' '));
  assert.match(all, /5 × 6 = 30, write 0 carry 3/);
  assert.match(all, /Row 2 is 9,440/);
  assert.match(all, /1,180 \+ 9,440 = 10,620/);
});

test('long division handles remainders and decimal points', () => {
  const a = longDivide('864', 7);
  assert.equal(a.quot, '123');
  assert.equal(a.rem, 3);
  const b = longDivide('56.35', 7, { extend: 4 });
  assert.equal(b.quot, '8.05');
  assert.ok(b.finished);
  const c = longDivide('10', 4, { extend: 4 });
  assert.equal(c.quot, '2.5');
  const d = longDivide('10', 3, { extend: 4 });
  assert.ok(!d.finished);
});

test('solve shows written working for big multiplication and division', () => {
  for (const p of ['236 × 45', '56.35 ÷ 7', '864 ÷ 7', '7.5 ÷ 0.25']) {
    const html = solve(p).steps[0].lines.join('');
    assert.match(html, /col-work/, p);
  }
});
