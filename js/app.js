import { solve, checkAnswer } from './solver.js';
import { MathError } from './rational.js';
import { TOPICS, LEVELS, makeRound } from './practice.js';
import { store, readBackup } from './store.js';
import { APP_VERSION } from './version.js';
import { esc } from './format.js';

const $ = (sel) => document.querySelector(sel);

const EXAMPLES = ['3/4 + 1/6', '236 × 45', '3x + 5 = 20', '25% of 80', '2 + 3 × (8 − 2)', '56.35 ÷ 7', '? × 6 = 42', '6 friends share 24 cookies equally. How many cookies does each friend get?'];
const CHEERS = ['Great job!', 'Nailed it!', 'You got it!', 'Super!', 'Awesome!', 'Correct!', 'Brilliant!'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- small helpers ----------

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}

function updateStars(gained = 0) {
  if (gained) store.addStars(gained);
  $('#star-count').textContent = store.get().stars;
  if (gained) {
    const s = $('.stars');
    s.classList.remove('pop');
    void s.offsetWidth;
    s.classList.add('pop');
  }
}

function friendlyError(e) {
  if (e instanceof MathError) return e.message;
  console.error(e);
  return "Something went wrong reading that. Check the numbers and signs and try again.";
}

function stepHTML(step, i) {
  const lines = step.lines.map((l) => (l.startsWith('<div') ? l : l.includes('<ul') ? `<div>${l}</div>` : `<p>${l}</p>`)).join('');
  return `<li class="step">
    <div class="step-head"><span class="step-n">${i + 1}</span><h3>${esc(step.title)}</h3>${step.reason ? `<span class="reason">${esc(step.reason)}</span>` : ''}</div>
    <div class="expr">${step.beforeHTML}</div>
    <div class="lines">${lines}</div>
    ${step.afterHTML ? `<div class="expr after"><span class="arrow">→</span>${step.afterHTML}</div>` : ''}
  </li>`;
}

function answerHTML(res) {
  const a = res.answer;
  if (a.special) return `<div class="answer"><span class="label">Answer</span><div>${a.html}</div></div>`;
  const forms = a.forms.filter((f) => f.label && f.html.replace(/<[^>]+>/g, '') !== a.html.replace(/<[^>]+>/g, ''));
  return `<div class="answer">
    <span class="label">Answer</span>
    <div class="big">${a.html}</div>
    ${forms.length ? `<div class="forms">${forms.map((f) => `<span>${esc(f.label)}: <b>${f.html}</b></span>`).join('')}</div>` : ''}
  </div>`;
}

// ---------- solve tab ----------

const problemInput = $('#problem');

function insertAtCursor(input, text) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  const pos = start + text.length;
  input.focus();
  input.setSelectionRange(pos, pos);
}

function renderExamples() {
  $('#examples').innerHTML = EXAMPLES.map((e) => `<button type="button" class="chip-btn" data-ex="${esc(e)}">${esc(e.length > 30 ? `${e.split('.')[0]}…` : e)}</button>`).join('');
}

function runSolve(text, { remember = true } = {}) {
  const err = $('#solve-error');
  const out = $('#result');
  err.hidden = true;
  let res;
  try {
    res = solve(text);
  } catch (e) {
    err.textContent = friendlyError(e);
    err.hidden = false;
    out.hidden = true;
    return;
  }
  if (remember) store.addHistory(text);
  renderResult(res);
}

