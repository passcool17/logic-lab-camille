import {
  truthTable,
  checkValidity,
  analyzeClaim,
  phraseToFormula,
  GLOSSARY,
  KIND_GLOSS,
} from './logic.js?v=ll-v2';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ANALYSER_KEY = 'logic-lab-analyser-v2';

const EXAMPLES = {
  'modus-ponens': {
    premises: 'P → Q\nP',
    conclusion: 'Q',
    label: 'Modus ponens',
  },
  'modus-tollens': {
    premises: 'P → Q\n¬Q',
    conclusion: '¬P',
    label: 'Modus tollens',
  },
  'syll-hyp': {
    premises: 'P → Q\nQ → R',
    conclusion: 'P → R',
    label: 'Syll. hypothétique',
  },
  'syll-disj': {
    premises: 'P ∨ Q\n¬P',
    conclusion: 'Q',
    label: 'Syll. disjonctif',
  },
  'aff-cons': {
    premises: 'P → Q\nQ',
    conclusion: 'P',
    label: 'Aff. du conséquent',
  },
  'neg-ant': {
    premises: 'P → Q\n¬P',
    conclusion: '¬Q',
    label: 'Nég. de l’antécédent',
  },
};

const SYMBOLS = ['¬', '∧', '∨', '→', '↔', '(', ')'];

const PHRASE_EXAMPLES = [
  'S’il pleut, alors la rue est mouillée.',
  'Il pleut et il fait froid.',
  'Il pleut ou il neige.',
  'Il ne pleut pas.',
];

function boolLabel(v) {
  return v ? 'V' : 'F';
}

function envToText(env) {
  return Object.keys(env)
    .sort()
    .map((k) => `${k}=${boolLabel(env[k])}`)
    .join(', ');
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + text + after;
  const pos = start + text.length;
  textarea.focus();
  textarea.setSelectionRange(pos, pos);
}

