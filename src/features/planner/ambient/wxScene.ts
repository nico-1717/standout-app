import type { WxState } from '@/core/account/accountApi';

import { rng, type Particle } from './scene';

/**
 * La scena del meteo nella fascia in alto (WXA_SCENA, wxCaldo, wxNotte e renderAmbientMeteo di 02_fascia_alta.js):
 * decide quali pezzi ci sono e dove stanno, senza disegnare. Il caso del sito è `Math.random()`; qui un generatore
 * con seme, così la stessa giornata ha sempre la stessa scena.
 */

type Recipe = {
  sun: boolean;
  clouds: number;
  drops: number;
  kind: 'rain' | 'snow' | null;
  overcast?: boolean;
  fog?: boolean;
  lightning?: boolean;
};

export const WXA_SCENA: Record<string, Recipe> = {
  sole: { sun: true, clouds: 0, drops: 0, kind: null },
  'sole-nubi': { sun: true, clouds: 3, drops: 0, kind: null },
  nubi: { sun: false, clouds: 7, drops: 0, kind: null, overcast: true },
  nebbia: { sun: false, clouds: 2, drops: 0, kind: null, fog: true },
  'pioggia-leggera': { sun: false, clouds: 4, drops: 22, kind: 'rain' },
  pioggia: { sun: false, clouds: 6, drops: 40, kind: 'rain', overcast: true },
  'pioggia-forte': { sun: false, clouds: 7, drops: 56, kind: 'rain', overcast: true },
  neve: { sun: false, clouds: 5, drops: 34, kind: 'snow' },
  temporale: { sun: false, clouds: 7, drops: 46, kind: 'rain', lightning: true, overcast: true },
};

/** Quanto fa caldo, in tre gradini: lo decide la massima del giorno, non l'icona. */
export function wxCaldo(tmax: number | null): 0 | 1 | 2 | 3 {
  if (tmax === null) return 0;
  if (tmax >= 36) return 3;
  if (tmax >= 32) return 2;
  if (tmax >= 28) return 1;
  return 0;
}

export type WxSceneInput = { icon: string; tmax: number | null; night: boolean };

/**
 * Che cosa mostrare per un giorno. Su oggi conta che tempo fa adesso (e se è buio, calcolato dal server su alba e
 * tramonto veri; l'orologio solo come ripiego); sugli altri giorni il riassunto è l'unica cosa che si possa dire.
 */
export function wxSceneInput(
  wx: WxState | null | undefined,
  date: string,
  today: string,
  now: Date,
): WxSceneInput | null {
  if (!wx?.enabled) return null;
  const day = wx.giorni[date];
  if (!day) return null;
  if (date !== today) return { icon: day.icon, tmax: day.tmax, night: false };
  const hour = now.getHours();
  const night = wx.adesso && wx.adesso.giorno !== null ? !wx.adesso.giorno : hour < 6 || hour >= 20;
  return { icon: wx.adesso?.icon || day.icon, tmax: day.tmax, night };
}

export type Cloud = {
  top: number;
  width: number;
  duration: number;
  /** secondi già trascorsi alla prima immagine */
  delay: number;
  opacity: number;
};
export type Fog = { top: number; duration: number; delay: number };

export type WxScene = {
  sun: boolean;
  moon: boolean;
  hot: 0 | 1 | 2 | 3;
  hotSun: boolean;
  night: boolean;
  overcast: boolean;
  lightning: boolean;
  clouds: Cloud[];
  fog: Fog[];
  drops: Particle[];
  stars: Particle[];
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const between = (r: () => number, a: number, b: number) => a + r() * (b - a);

export function buildWxScene(input: WxSceneInput): WxScene {
  const recipe = WXA_SCENA[input.icon] ?? WXA_SCENA['nubi']!;
  const r = rng(hash(`${input.icon}|${input.night ? 'n' : 'g'}`));
  const hot = wxCaldo(input.tmax);
  const overcast = recipe.overcast === true;

  const clouds: Cloud[] = Array.from({ length: recipe.clouds }, () => ({
    top: Math.round(between(r, 4, 34)),
    width: Math.round(between(r, 78, 132)),
    duration: Math.round(between(r, 90, 150)),
    delay: Math.round(between(r, 0, 80)),
    opacity: 0.62 + r() * 0.34,
  }));
  const fog: Fog[] = recipe.fog
    ? [0, 1, 2].map((f) => ({
        top: 24 + f * 20,
        duration: Math.round(between(r, 28, 46)),
        delay: Math.round(between(r, 0, 20)),
      }))
    : [];

  const snow = recipe.kind === 'snow';
  const drops: Particle[] = Array.from({ length: recipe.drops }, () => {
    const size = snow ? between(r, 4, 7.5) : between(r, 7, 13);
    return {
      type: snow ? 'snow' : 'rain',
      left: between(r, -2, 98),
      size: snow ? size : size / 3.4,
      height: size,
      color: snow ? '#FFFFFF' : '#6F9BB8',
      duration: snow ? between(r, 9, 16) : between(r, 1.1, 2.2),
      phase: r(),
      sway: between(r, -14, 14),
      top: 0,
    };
  });

  const clearSky = !overcast && !recipe.drops && !recipe.fog;
  const stars: Particle[] =
    input.night && clearSky
      ? Array.from({ length: 12 }, () => {
          const size = between(r, 4, 8);
          return {
            type: 'star',
            left: between(r, 2, 96),
            top: between(r, 6, 62),
            size,
            color: '#FFF3D2',
            duration: between(r, 2.4, 5.5),
            phase: r(),
            sway: 0,
          };
        })
      : [];

  return {
    sun: recipe.sun && !input.night,
    moon: recipe.sun && input.night,
    hot,
    hotSun: !input.night && hot >= 2,
    night: input.night,
    overcast,
    lightning: recipe.lightning === true,
    clouds,
    fog,
    drops,
    stars,
  };
}
