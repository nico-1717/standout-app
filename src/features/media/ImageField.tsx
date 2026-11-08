import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import type { MediaTable } from '@/core/media/mediaQueue';
import { pickImage } from '@/core/media/pickImage';
import { useTheme } from '@/core/theme/ThemeProvider';
import { CardImage } from '@/features/flashcards/CardImage';

import { PrivateImage } from './PrivateImage';

/**
 * Un campo «immagine» di una riga sincronizzata: si vede quella attuale, si sceglie dalla libreria o si scatta una foto,
 * si toglie. La scelta resta subito sul telefono (già ridotta) e parte verso il sito appena c'è rete: finché non è
 * partita si vede la foto locale. Si usa solo su righe che esistono già (il sito vuole la riga prima del file).
 */
export function ImageField({
  table,
  uuid,
  slot,
  name,
  label,
  folder = 'card',
  testID,
}: {
  table: MediaTable;
  uuid: string;
  slot: string;
  /** il nome del file che la riga ha adesso */
  name: string | null | undefined;
  label: string;
  folder?: 'card' | 'example' | 'vocab' | 'private';
  testID: string;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const { services, changed } = useApp();
  const [busy, setBusy] = useState(false);
  if (!services) return null;

  const pending = services.media.pending(table, uuid, slot);
  const removed = pending?.op === 'delete';
  const localUri = pending?.op === 'put' ? pending.uri : null;
  const hasImage = !removed && (!!localUri || !!name);

  const pick = async (source: 'library' | 'camera') => {
    if (busy) return;
    setBusy(true);
    try {
      const file = await pickImage(source);
      if (!file) return;
      services.media.putFile(table, uuid, slot, file.uri, file.mime);
      services.scheduler.trigger(0);
      changed();
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    services.media.removeFile(table, uuid, slot);
    services.scheduler.trigger(0);
    changed();
  };

  const action = (id: string, text: string, onPress: () => void, color = th.brand) => (
    <Pressable
      testID={`${testID}-${id}`}
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      hitSlop={8}
      style={{ paddingVertical: 6 }}
    >
      <Text style={{ color, fontSize: 15, fontWeight: '600' }}>{text}</Text>
    </Pressable>
  );

  return (
    <View testID={testID} style={{ gap: 8 }}>
      <Text style={{ color: th.text2, fontSize: 13 }}>{label}</Text>
      {localUri ? (
        <Image
          testID={`${testID}-local`}
          source={{ uri: localUri }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
          style={{ width: '100%', height: 200, borderRadius: 10 }}
        />
      ) : !removed ? (
        folder === 'private' ? (
          <PrivateImage testID={`${testID}-remote`} uuid={uuid} name={name} />
        ) : (
          <CardImage testID={`${testID}-remote`} name={name} folder={folder} />
        )
      ) : null}
      {pending ? (
        <Text testID={`${testID}-waiting`} style={{ color: th.text3, fontSize: 12 }}>
          {t('comune.app_foto_in_invio')}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18 }}>
        {action(
          'library',
          hasImage ? t('vocab.mi_sostituisci') : t('comune.app_foto_libreria'),
          () => void pick('library'),
        )}
        {action('camera', t('comune.app_foto_scatta'), () => void pick('camera'))}
        {hasImage ? action('remove', t('vocab.mi_rimuovi_immagine'), remove, th.red) : null}
      </View>
    </View>
  );
}