function renderResult(res) {
  const out = $('#result');
  const tryFirst = store.setting('hintFirst') && res.type !== 'check' && !res.answer.special && res.steps.length > 0;
  let shown = tryFirst ? 0 : res.steps.length;
  let solvedIt = false;

  out.innerHTML = `
    <div class="problem-big">${res.problemHTML}</div>
    ${tryFirst ? `
      <form class="try card" id="try-form" autocomplete="off">
        <label for="try-input"><b>What do you think the answer is?</b></label>
        <div class="try-row">
          <input id="try-input" type="text" spellcheck="false" placeholder="${res.type === 'eq' ? `${esc(res.varName)} = ?` : 'Your answer'}">
          <button class="primary" type="submit">Check</button>
        </div>
        <p id="try-verdict" class="verdict" hidden></p>
      </form>` : ''}
    <p class="hint-box" id="hint-box" hidden><b>Hint:</b> ${esc(res.hint)}</p>
    <ol class="steps" id="steps"></ol>
    <div class="controls" id="controls"></div>
    <div id="answer-slot"></div>`;
  out.hidden = false;

  const draw = () => {
    $('#steps').innerHTML = res.steps.slice(0, shown).map(stepHTML).join('');
    const done = shown >= res.steps.length;
    $('#answer-slot').innerHTML = done || solvedIt ? answerHTML(res) : '';
    const ctrls = [];
    if (!done) {
      if ($('#hint-box').hidden) ctrls.push('<button type="button" class="ghost" data-act="hint">Give me a hint</button>');
      ctrls.push(`<button type="button" class="ghost" data-act="next">${shown ? 'Next step' : 'Show the first step'}</button>`);
      ctrls.push('<button type="button" class="ghost" data-act="all">Show all steps</button>');
    }
    $('#controls').innerHTML = ctrls.join('');
  };

  $('#controls').onclick = (ev) => {
    const act = ev.target.closest('button')?.dataset.act;
    if (act === 'hint') $('#hint-box').hidden = false;
    if (act === 'next') shown++;
    if (act === 'all') shown = res.steps.length;
    if (act) draw();
    if (act === 'next' || act === 'all') $('#steps').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const tryForm = $('#try-form');
  if (tryForm) {
    tryForm.onsubmit = (ev) => {
      ev.preventDefault();
      const val = $('#try-input').value.trim();
      if (!val) return;
      const v = $('#try-verdict');
      const last = res.steps[res.steps.length - 1];
      const r = checkAnswer(val, res.answer.q, res.steps.length === 1 ? last.remainder : null);
      v.hidden = false;
      if (r.ok) {
        v.className = 'verdict good';
        v.textContent = r.close ? `Very close! The exact answer is shown below.` : `${pick(CHEERS)} That's right.${shown < res.steps.length ? ' Want to see the steps anyway?' : ''}`;
        if (!solvedIt && shown === 0) { updateStars(1); toast('+1 star'); }
        solvedIt = true;
        draw();
      } else {
        v.className = 'verdict bad';
        v.textContent = r.error || (shown === 0 ? 'Not quite. Try a hint or look at the first step.' : 'Not quite. Look at the next step.');
        $('#hint-box').hidden = false;
        draw();
      }
    };
  }
  draw();
}

// The box grows to fit a long word problem; Enter solves, Shift+Enter makes a new line.
function fitProblem() {
  problemInput.style.height = 'auto';
  problemInput.style.height = `${problemInput.scrollHeight + 4}px`;
}

function setupSolve() {
  renderExamples();
  problemInput.addEventListener('input', fitProblem);
  problemInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('#solve-form').requestSubmit();
    }
  });
  $('#hint-first').checked = store.setting('hintFirst');
  $('#hint-first').onchange = (e) => {
    store.setting('hintFirst', e.target.checked);
    if (problemInput.value.trim() && !$('#result').hidden) runSolve(problemInput.value, { remember: false });
  };
  $('#solve-form').onsubmit = (e) => {
    e.preventDefault();
    runSolve(problemInput.value);
  };
  document.querySelector('.symbols').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) insertAtCursor(problemInput, b.dataset.ins);
  };
  $('#examples').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    problemInput.value = b.dataset.ex;
    fitProblem();
    runSolve(b.dataset.ex);
  };

  // Camera: read a printed problem from a photo, then let the kid check it before solving.
  $('#camera-btn').onclick = () => $('#camera-input').click();
  $('#camera-input').onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const status = $('#ocr-status');
    status.hidden = false;
    try {
      const { readPhoto } = await import('./ocr.js');
      const text = await readPhoto(file, (msg) => { status.textContent = msg; });
      problemInput.value = text;
      fitProblem();
      status.textContent = 'Check the problem looks right (fix it if not), then tap Solve.';
      problemInput.focus();
    } catch (err) {
      status.textContent = err.message || "Couldn't read that photo. You can type the problem instead.";
    }
  };
}

// ---------- practice tab ----------

let level = 0;
let round = null;

