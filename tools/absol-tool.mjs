#!/usr/bin/env node
// absol-tool — the write path for absol state (schemas.md §The toolset).
// Zero dependencies. Mutations are line-splices; untouched content survives
// byte-for-byte. Hand-edits stay legal; `lint` is the conformance check.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import {
  LEDGERS, ITEM_SCALAR_FIELDS, ITEM_BLOCK_FIELDS, ITEM_TYPES, PRIORITIES, TAGS,
  EVENT_TYPES, PORTFOLIO_STATUSES, PORTFOLIO_FIELDS,
  parseLedger, parseRun, parsePortfolio, getField, parseTags, itemToJSON, deriveViews,
  spliceLines, isoNow, blockLines, nextId,
} from './lib/parse.mjs';

const DEFAULT_PORTFOLIO = '/mnt/nas/dev/projects/absol/portfolio.md';

// ---------- arg parsing ----------

const argv = process.argv.slice(2);
const verb = argv[0];
const opts = { _: [], field: [], set: [], unset: [] };
const BOOL_FLAGS = ['stdin', 'json', 'all', 'help', 'description-stdin', 'portfolio', 'strict'];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--') && BOOL_FLAGS.includes(a.slice(2))) opts[a.slice(2)] = true;
  else if (a.startsWith('--')) {
    const key = a.slice(2);
    const val = argv[++i];
    if (val === undefined) die(`--${key} needs a value`);
    if (key === 'field' || key === 'set' || key === 'unset') opts[key].push(val);
    else opts[key] = val;
  } else opts._.push(a);
}

function die(msg) { console.error(`absol-tool: ${msg}`); process.exit(2); }
function out(msg) { console.log(msg); }
function save(path, text) { writeFileSync(path, text.replace(/\n*$/, '\n')); }

// ---------- path resolution ----------

function absolDir() {
  const p = resolve(opts.project || '.');
  if (existsSync(join(p, 'inbox.md')) && basename(p) === '.absol') return p;
  const d = join(p, '.absol');
  if (existsSync(d)) return d;
  die(`no .absol/ found at ${p} (use --project <dir>)`);
}

function ledgerPath(dir, ledger) {
  if (!LEDGERS[ledger]) die(`unknown ledger '${ledger}' (inbox | bugs | tech-debt)`);
  return join(dir, `${ledger}.md`);
}

function readFileOr(path, fallback = null) {
  try { return readFileSync(path, 'utf8'); } catch { return fallback; }
}

function archiveTexts(dir) {
  const ad = join(dir, 'archive');
  if (!existsSync(ad)) return [];
  return readdirSync(ad).filter((f) => f.endsWith('.md')).map((f) => readFileSync(join(ad, f), 'utf8'));
}

// Every ID trace in .absol/ — keeps allocation monotonic even for items removed
// before archiving (all three ledgers, archive, run.md, reviews/ + adr/ filenames).
function idEvidence(dir) {
  const texts = archiveTexts(dir);
  for (const l of Object.keys(LEDGERS)) {
    const t = readFileOr(join(dir, `${l}.md`));
    if (t !== null) texts.push(t);
  }
  const run = readFileOr(join(dir, 'run.md'));
  if (run !== null) texts.push(run);
  for (const sub of ['reviews', 'adr']) {
    const d = join(dir, sub);
    if (existsSync(d)) texts.push(readdirSync(d).join('\n'));
  }
  return texts;
}

function findItem(dir, id) {
  for (const ledger of Object.keys(LEDGERS)) {
    const path = ledgerPath(dir, ledger);
    const text = readFileOr(path);
    if (text === null) continue;
    const parsed = parseLedger(text);
    const entry = parsed.entries.find((e) => e.name === id);
    if (entry) return { ledger, path, text, parsed, entry };
  }
  die(`item ${id} not found in any ledger`);
}

function kvPairs(list) {
  return list.map((s) => {
    const eq = s.indexOf('=');
    if (eq < 1) die(`expected key=value, got '${s}'`);
    return [s.slice(0, eq), s.slice(eq + 1)];
  });
}

