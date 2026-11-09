import assert from 'node:assert/strict';
import {
  parseFormula,
  formulaToString,
  evalAst,
  truthTable,
  checkValidity,
  analyzeClaim,
} from '../js/logic.js';

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

test('parse modus ponens pieces', () => {
  const imp = parseFormula('P -> Q');
  assert.equal(imp.type, 'IMP');
  assert.equal(formulaToString(imp), '(P → Q)');
  assert.equal(parseFormula('¬P').type, 'NOT');
});

test('ASCII operators normalize', () => {
  const a = parseFormula('~P & Q | R');
  assert.equal(a.type, 'OR');
  const b = parseFormula('P <-> Q');
  assert.equal(b.type, 'IFF');
});

test('eval implication', () => {
  const ast = parseFormula('P → Q');
  assert.equal(evalAst(ast, { P: true, Q: false }), false);
  assert.equal(evalAst(ast, { P: false, Q: false }), true);
});

test('tautology P ∨ ¬P', () => {
  const t = truthTable('P | ~P');
  assert.equal(t.kind, 'tautologie');
  assert.equal(t.rows.length, 2);
});

test('contradiction P ∧ ¬P', () => {
  const t = truthTable('P & !P');
  assert.equal(t.kind, 'contradiction');
});

test('contingent P → Q', () => {
  const t = truthTable('P → Q');
  assert.equal(t.kind, 'contingente');
  assert.equal(t.rows.length, 4);
});

test('valid modus ponens', () => {
  const r = checkValidity(['P → Q', 'P'], 'Q');
  assert.equal(r.valid, true);
  assert.equal(r.form?.id, 'modus-ponens');
});

test('valid modus tollens', () => {
  const r = checkValidity(['P → Q', '¬Q'], '¬P');
  assert.equal(r.valid, true);
  assert.equal(r.form?.id, 'modus-tollens');
});

test('valid hypothetical syllogism', () => {
  const r = checkValidity(['P → Q', 'Q → R'], 'P → R');
  assert.equal(r.valid, true);
  assert.equal(r.form?.id, 'syllogisme-hypothetique');
});

test('valid disjunctive syllogism', () => {
  const r = checkValidity(['P ∨ Q', '¬P'], 'Q');
  assert.equal(r.valid, true);
  assert.equal(r.form?.id, 'syllogisme-disjonctif');
});

test('fallacy affirming the consequent', () => {
  const r = checkValidity(['P → Q', 'Q'], 'P');
  assert.equal(r.valid, false);
  assert.ok(r.counterexample);
  assert.equal(r.form?.id, 'affirmation-consequent');
  assert.equal(r.form?.kind, 'fallacy');
});

test('fallacy denying the antecedent', () => {
  const r = checkValidity(['P → Q', '¬P'], '¬Q');
  assert.equal(r.valid, false);
  assert.equal(r.form?.id, 'negation-antecedent');
});

test('parse error is gentle', () => {
  assert.throws(() => parseFormula('P →'), (e) => e.code === 'PARSE');
  assert.throws(() => truthTable(''), (e) => e.code === 'PARSE');
});

test('analyze claim with keywords', () => {
  const a = analyzeClaim('Ils nous cachent toujours la vérité, c’est prouvé.');
  assert.ok(a.hints.length >= 2);
  assert.equal(a.questions.length, 6);
});

test('subformula columns present', () => {
  const t = truthTable('(P → Q) ∧ P');
  assert.ok(t.columns.some((c) => c.includes('→')));
  assert.ok(t.columns.includes('P'));
  assert.ok(t.columns.includes('Q'));
});

console.log(`\n${passed} logic tests passed`);
