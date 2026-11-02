/**
 * Le faccine e le stelline del diario, copiate dal sito (public/planner/diario_giorno.php, standoutFace):
 * a matita nello stile «carta», colorate (faccia piena e batteria) nello stile «standard».
 * Qui sono solo markup SVG: chi le disegna è <Face>.
 */

const HEAD =
  'M20 3.4c9.2 0 16.4 7.2 16.6 16.4.2 9.4-7.2 16.8-16.6 16.8S3.2 29.4 3.4 19.8C3.6 10.6 10.8 3.4 20 3.4z';
const MOUTHS: Record<number, string> = {
  1: 'M13 27.5c1.8-3.4 5.6-3.4 7 -3.4 1.4 0 5.2 0 7 3.4',
  2: 'M13 26.4c2 -1.6 5.4-1.6 7 -1.6 1.6 0 5 0 7 1.6',
  3: 'M13.4 25.6h13.2',
  4: 'M13 24.2c2 1.8 5.4 1.8 7 1.8 1.6 0 5 0 7 -1.8',
  5: 'M12.4 23c1.4 3.8 5.4 5 7.6 5 2.2 0 6.2-1.2 7.6-5',
};
const EYES: Record<number, string> = {
  1: '<path d="M13.6 18.6c1-1.2 2.6-1.2 3.6 0"/><path d="M22.8 18.6c1-1.2 2.6-1.2 3.6 0"/>',
  2: '<path d="M14 18.4h3.2"/><path d="M22.8 18.4h3.2"/>',
  3: '<circle cx="15.4" cy="18" r="1.35" fill="currentColor" stroke="none"/><circle cx="24.6" cy="18" r="1.35" fill="currentColor" stroke="none"/>',
};
const STAR_BODY = 'M20 4.6l4.2 8.8 9.6 1.3-7 6.7 1.7 9.5-8.5-4.7-8.5 4.7 1.7-9.5-7-6.7 9.6-1.3z';
const STARS: Record<number, string> = {
  1:
    `<g transform="translate(20 26) rotate(-74) scale(.72) translate(-20 -20)"><path d="${STAR_BODY}"/></g>` +
    '<path d="M6 35h28" opacity=".55"/><path d="M12.5 19.5c-1.6 1.4-2.6 3.2-3 5.2" opacity=".8"/>',
  2:
    `<g transform="translate(20 24) rotate(-16) scale(.8) translate(-20 -20)"><path d="${STAR_BODY}"/></g>` +
    '<path d="M7 35h26" opacity=".55"/>',
  3:
    `<g transform="translate(20 21) rotate(-7) scale(.86) translate(-20 -20)"><path d="${STAR_BODY}"/></g>` +
    '<path d="M8 35h24" opacity=".45"/>',
  4:
    `<g transform="translate(20 20) scale(.92) translate(-20 -20)"><path d="${STAR_BODY}"/></g>` +
    '<path d="M9 36h22" opacity=".35"/>',
  5:
    `<g transform="translate(20 18) scale(.96) translate(-20 -20)"><path d="${STAR_BODY}"/></g>` +
    '<path d="M6.5 12.5l-2.4-1.6M33.5 12.5l2.4-1.6M20 3.2V.6"/>' +
    '<path d="M11 35.5c3-1.6 15-1.6 18 0" opacity=".45"/>',
};

/** I colori dei cinque livelli nello stile standard (dal rosso al verde). */
export const LEVEL_COLORS: Record<number, string> = {
  1: '#FF453A',
  2: '#FF9F0A',
  3: '#FFCC00',
  4: '#8BD450',
  5: '#30D158',
};
/** Gli stessi, un po' più scuri, per il testo e il bordo del riquadro (sul chiaro si leggono meglio). */
export const LEVEL_TEXT: Record<number, string> = {
  1: '#FF453A',
  2: '#FF9F0A',
  3: '#E0B000',
  4: '#5DB52A',
  5: '#22B14C',
};