function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

// ---------- verbs ----------

const verbs = {
  add: {
    help: 'add --ledger inbox|bugs|tech-debt --title "…" [--type T] [--priority P] [--subsystem S] [--field k=v]… [--description-stdin]',
    run() {
      const dir = absolDir();
      if (!opts.ledger || !opts.title) die('add needs --ledger and --title');
      const path = ledgerPath(dir, opts.ledger);
      const text = readFileOr(path);
      if (text === null) die(`${path} does not exist — scaffold the project first`);
      if (opts.type && !ITEM_TYPES.includes(opts.type)) die(`type must be one of ${ITEM_TYPES.join(' | ')}`);
      if (opts.priority && !PRIORITIES.includes(opts.priority)) die(`priority must be one of ${PRIORITIES.join(' | ')}`);
      // allocation floor: <!-- counter: N --> in the preamble keeps IDs monotonic
      // even when an item was removed before leaving any archive trace
      const counterRe = /^<!-- counter: (\d+) -->$/m;
      const cm = text.match(counterRe);
      const floor = cm ? parseInt(cm[1], 10) : 0;
      const derived = nextId(LEDGERS[opts.ledger], text, idEvidence(dir));
      const num = Math.max(parseInt(derived.split('-')[1], 10), floor + 1);
      const id = `${LEDGERS[opts.ledger]}-${String(num).padStart(3, '0')}`;
      const block = ['', `- [item] ${id}`, `  - title: ${opts.title}`];
      if (opts.type) block.push(`  - type: ${opts.type}`);
      if (opts.priority) block.push(`  - priority: ${opts.priority}`);
      if (opts.subsystem) block.push(`  - subsystem: ${opts.subsystem}`);
      for (const [k, v] of kvPairs(opts.field)) block.push(`  - ${k}: ${v}`);
      if (opts['description-stdin']) {
        block.push('  - description: |', ...blockLines(readStdin()));
      }
      // drop a lone "None." placeholder
      let newText = text;
      const lines = text.split('\n');
      const noneIdx = lines.findIndex((l) => l.trim() === 'None.');
      if (noneIdx >= 0) newText = spliceLines(text, noneIdx, 1);
      // maintain the allocation floor
      if (cm) newText = newText.replace(counterRe, `<!-- counter: ${num} -->`);
      else {
        const nl = newText.split('\n');
        const at = nl[0].startsWith('#') ? 1 : 0;
        newText = spliceLines(newText, at, 0, [`<!-- counter: ${num} -->`]);
      }
      newText = newText.replace(/\n*$/, '\n') + block.join('\n').replace(/^\n/, '') + '\n';
      save(path, newText);
      out(id);
    },
  },

  update: {
    help: 'update --id BUG-014 [--set k=v]… [--unset k]… [--block shape|map|plan|description (--stdin | --text "…")]',
    run() {
      const dir = absolDir();
      if (!opts.id) die('update needs --id');
      const { path, text, entry } = findItem(dir, opts.id);
      let newText = text;
      let delta = 0; // line drift from earlier splices
      for (const [k, v] of kvPairs(opts.set)) {
        if (ITEM_BLOCK_FIELDS.includes(k)) die(`'${k}' is a block field — use --block ${k}`);
        if (!ITEM_SCALAR_FIELDS.includes(k)) die(`unknown field '${k}' — scalar fields: ${ITEM_SCALAR_FIELDS.join(', ')}`);
        const f = getField(entry, k);
        if (f) newText = spliceLines(newText, f.line + delta, 1, [`  - ${k}: ${v}`]);
        else {
          const title = getField(entry, 'title');
          const at = (title ? title.line : entry.line) + 1 + delta;
          newText = spliceLines(newText, at, 0, [`  - ${k}: ${v}`]);
          delta += 1;
        }
      }
      for (const k of opts.unset) {
        const f = getField(entry, k);
        if (!f) continue;
        const span = f.isBlock ? f.blockEnd - f.line : 1;
        newText = spliceLines(newText, f.line + delta, span);
        delta -= span;
      }
      if (opts.block) {
        if (![...ITEM_BLOCK_FIELDS].includes(opts.block)) die(`--block must be one of ${ITEM_BLOCK_FIELDS.join(' | ')}`);
        const content = opts.stdin ? readStdin() : opts.text;
        if (content === undefined) die('--block needs --stdin or --text');
        if (!content.trim()) die('block content is empty');
        const body = [`  - ${opts.block}: |`, ...blockLines(content)];
        const f = getField(entry, opts.block);
        if (f && f.isBlock) {
          newText = spliceLines(newText, f.line + delta, f.blockEnd - f.line, body);
        } else {
          // append at end of entry (before trailing blanks)
          const lines = newText.split('\n');
          let at = entry.endLine + delta;
          while (at > entry.line + delta + 1 && lines[at - 1].trim() === '') at--;
          newText = spliceLines(newText, at, 0, body);
        }
      }
      save(path, newText);
      out(`${opts.id} updated`);
    },
  },

  tag: {
    help: 'tag --id BUG-014 --tag rtr|tuning|parked',
    run() { retag(true); },
  },
  untag: {
    help: 'untag --id BUG-014 --tag rtr|tuning|parked',
    run() { retag(false); },
  },

  remove: {
    help: 'remove --id BUG-014',
    run() {
      const dir = absolDir();
      if (!opts.id) die('remove needs --id');
      const { path, text, entry } = findItem(dir, opts.id);
      save(path, spliceLines(text, entry.line, entry.endLine - entry.line));
      out(`${opts.id} removed`);
    },
  },

  'append-event': {
    help: 'append-event --type task-started [--field task=BUG-014.1]… ; stamps system-clock ISO; requires an open run.md',
    run() {
      const dir = absolDir();
      const type = opts.type;
      if (!type || !(type in EVENT_TYPES)) die(`--type must be one of: ${Object.keys(EVENT_TYPES).join(' | ')}`);
      const path = join(dir, 'run.md');
      const text = readFileOr(path);
      if (text === null) die('no open run (run.md missing) — the orchestrator opens runs');
      const fields = kvPairs(opts.field);
      const given = new Set(fields.map(([k]) => k));
      for (const req of EVENT_TYPES[type]) {
        if (!given.has(req)) die(`event '${type}' requires --field ${req}=…`);
      }
      const block = ['', `- [event] ${isoNow()}`, `  - type: ${type}`];
      for (const [k, v] of fields) block.push(`  - ${k}: ${v}`);
      writeFileSync(path, text.replace(/\n*$/, '\n') + block.join('\n').replace(/^\n/, '') + '\n');
      out(`event ${type} appended`);
    },
  },

  query: {
    help: 'query [--ledger x] [--type T] [--priority P] [--tag t] [--id X] — JSON out; derived flags included',
    run() {
      const dir = absolDir();
      let items = [];
      for (const ledger of Object.keys(LEDGERS)) {
        if (opts.ledger && opts.ledger !== ledger) continue;
        const text = readFileOr(ledgerPath(dir, ledger));
        if (text === null) continue;
        for (const e of parseLedger(text).entries) items.push(itemToJSON(e, ledger));
      }
      deriveViews(items);
      if (opts.id) items = items.filter((i) => i.id === opts.id);
      else if (opts.tag !== 'parked') items = items.filter((i) => !i.tags.includes('parked'));
      if (opts.type) items = items.filter((i) => i.type === opts.type);
      if (opts.priority) items = items.filter((i) => i.priority === opts.priority);
      if (opts.tag) items = items.filter((i) => i.tags.includes(opts.tag));
      out(JSON.stringify(items, null, 2));
    },
  },

  lint: {
    help: 'lint [--file path] — whole project by default; exit 1 on errors, 0 on warns only',
    run() {
      const findings = [];
      if (opts.file) lintFile(resolve(opts.file), findings);
      else if (opts.portfolio) lintPortfolio(portfolioPath(), findings);
      else {
        const dir = absolDir();
        for (const ledger of Object.keys(LEDGERS)) {
          const p = ledgerPath(dir, ledger);
          if (existsSync(p)) lintLedgerFile(p, ledger, findings);
          else findings.push({ file: p, line: 0, sev: 'warn', msg: 'ledger file missing' });
        }
        const runPath = join(dir, 'run.md');
        if (existsSync(runPath)) lintRunFile(runPath, findings);
      }
      for (const f of findings) out(`${f.sev.toUpperCase()} ${f.file}:${f.line + 1} ${f.msg}`);
      const errors = findings.filter((f) => f.sev === 'error').length;
      out(`${errors} error(s), ${findings.length - errors} warning(s)`);
      process.exit(errors || (opts.strict && findings.length) ? 1 : 0);
    },
  },

  portfolio: {
    help: 'portfolio list [--json] | get <slug> | add <slug> [--set k=v]… | set <slug> --set k=v… ; --file overrides the default portfolio path',
    run() {
      const sub = opts._[0];
      const path = portfolioPath();
      if (sub === 'list' || sub === 'get') {
        const text = readFileOr(path);
        if (text === null) die(`${path} does not exist`);
        const entries = parsePortfolio(text).entries;
        const json = entries.map((e) => {
          const o = { slug: e.name };
          for (const f of PORTFOLIO_FIELDS) { const fld = getField(e, f); if (fld) o[f] = fld.value; }
          return o;
        });
        if (sub === 'get') {
          const one = json.find((p) => p.slug === opts._[1]);
          if (!one) die(`no portfolio entry '${opts._[1]}'`);
          out(JSON.stringify(one, null, 2));
        } else if (opts.json) out(JSON.stringify(json, null, 2));
        else for (const p of json) out(`${p.slug.padEnd(28)} ${p.status || 'unset'}  ${p.next || ''}`);
        return;
      }
      if (sub === 'add') {
        const slug = opts._[1];
        if (!slug) die('portfolio add <slug>');
        const text = readFileOr(path) ?? '# Portfolio — the estate ledger\n';
        if (parsePortfolio(text).entries.some((e) => e.name === slug)) die(`'${slug}' already exists`);
        const sets = Object.fromEntries(kvPairs(opts.set));
        const block = ['', `- [project] ${slug}`, `  - status: ${sets.status || 'unset'}`];
        for (const f of PORTFOLIO_FIELDS) if (f !== 'status' && sets[f]) block.push(`  - ${f}: ${sets[f]}`);
        validatePortfolioSets(sets);
        writeFileSync(path, text.replace(/\n*$/, '\n') + block.join('\n').replace(/^\n/, '') + '\n');
        out(`${slug} added`);
        return;
      }
      if (sub === 'set') {
        const slug = opts._[1];
        if (!slug || !opts.set.length) die('portfolio set <slug> --set k=v…');
        const text = readFileOr(path);
        if (text === null) die(`${path} does not exist`);
        const entry = parsePortfolio(text).entries.find((e) => e.name === slug);
        if (!entry) die(`no portfolio entry '${slug}'`);
        const sets = Object.fromEntries(kvPairs(opts.set));
        validatePortfolioSets(sets);
        let newText = text; let delta = 0;
        for (const [k, v] of Object.entries(sets)) {
          if (!PORTFOLIO_FIELDS.includes(k)) die(`unknown portfolio field '${k}'`);
          const f = getField(entry, k);
          if (f) newText = spliceLines(newText, f.line + delta, 1, [`  - ${k}: ${v}`]);
          else { newText = spliceLines(newText, entry.line + 1 + delta, 0, [`  - ${k}: ${v}`]); delta += 1; }
        }
        save(path, newText);
        out(`${slug} updated`);
        return;
      }
      die('portfolio needs a subcommand: list | get | add | set');
    },
  },
};

