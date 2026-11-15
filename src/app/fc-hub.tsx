import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';
import { LearnedCard } from '@/features/flashcards/LearnedCard';
import { hubSummary, type HubCourse } from '@/features/flashcards/hub';
import type { OpenGame } from '@/features/flashcards/homeCards';
import { HoIcon, hoTheme, type Ho, type HoIconName } from '@/features/home/HomeKit';
import { localToday } from '@/features/tasks/groups';
import { Avatar } from '@/ui/Avatar';

/** La pagina principale delle flashcard (fc_home.php): le due strade (studio, lingue) e la giornata. */
function PillButton({
  ho,
  tone,
  icon,
  label,
  onPress,
  testID,
}: {
  ho: Ho;
  tone: 'play' | 'plain';
  icon: HoIconName;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const color = tone === 'play' ? '#FFFFFF' : ho.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 13,
        borderRadius: 999,
        backgroundColor: tone === 'play' ? 'transparent' : ho.surface2,
        boxShadow: tone === 'play' ? undefined : `inset 0 0 0 0.5px ${ho.hair}`,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <HoIcon name={icon} size={14} color={color} sw={icon === 'plus' ? 2.6 : 2} />
      <Text style={{ color, fontSize: 13.5, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Resume({
  ho,
  accent,
  game,
  label,
  onPress,
  testID,
}: {
  ho: Ho;
  accent: string;
  game: OpenGame;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const pct = Math.round((game.closed / Math.max(1, game.total)) * 100);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 16,
        backgroundColor: ho.surface2,
        marginBottom: 12,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color: ho.text, fontWeight: '800' }}>{t('fchub.partita_in_corso')}</Text>
        <Text style={{ color: ho.text2, fontSize: 13 }} numberOfLines={1}>
          {game.label ? `${game.label} · ` : ''}
          {t('fchub.carte_fatte', { n: game.closed, tot: game.total })}
        </Text>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: ho.hair, marginTop: 4 }}>
          <View style={{ width: `${pct}%`, height: 5, borderRadius: 3, backgroundColor: accent }} />
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 13,
          borderRadius: 999,
          backgroundColor: accent,
        }}
      >
        <HoIcon name="play" size={14} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '700' }}>{label}</Text>
      </View>
    </Pressable>
  );
}

function CourseRow({
  ho,
  c,
  onOpen,
  onPlay,
  onNew,
  onResume,
}: {
  ho: Ho;
  c: HubCourse;
  onOpen: () => void;
  onPlay: () => void;
  onNew: () => void;
  onResume: (g: OpenGame) => void;
}) {
  const { t } = useTranslation();
  return (
    <View
      testID={`hub-course-${c.uuid}`}
      style={{ borderRadius: 18, backgroundColor: ho.surface2, padding: 12, gap: 12 }}
    >
      <Pressable
        accessibilityRole="button"
        testID={`hub-course-open-${c.uuid}`}
        onPress={onOpen}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Text style={{ fontSize: 34 }}>{c.flag}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: ho.text, fontSize: 17, fontWeight: '800' }}>{c.name}</Text>
          <Text style={{ color: ho.text2, fontSize: 13 }}>
            {c.words} {t(c.words === 1 ? 'fchub.parola' : 'fchub.parole')} · {c.pct}%{' '}
            {t('fchub.imparate')}
          </Text>
        </View>
        <HoIcon name="right" size={18} color={ho.text3} sw={2.4} />
      </Pressable>
      {c.open ? (
        <Resume
          ho={ho}
          accent={ho.orange}
          game={c.open}
          label={t('fchub.continua')}
          testID={`hub-course-resume-${c.uuid}`}
          onPress={() => onResume(c.open!)}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {c.words > 0 ? (
          <>
            <View
              style={{
                borderRadius: 999,
                backgroundColor: c.open ? ho.surface : ho.orange,
              }}
            >
              <PillButton
                ho={ho}
                tone={c.open ? 'plain' : 'play'}
                icon="play"
                label={t('fchub.gioca')}
                testID={`hub-course-play-${c.uuid}`}
                onPress={onPlay}
              />
            </View>
            <PillButton
              ho={ho}
              tone="plain"
              icon="plus"
              label={t('fchub.nuova_carta')}
              onPress={onNew}
            />
          </>
        ) : (
          <View style={{ borderRadius: 999, backgroundColor: ho.orange }}>
            <PillButton
              ho={ho}
              tone="play"
              icon="plus"
              label={t('fchub.primo_mazzo')}
              onPress={onOpen}
            />
          </View>
        )}
      </View>
    </View>
  );
}

