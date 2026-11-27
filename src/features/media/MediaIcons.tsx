import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import type { MediaTable } from '@/core/media/mediaQueue';
import { keepFile } from '@/core/media/phoneFiles';
import { pickImage } from '@/core/media/pickImage';
import { useTheme } from '@/core/theme/ThemeProvider';
import { CardAudio } from '@/features/flashcards/CardAudio';
import { CardImage } from '@/features/flashcards/CardImage';
import { ZoomImage } from '@/features/flashcards/ImageZoom';
import { Glyph, type GlyphName } from '@/features/flashcards/deckUi';

import { Recorder } from './AudioField';

type Slot = { table: MediaTable; uuid: string; slot: string; name: string | null | undefined };

/** Che cosa c'è adesso nel posto di un file: quello già sul sito, quello appena scelto (ancora sul telefono) o niente. */
function useSlot({ table, uuid, slot, name }: Slot) {
  const { services } = useApp();
  const pending = services?.media.pending(table, uuid, slot) ?? null;
  const removed = pending?.op === 'delete';
  const localUri = pending?.op === 'put' ? pending.uri : null;
  return { pending, removed, localUri, has: !removed && (!!localUri || !!name) };
}

/** Il tondino piccolo accanto al campo: grigio, o del colore della categoria se il file c'è già. */
function IconBtn({
  testID,
  label,
  glyph,
  color,
  on,
  onPress,
}: {
  testID: string;
  label: string;
  glyph: GlyphName;
  color: string;
  on: boolean;
  onPress: () => void;
}) {
  const th = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: on ? `${color}26` : th.surface2,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Glyph name={glyph} size={17} color={on ? color : th.text2} stroke={2.2} />
    </Pressable>
  );
}