function retag(adding) {
  const dir = absolDir();
  if (!opts.id || !opts.tag) die(`${adding ? 'tag' : 'untag'} needs --id and --tag`);
  if (!TAGS.includes(opts.tag)) die(`tag must be one of ${TAGS.join(' | ')}`);
  const { path, text, entry } = findItem(dir, opts.id);
  const tags = parseTags(entry);
  const has = tags.includes(opts.tag);
  if (adding === has) { out(`${opts.id} tags unchanged (${tags.join(', ') || 'none'})`); return; }
  const next = adding ? [...tags, opts.tag] : tags.filter((t) => t !== opts.tag);
  const f = getField(entry, 'tags');
  let newText;
  if (next.length === 0 && f) newText = spliceLines(text, f.line, 1);
  else if (f) newText = spliceLines(text, f.line, 1, [`  - tags: ${next.join(', ')}`]);
  else {
    const lines = text.split('\n');
    let at = entry.endLine;
    while (at > entry.line + 1 && lines[at - 1].trim() === '') at--;
    newText = spliceLines(text, at, 0, [`  - tags: ${next.join(', ')}`]);
  }
  save(path, newText);
  out(`${opts.id} tags: ${next.join(', ') || 'none'}`);
}

function validatePortfolioSets(sets) {
  if (sets.status && !PORTFOLIO_STATUSES.includes(sets.status)) {
    die(`status must be one of ${PORTFOLIO_STATUSES.join(' | ')}`);
  }
}