function renderTopics() {
  const stats = store.get().topics;
  $('#level').innerHTML = LEVELS.map((l, i) => `<button type="button" role="radio" aria-checked="${i === level}" data-level="${i}">${l}</button>`).join('');
  $('#topics').innerHTML = TOPICS.map((t) => {
    const s = stats[t.id];
    const pct = s && s.tries ? Math.round((100 * s.firstTry) / s.tries) : null;
    return `<button type="button" class="topic" data-topic="${t.id}">
      <b>${esc(t.name)}</b>
      <span class="sample">${esc(t.sample)}</span>
      ${pct === null ? '<span class="acc">Not tried yet</span>' : `<span class="acc">${pct}% first try</span><span class="meter"><i style="width:${pct}%"></i></span>`}
    </button>`;
  }).join('');
}

function noNegatives(text) {
  try {
    const r = solve(text);
    return r.answer.q && r.answer.q.sign() >= 0;
  } catch {
    return false;
  }
}

function startRound(topicId) {
  const topic = TOPICS.find((t) => t.id === topicId);
  round = { topic, problems: makeRound(topicId, level, 10, noNegatives), i: 0, results: [], tries: 0, stars: 0, firstTry: 0 };
  $('#practice-setup').hidden = true;
  $('#practice-done').hidden = true;
  $('#practice-play').hidden = false;
  $('#play-topic').innerHTML = `<span class="label">${esc(topic.name)} · ${LEVELS[level]}</span>`;
  showQuestion();
}

function showQuestion() {
  const text = round.problems[round.i];
  round.solved = solve(text);
  round.tries = 0;
  round.finished = false;
  $('#question').innerHTML = round.solved.problemHTML;
  $('#answer').value = '';
  $('#answer').placeholder = round.solved.type === 'eq' ? `${round.solved.varName} = ?` : '?';
  $('#feedback').className = 'feedback';
  $('#feedback').innerHTML = '';
  $('#play-steps').innerHTML = '';
  $('#check-btn').textContent = 'Check';
  $('#play-count').textContent = `${round.i + 1} / ${round.problems.length}`;
  drawDots();
  if (window.matchMedia('(pointer: fine)').matches) $('#answer').focus();
}

function drawDots() {
  $('#dots').innerHTML = round.problems.map((_, k) => `<i class="${round.results[k] === true ? 'right' : round.results[k] === false ? 'wrong' : k === round.i ? 'now' : ''}"></i>`).join('');
}

function showPracticeSteps() {
  $('#play-steps').innerHTML = `<ol class="steps">${round.solved.steps.map(stepHTML).join('')}</ol>${answerHTML(round.solved)}`;
}

function finishQuestion(right, firstTry) {
  round.finished = true;
  round.results[round.i] = right;
  drawDots();
  if (firstTry) round.firstTry++;
  const streak = store.recordPractice(round.topic.id, { firstTry, right });
  let gained = firstTry ? 1 : 0;
  if (firstTry && streak > 0 && streak % 5 === 0) {
    gained += 3;
    toast(`${streak} in a row! +3 bonus stars`);
  }
  round.stars += gained;
  updateStars(gained);
  $('#check-btn').textContent = round.i === round.problems.length - 1 ? 'Finish' : 'Next';
}

function checkPractice() {
  if (round.finished) {
    round.i++;
    if (round.i >= round.problems.length) return endRound();
    return showQuestion();
  }
  const val = $('#answer').value.trim();
  if (!val) return;
  const fb = $('#feedback');
  const r = checkAnswer(val, round.solved.answer.q);
  if (r.error && round.tries === 0) {
    fb.className = 'feedback bad';
    fb.innerHTML = `<span class="grow">${esc(r.error)}</span>`;
    return;
  }
  round.tries++;
  if (r.ok) {
    fb.className = 'feedback good';
    fb.innerHTML = `<span class="grow">${round.tries === 1 ? `${pick(CHEERS)} +1 star` : 'Yes! You got it on the second try.'}</span>`;
    finishQuestion(true, round.tries === 1);
  } else if (round.tries === 1) {
    fb.className = 'feedback bad';
    fb.innerHTML = `<span class="grow">Not quite. Have another go!</span><button type="button" class="ghost small" id="p-hint">Hint</button>`;
    $('#p-hint').onclick = () => {
      fb.querySelector('.grow').innerHTML = `<b>Hint:</b> ${esc(round.solved.hint)}`;
      $('#p-hint').remove();
    };
    $('#answer').select();
  } else {
    fb.className = 'feedback bad';
    fb.innerHTML = `<span class="grow">The answer is <b>${round.solved.answer.html}</b>.</span><button type="button" class="ghost small" id="p-how">Show me how</button>`;
    $('#p-how').onclick = () => { showPracticeSteps(); $('#p-how').remove(); };
    finishQuestion(false, false);
  }
}

