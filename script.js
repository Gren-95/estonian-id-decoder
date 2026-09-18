'use strict';

/**
 * Estonian personal identification code (isikukood) decoding.
 * Structure: G YYMMDD SSS C  (11 digits total)
 *   G    — century + gender
 *   YYMMDD — date of birth
 *   SSS  — sequence number for people born the same day
 *   C    — checksum digit
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
    return { ok: false, error: `First digit must be 1–8 (got ${genderDigit}).` };
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
    for (const el of Object.values(fields)) el.textContent = '—';
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
      statusBanner.textContent = 'Invalid — the embedded date of birth does not exist';
    } else if (data.isFutureDate) {
      statusBanner.textContent = 'Invalid — the embedded date of birth is in the future';
    } else {
      statusBanner.textContent = `Invalid checksum — expected ${data.expectedChecksum}, code has ${data.givenChecksum}`;
    }
  }

  fields.gender.textContent = data.gender;
  fields.dob.textContent = data.dateValid
    ? `${dateFormatter.format(data.dob)} (${data.century}s)`
    : `${String(data.day).padStart(2, '0')}.${String(data.month).padStart(2, '0')}.${data.year} (invalid date)`;
  fields.age.textContent = data.age !== null ? `${data.age} years` : '—';
  fields.dow.textContent = data.weekday || '—';
  fields.seq.textContent = `#${String(data.sequence).padStart(3, '0')} that day`;
  fields.checksum.textContent = data.checksumValid
    ? `${data.givenChecksum} ✓`
    : `${data.givenChecksum} (expected ${data.expectedChecksum})`;

  copyBtn.hidden = false;
  copyBtn.dataset.summary =
    `Estonian ID ${data.digits}: ${data.gender}, born ${data.dateValid ? dateFormatter.format(data.dob) : 'invalid date'}` +
    `${data.age !== null ? `, ${data.age} years old` : ''} — ${data.valid ? 'valid' : 'invalid'} code.`;
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
    // Clipboard API unavailable (e.g. insecure context) — fail silently, nothing sensitive lost.
  }
});

/** Builds a syntactically valid, randomly dated example code — not a real person. */
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
