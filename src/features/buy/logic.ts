/**
 * Le regole del «to buy», portate da public/planner/todo_buy.js del sito (stesso comportamento):
 * leggere una riga scritta in fretta («latte intero 1,20 #spesa !1»), indovinare la categoria dalle
 * parole, raggruppare e sommare. Qui non c'è nulla di grafico: si prova in Node.
 */
import type { Task } from '../tasks/repo';

export interface BuyCategory {
  uuid: string;
  name: string;
  color: string;
  sort_key: string;
}

export const DEFAULT_CATEGORY_COLOR = '#B7AEA3';

/** Minuscolo, senza accenti, solo lettere e cifre separate da uno spazio. */
export function norm(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** «12,90», «12.9», «€ 12» → centesimi; testo non valido → null. */
export function toCents(v: unknown): number | null {
  const s = String(v ?? '')
    .replace(/\s|€|eur(o)?/gi, '')
    .replace(',', '.');
  if (s === '' || !/^\d{1,7}(\.\d{0,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

/** Centesimi → «5,59 €» in italiano, «€5.59» in inglese (come sul sito). */
export function formatEuro(cents: number, lang: string): string {
  const n = Math.round(cents || 0) / 100;
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR' }).format(n);
  } catch {
    return n.toFixed(2).replace('.', ',') + ' €';
  }
}

/** Il prezzo come si scrive nella casella: «1,89». */
export function priceInput(cents: number | null): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

/* ---------------- il dizionario delle categorie ----------------
   Funziona solo se l'utente ha una categoria che si chiama in uno di questi modi: non ne inventa. */
const DIZ = [
  {
    nomi: [
      'spesa',
      'cibo',
      'alimentari',
      'alimenti',
      'supermercato',
      'food',
      'groceries',
      'grocery',
      'supermarket',
    ],
    parole:
      'latte milk pane bread uova uovo eggs egg pasta riso rice farina flour zucchero sugar sale salt olio oil burro butter formaggio cheese mozzarella parmigiano yogurt carne meat pollo chicken manzo beef maiale pork pesce fish salmone salmon tonno tuna frutta fruit verdura vegetables veggies mele mela apples apple banane banana bananas arance oranges limoni lemons pomodori tomatoes patate potatoes cipolle onions aglio garlic insalata lettuce salad carote carrots zucchine courgettes caffe coffee te tea acqua water vino wine birra beer biscotti biscuits cookies cereali cereal prosciutto ham salame affettati legumi fagioli beans ceci lenticchie lentils cioccolato chocolate succo juice gelato ice cream pizza surgelati frozen marmellata jam miele honey noci nuts',
  },
  {
    nomi: ['casa', 'home', 'household', 'pulizia', 'pulizie', 'cleaning', 'domestico'],
    parole:
      'detersivo detergent sapone piatti dish dishes spugna spugne sponge sponges carta igienica toilet paper scottex paper towels sacchetti bags spazzatura trash bin lampadina lampadine bulb bulbs pile batterie batteries candeggina bleach ammorbidente softener lavatrice washing anticalcare sgrassatore pellicola alluminio foil stracci cloth',
  },
  {
    nomi: [
      'beauty',
      'bellezza',
      'cura',
      'cura personale',
      'personal care',
      'igiene',
      'toiletries',
      'cosmetici',
      'cosmetics',
      'bagno',
      'bathroom',
    ],
    parole:
      'shampoo balsamo conditioner bagnoschiuma doccia shower gel deodorante deodorant dentifricio toothpaste spazzolino toothbrush filo interdentale floss crema creme cream rasoio razor lamette blades schiuma trucco makeup mascara rossetto lipstick profumo perfume smalto nail cotone cotton dischetti assorbenti tamponi pads',
  },
  {
    nomi: ['vestiti', 'abbigliamento', 'abiti', 'clothes', 'clothing', 'moda', 'fashion'],
    parole:
      'maglia maglietta t shirt tshirt shirt camicia pantaloni trousers pants jeans calze calzini socks scarpe shoes sneakers stivali boots giacca jacket felpa hoodie sweater maglione gonna skirt vestito dress cappotto coat mutande boxer underwear reggiseno bra pigiama pyjamas cintura belt cappello hat sciarpa scarf guanti gloves',
  },
  {
    nomi: ['farmacia', 'salute', 'medicine', 'medicinali', 'pharmacy', 'health'],
    parole:
      'tachipirina paracetamolo paracetamol ibuprofene ibuprofen moment aspirina aspirin cerotti plasters band aid vitamine vitamin vitamins sciroppo syrup termometro thermometer collirio gocce drops mascherine masks',
  },
  {
    nomi: ['tech', 'tecnologia', 'elettronica', 'electronics', 'informatica'],
    parole:
      'cavo cable caricatore charger cuffie headphones auricolari earphones mouse tastiera keyboard usb hdmi chiavetta adattatore adapter powerbank monitor',
  },
  {
    nomi: ['animali', 'pet', 'pets', 'cane', 'gatto'],
    parole: 'crocchette kibble lettiera litter scatolette antiparassitario guinzaglio leash',
  },
  {
    nomi: ['cartoleria', 'scuola', 'ufficio', 'stationery', 'school', 'office', 'universita'],
    parole:
      'penna penne pen pens quaderno quaderni notebook notebooks matita matite pencil evidenziatore highlighter gomma eraser righello ruler colla glue forbici scissors post it',
  },
].map((d) => ({ nomiN: d.nomi.map(norm), paroleN: ' ' + norm(d.parole) + ' ' }));

export function categoryFromWords(title: string, cats: BuyCategory[]): string | null {
  const words = norm(title).split(' ').filter(Boolean);
  for (const d of DIZ) {
    if (!words.some((w) => w.length > 1 && d.paroleN.includes(' ' + w + ' '))) continue;
    for (const c of cats) if (d.nomiN.includes(norm(c.name))) return c.uuid;
  }
  return null;
}

export interface QuickAdd {
  title: string;
  cents: number | null;
  catUuid: string | null;
  /** nome di una categoria che non esiste ancora (#nome): la crea chi chiama */
  newCategory: string | null;
  priority: number | null;
  url: string | null;
}

/** «latte intero 1,20 #spesa !1» → titolo, prezzo, categoria, priorità, link. */
export function parseQuickAdd(text: string, cats: BuyCategory[]): QuickAdd {
  const r: QuickAdd = {
    title: '',
    cents: null,
    catUuid: null,
    newCategory: null,
    priority: null,
    url: null,
  };
  let s = ' ' + String(text || '').trim() + ' ';
  s = s.replace(/\s(https?:\/\/\S+|www\.\S+)/i, (_m, u: string) => {
    r.url = u;
    return ' ';
  });
  s = s.replace(/\s!([123])?(?=\s)/, (_m, n?: string) => {
    r.priority = n ? +n : 1;
    return ' ';
  });
  s = s.replace(/\s#([^\s#!]+)/, (_m, nome: string) => {
    const n = norm(nome);
    const c = cats.find((x) => norm(x.name) === n) ?? cats.find((x) => norm(x.name).startsWith(n));
    if (c) r.catUuid = c.uuid;
    else r.newCategory = nome.replace(/[_-]+/g, ' ');
    return ' ';
  });
  // Il prezzo: un numero con i decimali, o con l'euro accanto. Un intero secco resta nel titolo («2 avocado»).
  s = s.replace(
    /\s(?:€\s?(\d{1,7}(?:[.,]\d{1,2})?)|(\d{1,7}[.,]\d{1,2})\s?(?:€|eur(?:o)?)?|(\d{1,7})\s?(?:€|eur(?:o)?))(?=\s)/i,
    (_m, a?: string, b?: string, c?: string) => {
      r.cents = toCents(a || b || c);
      return ' ';
    },
  );
  r.title = s.replace(/\s+/g, ' ').trim();
  if (!r.title && r.url) {
    try {
      r.title = new URL(/^https?:/i.test(r.url) ? r.url : 'https://' + r.url).hostname.replace(
        /^www\./,
        '',
      );
    } catch {
      r.title = r.url;
    }
  }
  if (r.catUuid === null && !r.newCategory) r.catUuid = categoryFromWords(r.title, cats);
  return r;
}

export interface BuyGroup {
  cat: BuyCategory | null;
  items: Task[];
}

export function sumCents(items: Task[]): number {
  return items.reduce((n, t) => n + (t.buy_price_cents ?? 0), 0);
}

/**
 * Dalle voci ancora da prendere alle sezioni: una per categoria (nell'ordine delle categorie),
 * «senza categoria» in fondo; dentro ogni sezione le più urgenti (priorità 1) in alto, poi l'ordine
 * scelto dall'utente. Le voci già prese (il carrello) si separano a parte.
 */
export function groupBuy(
  items: Task[],
  cats: BuyCategory[],
): { groups: BuyGroup[]; cart: Task[]; open: Task[] } {
  const open = items.filter((t) => !t.is_done);
  const cart = items.filter((t) => !!t.is_done);
  const byCat = new Map(cats.map((c) => [c.uuid, c]));
  const prio = (t: Task) => t.buy_priority || 3;
  const sorted = (l: Task[]) =>
    l
      .map((t, i) => [t, i] as const)
      .sort((a, b) => prio(a[0]) - prio(b[0]) || a[1] - b[1])
      .map((x) => x[0]);
  const groups: BuyGroup[] = [];
  for (const c of cats) {
    const inside = open.filter((t) => t.buy_category_uuid === c.uuid);
    if (inside.length) groups.push({ cat: c, items: sorted(inside) });
  }
  const without = open.filter((t) => !t.buy_category_uuid || !byCat.has(t.buy_category_uuid));
  if (without.length) groups.push({ cat: null, items: sorted(without) });
  return { groups, cart, open };
}
