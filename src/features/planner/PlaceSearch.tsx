import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import type { PlaceHit, PlacePoint } from '@/core/account/accountApi';

import type { PickedPlace } from './BookParts';
import type { PlannerTheme } from './plannerTheme';

/**
 * La ricerca dei posti e la mappa (P9/P10). Come sul sito (`09_popup_evento.js`): mentre si scrive, a frase quasi
 * finita (3 lettere, mezzo secondo di pausa), il sito propone dei posti; toccandone uno si prendono nome, indirizzo e
 * coordinate (con Google le coordinate arrivano con una seconda chiamata, solo per il posto scelto). Scrivendo a mano
 * l'aggancio cade. Serve rete: senza, il testo resta com'è e non si propone niente.
 */

/** Pausa dopo l'ultima lettera, prima di cercare. */
export const SEARCH_DELAY_MS = 500;

/** Quello che serve dal sito: la ricerca e le coordinate. Senza (nei test, o senza account) la ricerca non c'è. */
export interface PlacesApi {
  placeSearch(q: string, lang: string): Promise<PlaceHit[]>;
  placeDetails(ref: string, lang: string): Promise<PlacePoint | null>;
}

export interface PlaceSearchState {
  /** null = elenco chiuso; [] = cercato, niente trovato */
  hits: PlaceHit[] | null;
  /** chiamare a ogni lettera scritta */
  type: (text: string) => void;
  /** chiude l'elenco e butta via le risposte in volo */
  close: () => void;
}

export function usePlaceSearch(account: PlacesApi | undefined, lang: string): PlaceSearchState {
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    seq.current++;
    setHits(null);
  }, []);

  const type = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const q = text.trim();
      if (!account || q.length < 3) {
        seq.current++;
        setHits(null);
        return;
      }
      timer.current = setTimeout(() => {
        const mine = ++seq.current;
        account
          .placeSearch(q, lang)
          .then((r) => {
            if (mine === seq.current) setHits(r);
          })
          .catch(() => {
            // rete assente o limite raggiunto: niente elenco, il testo resta com'è
            if (mine === seq.current) setHits(null);
          });
      }, SEARCH_DELAY_MS);
    },
    [account, lang],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { hits, type, close };
}

export interface PlacePickState {
  place: PickedPlace | null;
  waiting: boolean;
  notFound: boolean;
  pick: (h: PlaceHit) => void;
  clear: () => void;
}

/** Il posto scelto dall'elenco, con le coordinate che arrivano (una volta sola) se la ricerca non le dava già. */
export function usePlacePick(account: PlacesApi | undefined, lang: string): PlacePickState {
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const wanted = useRef<string | null>(null);

  const clear = useCallback(() => {
    wanted.current = null;
    setPlace(null);
    setWaiting(false);
    setNotFound(false);
  }, []);

  const pick = useCallback(
    (h: PlaceHit) => {
      wanted.current = null;
      setNotFound(false);
      setPlace({ name: h.name, lat: h.lat, lon: h.lon, ref: h.ref || null });
      if ((h.lat !== null && h.lon !== null) || !h.ref || !account) {
        setWaiting(false);
        return;
      }
      wanted.current = h.ref;
      setWaiting(true);
      account
        .placeDetails(h.ref, lang)
        .then((point) => {
          if (wanted.current !== h.ref) return;
          wanted.current = null;
          setWaiting(false);
          if (!point) return setNotFound(true);
          setPlace((now) =>
            now && now.ref === h.ref ? { ...now, lat: point.lat, lon: point.lon } : now,
          );
        })
        .catch(() => {
          if (wanted.current !== h.ref) return;
          wanted.current = null;
          setWaiting(false);
          setNotFound(true);
        });
    },
    [account, lang],
  );

  return { place, waiting, notFound, pick, clear };
}

