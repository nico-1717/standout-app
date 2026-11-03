import { Image } from 'expo-image';
import { memo } from 'react';

import { cardImageUrl } from './media';

/** L'immagine di una carta, intera nel riquadro. Senza nome valido non disegna niente. */
export const CardImage = memo(function CardImage({
  name,
  height = 200,
  testID,
}: {
  name: string | null | undefined;
  height?: number;
  testID?: string;
}) {
  const uri = cardImageUrl(name);
  if (!uri) return null;
  return (
    <Image
      testID={testID}
      source={{ uri }}
      contentFit="contain"
      transition={150}
      accessibilityIgnoresInvertColors
      style={{ width: '100%', height, borderRadius: 10 }}
    />
  );
});
