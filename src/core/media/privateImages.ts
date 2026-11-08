/** Dove si tengono sul telefono le immagini private già scaricate (separato per poter provare senza telefono). */
export interface PrivateFiles {
  /** l'indirizzo locale del file con questa chiave, se c'è già */
  existing(key: string): string | null;
  /** scarica l'indirizzo con queste intestazioni e tiene il file con questa chiave */
  download(url: string, headers: Record<string, string>, key: string): Promise<string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** I nomi che sceglie il server per le immagini private del to buy. */
const NAME = /^b[0-9]+_[0-9a-f]{20}\.(jpg|png|webp|gif)$/;

/**
 * Le immagini degli articoli del to buy non hanno un indirizzo pubblico: il sito le dà solo con il token. Si scaricano una
 * volta e restano sul telefono; il nome del file cambia a ogni nuova immagine, quindi la copia tenuta non è mai vecchia.
 */
export class PrivateImages {
  private readonly pending = new Map<string, Promise<string | null>>();

  constructor(
    private readonly baseUrl: string,
    private readonly token: () => Promise<string>,
    private readonly files: PrivateFiles,
    private readonly appVersion = '0.0.0',
    private readonly platform = 'unknown',
  ) {}

  /** L'immagine di un articolo (riga `uuid`, file `name`): l'indirizzo locale, o null se non si riesce (offline, tolta). */
  get(uuid: string, name: string | null | undefined): Promise<string | null> {
    if (!name || !NAME.test(name) || !UUID.test(uuid)) return Promise.resolve(null);
    const key = name;
    const have = this.files.existing(key);
    if (have) return Promise.resolve(have);
    const running = this.pending.get(key);
    if (running) return running;
    const p = this.fetch(uuid, key).finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }

  private async fetch(uuid: string, key: string): Promise<string | null> {
    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/api/v1/media/todos/${uuid}/buy_image`;
      return await this.files.download(
        url,
        {
          Authorization: `Bearer ${await this.token()}`,
          'X-App-Version': this.appVersion,
          'X-App-Platform': this.platform,
        },
        key,
      );
    } catch {
      return null;
    }
  }
}
