import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import type { Project } from './logic';
import { ProjectTree } from './ProjectTree';

/**
 * Il selettore di progetti del sito (project_selector.php) come foglio dal basso: titolo, chiusura e dentro l'albero
 * intelligente (`ProjectTree`: ricerca, preferiti, rami, «Nuovo progetto»). Dove si usa: Pomodoro e, uno alla volta,
 * le altre pagine.
 */
export function ProjectSheet(p: {
  visible: boolean;
  title?: string;
  projects: Project[];
  value: string | null;
  onPick: (uuid: string | null) => void;
  onClose: () => void;
  /** nome del tasto «nessuno» (default «Nessun progetto»); `false` lo toglie */
  noneLabel?: string | false;
  /** crea un progetto al volo e lo restituisce (null = non si può creare) */
  onCreate?: (name: string) => string | null;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const wide = width >= 700;

  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      {p.visible ? (
        <View style={[styles.backdrop, wide && { justifyContent: 'center', alignItems: 'center' }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('comune.chiudi')}
            style={StyleSheet.absoluteFill}
            onPress={p.onClose}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            testID="project-sheet"
            style={[
              styles.panel,
              {
                backgroundColor: th.surface,
                maxHeight: Math.min(height * 0.82, 760),
                paddingBottom: insets.bottom,
              },
              wide ? { width: 560, borderRadius: 24 } : null,
            ]}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 16,
                paddingBottom: 10,
                paddingHorizontal: 18,
                borderBottomWidth: 0.5,
                borderBottomColor: th.hairline,
              }}
            >
              <Text style={{ color: th.text, fontSize: 17, fontWeight: '800' }} numberOfLines={1}>
                {p.title ?? t('pomodoro.collega_progetto')}
              </Text>
              <Pressable
                testID="project-sheet-close"
                accessibilityRole="button"
                accessibilityLabel={t('comune.chiudi')}
                onPress={p.onClose}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: th.surface2,
                }}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 6l12 12M18 6 6 18"
                    stroke={th.text2}
                    strokeWidth={2.8}
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            </View>
            <ProjectTree
              projects={p.projects}
              value={p.value}
              noneLabel={p.noneLabel}
              onCreate={p.onCreate}
              onPick={p.onPick}
            />
          </KeyboardAvoidingView>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.4)' },
  panel: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    boxShadow: '0 -10px 40px rgba(0,0,0,.3)',
  },
});
