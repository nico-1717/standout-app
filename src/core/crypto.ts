import * as ExpoCrypto from 'expo-crypto';

/**
 * `uuidv7` ha bisogno di `crypto.getRandomValues`: in Node c'è, su Hermes (il motore JS del
 * telefono) no. Si importa questo file una volta all'avvio.
 */
const g = globalThis as unknown as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
if (!g.crypto?.getRandomValues) {
  g.crypto = {
    ...(g.crypto ?? {}),
    getRandomValues: (a) => ExpoCrypto.getRandomValues(a as never) as never,
  };
}
