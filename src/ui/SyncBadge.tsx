import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/app/AppProvider';
import { useTheme } from '@/core/theme/ThemeProvider';

/** «● Sincronizzato» / «Sincronizzo…» / «Offline» / «N in attesa»: lo stato in un colpo d'occhio. */
function describe(
  info: { status: string; pending: number },
  th: ReturnType<typeof useTheme>,
  t: (k: string, o?: Record<string, unknown>) => string,
): { label: string; color: string } {
  if (info.status === 'syncing') return { label: t('app.sync_in_corso'), color: th.text2 };
  if (info.status === 'offline') return { label: t('app.sync_offline'), color: th.orange };
  if (info.status === 'error') return { label: t('app.sync_errore'), color: th.red };
  if (info.pending > 0)
    return { label: t('app.sync_in_attesa', { n: info.pending }), color: th.text2 };
  return { label: t('app.sync_ok'), color: th.green };
}

export function SyncBadge() {
  const { syncInfo } = useApp();
  const th = useTheme();
  const { t } = useTranslation();
  const { label, color } = describe(syncInfo, th, t);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: th.text2, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
