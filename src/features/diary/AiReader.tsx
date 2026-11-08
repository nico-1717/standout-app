import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { paragraphs, trend, type AiBook, type AiReport } from './aiReading';
import type { DiaryTheme } from './diaryTheme';

/** «3 mar 2026» nella lingua scelta, dal `AAAA-MM-GG` (o `AAAA-MM-GG hh:mm:ss`) del server. */
export function niceDate(iso: string, lang: string, withYear = true): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  try {
    return new Date(y, m - 1, d).toLocaleDateString(lang, {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  } catch {
    return iso;
  }
}

const Paras = ({ d, text }: { d: DiaryTheme; text: string }) => (
  <>
    {paragraphs(text).map((p, i) => (
      <Text
        key={i}
        selectable
        style={{ color: d.ink, fontFamily: d.serif, fontSize: 17, lineHeight: 27 }}
      >
        {p}
      </Text>
    ))}
  </>
);

const H2 = ({ d, children }: { d: DiaryTheme; children: string }) => (
  <Text
    accessibilityRole="header"
    style={{ color: d.ink, fontFamily: d.serif, fontSize: 22, fontWeight: '700', marginTop: 10 }}
  >
    {children}
  </Text>
);

/** Un resoconto trimestrale da leggere: una colonna, un solo carattere grande (come `diario_lettura.php`). */
export function ReportReader({ d, report }: { d: DiaryTheme; report: AiReport }) {
  const { t, i18n } = useTranslation();
  const c = report.content;
  const now = report.numbers.ora ?? {};
  const before = report.numbers.prima ?? {};
  const one = (v: number | null | undefined) =>
    v == null
      ? '–'
      : v.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nums: { id: string; value: string; label: string }[] = [
    { id: 'written', value: String(now.scritti ?? 0), label: t('diario.dn_giorni_scritti') },
    {
      id: 'mood',
      value: one(now.umore) + trend(now.umore, before.umore),
      label: t('diario.dn_umore_medio'),
    },
    {
      id: 'energy',
      value: one(now.energia) + trend(now.energia, before.energia),
      label: t('diario.dn_energia_media'),
    },
    {
      id: 'habits',
      value:
        (now.abitudini_pct == null ? '–' : `${now.abitudini_pct}%`) +
        trend(now.abitudini_pct, before.abitudini_pct),
      label: t('diario.dn_abitudini_fatte'),
    },
    {
      id: 'pomodoros',
      value: String(now.pomodori ?? 0) + trend(now.pomodori, before.pomodori),
      label: t('diario.dn_pomodori'),
    },
  ];
  return (
    <View testID="report-reader" style={{ gap: 14 }}>
      <Text style={{ color: d.ink3, fontFamily: d.sans, fontSize: 13 }}>
        {t('diario.dn_resoconto_di', { q: report.quarter, anno: report.year })} ·{' '}
        {niceDate(report.from, i18n.language, false)} – {niceDate(report.to, i18n.language)}
      </Text>
      <Text
        accessibilityRole="header"
        style={{
          color: d.ink,
          fontFamily: d.serif,
          fontSize: 30,
          fontWeight: '700',
          lineHeight: 36,
        }}
      >
        {c.titolo ?? ''}
      </Text>
      {c.in_breve ? <Paras d={d} text={c.in_breve} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {nums.map((n) => (
          <View
            key={n.id}
            style={{
              minWidth: '30%',
              flexGrow: 1,
              backgroundColor: d.card,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: d.hair,
            }}
          >
            <Text
              testID={`report-num-${n.id}`}
              style={{ color: d.ink, fontSize: 22, fontWeight: '700' }}
            >
              {n.value}
            </Text>
            <Text style={{ color: d.ink2, fontFamily: d.sans, fontSize: 12 }}>{n.label}</Text>
          </View>
        ))}
      </View>

      {c.pensieri?.length ? (
        <>
          <H2 d={d}>{t('diario.dn_i_tuoi_pensieri')}</H2>
          {c.pensieri.map((p, i) => (
            <View
              key={i}
              style={{ borderLeftWidth: 3, borderLeftColor: d.accent, paddingLeft: 12 }}
            >
              <Text
                selectable
                style={{
                  color: d.ink2,
                  fontFamily: d.serif,
                  fontSize: 17,
                  lineHeight: 26,
                  fontStyle: 'italic',
                }}
              >
                {p}
              </Text>
            </View>
          ))}
        </>
      ) : null}

      {c.sentimenti?.length ? (
        <>
          <H2 d={d}>{t('diario.dn_come_ti_sei_sentito')}</H2>
          {c.sentimenti.map((p, i) => (
            <Paras key={i} d={d} text={p} />
          ))}
        </>
      ) : null}

      {c.alti?.length ? (
        <>
          <H2 d={d}>{t('diario.dn_momenti_alti')}</H2>
          {c.alti.map((x, i) => (
            <Text
              key={i}
              selectable
              style={{ color: d.ink, fontFamily: d.serif, fontSize: 17, lineHeight: 26 }}
            >
              • {x}
            </Text>
          ))}
        </>
      ) : null}
      {c.bassi?.length ? (
        <>
          <H2 d={d}>{t('diario.dn_momenti_bassi')}</H2>
          {c.bassi.map((x, i) => (
            <Text
              key={i}
              selectable
              style={{ color: d.ink, fontFamily: d.serif, fontSize: 17, lineHeight: 26 }}
            >
              • {x}
            </Text>
          ))}
        </>
      ) : null}

      {c.temi?.length ? (
        <>
          <H2 d={d}>{t('diario.dn_temi')}</H2>
          {c.temi.map((tm, i) => (
            <View key={i} style={{ gap: 6 }}>
              <Text style={{ color: d.ink, fontFamily: d.serif, fontSize: 18, fontWeight: '700' }}>
                {tm.tema ?? ''}
              </Text>
              <Paras d={d} text={tm.testo ?? ''} />
            </View>
          ))}
        </>
      ) : null}

      {c.abitudini || report.numbers.abitudini?.length ? (
        <>
          <H2 d={d}>{t('diario.dn_abitudini')}</H2>
          {c.abitudini ? <Paras d={d} text={c.abitudini} /> : null}
          {report.numbers.abitudini?.map((h, i) => (
            <View key={i} testID={`report-habit-${i}`} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ flex: 1, color: d.ink, fontFamily: d.sans }}>{h.nome}</Text>
              <Text style={{ color: d.ink2, fontFamily: d.sans }}>
                {h.fatte}/{h.obiettivo} · {t('diario.dn_tab_prima')}: {h.fatte_prima}/
                {h.obiettivo_prima}
              </Text>
            </View>
          ))}
        </>
      ) : null}

      {c.concentrazione ? (
        <>
          <H2 d={d}>{t('diario.dn_concentrazione_t')}</H2>
          <Paras d={d} text={c.concentrazione} />
        </>
      ) : null}

      {c.spunti?.length ? (
        <>
          <H2 d={d}>{t('diario.dn_per_il_prossimo')}</H2>
          {c.spunti.map((x, i) => (
            <Text
              key={i}
              selectable
              style={{ color: d.ink, fontFamily: d.serif, fontSize: 17, lineHeight: 26 }}
            >
              • {x}
            </Text>
          ))}
        </>
      ) : null}

      <Text style={{ color: d.ink3, fontFamily: d.sans, fontSize: 12, marginTop: 10 }}>
        {t('diario.dn_scritto_da_ia', { data: niceDate(report.created_at, i18n.language) })}
      </Text>
    </View>
  );
}

