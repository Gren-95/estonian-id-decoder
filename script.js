'use strict';

/**
 * Estonian personal identification code (isikukood) decoding.
 * Structure: G YYMMDD SSS C  (11 digits total)
 *   G      century + gender
 *   YYMMDD date of birth
 *   SSS    serial number for people born the same day; before 2013 it
 *          also encoded the hospital of birth
 *   C      checksum digit
 */

const CENTURY_BY_GENDER_DIGIT = {
  1: { base: 1800, gender: 'Male' },
  2: { base: 1800, gender: 'Female' },
  3: { base: 1900, gender: 'Male' },
  4: { base: 1900, gender: 'Female' },
  5: { base: 2000, gender: 'Male' },
  6: { base: 2000, gender: 'Female' },
  7: { base: 2100, gender: 'Male' },
  8: { base: 2100, gender: 'Female' },
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function computeChecksum(tenDigits) {
  const round1Weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1];
  const round2Weights = [3, 4, 5, 6, 7, 8, 9, 1, 2, 3];

  const weightedSum = (weights) =>
    tenDigits.reduce((sum, digit, i) => sum + digit * weights[i], 0);

  let mod = weightedSum(round1Weights) % 11;
  if (mod < 10) return mod;

  mod = weightedSum(round2Weights) % 11;
  return mod < 10 ? mod : 0;
}

/**
 * Decodes an Estonian isikukood.
 * @param {string} raw
 * @returns {{ok: true, data: object} | {ok: false, error: string}}
 */
function decodeEstonianId(raw) {
  const digits = (raw || '').replace(/\D/g, '');

  if (digits.length === 0) {
    return { ok: false, error: 'Enter an ID code to decode it.' };
  }
  if (digits.length !== 11) {
    return { ok: false, error: `Expected 11 digits, got ${digits.length}.` };
  }

  const d = digits.split('').map(Number);
  const genderDigit = d[0];
  const centuryInfo = CENTURY_BY_GENDER_DIGIT[genderDigit];
  if (!centuryInfo) {
    return { ok: false, error: `First digit must be 1-8 (got ${genderDigit}).` };
  }

  const yy = d[1] * 10 + d[2];
  const month = d[3] * 10 + d[4];
  const day = d[5] * 10 + d[6];
  const year = centuryInfo.base + yy;
  const sequence = d[7] * 100 + d[8] * 10 + d[9];
  const givenChecksum = d[10];

  const expectedChecksum = computeChecksum(d.slice(0, 10));
  const checksumValid = expectedChecksum === givenChecksum;

  const date = new Date(Date.UTC(year, month - 1, day));
  const dateValid =
    month >= 1 && month <= 12 &&
    day >= 1 && day <= 31 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const isFutureDate = dateValid && date.getTime() > todayUTC;

  let age = null;
  if (dateValid && !isFutureDate) {
    age = now.getFullYear() - year;
    const hadBirthdayThisYear =
      now.getMonth() + 1 > month ||
      (now.getMonth() + 1 === month && now.getDate() >= day);
    if (!hadBirthdayThisYear) age -= 1;
  }

  return {
    ok: true,
    data: {
      digits,
      valid: checksumValid && dateValid && !isFutureDate,
      checksumValid,
      dateValid,
      isFutureDate,
      gender: centuryInfo.gender,
      century: centuryInfo.base,
      year,
      month,
      day,
      dob: dateValid ? date : null,
      weekday: dateValid ? WEEKDAYS[date.getUTCDay()] : null,
      sequence,
      givenChecksum,
      expectedChecksum,
      age,
    },
  };
}

// ---- UI wiring ----

const idInput = document.getElementById('idInput');
const randomBtn = document.getElementById('randomBtn');
const copyBtn = document.getElementById('copyBtn');
const resultEl = document.getElementById('result');
const statusBanner = document.getElementById('statusBanner');