function endRound() {
  const right = round.results.filter(Boolean).length;
  const total = round.problems.length;
  const msg = right === total ? 'Perfect round!' : right >= total * 0.8 ? 'Excellent work!' : right >= total * 0.5 ? 'Good effort! Practice makes progress.' : 'That was a tough one. Try Easy level, then work back up.';
  $('#practice-play').hidden = true;
  const done = $('#practice-done');
  done.hidden = false;
  done.innerHTML = `
    <span class="label">${esc(round.topic.name)} · ${LEVELS[level]}</span>
    <div class="score">${right} / ${total}</div>
    <h2>${msg}</h2>
    <p class="muted">${round.firstTry} right on the first try · ${round.stars} star${round.stars === 1 ? '' : 's'} earned</p>
    <div class="row">
      <button type="button" class="primary" id="again">Play again</button>
      ${level < 2 && right >= 8 ? '<button type="button" class="ghost" id="harder">Try a harder level</button>' : ''}
      <button type="button" class="ghost" id="pick">Pick another topic</button>
    </div>`;
  const id = round.topic.id;
  $('#again').onclick = () => startRound(id);
  if ($('#harder')) $('#harder').onclick = () => { level++; startRound(id); };
  $('#pick').onclick = backToTopics;
}

function backToTopics() {
  round = null;
  $('#practice-play').hidden = true;
  $('#practice-done').hidden = true;
  $('#practice-setup').hidden = false;
  renderTopics();
}

function setupPractice() {
  renderTopics();
  $('#level').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    level = Number(b.dataset.level);
    renderTopics();
  };
  $('#topics').onclick = (e) => {
    const b = e.target.closest('button');
    if (b) startRound(b.dataset.topic);
  };
  $('#quit').onclick = backToTopics;
  $('#answer-form').onsubmit = (e) => { e.preventDefault(); checkPractice(); };
  $('#keypad').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || !b.dataset.k) return;
    const input = $('#answer');
    if (round && round.finished) return;
    // After a wrong try the old answer is selected, so the next key replaces it.
    const allSelected = input.value && input.selectionStart === 0 && input.selectionEnd === input.value.length;
    if (b.dataset.k === 'back') input.value = allSelected ? '' : input.value.slice(0, -1);
    else input.value = (allSelected ? '' : input.value) + b.dataset.k;
    input.setSelectionRange(input.value.length, input.value.length);
  };
}

// ---------- progress tab ----------

// Which grown-up action is open: null, 'rename', 'reset' or 'delete'.
let manage = null;

function manageHTML(kid) {
  const name = esc(kid.name);
  if (manage === 'rename') {
    return `<form class="rename-row" id="rename-form" autocomplete="off">
        <label for="rename-input" class="sr-only">New name</label>
        <input id="rename-input" type="text" maxlength="20" value="${name}" autocapitalize="words" spellcheck="false">
        <button type="submit" class="primary small">Save</button>
        <button type="button" class="ghost small" data-m="cancel">Cancel</button>
      </form>
      <p id="manage-error" class="error" role="alert" hidden></p>`;
  }
  if (manage === 'reset') {
    return `<p style="margin:0 0 10px">Erase ${name}'s stars, streaks and topic stats? The profile stays.</p>
      <div class="row"><button type="button" class="ghost danger" data-m="reset-yes">Yes, erase progress</button><button type="button" class="ghost" data-m="cancel">Cancel</button></div>`;
  }
  if (manage === 'delete') {
    return `<p style="margin:0 0 10px">Delete ${name}'s profile and all of their progress? This can't be undone.</p>
      <div class="row"><button type="button" class="ghost danger" data-m="delete-yes">Yes, delete ${name}</button><button type="button" class="ghost" data-m="cancel">Cancel</button></div>`;
  }
  return `<div class="row">
      <button type="button" class="ghost small" data-m="rename">Rename</button>
      <button type="button" class="ghost small" data-m="reset">Reset progress</button>
      <button type="button" class="ghost small danger" data-m="delete">Delete profile</button>
    </div>`;
}

