import { deckBranch, type Deck } from './logic';

/**
 * Le categorie scelte per una partita con più categorie, raggruppate come sul sito (fc_game_setup.php, «ordered_categories_list»):
 * una categoria scelta porta con sé tutto quello che ha sotto, e si sposta insieme. Ogni gruppo è una categoria senza
 * antenati fra le scelte, più i suoi discendenti scelti, nell'ordine in cui sono stati toccati.
 */
export function pickGroups(decks: Deck[], picked: string[]): string[][] {
  const roots = picked.filter(
    (id) => !picked.some((other) => other !== id && deckBranch(decks, other).includes(id)),
  );
  return roots.map((root) => {
    const branch = deckBranch(decks, root);
    return picked.filter((id) => branch.includes(id));
  });
}

/** Sposta un gruppo di un posto (su = -1, giù = +1) e restituisce le scelte nel nuovo ordine. */
export function movePickGroup(
  decks: Deck[],
  picked: string[],
  index: number,
  step: -1 | 1,
): string[] {
  const groups = pickGroups(decks, picked);
  const to = index + step;
  if (index < 0 || index >= groups.length || to < 0 || to >= groups.length) return picked;
  const moved = [...groups];
  [moved[index], moved[to]] = [moved[to]!, moved[index]!];
  return moved.flat();
}
