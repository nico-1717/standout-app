import type { SqlDb } from '@/core/db/sqldb';

export interface StudyTopic {
  uuid: string;
  name: string;
  color: string;
  /** è un ripasso (non genera altri ripassi) */
  review: boolean;
  /** pomodori stimati, se c'è una stima */
  estimated: number | null;
  /** pomodori già fatti su questo argomento */
  done: number;
}

export interface StudyBlock {
  uuid: string;
  title: string;
  /** il nome della materia (il progetto collegato al blocco) */
  subject: string | null;
  color: string | null;
  completed: boolean;
  topics: StudyTopic[];
}

interface BlockRow {
  uuid: string;
  title: string;
  is_completed: number;
  color: string | null;
  subject: string | null;
  subject_color: string | null;
}

interface TopicRow {
  uuid: string;
  name: string;
  color: string;
  study_event_uuid: string;
  study_ripasso_di_uuid: string | null;
  study_pomodori_stimati: number | null;
  done: number;
}

/**
 * Cosa c'è da studiare in un giorno, come `study_api.php?st_ajax=oggi`: i blocchi del calendario «studio» che coprono il
 * giorno (anche senza argomenti: è la forma normale di un blocco appena creato) e sotto ciascuno i suoi argomenti che
 * toccano quel giorno e non sono ancora completati, con i pomodori fatti e la stima.
 */
export function studyToday(db: SqlDb, date: string): StudyBlock[] {
  const blocks = db.all<BlockRow>(
    `SELECT e.uuid, e.title, e.is_completed, e.color, m.name AS subject, m.color AS subject_color
       FROM planner_events e
       JOIN planner_calendars c ON c.uuid = e.calendar_uuid AND c.role = 'study'
       LEFT JOIN projects m ON m.uuid = e.project_uuid
      WHERE e.rrule IS NULL AND COALESCE(e.is_cancelled, 0) = 0
        AND e.event_date <= ? AND COALESCE(e.end_date, e.event_date) >= ?
      ORDER BY e.event_date, e.uuid`,
    [date, date],
  );
  if (!blocks.length) return [];
  const marks = blocks.map(() => '?').join(',');
  const topics = db.all<TopicRow>(
    `SELECT p.uuid, p.name, p.color, p.study_event_uuid, p.study_ripasso_di_uuid, p.study_pomodori_stimati,
            (SELECT COUNT(*) FROM pomodoro_sessions s WHERE s.project_uuid = p.uuid AND s.end_time IS NOT NULL) AS done
       FROM projects p
      WHERE p.study_event_uuid IN (${marks}) AND p.status <> 'completed'
        AND p.study_start <= ? AND COALESCE(p.study_end, p.study_start) >= ?
      ORDER BY p.study_start, p.sort_key, p.uuid`,
    [...blocks.map((b) => b.uuid), date, date],
  );
  const byBlock = new Map<string, StudyTopic[]>();
  for (const x of topics) {
    const list = byBlock.get(x.study_event_uuid) ?? [];
    list.push({
      uuid: x.uuid,
      name: x.name,
      color: x.color,
      review: x.study_ripasso_di_uuid !== null,
      estimated: x.study_pomodori_stimati,
      done: Number(x.done),
    });
    byBlock.set(x.study_event_uuid, list);
  }
  return blocks.map((b) => ({
    uuid: b.uuid,
    title: b.title,
    subject: b.subject,
    color: b.subject_color || b.color || null,
    completed: Number(b.is_completed) === 1,
    topics: byBlock.get(b.uuid) ?? [],
  }));
}
