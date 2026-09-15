/* Questionnaire pré-opératoire : moteur du formulaire (une étape par écran).
   Aucune réponse n'est conservée dans le navigateur ; tout est transmis à la
   fonction Netlify à l'envoi. Aucun score n'est calculé ici. */
import * as S from './questionnaire-schema.js';

const LOCALES = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-GB' };
const lang = (document.documentElement.lang || 'fr').slice(0, 2);
const t0 = Date.now();

let T = { ui: S.UI, fields: {}, steps: {}, sites: {} };
const answers = {};
let branch = 'A';
let stepIndex = 0;
let root, form, progressEl, stepsEl, navEl, alertEl, hpInput, fieldEls = {};

/* Libellés selon la langue de la page. */
function tf(field, key) {
  const d = T.fields[field.id];
  return (d && d[key] != null) ? d[key] : field[key];
}
function to(field, code) {
  const d = T.fields[field.id];
  if (d && d.options && d.options[code] != null) return d.options[code];
  return S.optionLabel(field, code);
}
function ts(step, key) {
  const d = T.steps[step.id];
  return (d && d[key] != null) ? d[key] : step[key];
}
function ui(key, vars) {
  let s = T.ui[key] != null ? T.ui[key] : S.UI[key];
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}
function siteLabel(code) {
  if (T.sites[code]) return T.sites[code];
  for (const s of S.SITES) if (s[0] === code) return s[1];
  return code;
}
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso;
  return new Intl.DateTimeFormat(LOCALES[lang] || 'fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(+m[1], +m[2] - 1, +m[3]));
}
function isoShift(iso, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3] + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k === 'text') e.textContent = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  if (children) for (const c of children) if (c) e.appendChild(c);
  return e;
}

/* ── Rendu des champs ─────────────────────────────────────────────────── */
function labelNode(field, tag, forId) {
  const optional = field.optional ? ' <span class="q-help" style="display:inline;">(' + ui('optional') + ')</span>' : '';
  const attrs = { class: 'q-label', html: tf(field, 'label') + optional };
  if (forId) attrs.for = forId;
  return el(tag, attrs);
}

