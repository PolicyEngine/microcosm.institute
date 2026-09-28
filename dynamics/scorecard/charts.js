const SVG_NS = 'http://www.w3.org/2000/svg';
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
const chartNumberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const integerFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
let alternativesChartCount = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgElement(tag, attributes, text) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes || {}).forEach(([name, value]) => node.setAttribute(name, value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function format(value, signed = false) {
  if (!Number.isFinite(value)) return 'Not estimated';
  const result = numberFormat.format(Object.is(value, -0) ? 0 : value).replace('-', '−');
  return signed && value > 0 ? `+${result}` : result;
}

function chartFormat(value, signed = false) {
  const result = chartNumberFormat.format(Object.is(value, -0) ? 0 : value).replace('-', '−');
  return signed && value > 0 ? `+${result}` : result;
}

function comparatorName(exercise) {
  return exercise.comparator.match(/^DYNASIM\d+/)?.[0] || exercise.comparator;
}

function noiseOf(cell) {
  return Object.hasOwn(cell, 'noise') ? cell.noise : cell.se;
}

function floorOf(cell) {
  return typeof cell.floor === 'object' ? cell.floor?.mean : cell.floor;
}

function levelInterval(cell, index) {
  // Each printed whole-percent level has half the uncertainty of its difference.
  const halfWidth = (cell.interval[1] - cell.interval[0]) / 4;
  return [cell.dynasim_levels[index] - halfWidth, cell.dynasim_levels[index] + halfWidth];
}

function intervalText(interval) {
  return `${format(interval[0])} to ${format(interval[1])}`;
}

function cellDescription(exercise, cell, mode, phase) {
  const name = comparatorName(exercise);
  if (mode === 'levels') {
    const descriptions = [
      ['Cell', cell.label],
      ['Stage', phase === 0 ? 'Before' : 'After'],
      ['Ours: before → after', `${format(cell.ours_levels[0])} → ${format(cell.ours_levels[1])} %`],
      [`${name}: before → after`, `${format(cell.dynasim_levels[0])} → ${format(cell.dynasim_levels[1])} %`],
      [`${name} interval: before`, `${intervalText(levelInterval(cell, 0))} %`],
      [`${name} interval: after`, `${intervalText(levelInterval(cell, 1))} %`],
      ['Gap at this stage', `${format(cell.ours_levels[phase] - cell.dynasim_levels[phase], true)} pp`],
      ['Noise for levels', 'Not estimated; the change SE is not a level SE'],
    ];
    if (Number.isFinite(cell.n)) descriptions.push(['Sample n', integerFormat.format(cell.n)]);
    return descriptions;
  }
  const descriptions = [
    ['Cell', cell.label],
    ['Ours', `${format(cell.ours)} ${exercise.unit}`],
    [name, `${format(cell.dynasim)} ${exercise.unit}`],
    [`${name} interval`, `${intervalText(cell.interval)} ${exercise.unit}`],
    ['Gap (ours − comparator)', `${format(cell.gap, true)} pp`],
    [Object.hasOwn(cell, 'noise') ? 'Noise bar' : 'Noise bar: design SE',
      Number.isFinite(noiseOf(cell)) ? `±${format(noiseOf(cell))} pp` : 'Not estimated; no bar'],
    ['Noise floor', Number.isFinite(floorOf(cell)) ? `±${format(floorOf(cell))} pp` : 'Not estimated'],
  ];
  if (Number.isFinite(cell.draw_sd)) descriptions.push(['Spread across draws', format(cell.draw_sd)]);
  if (Object.hasOwn(cell, 'noise') && Number.isFinite(cell.se)) descriptions.push(['Design SE', `±${format(cell.se)} pp`]);
  if (Number.isFinite(cell.n)) descriptions.push(['Sample n', integerFormat.format(cell.n)]);
  if (cell.no_switcher) descriptions.push(['Sampling note', 'No switcher; uncertainty is not estimated']);
  if (cell.small_cell) descriptions.push(['Sampling note', 'Small cell']);
  // Source: fra68-oneshot-reg15-20260925/COMPARISON.md:58-61.
  if (cell.reading_not_measurement) descriptions.push(['Comparator note', 'The figure draws no bar. This is a reading; only the lower end of the interval is a real chart bound.']);
  return descriptions;
}

function createTooltip(host, id) {
  const tooltip = element('div', 'sc-chart-tooltip');
  tooltip.id = id;
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  host.append(tooltip);
  let activeMark;
  let dismissTimer;

  function hide() {
    tooltip.hidden = true;
    activeMark?.removeAttribute('aria-describedby');
    activeMark = undefined;
  }

  function delayedHide() {
    clearTimeout(dismissTimer);
    dismissTimer = setTimeout(() => {
      if (!tooltip.matches(':hover') && !activeMark?.matches(':hover, :focus')) hide();
    }, 100);
  }

  function show(mark, description) {
    clearTimeout(dismissTimer);
    activeMark?.removeAttribute('aria-describedby');
    activeMark = mark;
    mark.setAttribute('aria-describedby', id);
    const list = element('dl');
    description.forEach(([label, value]) => {
      list.append(element('dt', '', label), element('dd', '', value));
    });
    tooltip.replaceChildren(list);
    tooltip.hidden = false;
    const target = mark.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    const pad = 12;
    tooltip.style.left = `${Math.max(pad, Math.min(target.left, window.innerWidth - box.width - pad))}px`;
    const below = target.bottom + pad;
    tooltip.style.top = `${Math.max(pad, below + box.height < window.innerHeight ? below : target.top - box.height - pad)}px`;
  }

  tooltip.addEventListener('pointerenter', () => clearTimeout(dismissTimer));
  tooltip.addEventListener('pointerleave', delayedHide);
  host.addEventListener('keydown', event => {
    if (event.key === 'Escape') hide();
  });
  document.addEventListener('pointerdown', e => {
    if (activeMark && !activeMark.contains(e.target) && !tooltip.contains(e.target)) hide();
  });
  // A scrolled chart must not leave a floating tooltip at the old mark location.
  host.addEventListener('scroll', event => {
    if (event.target !== tooltip) hide();
  }, true);

  return {
    id,
    hide,
    bind(mark, description) {
      mark.setAttribute('tabindex', '0');
      mark.setAttribute('role', 'button');
      mark.setAttribute('aria-label', `${description[0][1]}`);
      mark.addEventListener('pointerenter', () => show(mark, description));
      mark.addEventListener('pointerleave', delayedHide);
      mark.addEventListener('focus', () => show(mark, description));
      mark.addEventListener('blur', delayedHide);
      mark.addEventListener('click', () => show(mark, description));
      mark.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          show(mark, description);
        }
      });
    },
  };
}

