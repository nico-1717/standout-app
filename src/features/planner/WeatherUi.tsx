import { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { WxDay, WxPlace, WxState } from '@/core/account/accountApi';
import { Text } from '@/ui/CappedText';

import type { PlannerTheme } from './plannerTheme';
import { wxDuration, wxIconName, wxTagText, wxTone, wxUvKey, type WxTone } from './weather';
import { WX_ICONS } from './weatherIcons';

/** I colori dei tag (planner_griglia.css): sfondo e testo per tinta; al buio lo sfondo è il testo diluito. */
function tone(pt: PlannerTheme, t: WxTone): { bg: string; fg: string } {
  const light: Record<WxTone, [string, string]> = {
    sun: ['#F8EFD4', '#7A6127'],
    moon: ['#E3E6F1', '#4C5473'],
    rain: ['#DCEAF3', '#3E6B86'],
    snow: ['#EAF0F6', '#5B7284'],
    storm: ['#E7E2F0', '#5A4E76'],
    plain: [pt.paper2, pt.ink2],
  };
  const dark: Record<WxTone, string> = {
    sun: '#E8CD8A',
    moon: '#AEB6DB',
    rain: '#8FBAD6',
    snow: '#B4C6D6',
    storm: '#BDB1DC',
    plain: pt.ink2,
  };
  if (!pt.dark) return { bg: light[t][0], fg: light[t][1] };
  return { bg: t === 'plain' ? pt.paper2 : `${dark[t]}2E`, fg: dark[t] };
}

export function WxIcon(p: { name: string; size: number; color: string }) {
  const xml = WX_ICONS[p.name] ?? WX_ICONS.nubi!;
  return <SvgXml xml={xml} width={p.size} height={p.size} color={p.color} />;
}

/** Il tag piccolo di un giorno (icona e gradi), che si tocca per aprire le previsioni (`wxTag` del sito). */
export function WxTag(p: {
  pt: PlannerTheme;
  date: string;
  day: WxDay;
  today: boolean;
  nowTemp: number | null;
  single: boolean;
  onPress: (date: string) => void;
}) {
  const icon = wxIconName(p.day.icon, p.day, p.today);
  const c = tone(p.pt, wxTone(icon));
  const text = wxTagText(p.day, { single: p.single, today: p.today, now: p.nowTemp });
  return (
    <Pressable
      testID={`wx-tag-${p.date}`}
      accessibilityRole="button"
      accessibilityLabel={`${p.day.label}${text ? ` · ${text}` : ''}`}
      onPress={() => p.onPress(p.date)}
      hitSlop={6}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 999,
        backgroundColor: c.bg,
        alignSelf: 'center',
      }}
    >
      <WxIcon name={icon} size={12} color={c.fg} />
      {text ? (
        <Text style={{ color: c.fg, fontSize: 9.5, fontFamily: p.pt.sans }}>{text}</Text>
      ) : null}
    </Pressable>
  );
}

