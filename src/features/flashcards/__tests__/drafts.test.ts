import { memoryDb } from '@/core/db/__tests__/testDb';
import { migrate } from '@/core/db/migrations';
import { nextBatch } from '@/core/sync/outbox';
import { ProjectsRepo } from '@/features/projects/repo';

import { FlashcardsRepo } from '../repo';

function setup() {
  const db = memoryDb();
  migrate(db);
  let n = 0;
  const ids = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  let t = 0;
  const clock = () => new Date(Date.UTC(2030, 2, 4, 10, 0, ++t)).toISOString();
  const repo = new FlashcardsRepo(db, clock, ids);
  const projects = new ProjectsRepo(db, clock, ids);
  return { db, repo, projects };
}

describe('quick drafts', () => {
  test('a draft keeps only the front, newest first, and is queued for sync', () => {
    const { db, repo } = setup();
    const a = repo.addDraft('  mitochondria  ')!;
    const b = repo.addDraft('ribosome')!;
    expect(repo.drafts().map((d) => d.uuid)).toEqual([b, a]);
    expect(repo.drafts()[1]).toMatchObject({ front: 'mitochondria', back: '', deck_uuid: null });
    const out = nextBatch(db, 10);
    expect(out.map((m) => [m.table, m.op])).toEqual([
      ['fc_quick_drafts', 'upsert'],
      ['fc_quick_drafts', 'upsert'],
    ]);
    expect(out[0].patch).toEqual({ front: 'mitochondria', back: '' });
  });

  test('empty text is refused, long text is cut at 500, and 200 is the limit', () => {
    const { repo } = setup();
    expect(repo.addDraft('   ')).toBeNull();
    const id = repo.addDraft('x'.repeat(600))!;
    expect(repo.drafts().find((d) => d.uuid === id)?.front).toHaveLength(500);
    repo.removeDraft(id);
    for (let i = 0; i < 200; i++) expect(repo.addDraft(`q${i}`)).not.toBeNull();
    expect(repo.addDraft('one too many')).toBeNull();
  });

  test('finishing needs the back and a real deck; then it becomes the last card and the draft goes', () => {
    const { db, repo } = setup();
    const deck = repo.createDeck({ name: 'Biology' })!;
    repo.addCard(deck, 'first', 'a');
    const d = repo.addDraft('cell wall')!;
    expect(repo.finishDraft(d, { front: 'cell wall', back: '  ', deck })).toBeNull();
    expect(repo.finishDraft(d, { front: 'cell wall', back: 'protects', deck: 'nope' })).toBeNull();
    expect(repo.drafts()).toHaveLength(1);
    const card = repo.finishDraft(d, { front: ' cell wall ', back: ' protects ', deck })!;
    expect(card).toBeTruthy();
    expect(repo.drafts()).toEqual([]);
    const cards = repo.cards(deck);
    expect(cards.map((c) => c.question_desc)).toEqual(['first', 'cell wall']);
    expect(cards[1].answer_desc).toBe('protects');
    // la bozza non era ancora partita: nascere e sparire si annullano, resta solo la carta
    const ops = nextBatch(db, 50).map((m) => `${m.table}:${m.op}`);
    expect(ops.filter((o) => o.startsWith('fc_quick_drafts'))).toEqual([]);
    expect(ops.at(-1)).toBe('fc_study_cards:upsert');
  });
});

describe('deck linked to a project', () => {
  test('one deck per project: linking again replaces the row, null unlinks', () => {
    const { db, repo, projects } = setup();
    const p = projects.create({ name: 'Exam' })!;
    const d1 = repo.createDeck({ name: 'One' })!;
    const d2 = repo.createDeck({ name: 'Two' })!;
    expect(repo.linkedDeck(p)).toBeNull();
    expect(repo.linkDeck(p, d1)).toBe(true);
    expect(repo.linkedDeck(p)).toBe(d1);
    expect(repo.linkedProject(d1)).toBe(p);
    expect(repo.linkDeck(p, d2)).toBe(true);
    expect(repo.linkedDeck(p)).toBe(d2);
    expect(repo.linkedProject(d1)).toBeNull();
    const ops = nextBatch(db, 100)
      .filter((m) => m.table === 'fc_study_deck_projects')
      .map((m) => m.op);
    // il primo collegamento non era ancora partito: si annulla con la riga che lo toglie, resta quello nuovo
    expect(ops).toEqual(['upsert']);
    expect(repo.linkDeck(p, null)).toBe(true);
    expect(repo.linkedDeck(p)).toBeNull();
  });

  test('a subject that is free: not when it, a parent or a child belongs to another project', () => {
    const { repo, projects } = setup();
    const p1 = projects.create({ name: 'P1' })!;
    const p2 = projects.create({ name: 'P2' })!;
    const root = repo.createDeck({ name: 'Root' })!;
    const kid = repo.createDeck({ name: 'Kid', parent: root })!;
    const other = repo.createDeck({ name: 'Other' })!;
    expect(repo.linkDeck(p1, root)).toBe(true);
    expect(repo.deckLinkBlocked(kid, p2)).toBe(true);
    expect(repo.linkDeck(p2, kid)).toBe(false);
    expect(repo.linkDeck(p2, root)).toBe(false);
    expect(repo.linkDeck(p1, kid)).toBe(true);
    expect(repo.linkDeck(p2, other)).toBe(true);
    expect(repo.linkDeck(p2, 'missing')).toBe(false);
    expect(repo.linkedDeck(p2)).toBe(other);
  });
});