/** L'elenco dei posti proposti, sotto il campo. */
export function PlaceHits({
  pt,
  hits,
  onPick,
}: {
  pt: PlannerTheme;
  hits: PlaceHit[] | null;
  onPick: (h: PlaceHit) => void;
}) {
  const { t } = useTranslation();
  if (hits === null) return null;
  return (
    <View
      testID="place-hits"
      style={{
        marginTop: 6,
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: pt.hair2,
        backgroundColor: pt.card,
        overflow: 'hidden',
      }}
    >
      {hits.length === 0 ? (
        <Text style={{ color: pt.ink3, padding: 12, fontFamily: pt.sans }}>
          {t('planner.nessun_posto_trovato')}
        </Text>
      ) : (
        hits.map((h, i) => (
          <Pressable
            key={`${h.ref}-${i}`}
            testID={`place-hit-${i}`}
            accessibilityRole="button"
            accessibilityLabel={h.full}
            onPress={() => onPick(h)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderTopWidth: i ? 0.5 : 0,
              borderColor: pt.hair,
            }}
          >
            <Text style={{ color: pt.ink, fontSize: 15, fontFamily: pt.sans }}>{h.name}</Text>
            {h.detail ? (
              <Text style={{ color: pt.ink3, fontSize: 12, fontFamily: pt.sans }}>{h.detail}</Text>
            ) : null}
          </Pressable>
        ))
      )}
    </View>
  );
}

/** Il posto nella app Mappe del telefono (Apple Mappe su iPhone, Google Maps o quello che c'è su Android). */
export function mapsUrl(lat: number, lon: number, name: string | null, os: string): string {
  const label = encodeURIComponent(name ?? '');
  if (os === 'ios') return `https://maps.apple.com/?ll=${lat},${lon}&q=${label}`;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

/**
 * Quello che si sa del posto scelto: il segnaposto con il nome (si toglie), la mappa piccola e «Apri nella mappa».
 * `waiting` = le coordinate stanno arrivando.
 */
export function PlaceStatus({
  pt,
  place,
  waiting,
  onClear,
}: {
  pt: PlannerTheme;
  place: PickedPlace;
  waiting: boolean;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const has = place.lat !== null && place.lon !== null;
  if (!has && !waiting) return null;
  return (
    <View testID="place-status" style={{ marginTop: 8, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            flexShrink: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: pt.accentSoft,
          }}
        >
          <Text style={{ color: pt.ink, fontSize: 13, fontFamily: pt.sans }} numberOfLines={1}>
            {'📍 '}
            {place.name || t('planner.posizione_salvata')}
          </Text>
          {waiting ? <ActivityIndicator testID="place-waiting" size="small" /> : null}
        </View>
        <Pressable
          testID="place-clear"
          accessibilityRole="button"
          accessibilityLabel={t('comune.rimuovi')}
          hitSlop={10}
          onPress={onClear}
        >
          <Text style={{ color: pt.ink3, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>
      {has ? (
        <>
          <PlaceMap pt={pt} lat={place.lat!} lon={place.lon!} name={place.name} />
          <Pressable
            testID="place-open-map"
            accessibilityRole="button"
            onPress={() =>
              void Linking.openURL(mapsUrl(place.lat!, place.lon!, place.name, Platform.OS))
            }
          >
            <Text style={{ color: pt.accentInk, fontFamily: pt.sans, fontWeight: '600' }}>
              {t('planner.apri_nella_mappa')}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

/** La mappa piccola del posto: Apple Mappe su iPhone, Google Maps su Android. Ferma: per muoversi si apre la mappa vera. */
export function PlaceMap({
  pt,
  lat,
  lon,
  name,
}: {
  pt: PlannerTheme;
  lat: number;
  lon: number;
  name: string | null;
}) {
  const { t } = useTranslation();
  return (
    <View
      testID="place-map"
      accessibilityLabel={t('planner.mappa_del_luogo')}
      style={{
        height: 150,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: pt.hair2,
      }}
    >
      <MapView
        // un posto nuovo = una mappa nuova, già centrata
        key={`${lat},${lon}`}
        style={{ flex: 1 }}
        initialRegion={{ latitude: lat, longitude: lon, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        pointerEvents="none"
      >
        <Marker coordinate={{ latitude: lat, longitude: lon }} title={name ?? undefined} />
      </MapView>
    </View>
  );
}
