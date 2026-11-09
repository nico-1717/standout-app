import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DiaryAiReply } from '@/core/account/accountApi';
import { useTheme } from '@/core/theme/ThemeProvider';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';

import {
  MIN_DAYS,
  MIN_WORDS,
  failure,
  makeBook,
  makeReport,
  quarters,
  reportOf,
  type AiRunner,
  type BookProgress,
  type MakeResult,
} from './aiMake';
import type { AiList } from './aiReading';
import type { DiaryTheme } from './diaryTheme';
import type { Insights } from './insights';

/** `true` finché la schermata c'è: le risposte che arrivano dopo che è sparita non toccano più niente. */
function useAlive(): () => boolean {
  const on = useRef(true);
  useEffect(() => {
    on.current = true;
    return () => {
      on.current = false;
    };
  }, []);
  return useCallback(() => on.current, []);
}

type Plan = { kind: 'report' | 'book'; q: number };
type Estimate =
  { state: 'loading' } | { state: 'ready'; reply: DiaryAiReply } | { state: 'failed' };

/**
 * Creare con l'IA i resoconti dei trimestri e i libri (come «Approfondimenti del diario» sul sito): ogni trimestre dice
 * quanto è stato scritto; se basta, si può creare. Prima si vede quanto costa e si conferma; poi l'IA scrive (un libro
 * a pezzi, salvando a ogni pezzo: se si interrompe si riprende). Serve rete.
 */
