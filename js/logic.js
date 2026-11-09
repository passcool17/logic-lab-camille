/**
 * Moteur de logique propositionnelle pour Atelier Logique.
 * Parse, évalue, table de vérité, validité d'argument, formes classiques.
 */

const OPS = {
  NOT: '¬',
  AND: '∧',
  OR: '∨',
  IMP: '→',
  IFF: '↔',
};

function tokenize(input) {
  const s = String(input || '')
    .replace(/\u00ac/g, '¬')
    .replace(/\u2227/g, '∧')
    .replace(/\u2228/g, '∨')
    .replace(/\u2192/g, '→')
    .replace(/\u2194/g, '↔')
    .replace(/<->|<=>|↔/g, ' ↔ ')
    .replace(/->|=>|→/g, ' → ')
    .replace(/&&|&|∧/g, ' ∧ ')
    .replace(/\|\||\|/g, ' ∨ ')
    .replace(/~~|!|~|¬/g, ' ¬ ')
    .replace(/[()]/g, (c) => ` ${c} `);
  const raw = s.trim().split(/\s+/).filter(Boolean);
  const tokens = [];
  for (const t of raw) {
    if (/^[A-Za-z][A-Za-z0-9]*$/.test(t)) {
      tokens.push({ type: 'VAR', value: t.toUpperCase() });
    } else if (t === '¬') tokens.push({ type: 'NOT' });
    else if (t === '∧') tokens.push({ type: 'AND' });
    else if (t === '∨') tokens.push({ type: 'OR' });
    else if (t === '→') tokens.push({ type: 'IMP' });
    else if (t === '↔') tokens.push({ type: 'IFF' });
    else if (t === '(') tokens.push({ type: 'LP' });
    else if (t === ')') tokens.push({ type: 'RP' });
    else {
      const err = new Error(`Symbole inconnu : « ${t} ».`);
      err.code = 'PARSE';
      throw err;
    }
  }
  return tokens;
}

function parseFormula(input) {
  const tokens = tokenize(input);
  if (!tokens.length) {
    const err = new Error('Écris une formule (ex. P → Q).');
    err.code = 'PARSE';
    throw err;
  }
  let i = 0;
  function peek() { return tokens[i]; }
  function take(type) {
    const t = tokens[i];
    if (!t || (type && t.type !== type)) return null;
    i += 1;
    return t;
  }
  function expect(type, msg) {
    const t = take(type);
    if (!t) {
      const err = new Error(msg || 'Formule incomplète.');
      err.code = 'PARSE';
      throw err;
    }
    return t;
  }

  // iff → imp → or → and → unary → atom
  function parseIff() {
    let left = parseImp();
    while (peek() && peek().type === 'IFF') {
      take('IFF');
      const right = parseImp();
      left = { type: 'IFF', left, right };
    }
    return left;
  }
  function parseImp() {
    let left = parseOr();
    // implication is right-associative
    if (peek() && peek().type === 'IMP') {
      take('IMP');
      const right = parseImp();
      left = { type: 'IMP', left, right };
    }
    return left;
  }
  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().type === 'OR') {
      take('OR');
      const right = parseAnd();
      left = { type: 'OR', left, right };
    }
    return left;
  }
  function parseAnd() {
    let left = parseUnary();
    while (peek() && peek().type === 'AND') {
      take('AND');
      const right = parseUnary();
      left = { type: 'AND', left, right };
    }
    return left;
  }
  function parseUnary() {
    if (peek() && peek().type === 'NOT') {
      take('NOT');
      return { type: 'NOT', arg: parseUnary() };
    }
    return parseAtom();
  }
  function parseAtom() {
    if (peek() && peek().type === 'LP') {
      take('LP');
      const inner = parseIff();
      expect('RP', 'Il manque une parenthèse fermante.') ;
      return inner;
    }
    const v = take('VAR');
    if (!v) {
      const err = new Error('J’attendais une variable (P, Q, R…) ou une parenthèse.');
      err.code = 'PARSE';
      throw err;
    }
    return { type: 'VAR', name: v.value };
  }

  const ast = parseIff();
  if (i < tokens.length) {
    const err = new Error('Texte en trop après la formule.');
    err.code = 'PARSE';
    throw err;
  }
  return ast;
}

