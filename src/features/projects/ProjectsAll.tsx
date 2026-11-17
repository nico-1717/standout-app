import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { human } from '@/features/pomodoro/logic';
import { titleStyle } from '@/ui/kit';
import { localToday } from '@/features/tasks/groups';

import { PjIcon } from './PjIcons';
import { Lab, ListCard, RowLine } from './PjParts';
import type { Project, TreeRow } from './logic';
import { dateLabel, metaLine, progressOf } from './pjFormat';

/**
 * «Tutti» › «Elenco» (progetti.php, vista `all`): i preferiti, poi i progetti principali con la barra di quanti
 * sotto-progetti sono fatti e il tempo di concentrazione, e in fondo «Nuovo progetto».
 */
export function ProjectsAll({
  roots,
  favorites,
  totals,
  showTags,
  onOpen,
  onCreate,
}: {
  roots: TreeRow[];
  favorites: Project[];
  totals: ReadonlyMap<string, number>;
  showTags: boolean;
  onOpen: (uuid: string) => void;
  onCreate: (name: string) => boolean;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const today = localToday();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const submit = () => {
    if (onCreate(draft)) {
      setDraft('');
      setAdding(false);
    }
  };

  if (!roots.length && !adding) {
    return (
      <View style={{ gap: 14 }}>
        <View style={{ padding: 28, alignItems: 'center', gap: 6 }}>
          <Text style={[{ color: th.text }, titleStyle(th, 17, '700')]}>
            {t('progetti.nessun_progetto_ancora')}
          </Text>
          <Text style={{ color: th.text2, textAlign: 'center' }}>
            {t('progetti.crea_il_tuo_primo_progetto')}
          </Text>
        </View>
        <ListCard>
          <NewLine onPress={() => setAdding(true)} />
        </ListCard>
      </View>
    );
  }

  return (
    <View>
      {favorites.length ? (
        <>
          <Lab>{t('progetti.preferiti')}</Lab>
          <ListCard>
            {favorites.map((p, i) => {
              const date = dateLabel(p, t, today);
              return (
                <View key={p.uuid}>
                  {i ? <RowLine inset={44} /> : null}
                  <Pressable
                    testID={`proj-fav-${p.uuid}`}
                    accessibilityRole="button"
                    onPress={() => onOpen(p.uuid)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      minHeight: 62,
                    }}
                  >
                    <PjIcon name="star" color="#E0B84A" size={12} />
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{ color: th.text, fontSize: 16, lineHeight: 22, fontWeight: '600' }}
                      >
                        {p.name}
                      </Text>
                      {date ? (
                        <Text style={{ color: th.text2, fontSize: 12.5, lineHeight: 20 }}>
                          {date}
                        </Text>
                      ) : null}
                    </View>
                    <PjIcon name="chevron" color={th.text3} size={14} />
                  </Pressable>
                </View>
              );
            })}
          </ListCard>
        </>
      ) : null}

      <Lab
        right={
          <Text
            style={{
              color: th.text2,
              fontSize: 12.5,
              fontWeight: '600',
              letterSpacing: 0.7,
              textTransform: 'uppercase',
            }}
          >
            {t('progetti.concentrazione')}
          </Text>
        }
      >
        {t('progetti.i_tuoi_progetti')}
      </Lab>
      <ListCard>
        {roots.map((r, i) => {
          const p = r.project;
          const secs = totals.get(p.uuid) ?? 0;
          const meta = showTags ? metaLine(r, t, today) : '';
          const fill = progressOf(r);
          return (
            <View key={p.uuid}>
              {i ? <RowLine inset={44} /> : null}
              <Pressable
                testID={`proj-row-${p.uuid}`}
                accessibilityRole="button"
                onPress={() => onOpen(p.uuid)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 10,
                  paddingLeft: 14,
                  paddingRight: 14,
                  minHeight: 63,
                }}
              >
                <View
                  style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.color }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: p.status === 'completed' ? th.text2 : th.text,
                      fontSize: 16,
                      lineHeight: 22,
                      fontWeight: '600',
                    }}
                  >
                    {p.name}
                  </Text>
                  {meta ? (
                    <Text style={{ color: th.text2, fontSize: 12.5, lineHeight: 20 }}>{meta}</Text>
                  ) : null}
                  {r.total || p.status === 'completed' ? (
                    <View
                      style={{
                        height: 4,
                        borderRadius: 99,
                        backgroundColor: th.surface2,
                        marginTop: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.round(fill * 100)}%`,
                          height: 4,
                          borderRadius: 99,
                          backgroundColor: p.color,
                        }}
                      />
                    </View>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', minWidth: 33, alignSelf: 'flex-start' }}>
                  <Text
                    style={{
                      color: secs ? th.text : th.text2,
                      fontSize: 14.5,
                      lineHeight: 22,
                      fontWeight: '600',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {secs ? human(secs) : '–'}
                  </Text>
                  <Text style={{ color: th.text2, fontSize: 10, lineHeight: 20 }}>
                    {t('progetti.in_tutto')}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}
        {roots.length ? <RowLine inset={0} /> : null}
        {adding ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
            <PjIcon name="plus" color={th.brand} size={20} width={2} />
            <TextInput
              testID="proj-new"
              autoFocus
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              onBlur={() => !draft.trim() && setAdding(false)}
              returnKeyType="done"
              placeholder={t('progetti.nome_nuovo_progetto')}
              placeholderTextColor={th.text3}
              style={{ flex: 1, color: th.text, fontSize: 16, paddingVertical: 8 }}
            />
            <Pressable
              testID="proj-new-add"
              accessibilityRole="button"
              accessibilityLabel={t('progetti.aggiungi')}
              disabled={!draft.trim()}
              onPress={submit}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: draft.trim() ? th.brand : th.surface2,
              }}
            >
              <Text style={{ color: draft.trim() ? '#fff' : th.text3, fontWeight: '700' }}>
                {t('progetti.aggiungi')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <NewLine onPress={() => setAdding(true)} />
        )}
      </ListCard>
    </View>
  );
}

function NewLine({ onPress }: { onPress: () => void }) {
  const th = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      testID="proj-new-line"
      accessibilityRole="button"
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 50 }}
    >
      <PjIcon name="plus" color={th.brand} size={22} width={2} />
      <Text style={{ color: th.brand, fontSize: 15.5, fontWeight: '500' }}>
        {t('progetti.nuovo_progetto')}
      </Text>
    </Pressable>
  );
}
