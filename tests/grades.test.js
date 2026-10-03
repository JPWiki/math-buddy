import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOPICS, GRADES, tierFor, inGrade, makeRound, LEVEL_STARS } from '../js/practice.js';
import { solve } from '../js/solver.js';
import { createStore, readBackup, dayKey } from '../js/store.js';

test('every topic tier makes problems the solver can answer', () => {
  for (const t of TOPICS) {
    for (let tier = 0; tier < t.steps.length; tier++) {
      for (let i = 0; i < 60; i++) {
        const p = t.steps[tier]();
        assert.ok(solve(p).answer.q, `${t.id} tier ${tier}: ${p}`);
      }
    }
  }
});

test('each grade has topics, and Easy/Medium/Hard always differ', () => {
  for (const g of GRADES) {
    const topics = TOPICS.filter((t) => inGrade(t, g));
    assert.ok(topics.length >= 3, `grade ${g}`);
    for (const t of topics) {
      const [e, m, h] = [0, 1, 2].map((lv) => tierFor(t, g, lv));
      assert.ok(e < m && m < h, `${t.id} class ${g}: ${e} ${m} ${h}`);
      assert.ok(h < t.steps.length, `${t.id} class ${g} has a step for Hard`);
    }
  }
  // The same topic and level gets harder as the grade goes up.
  const add = TOPICS.find((t) => t.id === 'add');
  assert.ok(tierFor(add, 3, 0) > tierFor(add, 1, 0));
  assert.deepEqual(LEVEL_STARS, [1, 2, 3]);
});

test('a round uses the grade', () => {
  const round = makeRound('add', 0, 10, () => true, 1);
  for (const p of round) assert.ok(solve(p).answer.q.valueOf() <= 10, p);
});

test('grade and daily practice are kept and travel in backups', () => {
  const s = createStore(null);
  const id = s.addProfile('Maya');
  s.setGrade(id, 5);
  s.recordPractice('times', { firstTry: true, right: true });
  s.recordPractice('times', { firstTry: false, right: true });
  assert.equal(s.current().grade, 5);
  assert.equal(s.get().days[dayKey()], 2);
  const back = readBackup(JSON.stringify(s.exportBackup('1.6.0')));
  assert.equal(back.profiles[0].grade, 5);
  assert.equal(back.profiles[0].data.days[dayKey()], 2);
  s.setGrade(id, 12);
  assert.equal(s.current().grade, null, 'only grades 1-8');
});