const fields = {
  gender: document.getElementById('valGender'),
  dob: document.getElementById('valDob'),
  age: document.getElementById('valAge'),
  dow: document.getElementById('valDow'),
  seq: document.getElementById('valSeq'),
  checksum: document.getElementById('valChecksum'),
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

function render(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) {
    resultEl.hidden = true;
    copyBtn.hidden = true;
    return;
  }

  const result = decodeEstonianId(raw);
  resultEl.hidden = false;

  if (!result.ok) {
    statusBanner.className = 'status-banner bad';
    statusBanner.textContent = result.error;
    for (const el of Object.values(fields)) el.textContent = '-';
    copyBtn.hidden = true;
    return;
  }

  const data = result.data;

  if (data.valid) {
    statusBanner.className = 'status-banner ok';
    statusBanner.textContent = 'Valid Estonian ID code';
  } else {
    statusBanner.className = 'status-banner bad';
    if (!data.dateValid) {
      statusBanner.textContent = 'Invalid: the embedded date of birth does not exist';
    } else if (data.isFutureDate) {
      statusBanner.textContent = 'Invalid: the embedded date of birth is in the future';
    } else {
      statusBanner.textContent = `Invalid checksum: expected ${data.expectedChecksum}, the code has ${data.givenChecksum}`;
    }
  }

  fields.gender.textContent = data.gender;
  fields.dob.textContent = data.dateValid
    ? `${dateFormatter.format(data.dob)} (${data.century}s)`
    : `${String(data.day).padStart(2, '0')}.${String(data.month).padStart(2, '0')}.${data.year} (invalid date)`;
  fields.age.textContent = data.age !== null ? `${data.age} years` : '-';
  fields.dow.textContent = data.weekday || '-';
  fields.seq.textContent = String(data.sequence).padStart(3, '0') +
    (data.dateValid && data.year < 2013 ? ' (also encodes the birth hospital)' : '');
  fields.checksum.textContent = data.checksumValid
    ? `${data.givenChecksum} ✓`
    : `${data.givenChecksum} (expected ${data.expectedChecksum})`;

  copyBtn.hidden = false;
  copyBtn.dataset.summary =
    `Estonian ID ${data.digits}: ${data.gender}, born ${data.dateValid ? dateFormatter.format(data.dob) : 'invalid date'}` +
    `${data.age !== null ? `, ${data.age} years old` : ''}. ${data.valid ? 'Valid' : 'Invalid'} code.`;
}

idInput.addEventListener('input', () => render(idInput.value));

randomBtn.addEventListener('click', () => {
  idInput.value = generateExampleId();
  render(idInput.value);
  idInput.focus();
});

copyBtn.addEventListener('click', async () => {
  const text = copyBtn.dataset.summary || '';
  try {
    await navigator.clipboard.writeText(text);
    const original = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = original; }, 1400);
  } catch {
    // Clipboard API unavailable (e.g. insecure context): fail silently, nothing is lost.
  }
});

/**
 * Builds a valid code with a random 1900s birth date, as an example. It is not
 * looked up anywhere, but a valid code can match a real person's by chance.
 */
function generateExampleId() {
  const genderDigit = String(3 + Math.floor(Math.random() * 2)); // 3-4: always a past 1900s date
  const yy = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const tenDigits = `${genderDigit}${yy}${month}${day}${seq}`.split('').map(Number);
  const checksum = computeChecksum(tenDigits);
  return tenDigits.join('') + checksum;
}

// ---- Tabs ----

const tabs = [...document.querySelectorAll('[role="tab"]')];
const TAB_HASHES = { 'tab-batch': '#batch', 'tab-excel': '#excel' };

function selectTab(tab, { focus = false } = {}) {
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
  }
  if (focus) tab.focus();
  const hash = TAB_HASHES[tab.id] || '';
  if (location.hash !== hash) {
    try {
      history.replaceState(null, '', location.pathname + location.search + hash);
    } catch {
      // Some browsers refuse this on file:// pages; the tab still switches.
    }
  }
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (e) => {
    let next = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (next) {
      e.preventDefault();
      selectTab(next, { focus: true });
    }
  });
});

