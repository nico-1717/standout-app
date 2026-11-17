import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import { DEFAULT_PROJECT_COLOR, type Project } from './logic';

type Theme = ReturnType<typeof useTheme>;
type Kids = Map<string | null, Project[]>;

const byOrder = (a: Project, b: Project) =>
  a.sort_key < b.sort_key ? -1 : a.sort_key > b.sort_key ? 1 : 0;

export function childrenIndex(all: Project[]): Kids {
  const kids: Kids = new Map();
  for (const p of all) kids.set(p.parent_uuid, [...(kids.get(p.parent_uuid) ?? []), p]);
  for (const list of kids.values()) list.sort(byOrder);
  return kids;
}

/** «Tesi › Capitolo 1»: gli antenati di un progetto, dal più lontano (come .ps-fav-path del sito). */
export function pathOf(all: Map<string, Project>, p: Project): string {
  const names: string[] = [];
  let cur = p.parent_uuid ? all.get(p.parent_uuid) : undefined;
  let guard = 0;
  while (cur && guard++ < 12) {
    names.unshift(cur.name);
    cur = cur.parent_uuid ? all.get(cur.parent_uuid) : undefined;
  }
  return names.join(' › ');
}

function Chevron({ color, open }: { color: string; open: boolean }) {
  return (
    <Svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
    >
      <Path
        d="m9 6 6 6-6 6"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Node(p: {
  project: Project;
  kids: Kids;
  open: ReadonlySet<string>;
  /** con una ricerca: i rami che portano a un risultato sono aperti e gli altri sono nascosti */
  keep: ReadonlySet<string> | null;
  onToggle: (uuid: string) => void;
  onPick: (uuid: string | null) => void;
  value: string | null;
  fav?: string;
  th: Theme;
}) {
  const { th, project } = p;
  if (p.keep && !p.keep.has(project.uuid)) return null;
  const list = p.kids.get(project.uuid) ?? [];
  const isOpen = p.keep ? true : p.open.has(project.uuid);
  const done = project.status === 'completed';
  const selected = p.value === project.uuid;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}>
        {list.length ? (
          <Pressable
            testID={`project-arrow-${project.uuid}`}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            onPress={() => p.onToggle(project.uuid)}
            style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
          >
            <Chevron color={th.text3} open={isOpen} />
          </Pressable>
        ) : (
          <View style={{ width: 34 }} />
        )}
        <View
          style={{
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: project.color || DEFAULT_PROJECT_COLOR,
          }}
        />
        <Pressable
          testID={`project-pick-${project.uuid}`}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          onPress={() => p.onPick(project.uuid)}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 11,
            paddingHorizontal: 8,
            borderRadius: 11,
            backgroundColor: pressed || selected ? th.surface2 : 'transparent',
          })}
        >
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontSize: 15,
              fontWeight: list.length ? '700' : '500',
              color: done ? th.text2 : th.text,
            }}
          >
            {project.name}
          </Text>
          {done ? <Text style={{ color: th.green, fontWeight: '700' }}>✓</Text> : null}
          {p.fav ? (
            <Text
              numberOfLines={1}
              style={{ flex: 1, textAlign: 'right', fontSize: 11, color: th.text3 }}
            >
              {p.fav}
            </Text>
          ) : null}
          {selected ? <Text style={{ color: th.brand, fontWeight: '800' }}>●</Text> : null}
        </Pressable>
      </View>
      {list.length && isOpen ? (
        <View
          style={{
            marginLeft: 26,
            paddingLeft: 6,
            borderLeftWidth: 1.5,
            borderLeftColor: th.hairline,
          }}
        >
          {list.map((c) => (
            <Node
              key={c.uuid}
              project={c}
              kids={p.kids}
              open={p.open}
              keep={p.keep}
              onToggle={p.onToggle}
              onPick={p.onPick}
              value={p.value}
              th={th}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Gli antenati di un progetto e lui stesso: i rami da aprire perché si veda (psExpandTo del sito, che apre anche i suoi figli). */
function branchTo(all: Map<string, Project>, uuid: string | null): Set<string> {
  const set = new Set<string>();
  let cur = uuid ? all.get(uuid) : undefined;
  let guard = 0;
  while (cur && guard++ < 50) {
    set.add(cur.uuid);
    cur = cur.parent_uuid ? all.get(cur.parent_uuid) : undefined;
  }
  return set;
}

/**
 * Il cuore del selettore di progetti del sito (project_selector.php), senza il foglio attorno: ricerca, «Nessun progetto»,
 * i preferiti con il loro percorso in piccolo, l'albero a rami chiusi con la freccina (aperto fino al progetto già scelto,
 * e ai suoi figli) e il tratteggiato «Nuovo progetto». Sta dentro un foglio (`ProjectSheet`) o in mezzo a una pagina
 * (`ProjectPicker`): per questo non conosce né l'uno né l'altra.
 */
export function ProjectTree(p: {
  projects: Project[];
  value: string | null;
  onPick: (uuid: string | null) => void;
  /** nome del tasto «nessuno» (default «Nessun progetto»); `false` lo toglie */
  noneLabel?: string | false;
  /** righe in più in cima (nei filtri: «tutti», «senza progetto»); `id` torna in `onPick` */
  extras?: { id: string; label: string }[];
  /** crea un progetto al volo e lo restituisce (null = non si può creare) */
  onCreate?: (name: string) => string | null;
  /** altezza massima dell'elenco (dentro una pagina); senza, l'elenco prende lo spazio che resta */
  maxHeight?: number;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const kids = useMemo(() => childrenIndex(p.projects), [p.projects]);
  const index = useMemo(() => new Map(p.projects.map((x) => [x.uuid, x])), [p.projects]);
  // all'apertura il ramo del progetto scelto è già aperto (e un livello più giù, come sul sito)
  const [open, setOpen] = useState<ReadonlySet<string>>(() => branchTo(index, p.value));
  const roots = kids.get(null) ?? [];
  const favourites = useMemo(
    () => p.projects.filter((x) => x.is_favorite).sort((a, b) => a.name.localeCompare(b.name)),
    [p.projects],
  );

  /* ricerca: restano i progetti il cui nome contiene il testo e tutti i loro antenati (per vederli nell'albero) */
  const keep = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<string>();
    for (const x of p.projects) {
      if (!x.name.toLowerCase().includes(q)) continue;
      for (const id of branchTo(index, x.uuid)) set.add(id);
    }
    return set;
  }, [query, p.projects, index]);

  const toggle = (uuid: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });

  const pick = (uuid: string | null) => {
    p.onPick(uuid);
    setQuery('');
    setCreating(false);
  };
  const create = (text: string) => {
    const made = p.onCreate?.(text.trim());
    if (made) {
      setName('');
      pick(made);
    }
  };

  const noneLabel = p.noneLabel === undefined ? t('progetti.ps_nessuno') : p.noneLabel;
  const empty = keep ? keep.size === 0 : p.projects.length === 0;
  const dark = th.scheme === 'dark';
  const row = (id: string | null, label: string, testID: string) => {
    const on = p.value === id;
    return (
      <Pressable
        key={testID}
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => pick(id)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 12,
          paddingHorizontal: 10,
          borderRadius: 12,
          backgroundColor: pressed || on ? th.surface2 : 'transparent',
        })}
      >
        <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: th.text3 }} />
        <Text style={{ color: th.text, fontSize: 15, fontWeight: '600', flex: 1 }}>{label}</Text>
        {on ? <Text style={{ color: th.brand, fontWeight: '800' }}>●</Text> : null}
      </Pressable>
    );
  };

  if (creating) {
    return (
      <View style={{ padding: 18, gap: 14 }}>
        <View>
          <Text
            style={{
              color: th.text2,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            {t('progetti.ps_nome')}
          </Text>
          <TextInput
            testID="project-new-name"
            value={name}
            onChangeText={setName}
            autoFocus
            onSubmitEditing={() => create(name)}
            returnKeyType="done"
            placeholder={t('progetti.ps_esempio')}
            placeholderTextColor={th.text3}
            style={{
              color: th.text,
              fontSize: 16,
              paddingVertical: 13,
              paddingHorizontal: 14,
              borderRadius: 13,
              backgroundColor: th.surface2,
              boxShadow: `inset 0 0 0 0.5px ${th.hairline}`,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            testID="project-new-cancel"
            accessibilityRole="button"
            onPress={() => setCreating(false)}
            style={[styles.btn, { backgroundColor: th.surface2 }]}
          >
            <Text style={{ color: th.text, fontSize: 15, fontWeight: '700' }}>
              {t('comune.annulla')}
            </Text>
          </Pressable>
          <Pressable
            testID="project-new-save"
            accessibilityRole="button"
            onPress={() => create(name)}
            style={[styles.btn, { backgroundColor: th.brand }]}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
              {t('progetti.ps_crea')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={p.maxHeight ? undefined : { flexShrink: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 12,
          backgroundColor: th.surface2,
        }}
      >
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Circle cx={11} cy={11} r={7} stroke={th.text2} strokeWidth={2.2} />
          <Path d="m20 20-3.5-3.5" stroke={th.text2} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
        <TextInput
          testID="project-search"
          value={query}
          onChangeText={setQuery}
          placeholder={t('progetti.ps_cerca')}
          placeholderTextColor={th.text3}
          autoCorrect={false}
          style={{ flex: 1, color: th.text, fontSize: 15, paddingVertical: 0 }}
        />
      </View>

      <ScrollView
        style={p.maxHeight ? { maxHeight: p.maxHeight } : { flexShrink: 1 }}
        nestedScrollEnabled
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 14, paddingTop: 2 }}
        keyboardShouldPersistTaps="handled"
      >
        {!keep ? (p.extras ?? []).map((x) => row(x.id, x.label, `project-pick-${x.id}`)) : null}
        {noneLabel !== false && !keep ? row(null, noneLabel, 'project-pick-none') : null}

        {favourites.length && !keep ? (
          <View>
            <Text
              style={{
                color: th.text3,
                fontSize: 9,
                fontWeight: '600',
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                paddingTop: 10,
                paddingBottom: 6,
                paddingHorizontal: 6,
              }}
            >
              {t('progetti.ps_preferiti')}
            </Text>
            {favourites.map((f) => (
              <Node
                key={`fav-${f.uuid}`}
                project={f}
                kids={kids}
                open={open}
                keep={null}
                onToggle={toggle}
                onPick={pick}
                value={p.value}
                fav={pathOf(index, f)}
                th={th}
              />
            ))}
            <View
              style={{
                height: 1,
                backgroundColor: th.hairline,
                marginTop: 8,
                marginHorizontal: 6,
                marginBottom: 4,
              }}
            />
          </View>
        ) : null}

        {empty ? (
          <Text style={{ padding: 24, textAlign: 'center', color: th.text2, fontSize: 14 }}>
            {t('progetti.ps_vuoto')}
          </Text>
        ) : (
          roots.map((r) => (
            <Node
              key={r.uuid}
              project={r}
              kids={kids}
              open={open}
              keep={keep}
              onToggle={toggle}
              onPick={pick}
              value={p.value}
              th={th}
            />
          ))
        )}

        {keep && keep.size === 0 && p.onCreate && query.trim() ? (
          <Pressable
            testID="project-create-from-search"
            accessibilityRole="button"
            onPress={() => create(query)}
            style={{
              marginTop: 14,
              marginHorizontal: 6,
              padding: 13,
              borderRadius: 13,
              alignItems: 'center',
              backgroundColor: dark ? 'rgba(10,132,255,.16)' : 'rgba(0,122,255,.09)',
            }}
          >
            <Text style={{ color: th.brand, fontSize: 14.5, fontWeight: '600' }}>
              {t('progetti.ps_crea_nome', { nome: query.trim() })}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {p.onCreate ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Pressable
            testID="project-new"
            accessibilityRole="button"
            onPress={() => {
              setName(query.trim());
              setCreating(true);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: th.hairline2,
            }}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 5v14M5 12h14"
                stroke={th.brand}
                strokeWidth={2.6}
                strokeLinecap="round"
              />
            </Svg>
            <Text style={{ color: th.brand, fontSize: 14, fontWeight: '700' }}>
              {t('progetti.nuovo_progetto')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { flex: 1, padding: 13, borderRadius: 13, alignItems: 'center' },
});
