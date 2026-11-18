import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Pressable, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { AccountApi } from '@/core/account/accountApi';
import { Text } from '@/ui/CappedText';

import type { GcCalendars, GcDedicated, GcPrimary, GcStatus } from './gcal';
import type { PlannerTheme } from './plannerTheme';
import { SelectField } from './sheetUi';

/**
 * La scheda Google Calendar in cima alle impostazioni del planner (schedaGoogle e drawGoogle del sito): lo stato scritto
 * nell'intestazione, che si apre toccandola (da sola se l'account non è ancora collegato, perché il tasto per
 * collegarlo è la cosa da vedere). Dentro: l'account con Sincronizza e Scollega, cosa mandare a Google, i due elenchi
 * dei calendari e la riparazione dei doppioni.
 */

const errText = (e: unknown, fallback: string): string =>
  e instanceof Error && e.message && !/^HTTP \d+$/.test(e.message) ? e.message : fallback;

function Btn({
  pt,
  label,
  onPress,
  testID,
  primary,
  disabled,
  wide,
}: {
  pt: PlannerTheme;
  label: string;
  onPress: () => void;
  testID: string;
  primary?: boolean;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        alignSelf: wide ? 'stretch' : 'flex-start',
        alignItems: 'center',
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: primary ? pt.accent : pt.accentSoft,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          color: primary ? pt.onAccent : pt.accentInk,
          fontSize: 13,
          fontWeight: '600',
          fontFamily: pt.sans,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const Sub = ({ pt, children, id }: { pt: PlannerTheme; children: string; id?: string }) => (
  <Text testID={id} style={{ color: pt.ink3, fontSize: 12.5, fontFamily: pt.sans, lineHeight: 17 }}>
    {children}
  </Text>
);
const Lab = ({ pt, children }: { pt: PlannerTheme; children: string }) => (
  <Text style={{ color: pt.ink2, fontSize: 13, fontWeight: '600', fontFamily: pt.sans }}>
    {children}
  </Text>
);

/** i due elenchi: da Google a qui e da qui a Google */
function CalendarBridge({ pt, account }: { pt: PlannerTheme; account: AccountApi }) {
  const { t } = useTranslation();
  const [data, setData] = useState<GcCalendars | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    account
      .gcCalendars()
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch((e: unknown) => setError(errText(e, t('planner.elenco_non_disponibile'))));
  }, [account, t]);
  useEffect(load, [load]);

  if (error) return <Sub pt={pt}>{error}</Sub>;
  if (!data) return <Sub pt={pt}>{t('planner.cerco_i_tuoi_calendari_su')}</Sub>;

  const send = (job: Promise<void>) =>
    job.then(
      () => {
        setNote(t('planner.scelta_salvata_si_allinea_al'));
        load();
      },
      (e: unknown) => setNote(errText(e, t('planner.scelta_non_salvata'))),
    );
  const mapSet = (ref: string, dest: number) => send(account.gcMapSet(ref, dest));
  const ask = (g: GcCalendars['google'][number], dest: number) => {
    // si chiede conferma solo quando c'è davvero qualcosa da perdere: è l'unica scelta che cancella roba già entrata
    if (dest === 0 && (g.calendarId || g.entered)) {
      Alert.alert(
        t('planner.togliere_calendario', { nome: g.name || t('planner.questo_calendario') }),
        (g.entered
          ? t('planner.n_eventi_spariranno', { n: g.entered })
          : t('planner.eventi_spariranno')) + t('planner.anche_passati'),
        [
          { text: t('planner.annulla'), style: 'cancel' },
          {
            text: t('planner.togli_2'),
            style: 'destructive',
            onPress: () => void mapSet(g.ref, 0),
          },
        ],
      );
      return;
    }
    void mapSet(g.ref, dest);
  };

  const mineOptions = [
    { id: '0', label: t('planner.nessuno') },
    ...data.mine.map((m) => ({ id: String(m.id), label: m.name })),
  ];
  const pushOptions = [
    { id: '', label: t('planner.come_impostato_sopra') },
    // i calendari di sola lettura non compaiono: Google rifiuta sempre chi prova a scriverci
    ...data.google.filter((g) => g.canWrite).map((g) => ({ id: g.ref, label: g.name })),
  ];

  return (
    <View testID="gc-bridge" style={{ gap: 10, marginTop: 6 }}>
      <Lab pt={pt}>{t('planner.dai_calendari_di_google')}</Lab>
      <Sub pt={pt}>{t('planner.spiega_da_google')}</Sub>
      {data.google.map((g) => (
        <View key={g.ref} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: g.color ?? pt.hair2,
              }}
            />
            <Text style={{ color: pt.ink, fontSize: 14, fontFamily: pt.sans }}>{g.name}</Text>
            {g.isOurs || g.isPrimary ? (
              <Text style={{ color: pt.ink3, fontSize: 11.5, fontFamily: pt.sans }}>
                {g.isOurs ? t('planner.nostro') : t('planner.principale')}
              </Text>
            ) : null}
            {g.entered ? (
              <Text style={{ color: pt.ink3, fontSize: 11.5, fontFamily: pt.sans }}>
                {t('planner.n_qui', { n: g.entered })}
              </Text>
            ) : null}
          </View>
          <SelectField
            pt={pt}
            wide
            testID={`gc-map-${g.ref}`}
            options={mineOptions}
            value={String(g.calendarId ?? 0)}
            onChange={(v) => ask(g, parseInt(v, 10) || 0)}
          />
        </View>
      ))}

      <View style={{ height: 6 }} />
      <Lab pt={pt}>{t('planner.dai_tuoi_calendari_a_google')}</Lab>
      <Sub pt={pt}>{t('planner.spiega_verso_google')}</Sub>
      {data.mine.map((m) => (
        <View key={m.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: m.color ?? 'transparent',
                borderWidth: m.color ? 0 : 1,
                borderColor: pt.hair2,
              }}
            />
            <Text style={{ color: pt.ink, fontSize: 14, fontFamily: pt.sans }}>{m.name}</Text>
          </View>
          <SelectField
            pt={pt}
            wide
            testID={`gc-push-${m.id}`}
            options={pushOptions}
            value={m.pushRef}
            onChange={(v) => void send(account.gcPushSet(m.id, v))}
          />
        </View>
      ))}
      {note ? (
        <Sub pt={pt} id="gc-note">
          {note}
        </Sub>
      ) : null}
    </View>
  );
}

function CalIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={15} rx={2.6} stroke={color} strokeWidth={1.8} />
      <Path
        d="M4 10h16M9 3v4M15 3v4M9.5 14.5l1.8 1.8 3.4-3.6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function GoogleCard({
  pt,
  account,
  language,
}: {
  pt: PlannerTheme;
  account: AccountApi;
  language: string;
}) {
  const { t } = useTranslation();
  const [st, setSt] = useState<GcStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const first = useRef(true);

  const load = useCallback(() => {
    account
      .gcStatus()
      .then((s) => {
        setSt(s);
        setFailed(false);
        // non collegato: si apre da sola, perché il tasto per collegarlo è la cosa da vedere
        if (first.current) {
          first.current = false;
          setOpen(s.configured && !s.connected);
        }
      })
      .catch(() => setFailed(true));
  }, [account]);
  useEffect(load, [load]);
  // tornando dal browser, dopo il consenso di Google, lo stato si rilegge da solo
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  const connected = !!st?.connected;
  const act = async (job: () => Promise<void>, done?: string) => {
    setBusy(true);
    setNote(null);
    try {
      await job();
      if (done) setNote(done);
    } catch (e) {
      setNote(errText(e, t('planner.non_riuscito')));
    } finally {
      setBusy(false);
      load();
    }
  };

  const when = (() => {
    if (!st?.lastSync) return t('planner.mai_sincronizzato');
    const d = new Date(st.lastSync.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return t('planner.mai_sincronizzato');
    const day = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long' }).format(d);
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${t('planner.ultima_sync')}${day.toLowerCase()}, ${hm}`;
  })();

  const disconnect = () =>
    Alert.alert(
      t('planner.scollego_google_calendar'),
      t('planner.gli_eventi_gia_scritti_restano'),
      [
        { text: t('planner.annulla'), style: 'cancel' },
        {
          text: t('planner.scollega'),
          style: 'destructive',
          onPress: () =>
            void act(() => account.gcDisconnect(), t('planner.google_calendar_scollegato')),
        },
      ],
    );
  const repair = () =>
    Alert.alert(t('planner.cercare_i_doppioni'), t('planner.spiega_doppioni'), [
      { text: t('planner.annulla'), style: 'cancel' },
      {
        text: t('planner.cerca'),
        onPress: () =>
          void (async () => {
            setBusy(true);
            setNote(t('planner.sto_guardando'));
            try {
              const n = await account.gcRepair();
              setNote(n ? `${n}${t('planner.copie_tolte')}` : t('planner.nessun_doppione_trovato'));
            } catch (e) {
              setNote(errText(e, t('planner.non_riuscito')));
            } finally {
              setBusy(false);
            }
          })(),
      },
    ]);

  const setModes = (p: { gc_dedicated?: GcDedicated; gc_primary?: GcPrimary }) =>
    void act(() => account.gcSetModes(p), t('planner.scelta_salvata_si_allinea_al'));

  const statusText = failed
    ? ''
    : connected
      ? t('planner.gc_collegato')
      : st
        ? t('planner.gc_non_collegato')
        : '';
  const subText = connected
    ? (st?.email ?? t('planner.account_collegato'))
    : st
      ? t('planner.gc_sub')
      : t('planner.controllo_del_collegamento');

  return (
    <View
      testID="ps-google"
      style={{
        marginBottom: 10,
        borderRadius: 18,
        backgroundColor: pt.card,
        borderWidth: 0.5,
        borderColor: pt.fieldRing,
        overflow: 'hidden',
      }}
    >
      <Pressable
        testID="ps-google-head"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: connected ? pt.accentSoft : pt.paper2,
          }}
        >
          <CalIcon color={connected ? pt.accentInk : pt.ink2} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ color: pt.ink, fontSize: 15, fontWeight: '600', fontFamily: pt.sans }}>
              {t('planner.google_calendar')}
            </Text>
            {statusText ? (
              <Text
                testID="ps-google-state"
                style={{
                  color: connected ? pt.accentInk : pt.ink3,
                  fontSize: 11.5,
                  fontWeight: '600',
                  fontFamily: pt.sans,
                }}
              >
                {statusText}
              </Text>
            ) : null}
          </View>
          <Text
            testID="ps-google-sub"
            numberOfLines={1}
            style={{ color: pt.ink3, fontSize: 12.5, marginTop: 1, fontFamily: pt.sans }}
          >
            {subText}
          </Text>
        </View>
        <Text style={{ color: pt.ink3, fontSize: 16 }}>{open ? '⌄' : '›'}</Text>
      </Pressable>

      {open ? (
        <View testID="ps-google-body" style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
          {failed || !st ? (
            <Sub pt={pt}>
              {failed ? t('planner.stato_non_disponibile') : t('planner.cerco_i_tuoi_calendari_su')}
            </Sub>
          ) : !st.configured ? (
            <Sub pt={pt}>{t('planner.non_ancora_configurato_su_questo')}</Sub>
          ) : !connected ? (
            <>
              <Sub pt={pt}>{t('planner.collegando_il_tuo_account_gli')}</Sub>
              <Btn
                pt={pt}
                primary
                testID="gc-connect"
                label={t('planner.collega_google_calendar')}
                onPress={() => void Linking.openURL(account.gcConnectUrl())}
              />
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: pt.ink, fontSize: 14, fontFamily: pt.sans }}>
                    {st.email ?? t('planner.account_collegato')}
                  </Text>
                  <Sub pt={pt} id="gc-when">
                    {when}
                  </Sub>
                </View>
                <Btn
                  pt={pt}
                  testID="gc-disconnect"
                  label={t('planner.scollega')}
                  disabled={busy}
                  onPress={disconnect}
                />
                <Btn
                  pt={pt}
                  primary
                  testID="gc-sync"
                  label={busy ? '…' : t('planner.sincronizza')}
                  disabled={busy}
                  onPress={() => void act(() => account.gcSync())}
                />
              </View>
              <Sub pt={pt}>
                {(st.calendar ? t('planner.calendario_dedicato', { nome: st.calendar }) : '') +
                  t('planner.si_allinea_da_a', { prima: st.window.back, dopo: st.window.forward })}
              </Sub>

              <Lab pt={pt}>{t('planner.nel_calendario_dedicato')}</Lab>
              <SelectField<GcDedicated>
                pt={pt}
                wide
                testID="gc-dedicated"
                value={st.modes.dedicated}
                options={[
                  { id: 'all', label: t('planner.tutti_gli_eventi') },
                  { id: 'high', label: t('planner.solo_importanti_e_importantissimi') },
                  { id: 'highest', label: t('planner.solo_importantissimi') },
                  { id: 'none', label: t('planner.nessuno') },
                ]}
                onChange={(v) => setModes({ gc_dedicated: v })}
              />
              <Lab pt={pt}>{t('planner.nel_calendario_principale_di_google')}</Lab>
              <SelectField<GcPrimary>
                pt={pt}
                wide
                testID="gc-primary"
                value={st.modes.primary}
                options={[
                  { id: 'none', label: t('planner.nessuno') },
                  { id: 'high', label: t('planner.importanti_e_importantissimi') },
                  { id: 'highest', label: t('planner.solo_importantissimi') },
                ]}
                onChange={(v) => setModes({ gc_primary: v })}
              />
              <Sub pt={pt}>{t('planner.quello_che_mandi_qui_non')}</Sub>

              <CalendarBridge pt={pt} account={account} />

              <View style={{ marginTop: 10, gap: 6 }}>
                <Lab pt={pt}>{t('planner.se_qualcosa_e_andato_storto')}</Lab>
                <Btn
                  pt={pt}
                  wide
                  testID="gc-repair"
                  label={t('planner.cerca_e_togli_i_doppioni')}
                  disabled={busy}
                  onPress={repair}
                />
                {st.build ? <Sub pt={pt}>{t('planner.versione', { v: st.build })}</Sub> : null}
              </View>
            </>
          )}
          {note ? (
            <Text
              testID="gc-message"
              style={{ color: pt.ink2, fontSize: 12.5, fontFamily: pt.sans }}
            >
              {note}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
