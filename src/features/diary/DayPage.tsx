import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { addDaysIso } from '@/features/tasks/groups';

import type { DiaryTheme } from './diaryTheme';
import { Rings } from './DiaryParts';
import { Face } from './Face';
import { LEVEL_TEXT } from './faces';
import type { DiaryDay, DiaryItem, ListType, Ring } from './logic';

const pad = (n: number) => String(n).padStart(2, '0');
/** Giorno, mese, anno e giorno della settimana (0 = lunedì) di una data «AAAA-MM-GG», senza fusi orari. */
export function dateParts(day: string) {
  const [y, m, dd] = day.split('-').map(Number);
  return { y, m, d: dd, wd: (new Date(Date.UTC(y, m - 1, dd)).getUTCDay() + 6) % 7 };
}
export { addDaysIso as addDays, pad };

/** Ritarda un'azione finché l'utente smette di scrivere (e permette di farla subito, a campo chiuso). */
function useLater(ms: number) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return {
    later(fn: () => void) {
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(fn, ms);
    },
    cancel() {
      if (t.current) clearTimeout(t.current);
      t.current = null;
    },
  };
}

function ItemRow({
  item,
  type,
  d,
  onSave,
}: {
  item: DiaryItem | null;
  type: ListType;
  d: DiaryTheme;
  onSave: (item: DiaryItem | null, text: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useLater(800);
  const shown = draft ?? item?.content ?? '';
  const commit = (text: string) => {
    timer.cancel();
    setDraft(null);
    onSave(item, text);
  };
  const std = d.style === 'standard';
  const filled = shown.trim() !== '';
  const dotColor = filled ? (type === 'good' ? (std ? '#FFB800' : d.accent) : d.accent) : d.ink3;
  return (
    <View
      style={[
        styles.li,
        std && { borderTopColor: d.hair, borderTopWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View
        style={[
          styles.liDot,
          { backgroundColor: dotColor, transform: [{ scale: filled && !std ? 1.4 : 1 }] },
        ]}
      />
      <TextInput
        testID={item ? `item-${item.uuid}` : `item-new-${type}`}
        value={shown}
        maxLength={300}
        placeholder={
          item ? '' : t(type === 'good' ? 'diario.una_cosa_bella' : 'diario.una_cosa_imparata')
        }
        placeholderTextColor={d.ink3}
        returnKeyType="done"
        blurOnSubmit
        onChangeText={(v) => {
          setDraft(v);
          // una voce già salvata si aggiorna mentre scrivi; una nuova solo a campo chiuso (se no la riga
          // si ridisegna sotto le dita e la tastiera si chiude)
          if (item) timer.later(() => commit(v));
        }}
        onEndEditing={(e) => commit(e.nativeEvent.text)}
        style={{
          flex: 1,
          paddingVertical: std ? 11 : 2,
          color: d.ink,
          fontFamily: d.hand,
          fontSize: std ? d.size : d.size * 0.92,
          borderBottomWidth: std ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: d.hair,
        }}
      />
    </View>
  );
}

function ListColumn(p: {
  type: ListType;
  items: DiaryItem[];
  d: DiaryTheme;
  onSave: (type: ListType, item: DiaryItem | null, text: string) => void;
}) {
  const { t } = useTranslation();
  const { d } = p;
  const std = d.style === 'standard';
  const title = t(p.type === 'good' ? 'diario.cose_belle_di_oggi' : 'diario.cosa_ho_imparato_oggi');
  const iconBg = p.type === 'good' ? 'rgba(255,204,0,0.22)' : d.accent2;
  const iconFg = p.type === 'good' ? '#C78A00' : d.accent;
  return (
    <View
      testID={`list-${p.type}`}
      style={[
        std
          ? {
              backgroundColor: d.card,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 6,
            }
          : { flex: 1, minWidth: 0 },
      ]}
    >
      <View style={styles.colHead}>
        {std && (
          <View style={[styles.colIcon, { backgroundColor: iconBg }]}>
            <Text style={{ color: iconFg, fontSize: 14 }}>{p.type === 'good' ? '☀' : '✦'}</Text>
          </View>
        )}
        <Text
          style={[
            styles.lab,
            {
              color: std ? d.ink2 : d.ink3,
              fontFamily: d.sans,
              fontSize: std ? 10.5 : 9,
              letterSpacing: std ? 0.1 : 1.6,
            },
          ]}
        >
          {title}
        </Text>
      </View>
      {[...p.items, null].map((it) => (
        <ItemRow
          // la riga nuova ricomincia vuota ogni volta che l'elenco cambia
          key={it ? it.uuid : `new-${p.items.length}`}
          item={it}
          type={p.type}
          d={d}
          onSave={(item, text) => p.onSave(p.type, item, text)}
        />
      ))}
    </View>
  );
}

/** Il testo libero del giorno: sulla carta a righe (o a puntini), nello stile standard in un riquadro. */
function WriteArea({
  note,
  d,
  paper,
  onSave,
}: {
  note: string;
  d: DiaryTheme;
  paper: 'lined' | 'dotted' | 'plain';
  onSave: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const [h, setH] = useState(0);
  const timer = useLater(700);
  const std = d.style === 'standard';
  const shown = draft ?? note;
  const commit = (text: string) => {
    timer.cancel();
    setDraft(null);
    onSave(text);
  };
  const minH = d.line * 8;
  const height = Math.max(minH, h);
  const rows = Math.ceil(height / d.line);
  return (
    <View
      style={
        std
          ? {
              backgroundColor: d.card,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 10,
            }
          : undefined
      }
    >
      {std && (
        <View style={styles.colHead}>
          <View style={[styles.colIcon, { backgroundColor: 'rgba(175,82,222,0.16)' }]}>
            <Text style={{ color: '#AF52DE', fontSize: 13 }}>✎</Text>
          </View>
          <Text
            style={[
              styles.lab,
              { color: d.ink2, fontFamily: d.sans, fontSize: 10.5, letterSpacing: 0.1 },
            ]}
          >
            {t('diario.com_e_andata_oggi_lab')}
          </Text>
        </View>
      )}
      <View>
        {!std &&
          paper !== 'plain' &&
          Array.from({ length: rows }, (_, i) =>
            paper === 'lined' ? (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: (i + 1) * d.line - 1,
                  height: StyleSheet.hairlineWidth * 2,
                  backgroundColor: d.rule,
                }}
              />
            ) : (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: (i + 1) * d.line - 3,
                  borderTopWidth: 2,
                  borderStyle: 'dotted',
                  borderColor: d.rule,
                }}
              />
            ),
          )}
        <TextInput
          testID="diary-text"
          multiline
          scrollEnabled={false}
          maxLength={20000}
          value={shown}
          placeholder={t('diario.com_e_andata_oggi')}
          placeholderTextColor={d.ink3}
          textAlignVertical="top"
          onChangeText={(v) => {
            setDraft(v);
            timer.later(() => commit(v));
          }}
          onBlur={() => draft !== null && commit(draft)}
          onContentSizeChange={(e) => setH(e.nativeEvent.contentSize.height + d.line * 0.5)}
          style={{
            minHeight: height,
            color: d.ink,
            fontFamily: d.hand,
            fontSize: d.size,
            lineHeight: std ? Math.round(d.size * 1.45) : d.line,
            paddingTop: 0,
            paddingHorizontal: 2,
          }}
        />
      </View>
    </View>
  );
}

export interface DayPageProps {
  d: DiaryTheme;
  paper: 'lined' | 'dotted' | 'plain';
  day: DiaryDay;
  rings: Ring[];
  onMood: () => void;
  onEnergy: () => void;
  onNote: (text: string) => void;
  onItem: (type: ListType, item: DiaryItem | null, text: string) => void;
  onOpenMonth: () => void;
  onOpenSummary: () => void;
  months: string[];
  weekdays: string[];
}

/** La pagina del giorno: faccine, data, anello delle abitudini, i due elenchi e il testo libero. */
export function DayPage(p: DayPageProps) {
  const { d, day } = p;
  const { t } = useTranslation();
  const std = d.style === 'standard';
  const parts = dateParts(day.date);
  const first = p.rings[0];
  const ringN = first ? `${first.done}/${first.total}` : '–';

  const faceBtn = (kind: 'mood' | 'energy', onPress: () => void) => {
    const lv = kind === 'mood' ? day.mood : day.energy;
    const words = (l: number) => t(`diario.${kind === 'mood' ? 'umore' : 'energia'}_${l}`);
    const tint = lv ? LEVEL_TEXT[lv] : d.ink3;
    return (
      <Pressable
        testID={kind === 'mood' ? 'diary-mood' : 'diary-energy'}
        accessibilityRole="button"
        accessibilityLabel={t(kind === 'mood' ? 'diario.com_e_andata' : 'diario.energia')}
        onPress={onPress}
        style={
          std
            ? [styles.tile, { backgroundColor: lv ? `${tint}22` : d.card }]
            : { width: 40, height: 40 }
        }
      >
        <Face
          kind={kind}
          level={lv}
          size={std ? 38 : 40}
          style={d.style}
          color={std ? (lv ? tint : d.ink3) : lv ? d.ink : d.pencil}
        />
        {std && (
          <>
            <Text style={{ color: d.ink2, fontSize: 10.5, marginTop: 4 }}>
              {t(kind === 'mood' ? 'diario.umore_k' : 'diario.energia')}
            </Text>
            <Text style={{ color: lv ? tint : d.accent, fontSize: 12, fontWeight: '600' }}>
              {lv ? words(lv) : t('diario.tocca_per_scegliere')}
            </Text>
          </>
        )}
      </Pressable>
    );
  };

  const title = (
    <View style={styles.title}>
      <Text
        testID="diary-num"
        style={{
          color: d.ink,
          fontFamily: d.serifLight,
          fontSize: 52,
          lineHeight: 52,
          fontWeight: std ? '700' : '300',
          letterSpacing: std ? -2 : -1,
        }}
      >
        {parts.d}
      </Text>
      <Text
        style={{
          color: d.ink2,
          fontFamily: d.sans,
          fontSize: std ? 11.5 : 10,
          fontWeight: std ? '600' : '400',
          letterSpacing: std ? 0.1 : 2.6,
          textTransform: 'uppercase',
          marginTop: 5,
        }}
      >
        {p.weekdays[parts.wd]}
      </Text>
      <Pressable
        accessibilityRole="button"
        testID="diary-month-btn"
        onPress={p.onOpenMonth}
        style={std ? [styles.monthStd, { backgroundColor: d.card }] : { marginTop: 7, padding: 3 }}
      >
        <Text
          style={{
            color: std ? d.accent : d.ink2,
            fontFamily: d.serif,
            fontStyle: std ? 'normal' : 'italic',
            fontSize: std ? 15 : 17,
            fontWeight: std ? '600' : '400',
            borderBottomWidth: std ? 0 : 0.8,
            borderBottomColor: d.ink3,
          }}
        >
          {p.months[parts.m - 1]} {parts.y}
        </Text>
      </Pressable>
    </View>
  );

  const ring = (
    <Pressable
      testID="diary-ring"
      accessibilityRole="button"
      accessibilityLabel={t('diario.abitudini')}
      onPress={p.onOpenSummary}
      style={std ? [styles.tile, { backgroundColor: d.card }] : { width: 54, height: 54 }}
    >
      <View
        style={{
          width: std ? 46 : 54,
          height: std ? 46 : 54,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Rings rings={p.rings} size={std ? 46 : 54} d={d} />
        <Text
          testID="diary-ring-n"
          style={{
            position: 'absolute',
            color: d.ink2,
            fontFamily: d.serif,
            fontSize: p.rings.length >= 3 ? 11 : 15,
          }}
        >
          {ringN}
        </Text>
      </View>
      {std && (
        <Text style={{ color: d.ink2, fontSize: 10.5, marginTop: 3 }}>{t('diario.abitudini')}</Text>
      )}
    </Pressable>
  );

  return (
    <View>
      {std ? (
        <>
          {title}
          <View style={styles.tiles}>
            {faceBtn('mood', p.onMood)}
            {faceBtn('energy', p.onEnergy)}
            {ring}
          </View>
        </>
      ) : (
        <View style={styles.paperHead}>
          <View style={{ gap: 6, paddingTop: 2 }}>
            {faceBtn('mood', p.onMood)}
            {faceBtn('energy', p.onEnergy)}
          </View>
          {title}
          {ring}
        </View>
      )}
      <View
        style={
          std
            ? { gap: 12, marginTop: 14 }
            : { flexDirection: 'row', gap: 14, marginTop: 16, marginBottom: 12 }
        }
      >
        <ListColumn type="good" items={day.good} d={d} onSave={p.onItem} />
        <ListColumn type="learned" items={day.learned} d={d} onSave={p.onItem} />
      </View>
      <View style={{ marginTop: std ? 12 : 0 }}>
        <WriteArea note={day.note} d={d} paper={p.paper} onSave={p.onNote} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { flex: 1, alignItems: 'center', paddingTop: 2 },
  paperHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 14 },
  tile: {
    flex: 1,
    minHeight: 104,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  monthStd: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 4 },
  colIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lab: { fontWeight: '500', textTransform: 'uppercase' },
  li: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liDot: { width: 5, height: 5, borderRadius: 3 },
});
