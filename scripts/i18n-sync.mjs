// Copia lang/it.json e lang/en.json del sito dentro l'app (una sola fonte di verità).
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
const BASE = 'https://raw.githubusercontent.com/nico-1717/standout/main/lang/';

async function leggi(nome) {
  if (cartella) return readFile(join(cartella, nome), 'utf8');
  const r = await fetch(BASE + nome);
  if (!r.ok) throw new Error(`${nome}: HTTP ${r.status}`);
  return r.text();
}

// Si confronta il JSON, non i byte: così a capo e spazi non fanno falsi allarmi.
const normale = (testo) => JSON.stringify(JSON.parse(testo));
let diversi = 0;
for (const nome of ['it.json', 'en.json']) {
  const sito = await leggi(nome);
  const percorso = join(destinazione, nome);
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
