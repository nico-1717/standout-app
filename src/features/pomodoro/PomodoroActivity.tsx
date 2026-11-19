import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

import type { ActivityProps } from './liveActivityState';

/**
 * Il timer del Pomodoro fuori dall'app: sulla schermata di blocco e nella Dynamic Island (Live Activity di iOS).
 * Il tempo scorre da solo, lo disegna iOS: l'app deve solo dire quando si parte, si mette in pausa, si riprende, si finisce.
 * Questo componente gira in un'estensione a parte (non dentro l'app): niente hook, niente import dentro, niente costanti fuori.
 */
const PomodoroActivity = (props: ActivityProps, env: { isStale?: boolean }) => {
  'widget';
  const from = new Date(props.from);
  const to = new Date(props.to);
  const up = props.kind === 'stopwatch';
  const over = env.isStale === true && !up;
  const clock = (size: number, width: number) =>
    over ? (
      <Text modifiers={[font({ size: size * 0.5, weight: 'bold' }), foregroundStyle(props.color)]}>
        {props.doneText}
      </Text>
    ) : (
      <Text
        timerInterval={{ lower: from, upper: to }}
        countsDown={!up}
        pauseTime={props.paused ? new Date(props.at) : undefined}
        modifiers={[
          font({ size, weight: 'semibold', design: 'rounded' }),
          monospacedDigit(),
          foregroundStyle(props.color),
          frame({ maxWidth: width, alignment: 'trailing' }),
        ]}
      />
    );
  const icon = (size: number) => (
    <Image
      systemName={props.kind === 'break' ? 'cup.and.saucer.fill' : 'timer'}
      color={props.color}
      size={size}
    />
  );
  const labels = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(props.color)]}>
        {props.title}
      </Text>
      <Text modifiers={[font({ size: 16, weight: 'medium' })]}>{props.subtitle}</Text>
    </VStack>
  );
  return {
    banner: (
      <HStack spacing={14} modifiers={[padding({ all: 16 })]}>
        {icon(26)}
        {labels}
        <Spacer />
        {clock(40, 150)}
      </HStack>
    ),
    compactLeading: icon(15),
    compactTrailing: clock(15, 58),
    minimal: icon(15),
    expandedLeading: icon(26),
    expandedCenter: labels,
    expandedTrailing: clock(30, 110),
  };
};

export default createLiveActivity('PomodoroActivity', PomodoroActivity);
