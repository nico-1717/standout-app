import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Sheet } from '@/features/habits/Sheet';
import { habitsTheme } from '@/features/habits/habitsTheme';
import type { Project } from '@/features/projects/logic';
import { Card, SectionLabel, TextButton } from '@/ui/kit';

import { DeckPicker } from './DeckPicker';
import type { FlashcardsRepo } from './repo';

const CONFLICT_KEY = {
  self: 'progetti.materia_gia_collegata',
  parent: 'progetti.materia_padre_gia_collegata',
  child: 'progetti.sotto_materia_gia_collegata',
} as const;

/** Nella scheda di un progetto: la materia delle flashcard collegata (una sola; i figli la ereditano dal padre). */
export function ProjectDeckCard(p: {
  repo: FlashcardsRepo;
  projects: Project[];
  project: string;
  version: number;
  changed: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const ht = useMemo(() => habitsTheme(th.scheme, undefined, th.style), [th.scheme, th.style]);
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const data = useMemo(() => {
    void p.version;
    const decks = p.repo.decks();
    const own = p.repo.linkedDeck(p.project);
    // sale la catena dei padri: il primo con un mazzo collegato lo passa ai figli
    let inherited: string | null = null;
    if (!own) {
      let cur = p.projects.find((x) => x.uuid === p.project)?.parent_uuid ?? null;
      for (let g = 0; cur && g < 100 && !inherited; g++) {
        inherited = p.repo.linkedDeck(cur);
        cur = p.projects.find((x) => x.uuid === cur)?.parent_uuid ?? null;
      }
    }
    const kids = new Set<string>();
    const stack = p.projects.filter((x) => x.parent_uuid === p.project).map((x) => x.uuid);
    while (stack.length) {
      const id = stack.pop()!;
      kids.add(id);
      for (const k of p.projects) if (k.parent_uuid === id) stack.push(k.uuid);
    }
    const inKids = [...kids].some((k) => p.repo.linkedDeck(k) !== null);
    return { decks, own, inherited, inKids };
  }, [p.repo, p.projects, p.project, p.version]);
  const nameOf = (id: string | null) => data.decks.find((d) => d.uuid === id)?.name ?? '';

  const pick = (deck: string | null) => {
    setProblem(null);
    if (deck !== null) {
      const c = p.repo.deckLinkConflict(deck, p.project);
      if (c) {
        setProblem(
          t(CONFLICT_KEY[c.kind], {
            materia: nameOf(c.deck),
            progetto: p.projects.find((x) => x.uuid === c.project)?.name ?? '',
          }),
        );
        return;
      }
    }
    if (p.repo.linkDeck(p.project, deck)) {
      p.changed();
      setOpen(false);
    }
  };

  if (!data.decks.length && !data.own) return null;
  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <SectionLabel>{t('progetti.flashcard')}</SectionLabel>
      <Text testID="proj-deck-name" style={{ color: th.text, fontWeight: '600' }}>
        {data.own
          ? `${t('progetti.materia_collegata')}: ${nameOf(data.own)}`
          : t('progetti.nessuna_materia')}
      </Text>
      {data.inherited ? (
        <Text style={{ color: th.text2, fontSize: 12 }}>
          {t('progetti.deck_dal_padre')} · {nameOf(data.inherited)}
        </Text>
      ) : null}
      {data.inKids ? (
        <Text style={{ color: th.text2, fontSize: 12 }}>{t('progetti.deck_nei_figli')}</Text>
      ) : null}
      <TextButton
        testID="proj-deck-link"
        label={data.own ? t('progetti.collega_materia') : t('progetti.collega_deck')}
        onPress={() => {
          setProblem(null);
          setOpen(true);
        }}
      />
      {open ? (
        <Sheet
          visible
          title={t('progetti.collega_materia')}
          th={ht}
          onClose={() => setOpen(false)}
          testID="proj-deck-sheet"
        >
          <View style={{ padding: 20, gap: 12 }}>
            {problem ? (
              <Text testID="proj-deck-problem" style={{ color: '#FF3B30' }}>
                {problem}
              </Text>
            ) : null}
            <DeckPicker
              decks={data.decks}
              value={data.own}
              onPick={pick}
              allowRoot
              rootLabel={t('progetti.nessuna_materia')}
            />
          </View>
        </Sheet>
      ) : null}
    </Card>
  );
}
