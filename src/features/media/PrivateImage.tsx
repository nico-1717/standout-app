import { Image } from 'expo-image';
import { useEffect, useState } from 'react';

import { useApp } from '@/core/app/AppProvider';

/** Un'immagine privata di una riga (to buy): si scarica col token una volta sola. Finché non c'è, non disegna niente. */
export function PrivateImage({
  uuid,
  name,
  height = 200,
  testID,
}: {
  uuid: string;
  name: string | null | undefined;
  height?: number;
  testID?: string;
}) {
  const { services } = useApp();
  const [got, setGot] = useState<{ key: string; uri: string } | null>(null);
  const key = `${uuid}/${name ?? ''}`;
  useEffect(() => {
    let alive = true;
    void services?.privateImages.get(uuid, name).then((uri) => {
      if (alive && uri) setGot({ key, uri });
    });
    return () => {
      alive = false;
    };
  }, [services, uuid, name, key]);
  if (!got || got.key !== key) return null;
  return (
    <Image
      testID={testID}
      source={{ uri: got.uri }}
      contentFit="contain"
      transition={150}
      accessibilityIgnoresInvertColors
      style={{ width: '100%', height, borderRadius: 10 }}
    />
  );
}
