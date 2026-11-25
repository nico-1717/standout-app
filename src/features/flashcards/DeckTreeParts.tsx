import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useTheme } from '@/core/theme/ThemeProvider';
import { HoIcon, hoTheme, hoTitle, type Ho } from '@/features/home/HomeKit';

import { DeckIcon } from './DeckIcon';
import { LEVEL_COLORS, LEVELS, type Level } from './levels';

/**
 * I pezzi che le categorie di studio (flashcards.tsx) e le categorie di un corso di lingua (lang-course.tsx) hanno
 * in comune: sono la stessa pagina del sito (fc_decks.php), una in modalità studio e una in modalità vocabolario.
 */

/** I tastini quadrati accanto alla barra (`.tool-btn` del sito): 38 px, accesi in blu quando sono attivi. */
export function toolButton(ho: Ho, on: boolean) {
  return {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: on ? ho.blue : ho.surface2,
    borderWidth: 0.5,
    borderColor: on ? ho.blue : ho.hair,
  } as const;
}

/** Ogni materia (radice) è una carta sua, con dentro i suoi rami: raggruppa l'elenco piatto per radice. */
export function groupByRoot<T extends { depth: number }>(rows: readonly T[]): T[][] {
  return rows.reduce<T[][]>((acc, r) => {
    const last = acc.at(-1);
    if (r.depth === 0 || !last) acc.push([r]);
    else last.push(r);
    return acc;
  }, []);
}

/** L'intestazione: indietro, titolo con sottotitolo, il tondo «gioca» e la ricerca. */
export function TreeHeader({
  top,
  title,
  subtitle,
  titleLead,
  onBack,
  backTestID,
  backLabel,
  play,
  search,
}: {
  top: number;
  title: string;
  subtitle: string;
  /** una bandiera o simile davanti al titolo */
  titleLead?: string;
  onBack: () => void;
  backTestID: string;
  backLabel: string;
  play: {
    testID: string;
    label: string;
    onPress: () => void;
    colors: readonly [string, string];
    disabled?: boolean;
  };
  search: { testID: string; value: string; onChange: (v: string) => void; placeholder: string };
}) {
  const th = useTheme();
  const ho = hoTheme(th);
  return (
    <View
      style={{
        // la pagina è un foglio: l'area sicura in alto è già in parte coperta, non va contata due volte
        paddingTop: Math.max(top - 20, 12),
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: th.headerGlass,
        borderBottomWidth: 0.5,
        borderBottomColor: th.hairline,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          testID={backTestID}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={onBack}
          hitSlop={8}
          style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
        >
          <HoIcon name="back" color={ho.blue} size={26} sw={2.4} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[{ color: ho.text }, hoTitle(ho, 24)]}
          >
            {titleLead ? `${titleLead} ` : ''}
            {title}
          </Text>
          <Text numberOfLines={1} style={{ color: ho.text2, fontSize: 15, marginTop: 1 }}>
            {subtitle}
          </Text>
        </View>
        <Pressable
          testID={play.testID}
          accessibilityRole="button"
          accessibilityLabel={play.label}
          accessibilityState={{ disabled: !!play.disabled }}
          disabled={play.disabled}
          onPress={play.onPress}
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            overflow: 'hidden',
            opacity: play.disabled ? 0.4 : 1,
          }}
        >
          <LinearGradient
            colors={play.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <HoIcon name="play" color="#FFFFFF" size={20} sw={2.2} />
          </LinearGradient>
        </Pressable>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: ho.surface2,
          borderRadius: 14,
          paddingHorizontal: 14,
        }}
      >
        <HoIcon name="search" color={ho.text3} size={20} />
        <TextInput
          testID={search.testID}
          value={search.value}
          onChangeText={search.onChange}
          placeholder={search.placeholder}
          placeholderTextColor={ho.text3}
          autoCorrect={false}
          style={{ flex: 1, paddingVertical: 12, color: ho.text, fontSize: 17 }}
        />
      </View>
    </View>
  );
}

