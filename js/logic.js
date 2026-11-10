/**
 * Moteur de logique propositionnelle pour Atelier Logique.
 * Parse, évalue, table de vérité, validité d'argument, formes classiques,
 * traduction phrase → formule.
 */

const OPS = {
  NOT: '¬',
  AND: '∧',
  OR: '∨',
  IMP: '→',
  IFF: '↔',
};

/** Limite de mot qui tient compte des lettres accentuées (pas le \\b ASCII). */
function wordRe(alts) {
  const inner = alts.join('|');
  return new RegExp(`(?<![\\p{L}\\p{N}_])(${inner})(?![\\p{L}\\p{N}_])`, 'iu');
}

function tokenize(input) {
  let s = String(input || '');
  s = s.replace(/[’‘]/g, "'");
  s = s.replace(/\bs'il\b/gi, 'si il');
  s = s
    .replace(/\u00ac/g, '¬')
    .replace(/\u2227/g, '∧')
    .replace(/\u2228/g, '∨')
    .replace(/\u2192/g, '→')
    .replace(/\u2194/g, '↔')
    .replace(/\u2283/g, '⊃')
    .replace(/⊃/g, ' → ')
    .replace(/<->|<=>|↔/g, ' ↔ ')
    .replace(/->|=>|→/g, ' → ')
    .replace(/&&|&|∧/g, ' ∧ ')
    .replace(/\|\||\|/g, ' ∨ ')
    .replace(/!|~|¬/g, ' ¬ ')
    .replace(/\bsi\b/gi, ' ')
    .replace(/\balors\b/gi, ' → ')
    .replace(/\bet\b/gi, ' ∧ ')
    .replace(/\bou\b/gi, ' ∨ ')
    .replace(/\bnon\b/gi, ' ¬ ')
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
      const err = new Error(unknownSymbolMessage(t));
      err.code = 'PARSE';
      throw err;
    }
  }
  return tokens;
}

function unknownSymbolMessage(t) {
  const hints = {
    '⊃': 'Utilise → (ou le mot « alors ») pour l’implication.',
    '≡': 'Utilise ↔ pour « si et seulement si ».',
    '∴': 'Le donc (∴) se met entre les prémisses et la conclusion, pas dans une formule.',
  };
  if (hints[t]) return `Symbole « ${t} » : ${hints[t]}`;
  if (/^[A-Za-zÀ-ÿ']+$/i.test(t)) {
    return `Je ne reconnais pas « ${t} ». Pour une phrase, essaie « si … alors », « et », « ou » ou « non ». Pour une formule, utilise ¬ ∧ ∨ → ↔.`;
  }
  return `Symbole inconnu : « ${t} ». Tu peux écrire ¬ ∧ ∨ → ↔, ou les mots « non », « et », « ou », « si … alors ».`;
}

function parseFormula(input) {
  const tokens = tokenize(input);
  if (!tokens.length) {
    const err = new Error('Écris une formule (ex. P → Q) ou une petite phrase (ex. si P alors Q).');
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
      expect('RP', 'Il manque une parenthèse fermante.');
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
    const leftover = tokens.slice(i).map((t) => t.value || t.type).join(' ');
    const err = new Error(
      leftover && /[A-Za-zÀ-ÿ]/.test(leftover)
        ? 'Texte en trop après la formule. Si tu écris en français, utilise « si … alors », « et », « ou » ou « non ».'
        : 'Texte en trop après la formule.',
    );
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
      env[vars[i]] = ((mask >> (n - 1 - i)) & 1) === 0;
    }
    rows.push(env);
  }
  return rows;
}

