import assert from 'node:assert/strict';
import { checkValidity, truthTable, phraseToFormula } from '../js/logic.js';
import { LESSONS, EXERCISES, gradeExercise, emptyProgress, exerciseStats } from '../js/learn.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok  - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

test('five short lessons, each with essaie dans l’outil', () => {
  assert.equal(LESSONS.length, 5);
  const ids = LESSONS.map((l) => l.id);
  assert.deepEqual(ids, ['fleche', 'ou', 'validite-verite', 'sophismes', 'toujours']);
  for (const l of LESSONS) {
    assert.ok(l.title);
    assert.ok(l.body.length >= 2);
    assert.ok(l.try && l.try.tab);
  }
});

test('lesson try-targets are valid for the engine', () => {
  for (const l of LESSONS) {
    if (l.try.tab === 'table') {
      const t = truthTable(l.try.formula);
      assert.ok(t.kind);
    } else if (l.try.tab === 'validite') {
      const r = checkValidity(l.try.premises.split(/\n/), l.try.conclusion);
      assert.equal(typeof r.valid, 'boolean');
    } else {
      throw new Error(`unexpected tab ${l.try.tab} in ${l.id}`);
    }
  }
});

test('each exercise answer matches the engine', () => {
  for (const ex of EXERCISES) {
    if (ex.kind === 'validity') {
      const r = checkValidity(ex.premises, ex.conclusion);
      assert.equal(r.valid, ex.answer === 'yes', `${ex.id} validity`);
    } else if (ex.kind === 'form') {
      const r = checkValidity(ex.premises, ex.conclusion);
      assert.equal(r.form?.id, ex.answer, `${ex.id} form`);
    } else if (ex.kind === 'kind') {
      assert.equal(truthTable(ex.formula).kind, ex.answer, `${ex.id} kind`);
    } else if (ex.kind === 'phrase') {
      assert.equal(phraseToFormula(ex.sentence).pretty, ex.answer, `${ex.id} phrase`);
    } else if (ex.kind === 'idea') {
      assert.equal(ex.answer, 'no');
    } else {
      throw new Error(`unknown kind ${ex.kind}`);
    }
    assert.ok(ex.options.some((o) => o.id === ex.answer), `${ex.id} answer in options`);
  }
});

test('gradeExercise and stats', () => {
  const ex = EXERCISES[0];
  assert.equal(gradeExercise(ex, ex.answer), true);
  assert.equal(gradeExercise(ex, 'no'), false);
  const p = emptyProgress();
  assert.deepEqual(exerciseStats(p), { done: 0, correct: 0, total: EXERCISES.length });
  p.exercises.e1 = { done: true, correct: true, choice: 'yes' };
  p.exercises.e2 = { done: true, correct: false, choice: 'yes' };
  const s = exerciseStats(p);
  assert.equal(s.done, 2);
  assert.equal(s.correct, 1);
  assert.equal(s.total, 10);
});

console.log(`\n${passed} learn tests passed`);