function ticksFor(minimum, maximum, intervals = 5) {
  const rawStep = (maximum - minimum) / intervals;
  const power = 10 ** Math.floor(Math.log10(rawStep || 1));
  const step = [1, 2, 2.5, 5, 10].find(value => value * power >= rawStep) * power;
  const min = Math.floor(minimum / step) * step;
  const max = Math.ceil(maximum / step) * step;
  const ticks = [];
  for (let tick = min; tick <= max + step / 2; tick += step) ticks.push(tick);
  return { min, max, ticks };
}

function addLine(svg, x1, y1, x2, y2, className) {
  svg.append(svgElement('line', { x1, y1, x2, y2, class: className }));
}

function addMark(svg, value, interval, x, y, series, tooltip, description, floor, focusable = true) {
  const group = svgElement('g', { class: `sc-mark sc-mark-${series}` });
  if (interval) {
    const lo = x(interval[0]);
    const hi = x(interval[1]);
    if (series === 'dynasim') {
      group.append(svgElement('rect', {
        x: lo, y: y - 6, width: Math.max(hi - lo, 1), height: 12, class: 'sc-interval-band',
      }));
    }
    group.append(svgElement('line', { x1: lo, x2: hi, y1: y, y2: y, class: 'sc-noise-bar' }));
    // Caps on a bar narrower than the dot merge with it into a square; the tooltip still gives the value.
    if (hi - lo >= 14) {
      [lo, hi].forEach(endpoint => group.append(svgElement('line', {
        x1: endpoint, x2: endpoint, y1: y - 4, y2: y + 4, class: 'sc-noise-bar',
      })));
    }
  }
  if (Number.isFinite(floor)) {
    group.append(svgElement('line', {
      x1: x(value - floor), x2: x(value + floor), y1: y + 8, y2: y + 8, class: 'sc-floor-bar',
    }));
  }
  const cx = x(value);
  if (series === 'ours') {
    group.append(svgElement('circle', { cx, cy: y, r: 4.5, class: 'sc-point' }));
  } else {
    group.append(svgElement('path', {
      d: `M ${cx} ${y - 6} L ${cx + 6} ${y} L ${cx} ${y + 6} L ${cx - 6} ${y} Z`,
      class: 'sc-point',
    }));
  }
  group.append(svgElement('circle', { cx, cy: y, r: 17, class: 'sc-mark-target' }));
  tooltip.bind(group, description);
  if (!focusable) { group.setAttribute('tabindex', '-1'); group.setAttribute('aria-hidden', 'true'); }
  svg.append(group);
}

