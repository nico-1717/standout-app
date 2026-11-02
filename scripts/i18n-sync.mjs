// Copia dal sito lang/it.json, lang/en.json e lib/data/habits_presets.json e public/planner/planner_smart.json (una sola fonte di verità).
//   npm run i18n:sync            → li scarica da GitHub (nico-1717/standout, ramo main)
//   npm run i18n:sync -- ../standout/lang   → li copia da una cartella locale
//   npm run i18n:sync -- --check → non scrive: fallisce se la copia dell'app è vecchia (CI)
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const qui = dirname(fileURLToPath(import.meta.url));
const destinazione = join(qui, '..', 'src', 'core', 'i18n', 'lang');
const args = process.argv.slice(2);
const soloControllo = args.includes('--check');
const cartella = args.find((a) => !a.startsWith('--'));
const BASE = 'https://raw.githubusercontent.com/nico-1717/standout/main/';
// I file del sito che l'app copia così come sono: nome sul sito (da BASE o dalla cartella ../standout) → dove stanno nell'app.
const FILE = [
  ['lang/it.json', join(destinazione, 'it.json')],
  ['lang/en.json', join(destinazione, 'en.json')],
  // l'elenco delle abitudini pronte, dei colori e delle icone: lo stesso del sito (decisione D12)
  [
    'lib/data/habits_presets.json',
    join(qui, '..', 'src', 'features', 'habits', 'habits_presets.json'),
  ],
  // le regole di data e ora della barra intelligente (planner e to do): lo stesso elenco di parole del sito
  [
    'public/planner/planner_smart.json',
    join(qui, '..', 'src', 'features', 'tasks', 'planner_smart.json'),
  ],
];

async function leggi(nome) {
  // la cartella passata da riga di comando è quella «lang» del sito: la radice del sito è la sua cartella madre
  if (cartella) return readFile(join(cartella, '..', nome), 'utf8');
  const r = await fetch(BASE + nome);
  if (!r.ok) throw new Error(`${nome}: HTTP ${r.status}`);
  return r.text();
}

// Si confronta il JSON, non i byte: così a capo e spazi non fanno falsi allarmi.
const normale = (testo) => JSON.stringify(JSON.parse(testo));
let diversi = 0;
for (const [nome, percorso] of FILE) {
  const sito = await leggi(nome);
  let app = '';
  try {
    app = await readFile(percorso, 'utf8');
  } catch {
    /* non c'è ancora */
  }
  const uguale = app !== '' && normale(app) === normale(sito);
  if (!uguale) diversi++;
  if (!soloControllo && !uguale) {
    await writeFile(percorso, JSON.stringify(JSON.parse(sito), null, 2) + '\n');
    console.log(`aggiornato ${nome}`);
  }
}
if (soloControllo && diversi) {
  console.error(
    `Le traduzioni dell'app non sono aggiornate (${diversi} file). Esegui: npm run i18n:sync`,
  );
  process.exit(1);
}
console.log(diversi && !soloControllo ? 'fatto' : 'traduzioni allineate');
