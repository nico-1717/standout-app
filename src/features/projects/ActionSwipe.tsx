import { useEffect, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/core/theme/ThemeProvider';

import { PjIcon } from './PjIcons';

/** Larghezza di ogni tasto (.swipe-btn del sito: 72). */
const BTN = 72;
export const SWIPE_WIDTH = BTN * 3;
const BLUE = '#007AFF';
const PURPLE = '#AF52DE';

interface Cfg {
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lo scorrimento della riga come sul sito (progetti.php): trascinandola verso destra si scoprono, a sinistra, i tre tasti.
 * Oltre il 45% della larghezza resta aperta, altrimenti torna a posto. Un movimento più verticale che orizzontale è la
 * pagina che scorre e non conta.
 */
class SwipeOpen {
  private cfg: Cfg;
  private base = 0;
  readonly responder;

  constructor(
    private readonly x: Animated.Value,
    cfg: Cfg,
  ) {
    this.cfg = cfg;
    this.responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        !this.cfg.disabled && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.15,
      onPanResponderGrant: () => {
        this.base = this.cfg.open ? SWIPE_WIDTH : 0;
        this.x.stopAnimation();
      },
      onPanResponderMove: (_e, g) => {
        const raw = this.base + g.dx;
        this.x.setValue(raw < 0 ? raw * 0.15 : Math.min(raw, SWIPE_WIDTH));
      },
      onPanResponderRelease: (_e, g) => {
        const raw = Math.max(0, Math.min(this.base + g.dx, SWIPE_WIDTH));
        const openIt = raw > SWIPE_WIDTH * 0.45;
        this.settle(openIt);
        if (openIt !== this.cfg.open) this.cfg.onOpenChange(openIt);
      },
      onPanResponderTerminate: () => this.settle(this.cfg.open),
    });
  }

  settle(open: boolean) {
    Animated.spring(this.x, {
      toValue: open ? SWIPE_WIDTH : 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }

  update(cfg: Cfg) {
    this.cfg = cfg;
  }
}

/**
 * Una riga di progetto con i tre tasti nascosti dietro: «Aggiungi dentro», «Sposta» ed «Elimina». Aperta o chiusa lo decide
 * chi la usa (`open`), così se ne apre una sola alla volta; un tocco sulla riga aperta la richiude e basta.
 */
export function ActionSwipe(p: {
  id: string;
  open: boolean;
  /** nascosti mentre si seleziona o si trascina una riga */
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  onMove: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const th = useTheme();
  const { t } = useTranslation();
  const [x] = useState(() => new Animated.Value(0));
  const cfg: Cfg = { open: p.open, disabled: !!p.disabled, onOpenChange: p.onOpenChange };
  const [gesture] = useState(() => new SwipeOpen(x, cfg));
  useEffect(() => {
    gesture.update(cfg);
  });
  // chiusa da fuori (un'altra si apre, tocco altrove, azione fatta): torna a posto
  useEffect(() => {
    gesture.settle(p.open && !p.disabled);
  }, [gesture, p.open, p.disabled]);

  const visible = p.open && !p.disabled;
  const btn = (
    key: 'add' | 'move' | 'delete',
    color: string,
    icon: 'plus' | 'folder' | 'trash',
    label: string,
    run: () => void,
  ) => (
    <Pressable
      testID={`swipe-${key}-${p.id}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        p.onOpenChange(false);
        run();
      }}
      style={{
        width: BTN,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        backgroundColor: color,
      }}
    >
      <PjIcon name={icon} color="#fff" size={19} width={2.1} />
      <Text numberOfLines={1} style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View testID={`swipe-row-${p.id}`} style={{ overflow: 'hidden' }}>
      <View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}
      >
        {btn('add', BLUE, 'plus', t('progetti.aggiungi_dentro'), p.onAdd)}
        {btn('move', PURPLE, 'folder', t('progetti.sposta'), p.onMove)}
        {btn('delete', th.red, 'trash', t('comune.elimina'), p.onDelete)}
      </View>
      <Animated.View
        testID={`swipe-pan-${p.id}`}
        style={{ backgroundColor: th.surface, transform: [{ translateX: x }] }}
        {...gesture.responder.panHandlers}
      >
        {p.children}
        {visible ? (
          // un tocco sulla riga aperta la richiude e non apre il progetto
          <Pressable
            testID={`swipe-close-${p.id}`}
            accessibilityRole="button"
            onPress={() => p.onOpenChange(false)}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}
