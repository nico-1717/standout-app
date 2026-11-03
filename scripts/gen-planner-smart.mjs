// Esegue il VERO smartParse() del sito (public/planner/js/04_barra_e_priorita.js) su tante frasi
// e scrive i risultati in un file: il test d'oro dell'app confronta la sua copia con questi.
//   node scripts/gen-planner-smart.mjs ../standout > src/features/planner/__tests__/fixtures/smart.json
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const site = process.argv[2] ?? '../standout';
const src = readFileSync(join(site, 'public/planner/js/04_barra_e_priorita.js'), 'utf8');
const SMART = JSON.parse(readFileSync(join(site, 'public/planner/planner_smart.json'), 'utf8'));
const from = src.indexOf('function pasquaDi');
const to = src.indexOf('function smartCreate');
const body = src.slice(from, to);

const helpers = `
function pad(n) { return (n < 10 ? '0' : '') + n; }
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseIso(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays(s, n) { var d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); }
function dowIndex(s) { return (parseIso(s).getDay() + 6) % 7; }
`;

const CONTACTS = [
  { name: 'Luchino', email: 'luchino@example.com' },
  { name: 'Anna Rossi', email: 'anna@example.com' },
  { name: 'Gio', email: 'gio@example.com' },
];

const phrases = [
  ...SMART.esempi,
  'domani pranzo 15',
  'martedì partita 12:30',
  '13 agosto dentista alle 12',
  'stasera cinema',
  'mangio bene stasera',
  'ferragosto mare',
  'pasqua pranzo dai nonni',
  'pasquetta in montagna',
  'carnevale sfilata',
  'natale con i parenti',
  'san valentino cena',
  'dentist tomorrow 3pm',
  'meeting at 9.30am friday',
  'next friday lunch',
  'tuesday 23 game',
  'venerdì 23 ottobre partita',
  'martedì 23 partita',
  'domani 15 dentista',
  'domani pranzo alle 18',
  'oggi',
  '',
  '   ',
  'solo titolo',
  'riunione 14:30',
  'riunione ore 9',
  'palestra 18',
  'cena con luchino sabato',
  'caffè con anna rossi domani',
  'giocare con gio stasera',
  'agsoto dentista 13 agsoto',
  'dentista 13/8',
  'dentista 13-08-2027',
  'dentista 5/3/28',
  'august 13th dentist',
  '13th of august dentist',
  'lunedì prossimo riunione',
  'lunedi che viene riunione',
  'next week monday call',
  'domattina corsa',
  'tonight dinner',
  'this morning run',
  'stanotte in tenda',
  'dopodomani esame 9:00',
  'colazione domani',
  'aperitivo sabato 19',
  'mar 20 giugno concerto',
  'sun 5 pm brunch',
  'martedì prossimo martedì',
  'compleanno luca 2 ottobre',
  'ore 25 non valido',
  'film 99:99',
  'oggi 24',
  'tomorrow 12 lunch',
  'vacanza dal 3 al 10 luglio',
];
const todays = ['2026-11-03', '2026-12-30', '2027-02-27', '2026-08-15', '2028-03-01', '2026-04-05'];

const out = { contacts: CONTACTS, cases: [] };
for (const today of todays) {
  const make = new Function(
    'SMART',
    'RUBRICA',
    'S',
    helpers + body + '\nreturn function (raw) { return smartParse(raw); };',
  );
  const parse = make(SMART, CONTACTS, { today, focusDate: today });
  // senza rubrica, per le frasi con nomi
  const parseNoContacts = new Function(
    'SMART',
    'RUBRICA',
    'S',
    helpers + body + '\nreturn function (raw) { return smartParse(raw); };',
  )(SMART, [], { today, focusDate: today });
  for (const phrase of phrases) {
    out.cases.push({ today, phrase, withContacts: true, result: parse(phrase) });
    out.cases.push({ today, phrase, withContacts: false, result: parseNoContacts(phrase) });
  }
}
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