function portfolioPath() {
  return resolve(opts.file || process.env.ABSOL_PORTFOLIO || DEFAULT_PORTFOLIO);
}

// ---------- lint implementations ----------

function lintFile(path, findings) {
  const name = basename(path);
  if (name === 'run.md') return lintRunFile(path, findings);
  if (name.includes('portfolio')) return lintPortfolio(path, findings);
  const ledger = Object.keys(LEDGERS).find((l) => name === `${l}.md`);
  if (ledger) return lintLedgerFile(path, ledger, findings);
  die(`don't know how to lint ${name}`);
}

function lintLedgerFile(path, ledger, findings) {
  const text = readFileOr(path);
  if (text === null) die(`${path} not found`);
  const parsed = parseLedger(text);
  const prefix = LEDGERS[ledger];
  const seen = new Set();
  for (const s of parsed.stray) findings.push({ file: path, line: s.line, sev: 'error', msg: `unrecognized top-level line: ${JSON.stringify(s.text.slice(0, 60))}` });
  for (const e of parsed.entries) {
    if (!new RegExp(`^${prefix}-\\d+$`).test(e.name)) findings.push({ file: path, line: e.line, sev: 'error', msg: `id '${e.name}' doesn't match ${prefix}-NNN` });
    if (seen.has(e.name)) findings.push({ file: path, line: e.line, sev: 'error', msg: `duplicate id ${e.name}` });
    seen.add(e.name);
    if (!getField(e, 'title')) findings.push({ file: path, line: e.line, sev: 'error', msg: `${e.name} has no title` });
    const type = getField(e, 'type');
    if (!type) findings.push({ file: path, line: e.line, sev: 'warn', msg: `${e.name} has no type` });
    else if (!ITEM_TYPES.includes(type.value)) findings.push({ file: path, line: type.line, sev: 'warn', msg: `${e.name} type '${type.value}' not in ${ITEM_TYPES.join('|')}` });
    const pri = getField(e, 'priority');
    if (pri && !PRIORITIES.includes(pri.value)) findings.push({ file: path, line: pri.line, sev: 'warn', msg: `${e.name} priority '${pri.value}' not in ${PRIORITIES.join('|')}` });
    for (const t of parseTags(e)) if (!TAGS.includes(t)) findings.push({ file: path, line: getField(e, 'tags').line, sev: 'warn', msg: `${e.name} unknown tag '${t}'` });
    for (const f of e.fields) {
      if (![...ITEM_SCALAR_FIELDS, ...ITEM_BLOCK_FIELDS].includes(f.key)) findings.push({ file: path, line: f.line, sev: 'warn', msg: `${e.name} unknown field '${f.key}'` });
      if (ITEM_BLOCK_FIELDS.includes(f.key) && !f.isBlock) findings.push({ file: path, line: f.line, sev: 'warn', msg: `${e.name} '${f.key}' should be a block (: |)` });
    }
    for (const [key, word] of [['shape', 'Shaped'], ['map', 'Mapped'], ['plan', 'Planned']]) {
      const f = getField(e, key);
      if (f && f.isBlock && !new RegExp(`^${word} \\d{4}-\\d{2}-\\d{2}`).test(f.blockText)) {
        findings.push({ file: path, line: f.line, sev: 'warn', msg: `${e.name} ${key} block doesn't open with "${word} YYYY-MM-DD"` });
      }
    }
    for (const s of e.stray) findings.push({ file: path, line: s.line, sev: 'warn', msg: `${e.name} unrecognized line: ${JSON.stringify(s.text.slice(0, 60))}` });
  }
}