function drawChart(exercise, mode, width, tooltip) {
  const levels = mode === 'levels';
  const cells = exercise.cells;
  const isDesign = Object.hasOwn(cells[0], 'ours_levels');
  const grouped = Object.hasOwn(cells[0], 'option');
  const seriesName = comparatorName(exercise);
  const values = [0];
  cells.forEach(cell => {
    if (levels) {
      values.push(...cell.ours_levels, ...levelInterval(cell, 0), ...levelInterval(cell, 1));
    } else {
      const uncertainty = Math.max(noiseOf(cell) || 0, isDesign ? floorOf(cell) || 0 : 0);
      values.push(cell.ours - uncertainty, cell.ours + uncertainty, ...cell.interval);
    }
  });
  const narrow = width < 560;
  const { min, max, ticks } = ticksFor(Math.min(...values), Math.max(...values), narrow ? 4 : 5);
  const left = narrow ? 8 : (levels ? 155 : 115);
  const right = 46;
  const top = narrow ? 92 : 64;
  const rowHeight = (levels ? 86 : 64) + (narrow ? 22 : 0);
  let nextY = top;
  let previousOption;
  const rows = cells.map(cell => {
    let headingY;
    if (grouped && cell.option !== previousOption) {
      headingY = nextY;
      nextY += narrow ? 44 : 30;
      previousOption = cell.option;
    }
    const row = { cell, y: nextY, headingY };
    nextY += rowHeight;
    return row;
  });
  const axisY = nextY - rowHeight / 2 + 14;
  const height = axisY + 56;
  const x = value => left + ((value - min) / (max - min || 1)) * (width - left - right);
  const title = `${exercise.title}: ${levels ? 'levels before and after' : exercise.statistic}`;
  const largest = [...cells].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 2);
  const summary = `${title}. ${integerFormat.format(cells.length)} cells. Green circles show ours; violet diamonds and bands show ${seriesName}. ${levels ? 'Before and after levels are paired within each cell; no uncertainty for our levels was estimated.' : `Our horizontal bars show ${isDesign ? 'design standard errors, with dashed noise floors' : 'noise'}. Largest gap: ${largest[0].label}, ${format(largest[0].gap, true)} percentage points.`} Use the table view for all values.`;
  const svg = svgElement('svg', {
    viewBox: `0 0 ${width} ${height}`, width, height, class: 'sc-dot-chart',
    role: 'group', 'aria-roledescription': 'chart', 'aria-label': summary,
  });
  svg.append(svgElement('title', {}, title), svgElement('desc', {}, summary));
  svg.append(svgElement('text', { x: 0, y: 22, class: 'sc-axis-title' }, exercise.cell_axis));
  svg.append(svgElement('text', { x: width - right, y: 22, 'text-anchor': 'end', class: 'sc-axis-title' }, levels ? 'Poverty rate (%)' : `Value (${exercise.unit})`));
  ticks.forEach(tick => {
    const tx = x(tick);
    addLine(svg, tx, top - 20, tx, axisY, tick === 0 ? 'sc-grid sc-zero' : 'sc-grid');
    const anchor = narrow && tick === min ? 'start' : narrow && tick === max ? 'end' : 'middle';
    svg.append(svgElement('text', { x: tx, y: axisY + 25, 'text-anchor': anchor, class: 'sc-tick' }, chartFormat(tick)));
  });
  addLine(svg, left, axisY, width - right, axisY, 'sc-grid');
  rows.forEach(({ cell, y, headingY }, index) => {
    if (headingY !== undefined) {
      svg.append(svgElement('text', { x: 0, y: headingY, class: 'sc-group-label' }, `Option ${integerFormat.format(cell.option)}`));
      addLine(svg, left, headingY - 5, width - right, headingY - 5, 'sc-group-rule');
    }
    const label = grouped ? cell.group : cell.label;
    svg.append(svgElement('text', { x: 0, y: narrow ? y - 18 : y + 5, class: 'sc-row-label' }, label));
    const phases = levels ? [0, 1] : [undefined];
    phases.forEach(phase => {
      const cy = levels ? y + phase * 29 + (narrow ? 24 : 0) : y;
      const ours = levels ? cell.ours_levels[phase] : cell.ours;
      const dynasim = levels ? cell.dynasim_levels[phase] : cell.dynasim;
      const interval = levels ? levelInterval(cell, phase) : cell.interval;
      const noise = levels ? undefined : noiseOf(cell);
      const oursY = cy - 5;
      const dynasimY = cy + 5;
      if (levels) {
        svg.append(svgElement('text', { x: narrow ? left : left - 12, y: cy + (narrow ? -10 : 4), 'text-anchor': narrow ? 'start' : 'end', class: 'sc-phase-label' }, phase === 0 ? 'Before' : 'After'));
      }
      addLine(svg, x(ours), oursY, x(dynasim), dynasimY, 'sc-gap-connector');
      const description = cellDescription(exercise, cell, mode, phase);
      addMark(svg, dynasim, interval, x, dynasimY, 'dynasim', tooltip, description, undefined, false);
      addMark(svg, ours, Number.isFinite(noise) ? [ours - noise, ours + noise] : null,
        x, oursY, 'ours', tooltip, description, isDesign && !levels ? floorOf(cell) : undefined);
      if (!levels && largest.includes(cell)) {
        const mid = (x(ours) + x(dynasim)) / 2;
        const labelX = Math.max(55, Math.min(mid, width - 55));
        svg.append(svgElement('text', { x: labelX, y: cy + 29, 'text-anchor': 'middle', class: 'sc-gap-label' }, `${chartFormat(cell.gap, true)} pp gap`));
      }
      if (index === 0 && (!levels || phase === 0)) {
        const oursX = Math.max(36, Math.min(x(ours) - 10, width - 110));
        const comparatorX = Math.max(oursX + 12, Math.min(x(dynasim) + 10, width - 85));
        const labelY = narrow ? 48 : oursY - 17;
        svg.append(svgElement('text', { x: oursX, y: labelY, 'text-anchor': 'end', class: 'sc-series-label' }, 'Ours'));
        svg.append(svgElement('text', { x: comparatorX, y: labelY, class: 'sc-series-label' }, seriesName));
      }
    });
  });
  return svg;
}

