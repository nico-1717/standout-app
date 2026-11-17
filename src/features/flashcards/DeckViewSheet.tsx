import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { FC_VIEW_STATUSES, type FcViewStatus } from '@/core/settings/localPrefs';

import { Glyph } from './deckUi';

const STATUS_LABELS: Record<FcViewStatus, string> = {
  all: 'fc.vis_tutte_carte',
  '0': 'vocab.vi_da_imparare',
  '1': 'vocab.vi_imparate',
  dup: 'vocab.vi_duplicati',
};

/**
 * Il foglio «Impostazioni della vista» di fc_view.php (#settingsSheet): quali carte (il filtro), come mostrarle
 * (carte intere, esempi interi), gli strumenti (Big Edit) e «Chiudi». Quello che si cambia vale su questo telefono.
 */
export function DeckViewSheet(p: {
  visible: boolean;
  color: string;
  status: FcViewStatus;
  fullCards: boolean;
  fullExamples: boolean;
  onStatus: (v: FcViewStatus) => void;
  onFullCards: (v: boolean) => void;
  onFullExamples: (v: boolean) => void;
  onBigEdit: () => void;
  onEditDeck: () => void;
  onClose: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [choosing, setChoosing] = useState(false);

  const row = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: th.surface2,
    borderRadius: 14,
  };
  const label = (text: string) => (
    <Text
      style={{
        color: th.text3,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
        paddingHorizontal: 2,
        paddingBottom: 8,
      }}
    >
      {text}
    </Text>
  );
  const title = (text: string, sub?: string) => (
    <View style={{ flex: 1 }}>
      <Text style={{ color: th.text, fontSize: 15, fontWeight: '700' }}>{text}</Text>
      {sub ? (
        <Text style={{ color: th.text2, fontSize: 12.5, fontWeight: '500', marginTop: 2 }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <Pressable
        testID="fcd-sheet-back"
        accessibilityLabel={t('comune.chiudi')}
        onPress={p.onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => undefined}
          testID="fcd-sheet"
          style={{
            maxHeight: '82%',
            backgroundColor: th.surface,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            paddingTop: 26,
            paddingHorizontal: 20,
            paddingBottom: 20 + insets.bottom,
            boxShadow: '0 -10px 50px rgba(0,0,0,.35)',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 8,
              alignSelf: 'center',
              width: 38,
              height: 5,
              borderRadius: 99,
              backgroundColor: th.hairline2,
            }}
          />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={{ color: th.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}>
              {t('fc.vis_impostazioni')}
            </Text>
            <Text
              style={{
                color: th.text2,
                fontSize: 13.5,
                fontWeight: '500',
                marginTop: 4,
                marginBottom: 16,
              }}
            >
              {t('fc.vis_impostazioni_txt')}
            </Text>

            <View style={{ marginBottom: 18 }}>
              {label(t('fc.vis_quali_carte'))}
              <Pressable
                testID="fcd-status"
                accessibilityRole="button"
                onPress={() => setChoosing(!choosing)}
                style={row}
              >
                {title(t('fc.vis_filtro'))}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 8,
                    paddingLeft: 12,
                    paddingRight: 10,
                    borderRadius: 12,
                    backgroundColor: th.surface,
                    boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
                  }}
                >
                  <Text
                    testID="fcd-status-value"
                    style={{ color: th.text, fontSize: 13.5, fontWeight: '700' }}
                  >
                    {t(STATUS_LABELS[p.status])}
                  </Text>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRightWidth: 1.6,
                      borderBottomWidth: 1.6,
                      borderColor: th.text2,
                      transform: [{ rotate: choosing ? '-135deg' : '45deg' }, { translateY: -1 }],
                    }}
                  />
                </View>
              </Pressable>
              {choosing ? (
                <View style={{ gap: 6, marginTop: 8 }}>
                  {FC_VIEW_STATUSES.map((v) => {
                    const on = p.status === v;
                    return (
                      <Pressable
                        key={v}
                        testID={`fcd-status-${v}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        onPress={() => {
                          p.onStatus(v);
                          setChoosing(false);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 11,
                          paddingHorizontal: 14,
                          borderRadius: 12,
                          backgroundColor: on ? p.color + '22' : th.surface2,
                          borderWidth: on ? 1.5 : 0,
                          borderColor: p.color,
                        }}
                      >
                        <Text
                          style={{
                            flex: 1,
                            color: th.text,
                            fontSize: 14.5,
                            fontWeight: on ? '800' : '600',
                          }}
                        >
                          {t(STATUS_LABELS[v])}
                        </Text>
                        {on ? <Glyph name="check" size={16} color={p.color} stroke={3} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <View style={{ marginBottom: 18 }}>
              {label(t('fc.vis_come_mostrarle'))}
              <View style={row}>
                {title(t('fc.vis_carte_intere'), t('fc.vis_carte_intere_txt'))}
                <Switch
                  testID="fcd-full-cards"
                  value={p.fullCards}
                  onValueChange={p.onFullCards}
                  trackColor={{ true: p.color }}
                />
              </View>
              <View style={[row, { marginTop: 8 }]}>
                {title(t('fc.vis_esempi_interi'), t('fc.vis_esempi_interi_txt'))}
                <Switch
                  testID="fcd-full-examples"
                  value={p.fullExamples}
                  onValueChange={p.onFullExamples}
                  trackColor={{ true: p.color }}
                />
              </View>
            </View>

            <View style={{ marginBottom: 18 }}>
              {label(t('fc.vis_strumenti'))}
              <Pressable
                testID="fcd-bigedit"
                accessibilityRole="link"
                onPress={p.onBigEdit}
                style={row}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: th.green,
                  }}
                >
                  <Glyph name="pencil" size={17} color="#fff" stroke={2.2} />
                </View>
                {title(t('fc.vis_big_edit'), t('fc.vis_big_edit_txt'))}
                <Glyph name="chev" size={16} color={th.text3} stroke={2.4} />
              </Pressable>
              <Pressable
                testID="fcd-edit-deck"
                accessibilityRole="button"
                onPress={p.onEditDeck}
                style={[row, { marginTop: 8 }]}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: p.color,
                  }}
                >
                  <Glyph name="folder" size={17} color="#fff" stroke={2.2} />
                </View>
                {title(t('fc.app_modifica_mazzo'), t('fc.app_modifica_mazzo_txt'))}
                <Glyph name="chev" size={16} color={th.text3} stroke={2.4} />
              </Pressable>
            </View>

            <Pressable
              testID="fcd-sheet-close"
              accessibilityRole="button"
              onPress={p.onClose}
              style={({ pressed }) => ({
                paddingVertical: 14,
                borderRadius: th.radiusButton,
                alignItems: 'center',
                backgroundColor: th.surface2,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <Text style={{ color: th.text, fontSize: 15.5, fontWeight: '800' }}>
                {t('comune.chiudi')}
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