function lintRunFile(path, findings) {
  const text = readFileOr(path);
  if (text === null) die(`${path} not found`);
  const run = parseRun(text);
  if (!run.runId || !/^RUN-\d{4}-\d{2}-\d{2}/.test(run.runId)) findings.push({ file: path, line: 0, sev: 'error', msg: `run header missing or malformed (# RUN-YYYY-MM-DD)` });
  for (const req of ['mode', 'items', 'started']) {
    if (!run.header[req]) findings.push({ file: path, line: 0, sev: 'error', msg: `run header missing '${req}'` });
  }
  for (const e of run.events) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(e.name)) findings.push({ file: path, line: e.line, sev: 'error', msg: `event stamp '${e.name}' isn't full ISO with seconds` });
    const type = getField(e, 'type');
    if (!type) { findings.push({ file: path, line: e.line, sev: 'error', msg: 'event has no type' }); continue; }
    if (!(type.value in EVENT_TYPES)) { findings.push({ file: path, line: type.line, sev: 'warn', msg: `unknown event type '${type.value}'` }); continue; }
    for (const req of EVENT_TYPES[type.value]) {
      if (!getField(e, req)) findings.push({ file: path, line: e.line, sev: 'warn', msg: `event '${type.value}' missing '${req}'` });
    }
  }
}

