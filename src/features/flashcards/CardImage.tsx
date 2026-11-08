import { Image } from 'expo-image';
import { memo } from 'react';

import { cardImageUrl, exampleImageUrl, vocabImageUrl } from './media';

/** L'immagine di una carta, intera nel riquadro. Senza nome valido non disegna niente. */
export const CardImage = memo(function CardImage({
  name,
  height = 200,
  testID,
  folder = 'card',
}: {
  name: string | null | undefined;
  height?: number;
  testID?: string;
  folder?: 'card' | 'example' | 'vocab';
}) {
  const uri =
    folder === 'example'
      ? exampleImageUrl(name)
      : folder === 'vocab'
        ? vocabImageUrl(name)
        : cardImageUrl(name);
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