/** La barra «Attive / Archiviate» (`.seg` del sito) e, a destra, i tastini quadrati (`tools`). */
export function ScopeBar({
  scope,
  counts,
  labels,
  testIDPrefix,
  onScope,
  tools,
}: {
  scope: 'active' | 'archived';
  counts: { active: number; archived: number };
  labels: { active: string; archived: string };
  testIDPrefix: string;
  onScope: (s: 'active' | 'archived') => void;
  tools?: ReactNode;
}) {
  const th = useTheme();
  const ho = hoTheme(th);
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          gap: 3,
          backgroundColor: ho.surface2,
          borderRadius: 12,
          padding: 3,
          borderWidth: 0.5,
          borderColor: ho.hair,
        }}
      >
        {(['active', 'archived'] as const).map((s) => (
          <Pressable
            key={s}
            testID={`${testIDPrefix}-scope-${s}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: scope === s }}
            onPress={() => onScope(s)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 7,
              borderRadius: 9,
              backgroundColor: scope === s ? ho.surface : 'transparent',
              boxShadow: scope === s ? '0 1px 3px rgba(0,0,0,.14)' : undefined,
            }}
          >
            <Text
              style={{
                color: scope === s ? ho.text : ho.text2,
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              {labels[s]}
            </Text>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 999,
                backgroundColor: scope === s ? ho.blueSoft : ho.hair,
              }}
            >
              <Text
                style={{
                  color: scope === s ? ho.blueInk : ho.text2,
                  fontSize: 11,
                  fontWeight: '800',
                }}
              >
                {counts[s]}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      {tools}
    </View>
  );
}

/**
 * Una riga dell'albero (`renderCatRow` del sito): freccia che gira, cartella piena del colore del mazzo, nome,
 * il numero in una pillola e il «+» per aggiungere una sottocategoria. Quello che sta sotto al nome (percorso,
 * esame, statistiche) arriva in `below`; il campo della nuova sottocategoria in `footer`.
 */
export function DeckRowShell({
  color,
  name,
  iconName,
  pinned,
  depth,
  root,
  hasChildren,
  open,
  archived,
  selecting,
  checked,
  ids,
  onToggle,
  onPress,
  badge,
  badgeLabel,
  addable,
  adding,
  onAdd,
  addLabel,
  below,
  beforeBadge,
  footer,
}: {
  color: string;
  name: string;
  iconName: string;
  pinned: boolean;
  depth: number;
  root: boolean;
  hasChildren: boolean;
  open: boolean;
  archived: boolean;
  selecting?: boolean;
  checked?: boolean;
  ids: { toggle: string; row: string; add: string };
  onToggle: () => void;
  onPress: () => void;
  badge: string;
  badgeLabel: string;
  addable: boolean;
  adding: boolean;
  onAdd: () => void;
  addLabel: string;
  below?: ReactNode;
  beforeBadge?: ReactNode;
  footer?: ReactNode;
}) {
  const th = useTheme();
  const ho = hoTheme(th);
  const box = root ? 40 : 34;
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: root ? 14 : 11,
          paddingRight: 12,
          paddingLeft: 4 + depth * 16,
        }}
      >
        <Pressable
          testID={ids.toggle}
          accessibilityRole="button"
          accessibilityState={hasChildren ? { expanded: open } : undefined}
          disabled={!hasChildren}
          hitSlop={8}
          onPress={onToggle}
          style={{ width: 24, height: 34, alignItems: 'center', justifyContent: 'center' }}
        >
          {hasChildren ? (
            <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
              <HoIcon name="right" color={open ? color : ho.text3} size={20} sw={2.6} />
            </View>
          ) : null}
        </Pressable>
        <Pressable
          testID={ids.row}
          accessibilityRole="button"
          onPress={onPress}
          accessibilityState={selecting ? { checked: !!checked } : undefined}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: selecting && checked ? th.brandSoft : undefined,
          }}
        >
          <View
            style={{
              width: box,
              height: box,
              borderRadius: root ? 12 : 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: color,
              opacity: archived ? 0.7 : 1,
            }}
          >
            <DeckIcon name={iconName} color="#FFFFFF" size={root ? 20 : 17} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: th.text,
                fontSize: root ? 17 : 15.5,
                fontWeight: root ? '800' : '600',
                letterSpacing: -0.2,
              }}
              numberOfLines={2}
            >
              {selecting ? (checked ? '☑ ' : '☐ ') : ''}
              {pinned ? '📌 ' : ''}
              {name}
            </Text>
            {below}
          </View>
          {beforeBadge}
          <View
            accessible
            accessibilityLabel={badgeLabel}
            style={{
              backgroundColor: th.surface2,
              borderRadius: 999,
              paddingHorizontal: 9,
              paddingVertical: 4,
              borderWidth: 0.5,
              borderColor: th.hairline,
            }}
          >
            <Text
              style={{
                color: th.text2,
                fontSize: 12,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
              }}
            >
              {badge}
            </Text>
          </View>
        </Pressable>
        {addable ? (
          <Pressable
            testID={ids.add}
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            hitSlop={6}
            onPress={onAdd}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: adding ? color + '26' : 'transparent',
            }}
          >
            <HoIcon name="plus" color={adding ? color : ho.text3} size={18} sw={2.4} />
          </Pressable>
        ) : null}
      </View>
      {footer}
    </View>
  );
}

/** Il campo «nuova sottocategoria» che si apre sotto una riga. */
export function SubDeckInput({
  testID,
  depth,
  value,
  onChange,
  placeholder,
  onSubmit,
}: {
  testID: string;
  depth: number;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSubmit: () => void;
}) {
  const th = useTheme();
  return (
    <View style={{ paddingLeft: 40 + depth * 16, paddingRight: 12, paddingBottom: 12 }}>
      <TextInput
        testID={testID}
        autoFocus
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={th.text3}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        style={{
          backgroundColor: th.surface2,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 9,
          color: th.text,
        }}
      />
    </View>
  );
}

/** Il campo e il tondo blu in fondo alla pagina per creare una categoria di primo livello. */
export function NewDeckBar({
  inputID,
  addID,
  value,
  onChange,
  placeholder,
  addLabel,
  onAdd,
}: {
  inputID: string;
  addID: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  addLabel: string;
  onAdd: () => void;
}) {
  const ho = hoTheme(useTheme());
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <TextInput
        testID={inputID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={ho.text3}
        returnKeyType="done"
        onSubmitEditing={onAdd}
        style={{
          flex: 1,
          backgroundColor: ho.surface,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 13,
          color: ho.text,
          fontSize: 17,
        }}
      />
      <Pressable
        testID={addID}
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        accessibilityState={{ disabled: !value.trim() }}
        disabled={!value.trim()}
        onPress={onAdd}
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: ho.blue,
          opacity: value.trim() ? 1 : 0.45,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 6px 16px ${ho.blueSoft}`,
        }}
      >
        <HoIcon name="plus" color="#FFFFFF" size={24} sw={2.4} />
      </Pressable>
    </View>
  );
}