function collectVars(ast, set = new Set()) {
  if (!ast) return set;
  if (ast.type === 'VAR') set.add(ast.name);
  if (ast.left) collectVars(ast.left, set);
  if (ast.right) collectVars(ast.right, set);
  if (ast.arg) collectVars(ast.arg, set);
  return set;
}

function formulaToString(ast) {
  if (!ast) return '';
  switch (ast.type) {
    case 'VAR': return ast.name;
    case 'NOT': {
      const a = ast.arg;
      const needParen = a.type !== 'VAR' && a.type !== 'NOT';
      return needParen ? `¬(${formulaToString(a)})` : `¬${formulaToString(a)}`;
    }
    case 'AND': return `(${formulaToString(ast.left)} ∧ ${formulaToString(ast.right)})`;
    case 'OR': return `(${formulaToString(ast.left)} ∨ ${formulaToString(ast.right)})`;
    case 'IMP': return `(${formulaToString(ast.left)} → ${formulaToString(ast.right)})`;
    case 'IFF': return `(${formulaToString(ast.left)} ↔ ${formulaToString(ast.right)})`;
    default: return '?';
  }
}

function evalAst(ast, env) {
  switch (ast.type) {
    case 'VAR': return !!env[ast.name];
    case 'NOT': return !evalAst(ast.arg, env);
    case 'AND': return evalAst(ast.left, env) && evalAst(ast.right, env);
    case 'OR': return evalAst(ast.left, env) || evalAst(ast.right, env);
    case 'IMP': return !evalAst(ast.left, env) || evalAst(ast.right, env);
    case 'IFF': return evalAst(ast.left, env) === evalAst(ast.right, env);
    default: throw new Error('Nœud inconnu');
  }
}

function subformulas(ast, list = [], seen = new Set()) {
  if (!ast) return list;
  if (ast.left) subformulas(ast.left, list, seen);
  if (ast.right) subformulas(ast.right, list, seen);
  if (ast.arg) subformulas(ast.arg, list, seen);
  if (ast.type !== 'VAR') {
    const key = formulaToString(ast);
    if (!seen.has(key)) {
      seen.add(key);
      list.push({ ast, key });
    }
  }
  return list;
}

function allAssignments(vars) {
  const n = vars.length;
  const rows = [];
  const total = 1 << n;
  for (let mask = 0; mask < total; mask += 1) {
    const env = {};
    for (let i = 0; i < n; i += 1) {
      // conventional: leftmost var varies slowest (P first column top T then F groups)
      env[vars[i]] = ((mask >> (n - 1 - i)) & 1) === 0;
    }
    rows.push(env);
  }
  return rows;
}

function truthTable(input) {
  const ast = parseFormula(input);
  const vars = [...collectVars(ast)].sort();
  if (vars.length === 0) {
    const err = new Error('Il faut au moins une variable.');
    err.code = 'PARSE';
    throw err;
  }
  if (vars.length > 6) {
    const err = new Error('Trop de variables (max 6) pour garder la table lisible.');
    err.code = 'PARSE';
    throw err;
  }
  const subs = subformulas(ast);
  const rows = allAssignments(vars).map((env) => {
    const cells = {};
    for (const v of vars) cells[v] = env[v];
    for (const s of subs) cells[s.key] = evalAst(s.ast, env);
    const value = evalAst(ast, env);
    return { env, cells, value };
  });
  const truths = rows.filter((r) => r.value).length;
  let kind = 'contingente';
  if (truths === rows.length) kind = 'tautologie';
  else if (truths === 0) kind = 'contradiction';
  return {
    ast,
    pretty: formulaToString(ast),
    vars,
    columns: [...vars, ...subs.map((s) => s.key)],
    rows,
    kind,
  };
}

