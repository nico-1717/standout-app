import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Il vecchio indirizzo della scheda di un progetto: ora la scheda sta dentro la pagina Progetti (come sul sito,
 * progetti.php?id=…). Chi ha ancora il vecchio collegamento arriva allo stesso posto.
 */
export default function ProjectRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <Redirect
      href={typeof id === 'string' ? { pathname: '/projects', params: { id } } : '/projects'}
    />
  );
}