export function AiMaker({
  d,
  data,
  list,
  api,
  onChanged,
  onOpen,
}: {
  d: DiaryTheme;
  data: Insights;
  list: AiList | null;
  api: AiRunner;
  /** è stato scritto qualcosa di nuovo: ricarica l'elenco */
  onChanged: () => void;
  onOpen: (kind: 'report' | 'book', id: number) => void;
}) {
  const { t } = useTranslation();
  const th = useTheme();
  const ht = habitsTheme(th.scheme, th.brand, th.style);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [estimate, setEstimate] = useState<Estimate>({ state: 'loading' });
  const [join, setJoin] = useState(0);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<BookProgress | null>(null);
  const [failed, setFailed] = useState<MakeResult | null>(null);
  const alive = useAlive();

  const qs = quarters(data, data.today).filter((x) => x.started);
  const doneBooks = (list?.books ?? []).filter((b) => b.done);
  const openBooks = (list?.books ?? []).filter((b) => !b.done);

  const ask = (next: Plan, joinId: number) => {
    setEstimate({ state: 'loading' });
    api
      .run({
        azione: 'stima',
        anno: data.year,
        q: next.q,
        per: next.kind === 'report' ? 'resoconto' : 'libro',
        ...(joinId ? { unisci: joinId } : {}),
      })
      .then((reply) => alive() && setEstimate({ state: 'ready', reply }))
      .catch(() => alive() && setEstimate({ state: 'failed' }));
  };

  const open = (next: Plan) => {
    setPlan(next);
    setJoin(0);
    setFailed(null);
    setProgress(null);
    ask(next, 0);
  };

  const close = () => {
    if (working) return;
    setPlan(null);
  };

  const finish = (r: MakeResult) => {
    if (!alive()) return;
    setWorking(false);
    if (r.ok) {
      setPlan(null);
      onChanged();
      onOpen(r.kind, r.id);
    } else {
      setFailed(r);
      if (r.bookId || (r.reply && r.reply.ok === false && r.reply.error !== 'limite_piano'))
        onChanged();
    }
  };

  const write = async (bookId?: number) => {
    if (!plan) return;
    setWorking(true);
    setFailed(null);
    setProgress(null);
    const p = (x: BookProgress) => alive() && setProgress((old) => ({ ...old, ...x }));
    finish(
      plan.kind === 'report'
        ? await makeReport(api, data.year, plan.q)
        : await makeBook(
            api,
            { year: data.year, q: plan.q, join: join || undefined, bookId },
            p,
            () => !alive(),
          ),
    );
  };

  /** Riprendere un libro lasciato a metà (dall'elenco, senza passare dalla conferma). */
  const resume = async (id: number, from: string) => {
    setPlan({ kind: 'book', q: 0 });
    setFailed(null);
    setProgress(null);
    setWorking(true);
    const year = Number(from.slice(0, 4)) || data.year;
    finish(
      await makeBook(
        api,
        { year, q: 1, bookId: id },
        (x) => alive() && setProgress((old) => ({ ...old, ...x })),
        () => !alive(),
      ),
    );
  };

  const button = (
    testID: string,
    label: string,
    onPress: () => void,
    primary = true,
    off = false,
  ) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={off}
      onPress={onPress}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        opacity: off ? 0.45 : 1,
        backgroundColor: primary ? d.accent : d.paper2,
      }}
    >
      <Text style={{ color: primary ? d.onAccent : d.ink, fontFamily: d.sans, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );

  const body = (): React.ReactNode => {
    if (!plan) return null;
    const note = (text: string, id?: string) => (
      <Text testID={id} style={{ color: ht.text2, fontSize: 14 }}>
        {text}
      </Text>
    );
    if (working) {
      const title = progress?.title;
      return (
        <View testID="aim-working" style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
          <ActivityIndicator color={th.brand} />
          <Text style={{ color: ht.text, textAlign: 'center' }}>
            {plan.kind === 'report'
              ? t('diario.dn_scrivo_resoconto')
              : progress && progress.total > 0 && progress.chapter
                ? t('diario.dn_scritto_capitolo', {
                    n: progress.done,
                    tot: progress.total,
                    titolo: progress.chapter,
                  })
                : title
                  ? t('diario.dn_scrivo_libro', { titolo: title })
                  : t('diario.dn_scrivo_piano')}
          </Text>
        </View>
      );
    }
    if (failed && !failed.ok) {
      const f = failed.reply
        ? failure(failed.reply)
        : { key: 'comune.errore_rete', vars: {}, retry: true };
      return (
        <View testID="aim-failed" style={{ gap: 12 }}>
          <Text style={{ color: ht.text, fontWeight: '700' }}>{t('diario.dn_ops')}</Text>
          {note(t(f.key, f.vars))}
          {f.retry
            ? button('aim-retry', t('diario.dn_riprova'), () => void write(failed.bookId))
            : null}
        </View>
      );
    }
    const reply = estimate.state === 'ready' ? estimate.reply : null;
    const enough = reply?.ok && reply.sufficiente !== false;
    return (
      <View style={{ gap: 14 }}>
        {note(
          t(plan.kind === 'report' ? 'diario.dn_conferma_resoconto' : 'diario.dn_conferma_libro'),
        )}
        {note(t('diario.dn_privacy'))}
        {plan.kind === 'book' && doneBooks.length ? (
          <View style={{ gap: 6 }}>
            {doneBooks.map((b) => (
              <Pressable
                key={b.id}
                testID={`aim-join-${b.id}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: join === b.id }}
                onPress={() => {
                  const next = join === b.id ? 0 : b.id;
                  setJoin(next);
                  ask(plan, next);
                }}
              >
                <Text style={{ color: join === b.id ? th.brand : ht.text, fontWeight: '600' }}>
                  {join === b.id ? '☑ ' : '☐ '}
                  {t('diario.dn_unisci', { titolo: b.title || t('diario.dn_libro_senza_titolo') })}
                </Text>
              </Pressable>
            ))}
            {join ? note(t('diario.dn_unisci_nota')) : null}
          </View>
        ) : null}
        <Text testID="aim-cost" style={{ color: ht.text, fontWeight: '600' }}>
          {estimate.state === 'loading'
            ? t('diario.dn_calcolo_costo')
            : !reply || !reply.ok
              ? t('comune.errore_rete')
              : reply.sufficiente === false
                ? t('diario.dn_err_crediti', {
                    stima: reply.stima ?? 0,
                    disp: reply.disponibili ?? 0,
                  })
                : reply.disponibili == null
                  ? t('diario.dn_costo', { n: reply.stima ?? 0 })
                  : t('diario.dn_costo_resto', { n: reply.stima ?? 0, disp: reply.disponibili })}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {button('aim-create', t('diario.dn_crea'), () => void write(), true, !enough)}
          {button('aim-cancel', t('comune.annulla'), close, false)}
        </View>
      </View>
    );
  };

  return (
    <View testID="ai-maker" style={{ gap: 10, marginTop: 20 }}>
      <Text
        accessibilityRole="header"
        style={{ color: d.ink, fontFamily: d.serif, fontSize: 20, fontWeight: '700' }}
      >
        {t('diario.dn_ai_titolo')}
      </Text>
      <Text style={{ color: d.ink2, fontFamily: d.sans, fontSize: 13 }}>
        {t('diario.dn_ai_intro')}
      </Text>
      {qs.map((x) => {
        const done = reportOf(list, data.year, x.quarter);
        return (
          <View
            key={x.quarter}
            testID={`aim-q${x.quarter}`}
            style={{
              backgroundColor: d.card,
              borderColor: d.hair,
              borderWidth: 1,
              borderRadius: 12,
              padding: 14,
              gap: 8,
            }}
          >
            <Text style={{ color: d.ink, fontFamily: d.serif, fontSize: 17, fontWeight: '700' }}>
              {t('diario.dn_trimestre_n', { n: x.quarter })}
            </Text>
            <Text style={{ color: d.ink2, fontFamily: d.sans, fontSize: 13 }}>
              {t('diario.dn_q_giorni', { n: x.days, min: MIN_DAYS })} ·{' '}
              {t('diario.dn_q_parole', { n: x.words, min: MIN_WORDS })}
            </Text>
            {x.enough ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {done
                  ? button(`aim-read-${x.quarter}`, t('diario.dn_leggi_resoconto'), () =>
                      onOpen('report', done.id),
                    )
                  : null}
                {button(
                  `aim-report-${x.quarter}`,
                  t(done ? 'diario.dn_rifai_resoconto' : 'diario.dn_crea_resoconto'),
                  () => open({ kind: 'report', q: x.quarter }),
                  !done,
                )}
                {button(
                  `aim-book-${x.quarter}`,
                  t('diario.dn_crea_libro'),
                  () => open({ kind: 'book', q: x.quarter }),
                  false,
                )}
              </View>
            ) : (
              <Text
                testID={`aim-low-${x.quarter}`}
                style={{ color: d.ink3, fontFamily: d.sans, fontSize: 13 }}
              >
                {t('diario.dn_scrivi_ancora')}
              </Text>
            )}
          </View>
        );
      })}
      {openBooks.map((b) => (
        <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: d.ink, fontFamily: d.sans, flex: 1 }} numberOfLines={1}>
            {b.title || t('diario.dn_libro_senza_titolo')}
          </Text>
          {button(
            `aim-resume-${b.id}`,
            t('diario.dn_continua_scrittura'),
            () => void resume(b.id, b.from),
          )}
        </View>
      ))}
      <Sheet
        visible={plan !== null}
        th={ht}
        testID="aim-sheet"
        title={t(plan?.kind === 'book' ? 'diario.dn_crea_libro' : 'diario.dn_crea_resoconto')}
        onClose={close}
      >
        <ScrollView contentContainerStyle={{ padding: 20 }}>{body()}</ScrollView>
      </Sheet>
    </View>
  );
}
