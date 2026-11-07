import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';
import { Rise } from '@/ui/motion';

import { TIER_COLORS, type AchievementState } from './achievements';

/** «Traguardo sbloccato»: una finestra piccola al centro, con la medaglia del livello. Si chiude con «OK». */
export function AwardPopup({
  award,
  onClose,
}: {
  award: AchievementState | null;
  onClose: () => void;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  if (!award) return null;
  const c = TIER_COLORS[award.tier];
  const ring = th.scheme === 'dark' ? c.ringDark : c.ringLight;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,.45)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <Rise
          style={{
            width: '100%',
            maxWidth: 340,
            alignItems: 'center',
            gap: 8,
            padding: 24,
            borderRadius: th.radiusCard,
            backgroundColor: th.surface,
            borderWidth: 1,
            borderColor: th.cardEdge,
            boxShadow: th.cardShadow,
          }}
        >
          <Text
            style={{ color: th.text2, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}
            accessibilityRole="header"
          >
            {t('abitudini.traguardo_sbloccato').toUpperCase()}
          </Text>
          {th.style === 'paper' ? (
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                borderWidth: 2,
                borderColor: ring,
                backgroundColor: ring + '1A',
                alignItems: 'center',
                justifyContent: 'center',
                marginVertical: 8,
              }}
            >
              <Text style={{ fontSize: 40 }}>{award.icon}</Text>
            </View>
          ) : (
            <LinearGradient
              colors={c.glass}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                alignItems: 'center',
                justifyContent: 'center',
                marginVertical: 8,
                boxShadow: `0 8px 22px ${c.glass[1]}66`,
              }}
            >
              <Text style={{ fontSize: 40 }}>{award.icon}</Text>
            </LinearGradient>
          )}
          <Text
            testID="award-popup-name"
            style={{
              color: th.text,
              fontSize: 24,
              textAlign: 'center',
              fontFamily: th.display,
              fontWeight: th.display ? undefined : '800',
            }}
          >
            {award.name}
          </Text>
          <Text style={{ color: th.text2, fontSize: 15, textAlign: 'center' }}>
            {award.description}
          </Text>
          <Pressable
            testID="award-popup-ok"
            accessibilityRole="button"
            onPress={onClose}
            style={{
              marginTop: 12,
              alignSelf: 'stretch',
              alignItems: 'center',
              paddingVertical: 14,
              borderRadius: th.radiusButton,
              backgroundColor: th.brand,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>OK</Text>
          </Pressable>
        </Rise>
      </View>
    </Modal>
  );
}
