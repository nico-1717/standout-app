import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Sheet } from '@/features/habits/Sheet';
import { PrimaryButton, TextButton } from '@/ui/kit';

import type { Template } from './repo';
import { Row, usePlanTheme } from './ui';

/** «Modelli»: la forma di un piano (ore, tipo, priorità per nome) si salva e si riusa su un altro progetto con gli stessi sotto-progetti. */
export function TemplatesSheet(p: {
  visible: boolean;
  templates: Template[];
  /** il messaggio dell'ultima azione («Modello salvato (3 voci)») */
  notice: string | null;
  onSave: (name: string) => void;
  onApply: (uuid: string) => void;
  onRemove: (uuid: string) => void;
  onClose: () => void;
}) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  return (
    <Sheet
      visible={p.visible}
      title={t('piano.modelli')}
      th={ht}
      onClose={p.onClose}
      testID="templates-sheet"
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: ht.text2, fontSize: 13, lineHeight: 19 }}>
          {t('piano.modelli_aiuto')}
        </Text>
        {p.notice ? (
          <Text testID="templates-notice" style={{ color: ht.green, fontWeight: '700' }}>
            {p.notice}
          </Text>
        ) : null}
        {p.templates.length === 0 ? (
          <Text testID="templates-empty" style={{ color: ht.text2 }}>
            {t('piano.modelli_vuoto')}
          </Text>
        ) : (
          p.templates.map((m) => (
            <View
              key={m.uuid}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: ht.surface,
                borderRadius: 16,
                padding: 12,
              }}
            >
              <Text style={{ color: ht.text, flex: 1, fontWeight: '700' }} numberOfLines={2}>
                {m.name}
              </Text>
              <TextButton
                testID={`tpl-use-${m.uuid}`}
                label={t('piano.usa')}
                onPress={() => p.onApply(m.uuid)}
              />
              <TextButton
                testID={`tpl-del-${m.uuid}`}
                danger
                label={t('piano.elimina')}
                onPress={() => p.onRemove(m.uuid)}
              />
            </View>
          ))
        )}
        <Row>
          <TextInput
            testID="tpl-name"
            value={name}
            onChangeText={setName}
            maxLength={80}
            placeholder={t('piano.nome_modello')}
            placeholderTextColor={ht.text3}
            style={{
              color: ht.text,
              backgroundColor: ht.surface,
              borderRadius: 14,
              padding: 14,
              fontSize: 16,
            }}
          />
          <PrimaryButton
            testID="tpl-save"
            label={t('piano.salva_modello')}
            disabled={!name.trim()}
            onPress={() => {
              p.onSave(name);
              setName('');
            }}
          />
        </Row>
      </ScrollView>
    </Sheet>
  );
}
