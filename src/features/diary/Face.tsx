import { SvgXml } from 'react-native-svg';

import { faceSvg, type FaceKind } from './faces';

/** Una faccina (umore) o una stella/batteria (energia), nel disegno del sito per lo stile in uso. */
export function Face({
  kind,
  level,
  size,
  style,
  color,
}: {
  kind: FaceKind;
  level: number | null;
  size: number;
  style: 'standard' | 'paper';
  color: string;
}) {
  return <SvgXml xml={faceSvg(kind, level, size, style, color)} width={size} height={size} />;
}