const initialTab = Object.keys(TAB_HASHES).find((id) => TAB_HASHES[id] === location.hash);
if (initialTab) selectTab(document.getElementById(initialTab));

// ---- Batch mode ----

const batchInput = document.getElementById('batchInput');
const batchResultEl = document.getElementById('batchResult');
const batchBody = document.getElementById('batchBody');
const batchEmpty = document.getElementById('batchEmpty');
const batchFilter = document.getElementById('batchFilter');
const batchFile = document.getElementById('batchFile');
const batchCopyBtn = document.getElementById('batchCopyBtn');
const batchCounts = {
  total: document.getElementById('batchTotal'),
  valid: document.getElementById('batchValid'),
  invalid: document.getElementById('batchInvalid'),
};

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

let batchRows = [];

/**
 * Splits pasted text into candidate codes. Newlines, commas, semicolons and
 * tabs always separate entries. Spaces only separate when every part is a
 * full 11-digit code, so "376 050 30299" still reads as one code. Entries
 * without any digits (headers, names) are skipped.
 */
function splitBatchInput(text) {
  const tokens = [];
  for (const piece of text.split(/[\r\n,;\t]+/)) {
    const parts = piece.trim().split(/\s+/).filter((p) => /\d/.test(p));
    if (parts.length === 0) continue;
    const allFullCodes = parts.every((p) => p.replace(/\D/g, '').length === 11);
    if (parts.length > 1 && allFullCodes) tokens.push(...parts);
    else tokens.push(parts.join(' '));
  }
  return tokens;
}

function batchStatus(result) {
  if (!result.ok) return result.error.replace(/\.$/, '');
  const d = result.data;
  if (d.valid) return 'Valid';
  if (!d.dateValid) return 'Invalid date';
  if (d.isFutureDate) return 'Date in the future';
  return `Bad checksum (expected ${d.expectedChecksum})`;
}

function isoDate(d) {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

function cell(row, text, className) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  row.appendChild(td);
}

function renderBatchTable() {
  const filter = batchFilter.value;
  const fragment = document.createDocumentFragment();
  let shown = 0;

  for (const row of batchRows) {
    if (filter === 'valid' && !row.valid) continue;
    if (filter === 'invalid' && row.valid) continue;
    shown++;

    const tr = document.createElement('tr');
    if (!row.valid) tr.className = 'row-bad';
    const d = row.result.ok ? row.result.data : null;
    cell(tr, String(row.index), 'num');
    cell(tr, d ? d.digits : row.input, 'code');
    cell(tr, row.status, row.valid ? 'status good' : 'status bad');
    cell(tr, d ? d.gender : '-');
    cell(tr, d && d.dateValid ? shortDateFormatter.format(d.dob) : '-');
    cell(tr, d && d.age !== null ? String(d.age) : '-', 'num');
    fragment.appendChild(tr);
  }

  batchBody.replaceChildren(fragment);
  batchEmpty.hidden = shown > 0;
}

function renderBatch() {
  const tokens = splitBatchInput(batchInput.value);
  batchRows = tokens.map((input, i) => {
    const result = decodeEstonianId(input);
    return {
      index: i + 1,
      input,
      result,
      valid: result.ok && result.data.valid,
      status: batchStatus(result),
    };
  });

  if (batchRows.length === 0) {
    batchResultEl.hidden = true;
    return;
  }

  const validCount = batchRows.filter((r) => r.valid).length;
  batchCounts.total.textContent = String(batchRows.length);
  batchCounts.valid.textContent = String(validCount);
  batchCounts.invalid.textContent = String(batchRows.length - validCount);
  batchResultEl.hidden = false;
  renderBatchTable();
}

