import { Redirect } from 'expo-router';

/** L'app si apre sulla Home: la pagina «To do» ha la sua strada (`/todo`). */
export default function Start() {
  return <Redirect href="/home" />;
}