function renderField(field) {
  const wrap = el('div', { class: 'q-field', 'data-field': field.id });
  if (field.sub && !field.heading) wrap.classList.add('q-field--sub');
  if (field.heading) wrap.appendChild(el('div', { class: 'q-group-title', text: tf(field, 'heading') }));
  const help = tf(field, 'help');

  if (field.type === 'closing') {
    wrap.className = 'q-field q-field--sub';
    wrap.appendChild(el('p', { class: 'q-closing', text: tf(field, 'text') }));
    return wrap;
  }
  if (field.type === 'lensnotice') {
    wrap.className = 'q-field q-field--sub';
    wrap.appendChild(el('div', { class: 'q-notice', id: 'q-lens-notice', role: 'status' }));
    return wrap;
  }
  if (field.type === 'consent') {
    wrap.className = 'q-field q-consent';
    const input = el('input', { type: 'checkbox', name: field.id, value: 'yes' });
    const lab = el('label', { class: 'q-opt is-check' }, [input, el('span', { html: tf(field, 'label') })]);
    wrap.appendChild(lab);
    wrap.appendChild(el('div', { class: 'q-error', text: ui('consentRequired') }));
    return wrap;
  }

  if (field.type === 'radio' || field.type === 'checks') {
    const labId = 'q-lab-' + field.id;
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-labelledby', labId);
    if (field.sub) wrap.appendChild(el('div', { class: 'q-sub-label', id: labId, text: tf(field, 'sub') }));
    else { const l = labelNode(field, 'div'); l.id = labId; wrap.appendChild(l); }
    if (help) wrap.appendChild(el('p', { class: 'q-help', text: help }));
    const grid = el('div', { class: 'q-options' + (field.cols ? ' cols-' + field.cols : '') + (field.keep ? ' keep' : '') });
    for (const o of field.options) {
      const input = el('input', { type: field.type === 'radio' ? 'radio' : 'checkbox', name: field.id, value: o[0] });
      grid.appendChild(el('label', { class: 'q-opt' + (field.type === 'checks' ? ' is-check' : '') }, [input, el('span', { text: to(field, o[0]) })]));
    }
    wrap.appendChild(grid);
    wrap.appendChild(el('div', { class: 'q-error', text: ui('required') }));
    return wrap;
  }

  const id = 'q-' + field.id;
  wrap.appendChild(labelNode(field, 'label', id));
  if (help) wrap.appendChild(el('p', { class: 'q-help', text: help }));

  if (field.type === 'rank') {
    const list = el('ol', { class: 'q-rank', id: id });
    const order = answers[field.id] || field.options.map((o) => o[0]);
    for (const code of order) list.appendChild(rankItem(field, code));
    wrap.appendChild(list);
    renumber(list);
    answers[field.id] = order.slice();
    wrap.appendChild(el('div', { class: 'q-error', text: ui('required') }));
    return wrap;
  }

  let input;
  if (field.type === 'select') {
    input = el('select', { class: 'q-input q-select', id: id, name: field.id });
    input.appendChild(el('option', { value: '', text: tf(field, 'placeholder') || '' }));
    for (const o of field.options) input.appendChild(el('option', { value: o[0], text: to(field, o[0]) }));
  } else if (field.type === 'textarea') {
    input = el('textarea', { class: 'q-input q-textarea', id: id, name: field.id, rows: '4', maxlength: String(field.maxlen || 2000) });
  } else if (field.type === 'number') {
    input = el('input', { class: 'q-input short', id: id, name: field.id, type: 'number', inputmode: 'numeric', min: String(field.min), max: String(field.max), step: '1' });
  } else if (field.type === 'date') {
    input = el('input', { class: 'q-input short', id: id, name: field.id, type: 'date' });
  } else {
    input = el('input', { class: 'q-input', id: id, name: field.id, type: 'text', maxlength: String(field.maxlen || 200) });
    if (field.autocomplete) input.setAttribute('autocomplete', field.autocomplete);
  }
  if (field.unit) {
    wrap.appendChild(el('div', { class: 'q-inline' }, [input, el('span', { class: 'q-unit', text: tf(field, 'unit') })]));
  } else {
    wrap.appendChild(input);
  }
  wrap.appendChild(el('div', { class: 'q-error', text: ui('required') }));
  return wrap;
}

/* Classement par glisser-déposer, avec flèches en secours. */
function rankItem(field, code) {
  const li = el('li', { 'data-code': code });
  li.appendChild(el('span', { class: 'q-rank-num' }));
  li.appendChild(el('span', { class: 'q-rank-txt', text: to(field, code) }));
  const up = el('button', { type: 'button', 'aria-label': ui('rankUp'), text: '\u2191' });
  const down = el('button', { type: 'button', 'aria-label': ui('rankDown'), text: '\u2193' });
  up.addEventListener('click', () => { if (li.previousElementSibling) { li.parentNode.insertBefore(li, li.previousElementSibling); rankChanged(li.parentNode, field); } });
  down.addEventListener('click', () => { if (li.nextElementSibling) { li.parentNode.insertBefore(li.nextElementSibling, li); rankChanged(li.parentNode, field); } });
  li.appendChild(el('span', { class: 'q-rank-btns' }, [up, down]));
  li.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const list = li.parentNode;
    li.classList.add('dragging');
    try { li.setPointerCapture(e.pointerId); } catch (err) { /* capture facultative */ }
    e.preventDefault();
    const move = (ev) => {
      const items = Array.from(list.children).filter((x) => x !== li);
      for (const other of items) {
        const r = other.getBoundingClientRect();
        const liFollows = !!(other.compareDocumentPosition(li) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (liFollows && ev.clientY < r.top + r.height / 2) { list.insertBefore(li, other); renumber(list); return; }
        if (!liFollows && ev.clientY > r.top + r.height / 2) { list.insertBefore(li, other.nextSibling); renumber(list); return; }
      }
    };
    const end = () => {
      li.classList.remove('dragging');
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      rankChanged(list, field);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  });
  return li;
}
function renumber(list) {
  Array.from(list.children).forEach((li, i) => {
    li.querySelector('.q-rank-num').textContent = String(i + 1);
    li.querySelector('.q-rank-btns').children[0].disabled = i === 0;
    li.querySelector('.q-rank-btns').children[1].disabled = i === list.children.length - 1;
  });
}
function rankChanged(list, field) {
  renumber(list);
  answers[field.id] = Array.from(list.children).map((li) => li.getAttribute('data-code'));
}

