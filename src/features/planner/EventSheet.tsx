import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/CappedText';
import type { Project } from '@/features/projects/logic';

import { Pick, dayDiff } from './Pick';
import { categoryHints } from './categoryHints';
import { NOTIFY_MINUTES } from './durationInput';
import type { DefaultNotify } from './settings';
import { WhenField } from './WhenField';
import { GuestsField, type PickedPlace } from './BookParts';
import { mapsUrl, PlaceHits, PlaceStatus, usePlaceSearch, type PlacesApi } from './PlaceSearch';
import { ContactsSheet, ProjectSheet, SavedPlacesSheet } from './SheetSubs';
import type { PlaceHit } from '@/core/account/accountApi';
import type { BookRepo, Contact, GuestInput, Place } from './book';
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
import {
  Field,
  fieldBox,
  IconBtn,
  RowSB,
  SelectField,
  SheetGlyph,
  SheetPanel,
  Seg,
  Swatch,
  Tag,
  TxtBtn,
} from './sheetUi';

export type SheetTarget =
  | { mode: 'new'; date: string; start?: string; category?: string }
  | { mode: 'edit'; view: EventView };

type Importance = 'normal' | 'high' | 'highest';
type Lock = 'auto' | 'chiuso' | 'aperto';

/** I colori fissi del selettore «Colore» (il primo, quello della categoria, si aggiunge davanti). */
export const SWATCHES = [
  '#C7DED6',
  '#F0D3D6',
  '#D8D3E8',
  '#F3E4C0',
  '#CFDDEA',
  '#E8D5C7',
  '#DCE7C8',
];