function renderProgress() {
  const s = store.get();
  const kid = store.current();
  $('#progress-h').textContent = kid ? `${kid.name}'s progress` : 'Progress';
  const rows = TOPICS.map((t) => ({ t, st: s.topics[t.id] })).filter((r) => r.st && r.st.tries);
  const weak = rows.filter((r) => r.st.tries >= 5).sort((a, b) => a.st.firstTry / a.st.tries - b.st.firstTry / b.st.tries)[0];
  const others = store.profiles().filter((p) => !kid || p.id !== kid.id);
  $('#progress-body').innerHTML = `
    <div class="tiles">
      <div class="tile"><b>${s.stars}</b><span>stars</span></div>
      <div class="tile"><b>${s.solved}</b><span>practice problems right</span></div>
      <div class="tile"><b>${s.bestStreak}</b><span>best streak</span></div>
    </div>
    ${weak && weak.st.firstTry / weak.st.tries < 0.8 ? `<p class="tip">Worth more practice: <b>${esc(weak.t.name)}</b> (${Math.round((100 * weak.st.firstTry) / weak.st.tries)}% right on the first try).</p>` : ''}
    <div class="card">
      <h2>By topic</h2>
      <p class="muted">Percent right on the first try.</p>
      <div class="stat-list" style="margin-top:12px">
        ${rows.length ? rows.map(({ t, st }) => {
          const pct = Math.round((100 * st.firstTry) / st.tries);
          return `<div class="stat"><span>${esc(t.name)}</span><small>${pct}% \u00b7 ${st.firstTry}/${st.tries}</small><span class="meter"><i style="width:${pct}%"></i></span></div>`;
        }).join('') : '<p class="muted">No practice yet. Pick a topic in Practice to start.</p>'}
      </div>
    </div>
    <div class="card">
      <h2>Recent problems</h2>
      <div class="history" style="margin-top:10px">
        ${s.history.length ? s.history.map((h) => `<button type="button" class="chip-btn" data-h="${esc(h)}">${esc(h.length > 40 ? `${h.slice(0, 38)}…` : h)}</button>`).join('') : '<p class="muted">Problems you solve will show up here.</p>'}
      </div>
    </div>
    ${others.length ? `<div class="card">
      <h2>Other kids</h2>
      <div class="who-list" style="margin-top:10px">${others.map((p) => kidButton(p, false)).join('')}</div>
    </div>` : ''}
    ${kid ? `<div class="card">
      <h2>For grown-ups</h2>
      <p class="muted" style="margin:6px 0 12px">Progress is saved on this device. Nothing is uploaded.</p>
      ${manageHTML(kid)}
    </div>` : ''}
    <div class="card">
      <h2>Move progress to another device</h2>
      <p class="muted" style="margin:6px 0 12px">Save every kid's progress to a file. Choose <b>Drive</b> to keep it in Google Drive. On the other device, open Math Buddy and tap <b>Load progress</b>.</p>
      <div class="row">
        <button type="button" class="primary small" data-b="save">Save progress</button>
        <button type="button" class="ghost small" data-b="load">Load progress</button>
      </div>
      <div id="progress-backup">${backupPreviewHTML('progress')}</div>
    </div>`;

  const body = $('#progress-body');
  body.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.h) { problemInput.value = b.dataset.h; location.hash = '#solve'; fitProblem(); runSolve(b.dataset.h); return; }
    if (b.dataset.kid) { switchKid(b.dataset.kid); return; }
    if (b.dataset.b) { handleBackup(b.dataset.b, 'progress'); return; }
    const m = b.dataset.m;
    if (!m) return;
    if (m === 'cancel') manage = null;
    else if (m === 'reset-yes') { store.reset(); manage = null; updateStars(); toast('Progress erased'); }
    else if (m === 'delete-yes') {
      const gone = kid.name;
      store.deleteProfile(kid.id);
      manage = null;
      onKidChanged();
      toast(`Deleted ${gone}`);
      if (!store.current()) openWho();
      return;
    } else manage = m;
    renderProgress();
    if (manage === 'rename') { const i = $('#rename-input'); i.focus(); i.select(); }
  };
  const rename = $('#rename-form');
  if (rename) {
    rename.onsubmit = (e) => {
      e.preventDefault();
      try {
        store.renameProfile(kid.id, $('#rename-input').value);
        manage = null;
        updateWho();
        renderProgress();
      } catch (err) {
        $('#manage-error').textContent = err.message;
        $('#manage-error').hidden = false;
      }
    };
  }
}