function lintPortfolio(path, findings) {
  const text = readFileOr(path);
  if (text === null) die(`${path} not found`);
  const parsed = parsePortfolio(text);
  const seen = new Set();
  for (const s of parsed.stray) findings.push({ file: path, line: s.line, sev: 'error', msg: `unrecognized top-level line: ${JSON.stringify(s.text.slice(0, 60))}` });
  for (const e of parsed.entries) {
    if (seen.has(e.name)) findings.push({ file: path, line: e.line, sev: 'error', msg: `duplicate slug ${e.name}` });
    seen.add(e.name);
    const status = getField(e, 'status');
    if (!status) findings.push({ file: path, line: e.line, sev: 'error', msg: `${e.name} has no status` });
    else if (!PORTFOLIO_STATUSES.includes(status.value)) findings.push({ file: path, line: status.line, sev: 'error', msg: `${e.name} status '${status.value}' invalid` });
    if (status && status.value === 'frozen' && !getField(e, 're-entry')) {
      findings.push({ file: path, line: e.line, sev: 'error', msg: `${e.name} is frozen without a re-entry line` });
    }
    for (const f of e.fields) if (!PORTFOLIO_FIELDS.includes(f.key)) findings.push({ file: path, line: f.line, sev: 'warn', msg: `${e.name} unknown field '${f.key}'` });
  }
}

// ---------- dispatch ----------

if (!verb || verb === '--help' || verb === 'help') {
  out('absol-tool — the write path for absol state (see schemas.md §The toolset)\n');
  for (const [name, v] of Object.entries(verbs)) out(`  ${name.padEnd(14)} ${v.help}`);
  process.exit(0);
}
if (!(verb in verbs)) die(`unknown verb '${verb}' — run with --help`);
if (opts.help) { out(verbs[verb].help); process.exit(0); }
verbs[verb].run();
