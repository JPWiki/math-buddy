import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, checkAnswer } from '../js/solver.js';
import { Q } from '../js/rational.js';
import { TOPICS } from '../js/practice.js';

const answer = (p) => solve(p).answer.q;

test('whole numbers and order of operations', () => {
  assert.ok(answer('347 + 285').eq(Q.int(632)));
  assert.ok(answer('1000 - 1').eq(Q.int(999)));
  assert.ok(answer('236 x 45').eq(Q.int(10620)));
  assert.ok(answer('2 + 3 × (8 − 2)').eq(Q.int(20)));
  assert.ok(answer('2^5').eq(Q.int(32)));
  assert.ok(answer('-3 - 8').eq(Q.int(-11)));
});

test('fractions, decimals and percents', () => {
  assert.ok(answer('3/4 + 1/6').eq(new Q(11, 12)));
  assert.ok(answer('2 1/3 + 3/4').eq(new Q(37, 12)));
  assert.ok(answer('3/4 ÷ 2/5').eq(new Q(15, 8)));
  assert.ok(answer('0.1 + 0.2').eq(new Q(3, 10)));
  assert.ok(answer('7.5 ÷ 0.25').eq(Q.int(30)));
  assert.ok(answer('35% of 60').eq(Q.int(21)));
});

test('equations and missing numbers', () => {
  assert.ok(answer('3x + 5 = 20').eq(Q.int(5)));
  assert.ok(answer('2(x + 3) = 4x - 2').eq(Q.int(4)));
  assert.ok(answer('x/3 + 2 = 5').eq(Q.int(9)));
  assert.ok(answer('? × 6 = 42').eq(Q.int(7)));
  assert.equal(solve('x + 1 = x + 2').answer.special, 'none');
  assert.equal(solve('5 + 2 = 8').answer.truth, false);
});

test('kid-friendly errors', () => {
  assert.throws(() => solve('1/0'), /divide by zero/);
  assert.throws(() => solve('apples + 3'), /don't understand/);
  assert.throws(() => solve('(2 + 3'), /never closed/);
});

test('answer checking accepts equivalent forms', () => {
  const q = new Q(5, 4);
  for (const a of ['5/4', '1 1/4', '1.25', '10/8']) assert.ok(checkAnswer(a, q).ok, a);
  assert.ok(!checkAnswer('1.2', q).ok);
  assert.ok(checkAnswer('x = 5', Q.int(5)).ok);
  assert.ok(checkAnswer('3 R 2', new Q(17, 5), { whole: 3, rem: 2 }).ok);
});

test('every practice topic produces solvable problems', () => {
  for (const t of TOPICS) {
    for (let lv = 0; lv < 3; lv++) {
      for (let i = 0; i < 100; i++) {
        const p = t.steps[lv]();
        assert.ok(solve(p).answer.q, `${t.id} ${lv}: ${p}`);
      }
    }
  }
});
