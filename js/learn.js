/**
 * Leçons courtes et cahier d'exercices pour Atelier Logique v3.
 * Une idée à la fois, puis « essaie dans l'outil ».
 */

const LESSONS = [
  {
    id: 'fleche',
    title: 'La flèche',
    body: [
      'P → Q se lit : si P est vrai, alors Q l’est aussi.',
      'Ça ne dit pas que P est vrai. Et ça ne dit pas que P cause Q. C’est juste un lien : quand P arrive, Q arrive aussi.',
      'Une surprise : si P est faux, P → Q est vrai. Comme une promesse qu’on n’a pas eu à tenir.',
    ],
    example: 'P → Q',
    try: { tab: 'table', formula: 'P → Q' },
  },
  {
    id: 'ou',
    title: 'Le « ou »',
    body: [
      'En logique, « P ou Q » veut dire : au moins un des deux est vrai.',
      'Les deux peuvent être vrais en même temps. Ce n’est pas un choix obligatoire du genre « l’un ou l’autre, pas les deux ».',
    ],
    example: 'P ∨ Q',
    try: { tab: 'table', formula: 'P ∨ Q' },
  },
  {
    id: 'validite-verite',
    title: 'Validité ≠ vérité',
    body: [
      'Un argument valide, ce n’est pas un argument dont tout est vrai. C’est un argument où, si les prémisses sont vraies, la conclusion l’est forcément.',
      'On peut raisonner juste à partir d’idées fausses : le lien tient, les faits non. Exemple : si les chats parlent, ils font des discours. Les chats parlent. Donc ils font des discours. Le raisonnement est valide, mais la deuxième prémisse est fausse.',
    ],
    example: 'P → Q, P  ∴  Q',
    try: { tab: 'validite', premises: 'P → Q\nP', conclusion: 'Q' },
  },
  {
    id: 'sophismes',
    title: 'Les sophismes',
    body: [
      'Un sophisme, c’est un raisonnement qui a l’air juste, mais qui ne l’est pas.',
      'Le plus classique : si P alors Q, or Q est vrai, donc P. Attention : Q peut être vrai pour une autre raison que P.',
    ],
    example: 'P → Q, Q  ∴  P',
    try: { tab: 'validite', premises: 'P → Q\nQ', conclusion: 'P' },
  },
  {
    id: 'toujours',
    title: 'Toujours, jamais, ou ça dépend',
    body: [
      'Une tautologie est toujours vraie, peu importe P et Q. Exemple : P ou pas P.',
      'Une contradiction est toujours fausse : P et pas P.',
      'Le reste est contingent : parfois vrai, parfois faux. Ça dépend des valeurs.',
    ],
    example: 'P ∨ ¬P',
    try: { tab: 'table', formula: 'P ∨ ¬P' },
  },
];