function truthTable(input) {
  const ast = typeof input === 'object' && input && input.type
    ? input
    : parseFormula(input);
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

function describeAssignment(premises, conclAst, conclPretty, env) {
  return {
    env,
    premises: premises.map((p) => ({
      pretty: p.pretty,
      value: evalAst(p.ast, env),
    })),
    conclusion: {
      pretty: conclPretty,
      value: evalAst(conclAst, env),
    },
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
  let steps = null;
  let valid = true;
  for (const env of allAssignments(vars)) {
    const allPremTrue = cleaned.every((p) => evalAst(p.ast, env));
    if (allPremTrue && !evalAst(conclAst, env)) {
      valid = false;
      counterexample = env;
      steps = describeAssignment(cleaned, conclAst, conclPretty, env);
      break;
    }
  }

  const form = detectForm(cleaned.map((p) => p.ast), conclAst);

  return {
    valid,
    counterexample,
    steps,
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

const FORM_GLOSS = {
  'modus-ponens': 'Si P alors Q, et P est vrai : alors Q est vrai.',
  'modus-tollens': 'Si P alors Q, et Q est faux : alors P est faux.',
  'syllogisme-hypothetique': 'Si P mène à Q et Q mène à R, alors P mène à R.',
  'syllogisme-disjonctif': 'P ou Q. Pas l’un : donc l’autre.',
  'affirmation-consequent': 'Erreur : ce n’est pas parce que Q est vrai que P l’est aussi.',
  'negation-antecedent': 'Erreur : ce n’est pas parce que P est faux que Q l’est aussi.',
};

function detectForm(premises, conclusion) {
  // Modus ponens: P→Q, P ⊢ Q
  if (premises.length === 2) {
    const [a, b] = premises;
    for (const [imp, ant] of [[a, b], [b, a]]) {
      if (isImp(imp) && same(imp.left, ant) && same(imp.right, conclusion)) {
        return { id: 'modus-ponens', name: 'Modus ponens', kind: 'valid',
          tip: 'Si P implique Q, et que P est vrai, alors Q est vrai.',
          gloss: FORM_GLOSS['modus-ponens'] };
      }
      // Modus tollens: P→Q, ¬Q ⊢ ¬P
      if (isImp(imp) && isNot(ant) && same(imp.right, ant.arg)
          && isNot(conclusion) && same(imp.left, conclusion.arg)) {
        return { id: 'modus-tollens', name: 'Modus tollens', kind: 'valid',
          tip: 'Si P implique Q, et que Q est faux, alors P est faux.',
          gloss: FORM_GLOSS['modus-tollens'] };
      }
      // Affirmation du conséquent: P→Q, Q ⊢ P (fallacy)
      if (isImp(imp) && same(imp.right, ant) && same(imp.left, conclusion)) {
        return { id: 'affirmation-consequent', name: 'Affirmation du conséquent', kind: 'fallacy',
          tip: 'Ce n’est pas valide : Q peut être vrai pour une autre raison que P.',
          gloss: FORM_GLOSS['affirmation-consequent'] };
      }
      // Négation de l'antécédent: P→Q, ¬P ⊢ ¬Q (fallacy)
      if (isImp(imp) && isNot(ant) && same(imp.left, ant.arg)
          && isNot(conclusion) && same(imp.right, conclusion.arg)) {
        return { id: 'negation-antecedent', name: 'Négation de l’antécédent', kind: 'fallacy',
          tip: 'Ce n’est pas valide : sans P, Q peut quand même être vrai autrement.',
          gloss: FORM_GLOSS['negation-antecedent'] };
      }
      // Syllogisme disjonctif: P∨Q, ¬P ⊢ Q
      if (isOr(imp) && isNot(ant)) {
        if (same(imp.left, ant.arg) && same(imp.right, conclusion)) {
          return { id: 'syllogisme-disjonctif', name: 'Syllogisme disjonctif', kind: 'valid',
            tip: 'P ou Q. Pas P. Donc Q.',
            gloss: FORM_GLOSS['syllogisme-disjonctif'] };
        }
        if (same(imp.right, ant.arg) && same(imp.left, conclusion)) {
          return { id: 'syllogisme-disjonctif', name: 'Syllogisme disjonctif', kind: 'valid',
            tip: 'P ou Q. Pas Q. Donc P.',
            gloss: FORM_GLOSS['syllogisme-disjonctif'] };
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
          tip: 'Si P implique Q et Q implique R, alors P implique R.',
          gloss: FORM_GLOSS['syllogisme-hypothetique'] };
      }
      if (same(b.right, a.left) && same(b.left, conclusion.left) && same(a.right, conclusion.right)) {
        return { id: 'syllogisme-hypothetique', name: 'Syllogisme hypothétique', kind: 'valid',
          tip: 'Si P implique Q et Q implique R, alors P implique R.',
          gloss: FORM_GLOSS['syllogisme-hypothetique'] };
      }
    }
  }
  return null;
}

const GLOSSARY = [
  { id: 'valide', term: 'Argument valide', gloss: 'Si les prémisses sont vraies, la conclusion est forcément vraie.' },
  { id: 'non-valide', term: 'Argument non valide', gloss: 'On peut trouver un cas où les prémisses sont vraies et la conclusion fausse.' },
  { id: 'premisse', term: 'Prémisse', gloss: 'Une idée qu’on suppose vraie pour commencer le raisonnement.' },
  { id: 'conclusion', term: 'Conclusion', gloss: 'Ce qu’on veut déduire à partir des prémisses.' },
  { id: 'contre-exemple', term: 'Contre-exemple', gloss: 'Un cas précis qui montre que l’argument ne tient pas.' },
  { id: 'modus-ponens', term: 'Modus ponens', gloss: FORM_GLOSS['modus-ponens'] },
  { id: 'modus-tollens', term: 'Modus tollens', gloss: FORM_GLOSS['modus-tollens'] },
  { id: 'syllogisme-hypothetique', term: 'Syllogisme hypothétique', gloss: FORM_GLOSS['syllogisme-hypothetique'] },
  { id: 'syllogisme-disjonctif', term: 'Syllogisme disjonctif', gloss: FORM_GLOSS['syllogisme-disjonctif'] },
  { id: 'affirmation-consequent', term: 'Affirmation du conséquent', gloss: FORM_GLOSS['affirmation-consequent'] },
  { id: 'negation-antecedent', term: 'Négation de l’antécédent', gloss: FORM_GLOSS['negation-antecedent'] },
  { id: 'tautologie', term: 'Tautologie', gloss: 'Toujours vrai, peu importe les valeurs de P, Q, R…' },
  { id: 'contradiction', term: 'Contradiction', gloss: 'Toujours faux, peu importe les valeurs de P, Q, R…' },
  { id: 'contingente', term: 'Contingente', gloss: 'Parfois vrai, parfois faux : ça dépend des valeurs.' },
  { id: 'table', term: 'Table de vérité', gloss: 'Toutes les combinaisons vrai/faux, pour voir ce qui arrive à la formule.' },
];

const KIND_GLOSS = {
  tautologie: GLOSSARY.find((g) => g.id === 'tautologie').gloss,
  contradiction: GLOSSARY.find((g) => g.id === 'contradiction').gloss,
  contingente: GLOSSARY.find((g) => g.id === 'contingente').gloss,
};

/** Analyse d'affirmation : checklist template + indices mots-clés. */
const KEYWORD_HINTS = [
  { re: wordRe(['tous', 'toutes', 'toujours', 'jamais', 'aucun', 'aucune', 'partout']), hint: 'Mot absolu (« tous / toujours / jamais ») : une seule exception suffit souvent à falsifier.' },
  { re: wordRe(['ils nous', 'on nous cache', 'on nous cache', 'secret', 'complot', 'élite']), hint: 'Attention au « on » ou « ils » vague : qui exactement ? Quelle preuve concrète ?' },
  { re: wordRe(['prouvé', 'preuve', 'certain', 'évident', 'évidemment']), hint: '« Prouvé » : prouvé par qui, avec quelle méthode, publiée où ?' },
  { re: wordRe(['cause', 'provoque', 'à cause de', 'responsable']), hint: 'Cause ou simple corrélation ? Y a-t-il un tiers facteur ?' },
  { re: wordRe(['parce que', 'donc', 'puisque']), hint: 'Cherche le saut logique entre la raison donnée et la conclusion.' },
  { re: wordRe(['personne ne', 'tout le monde', 'les gens savent']), hint: 'Généralisation : as-tu un échantillon, ou juste une impression ?' },
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
  const questionGloss = {
    premises: 'Ce qu’on suppose sans le dire.',
    falsify: 'On peut imaginer un fait qui montrerait que c’est faux.',
    circular: 'Répéter la même idée n’est pas une preuve.',
    occam: 'Si une explication plus simple suffit, on commence par elle.',
    evidence: 'D’où ça vient, et est-ce vérifiable ?',
    causality: 'Deux choses ensemble, ce n’est pas forcément l’une qui cause l’autre.',
  };
  for (const q of questions) q.gloss = questionGloss[q.id];
  return { claim, hints, questions };
}

function looksSymbolic(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  return /^[A-Za-z0-9()¬∧∨→↔⊃~\s!&|<>='’\-]+$/.test(s)
    && /[A-Za-z]/.test(s)
    && /[→↔⊃∧∨¬~!&|()=\-]|(?:^|\s)(si|alors|et|ou|non)(?:\s|$)/i.test(s);
}

function splitTop(s, re) {
  const depthAt = new Array(s.length + 1).fill(0);
  let d = 0;
  for (let i = 0; i < s.length; i += 1) {
    depthAt[i] = d;
    if (s[i] === '(') d += 1;
    else if (s[i] === ')') d = Math.max(0, d - 1);
  }
  const parts = [];
  let last = 0;
  const g = new RegExp(re.source, `${re.flags.replace('g', '')}g`);
  const matches = [...s.matchAll(g)];
  for (const m of matches) {
    if (depthAt[m.index] === 0) {
      parts.push(s.slice(last, m.index));
      last = m.index + m[0].length;
    }
  }
  parts.push(s.slice(last));
  return parts.map((p) => p.trim()).filter(Boolean);
}

function reduceBin(nodes, type) {
  return nodes.reduce((left, right) => ({ type, left, right }));
}

function phraseToFormula(text) {
  const claim = String(text || '').trim();
  if (!claim) {
    const err = new Error('Écris une phrase (ex. S’il pleut, alors la rue est mouillée).');
    err.code = 'PARSE';
    throw err;
  }

  if (looksSymbolic(claim)) {
    try {
      const ast = parseFormula(claim);
      const vars = [...collectVars(ast)].sort();
      return {
        ast,
        pretty: formulaToString(ast),
        formula: formulaToString(ast),
        mapping: vars.map((letter) => ({ letter, phrase: letter })),
        source: claim,
        symbolic: true,
      };
    } catch {
      // tombe dans l’analyse en français
    }
  }

  const letters = 'PQRSTUVWXYZ';
  const map = new Map();
  const mapping = [];

  function atom(phrase) {
    const cleaned = String(phrase || '')
      .trim()
      .replace(/^que\s+/i, '')
      .replace(/^[«"]|[»"]$/g, '')
      .replace(/[.,;:!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) {
      const err = new Error('Je n’arrive pas à trouver une proposition dans cette phrase.');
      err.code = 'PARSE';
      throw err;
    }
    const key = cleaned.toLowerCase().replace(/[’']/g, "'");
    if (!map.has(key)) {
      if (mapping.length >= 6) {
        const err = new Error('Trop de propositions (max 6). Coupe la phrase en plus petits bouts.');
        err.code = 'PARSE';
        throw err;
      }
      const letter = letters[mapping.length];
      map.set(key, letter);
      mapping.push({ letter, phrase: cleaned });
    }
    return { type: 'VAR', name: map.get(key) };
  }

  function parseExpr(raw) {
    let s = String(raw || '').trim().replace(/[’']/g, "'");
    s = s.replace(/^\(+/, '').replace(/\)+$/, (tail, offset, whole) => {
      // only strip wrapping parens if balanced
      return whole.startsWith('(') && tail.length ? '' : tail;
    }).trim();
    // unwrap one layer of balanced parens
    if (s.startsWith('(') && s.endsWith(')')) {
      let d = 0;
      let wrap = true;
      for (let i = 0; i < s.length; i += 1) {
        if (s[i] === '(') d += 1;
        if (s[i] === ')') d -= 1;
        if (d === 0 && i < s.length - 1) { wrap = false; break; }
      }
      if (wrap) s = s.slice(1, -1).trim();
    }

    const siAlors = s.match(/^si\s+(.+?)\s*,?\s*alors\s+(.+)$/i);
    if (siAlors) {
      return { type: 'IMP', left: parseExpr(siAlors[1]), right: parseExpr(siAlors[2]) };
    }
    const alors = s.match(/^(.+?)\s*,?\s*alors\s+(.+)$/i);
    if (alors) {
      return { type: 'IMP', left: parseExpr(alors[1]), right: parseExpr(alors[2]) };
    }

    const ouParts = splitTop(s, /\s+ou\s+/i);
    if (ouParts.length > 1) return reduceBin(ouParts.map(parseExpr), 'OR');

    const etParts = splitTop(s, /\s+et(?:\s+que)?\s+/i);
    if (etParts.length > 1) return reduceBin(etParts.map(parseExpr), 'AND');

    const nestPasVrai = s.match(/^il n'est pas vrai que\s+(.+)$/i);
    if (nestPasVrai) return { type: 'NOT', arg: parseExpr(nestPasVrai[1]) };

    const non = s.match(/^(?:non|pas)\s+(.+)$/i);
    if (non) return { type: 'NOT', arg: parseExpr(non[1]) };

    const nePas = s.match(/^(.+?)\s+ne\s+(.+?)\s+pas$/i);
    if (nePas) return { type: 'NOT', arg: atom(`${nePas[1]} ${nePas[2]}`) };

    return atom(s);
  }

  const prepared = claim.replace(/[’']/g, "'").replace(/\bs'il\b/gi, 'si il');
  const ast = parseExpr(prepared);
  return {
    ast,
    pretty: formulaToString(ast),
    formula: formulaToString(ast),
    mapping,
    source: claim,
    symbolic: false,
  };
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
  phraseToFormula,
  describeAssignment,
  wordRe,
  GLOSSARY,
  FORM_GLOSS,
  KIND_GLOSS,
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
  phraseToFormula,
  describeAssignment,
  wordRe,
  GLOSSARY,
  FORM_GLOSS,
  KIND_GLOSS,
  LogicLab,
};