/* ── Lecture des réponses et affichage conditionnel ───────────────────── */
function readField(field, wrap) {
  if (field.type === 'radio') {
    const c = wrap.querySelector('input:checked');
    answers[field.id] = c ? c.value : undefined;
  } else if (field.type === 'checks') {
    answers[field.id] = Array.from(wrap.querySelectorAll('input:checked')).map((i) => i.value);
    if (!answers[field.id].length) answers[field.id] = undefined;
  } else if (field.type === 'consent') {
    answers[field.id] = wrap.querySelector('input').checked ? 'yes' : undefined;
  } else if (field.type === 'rank' || field.type === 'closing' || field.type === 'lensnotice') {
    return;
  } else {
    const v = wrap.querySelector('input,select,textarea').value.trim();
    answers[field.id] = v === '' ? undefined : v;
  }
}

function paintOptions(wrap) {
  wrap.querySelectorAll('.q-opt').forEach((lab) => {
    lab.classList.toggle('is-on', lab.querySelector('input').checked);
  });
}

function onChange(e) {
  const wrap = e.target.closest('.q-field');
  if (!wrap) return;
  const field = fieldEls[wrap.getAttribute('data-field')].field;
  if (field.type === 'checks' && field.none && e.target.type === 'checkbox') {
    const boxes = wrap.querySelectorAll('input');
    if (e.target.value === field.none && e.target.checked) boxes.forEach((b) => { if (b !== e.target) b.checked = false; });
    else if (e.target.checked) boxes.forEach((b) => { if (b.value === field.none) b.checked = false; });
  }
  readField(field, wrap);
  if (field.type === 'radio' || field.type === 'checks' || field.type === 'consent') paintOptions(wrap);
  if (wrap.classList.contains('has-error')) wrap.classList.remove('has-error');
  if (!form.querySelector('.q-field.has-error')) alertEl.hidden = true;
  applyConds();
}

function applyConds() {
  for (const id in fieldEls) {
    const { field, wrap } = fieldEls[id];
    const show = S.condOk(field.cond, answers);
    wrap.hidden = !show;
    if (!show && field.type !== 'lensnotice') answers[id] = undefined;
  }
  updateLensNotice();
}

function lensInfo() {
  if (answers.lenses !== 'yes' || !answers.lens_type) return null;
  const days = S.LENS_STOP[answers.lens_type];
  const label = ui('lensStopDays')[days] || (days + ' j');
  const until = S.daysUntil(answers.rdv);
  return { days: days, label: label, tooClose: until != null && until < days };
}

function updateLensNotice() {
  const box = document.getElementById('q-lens-notice');
  if (!box) return;
  const info = lensInfo();
  if (!info) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.classList.toggle('warn', info.tooClose);
  box.innerHTML = '';
  box.appendChild(el('p', { text: ui('lensStop', { days: info.label }) }));
  if (answers.rdv) box.appendChild(el('p', { text: ui('lensStopFrom', { date: fmtDate(answers.rdv), last: fmtDate(isoShift(answers.rdv, -info.days)) }) }));
  if (info.tooClose) box.appendChild(el('p', { text: ui('lensWarn') }));
}

/* ── Étapes ───────────────────────────────────────────────────────────── */
function currentSteps() { return S.stepsFor(branch); }

function renderStep() {
  const steps = currentSteps();
  const step = steps[stepIndex];
  stepsEl.innerHTML = '';
  fieldEls = {};
  const box = el('section', { class: 'q-step', 'aria-labelledby': 'q-step-title' });
  box.appendChild(el('h3', { class: 'q-step-title', id: 'q-step-title', tabindex: '-1', text: ts(step, 'title') }));
  const intro = ts(step, 'intro');
  if (intro) box.appendChild(el('p', { class: 'q-step-intro', text: intro }));
  for (const f of step.fields) {
    const wrap = renderField(f);
    fieldEls[f.id] = { field: f, wrap: wrap };
    restoreValue(f, wrap);
    box.appendChild(wrap);
  }
  stepsEl.appendChild(box);
  applyConds();
  renderProgress(steps, step);
  renderNav(steps);
  alertEl.hidden = true;
}

