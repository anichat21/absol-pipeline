// absol parser library — the single implementation of the schemas in
// skills/absol/references/schemas.md. Read-only: parsing returns entries with
// line ranges; mutations are line-splices done by the CLI so untouched content
// survives byte-for-byte. Renderers import this instead of re-parsing.

export const LEDGERS = { inbox: 'INBOX', bugs: 'BUG', 'tech-debt': 'DEBT' };

export const ITEM_SCALAR_FIELDS = [
  'title', 'type', 'priority', 'subsystem', 'covers', 'planned_with',
  'prior', 'open', 'smell', 'tags',
];
export const ITEM_BLOCK_FIELDS = ['description', 'shape', 'map', 'plan'];
export const ITEM_TYPES = ['ARCH', 'FEATURE', 'BUG', 'TWEAK', 'CHORE', 'VERIFY'];
export const PRIORITIES = ['critical', 'high', 'medium', 'low'];
export const TAGS = ['tuning', 'rtr', 'parked'];

export const EVENT_TYPES = {
  'task-started': ['task', 'worker'],
  'task-completed': ['task', 'summary'],
  'task-failed': ['task', 'blocker'],
  'task-blocked': ['task', 'blocker'],
  'task-usage': ['task', 'tokens'],
  'task-retry': ['task', 'retry_count', 'reason'],
  'review': ['task', 'verdict'],
  'pause': [],
  'resume': [],
};

export const PORTFOLIO_STATUSES = ['active', 'simmering', 'frozen', 'done', 'unset'];
export const PORTFOLIO_FIELDS = ['status', 'next', 're-entry', 'notes', 'prod_url', 'dev_url'];

const ENTRY_RE = /^- \[(item|project|event)\] (.+?)\s*$/;
const FIELD_RE = /^  - ([A-Za-z_-]+): ?(.*)$/;
const TOP_FIELD_RE = /^- ([A-Za-z_-]+): ?(.*)$/;

// Generic entry-list parser for ledgers ("item"), portfolio ("project"),
// run.md events ("event").
//
// Returns { lines, preamble: [line, ...], entries: [entry], stray: [{line, text}] }
// entry = { name, line, endLine (exclusive, includes trailing blanks),
//           fields: [{ key, value, line, isBlock, blockStart, blockEnd, blockText }],
//           stray: [{line, text}] }
export function parseEntries(text, kind) {
  const lines = text.split('\n');
  const entries = [];
  const preamble = [];
  const stray = [];
  let cur = null;

  const closeEntry = (endLine) => {
    if (cur) { cur.endLine = endLine; entries.push(cur); cur = null; }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const em = line.match(ENTRY_RE);
    if (em && em[1] === kind) {
      closeEntry(i);
      cur = { name: em[2], line: i, endLine: lines.length, fields: [], stray: [] };
      continue;
    }
    if (!cur) {
      if (line.trim() === '' || line.startsWith('#') || line.trim() === 'None.'
        || line.trim().startsWith('<!--')) preamble.push(i);
      else stray.push({ line: i, text: line });
      continue;
    }
    const fm = line.match(FIELD_RE);
    if (fm) {
      const field = { key: fm[1], value: fm[2].trim(), line: i, isBlock: false };
      if (field.value === '|') {
        field.isBlock = true;
        field.blockStart = i + 1;
        let j = i + 1;
        while (j < lines.length) {
          if (/^ {6}/.test(lines[j])) { j++; continue; }
          if (lines[j].trim() === '') {
            // blank inside a block only if a 6-space line follows before anything else
            let k = j;
            while (k < lines.length && lines[k].trim() === '') k++;
            if (k < lines.length && /^ {6}/.test(lines[k])) { j = k; continue; }
          }
          break;
        }
        field.blockEnd = j; // exclusive
        field.blockText = lines.slice(field.blockStart, field.blockEnd)
          .map((l) => l.replace(/^ {6}/, '')).join('\n');
        i = j - 1;
      }
      cur.fields.push(field);
      continue;
    }
    if (line.trim() === '') continue; // separator blank inside/after entry
    // top-level content ends the entry (e.g. "## Events" or next section)
    if (!line.startsWith(' ')) {
      closeEntry(i);
      if (line.startsWith('#') || line.trim() === 'None.') preamble.push(i);
      else if (TOP_FIELD_RE.test(line)) stray.push({ line: i, text: line });
      else stray.push({ line: i, text: line });
      continue;
    }
    cur.stray.push({ line: i, text: line });
  }
  closeEntry(lines.length);
  return { lines, preamble, entries, stray };
}

export function getField(entry, key) {
  return entry.fields.find((f) => f.key === key);
}

export function parseTags(entry) {
  const f = getField(entry, 'tags');
  if (!f || f.isBlock) return [];
  return f.value.split(',').map((t) => t.trim()).filter(Boolean);
}

// --- ledgers ---

export function parseLedger(text) {
  return parseEntries(text, 'item');
}

export function itemToJSON(entry, ledger) {
  const val = (k) => { const f = getField(entry, k); return f && !f.isBlock ? f.value : undefined; };
  const has = (k) => { const f = getField(entry, k); return !!(f && f.isBlock); };
  return {
    id: entry.name,
    ledger,
    title: val('title'),
    type: val('type'),
    priority: val('priority'),
    subsystem: val('subsystem'),
    tags: parseTags(entry),
    covers: val('covers'),
    planned_with: val('planned_with'),
    open: val('open'),
    smell: val('smell'),
    has_description: has('description'),
    shaped: has('shape'),
    mapped: has('map'),
    has_plan: has('plan'),
  };
}

// Derived views across a whole project's ledgers (schemas.md §Derived views).
export function deriveViews(itemsJSON) {
  const covered = new Set();
  for (const it of itemsJSON) {
    if (it.covers) it.covers.split(',').map((s) => s.trim()).forEach((id) => covered.add(id));
  }
  for (const it of itemsJSON) {
    it.planned = it.has_plan || covered.has(it.id) || !!it.planned_with;
    it.primed = it.shaped && it.planned;
    it.ready = it.tags.includes('rtr') && it.primed;
  }
  return itemsJSON;
}

// --- run.md ---

export function parseRun(text) {
  const lines = text.split('\n');
  const header = {};
  let runId = null;
  for (const line of lines) {
    if (line.startsWith('# ')) { runId = line.slice(2).trim(); continue; }
    if (line.startsWith('## ')) break;
    const m = line.match(TOP_FIELD_RE);
    if (m) header[m[1]] = m[2].trim();
  }
  const { entries, stray } = parseEntries(text, 'event');
  return { runId, header, events: entries, stray, lines };
}

// --- portfolio ---

export function parsePortfolio(text) {
  return parseEntries(text, 'project');
}

// --- helpers for mutation (used by the CLI; pure, return new text) ---

export function spliceLines(text, start, deleteCount, insert = []) {
  const lines = text.split('\n');
  lines.splice(start, deleteCount, ...insert);
  return lines.join('\n');
}

export function isoNow() {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

export function blockLines(content) {
  return content.replace(/\n+$/, '').split('\n').map((l) => (l.trim() === '' ? '' : '      ' + l));
}

export function nextId(prefix, ledgerText, archiveTexts) {
  const re = new RegExp(`\\b${prefix}-(\\d+)`, 'g');
  let max = 0;
  for (const text of [ledgerText, ...archiveTexts]) {
    for (const m of text.matchAll(re)) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}