function checkValidity(premiseTexts, conclusionText) {
  const cleaned = [];
  for (const line of premiseTexts) {
    const t = String(line || '').trim();
    if (!t) continue;
    const ast = parseFormula(t);
    cleaned.push({ text: t, ast, pretty: formulaToString(ast) });
  }
  if (!cleaned.length) {
    const err = new Error('Ajoute au moins une prémisse.');
    err.code = 'PARSE';
    throw err;
  }
  const conclAst = parseFormula(conclusionText);
  const conclPretty = formulaToString(conclAst);

  const varSet = new Set();
  for (const p of cleaned) collectVars(p.ast, varSet);
  collectVars(conclAst, varSet);
  const vars = [...varSet].sort();
  if (vars.length > 6) {
    const err = new Error('Trop de variables (max 6).');
    err.code = 'PARSE';
    throw err;
  }

  let counterexample = null;
  let valid = true;
  for (const env of allAssignments(vars)) {
    const allPremTrue = cleaned.every((p) => evalAst(p.ast, env));
    if (allPremTrue && !evalAst(conclAst, env)) {
      valid = false;
      counterexample = env;
      break;
    }
  }

  const form = detectForm(cleaned.map((p) => p.ast), conclAst);

  return {
    valid,
    counterexample,
    vars,
    premises: cleaned,
    conclusion: { ast: conclAst, pretty: conclPretty },
    form,
  };
}

function same(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'VAR') return a.name === b.name;
  if (a.type === 'NOT') return same(a.arg, b.arg);
  return same(a.left, b.left) && same(a.right, b.right);
}

function isImp(ast) { return ast && ast.type === 'IMP'; }
function isNot(ast) { return ast && ast.type === 'NOT'; }
function isOr(ast) { return ast && ast.type === 'OR'; }

function detectForm(premises, conclusion) {
  // Modus ponens: P→Q, P ⊢ Q
  if (premises.length === 2) {
    const [a, b] = premises;
    for (const [imp, ant] of [[a, b], [b, a]]) {
      if (isImp(imp) && same(imp.left, ant) && same(imp.right, conclusion)) {
        return { id: 'modus-ponens', name: 'Modus ponens', kind: 'valid',
          tip: 'Si P implique Q, et que P est vrai, alors Q est vrai.' };
      }
      // Modus tollens: P→Q, ¬Q ⊢ ¬P
      if (isImp(imp) && isNot(ant) && same(imp.right, ant.arg)
          && isNot(conclusion) && same(imp.left, conclusion.arg)) {
        return { id: 'modus-tollens', name: 'Modus tollens', kind: 'valid',
          tip: 'Si P implique Q, et que Q est faux, alors P est faux.' };
      }
      // Affirmation du conséquent: P→Q, Q ⊢ P (fallacy)
      if (isImp(imp) && same(imp.right, ant) && same(imp.left, conclusion)) {
        return { id: 'affirmation-consequent', name: 'Affirmation du conséquent', kind: 'fallacy',
          tip: 'Ce n’est pas valide : Q peut être vrai pour une autre raison que P.' };
      }
      // Négation de l'antécédent: P→Q, ¬P ⊢ ¬Q (fallacy)
      if (isImp(imp) && isNot(ant) && same(imp.left, ant.arg)
          && isNot(conclusion) && same(imp.right, conclusion.arg)) {
        return { id: 'negation-antecedent', name: 'Négation de l’antécédent', kind: 'fallacy',
          tip: 'Ce n’est pas valide : sans P, Q peut quand même être vrai autrement.' };
      }
      // Syllogisme disjonctif: P∨Q, ¬P ⊢ Q
      if (isOr(imp) && isNot(ant)) {
        if (same(imp.left, ant.arg) && same(imp.right, conclusion)) {
          return { id: 'syllogisme-disjonctif', name: 'Syllogisme disjonctif', kind: 'valid',
            tip: 'P ou Q. Pas P. Donc Q.' };
        }
        if (same(imp.right, ant.arg) && same(imp.left, conclusion)) {
          return { id: 'syllogisme-disjonctif', name: 'Syllogisme disjonctif', kind: 'valid',
            tip: 'P ou Q. Pas Q. Donc P.' };
        }
      }
    }
  }
  // Syllogisme hypothétique: P→Q, Q→R ⊢ P→R
  if (premises.length === 2 && isImp(conclusion)) {
    const [a, b] = premises;
    if (isImp(a) && isImp(b)) {
      if (same(a.right, b.left) && same(a.left, conclusion.left) && same(b.right, conclusion.right)) {
        return { id: 'syllogisme-hypothetique', name: 'Syllogisme hypothétique', kind: 'valid',
          tip: 'Si P implique Q et Q implique R, alors P implique R.' };
      }
      if (same(b.right, a.left) && same(b.left, conclusion.left) && same(a.right, conclusion.right)) {
        return { id: 'syllogisme-hypothetique', name: 'Syllogisme hypothétique', kind: 'valid',
          tip: 'Si P implique Q et Q implique R, alors P implique R.' };
      }
    }
  }
  return null;
}

