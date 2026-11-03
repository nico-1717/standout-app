// Genera i casi d'oro del documento delle carte: fa girare il codice VERO del sito (public/fc/fc_parser.js)
// su una serie di testi e salva cosa produce fcdParse, fcdTrimText e il testo semplice di ogni blocco.
//   node scripts/gen-fc-doc-golden.mjs ../standout/public/fc/fc_parser.js
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(process.argv[2] ?? '../standout/public/fc/fc_parser.js', 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(src, ctx);
const run = (code) => vm.runInContext(code, ctx);

const inputs = [
  '',
  '   ',
  'Ciao',
  'Una riga\nseconda riga\n\nterza dopo un vuoto',
  '  spazi ai bordi  ',
  '/bold{grassetto} e /italic{corsivo} e /underline{sottolineato}',
  '/red{rosso} /blue{blu} /green{verde} /purple{viola} /orange{arancio} /gray{grigio}',
  '/yellow{evidenziato}',
  '/red{/bold{rosso e grassetto}} contro /bold{/red{grassetto e rosso}}',
  '/bold{uno /italic{due /underline{tre}} quattro}',
  '/bold{non chiuso',
  '/sconosciuto{ciao}',
  'La formula $x^2 + y^2$ sta in linea',
  'Prima\n$$E = mc^2$$\ndopo',
  '$$a+b$$',
  'costa 5$ e 3$ ma è una formula $ aperta',
  '/list{\n- primo\n- secondo\n-- annidato\n- terzo\n}',
  '/list-red{\n- rosso 1\n- rosso 2\n}',
  '/list-viola{\n- colore sconosciuto\n}',
  '/list{\n- punto con $$f(x)$$ dentro\ncontinua qui\n- altro\n}',
  'Testo prima\n/list{\n- uno\n- due\n}\nTesto dopo',
  '/list{\n• con pallino\n•• secondo livello\n}',
  '/list{\nsenza trattino\n- con trattino\n}',
  '/list{\n- /bold{grassetto} nel punto\n- /red{rosso} nel punto\n}',
  'riga con\r\ncrlf\rcr',
  '{"v":2,"blocks":[{"t":"p","runs":[{"s":"Ciao","m":{"b":1}}]}]}',
  '{"v":2,"blocks":[{"t":"p","runs":[{"s":"a"},{"s":"b"},{"s":"c","m":{"i":1}},{"s":"d","m":{"i":1}}]}]}',
  '{"v":2,"blocks":[{"t":"li","lvl":2,"c":"red","runs":[{"s":"punto"}]},{"t":"li","lvl":0,"c":"viola","runs":[{"s":"x"}],"ck":1},{"t":"li","lvl":99,"runs":[],"ck":5}]}',
  '{"v":2,"blocks":[{"t":"fx","tex":"a^2"},{"t":"fx","tex":"b","lvl":3,"c":"green","m":{"b":1}}]}',
  '{"v":2,"blocks":[{"t":"p","code":"python","hl":1,"runs":[{"s":"print(1)"}]},{"t":"p","code":"zzz","runs":[{"s":"x"}]},{"t":"p","q":1,"runs":[{"s":"citazione"}]}]}',
  '{"v":2,"blocks":[{"t":"p","lvl":2,"runs":[{"s":"continuo"}]}]}',
  '{"v":2,"blocks":[{"t":"p","runs":[{"x":"x^2"},{"s":"\\u200Bdopo\\u200B"},{"s":""},{"x":"  ","m":{"c":"red"}}]}]}',
  '{"v":2,"blocks":[{"t":"p","runs":[{"s":"\\n"}]},{"t":"p","runs":[]},{"t":"p","runs":[{"s":"  fine  "}]}]}',
  '{"v":2,"blocks":[]}',
  '{"v":2,"blocks":[null,5,{"t":"p"},{"t":"li"}]}',
  '{"v":2,"blocks":[{"t":"p","runs":[{"s":"x","m":{"b":0,"i":false,"u":"","h":"red","c":"gold","zz":1}}]}]}',
  '{"v":2,"blocks":[{"t":"p","runs":[]},{"t":"p","runs":[{"s":"  "}]},{"t":"p","runs":[{"s":" dentro "}]},{"t":"p","runs":[]},{"t":"fx","tex":"  "}]}',
  '{non è json "blocks"',
  '<b>html</b> & "virgolette" <script>',
  'Domanda: $\\frac{1}{2}$?\n/bold{Risposta}: due',
  'Emoji 😀 e accenti àèìòù — ok',
];

const out = inputs.map((input) => {
  const parse = run(`JSON.stringify(fcdParse(${JSON.stringify(input)}))`);
  const trimmed = run(`fcdTrimText(${JSON.stringify(input)})`);
  const plain = run(`fcdParse(${JSON.stringify(input)}).blocks.map(fcdBlockText).join('\\n')`);
  return { input, parse: JSON.parse(parse), trimmed, plain };
});
fs.writeFileSync(
  'src/features/flashcards/__tests__/fixtures/doc.json',
  JSON.stringify(out, null, 1),
);
console.log(out.length, 'casi');
