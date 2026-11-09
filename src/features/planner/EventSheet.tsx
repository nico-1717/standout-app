import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { GuestsField, PlacesField, type PickedPlace } from './BookParts';
import { PlaceHits, PlaceStatus, usePlaceSearch, type PlacesApi } from './PlaceSearch';
import type { PlaceHit } from '@/core/account/accountApi';
import type { BookRepo, GuestInput, Place } from './book';
import type { EventView } from './events';
import {
  addDaysIso,
  minutesOf,
  timeOf,
  type EventInput,
  type Notify,
  type Repeat,
  type Unit,
} from './model';
import { longHex, type PlannerTheme } from './plannerTheme';
import type { Calendar, Category, PlannerRepo } from './repo';

export type SheetTarget =
  { mode: 'new'; date: string; start?: string } | { mode: 'edit'; view: EventView };

const dateOf = (s: string) => new Date(`${s}T12:00:00`);
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const clockOf = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
};
const hhmmOf = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function Label({ pt, children }: { pt: PlannerTheme; children: ReactNode }) {
  return (
    <Text
      style={{
        color: pt.ink3,
        fontSize: 10,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        marginBottom: 6,
        marginTop: 16,
        fontFamily: pt.sans,
      }}
    >
      {children}
    </Text>
  );
}