function restoreValue(field, wrap) {
  const v = answers[field.id];
  if (v == null) return;
  if (field.type === 'radio') { wrap.querySelectorAll('input').forEach((i) => { i.checked = i.value === v; }); paintOptions(wrap); }
  else if (field.type === 'checks') { wrap.querySelectorAll('input').forEach((i) => { i.checked = v.indexOf(i.value) !== -1; }); paintOptions(wrap); }
  else if (field.type === 'consent') { wrap.querySelector('input').checked = v === 'yes'; paintOptions(wrap); }
  else if (field.type === 'rank') { /* déjà restitué au rendu */ }
  else if (field.type !== 'closing' && field.type !== 'lensnotice') { wrap.querySelector('input,select,textarea').value = v; }
}

function renderProgress(steps, step) {
  progressEl.innerHTML = '';
  const label = el('div', { class: 'q-progress-label' }, [
    el('span', { text: ui('stepOf', { n: stepIndex + 1, t: S.STEP_COUNT }) }),
    el('span', { text: ts(step, 'title') }),
  ]);
  const bar = el('div', { class: 'q-progress-bar', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(S.STEP_COUNT), 'aria-valuenow': String(stepIndex + 1) });
  for (let i = 0; i < S.STEP_COUNT; i++) bar.appendChild(el('span', { class: i < stepIndex ? 'done' : (i === stepIndex ? 'current' : '') }));
  progressEl.appendChild(label);
  progressEl.appendChild(bar);
}

function renderNav(steps) {
  navEl.innerHTML = '';
  const last = stepIndex === steps.length - 1;
  const back = el('button', { type: 'button', class: 'q-btn q-btn-ghost', text: ui('back') });
  back.style.visibility = stepIndex === 0 ? 'hidden' : 'visible';
  back.addEventListener('click', () => { stepIndex--; renderStep(); focusTop(); });
  const next = el('button', { type: last ? 'submit' : 'button', class: 'q-btn', id: 'q-next', text: last ? ui('send') : ui('next') });
  if (!last) next.addEventListener('click', () => {
    if (!validateStep()) return;
    if (stepIndex === 0) branch = S.branchFor(answers.age);
    stepIndex++;
    renderStep();
    focusTop();
  });
  navEl.appendChild(back);
  navEl.appendChild(next);
}

function focusTop() {
  const top = root.getBoundingClientRect().top + window.scrollY - 150;
  window.scrollTo({ top: top < 0 ? 0 : top, behavior: 'smooth' });
  const h = document.getElementById('q-step-title');
  if (h) h.focus({ preventScroll: true });
}

function setError(wrap, msg) {
  wrap.classList.add('has-error');
  if (msg) wrap.querySelector('.q-error').textContent = msg;
}

function validateStep() {
  let firstBad = null;
  for (const id in fieldEls) {
    const { field, wrap } = fieldEls[id];
    if (wrap.hidden) continue;
    wrap.classList.remove('has-error');
    if (field.type === 'closing' || field.type === 'lensnotice') continue;
    readField(field, wrap);
    const v = answers[id];
    let bad = false;
    if (field.type === 'consent') { if (v !== 'yes') { setError(wrap, ui('consentRequired')); bad = true; } }
    else if (field.required && (v == null || (Array.isArray(v) && !v.length))) { setError(wrap, ui('required')); bad = true; }
    else if (field.type === 'number' && v != null) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < field.min || n > field.max) { setError(wrap, ui('invalidNumber', { min: field.min, max: field.max })); bad = true; }
    } else if (field.type === 'date' && v != null) {
      if (S.daysUntil(v) == null) { setError(wrap, ui('invalidDate')); bad = true; }
    }
    if (bad && !firstBad) firstBad = wrap;
  }
  if (firstBad) {
    alertEl.textContent = ui('fixErrors');
    alertEl.hidden = false;
    const top = firstBad.getBoundingClientRect().top + window.scrollY - 150;
    window.scrollTo({ top: top, behavior: 'smooth' });
    const inp = firstBad.querySelector('input,select,textarea');
    if (inp) inp.focus({ preventScroll: true });
    return false;
  }
  alertEl.hidden = true;
  return true;
}

