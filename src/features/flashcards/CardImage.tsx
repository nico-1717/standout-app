import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable } from 'react-native';

import { ImageZoom, useImageZoom } from './ImageZoom';
import { cardImageUrl, exampleImageUrl, vocabImageUrl } from './media';

/** L'immagine di una carta, intera nel riquadro. Senza nome valido non disegna niente. */
export const CardImage = memo(function CardImage({
  name,
  height = 200,
  testID,
  folder = 'card',
  zoom = false,
}: {
  name: string | null | undefined;
  height?: number;
  testID?: string;
  folder?: 'card' | 'example' | 'vocab';
  /** Un tocco apre la foto a schermo intero (e non fa niente altro: nemmeno aprire la carta che la contiene). */
  zoom?: boolean;
}) {
  const [open, show, hide] = useImageZoom();
  const uri =
    folder === 'example'
      ? exampleImageUrl(name)
      : folder === 'vocab'
        ? vocabImageUrl(name)
        : cardImageUrl(name);
  if (!uri) return null;
  const picture = (
    <Image
      testID={testID}
      source={{ uri }}
      contentFit="contain"
      transition={150}
      accessibilityIgnoresInvertColors
      style={{ width: '100%', height, borderRadius: 10 }}
    />
  );
  if (!zoom) return picture;
  return (
    <>
      <Pressable
        testID={testID ? `${testID}-zoom` : undefined}
        accessibilityRole="imagebutton"
        onPress={show}
      >
        {picture}
      </Pressable>
      <ImageZoom
        testID={testID ? `${testID}-full` : undefined}
        uri={uri}
        visible={open}
        onClose={hide}
      />
    </>
  );
});