function csvField(value) {
  let s = value === null || value === undefined ? '' : String(value);
  // Keep spreadsheet apps from treating pasted input as a formula.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv() {
  const header = ['input', 'code', 'valid', 'status', 'gender', 'date_of_birth', 'age', 'weekday', 'serial'];
  const lines = [header.join(',')];
  for (const row of batchRows) {
    const d = row.result.ok ? row.result.data : null;
    lines.push([
      row.input,
      d ? d.digits : '',
      row.valid ? 'yes' : 'no',
      row.status,
      d ? d.gender : '',
      d && d.dateValid ? isoDate(d) : '',
      d && d.age !== null ? d.age : '',
      d && d.weekday ? d.weekday : '',
      d ? String(d.sequence).padStart(3, '0') : '',
    ].map(csvField).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

let batchTimer = null;
batchInput.addEventListener('input', () => {
  clearTimeout(batchTimer);
  batchTimer = setTimeout(renderBatch, 120);
});

batchFilter.addEventListener('change', renderBatchTable);

document.getElementById('batchExampleBtn').addEventListener('click', () => {
  const examples = Array.from({ length: 6 }, generateExampleId);
  // Add one code with a deliberately wrong checksum to show an invalid row.
  const broken = generateExampleId();
  examples.splice(3, 0, broken.slice(0, 10) + ((Number(broken[10]) + 1) % 10));
  batchInput.value = examples.join('\n');
  renderBatch();
  batchInput.focus();
});

document.getElementById('batchClearBtn').addEventListener('click', () => {
  batchInput.value = '';
  renderBatch();
  batchInput.focus();
});

document.getElementById('batchFileBtn').addEventListener('click', () => batchFile.click());

batchFile.addEventListener('change', async () => {
  const file = batchFile.files && batchFile.files[0];
  if (!file) return;
  batchInput.value = await file.text();
  batchFile.value = '';
  renderBatch();
});

batchCopyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(buildCsv());
    const original = batchCopyBtn.textContent;
    batchCopyBtn.textContent = 'Copied!';
    setTimeout(() => { batchCopyBtn.textContent = original; }, 1400);
  } catch {
    // Clipboard API unavailable (e.g. insecure context); Download CSV still works.
  }
});

