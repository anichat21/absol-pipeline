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
export const PORTFOLIO_FIELDS = ['status', 'next', 're-entry', 'notes', 'prod_url', 'dev_url', 'type'];

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
    it.ready = it.tags.includes('rtr') && it.primed && !it.tags.includes('parked');
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

// --- monthly run archives ---

const ARCHIVE_RUN_ID_RE = /\b((?:RUN|SCR)-(\d{4}-\d{2}-\d{2})(?:-[A-Za-z0-9]+)*)\b/;
const ARCHIVE_DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/;
const ARCHIVE_EFFORT_RE = /(?:^|[·,]\s*|\s)([~≥]?\s*\d+\s*(?:h(?:\s*\d+\s*(?:m|min))?|m|min))(?:\s+wall)?(?=\s|$|[·,)])/i;
const ARCHIVE_TOKEN_RE = /(?:^|[·,]\s*|\s)([~≥]?\s*\d+(?:\.\d+)?)\s*([KM]?)\s*tok(?:ens?)?\b/i;

function archiveDurationMinutes(label) {
  if (!label) return null;
  const hours = label.match(/(\d+)\s*h/i);
  const minutes = label.match(/(\d+)\s*(?:m|min)\b/i);
  if (!hours && !minutes) return null;
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
}

function archiveTokenCount(text) {
  const match = text.match(ARCHIVE_TOKEN_RE);
  if (!match) return null;
  const multiplier = match[2].toUpperCase() === 'M' ? 1_000_000
    : match[2].toUpperCase() === 'K' ? 1_000 : 1;
  return Math.round(Number(match[1].replace(/\s/g, '').replace(/[~≥]/, '')) * multiplier);
}

function archiveCounts(text) {
  const done = text.match(/\b(\d+)\s+done\b/i);
  const failed = text.match(/\b(\d+)\s+failed\b/i);
  return {
    doneCount: done ? Number(done[1]) : null,
    failedCount: failed ? Number(failed[1]) : null,
  };
}

// Parses only ID-bearing level-two headings. Non-ID level-two headings belong to
// the current run's prose; legacy per-run files with only Tasks/Notable headings
// therefore correctly produce no entries.
export function parseMonthlyArchive(text) {
  const lines = text.split(/\r?\n/);
  const runs = [];
  let current = null;

  const close = () => {
    if (!current) return;
    const heading = current.heading;
    const bodyLines = current.body;
    const legacyMetaIndex = bodyLines.findIndex((line) => (
      /^\s*\*—\s*\d{4}-\d{2}-\d{2}(?:\s*→\s*\d{4}-\d{2}-\d{2})?\s+\([^)]+\)\*\s*$/.test(line)
    ));
    const legacyMeta = legacyMetaIndex === -1 ? null : bodyLines[legacyMetaIndex];
    const bodySummary = bodyLines.find((line) => /\b\d+\s+done\b/i.test(line)) || '';
    const remainder = heading.slice(heading.match(ARCHIVE_RUN_ID_RE).index
      + heading.match(ARCHIVE_RUN_ID_RE)[0].length);

    let mode = null;
    const dotParts = remainder.split('·').map((part) => part.trim()).filter(Boolean);
    if (dotParts.length && !ARCHIVE_DATE_RE.test(dotParts[0])) mode = dotParts[0];
    const dashMode = remainder.match(/—\s*\d{4}-\d{2}-\d{2}(?:\s*→\s*\d{4}-\d{2}-\d{2})?\s+\(([^)]+)\)/);
    if (!mode && dashMode) mode = dashMode[1].trim();
    const legacyMode = legacyMeta?.match(/\(([^)]+)\)/);
    if (!mode && legacyMode) mode = legacyMode[1].trim();

    const explicitDate = remainder.match(ARCHIVE_DATE_RE)?.[1]
      || legacyMeta?.match(ARCHIVE_DATE_RE)?.[1];
    const headingCounts = archiveCounts(heading);
    const bodyCounts = archiveCounts(bodySummary);
    const effortMatch = heading.match(ARCHIVE_EFFORT_RE)
      || bodySummary.match(ARCHIVE_EFFORT_RE);
    const effort = effortMatch ? effortMatch[1].trim() : null;
    const tokenCount = archiveTokenCount(heading) ?? archiveTokenCount(bodySummary);
    const outcome = bodyLines
      .filter((_line, index) => index !== legacyMetaIndex)
      .join('\n')
      .trim();

    runs.push({
      id: current.idMatch[1],
      mode,
      date: explicitDate || current.idMatch[2],
      doneCount: headingCounts.doneCount ?? bodyCounts.doneCount,
      failedCount: headingCounts.failedCount ?? bodyCounts.failedCount,
      durationMinutes: archiveDurationMinutes(effort),
      tokenCount,
      effort,
      crashed: /\bCrashed:\s*yes\b/i.test(heading),
      outcome,
    });
    current = null;
  };

  for (const line of lines) {
    if (/^\s*---+\s*$/.test(line)) {
      close();
      continue;
    }
    const heading = line.match(/^##\s+(.+?)\s*$/);
    const idMatch = heading?.[1].match(ARCHIVE_RUN_ID_RE);
    if (idMatch) {
      close();
      current = { heading: heading[1], idMatch, body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  close();
  return runs;
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
