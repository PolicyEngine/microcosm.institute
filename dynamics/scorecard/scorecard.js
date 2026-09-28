import { renderExerciseChart, renderAlternatives } from './charts.js';

const main = document.querySelector('#scorecard');
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

// The editorial source lives in copy.json, separate from measurements. Source
// annotations remain inspectable in the DOM without interrupting the prose.
function inline(source = '') {
  const comments = [];
  let value = source.replace(/\[src: ([^\]]+)\]/g, (_, citation) => {
    comments.push(`<!-- src: ${citation.replace(/--/g, '—')} -->`);
    return `\uE000${comments.length - 1}\uE001`;
  });
  value = escapeHTML(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  return value.replace(/\uE000(\d+)\uE001/g, (_, index) => comments[index]);
}

function markdown(source = '') {
  const lines = source.trim().split('\n');
  const output = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    if (line.startsWith('|')) {
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(lines[index++].trim().slice(1, -1).split('|').map(cell => cell.trim()));
      }
      const header = rows.shift();
      if (rows[0]?.every(cell => /^:?-+:?$/.test(cell))) rows.shift();
      output.push(`<div class="copy-table-wrap" role="region" aria-label="${escapeHTML(header.join(', '))}" tabindex="0"><table><thead><tr>${header.map(cell => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => i ? `<td>${inline(cell)}</td>` : `<th scope="row">${inline(cell)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (/^- /.test(line)) {
      const items = [];
      while (index < lines.length && /^- /.test(lines[index].trim())) items.push(`<li>${inline(lines[index++].trim().slice(2))}</li>`);
      output.push(`<ul>${items.join('')}</ul>`);
    } else {
      const paragraph = [];
      while (index < lines.length && lines[index].trim() && !lines[index].trim().startsWith('|') && !/^- /.test(lines[index].trim())) paragraph.push(lines[index++].trim());
      output.push(`<p>${inline(paragraph.join(' '))}</p>`);
    }
  }
  return output.join('\n');
}

function section(id, title, className = '') {
  const node = document.createElement('section');
  node.id = id;
  node.className = `score-section ${className}`;
  node.innerHTML = `<h2>${inline(title)}</h2>`;
  main.append(node);
  return node;
}

function addGlossary(root, glossary) {
  const terms = [...glossary].sort((a, b) => b.term.length - a.term.length);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${terms.map(entry => entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  const entries = new Map(terms.map(entry => [entry.term.toLowerCase(), entry]));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement.closest('abbr, svg, button, select, option, dt, .chart-tooltip, [role="tooltip"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  for (const node of texts) {
    const text = node.textContent;
    const matches = [...text.matchAll(pattern)];
    if (!matches.length) continue;
    const fragment = document.createDocumentFragment();
    let start = 0;
    for (const match of matches) {
      fragment.append(text.slice(start, match.index));
      const term = document.createElement('abbr');
      term.textContent = match[0];
      term.tabIndex = node.parentElement.closest('a') ? -1 : 0;
      const entry = entries.get(match[0].toLowerCase());
      term.dataset.definition = entry.definition.replace(/\[src: [^\]]+\]/g, '').replace(/\*|`/g, '').trim();
      fragment.append(term);
      start = match.index + match[0].length;
    }
    fragment.append(text.slice(start));
    node.replaceWith(fragment);
  }
}

function setupGlossaryTooltip() {
  const tooltip = document.querySelector('#glossary-tooltip');
  let owner;
  let timer;
  function hide() { tooltip.hidden = true; owner?.removeAttribute('aria-describedby'); owner = null; }
  function show(target) {
    clearTimeout(timer);
    owner?.removeAttribute('aria-describedby');
    owner = target;
    (target.closest('dialog') || document.body).append(tooltip);
    tooltip.textContent = target.dataset.definition;
    tooltip.hidden = false;
    target.setAttribute('aria-describedby', tooltip.id);
    const rect = target.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${rect.bottom + box.height + 12 < innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - box.height - 8)}px`;
  }
  document.addEventListener('mouseover', event => { const target = event.target.closest('abbr[data-definition]'); if (target) show(target); });
  document.addEventListener('mouseout', event => { if (event.target.closest('abbr[data-definition]')) timer = setTimeout(hide, 180); });
  tooltip.addEventListener('mouseenter', () => clearTimeout(timer));
  tooltip.addEventListener('mouseleave', hide);
  document.addEventListener('focusin', event => {
    const term = event.target.matches('abbr[data-definition]') ? event.target : event.target.matches('a') ? event.target.querySelector('abbr[data-definition]') : null;
    if (term) show(term);
  });
  document.addEventListener('focusout', event => { if (event.target === owner || event.target.contains(owner)) hide(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  document.addEventListener('scroll', hide, true);
}

function renderTimeline(exercise, target, copy, glossary) {
  const timeline = exercise.timeline;
  const entries = [
    ['Registration', timeline.registration.at, timeline.registration.url],
    ['Run start', timeline.run.start],
    ['Run end', timeline.run.end],
    ['Output committed', timeline.artifact_commit.at],
    ['Result posted', timeline.result.at, timeline.result.url]
  ];
  function timestamp(value, timeZone) {
    return new Intl.DateTimeFormat('en-US', {timeZone, month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', ...(value.match(/:\d\dZ$/) && value.split(':').length > 2 ? {second:'2-digit'} : {}), hour12: timeZone !== 'UTC'}).format(new Date(value));
  }
  target.innerHTML = `<ol class="timeline-events">${entries.map(([label, value, url]) => `<li><strong>${url ? `<a href="${escapeHTML(url)}">${label} <span aria-hidden="true">↗</span></a>` : label}</strong><time datetime="${escapeHTML(value)}">${timestamp(value, 'UTC')} UTC</time><span>${timestamp(value, 'America/New_York')} ET</span></li>`).join('')}</ol><div class="timeline-copy">${markdown(copy)}</div>`;
  addGlossary(target, glossary);
}

function renderDrill(cards, glossary, title) {
  const target = section('drill', title);
  target.innerHTML += `<p class="section-note">Use Flip to check your answer; arrow keys move between cards.</p><div class="drill-meta mono"><span id="drill-progress" aria-live="polite"></span><span id="drill-side"></span></div><div id="drill-card" class="drill-card"><div id="drill-content" aria-live="polite" aria-atomic="true"></div></div><div class="control-row"><button type="button" id="drill-prev">Previous</button><button type="button" id="drill-flip">Flip</button><button type="button" id="drill-next">Next</button><button type="button" id="drill-shuffle">Shuffle</button></div>`;
  const card = target.querySelector('#drill-card');
  let deck = [...cards], index = 0, back = false;
  function render() {
    target.querySelector('#drill-progress').textContent = `Card ${index + 1} / ${deck.length}`;
    target.querySelector('#drill-side').textContent = back ? 'answer' : 'prompt';
    const content = target.querySelector('#drill-content');
    content.innerHTML = markdown(back ? deck[index].answer : deck[index].question);
    card.classList.toggle('back', back);
    addGlossary(content, glossary);
  }
  function flip() { back = !back; render(); }
  function move(delta) { index = (index + delta + deck.length) % deck.length; back = false; render(); }
  card.addEventListener('click', event => { if (!event.target.closest('abbr')) flip(); });
  target.querySelector('#drill-flip').addEventListener('click', flip);
  target.querySelector('#drill-prev').addEventListener('click', () => move(-1));
  target.querySelector('#drill-next').addEventListener('click', () => move(1));
  target.querySelector('#drill-shuffle').addEventListener('click', () => {
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    index = 0; back = false; render();
  });
  target.addEventListener('keydown', event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); } });
  render();
}

function setupTour(steps, glossary) {
  const dialog = document.querySelector('#tour-dialog');
  const back = dialog.querySelector('#tour-back');
  const next = dialog.querySelector('#tour-next');
  let index = 0, highlighted, trigger;
  function render() {
    highlighted?.classList.remove('tour-highlight');
    const step = steps[index];
    highlighted = document.getElementById(step.target);
    highlighted?.classList.add('tour-highlight');
    highlighted?.scrollIntoView({block:'start', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    dialog.querySelector('#tour-count').textContent = `${index + 1} / ${steps.length}`;
    dialog.querySelector('#tour-title').innerHTML = inline(step.title);
    dialog.querySelector('#tour-body').innerHTML = markdown(step.body);
    addGlossary(dialog.querySelector('#tour-title'), glossary);
    addGlossary(dialog.querySelector('#tour-body'), glossary);
    back.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? 'Finish' : 'Next';
    // If Back just became disabled, keep keyboard focus inside the dialog.
    if (document.activeElement === back && back.disabled) next.focus();
  }
  document.querySelector('#tour-start').addEventListener('click', event => {
    trigger = event.currentTarget; index = 0; dialog.showModal(); render(); next.focus();
  });
  back.addEventListener('click', () => { if (index > 0) { index--; render(); } });
  next.addEventListener('click', () => { if (index === steps.length - 1) dialog.close(); else { index++; render(); } });
  dialog.querySelector('#tour-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { highlighted?.classList.remove('tour-highlight'); trigger?.focus({preventScroll:true}); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { const tip = document.querySelector('#glossary-tooltip'); event.preventDefault(); if (!tip.hidden) { tip.hidden = true; return; } dialog.close(); }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}

async function start() {
  const [dataResponse, copyResponse] = await Promise.all(['./data.json', './copy.json'].map(path => fetch(new URL(path, import.meta.url))));
  for (const response of [dataResponse, copyResponse]) if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
  const data = await dataResponse.json();
  const page = await copyResponse.json();
  main.addEventListener('scorecard:chart-render', event => addGlossary(event.target, page.glossary));
  document.querySelector('#load-status').remove();
  const hero = document.createElement('header');
  hero.className = 'scorecard-hero';
  hero.innerHTML = `<p class="eyebrow">Microcosm Dynamics · Replication</p><h1>${inline(page.title)}</h1><div class="scorecard-lede">${markdown(page.intro)}</div><div class="control-row"><button type="button" id="tour-start">Guided tour <span aria-hidden="true">→</span></button><a class="text-link" href="#drill">Check yourself →</a></div>`;
  main.append(hero);
  const summaries = section('summaries', page.summaryTitle);
  summaries.innerHTML += `<div class="summary-grid">${page.cards.map((card, i) => `<article class="summary-card"><h3><a href="#${data.exercises[i].id}">${inline(card.title)}</a></h3><p>${inline(card.policy)}</p><p>${inline(card.result)}</p><p class="verdict"><span>${inline(card.verdict)}</span><span aria-hidden="true">→</span></p></article>`).join('')}</div>`;
  const method = section('method', page.method.title);
  method.innerHTML += `<ol class="method-stepper">${page.method.steps.map((step, i) => `<li><span class="step-number mono" aria-hidden="true">${i + 1}</span>${markdown(step)}</li>`).join('')}</ol><div class="method-notes">${page.method.notes.map(note => markdown(note)).join('')}</div><div class="timeline-panel"><div class="timeline-heading"><h3>${inline(page.method.timelineTitle)}</h3><label for="timeline-exercise">Show timeline <select id="timeline-exercise">${data.exercises.map(ex => `<option value="${ex.id}">${escapeHTML(ex.number)} · ${escapeHTML(ex.short)}</option>`).join('')}</select></label></div><div id="timeline-content"></div></div>`;
  const timelineContent = method.querySelector('#timeline-content');
  renderTimeline(data.exercises[0], timelineContent, page.method.timelines[0], page.glossary);
  method.querySelector('select').addEventListener('change', event => {
    const index = data.exercises.findIndex(ex => ex.id === event.target.value);
    renderTimeline(data.exercises[index], timelineContent, page.method.timelines[index], page.glossary);
  });
  const desktop = matchMedia('(min-width: 760px)');
  const automaticDetailStates = new WeakMap();
  function setDetailOpen(detail, open) {
    if (detail.open === open) return;
    automaticDetailStates.set(detail, open);
    detail.open = open;
  }
  for (const [index, exercise] of data.exercises.entries()) {
    const copy = page.exercises[index];
    const panel = section(exercise.id, copy.title, 'exercise-panel');
    panel.innerHTML += `<p class="exercise-source">${escapeHTML(exercise.source)} · ${escapeHTML(exercise.kind)}</p><div class="exercise-chart"></div><div class="exercise-copy"></div>`;
    renderExerciseChart(exercise, panel.querySelector('.exercise-chart'));
    if (exercise.precision_note) {
      const note = document.createElement('p');
      note.className = 'precision-note';
      note.textContent = exercise.precision_note;
      panel.querySelector('.exercise-chart').after(note);
    }
    const prose = panel.querySelector('.exercise-copy');
    for (const subsection of copy.sections) {
      const detail = document.createElement('details');
      detail.className = 'copy-section';
      detail.addEventListener('toggle', event => {
        // Native toggle events also fire after assigning open programmatically.
        const expected = automaticDetailStates.get(detail);
        automaticDetailStates.delete(detail);
        if (expected !== undefined && detail.open === expected) return;
        if (event.isTrusted) detail.dataset.userToggled = 'true';
      });
      setDetailOpen(detail, desktop.matches);
      detail.innerHTML = `<summary><h3>${inline(subsection.title)}</h3></summary><div class="copy-body">${markdown(subsection.body)}</div>`;
      if (subsection.title === 'Registered alternatives') {
        const chart = document.createElement('div');
        chart.className = 'alternatives-chart';
        detail.querySelector('.copy-body').prepend(chart);
        renderAlternatives(exercise, chart);
      }
      prose.append(detail);
    }
  }
  const reading = section('reading', page.reading.title, 'reading-section');
  reading.innerHTML += markdown(page.reading.body);
  const next = section('next', page.next.title, 'next-section');
  next.innerHTML += markdown(page.next.body);
  const glossary = section('glossary', page.glossaryTitle);
  glossary.innerHTML += `<dl class="glossary-list">${page.glossary.map(entry => `<div><dt>${inline(entry.term)}</dt><dd>${inline(entry.definition)}</dd></div>`).join('')}</dl>`;
  renderDrill(page.drill, page.glossary, page.drillTitle);
  const presenter = document.createElement('details');
  presenter.id = 'presenter';
  presenter.className = 'presenter-notes score-section';
  presenter.innerHTML = `<summary><h2>${inline(page.presenterTitle)}</h2></summary>${page.presenter.map(note => `<h3>${inline(note.title)}</h3>${markdown(note.body)}`).join('')}`;
  main.append(presenter);
  addGlossary(main, page.glossary);
  setupGlossaryTooltip();
  setupTour(page.tour, page.glossary);
  desktop.addEventListener('change', event => { document.querySelectorAll('.copy-section').forEach(detail => { if (!detail.dataset.userToggled) setDetailOpen(detail, event.matches); }); });
  // The page renders after its fetch, and web fonts reflow it again, so scroll to a deep link only once both settle.
  if (location.hash) document.fonts.ready.then(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
}

start().catch(error => {
  console.error('Scorecard could not load', error);
  let status = document.querySelector('#load-status');
  if (!status) { status = document.createElement('p'); main.prepend(status); }
  status.setAttribute('role', 'alert');
  status.innerHTML = 'The scorecard could not load. Please reload, or <a href="/dynamics/scorecard/data.json">read the source data</a>.';
});