// ---------- moving progress between devices ----------

let pendingBackup = null; // a checked file waiting for "Load progress"
let backupNote = null; // { text, error } shown under the buttons
let backupWhere = 'progress'; // where the Load button was tapped: 'progress' or 'who'

function backupPreviewHTML(where) {
  if (backupWhere !== where) return '';
  if (!pendingBackup) {
    return backupNote ? `<p class="${backupNote.error ? 'error' : 'tip'}" style="margin-top:12px">${esc(backupNote.text)}</p>` : '';
  }
  const items = store.previewBackup(pendingBackup);
  const when = pendingBackup.savedAt && !Number.isNaN(pendingBackup.savedAt.getTime())
    ? ` (saved ${pendingBackup.savedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })})`
    : '';
  return `<div class="load-preview">
    <p><b>This file has${when}:</b></p>
    <ul>${items.map((i) => `<li><b>${esc(i.name)}</b> \u2605 ${i.stars}: ${i.replaces ? `replaces ${esc(i.replaces.name)}'s progress on this device (\u2605 ${i.replaces.stars})` : 'new on this device'}</li>`).join('')}</ul>
    <div class="row">
      <button type="button" class="primary small" data-b="load-yes">Load progress</button>
      <button type="button" class="ghost small" data-b="load-no">Cancel</button>
    </div>
  </div>`;
}

function redrawBackup() {
  if (backupWhere === 'who') $('#who-backup').innerHTML = backupPreviewHTML('who');
  else if (!$('#view-progress').hidden) renderProgress();
}

// Android's share sheet lets you pick Drive. Chrome only shares some file types,
// so try a .json file first, then the same text as a .txt file, then a plain download.
async function saveBackup() {
  if (!store.profiles().length) {
    backupNote = { text: 'There is no progress to save yet. Add a kid first.', error: true };
    return redrawBackup();
  }
  const text = JSON.stringify(store.exportBackup(APP_VERSION), null, 2);
  const day = new Date().toISOString().slice(0, 10);
  const base = `math-buddy-progress-${day}`;
  const candidates = [
    new File([text], `${base}.json`, { type: 'application/json' }),
    new File([text], `${base}.txt`, { type: 'text/plain' }),
  ];
  const shareable = navigator.canShare && candidates.find((f) => { try { return navigator.canShare({ files: [f] }); } catch { return false; } });
  if (shareable) {
    try {
      await navigator.share({ files: [shareable], title: 'Math Buddy progress' });
      backupNote = { text: `Saved ${shareable.name}. Keep it somewhere you can reach from the other device, like Google Drive.`, error: false };
      return redrawBackup();
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(candidates[0]);
  const a = document.createElement('a');
  a.href = url;
  a.download = candidates[0].name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  backupNote = { text: `Saved ${candidates[0].name} to this device's Downloads. Upload it to Google Drive to use it on another device.`, error: false };
  redrawBackup();
}

function handleBackup(action, where) {
  backupWhere = where;
  if (action === 'save') { backupNote = null; saveBackup(); return; }
  if (action === 'load') { backupNote = null; pendingBackup = null; $('#backup-input').click(); return; }
  if (action === 'load-no') { pendingBackup = null; backupNote = null; redrawBackup(); return; }
  if (action === 'load-yes' && pendingBackup) {
    const names = pendingBackup.profiles.map((p) => p.name);
    const { added, replaced } = store.loadBackup(pendingBackup);
    pendingBackup = null;
    backupNote = { text: `Loaded progress for ${names.join(', ')}.${added ? ` ${added} new.` : ''}${replaced ? ` ${replaced} updated.` : ''}`, error: false };
    if (where === 'who') $('#who-sheet').hidden = true;
    onKidChanged();
    redrawBackup();
    toast('Progress loaded');
  }
}

function setupBackup() {
  $('#backup-input').onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error("That file is too big to be a Math Buddy progress file.");
      pendingBackup = readBackup(await file.text());
      backupNote = null;
    } catch (err) {
      pendingBackup = null;
      backupNote = { text: err.message || "Couldn't read that file.", error: true };
    }
    redrawBackup();
  };
  $('#app-version').textContent = APP_VERSION;
}

// ---------- profiles ----------

