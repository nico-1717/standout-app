import { useEffect, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';

/** Larghezza di ogni tasto (.swipe-btn del sito: 72 nei Progetti, 76 nei Voti). */
const BTN = 72;

interface Cfg {
  /** quanto si scopre: la somma dei tasti */
  width: number;
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
        this.base = this.cfg.open ? this.cfg.width : 0;
        this.x.stopAnimation();
      },
      onPanResponderMove: (_e, g) => {
        const raw = this.base + g.dx;
        this.x.setValue(raw < 0 ? raw * 0.15 : Math.min(raw, this.cfg.width));
      },
      onPanResponderRelease: (_e, g) => {
        const raw = Math.max(0, Math.min(this.base + g.dx, this.cfg.width));
        const openIt = raw > this.cfg.width * 0.45;
        this.settle(openIt);
        if (openIt !== this.cfg.open) this.cfg.onOpenChange(openIt);
      },
      onPanResponderTerminate: () => this.settle(this.cfg.open),
    });
  }

  settle(open: boolean) {
    Animated.spring(this.x, {
      toValue: open ? this.cfg.width : 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }

  update(cfg: Cfg) {
    this.cfg = cfg;
  }
}

/** Un tasto nascosto dietro la riga. */
export interface SwipeAction {
  /** va nel testID: `swipe-<key>-<id>` */
  key: string;
  color: string;
  label: string;
  icon: ReactNode;
  run: () => void;
}

/**
 * Una riga con i tasti nascosti dietro (progetti.php e voti.php: «swipe-actions»): trascinandola verso destra si
 * scoprono a sinistra. Aperta o chiusa lo decide chi la usa (`open`), così se ne apre una sola alla volta; un tocco sulla
 * riga aperta la richiude e basta.
 */
export function ActionSwipe(p: {
  id: string;
  open: boolean;
  /** nascosti mentre si seleziona o si trascina una riga */
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  actions: SwipeAction[];
  /** larghezza di ogni tasto (default 72) */
  buttonWidth?: number;
  /** il fondo della riga, che copre i tasti a riposo (default: la superficie) */
  background?: string;
  children: ReactNode;
}) {
  const th = useTheme();
  const [x] = useState(() => new Animated.Value(0));
  const btnW = p.buttonWidth ?? BTN;
  const cfg: Cfg = {
    width: btnW * p.actions.length,
    open: p.open,
    disabled: !!p.disabled,
    onOpenChange: p.onOpenChange,
  };
  const [gesture] = useState(() => new SwipeOpen(x, cfg));
  useEffect(() => {
    gesture.update(cfg);
  });
  // chiusa da fuori (un'altra si apre, tocco altrove, azione fatta): torna a posto
  useEffect(() => {
    gesture.settle(p.open && !p.disabled);
  }, [gesture, p.open, p.disabled]);

  const visible = p.open && !p.disabled;
  const btn = (a: SwipeAction) => (
    <Pressable
      key={a.key}
      testID={`swipe-${a.key}-${p.id}`}
      accessibilityRole="button"
      accessibilityLabel={a.label}
      onPress={() => {
        p.onOpenChange(false);
        a.run();
      }}
      style={{
        width: btnW,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        backgroundColor: a.color,
      }}
    >
      {a.icon}
      <Text numberOfLines={1} style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
        {a.label}
      </Text>
    </Pressable>
  );

  return (
    <View testID={`swipe-row-${p.id}`} style={{ overflow: 'hidden' }}>
      <View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}
      >
        {p.actions.map(btn)}
      </View>
      <Animated.View
        testID={`swipe-pan-${p.id}`}
        style={{ backgroundColor: p.background ?? th.surface, transform: [{ translateX: x }] }}
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