const EXERCISES = [
  {
    id: 'e1',
    kind: 'validity',
    title: 'Est-ce valide ?',
    prompt: 'Prémisses : P → Q, et P. Conclusion : Q. L’argument est-il valide ?',
    premises: ['P → Q', 'P'],
    conclusion: 'Q',
    options: [
      { id: 'yes', label: 'Oui, il est valide' },
      { id: 'no', label: 'Non, il n’est pas valide' },
    ],
    answer: 'yes',
    explain: 'C’est le modus ponens : si P alors Q, et P est vrai, donc Q est vrai.',
  },
  {
    id: 'e2',
    kind: 'validity',
    title: 'Est-ce valide ?',
    prompt: 'Prémisses : P → Q, et Q. Conclusion : P. L’argument est-il valide ?',
    premises: ['P → Q', 'Q'],
    conclusion: 'P',
    options: [
      { id: 'yes', label: 'Oui, il est valide' },
      { id: 'no', label: 'Non, il n’est pas valide' },
    ],
    answer: 'no',
    explain: 'C’est l’affirmation du conséquent. Q peut être vrai pour une autre raison que P.',
  },
  {
    id: 'e3',
    kind: 'form',
    title: 'Quel est ce raisonnement ?',
    prompt: 'Prémisses : P → Q, et ¬Q. Conclusion : ¬P. Comment s’appelle cette forme ?',
    premises: ['P → Q', '¬Q'],
    conclusion: '¬P',
    options: [
      { id: 'modus-ponens', label: 'Modus ponens' },
      { id: 'modus-tollens', label: 'Modus tollens' },
      { id: 'affirmation-consequent', label: 'Affirmation du conséquent' },
    ],
    answer: 'modus-tollens',
    explain: 'Si P alors Q, et Q est faux : alors P est faux. C’est le modus tollens.',
  },
  {
    id: 'e4',
    kind: 'kind',
    title: 'Toujours, jamais, ou ça dépend ?',
    prompt: 'La formule P ∨ ¬P est…',
    formula: 'P ∨ ¬P',
    options: [
      { id: 'tautologie', label: 'Toujours vraie (tautologie)' },
      { id: 'contradiction', label: 'Toujours fausse (contradiction)' },
      { id: 'contingente', label: 'Parfois vraie, parfois fausse' },
    ],
    answer: 'tautologie',
    explain: 'P ou pas P : l’un des deux est forcément vrai. C’est une tautologie.',
  },
  {
    id: 'e5',
    kind: 'kind',
    title: 'Toujours, jamais, ou ça dépend ?',
    prompt: 'La formule P ∧ ¬P est…',
    formula: 'P ∧ ¬P',
    options: [
      { id: 'tautologie', label: 'Toujours vraie (tautologie)' },
      { id: 'contradiction', label: 'Toujours fausse (contradiction)' },
      { id: 'contingente', label: 'Parfois vraie, parfois fausse' },
    ],
    answer: 'contradiction',
    explain: 'P et pas P en même temps, c’est impossible. C’est une contradiction.',
  },
  {
    id: 'e6',
    kind: 'kind',
    title: 'Toujours, jamais, ou ça dépend ?',
    prompt: 'La formule P → Q est…',
    formula: 'P → Q',
    options: [
      { id: 'tautologie', label: 'Toujours vraie (tautologie)' },
      { id: 'contradiction', label: 'Toujours fausse (contradiction)' },
      { id: 'contingente', label: 'Parfois vraie, parfois fausse' },
    ],
    answer: 'contingente',
    explain: 'Si P est vrai et Q est faux, la flèche est fausse. Sinon elle peut être vraie. Ça dépend.',
  },
  {
    id: 'e7',
    kind: 'validity',
    title: 'Est-ce valide ?',
    prompt: 'Prémisses : P ∨ Q, et ¬P. Conclusion : Q. L’argument est-il valide ?',
    premises: ['P ∨ Q', '¬P'],
    conclusion: 'Q',
    options: [
      { id: 'yes', label: 'Oui, il est valide' },
      { id: 'no', label: 'Non, il n’est pas valide' },
    ],
    answer: 'yes',
    explain: 'P ou Q, et ce n’est pas P : alors c’est Q. C’est le syllogisme disjonctif.',
  },
  {
    id: 'e8',
    kind: 'form',
    title: 'Quel est ce raisonnement ?',
    prompt: 'Prémisses : P → Q, et ¬P. Conclusion : ¬Q. Comment s’appelle cette forme ?',
    premises: ['P → Q', '¬P'],
    conclusion: '¬Q',
    options: [
      { id: 'modus-tollens', label: 'Modus tollens' },
      { id: 'negation-antecedent', label: 'Négation de l’antécédent' },
      { id: 'syllogisme-disjonctif', label: 'Syllogisme disjonctif' },
    ],
    answer: 'negation-antecedent',
    explain: 'Ce n’est pas parce que P est faux que Q l’est aussi. C’est un sophisme : la négation de l’antécédent.',
  },
  {
    id: 'e9',
    kind: 'phrase',
    title: 'Phrase → formule',
    prompt: '« S’il pleut, alors la rue est mouillée. » Quelle formule convient, si P = « il pleut » et Q = « la rue est mouillée » ?',
    sentence: 'S’il pleut, alors la rue est mouillée.',
    options: [
      { id: '(P → Q)', label: 'P → Q' },
      { id: '(P ∧ Q)', label: 'P ∧ Q' },
      { id: '(P ∨ Q)', label: 'P ∨ Q' },
    ],
    answer: '(P → Q)',
    explain: '« Si … alors … » devient une flèche : P → Q.',
  },
  {
    id: 'e10',
    kind: 'idea',
    title: 'Validité et vérité',
    prompt: 'Si un argument est valide, est-ce que ses prémisses sont forcément vraies ?',
    options: [
      { id: 'yes', label: 'Oui, valide veut dire que tout est vrai' },
      { id: 'no', label: 'Non, valide parle du lien, pas des faits' },
    ],
    answer: 'no',
    explain: 'La validité, c’est le lien entre prémisses et conclusion. Les prémisses peuvent être fausses.',
  },
];

const LEARN_KEY = 'logic-lab-learn-v3';

function emptyProgress() {
  return { v: 3, lessonsSeen: [], lastLesson: LESSONS[0].id, exercises: {} };
}

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(LEARN_KEY) || 'null');
    if (!raw || raw.v !== 3) return emptyProgress();
    return {
      v: 3,
      lessonsSeen: Array.isArray(raw.lessonsSeen) ? raw.lessonsSeen : [],
      lastLesson: raw.lastLesson || LESSONS[0].id,
      exercises: raw.exercises && typeof raw.exercises === 'object' ? raw.exercises : {},
    };
  } catch {
    return emptyProgress();
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(LEARN_KEY, JSON.stringify(progress));
  } catch {
    /* quota or private mode */
  }
}

function gradeExercise(ex, choice) {
  return choice === ex.answer;
}

function exerciseStats(progress) {
  const done = EXERCISES.filter((e) => progress.exercises[e.id]?.done).length;
  const correct = EXERCISES.filter((e) => progress.exercises[e.id]?.correct).length;
  return { done, correct, total: EXERCISES.length };
}

const Learn = {
  LESSONS,
  EXERCISES,
  LEARN_KEY,
  loadProgress,
  saveProgress,
  emptyProgress,
  gradeExercise,
  exerciseStats,
};

if (typeof globalThis !== 'undefined') {
  globalThis.Learn = Learn;
}

export {
  LESSONS,
  EXERCISES,
  LEARN_KEY,
  loadProgress,
  saveProgress,
  emptyProgress,
  gradeExercise,
  exerciseStats,
  Learn,
};
