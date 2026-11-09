import {
  parseFormula,
  formulaToString,
  truthTable,
  checkValidity,
  analyzeClaim,
} from './logic.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

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

function wireSymbolBar(bar, target) {
  bar.innerHTML = '';
  for (const sym of SYMBOLS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sym';
    b.textContent = sym;
    b.setAttribute('aria-label', `Insérer ${sym}`);
    b.addEventListener('click', () => insertAtCursor(target, sym));
    bar.appendChild(b);
  }
}

function initValidite() {
  const premises = $('#premises');
  const conclusion = $('#conclusion');
  const result = $('#validite-result');
  const barP = $('#sym-premises');
  const barC = $('#sym-conclusion');
  let lastFocus = premises;

  premises.addEventListener('focus', () => { lastFocus = premises; });
  conclusion.addEventListener('focus', () => { lastFocus = conclusion; });

  // shared symbol bar inserts into last focused field
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
  for (const [key, ex] of Object.entries(EXAMPLES)) {
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
        if (out.form) {
          html += `<p class="badge ${out.form.kind === 'fallacy' ? 'warn' : 'good'}">${escapeHtml(out.form.name)}</p>`;
          html += `<p class="tip">${escapeHtml(out.form.tip)}</p>`;
        }
        html += `<p class="meta-line">Prémisses : ${out.premises.map((p) => escapeHtml(p.pretty)).join(' · ')} → ${escapeHtml(out.conclusion.pretty)}</p>`;
        result.innerHTML = html;
      } else {
        result.className = 'result bad';
        let html = `<p><strong>Argument non valide.</strong> Voici un contre-exemple :</p>`;
        html += `<p class="counter"><code>${escapeHtml(envToText(out.counterexample))}</code></p>`;
        html += `<p class="tip">Dans ce cas, toutes les prémisses sont vraies, mais la conclusion est fausse.</p>`;
        if (out.form) {
          html += `<p class="badge warn">${escapeHtml(out.form.name)}</p>`;
          html += `<p class="tip">${escapeHtml(out.form.tip)}</p>`;
        }
        result.innerHTML = html;
      }
    } catch (err) {
      showError(result, err);
    }
  }

  $('#btn-validite').addEventListener('click', runValidite);
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
      runTable();
    });
    $('#table-examples').appendChild(b);
  }

  function runTable() {
    result.hidden = true;
    try {
      const out = truthTable(input.value);
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
      result.hidden = false;
      result.className = `result ${kindClass}`;
      result.innerHTML = html;
    } catch (err) {
      showError(result, err);
    }
  }

  $('#btn-table').addEventListener('click', runTable);
}

function initAnalyser() {
  const input = $('#claim');
  const result = $('#analyser-result');
  const answers = {};

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
      let html = `<p class="lede-sm">Regardons cette affirmation comme un logicien, pas comme un « conspiracy theorist ».</p>`;
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
  initTabs();
  initValidite();
  initTable();
  initAnalyser();
  registerSW();
}

main();