/** La scheda del meteo in cima alle impostazioni del planner: acceso/spento, dove, che tempo fa, previsioni. */
export function WeatherCard(p: {
  pt: PlannerTheme;
  wx: WxState | null;
  today: string;
  busy: boolean;
  onToggle: (on: boolean) => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const { pt, wx } = p;
  const on = wx?.enabled === true;
  const day = on ? wx.giorni[p.today] : undefined;
  const icon = day ? wxIconName(day.icon, day, true) : 'sole-nubi';
  const parts: string[] = [];
  if (on && wx.place) parts.push(wx.place);
  if (on && wx.adesso?.temp !== null && wx.adesso?.temp !== undefined)
    parts.push(`${wx.adesso.temp}°`);
  if (day && day.tmin !== null && day.tmax !== null) parts.push(`${day.tmin}/${day.tmax}°`);
  const sub = on
    ? parts.length
      ? parts.join(' · ')
      : t('planner.wx_acceso')
    : t('planner.wx_spento_sub');
  const c = tone(pt, on ? wxTone(icon) : 'plain');
  return (
    <View
      testID="ps-weather"
      style={{
        marginTop: 8,
        marginBottom: 10,
        padding: 14,
        borderRadius: 18,
        backgroundColor: pt.card,
        borderWidth: 0.5,
        borderColor: pt.fieldRing,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.bg,
          }}
        >
          <WxIcon name={icon} size={22} color={c.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: pt.ink, fontSize: 15, fontWeight: '600', fontFamily: pt.sans }}>
            {t('planner.meteo')}
          </Text>
          <Text
            testID="ps-weather-sub"
            style={{ color: pt.ink3, fontSize: 12.5, marginTop: 1, fontFamily: pt.sans }}
          >
            {sub}
          </Text>
        </View>
        <Switch
          testID="ps-weather-toggle"
          value={on}
          disabled={p.busy}
          onValueChange={p.onToggle}
          trackColor={{ true: pt.accent }}
        />
      </View>
      {on && day ? (
        <Pressable
          testID="ps-weather-open"
          accessibilityRole="button"
          onPress={p.onOpen}
          style={{
            alignSelf: 'flex-start',
            paddingVertical: 7,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: pt.accentSoft,
          }}
        >
          <Text
            style={{ color: pt.accentInk, fontSize: 13, fontWeight: '600', fontFamily: pt.sans }}
          >
            {t('planner.wx_previsioni')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Cerca un luogo per nome (Open-Meteo): serve ad accendere il meteo la prima volta e a sbirciare un'altra città. */
export function WxPlacePicker(p: {
  pt: PlannerTheme;
  search: (q: string) => Promise<WxPlace[]>;
  onPick: (place: WxPlace) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const { pt } = p;
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<WxPlace[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const type = (text: string) => {
    setQ(text);
    if (timer.current) clearTimeout(timer.current);
    const mine = ++seq.current;
    if (text.trim().length < 3) {
      setHits(null);
      return;
    }
    timer.current = setTimeout(() => {
      p.search(text)
        .then((r) => {
          if (mine === seq.current) setHits(r);
        })
        .catch(() => {
          if (mine === seq.current) setHits([]);
        });
    }, 280);
  };
  return (
    <View testID="wx-place-picker" style={{ gap: 8 }}>
      <TextInput
        testID="wx-place-input"
        value={q}
        onChangeText={type}
        autoFocus={p.autoFocus}
        placeholder={t('planner.cambia_il_luogo_della_previsione')}
        placeholderTextColor={pt.ink3}
        style={{
          backgroundColor: pt.field,
          color: pt.ink,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          fontSize: 16,
          borderWidth: 0.5,
          borderColor: pt.fieldRing,
        }}
      />
      {hits?.map((h, i) => (
        <Pressable
          key={`${h.lat},${h.lon},${i}`}
          testID={`wx-place-${i}`}
          accessibilityRole="button"
          onPress={() => p.onPick(h)}
          style={{ paddingVertical: 8, paddingHorizontal: 4 }}
        >
          <Text style={{ color: pt.ink, fontSize: 15, fontFamily: pt.sans }}>{h.nome}</Text>
          {h.dove ? (
            <Text style={{ color: pt.ink3, fontSize: 12.5, fontFamily: pt.sans }}>{h.dove}</Text>
          ) : null}
        </Pressable>
      ))}
      {p.onCancel ? (
        <Pressable accessibilityRole="button" onPress={p.onCancel} hitSlop={8}>
          <Text style={{ color: pt.ink3, fontSize: 13, fontFamily: pt.sans }}>
            {t('comune.annulla')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

/**
 * Le previsioni di un giorno (`wxPopup` del sito): frecce per sfogliare i giorni, il posto (si tocca per cambiarlo),
 * adesso, pioggia, vento, UV, alba e tramonto, attendibilità, la fonte e «Disattiva il meteo».
 */
export function WxPopup(p: {
  pt: PlannerTheme;
  wx: WxState;
  date: string;
  today: string;
  /** il nome del giorno: «Martedì 17 novembre» */
  title: (date: string) => string;
  onDate: (date: string) => void;
  places: (q: string) => Promise<WxPlace[]>;
  onPreview: (place: WxPlace) => Promise<void>;
  onOff: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { pt, wx } = p;
  const g = wx.giorni[p.date];
  const [changing, setChanging] = useState(false);
  if (!g) return null;
  const prev = wx.giorni[addDays(p.date, -1)];
  const next = wx.giorni[addDays(p.date, 1)];
  const isToday = p.date === p.today;
  const icon = wxIconName(g.icon, g, isToday);
  const c = tone(pt, wxTone(icon));

  const rows: [string, string | null][] = [
    [t('planner.probabilita_di_pioggia'), g.pioggia !== null ? `${g.pioggia}%` : null],
    [
      t('planner.pioggia_prevista'),
      g.pioggia_mm !== null && g.pioggia_mm > 0 ? `${g.pioggia_mm} mm` : null,
    ],
    [
      t('planner.vento_massimo'),
      g.vento !== null
        ? `${g.vento}${t('planner.km_h')}${g.vento_da ? ` · ${g.vento_da}` : ''}`
        : null,
    ],
    [
      t('planner.raffiche_fino_a'),
      g.raffiche !== null ? `${g.raffiche}${t('planner.km_h')}` : null,
    ],
    [t('planner.indice_uv'), g.uv !== null ? `${g.uv} (${t(wxUvKey(g.uv))})` : null],
    [t('planner.alba_e_tramonto'), g.alba && g.tramonto ? `${g.alba} — ${g.tramonto}` : null],
    [
      t('planner.ore_di_sole'),
      g.sole_min !== null ? wxDuration(g.sole_min, (n) => t('planner.n_min', { n })) : null,
    ],
    [t('planner.attendibilita_stimata'), g.affidabilita !== null ? `${g.affidabilita}%` : null],
  ];

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={p.onClose}
      statusBarTranslucent
    >
      <View style={styles.veil}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t('comune.chiudi')}
          testID="wx-veil"
          onPress={p.onClose}
        />
        <View
          testID="wx-popup"
          style={[styles.sheet, { backgroundColor: pt.page, borderColor: pt.fieldRing }]}
        >
          <View style={styles.head}>
            <Pressable
              testID="wx-prev"
              accessibilityRole="button"
              accessibilityLabel={t('planner.giorno_precedente')}
              disabled={!prev}
              onPress={() => p.onDate(addDays(p.date, -1))}
              hitSlop={10}
              style={{ opacity: prev ? 1 : 0.3, padding: 6 }}
            >
              <Text style={{ color: pt.ink, fontSize: 20 }}>‹</Text>
            </Pressable>
            <Text
              testID="wx-title"
              style={{
                flex: 1,
                textAlign: 'center',
                color: pt.ink2,
                fontSize: 14,
                fontFamily: pt.sans,
              }}
            >
              {p.title(p.date)}
            </Text>
            <Pressable
              testID="wx-next"
              accessibilityRole="button"
              accessibilityLabel={t('planner.giorno_successivo')}
              disabled={!next}
              onPress={() => p.onDate(addDays(p.date, 1))}
              hitSlop={10}
              style={{ opacity: next ? 1 : 0.3, padding: 6 }}
            >
              <Text style={{ color: pt.ink, fontSize: 20 }}>›</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              testID="wx-place"
              accessibilityRole="button"
              accessibilityLabel={t('planner.cambia_il_luogo_della_previsione')}
              onPress={() => setChanging((v) => !v)}
              style={{
                alignSelf: 'flex-start',
                paddingVertical: 5,
                paddingHorizontal: 11,
                borderRadius: 999,
                backgroundColor: wx.manual ? pt.accentSoft : pt.paper2,
              }}
            >
              <Text
                style={{
                  color: wx.manual ? pt.accentInk : pt.ink2,
                  fontSize: 12.5,
                  fontFamily: pt.sans,
                }}
              >
                {wx.place
                  ? t('planner.previsione_per_breve', { posto: wx.place })
                  : t('planner.posizione_non_disponibile')}
                {' ⌖'}
              </Text>
            </Pressable>
            {changing ? (
              <WxPlacePicker
                pt={pt}
                autoFocus
                search={p.places}
                onCancel={() => setChanging(false)}
                onPick={(pl) => {
                  setChanging(false);
                  void p.onPreview(pl);
                }}
              />
            ) : null}

            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 }}
            >
              <WxIcon name={icon} size={44} color={pt.ink2} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: pt.ink, fontSize: 22, fontFamily: pt.serif }}>{g.label}</Text>
                {g.tmax !== null ? (
                  <Text style={{ color: pt.ink3, fontSize: 13, fontFamily: pt.sans }}>
                    {t('planner.massima', { t: g.tmax })}
                    {g.tmin !== null ? `${t('planner.minima')}${g.tmin}°` : ''}
                  </Text>
                ) : null}
                {g.percepita_max !== null ? (
                  <Text style={{ color: pt.ink3, fontSize: 13, fontFamily: pt.sans }}>
                    {t('planner.percepiti_t', { t: g.percepita_max })}
                    {g.percepita_min !== null ? ` / ${g.percepita_min}°` : ''}
                  </Text>
                ) : null}
              </View>
            </View>

            {isToday && wx.adesso && wx.adesso.temp !== null ? (
              <View
                testID="wx-now"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  padding: 10,
                  borderRadius: 14,
                  backgroundColor: c.bg,
                }}
              >
                <WxIcon name={wxIconName(wx.adesso.icon, g, true)} size={18} color={c.fg} />
                <Text style={{ flex: 1, color: c.fg, fontSize: 13, fontFamily: pt.sans }}>
                  {[
                    wx.adesso.label,
                    t('planner.adesso_t', { t: wx.adesso.temp }),
                    wx.adesso.percepita !== null
                      ? t('planner.percepiti_t', { t: wx.adesso.percepita })
                      : null,
                    wx.adesso.vento !== null ? `${wx.adesso.vento}${t('planner.km_h')}` : null,
                    wx.adesso.umidita !== null
                      ? `${t('planner.umidita_lbl')}${wx.adesso.umidita}%`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            ) : null}

            {rows.map(([k, v]) =>
              v ? (
                <View
                  key={k}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
                >
                  <Text style={{ color: pt.ink, fontSize: 14, fontFamily: pt.sans }}>{k}</Text>
                  <Text style={{ color: pt.ink3, fontSize: 14, fontFamily: pt.sans }}>{v}</Text>
                </View>
              ) : null,
            )}

            {wx.nota ? (
              <Text style={{ color: pt.ink3, fontSize: 12.5, marginTop: 6, fontFamily: pt.sans }}>
                {wx.nota}
              </Text>
            ) : null}
            <Text style={{ color: pt.ink3, fontSize: 12.5, marginTop: 8, fontFamily: pt.sans }}>
              {t('planner.dati_lbl')}
              <Text
                accessibilityRole="link"
                onPress={() => void Linking.openURL(wx.fonteUrl)}
                style={{ color: pt.accentInk }}
              >
                {wx.fonte}
              </Text>
              {t('planner.licenza')}
            </Text>

            <Pressable
              testID="wx-off"
              accessibilityRole="button"
              onPress={p.onOff}
              style={{
                marginTop: 12,
                alignSelf: 'flex-start',
                paddingVertical: 9,
                paddingHorizontal: 16,
                borderRadius: 999,
                backgroundColor: pt.paper2,
              }}
            >
              <Text style={{ color: pt.ink, fontSize: 14, fontFamily: pt.sans }}>
                {t('planner.disattiva_il_meteo')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  veil: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.35)' },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 0.5,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
});
