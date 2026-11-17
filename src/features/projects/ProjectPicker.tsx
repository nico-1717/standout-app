import { useTranslation } from 'react-i18next';

import type { Project } from './logic';
import { ProjectTree } from './ProjectTree';

/**
 * La scelta di un progetto dentro una pagina o un foglio: lo stesso selettore intelligente del sito (`ProjectTree`) con un'altezza
 * contenuta. «Nessun progetto» in cima, ricerca, preferiti, rami che si aprono, e (se `onCreate`) «Nuovo progetto».
 */
export function ProjectPicker({
  projects,
  value,
  onPick,
  extras,
  hideNone,
  onCreate,
}: {
  projects: Project[];
  value: string | null;
  onPick: (uuid: string | null) => void;
  /** righe in più in cima (nei filtri: «tutti», «senza progetto»); `id` torna in `onPick` */
  extras?: { id: string; label: string }[];
  /** nasconde «nessun progetto» (quando le `extras` lo dicono già) */
  hideNone?: boolean;
  /** crea un progetto al volo e lo restituisce (null = non si può creare) */
  onCreate?: (name: string) => string | null;
}) {
  const { t } = useTranslation();
  return (
    <ProjectTree
      projects={projects}
      value={value}
      onPick={onPick}
      extras={extras}
      noneLabel={hideNone ? false : t('pomodoro.nessun_progetto')}
      onCreate={onCreate}
      maxHeight={340}
    />
  );
}
