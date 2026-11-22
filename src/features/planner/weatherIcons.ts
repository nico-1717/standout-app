/**
 * Le icone del tempo, le stesse del sito (planner/js/03_meteo.js, WX_ICONE): forme piene e geometriche, ognuna con i
 * suoi colori (la nuvola in ardesia, il resto nel colore del tempo che dice). Qui sono modelli con dei segnaposto
 * `{sun}`, `{cloud}`…: `wxSvg` li riempie con i colori chiari o scuri, oppure con un colore solo (dentro un tag colorato).
 */
export type WxTint = 'sun' | 'heat' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm' | 'moon';

const LIGHT: Record<WxTint, string> = {
  sun: '#F2A100',
  heat: '#E5322D',
  cloud: '#64748B',
  fog: '#7B8A9C',
  rain: '#1C6EF2',
  snow: '#26A0D8',
  storm: '#7A3FE0',
  moon: '#4B57D4',
};
const DARK: Record<WxTint, string> = {
  sun: '#FFC53D',
  heat: '#FF6B5E',
  cloud: '#A9B6C6',
  fog: '#9AA8B8',
  rain: '#5AA9FF',
  snow: '#8FD6FF',
  storm: '#B794FF',
  moon: '#A9B2FF',
};

export const wxPalette = (dark: boolean): Record<WxTint, string> => (dark ? DARK : LIGHT);

/** Il colore dell'icona di un tempo (per i gradi che le stanno sotto). */
export function wxTint(name: string): WxTint {
  if (name === 'caldo') return 'heat';
  if (name === 'sole' || name === 'sole-nubi') return 'sun';
  if (name === 'luna' || name === 'luna-nubi') return 'moon';
  if (name === 'nebbia') return 'fog';
  if (name === 'neve') return 'snow';
  if (name === 'temporale') return 'storm';
  if (name.startsWith('pioggia')) return 'rain';
  return 'cloud';
}

const svg = (inner: string) => `<svg viewBox="0 0 24 24">${inner}</svg>`;
const n2 = (n: number) => n.toFixed(2);

const cloud = (tx: number, ty: number, s: number) =>
  `<g fill="{cloud}" transform="translate(${tx} ${ty}) scale(${s})">` +
  '<circle cx="9" cy="13.4" r="4"/><circle cx="14.6" cy="11.4" r="5.2"/><rect x="5" y="13.4" width="15.2" height="5.4" rx="2.7"/></g>';

const sun = (cx: number, cy: number, r: number, c: WxTint) => {
  let h = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="{${c}}"/>`;
  for (let i = 0; i < 8; i++) {
    h +=
      `<path d="M${cx - 1.3} ${cy - r - 1.5}L${cx} ${cy - r - 4.2}L${cx + 1.3} ${cy - r - 1.5}z" fill="{${c}}" ` +
      `stroke="{${c}}" stroke-width=".6" stroke-linejoin="round" transform="rotate(${i * 45} ${cx} ${cy})"/>`;
  }
  return h;
};

const drop = (x: number, y: number, len: number) =>
  `<path d="M${x + 0.9} ${y}l-1.8 ${len}" fill="none" stroke="{rain}" stroke-width="2.4" stroke-linecap="round"/>`;

const wave = (y: number, c: WxTint) =>
  `<path d="M4.5 ${y}q1.9 -1.6 3.75 0t3.75 0t3.75 0t3.75 0" fill="none" stroke="{${c}}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;

const flake = (cx: number, cy: number, R: number) => {
  const b = R * 0.62;
  const l = R * 0.34;
  let h = '';
  for (let i = 0; i < 3; i++) {
    h +=
      `<g transform="rotate(${i * 60} ${cx} ${cy})"><path d="M${cx} ${cy - R}V${cy + R}" fill="none" stroke="{snow}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M${n2(cx - l)} ${n2(cy - b - l)}L${cx} ${n2(cy - b)}L${n2(cx + l)} ${n2(cy - b - l)}` +
      `M${n2(cx - l)} ${n2(cy + b + l)}L${cx} ${n2(cy + b)}L${n2(cx + l)} ${n2(cy + b + l)}" ` +
      'fill="none" stroke="{snow}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></g>';
  }
  return `${h}<circle cx="${cx}" cy="${cy}" r="1.6" fill="{snow}"/>`;
};

const solid = (d: string, c: WxTint, w = 1) =>
  `<path d="${d}" fill="{${c}}" stroke="{${c}}" stroke-width="${w}" stroke-linejoin="round"/>`;

const MOON = 'M20 14.6A8.6 8.6 0 019.4 4a7.6 7.6 0 1010.6 10.6z';
const MOON_SMALL = 'M12.2 10.2A5.6 5.6 0 015.8 2.6a5 5 0 106.4 7.6z';
const BOLT = 'M13.8 12.8l-4.4 5.9h3.3l-1.4 4.6 5-6.6h-3.4z';
const dots = (c: WxTint) =>
  [
    [5.6, 16.6],
    [12.1, 16.6],
    [18.6, 16.6],
    [8.6, 20.8],
    [15.1, 20.8],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="{${c}}"/>`)
    .join('');

export const WX_ICONS: Record<string, string> = {
  sole: svg(sun(12, 12, 4.4, 'sun')),
  caldo: svg(sun(12, 9, 3.4, 'heat') + wave(19.6, 'heat') + wave(22.4, 'heat')),
  'sole-nubi': svg(sun(8.4, 8.4, 3.3, 'sun') + cloud(5.4, 7.6, 0.8)),
  nubi: svg(cloud(0, 0, 1)),
  nebbia: svg(cloud(2.3, -3.2, 0.8) + dots('fog')),
  'pioggia-leggera': svg(cloud(2.3, -1.9, 0.8) + drop(9.8, 15.6, 3.6) + drop(14.2, 15.6, 3.6)),
  pioggia: svg(
    cloud(2.3, -1.9, 0.8) + drop(8.4, 15.6, 3.6) + drop(12.2, 15.6, 3.6) + drop(16, 15.6, 3.6),
  ),
  'pioggia-forte': svg(
    cloud(2.3, -1.9, 0.8) +
      drop(7.6, 15.6, 4.4) +
      drop(10.6, 15.6, 4.4) +
      drop(13.6, 15.6, 4.4) +
      drop(16.6, 15.6, 4.4),
  ),
  neve: svg(flake(12, 12, 8.6)),
  temporale: svg(cloud(2.3, -2.6, 0.8) + solid(BOLT, 'storm')),
  luna: svg(solid(MOON, 'moon', 0.8)),
  'luna-nubi': svg(solid(MOON_SMALL, 'moon', 0.8) + cloud(5.4, 7.6, 0.8)),
};

/**
 * Il disegno pronto per `SvgXml`. Con `mono` ogni colore diventa quello dato (l'icona dentro un tag colorato, tutta
 * d'un colore); altrimenti ognuno prende il suo, chiaro o scuro.
 */
export function wxSvg(name: string, opts: { mono?: string; dark?: boolean } = {}): string {
  const tpl = WX_ICONS[name] ?? WX_ICONS.nubi!;
  const palette = wxPalette(!!opts.dark);
  return tpl.replace(
    /\{(\w+)\}/g,
    (_, k: string) => opts.mono ?? palette[k as WxTint] ?? '#64748B',
  );
}