/** Analyse d'affirmation : checklist template + indices mots-clés. */
const KEYWORD_HINTS = [
  { re: /\b(tous|toutes|toujours|jamais|aucun|aucune|partout)\b/i, hint: 'Mot absolu (« tous / toujours / jamais ») : une seule exception suffit souvent à falsifier.' },
  { re: /\b(ils|on nous cache|secret|complot|élite)\b/i, hint: 'Attention au « ils » vague : qui exactement ? Quelle preuve concrète ?' },
  { re: /\b(prouvé|preuve|prouvé|certain|évident|évidemment)\b/i, hint: '« Prouvé » : prouvé par qui, avec quelle méthode, publiée où ?' },
  { re: /\b(cause|provoque|à cause de|responsable)\b/i, hint: 'Cause ou simple corrélation ? Y a-t-il un tiers facteur ?' },
  { re: /\b(parce que|donc|alors|puisque)\b/i, hint: 'Cherche le saut logique entre la raison donnée et la conclusion.' },
  { re: /\b(personne ne|tout le monde|les gens savent)\b/i, hint: 'Généralisation : as-tu un échantillon, ou juste une impression ?' },
];

function analyzeClaim(text) {
  const claim = String(text || '').trim();
  if (!claim) {
    const err = new Error('Écris d’abord une affirmation.');
    err.code = 'PARSE';
    throw err;
  }
  const hints = [];
  for (const k of KEYWORD_HINTS) {
    if (k.re.test(claim)) hints.push(k.hint);
  }
  const questions = [
    { id: 'premises', title: 'Prémisses implicites', prompt: 'Qu’est-ce qu’il faut déjà croire pour que cette affirmation tienne ?' },
    { id: 'falsify', title: 'Falsifiabilité', prompt: 'Qu’est-ce qui la rendrait fausse ? Quel fait suffirait à l’infirmer ?' },
    { id: 'circular', title: 'Circularité', prompt: 'Est-ce que la « preuve » répète juste la conclusion avec d’autres mots ?' },
    { id: 'occam', title: 'Rasoir d’Ockham', prompt: 'Y a-t-il une explication plus simple qui marche aussi bien ?' },
    { id: 'evidence', title: 'Preuves et sources', prompt: 'Quelles preuves existent, et d’où viennent-elles (étude, témoignage, rumeur) ?' },
    { id: 'causality', title: 'Corrélation ou causalité', prompt: 'Si A et B vont ensemble, est-ce que A cause vraiment B ?' },
  ];
  return { claim, hints, questions };
}

// Export for browser and Node
const LogicLab = {
  OPS,
  parseFormula,
  formulaToString,
  evalAst,
  collectVars,
  truthTable,
  checkValidity,
  detectForm,
  analyzeClaim,
  tokenize,
};

if (typeof globalThis !== 'undefined') {
  globalThis.LogicLab = LogicLab;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LogicLab;
}

export {
  OPS,
  parseFormula,
  formulaToString,
  evalAst,
  collectVars,
  truthTable,
  checkValidity,
  detectForm,
  analyzeClaim,
  tokenize,
  LogicLab,
};