const Pill = ({
  testID,
  label,
  color,
  onPress,
  disabled,
}: {
  testID: string;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    testID={testID}
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={{
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 99,
      backgroundColor: `${color}1F`,
      opacity: disabled ? 0.5 : 1,
    }}
  >
    <Text style={{ color, fontSize: 12.5, fontWeight: '800' }}>{label}</Text>
  </Pressable>
);

/**
 * L'icona «foto» di un lato della carta. Un tocco apre la scelta: dalla libreria o scatta una foto (una sola icona per tutte
 * e due, come chiesto). La scelta resta subito sul telefono e parte verso il sito appena c'è rete.
 * Va dentro una riga con `flexWrap`: accanto all'icona compaiono le due scelte.
 */
export function PhotoButton(p: Slot & { testID: string; color: string }) {
  const { t } = useTranslation();
  const th = useTheme();
  const { services, changed } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { has } = useSlot(p);
  if (!services) return null;

  const pick = async (source: 'library' | 'camera') => {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    try {
      const file = await pickImage(source);
      if (!file) return;
      services.media.putFile(p.table, p.uuid, p.slot, file.uri, file.mime);
      services.scheduler.trigger(0);
      changed();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <IconBtn
        testID={p.testID}
        label={t('fcv.immagine')}
        glyph="photo"
        color={has ? p.color : th.text2}
        on={has || open}
        onPress={() => setOpen(!open)}
      />
      {open ? (
        <>
          <Pill
            testID={`${p.testID}-library`}
            label={t('comune.app_foto_libreria')}
            color={p.color}
            disabled={busy}
            onPress={() => void pick('library')}
          />
          <Pill
            testID={`${p.testID}-camera`}
            label={t('comune.app_foto_scatta')}
            color={p.color}
            disabled={busy}
            onPress={() => void pick('camera')}
          />
        </>
      ) : null}
    </>
  );
}

/** La foto di un lato, sotto al testo, con la sua crocetta per toglierla. */
export function PhotoPreview(p: Slot & { testID: string; folder?: 'card' | 'example' | 'vocab' }) {
  const { t } = useTranslation();
  const th = useTheme();
  const { services, changed } = useApp();
  const { pending, removed, localUri, has } = useSlot(p);
  if (!services || !has) return null;

  return (
    <View testID={`${p.testID}-preview`} style={{ gap: 6 }}>
      <View>
        {localUri ? (
          <ZoomImage testID={`${p.testID}-local`} uri={localUri} height={200} />
        ) : !removed ? (
          <CardImage testID={`${p.testID}-remote`} name={p.name} folder={p.folder ?? 'card'} zoom />
        ) : null}
        <Pressable
          testID={`${p.testID}-remove`}
          accessibilityRole="button"
          accessibilityLabel={t('vocab.mi_rimuovi_immagine')}
          hitSlop={8}
          onPress={() => {
            services.media.removeFile(p.table, p.uuid, p.slot);
            services.scheduler.trigger(0);
            changed();
          }}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,.55)',
          }}
        >
          <Glyph name="close" size={14} color="#fff" stroke={2.8} />
        </Pressable>
      </View>
      {pending ? (
        <Text testID={`${p.testID}-waiting`} style={{ color: th.text3, fontSize: 12 }}>
          {t('comune.app_foto_in_invio')}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * L'icona «microfono» di un lato: un tocco comincia a registrare (e sostituisce quello che c'era), il tasto rosso ferma.
 * Come per le foto, la registrazione resta sul telefono e parte verso il sito appena c'è rete.
 */
export function MicButton(
  p: Slot & { testID: string; color: string; onError: (failed: boolean) => void },
): ReactNode {
  const { t } = useTranslation();
  const th = useTheme();
  const { services, changed } = useApp();
  const [recording, setRecording] = useState(false);
  const { has } = useSlot(p);
  if (!services) return null;

  const onDone = (uri: string | null) => {
    setRecording(false);
    if (!uri) {
      p.onError(true);
      return;
    }
    services.media.putFile(p.table, p.uuid, p.slot, keepFile(uri, 'm4a'), 'audio/mp4');
    services.scheduler.trigger(0);
    changed();
  };

  return recording ? (
    <Recorder onDone={onDone} />
  ) : (
    <IconBtn
      testID={`${p.testID}-record`}
      label={has ? t('fc.ifc_registra') : t('fc.ifc_tocca_registrare')}
      glyph="mic"
      color={has ? p.color : th.text2}
      on={has}
      onPress={() => {
        p.onError(false);
        setRecording(true);
      }}
    />
  );
}

/** Il suono di un lato: si ascolta e si toglie (il cestino). `failed` mostra che il microfono non c'era. */
export function AudioPreview(p: Slot & { testID: string; failed: boolean }) {
  const { t } = useTranslation();
  const th = useTheme();
  const { services, changed } = useApp();
  const { pending, removed, localUri, has } = useSlot(p);
  if (!services) return null;

  return (
    <>
      {has ? (
        <View
          testID={`${p.testID}-preview`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <CardAudio
            testID={`${p.testID}-play`}
            name={removed ? null : p.name}
            localUri={localUri}
          />
          <Text style={{ flex: 1, color: th.text2, fontSize: 13 }}>{t('fc.ifc_audio_pronto')}</Text>
          <Pressable
            testID={`${p.testID}-remove`}
            accessibilityRole="button"
            accessibilityLabel={t('fc.ibf_elimina_audio')}
            hitSlop={8}
            onPress={() => {
              services.media.removeFile(p.table, p.uuid, p.slot);
              services.scheduler.trigger(0);
              changed();
            }}
          >
            <Glyph name="trash" size={18} color={th.red} stroke={2.2} />
          </Pressable>
        </View>
      ) : null}
      {pending ? (
        <Text testID={`${p.testID}-waiting`} style={{ color: th.text3, fontSize: 12 }}>
          {t('comune.app_foto_in_invio')}
        </Text>
      ) : null}
      {p.failed ? (
        <Text testID={`${p.testID}-error`} style={{ color: th.red, fontSize: 13 }}>
          {t('fc.ifc_no_microfono')}
        </Text>
      ) : null}
    </>
  );
}

/** Un file scelto ma non ancora attaccato a niente (l'esempio nuovo non esiste finché non si aggiunge). */
export type StagedFile = { uri: string; mime: string };

/**
 * Come `PhotoButton`, ma la foto resta nel modulo (`value`) invece di andare subito su una riga: serve all'esempio nuovo,
 * che si crea solo quando si preme «aggiungi».
 */
export function StagePhotoButton({
  testID,
  color,
  value,
  onChange,
}: {
  testID: string;
  color: string;
  value: StagedFile | null;
  onChange: (file: StagedFile | null) => void;
}) {
  const { t } = useTranslation();
  const th = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = async (source: 'library' | 'camera') => {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    try {
      const file = await pickImage(source);
      if (file) onChange({ uri: file.uri, mime: file.mime });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <IconBtn
        testID={testID}
        label={t('fcv.immagine')}
        glyph="photo"
        color={value ? color : th.text2}
        on={!!value || open}
        onPress={() => setOpen(!open)}
      />
      {open ? (
        <>
          <Pill
            testID={`${testID}-library`}
            label={t('comune.app_foto_libreria')}
            color={color}
            disabled={busy}
            onPress={() => void pick('library')}
          />
          <Pill
            testID={`${testID}-camera`}
            label={t('comune.app_foto_scatta')}
            color={color}
            disabled={busy}
            onPress={() => void pick('camera')}
          />
        </>
      ) : null}
    </>
  );
}

/** Come `MicButton`, per il modulo dell'esempio nuovo: la registrazione resta in `value` finché non si aggiunge. */
export function StageMicButton({
  testID,
  color,
  value,
  onChange,
  onError,
}: {
  testID: string;
  color: string;
  value: StagedFile | null;
  onChange: (file: StagedFile | null) => void;
  onError: (failed: boolean) => void;
}) {
  const { t } = useTranslation();
  const th = useTheme();
  const [recording, setRecording] = useState(false);

  return recording ? (
    <Recorder
      onDone={(uri) => {
        setRecording(false);
        if (!uri) {
          onError(true);
          return;
        }
        onChange({ uri: keepFile(uri, 'm4a'), mime: 'audio/mp4' });
      }}
    />
  ) : (
    <IconBtn
      testID={`${testID}-record`}
      label={value ? t('fc.ifc_registra') : t('fc.ifc_tocca_registrare')}
      glyph="mic"
      color={value ? color : th.text2}
      on={!!value}
      onPress={() => {
        onError(false);
        setRecording(true);
      }}
    />
  );
}

/** La foto e il suono scelti per l'esempio nuovo, con la loro crocetta e il loro cestino. */
export function StagedPreview({
  testID,
  image,
  audio,
  failed,
  onClearImage,
  onClearAudio,
}: {
  testID: string;
  image: StagedFile | null;
  audio: StagedFile | null;
  failed: boolean;
  onClearImage: () => void;
  onClearAudio: () => void;
}) {
  const { t } = useTranslation();
  const th = useTheme();
  return (
    <>
      {image ? (
        <View>
          <ZoomImage testID={`${testID}-image`} uri={image.uri} height={160} />
          <Pressable
            testID={`${testID}-image-remove`}
            accessibilityRole="button"
            accessibilityLabel={t('vocab.mi_rimuovi_immagine')}
            hitSlop={8}
            onPress={onClearImage}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,.55)',
            }}
          >
            <Glyph name="close" size={14} color="#fff" stroke={2.8} />
          </Pressable>
        </View>
      ) : null}
      {audio ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CardAudio testID={`${testID}-audio`} name={null} localUri={audio.uri} />
          <Text style={{ flex: 1, color: th.text2, fontSize: 13 }}>{t('fc.ifc_audio_pronto')}</Text>
          <Pressable
            testID={`${testID}-audio-remove`}
            accessibilityRole="button"
            accessibilityLabel={t('fc.ibf_elimina_audio')}
            hitSlop={8}
            onPress={onClearAudio}
          >
            <Glyph name="trash" size={18} color={th.red} stroke={2.2} />
          </Pressable>
        </View>
      ) : null}
      {failed ? (
        <Text testID={`${testID}-mic-error`} style={{ color: th.red, fontSize: 13 }}>
          {t('fc.ifc_no_microfono')}
        </Text>
      ) : null}
    </>
  );
}

/** Il tondino «AI» accanto alle altre icone: viola, con un giro di attesa mentre l'IA scrive. */
export function AiButton({
  testID,
  label,
  busy,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height: 34,
        paddingHorizontal: 13,
        borderRadius: 17,
        backgroundColor: '#8B5CF6',
        opacity: disabled ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.4 }}>
        {busy ? '…' : 'AI'}
      </Text>
    </Pressable>
  );
}
