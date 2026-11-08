import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { habitsTheme } from '@/features/habits/habitsTheme';
import { Sheet } from '@/features/habits/Sheet';
import { ProjectPicker } from '@/features/projects/ProjectPicker';
import type { Project } from '@/features/projects/logic';

/** «Collega a un progetto»: l'albero dei progetti e «nessun progetto» (il campo project_id delle attività del sito). */
export function TaskProjectSheet({
  visible,
  projects,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  projects: Project[];
  value: string | null;
  /** null = nessun progetto */
  onPick: (uuid: string | null) => void;
  onClose: () => void;
}) {
  const app = useTheme();
  const { t } = useTranslation();
  const ht = useMemo(() => habitsTheme(app.scheme, undefined, app.style), [app.scheme, app.style]);
  return (
    <Sheet
      visible={visible}
      title={t('todo.collega_progetto')}
      th={ht}
      onClose={onClose}
      testID="task-project-sheet"
    >
      <ProjectPicker projects={projects} value={value} onPick={onPick} />
    </Sheet>
  );
}