function buildTable(exercise, mode) {
  const levels = mode === 'levels';
  const design = Object.hasOwn(exercise.cells[0], 'ours_levels');
  const hasSample = exercise.cells.some(cell => Number.isFinite(cell.n));
  const hasDrawSpread = !levels && exercise.cells.some(cell => Number.isFinite(cell.draw_sd));
  const hasAdditionalSE = !levels && !design && exercise.cells.some(cell => Number.isFinite(cell.se));
  const seriesName = comparatorName(exercise);
  const table = element('table', 'sc-data-table');
  table.append(element('caption', '', `${exercise.statistic}${levels ? ' · levels before → after (%)' : ` · change or share (${exercise.unit})`}`));
  const headers = levels
    ? [exercise.cell_axis, 'Ours before', 'Ours after', `${seriesName} before`, `${seriesName} after`, 'Interval before', 'Interval after', 'Gap before (pp)', 'Gap after (pp)', 'Noise for levels']
    : [exercise.cell_axis, 'Ours', seriesName, `${seriesName} interval`, 'Gap (pp)', design ? 'Design SE (pp)' : 'Noise (pp)', 'Floor (pp)'];
  if (hasDrawSpread) headers.push('Draw spread (pp)');
  if (hasAdditionalSE) headers.push('Design SE (pp)');
  if (hasSample) headers.push('n');
  const thead = element('thead');
  const headRow = element('tr');
  headers.forEach(header => {
    const th = element('th', '', header);
    th.scope = 'col';
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = element('tbody');
  exercise.cells.forEach(cell => {
    const tr = element('tr');
    const th = element('th', '', cell.label);
    th.scope = 'row';
    tr.append(th);
    const values = levels
      ? [format(cell.ours_levels[0]), format(cell.ours_levels[1]), format(cell.dynasim_levels[0]), format(cell.dynasim_levels[1]), intervalText(levelInterval(cell, 0)), intervalText(levelInterval(cell, 1)), format(cell.ours_levels[0] - cell.dynasim_levels[0], true), format(cell.ours_levels[1] - cell.dynasim_levels[1], true), 'Not estimated']
      : [format(cell.ours), format(cell.dynasim), intervalText(cell.interval), format(cell.gap, true), format(noiseOf(cell)), format(floorOf(cell))];
    if (hasDrawSpread) values.push(format(cell.draw_sd));
    if (hasAdditionalSE) values.push(format(cell.se));
    if (hasSample) values.push(Number.isFinite(cell.n) ? integerFormat.format(cell.n) : 'Not reported');
    values.forEach(value => tr.append(element('td', '', value)));
    tbody.append(tr);
  });
  table.append(thead, tbody);
  return table;
}

/** Render an exercise's interactive figure and accessible table in an empty host. */
export function renderExerciseChart(exercise, host) {
  host.classList.add('sc-chart');
  const state = { mode: 'change', table: false };
  const controls = element('div', 'sc-chart-controls');
  const legend = element('div', 'sc-chart-legend');
  [['ours', 'Ours'], ['dynasim', comparatorName(exercise)]].forEach(([series, label]) => {
    const item = element('span', 'sc-legend-item');
    item.append(element('span', `sc-legend-swatch sc-legend-${series}`), document.createTextNode(label));
    legend.append(item);
  });
  controls.append(legend);
  const view = element('div', 'sc-chart-view');
  view.id = `${exercise.id}-chart-view`;
  view.setAttribute('role', 'region');
  view.setAttribute('aria-label', `${exercise.short} chart and table`);
  const tableToggle = element('button', 'sc-chart-button', 'Table view');
  tableToggle.type = 'button';
  tableToggle.setAttribute('aria-pressed', 'false');
  tableToggle.setAttribute('aria-controls', view.id);
  tableToggle.addEventListener('click', () => {
    state.table = !state.table;
    tableToggle.setAttribute('aria-pressed', String(state.table));
    tableToggle.textContent = state.table ? 'Show chart' : 'Table view';
    render();
  });
  controls.append(tableToggle);
  const modeButtons = [];
  if (Object.hasOwn(exercise.cells[0], 'ours_levels')) {
    const modes = element('div', 'sc-chart-modes');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'Poverty statistic');
    [['change', 'Change (Δ)'], ['levels', 'Levels (before → after)']].forEach(([value, label]) => {
      const button = element('button', 'sc-chart-button', label);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(value === state.mode));
      button.addEventListener('click', () => {
        state.mode = value;
        modeButtons.forEach(([mode, control]) => control.setAttribute('aria-pressed', String(mode === value)));
        render();
      });
      modeButtons.push([value, button]);
      modes.append(button);
    });
    controls.append(modes);
  }
  const note = element('p', 'sc-chart-note');
  note.id = `${exercise.id}-chart-note`;
  view.setAttribute('aria-describedby', note.id);
  host.append(controls, view, note);
  const tooltip = createTooltip(host, `${exercise.id}-chart-tooltip`);
  let currentWidth;

  function render() {
    tooltip.hide();
    currentWidth = Math.max(320, Math.floor(host.getBoundingClientRect().width));
    view.classList.toggle('sc-chart-scroll', state.table);
    if (state.table) view.tabIndex = 0;
    else view.removeAttribute('tabindex');
    view.replaceChildren(state.table ? buildTable(exercise, state.mode) : drawChart(exercise, state.mode, currentWidth, tooltip));
    note.textContent = state.mode === 'levels'
      ? 'Before and after are paired within each cell. Violet bands show printed rounding intervals. Uncertainty for our levels was not estimated.'
      : Object.hasOwn(exercise.cells[0], 'ours_levels')
        ? 'Green bars: design SE. Dashed green bars: noise floor. Cells without estimated uncertainty have no bar. Hover or focus a mark for details.'
        : 'Green bars: our noise. Violet bands: the comparator interval. Hover or focus a mark for details.';
    host.dispatchEvent(new CustomEvent('scorecard:chart-render', { bubbles: true }));
  }

  render();
  const observer = new ResizeObserver(() => {
    const nextWidth = Math.max(320, Math.floor(host.getBoundingClientRect().width));
    if (!state.table && nextWidth !== currentWidth) render();
  });
  observer.observe(host);
  return { destroy() { observer.disconnect(); tooltip.hide(); } };
}

