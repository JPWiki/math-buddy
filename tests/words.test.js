import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve } from '../js/solver.js';
import { wordProblem } from '../js/practice.js';

const cases = [
  ['6 friends share 24 cookies equally. How many cookies does each friend get?', 4],
  ['Sam had 12 apples. He ate 5. How many apples are left?', 7],
  ['Each box holds 6 crayons. How many crayons are in 7 boxes?', 42],
  ['Tom has 45 stickers. Lily has 28 stickers. How many more stickers does Tom have than Lily?', 17],
  ['Pencils cost $2 each. How many pencils can she buy with $14?', 7],
  ['Jack had 20 marbles. He bought 15 more, then gave away 8. How many marbles does he have now?', 27],
  ['A $40 toy is on sale for 25% off. How much does it cost now?', 30],
  ['Ben has $20. He buys 3 pens that cost $2 each. How much money is left?', 14],
  ['Two thirds of the 24 students walk to school. How many students walk to school?', 16],
  ['A rope is 96 cm long. It is cut into 8 equal pieces. How long is each piece?', 12],
  ['A school bus has 9 rows. Each row seats 4 children. If 30 children are on the bus, how many seats are empty?', 6],
  ['A farmer has three hundred sheep and sells forty-five. How many sheep are left?', 255],
  ['A pizza is cut into 8 slices. Tom eats 3 slices. What fraction of the pizza is left?', 5 / 8],
];

test('reads common word problems', () => {
  for (const [text, want] of cases) {
    const r = solve(text);
    assert.ok(Math.abs(r.answer.q.valueOf() - want) < 1e-9, `${text} -> ${r.answer.q.valueOf()}`);
    assert.equal(r.steps[0].title, 'Turn the words into math');
  }
});

test('says so instead of guessing', () => {
  assert.throws(() => solve('What is the weather like today?'), /couldn't work out this word problem/);
});

test('practice word problems are read correctly', () => {
  for (let lv = 0; lv < 4; lv++) {
    for (let i = 0; i < 300; i++) {
      const { text, answer } = wordProblem(lv);
      assert.ok(Math.abs(solve(text).answer.q.valueOf() - answer) < 1e-9, text);
    }
  }
});