const STD_EYES: Record<number, string> = {
  1: '<path d="M12.4 15.4l4-1.8M27.6 15.4l-4-1.8"/><circle cx="14.6" cy="19" r="1.7" fill="#1C1C1E" stroke="none"/><circle cx="25.4" cy="19" r="1.7" fill="#1C1C1E" stroke="none"/>',
  2: '<circle cx="14.6" cy="17.6" r="1.8" fill="#1C1C1E" stroke="none"/><circle cx="25.4" cy="17.6" r="1.8" fill="#1C1C1E" stroke="none"/>',
  3: '<circle cx="14.6" cy="17.2" r="1.8" fill="#1C1C1E" stroke="none"/><circle cx="25.4" cy="17.2" r="1.8" fill="#1C1C1E" stroke="none"/>',
  4: '<circle cx="14.6" cy="16.8" r="1.9" fill="#1C1C1E" stroke="none"/><circle cx="25.4" cy="16.8" r="1.9" fill="#1C1C1E" stroke="none"/>',
  5: '<path d="M12.2 17.6q2.4-3 4.8 0M23 17.6q2.4-3 4.8 0"/>',
};
const STD_MOUTH: Record<number, string> = {
  1: '<path d="M13.5 28.6q6.5-6 13 0"/>',
  2: '<path d="M14.5 27.4q5.5-3 11 0"/>',
  3: '<path d="M14.8 26h10.4"/>',
  4: '<path d="M13.8 24q6.2 5.6 12.4 0"/>',
  5: '<path d="M12.4 22.6h15.2q-.6 8.2-7.6 8.2t-7.6-8.2Z" fill="#1C1C1E"/><path d="M15.6 28.4q4.4 2.6 8.8 0" stroke="#FF6B81" stroke-width="2.2"/>',
};

export type FaceKind = 'mood' | 'energy';

const clampLevel = (level: number | null): number =>
  level ? Math.max(1, Math.min(5, Math.round(level))) : 0;

/**
 * Il disegno di una faccina (umore) o di una stella/batteria (energia) come testo SVG.
 * `color` è il colore di «currentColor» (nella carta il disegno è a matita, tutto in un colore).
 */
export function faceSvg(
  kind: FaceKind,
  level: number | null,
  size: number,
  style: 'standard' | 'paper',
  color: string,
): string {
  const lv = clampLevel(level);
  if (style === 'standard') {
    const open = `<svg viewBox="0 0 40 40" width="${size}" height="${size}" color="${color}" fill="none" stroke-linecap="round" stroke-linejoin="round">`;
    if (kind === 'energy') {
      const col = lv ? LEVEL_COLORS[lv] : color;
      let out =
        `${open}<rect x="4.5" y="11" width="27" height="18" rx="4.6" stroke="${col}" stroke-width="2.2"` +
        `${lv ? '' : ' stroke-dasharray="3.2 3" opacity=".75"'}/>` +
        `<path d="M34.3 16.6v6.8" stroke="${col}" stroke-width="2.6"${lv ? '' : ' opacity=".75"'}/>`;
      for (let i = 0; i < 5; i++) {
        const x = (7.6 + i * 4.6).toFixed(1);
        out +=
          `<rect x="${x}" y="14.1" width="3.5" height="11.8" rx="1.3" fill="${col}"` +
          `${lv && i < lv ? '' : ` opacity="${lv ? '.16' : '0'}"`}/>`;
      }
      if (lv === 5)
        out +=
          '<path d="M19.6 13.4l-3.6 7h3.4l-1.6 6.2 5-7.6h-3.5l1.6-5.6Z" fill="#fff" stroke="none"/>';
      return `${out}</svg>`;
    }
    if (!lv) {
      return (
        `${open}<circle cx="20" cy="20" r="16.2" stroke="${color}" stroke-width="2" stroke-dasharray="3.2 3.1" opacity=".75"/>` +
        `<path d="M20 15v10M15 20h10" stroke="${color}" stroke-width="2" opacity=".55"/></svg>`
      );
    }
    return (
      `${open}<circle cx="20" cy="20" r="17" fill="${LEVEL_COLORS[lv]}"/>` +
      '<path d="M9.5 12.5A13 13 0 0 1 20 7" stroke="#fff" stroke-width="2.2" opacity=".45"/>' +
      `<g stroke="#1C1C1E" stroke-width="2.2">${STD_EYES[lv]}${STD_MOUTH[lv]}</g></svg>`
    );
  }
  const open = `<svg viewBox="0 0 40 40" width="${size}" height="${size}" color="${color}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">`;
  if (!lv) {
    const empty = kind === 'energy' ? STAR_BODY : HEAD;
    return `${open}<path d="${empty}" stroke-dasharray="3.4 3.6" opacity=".75"/></svg>`;
  }
  if (kind === 'energy') return `${open}${STARS[lv]}</svg>`;
  const eyes = EYES[lv >= 4 ? 3 : lv === 1 ? 1 : 2];
  return `${open}<path d="${HEAD}"/>${eyes}<path d="${MOUTHS[lv]}"/></svg>`;
}
