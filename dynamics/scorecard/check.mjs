#!/usr/bin/env node
/** Validate the scorecard's published measurements without network access. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dataFile = process.argv[2]
  ? pathToFileURL(resolve(process.argv[2]))
  : new URL('./data.json', import.meta.url);
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const close = (left, right) => finite(left) && finite(right) && Math.abs(left - right) <= 1e-9;
const issueComment = /^https:\/\/github\.com\/PolicyEngine\/microcosm-dynamics\/issues\/42#issuecomment-\d+$/;

try {
  const data = JSON.parse(await readFile(dataFile, 'utf8'));
  check(data.schema === 'dynasim-scorecard/v1', 'Unrecognized data schema');
  const exercises = Array.isArray(data.exercises) ? data.exercises : [];
  check(exercises.length === 4, 'Expected four exercises');
  check(new Set(exercises.map(exercise => exercise.id)).size === exercises.length, 'Exercise identifiers must be unique');
  let cellCount = 0;
  for (const id of ['ex1', 'ex2', 'ex3', 'ex4']) check(exercises.some(exercise => exercise.id === id), `Missing ${id}`);

  for (const exercise of exercises) {
    const cells = Array.isArray(exercise.cells) ? exercise.cells : [];
    check(cells.length > 0, `${exercise.id}: no cells`);
    cellCount += cells.length;
    for (const cell of cells) {
      const label = `${exercise.id} / ${cell.label}`;
      check(finite(cell.ours) && finite(cell.dynasim), `${label}: values must be finite numbers`);
      check(close(cell.gap, cell.ours - cell.dynasim), `${label}: gap ${cell.gap} does not equal ours − DYNASIM3 (${cell.ours - cell.dynasim}) within 1e-9`);
      const interval = cell.interval;
      const validInterval = Array.isArray(interval) && interval.length === 2 && interval.every(finite);
      check(validInterval && interval[0] <= interval[1], `${label}: interval must have finite ordered endpoints`);
      if (exercise.id === 'ex2') {
        check(validInterval && close(interval[0], cell.dynasim - 1) && close(interval[1], cell.dynasim + 1), `${label}: interval must equal DYNASIM3 ± 1`);
      }
    }
    if (exercise.id === 'ex4') {
      check(cells.length === 12, 'ex4: expected exactly 12 cells');
      for (const option of [2, 3, 4, 5]) {
        for (const group of ['All', 'Men', 'Women']) {
          check(cells.filter(cell => cell.option === option && cell.group === group).length === 1, `ex4: expected one cell for option ${option}, ${group}`);
        }
      }
    }

    const timeline = exercise.timeline ?? {};
    const events = [
      ['registration', timeline.registration?.at],
      ['run start', timeline.run?.start],
      ['run end', timeline.run?.end],
      ['artifact commit', timeline.artifact_commit?.at],
      ['result', timeline.result?.at],
    ].map(([name, value]) => [name, Date.parse(value)]);
    for (const [name, timestamp] of events) check(Number.isFinite(timestamp), `${exercise.id}: missing or invalid ${name} timestamp`);
    for (let index = 1; index < events.length; index += 1) {
      check(events[index - 1][1] <= events[index][1], `${exercise.id}: ${events[index - 1][0]} must be no later than ${events[index][0]}`);
    }
    for (const name of ['registration', 'result']) check(issueComment.test(timeline[name]?.url ?? ''), `${exercise.id}: ${name} must link to an issue #42 comment`);
  }

  let urlCount = 0;
  function checkUrls(value, path = 'data') {
    if (typeof value === 'string') {
      for (const match of value.matchAll(/https?:\/\/[^\s<>"'\[\]()]+/g)) {
        urlCount += 1;
        check(issueComment.test(match[0]), `${path}: URL must be an issue #42 comment: ${match[0]}`);
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => checkUrls(item, `${path}[${index}]`));
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) checkUrls(item, `${path}.${key}`);
    }
  }
  checkUrls(data);
  check(urlCount >= exercises.length * 2, 'Registration and result URLs are required');

  const sources = data.sources && typeof data.sources === 'object' ? data.sources : {};
  for (const key of ['ex1_memo', 'ex2_json', 'ex2_memo', 'ex3_json', 'ex3_memo', 'ex4_json', 'ex4_memo']) {
    check(Boolean(sources[key]), `Missing source ${key}`);
  }
  for (const [name, source] of Object.entries(sources)) {
    check(typeof source.path === 'string' && source.path.length > 0, `${name}: missing source path`);
    check(/^[a-f0-9]{64}$/i.test(source.sha256 ?? ''), `${name}: missing or invalid SHA-256`);
  }

  if (errors.length) {
    console.error(`FAIL: ${errors.length} scorecard invariant${errors.length === 1 ? '' : 's'}`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${exercises.length} exercises; ${cellCount} cell gaps and intervals; exercise 2 ±1 intervals; exercise 4 option/group cells; ${exercises.length} ordered timelines; ${urlCount} issue #42 comment URLs; ${Object.keys(sources).length} source SHA-256s.`);
  }
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