function Chip({
  pt,
  label,
  active,
  onPress,
  color,
  testID,
}: {
  pt: PlannerTheme;
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: active ? (color ?? pt.accent) : pt.paper2,
        borderWidth: 0.5,
        borderColor: pt.hair2,
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      <Text style={{ color: active ? pt.onAccent : pt.ink, fontSize: 13, fontFamily: pt.sans }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Pick({
  pt,
  kind,
  value,
  onChange,
  clearable,
  placeholder,
  testID,
}: {
  pt: PlannerTheme;
  kind: 'date' | 'time';
  value: string;
  onChange: (v: string) => void;
  clearable?: boolean;
  placeholder?: string;
  testID: string;
}) {
  const { t } = useTranslation();
  const isDate = kind === 'date';
  const current = value ? (isDate ? dateOf(value) : clockOf(value)) : null;
  const from = (d: Date) => (isDate ? isoOf(d) : hhmmOf(d));
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: pt.paper2,
        borderRadius: 12,
        paddingHorizontal: 10,
        minHeight: 40,
      }}
    >
      {current && Platform.OS === 'ios' ? (
        <DateTimePicker
          testID={testID}
          value={current}
          mode={kind}
          display="compact"
          themeVariant={pt.dark ? 'dark' : 'light'}
          onValueChange={(_, d) => d && onChange(from(d))}
        />
      ) : (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          onPress={() => {
            const base = current ?? new Date();
            if (Platform.OS === 'ios') return onChange(from(base));
            DateTimePickerAndroid.open({
              value: base,
              mode: kind,
              is24Hour: true,
              onValueChange: (_, d) => d && onChange(from(d)),
            });
          }}
          style={{ paddingVertical: 8 }}
        >
          <Text style={{ color: current ? pt.ink : pt.ink3, fontSize: 14, fontFamily: pt.sans }}>
            {value || placeholder || '—'}
          </Text>
        </Pressable>
      )}
      {clearable && current ? (
        <Pressable
          testID={`${testID}-clear`}
          accessibilityRole="button"
          accessibilityLabel={t('comune.annulla')}
          hitSlop={8}
          onPress={() => onChange('')}
          style={{ marginLeft: 8 }}
        >
          <Text style={{ color: pt.ink3, fontSize: 16 }}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const REPEATS: { id: Repeat; key: string }[] = [
  { id: 'none', key: 'planner.mai_t' },
  { id: 'daily', key: 'planner.ogni_giorno' },
  { id: 'weekly', key: 'planner.ogni_settimana' },
  { id: 'monthly', key: 'planner.ogni_mese' },
  { id: 'yearly', key: 'planner.ogni_anno' },
  { id: 'custom', key: 'planner.personalizzata' },
];
const UNITS: { id: Unit; key: string }[] = [
  { id: 'day', key: 'planner.u_giorni' },
  { id: 'week', key: 'planner.u_settimane' },
  { id: 'month', key: 'planner.u_mesi' },
  { id: 'year', key: 'planner.u_anni' },
];
const NOTIFIES: { id: Notify; key: string }[] = [
  { id: 'none', key: 'planner.nessuna' },
  { id: 'at_time', key: 'planner.nel_momento' },
  { id: 'm30', key: 'planner.30_minuti_prima' },
  { id: 'h1', key: 'planner.un_ora_prima' },
  { id: 'd1', key: 'planner.un_giorno_prima' },
  { id: 'custom', key: 'planner.personalizzata' },
];
const IMPORTANCE: { id: 'normal' | 'high' | 'highest'; key: string }[] = [
  { id: 'normal', key: 'planner.normale' },
  { id: 'high', key: 'planner.importante' },
  { id: 'highest', key: 'planner.importantissimo' },
];

/** Il foglio per creare o cambiare un evento: titolo, quando, dove, calendario, categoria, ripetizione, avviso. */
export function EventSheet(p: {
  pt: PlannerTheme;
  repo: PlannerRepo;
  /** la rubrica e i luoghi salvati; senza, la scheda non mostra invitati né scelte rapide */
  book?: BookRepo;
  /** la ricerca dei posti sul sito (solo online); senza, il luogo resta un testo libero */
  places?: PlacesApi;
  /** la lingua dei risultati della ricerca */
  lang?: string;
  calendars: Calendar[];
  categories: Category[];
  target: SheetTarget;
  onClose: () => void;
  /** dopo una modifica: la schermata rilegge */
  onChanged: () => void;
}) {
  const { pt, target } = p;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const view = target.mode === 'edit' ? target.view : null;
  const fresh = target.mode === 'new' ? target : null;

  const [f, setF] = useState(() => {
    if (view) {
      return {
        title: view.title,
        type: view.type as 'event' | 'task',
        allDay: view.allDay,
        date: view.date,
        endDate: view.multiday ? view.endDate : '',
        start: view.start,
        end: view.end,
        calendar: view.calendarUuid,
        category: view.categoryUuid,
        importance: view.importance as 'normal' | 'high' | 'highest',
        repeat: view.repeat as Repeat,
        interval: view.repeatInterval,
        unit: view.repeatUnit as Unit,
        until: view.repeatUntil ?? '',
        notify: view.notify as Notify,
        notifyMin: view.notifyMin,
        location: view.location,
        notes: view.notes,
      };
    }
    const start = fresh?.start ?? '09:00';
    return {
      title: '',
      type: 'event' as 'event' | 'task',
      allDay: false,
      date: fresh?.date ?? '',
      endDate: '',
      start,
      end: timeOf(Math.min(1439, minutesOf(start) + 60)),
      calendar: null as string | null,
      category: null as string | null,
      importance: 'normal' as 'normal' | 'high' | 'highest',
      repeat: 'none' as Repeat,
      interval: 1,
      unit: 'week' as Unit,
      until: '',
      notify: 'h1' as Notify,
      notifyMin: 60,
      location: '',
      notes: '',
    };
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const book = p.book ?? null;
  // gli invitati di una ripetizione sono quelli della serie; una modifica «solo questa volta» li porta nell'eccezione
  const ownerUuid = view ? (view.isOccurrence ? view.masterUuid : view.uuid) : null;
  const [guests, setGuests] = useState<GuestInput[]>(() =>
    book && ownerUuid
      ? book
          .guests(ownerUuid)
          .map((g) => ({ email: g.email, name: g.name, contactUuid: g.contact_uuid }))
      : [],
  );
  const [contacts] = useState(() => book?.contacts() ?? []);
  const [places] = useState(() => book?.places() ?? []);
  // il luogo scelto dalle scelte rapide; 'keep' = non toccato (resta quello che l'evento ha già)
  const [place, setPlace] = useState<PickedPlace | null | 'keep'>('keep');
  const suggested = book && !view?.location ? (book.suggestPlace(f.title)?.uuid ?? null) : null;
  const search = usePlaceSearch(p.places, p.lang ?? 'en');
  // le coordinate del posto appena scelto stanno arrivando: il riferimento atteso (una risposta vecchia non comanda)
  const [waiting, setWaiting] = useState(false);
  const wanted = useRef<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const forget = () => {
    wanted.current = null;
    setWaiting(false);
    setNotFound(false);
  };
  const pickHit = (h: PlaceHit) => {
    search.close();
    forget();
    set('location', h.full || h.name);
    setPlace({ name: h.name, lat: h.lat, lon: h.lon, ref: h.ref || null });
    // la scorta (OpenStreetMap) manda già le coordinate; Google solo per il posto scelto davvero: una seconda chiamata
    if ((h.lat !== null && h.lon !== null) || !h.ref || !p.places) return;
    wanted.current = h.ref;
    setWaiting(true);
    p.places
      .placeDetails(h.ref, p.lang ?? 'en')
      .then((point) => {
        if (wanted.current !== h.ref) return;
        wanted.current = null;
        setWaiting(false);
        if (!point) return setNotFound(true);
        setPlace((now) =>
          now && now !== 'keep' && now.ref === h.ref
            ? { ...now, lat: point.lat, lon: point.lon }
            : now,
        );
      })
      .catch(() => {
        if (wanted.current !== h.ref) return;
        wanted.current = null;
        setWaiting(false);
        setNotFound(true);
      });
  };
  const pickPlace = (pl: Place) => {
    search.close();
    forget();
    set('location', pl.address || pl.label);
    setPlace({
      name: pl.place_name ?? pl.label,
      lat: pl.place_lat,
      lon: pl.place_lon,
      ref: pl.place_ref,
    });
  };
  // il posto agganciato: quello scelto adesso, o quello che l'evento ha già (se non lo si è toccato)
  const shownPlace: PickedPlace | null =
    place === 'keep'
      ? view && view.placeLat !== null && view.placeLon !== null
        ? { name: view.placeName, lat: view.placeLat, lon: view.placeLon, ref: null }
        : null
      : place;
  const inSeries = !!view && (view.isOccurrence || view.isException || view.repeat !== 'none');

  const input = (): EventInput => ({
    title: f.title,
    type: f.type,
    allDay: f.allDay,
    date: f.date,
    endDate: f.endDate || null,
    start: f.start,
    end: f.end,
    calendarUuid: f.calendar,
    categoryUuid: f.category,
    importance: f.importance,
    repeat: f.repeat,
    repeatInterval: f.interval,
    repeatUnit: f.unit,
    repeatUntil: f.until || null,
    notify: f.notify,
    notifyMin: f.notifyMin,
    location: f.location,
    notes: f.notes,
    ...(place === 'keep'
      ? {}
      : {
          placeName: place?.name ?? null,
          placeLat: place?.lat ?? null,
          placeLon: place?.lon ?? null,
          placeRef: place?.ref ?? null,
        }),
  });

  const finish = () => {
    p.onChanged();
    p.onClose();
  };

  const saveGuests = (eventUuid: string) => {
    if (book) book.setGuests(eventUuid, guests);
  };

  const save = () => {
    if (!view) {
      saveGuests(p.repo.create(input()));
      return finish();
    }
    if (view.isOccurrence) {
      Alert.alert(
        t('planner.modifica_evento_ripetuto'),
        t('planner.vuoi_modificare_solo_questa_data'),
        [
          { text: t('comune.annulla'), style: 'cancel' },
          {
            text: t('planner.solo_questo'),
            onPress: () => {
              saveGuests(p.repo.update(view, input(), 'one'));
              finish();
            },
          },
          {
            text: t('planner.tutta_la_serie'),
            onPress: () => {
              saveGuests(p.repo.update(view, input(), 'all'));
              finish();
            },
          },
        ],
      );
      return;
    }
    saveGuests(p.repo.update(view, input(), 'all'));
    finish();
  };

  const remove = () => {
    if (!view) return;
    if (inSeries) {
      Alert.alert(t('planner.elimina_evento'), t('planner.vuoi_eliminare_solo_questa_data'), [
        { text: t('comune.annulla'), style: 'cancel' },
        {
          text: t('planner.solo_questo'),
          style: 'destructive',
          onPress: () => {
            p.repo.remove(view, 'one');
            finish();
          },
        },
        {
          text: t('planner.tutta_la_serie'),
          style: 'destructive',
          onPress: () => {
            p.repo.remove(view, 'series');
            finish();
          },
        },
      ]);
      return;
    }
    Alert.alert(t('planner.elimino_questo_evento'), undefined, [
      { text: t('comune.annulla'), style: 'cancel' },
      {
        text: t('planner.elimina'),
        style: 'destructive',
        onPress: () => {
          p.repo.remove(view, 'one');
          finish();
        },
      },
    ]);
  };

  const inputStyle = {
    backgroundColor: pt.paper2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: pt.ink,
    fontSize: 15,
    fontFamily: pt.sans,
  } as const;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={p.onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: pt.card }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 8,
          }}
        >
          <Pressable
            testID="sheet-cancel"
            accessibilityRole="button"
            onPress={p.onClose}
            hitSlop={10}
          >
            <Text style={{ color: pt.ink2, fontSize: 15, fontFamily: pt.sans }}>
              {t('comune.annulla')}
            </Text>
          </Pressable>
          <Text style={{ color: pt.ink, fontSize: 22, fontFamily: pt.serif }}>
            {view ? t('planner.modifica') : t('planner.nuovo_evento')}
          </Text>
          <Pressable testID="sheet-save" accessibilityRole="button" onPress={save} hitSlop={10}>
            <Text
              style={{ color: pt.accentInk, fontSize: 15, fontWeight: '600', fontFamily: pt.sans }}
            >
              {t('planner.salva')}
            </Text>
          </Pressable>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 + insets.bottom }}
        >
          <TextInput
            testID="sheet-title"
            value={f.title}
            onChangeText={(v) => set('title', v)}
            placeholder={t('planner.titolo_dell_evento')}
            placeholderTextColor={pt.ink3}
            style={[inputStyle, { fontSize: 18, marginTop: 8 }]}
          />

          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <Chip
              pt={pt}
              testID="type-event"
              label={t('planner.evento')}
              active={f.type === 'event'}
              onPress={() => set('type', 'event')}
            />
            <Chip
              pt={pt}
              testID="type-task"
              label={t('planner.task')}
              active={f.type === 'task'}
              onPress={() => set('type', 'task')}
            />
          </View>

          <Label pt={pt}>{t('planner.quando')}</Label>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <Text style={{ color: pt.ink, fontSize: 15, fontFamily: pt.sans }}>
              {t('planner.tutto_il_giorno')}
            </Text>
            <Switch
              testID="sheet-allday"
              value={f.allDay}
              onValueChange={(v) => set('allDay', v)}
              trackColor={{ true: pt.accent }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pick
              pt={pt}
              kind="date"
              testID="sheet-date"
              value={f.date}
              onChange={(v) =>
                v &&
                setF((s) => ({
                  ...s,
                  date: v,
                  endDate: s.endDate && s.endDate < v ? v : s.endDate,
                }))
              }
            />
            {!f.allDay ? (
              <Pick
                pt={pt}
                kind="time"
                testID="sheet-start"
                value={f.start}
                onChange={(v) =>
                  v &&
                  setF((s) => ({
                    ...s,
                    start: v,
                    end: s.endDate
                      ? s.end
                      : timeOf(
                          minutesOf(v) +
                            (minutesOf(s.end) - minutesOf(s.start) > 0
                              ? minutesOf(s.end) - minutesOf(s.start)
                              : 60),
                        ),
                  }))
                }
              />
            ) : null}
            {!f.allDay ? (
              <Pick
                pt={pt}
                kind="time"
                testID="sheet-end"
                value={f.end}
                onChange={(v) => v && set('end', v)}
              />
            ) : null}
          </View>
          <View style={{ marginTop: 8 }}>
            <Text style={{ color: pt.ink3, fontSize: 11, marginBottom: 4, fontFamily: pt.sans }}>
              {t('planner.fino_al')}
            </Text>
            <Pick
              pt={pt}
              kind="date"
              testID="sheet-enddate"
              value={f.endDate}
              clearable
              placeholder="—"
              onChange={(v) => set('endDate', v && v > f.date ? v : '')}
            />
          </View>

          <Label pt={pt}>{t('planner.calendario')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {p.calendars.map((c) => (
              <Chip
                key={c.uuid}
                pt={pt}
                testID={`cal-${c.uuid}`}
                label={c.name}
                active={(f.calendar ?? p.calendars.find((x) => x.is_default)?.uuid) === c.uuid}
                color={c.color ? longHex(c.color, pt.accent) : undefined}
                onPress={() => set('calendar', c.uuid)}
              />
            ))}
          </View>

          <Label pt={pt}>{t('planner.categoria')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Chip
              pt={pt}
              testID="cat-none"
              label={t('planner.nessuna')}
              active={f.category === null}
              onPress={() => set('category', null)}
            />
            {p.categories.map((c) => (
              <Chip
                key={c.uuid}
                pt={pt}
                testID={`cat-${c.uuid}`}
                label={c.name}
                active={f.category === c.uuid}
                color={longHex(c.color, pt.accent)}
                onPress={() => set('category', c.uuid)}
              />
            ))}
          </View>

          <Label pt={pt}>{t('planner.importanza')}</Label>
          <View style={{ flexDirection: 'row' }}>
            {IMPORTANCE.map((i) => (
              <Chip
                key={i.id}
                pt={pt}
                testID={`imp-${i.id}`}
                label={t(i.key)}
                active={f.importance === i.id}
                onPress={() => set('importance', i.id)}
              />
            ))}
          </View>

          <Label pt={pt}>{t('planner.ripeti')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {REPEATS.map((r) => (
              <Chip
                key={r.id}
                pt={pt}
                testID={`rep-${r.id}`}
                label={t(r.key)}
                active={f.repeat === r.id}
                onPress={() => set('repeat', r.id)}
              />
            ))}
          </View>
          {f.repeat === 'custom' ? (
            <View style={{ marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: pt.ink2, fontFamily: pt.sans }}>{t('planner.ogni')}</Text>
                <TextInput
                  testID="rep-interval"
                  keyboardType="number-pad"
                  value={String(f.interval)}
                  onChangeText={(v) =>
                    set('interval', Math.max(1, Math.min(365, Number(v.replace(/\D/g, '')) || 1)))
                  }
                  style={[inputStyle, { width: 64, textAlign: 'center' }]}
                />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                {UNITS.map((u) => (
                  <Chip
                    key={u.id}
                    pt={pt}
                    testID={`unit-${u.id}`}
                    label={t(u.key)}
                    active={f.unit === u.id}
                    onPress={() => set('unit', u.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}
          {f.repeat !== 'none' ? (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: pt.ink3, fontSize: 11, marginBottom: 4, fontFamily: pt.sans }}>
                {t('planner.fino_al')}
              </Text>
              <Pick
                pt={pt}
                kind="date"
                testID="sheet-until"
                value={f.until}
                clearable
                placeholder={t('planner.infinito')}
                onChange={(v) => set('until', v)}
              />
            </View>
          ) : null}

          <Label pt={pt}>{t('planner.notifica')}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {NOTIFIES.map((n) => (
              <Chip
                key={n.id}
                pt={pt}
                testID={`not-${n.id}`}
                label={t(n.key)}
                active={f.notify === n.id}
                onPress={() => set('notify', n.id)}
              />
            ))}
          </View>
          {f.notify === 'custom' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                testID="not-minutes"
                keyboardType="number-pad"
                value={String(f.notifyMin)}
                onChangeText={(v) =>
                  set('notifyMin', Math.max(0, Math.min(40320, Number(v.replace(/\D/g, '')) || 0)))
                }
                style={[inputStyle, { width: 90, textAlign: 'center' }]}
              />
              <Text style={{ color: pt.ink2, fontFamily: pt.sans }}>
                {t('planner.minuti_prima')}
              </Text>
            </View>
          ) : null}

          <Label pt={pt}>{t('planner.luogo')}</Label>
          <TextInput
            testID="sheet-location"
            value={f.location}
            onChangeText={(v) => {
              set('location', v);
              // scrivendo a mano l'aggancio cade: coordinate vecchie accanto a un indirizzo nuovo sono peggio di niente
              setPlace(null);
              forget();
              search.type(v);
            }}
            onBlur={() => setTimeout(search.close, 200)}
            placeholder={p.places ? t('planner.cerca_un_indirizzo_o_un') : undefined}
            placeholderTextColor={pt.ink3}
            style={inputStyle}
          />
          <PlaceHits pt={pt} hits={search.hits} onPick={pickHit} />
          {shownPlace ? (
            <PlaceStatus
              pt={pt}
              place={shownPlace}
              waiting={waiting}
              onClear={() => {
                setPlace(null);
                forget();
              }}
            />
          ) : null}
          {notFound ? (
            <Text testID="place-not-found" style={{ color: pt.ink3, marginTop: 6 }}>
              {t('planner.posizione_non_trovata_resta_il')}
            </Text>
          ) : null}
          <PlacesField
            pt={pt}
            places={places}
            suggested={suggested}
            chosenName={place !== 'keep' && place ? place.name : null}
            onPick={pickPlace}
          />
          {book ? (
            <>
              <Label pt={pt}>{t('planner.invitati')}</Label>
              <GuestsField pt={pt} contacts={contacts} guests={guests} onChange={setGuests} />
            </>
          ) : null}
          <Label pt={pt}>{t('planner.note')}</Label>
          <TextInput
            testID="sheet-notes"
            value={f.notes}
            onChangeText={(v) => set('notes', v)}
            multiline
            placeholderTextColor={pt.ink3}
            style={[inputStyle, { minHeight: 90, textAlignVertical: 'top' }]}
          />

          {view ? (
            <Pressable
              testID="sheet-delete"
              accessibilityRole="button"
              onPress={remove}
              style={{ marginTop: 28, alignItems: 'center', padding: 12 }}
            >
              <Text style={{ color: '#B4645F', fontSize: 15, fontFamily: pt.sans }}>
                {t('planner.elimina_evento')}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export { addDaysIso };