function showError(el, err) {
  el.hidden = false;
  el.className = 'result bad';
  el.innerHTML = `<p><strong>Oups.</strong> ${escapeHtml(err.message || String(err))}</p>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formBlock(form) {
  if (!form) return '';
  const kindClass = form.kind === 'fallacy' ? 'warn' : 'good';
  let html = `<p class="badge ${kindClass}">${escapeHtml(form.name)}</p>`;
  if (form.gloss) html += `<p class="gloss">${escapeHtml(form.gloss)}</p>`;
  if (form.tip) html += `<p class="tip">${escapeHtml(form.tip)}</p>`;
  return html;
}

function setTab(id) {
  $$('.tab').forEach((btn) => {
    const on = btn.dataset.tab === id;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $$('.panel').forEach((panel) => {
    panel.hidden = panel.id !== `panel-${id}`;
  });
  location.hash = id;
}

function initTabs() {
  $$('.tab').forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });
  const hash = (location.hash || '#validite').slice(1);
  const ok = ['validite', 'table', 'analyser'].includes(hash) ? hash : 'validite';
  setTab(ok);
}

function initIntro() {
  const btn = $('#btn-intro');
  const body = $('#intro-body');
  if (!btn || !body) return;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    body.hidden = open;
    btn.querySelector('.intro-chevron').textContent = open ? 'Pourquoi ?' : 'Fermer';
  });
}

function initGlossary() {
  const dl = $('#glossary-list');
  if (!dl) return;
  dl.innerHTML = GLOSSARY.map((g) => (
    `<dt>${escapeHtml(g.term)}</dt><dd>${escapeHtml(g.gloss)}</dd>`
  )).join('');
}

function loadAnalyserStore() {
  try {
    return JSON.parse(localStorage.getItem(ANALYSER_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveAnalyserAnswers(claim, answers) {
  const all = loadAnalyserStore();
  all[claim] = { ...answers };
  try {
    localStorage.setItem(ANALYSER_KEY, JSON.stringify(all));
  } catch {
    /* quota or private mode */
  }
}

function loadAnalyserAnswers(claim) {
  const all = loadAnalyserStore();
  return { ...(all[claim] || {}) };
}

function renderPhraseResult(resultEl, out, onInsert) {
  let html = `<p class="meta-line">Formule : <code>${escapeHtml(out.pretty)}</code></p>`;
  if (out.mapping.length && !out.symbolic) {
    html += `<ul class="mapping">`;
    for (const m of out.mapping) {
      html += `<li><strong>${escapeHtml(m.letter)}</strong> : « ${escapeHtml(m.phrase)} »</li>`;
    }
    html += `</ul>`;
  }
  html += `<div class="row-actions"><button type="button" class="btn secondary" data-insert>Mettre dans l’outil</button></div>`;
  resultEl.hidden = false;
  resultEl.className = 'result ok';
  resultEl.innerHTML = html;
  $('[data-insert]', resultEl).addEventListener('click', () => onInsert(out));
}

function initPhraseHelper({ inputId, btnId, resultId, onInsert }) {
  const input = $(inputId);
  const result = $(resultId);
  $(btnId).addEventListener('click', () => {
    result.hidden = true;
    try {
      const out = phraseToFormula(input.value);
      renderPhraseResult(result, out, onInsert);
    } catch (err) {
      showError(result, err);
    }
  });
}

function fillPhraseExamples() {
  $$('.phrase-examples').forEach((box) => {
    const targetId = box.dataset.target;
    const target = document.getElementById(targetId);
    box.innerHTML = '';
    for (const s of PHRASE_EXAMPLES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = s.length > 36 ? `${s.slice(0, 34)}…` : s;
      b.title = s;
      b.addEventListener('click', () => {
        target.value = s;
        const btn = box.parentElement.querySelector('button.btn, button.secondary');
        // the translate button is the .btn.secondary in the same card
        const translate = box.parentElement.querySelector('[id^="btn-phrase"]');
        if (translate) translate.click();
      });
      box.appendChild(b);
    }
  });
}

function initValidite() {
  const premises = $('#premises');
  const conclusion = $('#conclusion');
  const result = $('#validite-result');
  let lastFocus = premises;

  premises.addEventListener('focus', () => { lastFocus = premises; });
  conclusion.addEventListener('focus', () => { lastFocus = conclusion; });

  const shared = $('#sym-validite');
  shared.innerHTML = '';
  for (const sym of SYMBOLS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sym';
    b.textContent = sym;
    b.addEventListener('click', () => insertAtCursor(lastFocus, sym));
    shared.appendChild(b);
  }

  $('#examples').innerHTML = '';
  for (const ex of Object.values(EXAMPLES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = ex.label;
    b.addEventListener('click', () => {
      premises.value = ex.premises;
      conclusion.value = ex.conclusion;
      runValidite();
    });
    $('#examples').appendChild(b);
  }

  function runValidite() {
    result.hidden = true;
    try {
      const lines = premises.value.split(/\n/);
      const out = checkValidity(lines, conclusion.value);
      result.hidden = false;
      if (out.valid) {
        result.className = 'result ok';
        let html = `<p><strong>Argument valide.</strong> Chaque fois que les prémisses sont vraies, la conclusion l’est aussi.</p>`;
        html += formBlock(out.form);
        html += `<p class="meta-line">Prémisses : ${out.premises.map((p) => escapeHtml(p.pretty)).join(' · ')} ∴ donc ${escapeHtml(out.conclusion.pretty)}</p>`;
        result.innerHTML = html;
      } else {
        result.className = 'result bad';
        let html = `<p><strong>Argument non valide.</strong> Voici un contre-exemple, pas à pas.</p>`;
        html += `<p class="counter"><code>${escapeHtml(envToText(out.counterexample))}</code></p>`;
        if (out.steps) {
          html += `<p class="tip">Dans ce cas précis :</p><ul class="steps">`;
          out.steps.premises.forEach((p, i) => {
            html += `<li><span>Prémisse ${i + 1} : <code>${escapeHtml(p.pretty)}</code></span><span class="vf ${p.value ? 't' : 'f'}">${boolLabel(p.value)}</span></li>`;
          });
          const c = out.steps.conclusion;
          html += `<li><span>Conclusion : <code>${escapeHtml(c.pretty)}</code></span><span class="vf ${c.value ? 't' : 'f'}">${boolLabel(c.value)}</span></li>`;
          html += `</ul>`;
          html += `<p class="tip">Les prémisses sont toutes vraies, mais la conclusion est fausse. L’argument ne tient pas.</p>`;
        }
        html += formBlock(out.form);
        result.innerHTML = html;
      }
    } catch (err) {
      showError(result, err);
    }
  }

  $('#btn-validite').addEventListener('click', runValidite);

  initPhraseHelper({
    inputId: '#phrase-validite',
    btnId: '#btn-phrase-validite',
    resultId: '#phrase-validite-result',
    onInsert: (out) => {
      const current = premises.value.trim();
      premises.value = current ? `${current}\n${out.pretty}` : out.pretty;
      premises.focus();
    },
  });
}

function renderShownTable(out) {
  const kindLabel = {
    tautologie: 'Tautologie (toujours vraie)',
    contradiction: 'Contradiction (toujours fausse)',
    contingente: 'Contingente (parfois vraie, parfois fausse)',
  }[out.kind];
  const kindClass = {
    tautologie: 'ok',
    contradiction: 'bad',
    contingente: 'neutral',
  }[out.kind];

  let html = `<p class="badge ${out.kind === 'tautologie' ? 'good' : out.kind === 'contradiction' ? 'warn' : ''}">${escapeHtml(kindLabel)}</p>`;
  html += `<p class="gloss">${escapeHtml(KIND_GLOSS[out.kind])}</p>`;
  html += `<p class="meta-line">Formule : <code>${escapeHtml(out.pretty)}</code></p>`;
  html += `<div class="table-wrap"><table class="truth"><thead><tr>`;
  for (const col of out.columns) {
    html += `<th>${escapeHtml(col)}</th>`;
  }
  html += `</tr></thead><tbody>`;
  for (const row of out.rows) {
    html += `<tr>`;
    for (const col of out.columns) {
      const v = row.cells[col];
      const isFinal = col === out.columns[out.columns.length - 1];
      html += `<td class="${v ? 't' : 'f'}${isFinal ? ' final' : ''}">${boolLabel(v)}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table></div>`;
  return { html, kindClass };
}

function renderFillTable(out, result) {
  const varSet = new Set(out.vars);
  let html = `<p class="lede-sm">Les colonnes P, Q, R… sont déjà remplies. À toi de mettre V ou F dans les autres. Touche une case pour changer.</p>`;
  html += `<p class="meta-line">Formule : <code>${escapeHtml(out.pretty)}</code></p>`;
  html += `<div class="table-wrap"><table class="truth" id="fill-table"><thead><tr>`;
  for (const col of out.columns) {
    html += `<th>${escapeHtml(col)}</th>`;
  }
  html += `</tr></thead><tbody>`;
  out.rows.forEach((row, r) => {
    html += `<tr>`;
    out.columns.forEach((col, c) => {
      const truth = row.cells[col];
      if (varSet.has(col)) {
        html += `<td class="given ${truth ? 't' : 'f'}">${boolLabel(truth)}</td>`;
      } else {
        html += `<td class="fill-cell"><button type="button" class="fill-btn" data-r="${r}" data-c="${c}" data-correct="${truth ? '1' : '0'}" aria-label="Case ${col}, ligne ${r + 1}">?</button></td>`;
      }
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  html += `<div class="row-actions">
    <button type="button" class="btn" id="btn-check-fill">Vérifier mes réponses</button>
    <button type="button" class="btn secondary" id="btn-reveal-fill">Montre-moi</button>
  </div>
  <p class="tip" id="fill-feedback" hidden></p>`;

  result.hidden = false;
  result.className = 'result neutral';
  result.innerHTML = html;

  $$('.fill-btn', result).forEach((btn) => {
    btn.addEventListener('click', () => {
      const now = btn.textContent;
      if (now === '?' || now === '') {
        btn.textContent = 'V';
        btn.classList.remove('f');
        btn.classList.add('t');
      } else if (now === 'V') {
        btn.textContent = 'F';
        btn.classList.remove('t');
        btn.classList.add('f');
      } else {
        btn.textContent = '?';
        btn.classList.remove('t', 'f');
      }
      btn.classList.remove('ok', 'no');
    });
  });

  $('#btn-check-fill', result).addEventListener('click', () => {
    const buttons = $$('.fill-btn', result);
    let good = 0;
    let missing = 0;
    for (const btn of buttons) {
      const want = btn.dataset.correct === '1' ? 'V' : 'F';
      const got = btn.textContent;
      btn.classList.remove('ok', 'no');
      if (got !== 'V' && got !== 'F') {
        missing += 1;
        btn.classList.add('no');
      } else if (got === want) {
        good += 1;
        btn.classList.add('ok');
      } else {
        btn.classList.add('no');
      }
    }
    const fb = $('#fill-feedback', result);
    fb.hidden = false;
    if (missing) {
      fb.textContent = `Il reste ${missing} case${missing > 1 ? 's' : ''} vide${missing > 1 ? 's' : ''}. Remplis-les, puis revérifie.`;
    } else if (good === buttons.length) {
      const kindLabel = {
        tautologie: 'C’est une tautologie : toujours vrai.',
        contradiction: 'C’est une contradiction : toujours faux.',
        contingente: 'C’est contingent : parfois vrai, parfois faux.',
      }[out.kind];
      fb.textContent = `Bravo, tout est juste. ${kindLabel}`;
    } else {
      fb.textContent = `${good} bonne${good > 1 ? 's' : ''} sur ${buttons.length}. Les cases entourées de rouge sont à revoir.`;
    }
  });

  $('#btn-reveal-fill', result).addEventListener('click', () => {
    const shown = renderShownTable(out);
    result.className = `result ${shown.kindClass}`;
    result.innerHTML = shown.html;
  });
}

function initTable() {
  const input = $('#formula');
  const result = $('#table-result');
  const shared = $('#sym-table');
  shared.innerHTML = '';
  for (const sym of SYMBOLS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sym';
    b.textContent = sym;
    b.addEventListener('click', () => insertAtCursor(input, sym));
    shared.appendChild(b);
  }

  const examples = [
    { label: 'P → Q', value: 'P → Q' },
    { label: 'P ∧ ¬P', value: 'P ∧ ¬P' },
    { label: 'P ∨ ¬P', value: 'P ∨ ¬P' },
    { label: '(P → Q) ↔ (¬Q → ¬P)', value: '(P → Q) ↔ (¬Q → ¬P)' },
  ];
  $('#table-examples').innerHTML = '';
  for (const ex of examples) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = ex.label;
    b.addEventListener('click', () => {
      input.value = ex.value;
      runTable(false);
    });
    $('#table-examples').appendChild(b);
  }

  function runTable(fill) {
    result.hidden = true;
    try {
      const out = truthTable(input.value);
      if (fill) {
        renderFillTable(out, result);
      } else {
        const shown = renderShownTable(out);
        result.hidden = false;
        result.className = `result ${shown.kindClass}`;
        result.innerHTML = shown.html;
      }
    } catch (err) {
      showError(result, err);
    }
  }

  $('#btn-table').addEventListener('click', () => runTable(false));
  $('#btn-table-fill').addEventListener('click', () => runTable(true));

  initPhraseHelper({
    inputId: '#phrase-table',
    btnId: '#btn-phrase-table',
    resultId: '#phrase-table-result',
    onInsert: (out) => {
      input.value = out.pretty;
      input.focus();
    },
  });
}

function initAnalyser() {
  const input = $('#claim');
  const result = $('#analyser-result');

  const samples = [
    'Ils nous cachent la vérité sur tout.',
    'Le vaccin cause forcément cette maladie, c’est prouvé.',
    'Tout le monde sait que les écrans détruisent l’attention.',
  ];
  $('#claim-examples').innerHTML = '';
  for (const s of samples) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = s.length > 42 ? `${s.slice(0, 40)}…` : s;
    b.title = s;
    b.addEventListener('click', () => {
      input.value = s;
      runAnalyser();
    });
    $('#claim-examples').appendChild(b);
  }

  function runAnalyser() {
    result.hidden = true;
    try {
      const out = analyzeClaim(input.value);
      const answers = loadAnalyserAnswers(out.claim);
      let html = `<p class="lede-sm">Regardons cette affirmation comme un logicien : on part des raisons, pas de la conclusion.</p>`;
      html += `<blockquote class="claim-quote">${escapeHtml(out.claim)}</blockquote>`;
      if (out.hints.length) {
        html += `<div class="hints"><p class="eyebrow">Indices repérés</p><ul>`;
        for (const h of out.hints) html += `<li>${escapeHtml(h)}</li>`;
        html += `</ul></div>`;
      }
      html += `<div class="checklist">`;
      for (const q of out.questions) {
        const prev = answers[q.id] || '';
        html += `<label class="check-item" for="ans-${q.id}">
          <span class="check-title">${escapeHtml(q.title)}</span>
          ${q.gloss ? `<span class="gloss">${escapeHtml(q.gloss)}</span>` : ''}
          <span class="check-prompt">${escapeHtml(q.prompt)}</span>
          <textarea id="ans-${q.id}" data-qid="${q.id}" rows="2" placeholder="Ta réponse…">${escapeHtml(prev)}</textarea>
        </label>`;
      }
      html += `</div>`;
      html += `<div class="row-actions">
        <button type="button" class="btn secondary" id="btn-copy-summary">Copier le résumé</button>
      </div>
      <pre class="summary" id="summary-box" hidden></pre>`;

      result.hidden = false;
      result.className = 'result neutral';
      result.innerHTML = html;

      $$('textarea[data-qid]', result).forEach((ta) => {
        ta.addEventListener('input', () => {
          answers[ta.dataset.qid] = ta.value;
          saveAnalyserAnswers(out.claim, answers);
        });
      });

      $('#btn-copy-summary', result).addEventListener('click', async () => {
        const lines = [`Affirmation : ${out.claim}`, ''];
        for (const q of out.questions) {
          const a = (answers[q.id] || '').trim() || '(pas encore rempli)';
          lines.push(`${q.title} : ${a}`);
        }
        if (out.hints.length) {
          lines.push('', 'Indices :');
          out.hints.forEach((h) => lines.push(`- ${h}`));
        }
        const text = lines.join('\n');
        const box = $('#summary-box', result);
        box.hidden = false;
        box.textContent = text;
        try {
          await navigator.clipboard.writeText(text);
          $('#btn-copy-summary', result).textContent = 'Copié !';
          setTimeout(() => {
            const b = $('#btn-copy-summary', result);
            if (b) b.textContent = 'Copier le résumé';
          }, 1500);
        } catch {
          /* résumé visible quand même */
        }
      });
    } catch (err) {
      showError(result, err);
    }
  }

  $('#btn-analyser').addEventListener('click', runAnalyser);
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

function main() {
  initIntro();
  initTabs();
  initGlossary();
  initValidite();
  initTable();
  initAnalyser();
  fillPhraseExamples();
  registerSW();
}

main();
