import type { TFunction } from 'i18next';

import type { SwipeAction } from '@/ui/ActionSwipe';

import { PjIcon } from './PjIcons';

/** I tre tasti dietro una riga di progetto (.swipe-btn del sito): blu, viola, rosso. */
export function projectSwipeActions(p: {
  t: TFunction;
  red: string;
  onAdd: () => void;
  onMove: () => void;
  onDelete: () => void;
}): SwipeAction[] {
  const icon = (name: 'plus' | 'folder' | 'trash') => (
    <PjIcon name={name} color="#fff" size={19} width={2.1} />
  );
  return [
    {
      key: 'add',
      color: '#007AFF',
      label: p.t('progetti.aggiungi_dentro'),
      icon: icon('plus'),
      run: p.onAdd,
    },
    {
      key: 'move',
      color: '#AF52DE',
      label: p.t('progetti.sposta'),
      icon: icon('folder'),
      run: p.onMove,
    },
    {
      key: 'delete',
      color: p.red,
      label: p.t('comune.elimina'),
      icon: icon('trash'),
      run: p.onDelete,
    },
  ];
}