document.getElementById('batchDownloadBtn').addEventListener('click', () => {
  const blob = new Blob([buildCsv()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'isikukood-batch.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

// ---- Excel formulas ----

const xlCol = document.getElementById('xlCol');
const xlRow = document.getElementById('xlRow');
const xlSep = document.getElementById('xlSep');
const xlFormulas = document.getElementById('xlFormulas');

function columnToNumber(letters) {
  return [...letters.toUpperCase()].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
}

function numberToColumn(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Builds the four formulas for a given code cell. They mirror decodeEstonianId:
 * the checksum weights are 1..9,1 and 3..9,1,2,3 (written as MOD(SEQUENCE)
 * expressions so no locale-specific array constants are needed), and the date is
 * checked in year+400 so 1800s dates and Excel's fake 29 Feb 1900 are handled.
 */
function buildExcelFormulas(codeCell, statusCell, dobCell) {
  const c = codeCell;
  return {
    status:
      `=LET(c, SUBSTITUTE(SUBSTITUTE(TRIM(${c}&""), " ", ""), "-", ""), ` +
      `IF(c = "", "", ` +
      `IF(OR(LEN(c) <> 11, SUM(--ISNUMBER(--MID(c, SEQUENCE(11), 1))) < 11), "Must be 11 digits", ` +
      `LET(d, --MID(c, SEQUENCE(10), 1), g, --LEFT(c), ` +
      `y, 1800 + 100 * INT((g - 1) / 2) + MID(c, 2, 2), m, --MID(c, 4, 2), dd, --MID(c, 6, 2), ` +
      `t, DATE(y + 400, m, dd), ` +
      `s1, MOD(SUM(d * (MOD(SEQUENCE(10) - 1, 9) + 1)), 11), ` +
      `s2, MOD(SUM(d * (MOD(SEQUENCE(10) + 1, 9) + 1)), 11), ` +
      `k, IF(s1 < 10, s1, IF(s2 < 10, s2, 0)), ` +
      `IF(OR(g < 1, g > 8), "Bad first digit", ` +
      `IF(OR(m < 1, m > 12, dd < 1, MONTH(t) <> m, DAY(t) <> dd), "Invalid date", ` +
      `IF(AND(y >= 1900, DATE(y, m, dd) > TODAY()), "Future date", ` +
      `IF(k <> --RIGHT(c), "Bad checksum (expected " & k & ")", "Valid"))))))))`,
    gender: `=IF(${statusCell}="Valid", IF(ISODD(--LEFT(${c})), "Male", "Female"), "")`,
    dob:
      `=IF(${statusCell}="Valid", DATE(1800+100*INT((LEFT(${c})-1)/2)+MID(${c},2,2), ` +
      `MID(${c},4,2), MID(${c},6,2)), "")`,
    age: `=IF(${dobCell}="", "", DATEDIF(${dobCell}, TODAY(), "y"))`,
  };
}

/** Swaps argument commas for semicolons, leaving text inside "quotes" alone. */
function withSeparator(formula, sep) {
  if (sep === ',') return formula;
  return formula.split('"').map((part, i) => (i % 2 === 0 ? part.replace(/,/g, sep) : part)).join('"');
}

function renderExcelFormulas() {
  const colText = xlCol.value.trim().toUpperCase();
  const colNum = /^[A-Z]{1,3}$/.test(colText) ? columnToNumber(colText) : 0;
  const row = Number(xlRow.value);
  const colOk = colNum >= 1 && colNum <= 16380; // leaves room for the four output columns
  const rowOk = Number.isInteger(row) && row >= 1 && row <= 1048576;
  xlCol.classList.toggle('invalid', !colOk);
  xlRow.classList.toggle('invalid', !rowOk);
  if (!colOk || !rowOk) return;

  const cell = (offset) => `${numberToColumn(colNum + offset)}${row}`;
  const formulas = buildExcelFormulas(cell(0), cell(1), cell(3));
  const items = [
    { cell: cell(1), title: 'Status', note: 'Valid, or the reason the code is invalid', formula: formulas.status },
    { cell: cell(2), title: 'Gender', note: 'Filled only for valid codes', formula: formulas.gender },
    { cell: cell(3), title: 'Date of birth', note: 'Format this column as a Date', formula: formulas.dob },
    { cell: cell(4), title: 'Age', note: 'Full years as of today', formula: formulas.age },
  ];

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const text = withSeparator(item.formula, xlSep.value);
    const block = document.createElement('section');
    block.className = 'formula-block';

    const head = document.createElement('div');
    head.className = 'formula-head';
    const title = document.createElement('div');
    const cellTag = document.createElement('span');
    cellTag.className = 'cell-tag';
    cellTag.textContent = item.cell;
    const name = document.createElement('strong');
    name.textContent = item.title;
    const note = document.createElement('span');
    note.className = 'formula-note';
    note.textContent = item.note;
    title.append(cellTag, ' ', name, ' ', note);

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'ghost-btn';
    copy.textContent = 'Copy';
    copy.setAttribute('aria-label', `Copy the ${item.title} formula`);
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = 'Copied!';
        setTimeout(() => { copy.textContent = 'Copy'; }, 1400);
      } catch {
        // Clipboard API unavailable; the formula text can still be selected by hand.
      }
    });
    head.append(title, copy);

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = text;
    pre.appendChild(code);

    block.append(head, pre);
    fragment.appendChild(block);
  }
  xlFormulas.replaceChildren(fragment);
}

// Excel uses semicolons wherever the regional decimal mark is a comma, so guess from the browser locale.
const decimalMark = new Intl.NumberFormat().formatToParts(1.5).find((p) => p.type === 'decimal');
xlSep.value = decimalMark && decimalMark.value === ',' ? ';' : ',';

for (const el of [xlCol, xlRow, xlSep]) {
  el.addEventListener('input', renderExcelFormulas);
  el.addEventListener('change', renderExcelFormulas);
}
renderExcelFormulas();