function kidButton(p, isCurrent) {
  const initial = esc((p.name.match(/\p{L}|\p{N}/u) || [p.name[0] || '?'])[0].toUpperCase());
  return `<button type="button" class="kid" data-kid="${p.id}" aria-current="${isCurrent}">
    <span class="avatar big c${p.color}" aria-hidden="true">${initial}</span>
    <b>${esc(p.name)}</b>
    <small>\u2605 ${p.stars}</small>
  </button>`;
}

function updateWho() {
  const kid = store.current();
  $('#who').hidden = !kid;
  if (!kid) return;
  const av = $('#who-avatar');
  av.className = `avatar c${kid.color}`;
  av.textContent = (kid.name.match(/\p{L}|\p{N}/u) || [kid.name[0] || '?'])[0].toUpperCase();
  $('#who-name').textContent = kid.name;
  $('#who').setAttribute('aria-label', `${kid.name}. Switch kid`);
}

function openWho() {
  const kid = store.current();
  const list = store.profiles();
  $('#who-h').textContent = list.length ? "Who's practicing?" : "Who's using Math Buddy?";
  const sub = [];
  if (!list.length) sub.push('Add a name for each kid. Everyone gets their own stars and progress.');
  if (store.hasOldProgress()) sub.push('The progress already on this phone will go to the first name you add.');
  $('#who-sub').textContent = sub.join(' ');
  $('#who-sub').hidden = !sub.length;
  $('#who-list').innerHTML = list.map((p) => kidButton(p, !!kid && p.id === kid.id)).join('');
  $('#who-error').hidden = true;
  $('#kid-name').value = '';
  $('#who-close').hidden = !kid;
  if (backupWhere === 'who') { pendingBackup = null; backupNote = null; }
  $('#who-backup').innerHTML = '';
  $('#who-sheet').hidden = false;
  if (!list.length) $('#kid-name').focus();
}

function closeWho() {
  if (!store.current()) return;
  $('#who-sheet').hidden = true;
}

// Everything on screen belongs to one kid, so redraw it all when the kid changes.
function onKidChanged() {
  manage = null;
  updateWho();
  updateStars();
  $('#hint-first').checked = store.setting('hintFirst');
  if (round) backToTopics();
  if (problemInput.value.trim() && !$('#result').hidden) runSolve(problemInput.value, { remember: false });
  route({ keepScroll: true });
}

function switchKid(id) {
  store.switchTo(id);
  $('#who-sheet').hidden = true;
  onKidChanged();
  toast(`Hi, ${store.current().name}!`);
}

function setupWho() {
  $('#who').onclick = openWho;
  $('#who-close').onclick = closeWho;
  $('#who-sheet').onclick = (e) => {
    if (e.target === e.currentTarget) return closeWho();
    const bb = e.target.closest('button[data-b]');
    if (bb) return handleBackup(bb.dataset.b, 'who');
    const b = e.target.closest('button[data-kid]');
    if (b) switchKid(b.dataset.kid);
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#who-sheet').hidden) closeWho();
  });
  $('#add-kid').onsubmit = (e) => {
    e.preventDefault();
    try {
      store.addProfile($('#kid-name').value);
    } catch (err) {
      $('#who-error').textContent = err.message;
      $('#who-error').hidden = false;
      return;
    }
    $('#who-sheet').hidden = true;
    onKidChanged();
    toast(`Hi, ${store.current().name}!`);
  };
  updateWho();
  if (!store.current()) openWho();
}

// ---------- tabs, install, offline ----------

function route({ keepScroll = false } = {}) {
  const tab = (location.hash || '#solve').slice(1);
  const valid = ['solve', 'practice', 'progress'].includes(tab) ? tab : 'solve';
  for (const v of ['solve', 'practice', 'progress']) $(`#view-${v}`).hidden = v !== valid;
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.tab === valid) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (valid === 'progress') renderProgress();
  if (valid === 'practice' && !round) renderTopics();
  if (!keepScroll) window.scrollTo(0, 0);
}

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  $('#install').hidden = false;
});
$('#install').onclick = async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('#install').hidden = true;
};

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* not available here; app still works online */ });
  });
}

setupSolve();
setupPractice();
updateStars();
window.addEventListener('hashchange', () => route());
route();
setupBackup();
setupWho();

// Open with a worked example so the first screen shows what the app does.
problemInput.value = EXAMPLES[0];
runSolve(EXAMPLES[0], { remember: false });