/* Réponses effectivement servies : étapes de la branche, champs visibles. */
function collect() {
  const out = {};
  for (const step of currentSteps()) for (const f of step.fields) {
    if (f.type === 'closing' || f.type === 'lensnotice') continue;
    if (!S.condOk(f.cond, answers)) continue;
    if (answers[f.id] != null) out[f.id] = answers[f.id];
  }
  return out;
}

async function submit(e) {
  e.preventDefault();
  if (!validateStep()) return;
  const btn = document.getElementById('q-next');
  btn.disabled = true;
  btn.textContent = ui('sending');
  const payload = { lang: lang, branch: branch, elapsed: Date.now() - t0, website: hpInput.value, answers: collect() };
  try {
    const r = await fetch(S.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) { renderDone(); return; }
    alertEl.textContent = r.status === 429 ? ui('tooMany') : ui('sendError');
  } catch (err) {
    alertEl.textContent = ui('sendError');
  }
  alertEl.hidden = false;
  btn.disabled = false;
  btn.textContent = ui('send');
}

/* ── Écran de fin : identique pour tous ───────────────────────────────── */
function renderDone() {
  const info = lensInfo();
  const rdv = answers.rdv, site = answers.site;
  form.innerHTML = '';
  const box = el('div', { class: 'q-done', role: 'status' });
  box.appendChild(el('h3', { text: ui('doneTitle'), tabindex: '-1', id: 'q-done-title' }));
  box.appendChild(el('p', { text: ui('doneThanks') }));
  box.appendChild(el('p', { text: ui('doneRdv', { date: fmtDate(rdv), site: siteLabel(site) }) }));
  if (info) box.appendChild(el('p', { text: ui('doneLens', { days: info.label }) }));
  box.appendChild(el('p', { text: ui('doneInfo') }));
  const cal = el('button', { type: 'button', class: 'q-btn', text: ui('addCal') });
  cal.addEventListener('click', () => downloadIcs(rdv, site));
  box.appendChild(cal);
  form.appendChild(box);
  focusTop();
  document.getElementById('q-done-title').focus({ preventScroll: true });
}

function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function downloadIcs(rdv, site) {
  const d = rdv.replace(/-/g, '');
  const next = isoShift(rdv, 1).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//docteursanak.com//Questionnaire//' + lang.toUpperCase(), 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + stamp + '-' + Math.random().toString(36).slice(2) + '@docteursanak.com',
    'DTSTAMP:' + stamp,
    'DTSTART;VALUE=DATE:' + d,
    'DTEND;VALUE=DATE:' + next,
    'SUMMARY:' + icsEscape(ui('calTitle')),
    'LOCATION:' + icsEscape(siteLabel(site)),
    'DESCRIPTION:' + icsEscape(ui('calDesc')),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: 'rendez-vous-bilan.ics' });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
}

/* ── Démarrage ────────────────────────────────────────────────────────── */
async function init() {
  root = document.getElementById('questionnaire');
  if (!root) return;
  if (lang !== 'fr') {
    try {
      const mod = await import('./questionnaire-' + lang + '.js');
      T = { ui: Object.assign({}, S.UI, mod.default.ui), fields: mod.default.fields || {}, steps: mod.default.steps || {}, sites: mod.default.sites || {} };
    } catch (err) { /* libellés français en secours */ }
  }
  root.innerHTML = '';
  form = el('form', { class: 'q-form', novalidate: '', autocomplete: 'on' });
  progressEl = el('div', { class: 'q-progress' });
  stepsEl = el('div');
  alertEl = el('div', { class: 'q-alert', role: 'alert', hidden: '' });
  navEl = el('div', { class: 'q-nav' });
  hpInput = el('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' });
  const hp = el('div', { class: 'q-hp', 'aria-hidden': 'true' }, [el('label', { text: 'Site web' }, [hpInput])]);
  form.appendChild(progressEl);
  form.appendChild(stepsEl);
  form.appendChild(alertEl);
  form.appendChild(hp);
  form.appendChild(navEl);
  form.addEventListener('change', onChange);
  form.addEventListener('input', onChange);
  form.addEventListener('submit', submit);
  root.appendChild(form);
  renderStep();
}

init();