/** La pagina vuota: la cartella grande, il titolo e due righe. */
export function EmptyTree({ title, text }: { title: string; text?: string }) {
  const ho = hoTheme(useTheme());
  return (
    <View style={{ paddingTop: 36, paddingBottom: 12, alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          backgroundColor: ho.blueSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
        }}
      >
        <HoIcon name="folder" color={ho.blue} size={30} />
      </View>
      <Text style={[{ color: ho.text }, hoTitle(ho, 22)]}>{title}</Text>
      {text ? (
        <Text style={{ color: ho.text2, textAlign: 'center', fontSize: 15, lineHeight: 21 }}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

/** Il tastino che passa da elenco a griglia (`.tool-btn-view` del sito): mostra la vista in cui si andrebbe. */
export function ViewToggle({
  view,
  onToggle,
  label,
  testID,
}: {
  view: 'list' | 'grid';
  onToggle: () => void;
  label: string;
  testID: string;
}) {
  const ho = hoTheme(useTheme());
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onToggle}
      style={toolButton(ho, view === 'grid')}
    >
      {view === 'list' ? (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Rect x={3.5} y={3.5} width={7} height={7} rx={2} stroke={ho.text2} strokeWidth={2.2} />
          <Rect x={13.5} y={3.5} width={7} height={7} rx={2} stroke={ho.text2} strokeWidth={2.2} />
          <Rect x={3.5} y={13.5} width={7} height={7} rx={2} stroke={ho.text2} strokeWidth={2.2} />
          <Rect x={13.5} y={13.5} width={7} height={7} rx={2} stroke={ho.text2} strokeWidth={2.2} />
        </Svg>
      ) : (
        <HoIcon name="list" color="#FFFFFF" size={19} />
      )}
    </Pressable>
  );
}

/** Una cartella della griglia: quello che serve a disegnarla, uguale per lo studio e per le lingue. */
export interface GridItem {
  id: string;
  name: string;
  color: string;
  iconName: string;
  pinned: boolean;
  cards: number;
  subs: number;
  games: number;
  /** i livelli delle carte (per la barretta in fondo) e la quota di quelle «che sai» */
  levels: Record<string, number> | null;
  knownPct: number;
  hard: number;
  /** l'esame, se c'è (un testo già pronto) */
  exam?: ReactNode;
}

const BAR_ORDER: Level[] = [...LEVELS.filter((l) => l !== 'nuova').reverse(), 'nuova'];

function GridCard({
  item,
  prefix,
  selecting,
  picked,
  openLabel,
  hardLabel,
  onCard,
  onOpen,
  onHard,
}: {
  item: GridItem;
  prefix: string;
  selecting: boolean;
  picked: boolean;
  openLabel: string;
  hardLabel: string;
  onCard: () => void;
  onOpen: () => void;
  onHard?: () => void;
}) {
  const th = useTheme();
  const ho = hoTheme(th);
  const lv = item.levels;
  const played = lv ? Object.values(lv).reduce((a, b) => a + b, 0) - (lv.nuova ?? 0) > 0 : false;
  return (
    <Pressable
      testID={`${prefix}-gcard-${item.id}`}
      accessibilityRole="button"
      accessibilityState={selecting ? { checked: picked } : undefined}
      onPress={onCard}
      style={({ pressed }) => ({
        width: '48.5%',
        backgroundColor: th.surface,
        borderRadius: 16,
        overflow: 'hidden',
        paddingTop: 18,
        paddingHorizontal: 14,
        paddingBottom: 12,
        borderWidth: picked ? 2.5 : 0,
        borderColor: ho.blue,
        boxShadow: th.cardShadow,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          backgroundColor: item.color,
        }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: item.color,
          }}
        >
          <DeckIcon name={item.iconName} color="#FFFFFF" size={16} />
          {item.hard >= 2 && onHard ? (
            <Pressable
              testID={`${prefix}-ghard-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={hardLabel}
              hitSlop={6}
              onPress={onHard}
              style={{
                position: 'absolute',
                top: -7,
                right: -9,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                paddingHorizontal: 4,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: th.red,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{item.hard}</Text>
            </Pressable>
          ) : null}
        </View>
        {selecting ? (
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: picked ? ho.blue : th.surface2,
            }}
          >
            {picked ? <HoIcon name="check" color="#FFFFFF" size={13} sw={3.2} /> : null}
          </View>
        ) : (
          <Pressable
            testID={`${prefix}-gopen-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={openLabel}
            hitSlop={6}
            onPress={onOpen}
            style={{
              width: 30,
              height: 30,
              marginTop: -8,
              marginRight: -8,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HoIcon name="right" color={ho.text3} size={17} sw={2.6} />
          </Pressable>
        )}
      </View>
      <Text
        numberOfLines={2}
        style={{
          color: th.text,
          fontSize: 14.5,
          fontWeight: '800',
          letterSpacing: -0.15,
          lineHeight: 19,
          minHeight: 38,
          marginBottom: 8,
        }}
      >
        {item.pinned ? '📌 ' : ''}
        {item.name}
      </Text>
      {item.exam}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <HoIcon name="cards" color={th.text2} size={12} sw={2.3} />
          <Text style={{ color: th.text2, fontSize: 11.5, fontWeight: '700' }}>{item.cards}</Text>
        </View>
        {item.subs > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <HoIcon name="folder" color={th.text2} size={12} sw={2.3} />
            <Text style={{ color: th.text2, fontSize: 11.5, fontWeight: '700' }}>{item.subs}</Text>
          </View>
        ) : null}
        {item.games > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <HoIcon name="play" color={th.text2} size={12} sw={2.4} />
            <Text style={{ color: th.text2, fontSize: 11.5, fontWeight: '700' }}>{item.games}</Text>
          </View>
        ) : null}
      </View>
      {lv && played ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              height: 5,
              borderRadius: 3,
              overflow: 'hidden',
              backgroundColor: th.surface2,
            }}
          >
            {BAR_ORDER.map((l) =>
              lv[l] ? (
                <View key={l} style={{ flex: lv[l], backgroundColor: LEVEL_COLORS[l] }} />
              ) : null,
            )}
          </View>
          {item.knownPct > 0 ? (
            <Text style={{ color: th.text2, fontSize: 11, fontWeight: '800' }}>
              {item.knownPct}%
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * La vista a griglia (`disegnaGriglia` del sito): le briciole di pane in alto, poi i riquadri della cartella in cui si
 * è. Toccare un riquadro che ha dentro altre cartelle scende di un livello; la freccia in alto a destra apre invece la
 * categoria vera e propria. Una cartella senza sottocartelle si apre subito.
 */
export function DeckGrid({
  items,
  crumbs,
  rootLabel,
  emptyText,
  prefix,
  selecting,
  picked,
  openLabel,
  hardLabel,
  onCrumb,
  onCard,
  onOpen,
  onHard,
}: {
  items: GridItem[];
  /** il percorso già percorso: i nomi delle cartelle in cui si è scesi */
  crumbs: string[];
  rootLabel: string;
  emptyText: string;
  prefix: string;
  selecting: boolean;
  picked: ReadonlySet<string>;
  openLabel: string;
  hardLabel: (n: number) => string;
  /** -1 = la radice */
  onCrumb: (index: number) => void;
  onCard: (id: string) => void;
  onOpen: (id: string) => void;
  onHard?: (id: string) => void;
}) {
  const th = useTheme();
  const ho = hoTheme(th);
  const names = [rootLabel, ...crumbs];
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
        {names.map((name, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {i > 0 ? <Text style={{ color: th.text3, fontSize: 13 }}>›</Text> : null}
            <Pressable
              testID={`${prefix}-crumb-${i - 1}`}
              accessibilityRole="button"
              onPress={() => onCrumb(i - 1)}
              style={{ paddingVertical: 3, paddingHorizontal: 6, borderRadius: 8 }}
            >
              <Text
                numberOfLines={1}
                style={{
                  maxWidth: 150,
                  fontSize: 12.5,
                  fontWeight: '700',
                  color: i === names.length - 1 ? ho.text : ho.text2,
                }}
              >
                {name}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
      {items.length ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: 10,
          }}
        >
          {items.map((it) => (
            <GridCard
              key={it.id}
              item={it}
              prefix={prefix}
              selecting={selecting}
              picked={picked.has(it.id)}
              openLabel={openLabel}
              hardLabel={hardLabel(it.hard)}
              onCard={() => onCard(it.id)}
              onOpen={() => onOpen(it.id)}
              onHard={onHard ? () => onHard(it.id) : undefined}
            />
          ))}
        </View>
      ) : (
        <Text style={{ color: th.text2, textAlign: 'center', padding: 36, fontSize: 14.5 }}>
          {emptyText}
        </Text>
      )}
    </View>
  );
}
