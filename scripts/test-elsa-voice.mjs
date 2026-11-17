import assert from 'node:assert/strict';

const MALE_VOICE_PATTERNS = [
  'david',
  'mark',
  'george',
  'richard',
  'james',
  'guy',
  'stefan',
  'ravi',
  'pawan',
  'male',
  'google us english',
];

const FEMALE_VOICE_PRIORITY = [
  'google uk english female',
  'google us english female',
  'zira',
  'aria',
  'jenny',
  'hazel',
  'catherine',
  'susan',
  'ava',
  'sonia',
  'libby',
  'samantha',
  'victoria',
  'karen',
  'moira',
  'tessa',
  'veena',
  'neerja',
  'allison',
  'female',
  'woman',
];

function isMaleVoice(voice) {
  const name = voice.name.toLowerCase();
  if (name.includes('female') || name.includes('woman')) return false;
  return MALE_VOICE_PATTERNS.some((m) => name.includes(m));
}

function selectFemaleVoice(voices) {
  if (!voices.length) return null;

  for (const hint of FEMALE_VOICE_PRIORITY) {
    const found = voices.find(
      (v) => v.name.toLowerCase().includes(hint) && !isMaleVoice(v)
    );
    if (found) return found;
  }

  const femaleExplicit = voices.find(
    (v) =>
      !isMaleVoice(v) &&
      (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman'))
  );
  if (femaleExplicit) return femaleExplicit;

  const nonMaleEn = voices.find(
    (v) => !isMaleVoice(v) && v.lang.toLowerCase().startsWith('en')
  );
  if (nonMaleEn) return nonMaleEn;

  const nonMaleAny = voices.find((v) => !isMaleVoice(v));
  if (nonMaleAny) return nonMaleAny;

  return null;
}

// 1. Windows default voice set: Microsoft David + Microsoft Zira
const windowsVoices = [
  { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
  { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US' },
  { name: 'Microsoft Mark Desktop - English (United States)', lang: 'en-US' },
];
const winSelected = selectFemaleVoice(windowsVoices);
assert.equal(winSelected?.name, 'Microsoft Zira Desktop - English (United States)', 'Must pick Zira over David/Mark');
console.log('✔ Test 1 Passed: Windows chooses Microsoft Zira, never David/Mark');

// 2. Google Chrome default voice set: Google US English (male) + Google UK English Female
const chromeVoices = [
  { name: 'Google US English', lang: 'en-US' }, // Androgyne/male in Chrome
  { name: 'Google UK English Female', lang: 'en-GB' },
  { name: 'Microsoft David - English (United States)', lang: 'en-US' },
];
const chromeSelected = selectFemaleVoice(chromeVoices);
assert.equal(chromeSelected?.name, 'Google UK English Female', 'Must pick Google UK English Female over Google US English');
console.log('✔ Test 2 Passed: Chrome chooses Google UK English Female, rejects Google US English & David');

// 3. Edge Natural voices
const edgeVoices = [
  { name: 'Microsoft Guy Online (Natural) - English (United States)', lang: 'en-US' },
  { name: 'Microsoft Jenny Online (Natural) - English (United States)', lang: 'en-US' },
];
const edgeSelected = selectFemaleVoice(edgeVoices);
assert.equal(edgeSelected?.name, 'Microsoft Jenny Online (Natural) - English (United States)', 'Must pick Jenny over Guy');
console.log('✔ Test 3 Passed: Edge chooses Jenny, rejects Guy Natural');

// 4. Edge Aria
const ariaVoices = [
  { name: 'Microsoft David - English (United States)', lang: 'en-US' },
  { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US' },
];
const ariaSelected = selectFemaleVoice(ariaVoices);
assert.equal(ariaSelected?.name, 'Microsoft Aria Online (Natural) - English (United States)', 'Must pick Aria over David');
console.log('✔ Test 4 Passed: Chooses Aria over David');

// 5. System with only male voices
const maleOnlyVoices = [
  { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
  { name: 'Microsoft Mark Desktop - English (United States)', lang: 'en-US' },
  { name: 'Google US English', lang: 'en-US' },
];
const maleSelected = selectFemaleVoice(maleOnlyVoices);
assert.equal(maleSelected, null, 'Must return null rather than selecting any male voice');
console.log('✔ Test 5 Passed: Returns null when only male voices exist (triggers 1.35 pitch shift)');

console.log('ALL VOICE SELECTION TESTS PASSED!');