const REPEATS: { id: Repeat; key: string }[] = [
  { id: 'none', key: 'planner.mai_t' },
  { id: 'daily', key: 'planner.ogni_giorno' },
  { id: 'weekly', key: 'planner.ogni_settimana' },
  { id: 'monthly', key: 'planner.ogni_mese' },
  { id: 'yearly', key: 'planner.ogni_anno' },
  { id: 'custom', key: 'planner.personalizzato' },
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

/** Il foglio per creare o cambiare un evento: ricalcato sul popup del sito (09_popup_evento.js + planner_fogli.css). */
export function EventSheet(p: {
  pt: PlannerTheme;
  repo: PlannerRepo;
  /** la rubrica e i luoghi salvati; senza, la scheda non mostra invitati né luoghi salvati */
  book?: BookRepo;
  /** la ricerca dei posti sul sito (solo online); senza, il luogo resta un testo libero */
  places?: PlacesApi;
  /** la lingua dei risultati della ricerca */
  lang?: string;
  calendars: Calendar[];
  categories: Category[];
  /** i progetti a cui si può collegare l'evento */
  projects?: Project[];
  /** l'avviso con cui parte un evento nuovo (impostazioni del planner; senza, un'ora prima) */
  defaultNotify?: DefaultNotify;
  /** crea un progetto al volo dal selettore (restituisce il suo uuid) */
  onCreateProject?: (name: string) => string | null;
  target: SheetTarget;
  onClose: () => void;
  /** dopo una modifica: la schermata rilegge */
  onChanged: () => void;
}) {
  const { pt, target } = p;
  const { t } = useTranslation();
  const view = target.mode === 'edit' ? target.view : null;
  const fresh = target.mode === 'new' ? target : null;
  const projects = p.projects ?? [];

  const [f, setF] = useState(() => {
    if (view) {
      return {
        title: view.title,
        type: view.type as 'event' | 'task',
        allDay: view.allDay,
        date: view.date,
        endDate: view.multiday ? view.endDate : view.date,
        start: view.start,
        end: view.end,
        calendar: view.calendarUuid,
        category: view.categoryUuid,
        project: view.projectUuid,
        color: view.color,
        importance: view.importance as Importance,
        repeat: view.repeat as Repeat,
        interval: view.repeatInterval,
        unit: view.repeatUnit as Unit,
        until: view.repeatUntil ?? '',
        notify: view.notify as Notify,
        notifyMin: view.notifyMin,
        location: view.location,
        notes: view.notes,
        lock: 'auto' as Lock,
      };
    }
    const start = fresh?.start ?? '09:00';
    return {
      title: '',
      type: 'event' as 'event' | 'task',
      allDay: false,
      date: fresh?.date ?? '',
      endDate: fresh?.date ?? '',
      start,
      end: timeOf(Math.min(1439, minutesOf(start) + 60)),
      calendar: null as string | null,
      category: (fresh?.category ?? null) as string | null,
      project: null as string | null,
      color: null as string | null,
      importance: 'normal' as Importance,
      repeat: 'none' as Repeat,
      interval: 1,
      unit: 'week' as Unit,
      until: '',
      notify: (p.defaultNotify ?? 'h1') as Notify,
      notifyMin: NOTIFY_MINUTES[p.defaultNotify ?? 'h1'],
      location: '',
      notes: '',
      lock: 'auto' as Lock,
    };
  });
  // toccando fuori: se si è scritto qualcosa vale «salva», altrimenti «annulla» (come sul sito)
  const [dirty, setDirty] = useState(false);
  const edit = (fn: (s: typeof f) => typeof f) => {
    setDirty(true);
    setF(fn);
  };
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => edit((s) => ({ ...s, [k]: v }));

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
  const [contacts, setContacts] = useState<Contact[]>(() => book?.contacts() ?? []);
  const [places, setPlaces] = useState<Place[]>(() => book?.places() ?? []);
  const [subSheet, setSubSheet] = useState<'project' | 'places' | 'contacts' | null>(null);
  // il luogo scelto; 'keep' = non toccato (resta quello che l'evento ha già)
  const [place, setPlace] = useState<PickedPlace | null | 'keep'>('keep');
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
    set('location', pl.address || pl.place_name || pl.label);
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

  const project = f.project ? (projects.find((x) => x.uuid === f.project) ?? null) : null;
  const projectColor = project?.color ? longHex(project.color, pt.neutralEv) : null;
  const category = f.category ? (p.categories.find((c) => c.uuid === f.category) ?? null) : null;
  const baseColor = category
    ? longHex(category.color, pt.neutralEv)
    : (projectColor ?? pt.neutralEv);
  // il colore del foglio: quello scelto, della categoria, del progetto, o il neutro
  const tint = f.color ? longHex(f.color, pt.neutralEv) : baseColor;

  const input = (): EventInput => ({
    title: f.title,
    type: f.type,
    allDay: f.allDay,
    date: f.date,
    endDate: f.endDate > f.date ? f.endDate : null,
    start: f.start,
    end: f.end,
    calendarUuid: f.calendar,
    categoryUuid: f.category,
    projectUuid: f.project,
    color: f.color,
    importance: f.importance,
    durationLocked: f.lock === 'chiuso',
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
    Alert.alert(
      t('planner.elimino_questo_evento'),
      f.title ? t('planner.titolo_rimosso', { titolo: f.title }) : t('planner.sara_rimosso'),
      [
        { text: t('comune.annulla'), style: 'cancel' },
        {
          text: t('planner.elimina'),
          style: 'destructive',
          onPress: () => {
            p.repo.remove(view, 'one');
            finish();
          },
        },
      ],
    );
  };

  const onBackdrop = () => {
    if (dirty && (f.title.trim() || f.category || f.project || f.notes)) save();
    else p.onClose();
  };

  // --- date e orari: le stesse regole del sito (spostare inizio / fine / durata con i tre stati del lucchetto) ---
  const setDate = (v: string) =>
    edit((s) => {
      const days = dayDiff(s.date, s.endDate);
      return { ...s, date: v, endDate: days > 0 ? addDaysIso(v, days) : v };
    });
  const setEndDate = (v: string) => edit((s) => ({ ...s, endDate: !v || v < s.date ? s.date : v }));
  const setStart = (v: string) =>
    edit((s) => {
      const dur = Math.max(5, minutesOf(s.end) - minutesOf(s.start));
      let end = s.end;
      if (s.lock !== 'aperto') end = timeOf(minutesOf(v) + dur);
      else if (minutesOf(end) <= minutesOf(v)) end = timeOf(minutesOf(v) + 5);
      return { ...s, start: v, end };
    });
  const setEnd = (v: string) =>
    edit((s) => {
      if (s.lock === 'chiuso') {
        const dur = Math.max(5, minutesOf(s.end) - minutesOf(s.start));
        let fine = Math.min(1439, minutesOf(v));
        let inizio = fine - dur;
        if (inizio < 0) {
          inizio = 0;
          fine = Math.min(1439, dur);
        }
        return { ...s, start: timeOf(inizio), end: timeOf(fine) };
      }
      const end = minutesOf(v) <= minutesOf(s.start) ? timeOf(minutesOf(s.start) + 5) : v;
      return { ...s, end };
    });
  const setDuration = (mins: number) =>
    edit((s) => ({ ...s, end: timeOf(minutesOf(s.start) + mins) }));
  const setAllDay = (on: boolean) =>
    edit((s) => {
      if (on || (s.start && s.start !== '00:00') || s.end !== '23:59') return { ...s, allDay: on };
      const start = fresh?.start ?? '09:00';
      return { ...s, allDay: on, start, end: timeOf(minutesOf(start) + 60) };
    });
  const nextLock = (l: Lock): Lock =>
    l === 'auto' ? 'chiuso' : l === 'chiuso' ? 'aperto' : 'auto';
  const lockLabel =
    f.lock === 'chiuso'
      ? t('planner.durata_bloccata_spostando_un_orario')
      : f.lock === 'aperto'
        ? t('planner.durata_libera_spostando_un_orario')
        : t('planner.spostando_linizio_la_durata_resta');

  const inputText = {
    color: pt.ink,
    fontSize: 15,
    fontFamily: pt.sans,
  } as const;
  const fieldInput = {
    ...fieldBox(pt),
    ...inputText,
    paddingHorizontal: 13,
    paddingVertical: 12,
  } as const;

  const openMap = () => {
    const s = shownPlace;
    const url =
      s && s.lat !== null && s.lon !== null
        ? mapsUrl(s.lat, s.lon, s.name, Platform.OS)
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            f.location.trim() || t('planner.vicino_a_me'),
          )}`;
    void Linking.openURL(url);
  };

  // le categorie nel menu, e quelle da proporre accanto: l'ultima usata (orologio) e fino a 3 suggerite dal titolo (scintilla)
  const categoryOptions = [
    { id: '__none', label: t('planner.nessuna') },
    ...(project
      ? [{ id: '__project', label: project.name, dot: projectColor ?? pt.neutralEv }]
      : []),
    ...[...p.categories]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .map((c) => ({ id: c.uuid, label: c.name, dot: longHex(c.color, pt.accent) })),
  ];
  const historyRows = useMemo(() => p.repo.rows(), [p.repo]);
  const hints = useMemo(
    () => categoryHints(historyRows, f.title, new Set(p.categories.map((c) => c.uuid))),
    [historyRows, f.title, p.categories],
  );
  const picks: { uuid: string; name: string; color: string; why: 'last' | 'title' }[] = [];
  for (const [uuid, why] of [
    ...(hints.last ? [[hints.last, 'last'] as const] : []),
    ...hints.suggested.map((u) => [u, 'title'] as const),
  ]) {
    const c = p.categories.find((x) => x.uuid === uuid);
    if (c && !picks.some((x) => x.uuid === uuid))
      picks.push({ uuid, name: c.name, color: c.color, why });
  }

  const calChoices = p.calendars
    .filter((c) => c.role !== 'study' || f.calendar === c.uuid)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const activeCal = f.calendar ?? p.calendars.find((c) => c.is_default)?.uuid ?? '';

  return (
    <>
      <SheetPanel
        pt={pt}
        tint={tint}
        onBackdrop={onBackdrop}
        onClose={p.onClose}
        head={
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TxtBtn
                pt={pt}
                testID="sheet-cancel"
                label={t('comune.annulla')}
                onPress={p.onClose}
              />
              {view ? (
                <Pressable
                  testID="sheet-trash"
                  accessibilityRole="button"
                  accessibilityLabel={t('planner.elimina_evento')}
                  onPress={remove}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#F3DCDC',
                  }}
                >
                  <SheetGlyph name="trash" color="#8E5A5A" />
                </Pressable>
              ) : null}
            </View>
            <Text
              style={{
                color: pt.ink3,
                fontSize: 10,
                fontWeight: '500',
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                fontFamily: pt.sans,
              }}
            >
              {view ? t('planner.modifica') : t('planner.nuovo_evento')}
            </Text>
            <TxtBtn pt={pt} strong testID="sheet-save" label={t('comune.salva')} onPress={save} />
          </>
        }
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 40 }}
          >
            {/* titolo + progetto, tipo e priorità */}
            <Field pt={pt}>
              <View
                style={[
                  fieldBox(pt),
                  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 6 },
                ]}
              >
                <TextInput
                  testID="sheet-title"
                  autoFocus={!view}
                  value={f.title}
                  maxLength={180}
                  onChangeText={(v) => {
                    set('title', v);
                    // il luogo può arrivare da solo, se il titolo nomina un posto salvato (solo a luogo vuoto)
                    if (book && !f.location.trim()) {
                      const hit = book.suggestPlace(v);
                      if (hit) pickPlace(hit);
                    }
                  }}
                  placeholder={t('planner.titolo')}
                  placeholderTextColor={pt.ink3}
                  style={{
                    flex: 1,
                    paddingHorizontal: 13,
                    paddingVertical: 12,
                    color: pt.ink,
                    fontSize: 19,
                    fontFamily: pt.serif,
                  }}
                />
                <IconBtn
                  pt={pt}
                  testID="sheet-project-btn"
                  label={t('todo.collega_progetto')}
                  onPress={() => setSubSheet('project')}
                >
                  <SheetGlyph name="folder" color={pt.ink2} />
                </IconBtn>
              </View>
              {project ? (
                <Text
                  testID="sheet-project-name"
                  style={{
                    color: pt.ink3,
                    fontSize: 11.5,
                    marginTop: 6,
                    marginHorizontal: 2,
                    fontFamily: pt.sans,
                  }}
                >
                  {t('planner.progetto_due')}
                  {project.name}
                </Text>
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 8,
                  marginHorizontal: 2,
                }}
              >
                <Seg
                  pt={pt}
                  small
                  testID="sheet-type"
                  value={f.type}
                  onChange={(v) => set('type', v)}
                  options={[
                    { id: 'event', label: t('planner.evento'), testID: 'type-event' },
                    { id: 'task', label: t('planner.task'), testID: 'type-task' },
                  ]}
                />
                <View style={{ marginLeft: 'auto', flexShrink: 1 }}>
                  <Seg
                    pt={pt}
                    small
                    tight
                    testID="sheet-importance"
                    value={f.importance}
                    onChange={(v) => set('importance', v)}
                    options={[
                      { id: 'normal', label: t('planner.normale'), testID: 'imp-normal' },
                      { id: 'high', label: t('planner.importante'), testID: 'imp-high' },
                      { id: 'highest', label: t('planner.importantissimo'), testID: 'imp-highest' },
                    ]}
                  />
                </View>
              </View>
            </Field>

            {/* quando: una linea dall'inizio alla fine, con la durata in mezzo */}
            <Field pt={pt} label={t('planner.quando')}>
              <WhenField
                pt={pt}
                date={f.date}
                endDate={f.endDate}
                start={f.start}
                end={f.end}
                allDay={f.allDay}
                lock={f.lock}
                minutes={Math.max(0, minutesOf(f.end) - minutesOf(f.start))}
                lockLabel={lockLabel}
                onDate={setDate}
                onEndDate={setEndDate}
                onStart={setStart}
                onEnd={setEnd}
                onDuration={setDuration}
                onLock={() => set('lock', nextLock(f.lock))}
                onAllDay={setAllDay}
              />
            </Field>

            {/* ripetizione e avviso: una riga sola con due scelte affiancate, senza titoli (come sul sito) */}
            <Field pt={pt}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <SelectField
                    pt={pt}
                    wide
                    icon="repeat"
                    testID="rep"
                    title={t('planner.ripeti')}
                    value={f.repeat}
                    options={REPEATS.map((r) => ({ id: r.id, label: t(r.key) }))}
                    onChange={(v) => set('repeat', v)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SelectField
                    pt={pt}
                    wide
                    icon="bell"
                    testID="not"
                    title={t('planner.notifica')}
                    value={f.notify}
                    options={NOTIFIES.map((n) => ({ id: n.id, label: t(n.key) }))}
                    onChange={(v) => set('notify', v)}
                  />
                </View>
              </View>
              {f.repeat === 'custom' ? (
                <RowSB pt={pt} label={t('planner.intervallo')}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                    <Text style={{ color: pt.ink3, fontSize: 11.5, fontFamily: pt.sans }}>
                      {t('planner.ogni')}
                    </Text>
                    <TextInput
                      testID="rep-interval"
                      keyboardType="number-pad"
                      value={String(f.interval)}
                      onChangeText={(v) =>
                        set(
                          'interval',
                          Math.max(1, Math.min(365, Number(v.replace(/\D/g, '')) || 1)),
                        )
                      }
                      style={[
                        fieldBox(pt),
                        inputText,
                        { width: 76, paddingVertical: 8, textAlign: 'center' },
                      ]}
                    />
                    <SelectField
                      pt={pt}
                      testID="unit"
                      value={f.unit}
                      options={UNITS.map((u) => ({ id: u.id, label: t(u.key) }))}
                      onChange={(v) => set('unit', v)}
                    />
                  </View>
                </RowSB>
              ) : null}
              {f.repeat !== 'none' ? (
                <RowSB pt={pt} label={t('planner.fino_al')} last>
                  <Pick
                    pt={pt}
                    kind="date"
                    testID="sheet-until"
                    value={f.until}
                    clearable
                    placeholder={t('planner.infinito')}
                    onChange={(v) => set('until', v)}
                  />
                </RowSB>
              ) : null}
              {f.notify === 'custom' ? (
                <RowSB pt={pt} label={t('planner.minuti_prima')} last>
                  <TextInput
                    testID="not-minutes"
                    keyboardType="number-pad"
                    value={String(f.notifyMin)}
                    onChangeText={(v) =>
                      set(
                        'notifyMin',
                        Math.max(0, Math.min(40320, Number(v.replace(/\D/g, '')) || 0)),
                      )
                    }
                    style={[
                      fieldBox(pt),
                      inputText,
                      { width: 96, paddingVertical: 8, textAlign: 'center' },
                    ]}
                  />
                </RowSB>
              ) : null}
            </Field>

            {/* calendario */}
            {calChoices.length > 1 ? (
              <Field pt={pt} label={t('planner.calendario')}>
                <SelectField
                  pt={pt}
                  wide
                  testID="cal"
                  title={t('planner.calendario')}
                  value={activeCal}
                  options={calChoices.map((c) => ({ id: c.uuid, label: c.name }))}
                  onChange={(v) => set('calendar', v)}
                />
              </Field>
            ) : null}

            {/* categoria: un menu e, accanto, l'ultima usata e le suggerite dal titolo */}
            <Field pt={pt} label={t('planner.categoria')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flexBasis: '38%', maxWidth: 190, flexShrink: 0 }}>
                  <SelectField
                    pt={pt}
                    wide
                    compact
                    testID="cat"
                    title={t('planner.categoria')}
                    value={f.category ?? (project ? '__project' : '__none')}
                    options={categoryOptions}
                    onChange={(v) =>
                      edit((s) => ({
                        ...s,
                        category: v === '__none' || v === '__project' ? null : v,
                        color: null,
                      }))
                    }
                  />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={{ flex: 1 }}
                  contentContainerStyle={{ gap: 6, alignItems: 'center', paddingVertical: 2 }}
                >
                  {picks.map((c) => (
                    <Tag
                      key={c.uuid}
                      pt={pt}
                      testID={`cat-${c.uuid}`}
                      label={c.name}
                      color={longHex(c.color, pt.accent)}
                      on={f.category === c.uuid}
                      onPress={() =>
                        edit((s) => ({
                          ...s,
                          category: s.category === c.uuid ? null : c.uuid,
                          color: null,
                        }))
                      }
                      trailing={
                        <SheetGlyph
                          name={c.why === 'last' ? 'clock' : 'spark'}
                          color={pt.ink3}
                          size={11}
                        />
                      }
                    />
                  ))}
                </ScrollView>
              </View>
            </Field>

            {/* colore */}
            <Field pt={pt} label={t('planner.colore')}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 4 }}>
                {[baseColor, ...SWATCHES].map((c, i) => (
                  <Swatch
                    key={`${c}-${i}`}
                    pt={pt}
                    testID={`sw-${i}`}
                    color={c}
                    on={f.color === c || (i === 0 && !f.color)}
                    onPress={() => set('color', i === 0 ? null : c)}
                  />
                ))}
              </View>
            </Field>

            {/* luogo */}
            <Field pt={pt} label={t('planner.luogo')}>
              <View
                style={[
                  fieldBox(pt),
                  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 6 },
                ]}
              >
                <TextInput
                  testID="sheet-location"
                  value={f.location}
                  maxLength={255}
                  autoCorrect={false}
                  onChangeText={(v) => {
                    set('location', v);
                    // scrivendo a mano l'aggancio cade: coordinate vecchie accanto a un indirizzo nuovo sono peggio di niente
                    setPlace(null);
                    forget();
                    search.type(v);
                  }}
                  onBlur={() => setTimeout(search.close, 200)}
                  placeholder={t('planner.cerca_un_indirizzo_o_un')}
                  placeholderTextColor={pt.ink3}
                  style={{
                    flex: 1,
                    paddingHorizontal: 13,
                    paddingVertical: 12,
                    color: pt.ink,
                    fontSize: 19,
                    fontFamily: pt.serif,
                  }}
                />
                <IconBtn
                  pt={pt}
                  testID="loc-map"
                  label={t('planner.apri_nella_mappa')}
                  onPress={openMap}
                >
                  <SheetGlyph name="pin" color={pt.ink2} />
                </IconBtn>
                {book ? (
                  <IconBtn
                    pt={pt}
                    testID="loc-book"
                    label={t('planner.luoghi_salvati')}
                    onPress={() => setSubSheet('places')}
                  >
                    <SheetGlyph name="bookmark" color={pt.ink2} />
                  </IconBtn>
                ) : null}
              </View>
              <PlaceHits pt={pt} hits={search.hits} onPick={pickHit} />
              {shownPlace || waiting ? (
                <PlaceStatus
                  pt={pt}
                  place={shownPlace ?? { name: null, lat: null, lon: null, ref: null }}
                  waiting={waiting}
                  onClear={() => {
                    setPlace(null);
                    forget();
                  }}
                />
              ) : f.location.trim() ? (
                <Text
                  testID="place-by-hand"
                  style={{
                    color: pt.ink3,
                    fontSize: 11.5,
                    marginTop: 7,
                    marginHorizontal: 2,
                    fontFamily: pt.sans,
                  }}
                >
                  {t('planner.posto_a_mano')}
                </Text>
              ) : null}
              {notFound ? (
                <Text
                  testID="place-not-found"
                  style={{ color: pt.ink3, marginTop: 6, fontFamily: pt.sans }}
                >
                  {t('planner.posizione_non_trovata_resta_il')}
                </Text>
              ) : null}
            </Field>

            {/* invitati */}
            {book ? (
              <Field pt={pt} label={t('planner.invitati')}>
                <GuestsField
                  pt={pt}
                  guests={guests}
                  nameOf={(g) =>
                    g.name || contacts.find((c) => c.email === g.email)?.name || g.email
                  }
                  onChange={(g) => {
                    setDirty(true);
                    setGuests(g);
                  }}
                  onOpenBook={() => setSubSheet('contacts')}
                />
              </Field>
            ) : null}

            {/* note */}
            <Field pt={pt} label={t('planner.note')}>
              <TextInput
                testID="sheet-notes"
                value={f.notes}
                onChangeText={(v) => set('notes', v)}
                multiline
                maxLength={4000}
                placeholder={t('planner.qualcosa_da_ricordare')}
                placeholderTextColor={pt.ink3}
                style={[fieldInput, { minHeight: 200, lineHeight: 23, textAlignVertical: 'top' }]}
              />
            </Field>

            {view ? (
              <Pressable
                testID="sheet-delete"
                accessibilityRole="button"
                onPress={remove}
                style={{
                  marginTop: 4,
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: '#F3DCDC',
                }}
              >
                <Text style={{ color: '#8E5A5A', fontSize: 14.5, fontFamily: pt.sans }}>
                  {t('planner.elimina_evento')}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SheetPanel>

      {subSheet === 'project' ? (
        <ProjectSheet
          pt={pt}
          projects={projects}
          onCreate={p.onCreateProject}
          value={f.project}
          onClose={() => setSubSheet(null)}
          onPick={(uuid) => {
            const chosen = uuid ? projects.find((x) => x.uuid === uuid) : null;
            edit((s) => ({
              ...s,
              project: uuid,
              // un progetto scelto su un evento senza titolo gli dà il suo nome
              title: chosen && !s.title.trim() ? chosen.name : s.title,
            }));
            setSubSheet(null);
          }}
        />
      ) : null}
      {subSheet === 'places' && book ? (
        <SavedPlacesSheet
          pt={pt}
          book={book}
          places={places}
          onPlaces={setPlaces}
          canSave={!!shownPlace && shownPlace.lat !== null && shownPlace.lon !== null}
          placeName={shownPlace?.name ?? null}
          address={f.location}
          lat={shownPlace?.lat ?? null}
          lon={shownPlace?.lon ?? null}
          placeRef={shownPlace?.ref ?? null}
          onClose={() => setSubSheet(null)}
          onPick={(pl) => {
            pickPlace(pl);
            setSubSheet(null);
          }}
        />
      ) : null}
      {subSheet === 'contacts' && book ? (
        <ContactsSheet
          pt={pt}
          book={book}
          contacts={contacts}
          onContacts={setContacts}
          onClose={() => setSubSheet(null)}
          onInvite={(c) => {
            setDirty(true);
            setGuests((cur) =>
              cur.some((g) => g.email === c.email)
                ? cur
                : [...cur, { email: c.email, name: c.name, contactUuid: c.uuid }],
            );
            setSubSheet(null);
          }}
        />
      ) : null}
    </>
  );
}

export { addDaysIso };
