import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StatusBar, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from './deckUi';

/**
 * L'immagine a schermo intero: sfondo nero, due dita per ingrandire, un tocco (o la X) per chiudere.
 * Si usa sopra una carta che si apre con un tocco: toccare la foto la guarda, non apre la carta.
 */
export function ImageZoom({
  uri,
  visible,
  onClose,
  testID,
}: {
  uri: string;
  visible: boolean;
  onClose: () => void;
  testID?: string;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      testID={testID}
    >
      <StatusBar hidden={false} barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ width, height, justifyContent: 'center' }}
        >
          <Pressable
            testID={testID ? `${testID}-tap` : undefined}
            accessibilityLabel="close"
            onPress={onClose}
            style={{ width, height }}
          >
            <Image
              source={{ uri }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
              style={{ width, height }}
            />
          </Pressable>
        </ScrollView>
        <Pressable
          testID={testID ? `${testID}-close` : undefined}
          accessibilityRole="button"
          accessibilityLabel="close"
          hitSlop={10}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: Math.max(insets.top, 16) + 6,
            right: 16,
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        >
          <Glyph name="close" size={20} color="#fff" stroke={2.4} />
        </Pressable>
      </View>
    </Modal>
  );
}

/** Lo stato «aperta / chiusa» di un'immagine a schermo intero. */
export function useImageZoom(): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(false);
  return [open, () => setOpen(true), () => setOpen(false)];
}

/** Una foto già sul telefono (appena scelta): la si vede nel riquadro e con un tocco a schermo intero. */
export function ZoomImage({
  uri,
  height,
  testID,
}: {
  uri: string;
  height: number;
  testID?: string;
}) {
  const [open, show, hide] = useImageZoom();
  return (
    <>
      <Pressable
        testID={testID ? `${testID}-zoom` : undefined}
        accessibilityRole="imagebutton"
        onPress={show}
      >
        <Image
          testID={testID}
          source={{ uri }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
          style={{ width: '100%', height, borderRadius: 10 }}
        />
      </Pressable>
      <ImageZoom
        testID={testID ? `${testID}-full` : undefined}
        uri={uri}
        visible={open}
        onClose={hide}
      />
    </>
  );
}