/** A single-hue bar comparison; the registered headline retains its emphasis. */
export function renderAlternatives(exercise, host) {
  host.classList.add('sc-alternatives');
  const quantitative = exercise.rows.filter(row => Number.isFinite(row.mean_abs_gap));
  const identical = exercise.rows.filter(row => row.identical_to);
  const maximum = Math.max(...quantitative.map(row => row.mean_abs_gap));
  const headline = exercise.rows[0].id;
  const tooltip = createTooltip(host, `${exercise.id}-alternatives-tooltip-${alternativesChartCount++}`);
  const chart = element('div', 'sc-alternative-bars');
  chart.setAttribute('role', 'group');
  chart.setAttribute('aria-label', `Registered alternatives: mean absolute gap in percentage points. ${quantitative.map(row => `${row.id}${row.id === headline ? ', headline' : ''}, ${row.change}: ${format(row.mean_abs_gap)}`).join('; ')}.`);
  const heading = element('p', 'sc-alternative-axis', 'Mean absolute gap (pp)');
  const controls = element('div', 'sc-chart-controls');
  const tableToggle = element('button', 'sc-chart-button', 'Table view');
  tableToggle.type = 'button';
  tableToggle.setAttribute('aria-pressed', 'false');
  const view = element('div', 'sc-chart-view');
  view.id = `${tooltip.id}-view`;
  view.setAttribute('role', 'region');
  view.setAttribute('aria-label', `${exercise.short} registered alternatives`);
  tableToggle.setAttribute('aria-controls', view.id);
  controls.append(tableToggle);
  host.append(heading, controls, view);
  quantitative.forEach(row => {
    const item = element('div', `sc-alternative-row${row.id === headline ? ' sc-alternative-headline' : ''}`);
    const id = element('span', 'sc-alternative-id', row.id);
    const track = element('span', 'sc-alternative-track');
    const bar = element('span', 'sc-alternative-bar');
    bar.style.width = `${row.mean_abs_gap / maximum * 100}%`;
    track.append(bar);
    const value = element('span', 'sc-alternative-value', chartFormat(row.mean_abs_gap));
    const label = element('span', 'sc-alternative-description', `${row.change}${row.id === headline ? ' · scored headline' : ''}`);
    item.append(id, track);
    if (row.id === headline) item.append(value);
    item.append(label);
    tooltip.bind(item, [['Alternative', row.id], ['Change', row.change], ['Mean absolute gap', `${format(row.mean_abs_gap)} pp`], ...(row.id === headline ? [['Status', 'Scored headline']] : [])]);
    chart.append(item);
  });
  const table = element('table', 'sc-data-table');
  table.append(element('caption', '', 'Registered alternatives: mean absolute gap (pp)'));
  const thead = element('thead');
  const headRow = element('tr');
  ['Alternative', 'Change', 'Mean absolute gap (pp)', 'Headline'].forEach(label => {
    const th = element('th', '', label);
    th.scope = 'col';
    headRow.append(th);
  });
  thead.append(headRow);
  const tbody = element('tbody');
  exercise.rows.forEach(row => {
    const tr = element('tr');
    const th = element('th', '', row.id);
    th.scope = 'row';
    tr.append(th, element('td', '', row.change),
      element('td', '', row.identical_to ? `Identical to ${row.identical_to}` : format(row.mean_abs_gap)),
      element('td', '', row.id === headline ? 'Scored headline' : ''));
    tbody.append(tr);
  });
  table.append(thead, tbody);
  let tableView = false;
  tableToggle.addEventListener('click', () => {
    tableView = !tableView;
    tooltip.hide();
    tableToggle.setAttribute('aria-pressed', String(tableView));
    tableToggle.textContent = tableView ? 'Show chart' : 'Table view';
    view.classList.toggle('sc-chart-scroll', tableView);
    if (tableView) view.tabIndex = 0;
    else view.removeAttribute('tabindex');
    view.replaceChildren(tableView ? table : chart);
  });
  view.append(chart);
  if (identical.length) {
    const heading = element('p', 'sc-identical-heading', `Identical to ${identical[0].identical_to}`);
    const list = element('ul', 'sc-identical-rows');
    identical.forEach(row => list.append(element('li', '', `${row.id}: ${row.change}`)));
    host.append(heading, list);
  }
}