export default function FlashcardsHub() {
  const th = useTheme();
  const ho = hoTheme(th);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services, version, authState } = useApp();
  const userName = authState.status === 'signedIn' ? authState.user.username : '';
  const today = localToday();
  const hub = useMemo(() => {
    void version;
    return services ? hubSummary(services, today, i18n.language === 'en' ? 'en' : 'it') : null;
  }, [services, version, today, i18n.language]);
  if (!services || !hub) return null;

  const resume = (g: OpenGame) =>
    router.push({ pathname: '/fc-game', params: { game: g.game, position: String(g.position) } });
  const pctToday = Math.min(100, Math.round((hub.today / Math.max(1, hub.goal)) * 100));
  const r = 46;
  const circ = 2 * Math.PI * r;
  const maxWeek = Math.max(1, ...hub.numbers.week.map((w) => w.n));
  const letters = ['g_lun', 'g_mar', 'g_mer', 'g_gio', 'g_ven', 'g_sab', 'g_dom'];
  const card = {
    borderRadius: 26,
    backgroundColor: ho.surface,
    boxShadow: ho.shadow,
    padding: 16,
    overflow: 'hidden' as const,
  };
  const veil = (c: string) => (
    <LinearGradient
      pointerEvents="none"
      colors={[c, 'rgba(0,0,0,0)']}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110 }}
    />
  );
  const tile = (c: string, icon: HoIconName) => (
    <View
      style={{
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c,
        boxShadow: `0 8px 20px -8px ${c}`,
      }}
    >
      <HoIcon name={icon} size={27} color="#fff" sw={1.9} />
    </View>
  );
  const stats = (a: [number | string, string][]) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {a.map(([n, l]) => (
        <Text key={l} style={{ color: ho.text2, fontSize: 13, fontWeight: '500' }}>
          <Text style={{ color: ho.text, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
            {n}
          </Text>{' '}
          {l}
        </Text>
      ))}
    </View>
  );
  const bar = (p: number, c: string) => (
    <View
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: ho.surface2,
        marginTop: 10,
        marginBottom: 14,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: `${p}%`, height: 6, borderRadius: 3, backgroundColor: c }} />
    </View>
  );
  const phrase = t(hub.phrase.key, { n: hub.phrase.n });

  return (
    <View testID="fc-hub" style={{ flex: 1, backgroundColor: ho.bg }}>
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 10,
          paddingHorizontal: 16,
          backgroundColor: th.headerGlass,
          borderBottomWidth: 0.5,
          borderBottomColor: ho.hair,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            accessibilityRole="header"
            style={{ color: ho.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.42 }}
          >
            {t('fchub.home_titolo')}
          </Text>
          <Text
            testID="hub-phrase"
            numberOfLines={1}
            style={{ color: ho.text2, fontSize: 13, fontWeight: '500', marginTop: 2 }}
          >
            {phrase}
          </Text>
        </View>
        <Pressable
          testID="hub-stats"
          accessibilityRole="button"
          accessibilityLabel={t('fchub.statistiche')}
          onPress={() => router.push('/fc-stats')}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: ho.surface2,
            boxShadow: `inset 0 0 0 0.5px ${ho.hair}`,
          }}
        >
          <HoIcon name="chart" size={20} color={ho.blue} sw={2.1} />
        </Pressable>
        <Avatar
          letter={(userName[0] ?? '?').toUpperCase()}
          label={t('app.account')}
          onPress={() => router.push('/account')}
          testID="hub-avatar"
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}>
        <View testID="hub-study" style={card}>
          {veil(ho.blueSoft)}
          <Pressable
            accessibilityRole="button"
            testID="hub-study-open"
            onPress={() => router.push('/flashcards')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingBottom: 12 }}
          >
            {tile(ho.blue, 'cap')}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ color: ho.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.4 }}
              >
                {t('fchub.studio')}
              </Text>
              <Text
                style={{ color: ho.text2, fontSize: 13.5, fontWeight: '500' }}
                numberOfLines={1}
              >
                {t('fchub.studio_sub')}
              </Text>
            </View>
            <HoIcon name="right" size={18} color={ho.text3} sw={2.4} />
          </Pressable>
          {stats([
            [hub.study.decks, t(hub.study.decks === 1 ? 'fchub.mazzo' : 'fchub.mazzi')],
            [hub.study.cards, t(hub.study.cards === 1 ? 'fchub.carta' : 'fchub.carte')],
            [`${hub.study.pct}%`, t('fchub.imparate')],
          ])}
          {bar(hub.study.pct, ho.blue)}
          {hub.study.open ? (
            <Resume
              ho={ho}
              accent={ho.blue}
              game={hub.study.open}
              label={t('fchub.continua')}
              testID="hub-study-resume"
              onPress={() => resume(hub.study.open!)}
            />
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View
              style={{ borderRadius: 999, backgroundColor: hub.study.open ? ho.surface2 : ho.blue }}
            >
              <PillButton
                ho={ho}
                tone={hub.study.open ? 'plain' : 'play'}
                icon="play"
                label={t('fchub.gioca')}
                testID="hub-study-play"
                onPress={() => router.push('/fc-history')}
              />
            </View>
            <PillButton
              ho={ho}
              tone="plain"
              icon="plus"
              label={t('fchub.nuova_carta')}
              testID="hub-study-new"
              onPress={() => router.push('/fc-insert')}
            />
          </View>
        </View>

        <View testID="hub-vocab" style={card}>
          {veil(ho.orangeSoft)}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingBottom: 12 }}>
            {hub.courses.length ? (
              <View style={{ flexDirection: 'row', paddingRight: 4 }}>
                {hub.courses.slice(0, 3).map((c, i) => (
                  <Text key={c.uuid} style={{ fontSize: 38, marginLeft: i ? -14 : 0 }}>
                    {c.flag}
                  </Text>
                ))}
              </View>
            ) : (
              tile(ho.orange, 'globe')
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ color: ho.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.4 }}
              >
                {t('fchub.lingue')}
              </Text>
              <Text
                style={{ color: ho.text2, fontSize: 13.5, fontWeight: '500' }}
                numberOfLines={1}
              >
                {hub.courses.length
                  ? hub.courses
                      .slice(0, 3)
                      .map((c) => c.name)
                      .join(', ') + (hub.courses.length > 3 ? ` +${hub.courses.length - 3}` : '')
                  : t('fchub.lingue_sub_vuoto')}
              </Text>
            </View>
          </View>
          {hub.courses.length ? (
            <>
              {stats([
                [
                  hub.courses.length,
                  t(hub.courses.length === 1 ? 'fchub.lingua' : 'fchub.lingue_min'),
                ],
                [hub.vocab.words, t(hub.vocab.words === 1 ? 'fchub.parola' : 'fchub.parole')],
                [
                  `${hub.vocab.words ? Math.round((hub.vocab.known / hub.vocab.words) * 100) : 0}%`,
                  t('fchub.imparate'),
                ],
              ])}
              {bar(
                hub.vocab.words ? Math.round((hub.vocab.known / hub.vocab.words) * 100) : 0,
                ho.orange,
              )}
              <View style={{ gap: 12 }}>
                {hub.courses.map((c) => (
                  <CourseRow
                    key={c.uuid}
                    ho={ho}
                    c={c}
                    onOpen={() => router.push({ pathname: '/lang-course', params: { id: c.uuid } })}
                    onPlay={() =>
                      router.push({ pathname: '/fc-history', params: { course: c.uuid } })
                    }
                    onNew={() => router.push('/languages')}
                    onResume={resume}
                  />
                ))}
              </View>
            </>
          ) : null}
          <View style={{ flexDirection: 'row', marginTop: hub.courses.length ? 12 : 0 }}>
            <View
              style={{
                borderRadius: 999,
                backgroundColor: hub.courses.length ? ho.surface2 : ho.orange,
              }}
            >
              <PillButton
                ho={ho}
                tone={hub.courses.length ? 'plain' : 'play'}
                icon="plus"
                label={t('fchub.aggiungi_lingua')}
                testID="hub-add-language"
                onPress={() => router.push('/languages')}
              />
            </View>
          </View>
        </View>

        <View testID="hub-today" style={{ ...card, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <Pressable
              testID="hub-goal"
              accessibilityRole="button"
              accessibilityLabel={t('fchub.cambia_obiettivo')}
              onPress={() => router.push('/fc-stats')}
              style={{ width: 112, height: 112, alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{ position: 'absolute', top: 0, left: 0 }}>
                <Svg width={112} height={112} viewBox="0 0 108 108">
                  <Circle cx={54} cy={54} r={r} fill="none" stroke={ho.surface2} strokeWidth={10} />
                  <Circle
                    cx={54}
                    cy={54}
                    r={r}
                    fill="none"
                    stroke={pctToday >= 100 ? ho.green : ho.blue}
                    strokeWidth={10}
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - pctToday / 100)}
                    transform="rotate(-90 54 54)"
                  />
                </Svg>
              </View>
              <Text
                testID="hub-today-n"
                style={{
                  color: ho.text,
                  fontSize: 30,
                  lineHeight: 30,
                  fontWeight: '800',
                  letterSpacing: -0.9,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {hub.today}
              </Text>
              <Text style={{ color: ho.text2, fontSize: 12, fontWeight: '600', marginTop: 3 }}>
                {t('fchub.su_n', { n: hub.goal })}
              </Text>
            </Pressable>
            <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: hub.numbers.streak > 0 ? ho.orangeSoft : ho.surface2,
                  }}
                >
                  <HoIcon
                    name="flame"
                    size={19}
                    color={hub.numbers.streak > 0 ? ho.orange : ho.text3}
                    sw={1.6}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: ho.text, fontSize: 20, fontWeight: '800' }}>
                    {hub.numbers.streak}
                  </Text>
                  <Text style={{ color: ho.text2, fontSize: 12.5 }}>
                    {t(hub.numbers.streak === 1 ? 'fchub.giorno_di_fila' : 'fchub.giorni_di_fila')}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: ho.greenSoft,
                  }}
                >
                  <HoIcon name="target" size={19} color={ho.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: ho.text, fontSize: 20, fontWeight: '800' }}>
                    {hub.numbers.accuracy}%
                  </Text>
                  <Text style={{ color: ho.text2, fontSize: 12.5 }}>
                    {t('fchub.precisione_30')}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              paddingTop: 12,
              borderTopWidth: 0.5,
              borderTopColor: ho.hair,
            }}
          >
            {hub.numbers.week.map((w) => {
              const dow = new Date(`${w.day}T12:00:00Z`).getUTCDay();
              const isToday = w.day === today;
              return (
                <View key={w.day} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <View
                    style={{
                      width: '100%',
                      maxWidth: 26,
                      height: 46,
                      borderRadius: 8,
                      backgroundColor: ho.surface2,
                      justifyContent: 'flex-end',
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      testID={`hub-week-${w.day}`}
                      style={{
                        height: `${Math.round((w.n / maxWeek) * 100)}%`,
                        borderRadius: 8,
                        backgroundColor: ho.blue,
                        opacity: isToday ? 1 : 0.55,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      color: isToday ? ho.blue : ho.text3,
                      fontSize: 11,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t(`dashboard.${letters[(dow + 6) % 7]}`)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <LearnedCard
          db={services.db}
          today={today}
          lang={i18n.language}
          study={hub.study.known}
          vocab={hub.courses.length ? hub.vocab.known : null}
        />
      </ScrollView>
    </View>
  );
}
