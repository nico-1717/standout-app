import { useState } from 'react';
import { Linking, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePlanTheme } from '@/features/plan/ui';

import { MAX_BLOCKS, type Block } from './blocks';
import { cleanUrl, hostOf, parseTable, type Imported } from './importTable';
import type { TrackerRepo } from './repo';
import { Btn, Hint } from './parts';

/** Chiede all'IA (sul server) di ricavare una tabella dal testo incollato. Serve rete; un errore porta il testo del server. */
export type AiTableFn = (text: string, request: string) => Promise<Imported>;

/**
 * «Collegamento»: scrivi l'indirizzo di un sito, copi i suoi dati e li incolli qui: diventano una tabella del Tracker.
 * Incollando di nuovo si aggiorna la stessa tabella (non se ne fa un'altra). Niente password e niente richieste di
 * rete dal telefono: il collegamento «in diretta» serve un sito che condivide i suoi dati, e non tutti lo fanno.
 */
export function ConnectionBlock({
  block,
  repo,
  project,
  changed,
  onSave,
  aiTable,
}: {
  block: Block;
  repo: TrackerRepo;
  project: string;
  changed: () => void;
  onSave: (change: { config?: object; data?: object }) => void;
  aiTable?: AiTableFn;
}) {
  const ht = usePlanTheme();
  const { t } = useTranslation();
  const config = (block.config ?? {}) as { url?: unknown };
  const data = (block.data ?? {}) as { table?: unknown };
  const url = typeof config.url === 'string' ? config.url : '';
  const tableId = typeof data.table === 'string' ? data.table : null;
  const exists = tableId ? repo.blocks(project).some((b) => b.uuid === tableId) : false;
  const [text, setText] = useState('');
  const [wish, setWish] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  /** Una tabella pronta (letta qui o costruita dall'IA) diventa, o aggiorna, la tabella collegata. */
  const apply = (table: Imported) => {
    const patch = {
      config: { cols: table.cols, rows: table.rows, headers: [] },
      data: { cells: table.cells },
    };
    let id = exists ? tableId : null;
    if (id) repo.update(id, patch);
    else id = repo.add(project, 'table', hostOf(url) || t('tracker.k_table'), patch);
    if (!id) {
      setMsg(t('tracker.full', { n: MAX_BLOCKS }));
      return;
    }
    onSave({ data: { table: id, last: new Date().toISOString() } });
    setText('');
    setMsg(t('tracker.x_done', { r: table.rows, c: table.cols }));
    changed();
  };

  const build = () => {
    const table = parseTable(text);
    if (!table) {
      setMsg(t('tracker.x_bad'));
      return;
    }
    apply(table);
  };

  const buildWithAi = async () => {
    if (!aiTable || working) return;
    setWorking(true);
    setMsg(t('tracker.x_ai_working'));
    try {
      apply(await aiTable(text, wish.trim()));
    } catch (e) {
      // il server dice cosa è andato storto (limite del piano, IA occupata…); senza rete il messaggio è il nostro
      const message =
        e instanceof Error && e.message && !/network|fetch/i.test(e.message) ? e.message : '';
      setMsg(message || t('tracker.x_ai_offline'));
    } finally {
      setWorking(false);
    }
  };

  const clean = cleanUrl(url);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: ht.text2, fontWeight: '700', fontSize: 13 }}>
          {t('tracker.x_url')}
        </Text>
        <TextInput
          key={`u:${url}`}
          testID="cx-url"
          defaultValue={url}
          placeholder={t('tracker.x_url_ph')}
          placeholderTextColor={ht.text3}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onEndEditing={(e) => {
            const v = e.nativeEvent.text.trim();
            if (v === url) return;
            if (v && !cleanUrl(v)) {
              setMsg(t('tracker.x_url_bad'));
              return;
            }
            setMsg(null);
            onSave({ config: { url: v } });
          }}
          style={{ minHeight: 44, color: ht.text, borderBottomWidth: 1, borderColor: ht.hairline2 }}
        />
      </View>
      {clean ? (
        <Btn
          small
          label={t('tracker.x_open')}
          onPress={() => void Linking.openURL(clean)}
          testID="cx-open"
        />
      ) : null}
      <Hint>{t('tracker.x_hint')}</Hint>
      <TextInput
        testID="cx-paste"
        value={text}
        onChangeText={setText}
        multiline
        placeholder={t('tracker.x_paste_ph')}
        placeholderTextColor={ht.text3}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          minHeight: 100,
          maxHeight: 180,
          color: ht.text,
          fontSize: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: ht.hairline2,
          padding: 10,
          textAlignVertical: 'top',
        }}
      />
      <Btn
        tone="primary"
        label={exists ? t('tracker.x_update') : t('tracker.x_build')}
        disabled={!text.trim()}
        onPress={build}
        testID="cx-build"
      />
      {aiTable ? (
        <View style={{ gap: 8 }}>
          <Hint>{t('tracker.x_ai_hint')}</Hint>
          <TextInput
            testID="cx-ai-wish"
            value={wish}
            onChangeText={setWish}
            placeholder={t('tracker.x_ai_req_ph')}
            placeholderTextColor={ht.text3}
            maxLength={200}
            style={{
              minHeight: 44,
              color: ht.text,
              borderBottomWidth: 1,
              borderColor: ht.hairline2,
            }}
          />
          <Btn
            label={exists ? t('tracker.x_ai_update') : t('tracker.x_ai')}
            disabled={!text.trim() || working}
            onPress={() => void buildWithAi()}
            testID="cx-ai"
          />
        </View>
      ) : null}
      {msg ? (
        <Text testID="cx-msg" style={{ color: ht.text }}>
          {msg}
        </Text>
      ) : null}
      <Hint>{t('tracker.x_live')}</Hint>
    </View>
  );
}