/** Un libro da leggere: copertina, indice (tocca per saltare al capitolo) e i capitoli. */
export function BookReader({
  d,
  book,
  onJump,
  onChapterLayout,
}: {
  d: DiaryTheme;
  book: AiBook;
  onJump: (index: number) => void;
  onChapterLayout: (index: number, y: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const month = (iso: string) => {
    const [y, m] = iso.split('-').map(Number);
    try {
      return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString(i18n.language, {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };
  return (
    <View testID="book-reader" style={{ gap: 14 }}>
      <Text style={{ color: d.ink3, fontFamily: d.sans, fontSize: 13 }}>
        {month(book.from)} – {month(book.to)}
      </Text>
      <Text
        accessibilityRole="header"
        style={{
          color: d.ink,
          fontFamily: d.serif,
          fontSize: 34,
          fontWeight: '700',
          lineHeight: 40,
        }}
      >
        {book.title || t('diario.dn_libro_senza_titolo')}
      </Text>
      {!book.done ? (
        <Text testID="book-unfinished" style={{ color: d.ink2, fontFamily: d.sans }}>
          {t('diario.dn_libro_incompleto')}
        </Text>
      ) : null}
      <H2 d={d}>{t('diario.dn_indice')}</H2>
      {book.chapters.map((c, i) => (
        <Text
          key={i}
          testID={`book-toc-${i}`}
          accessibilityRole="button"
          onPress={() => onJump(i)}
          style={{ color: d.accent, fontFamily: d.sans, fontSize: 16, paddingVertical: 4 }}
        >
          {i + 1}. {c.title}
        </Text>
      ))}
      {book.chapters.map((c, i) => (
        <View
          key={i}
          testID={`book-chapter-${i}`}
          onLayout={(e) => onChapterLayout(i, e.nativeEvent.layout.y)}
          style={{ gap: 10, marginTop: 18 }}
        >
          <Text
            style={{ color: d.ink3, fontFamily: d.sans, fontSize: 12, textTransform: 'uppercase' }}
          >
            {t('diario.dn_capitolo_n', { n: i + 1 })}
          </Text>
          <Text
            accessibilityRole="header"
            style={{ color: d.ink, fontFamily: d.serif, fontSize: 24, fontWeight: '700' }}
          >
            {c.title}
          </Text>
          <Paras d={d} text={c.text} />
        </View>
      ))}
      <Text style={{ color: d.ink3, fontFamily: d.sans, fontSize: 12, marginTop: 14 }}>
        {t('diario.dn_libro_nota')}
      </Text>
    </View>
  );
}
