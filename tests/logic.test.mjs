import assert from 'node:assert/strict';
import {
  parseFormula,
  formulaToString,
  evalAst,
  collectVars,
  truthTable,
  checkValidity,
  analyzeClaim,
  phraseToFormula,
  tokenize,
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
  assert.ok(r.form?.gloss);
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

// --- v2 : corrections ---

test('~~P is double negation ¬¬P', () => {
  const ast = parseFormula('~~P');
  assert.equal(ast.type, 'NOT');
  assert.equal(ast.arg.type, 'NOT');
  assert.equal(ast.arg.arg.type, 'VAR');
  assert.equal(evalAst(ast, { P: true }), true);
  assert.equal(evalAst(ast, { P: false }), false);
  assert.equal(formulaToString(ast), '¬¬P');
});

test('~~~P is triple negation', () => {
  const ast = parseFormula('~~~P');
  assert.equal(ast.type, 'NOT');
  assert.equal(ast.arg.type, 'NOT');
  assert.equal(ast.arg.arg.type, 'NOT');
  assert.equal(evalAst(ast, { P: true }), false);
});

test('!!P and ¬¬P stay double negation', () => {
  assert.equal(formulaToString(parseFormula('!!P')), '¬¬P');
  assert.equal(formulaToString(parseFormula('¬¬P')), '¬¬P');
});

test('Principia ⊃ is implication', () => {
  const ast = parseFormula('P ⊃ Q');
  assert.equal(ast.type, 'IMP');
  assert.equal(formulaToString(ast), '(P → Q)');
});

test('French words: et, ou, non, si…alors', () => {
  assert.equal(parseFormula('P ou Q').type, 'OR');
  assert.equal(parseFormula('P et Q').type, 'AND');
  assert.equal(parseFormula('non P').type, 'NOT');
  const imp = parseFormula('si P alors Q');
  assert.equal(imp.type, 'IMP');
  assert.equal(formulaToString(imp), '(P → Q)');
  const nested = parseFormula('si P et Q alors R');
  assert.equal(formulaToString(nested), '((P ∧ Q) → R)');
});

test('word operators are case-insensitive', () => {
  assert.equal(parseFormula('P OU Q').type, 'OR');
  assert.equal(parseFormula('SI P ALORS Q').type, 'IMP');
});

test('accented keywords match (prouvé, évident, élite)', () => {
  const a = analyzeClaim('C’est prouvé.');
  assert.ok(a.hints.some((h) => /Prouvé/i.test(h)), a.hints.join(' | '));
  const b = analyzeClaim('C’est évident.');
  assert.ok(b.hints.some((h) => /Prouvé/i.test(h)), b.hints.join(' | '));
  const c = analyzeClaim('une élite se cache derrière ça.');
  assert.ok(c.hints.some((h) => /vague|ils|on/i.test(h)), c.hints.join(' | '));
});

test('vaccine sample still gets cause + prouvé', () => {
  const a = analyzeClaim('Le vaccin cause forcément cette maladie, c’est prouvé.');
  assert.ok(a.hints.length >= 2, `hints=${a.hints.length}: ${a.hints.join(' | ')}`);
});

test('bare « ils » and « alors » do not fire on ordinary sentences', () => {
  const a = analyzeClaim('Ils vont à l’école à pied.');
  assert.equal(a.hints.length, 0, a.hints.join(' | '));
  const b = analyzeClaim('Alors on mange, ensuite on joue.');
  assert.equal(b.hints.length, 0, b.hints.join(' | '));
});

test('« ils nous » still flags a vague they', () => {
  const a = analyzeClaim('Ils nous cachent la vérité sur tout.');
  assert.ok(a.hints.some((h) => /vague|ils|on/i.test(h)));
});

test('counterexample steps list V/F for each premise and the conclusion', () => {
  const r = checkValidity(['P → Q', 'Q'], 'P');
  assert.equal(r.valid, false);
  assert.ok(r.steps);
  assert.equal(r.steps.premises.length, 2);
  assert.equal(r.steps.premises[0].value, true);
  assert.equal(r.steps.premises[1].value, true);
  assert.equal(r.steps.conclusion.value, false);
  assert.equal(r.steps.env.P, false);
  assert.equal(r.steps.env.Q, true);
});

test('implication remains right-associative', () => {
  assert.equal(formulaToString(parseFormula('P → Q → R')), '(P → (Q → R))');
});

// --- v2 : phrase → formule ---

test('phrase: S’il pleut, alors la rue est mouillée', () => {
  const p = phraseToFormula('S’il pleut, alors la rue est mouillée');
  assert.equal(p.pretty, '(P → Q)');
  assert.equal(p.mapping.length, 2);
  assert.match(p.mapping[0].phrase, /pleut/i);
  assert.match(p.mapping[1].phrase, /mouill/i);
});

test('phrase: il pleut et il fait froid', () => {
  const p = phraseToFormula('Il pleut et il fait froid');
  assert.equal(p.pretty, '(P ∧ Q)');
  assert.equal(p.mapping.length, 2);
});

test('phrase: il pleut ou il neige', () => {
  const p = phraseToFormula('Il pleut ou il neige');
  assert.equal(p.pretty, '(P ∨ Q)');
});

test('phrase: il ne pleut pas', () => {
  const p = phraseToFormula('Il ne pleut pas');
  assert.equal(p.pretty, '¬P');
  assert.match(p.mapping[0].phrase, /pleut/i);
  assert.equal(evalAst(p.ast, { P: true }), false);
});

test('phrase: si je révise et que je dors bien, alors je réussis', () => {
  const p = phraseToFormula('Si je révise et que je dors bien, alors je réussis');
  assert.equal(p.pretty, '((P ∧ Q) → R)');
  assert.equal(p.mapping.length, 3);
});

test('phrase: symbolic formula still works', () => {
  const p = phraseToFormula('P ⊃ Q');
  assert.equal(p.pretty, '(P → Q)');
  assert.equal(p.symbolic, true);
});

test('phrase empty throws PARSE', () => {
  assert.throws(() => phraseToFormula(''), (e) => e.code === 'PARSE');
});

test('friendly error mentions words or symbols', () => {
  assert.throws(() => parseFormula('P $ Q'), (e) => /∨|ou|symbole/i.test(e.message));
});

console.log(`\n${passed} logic tests passed`);
