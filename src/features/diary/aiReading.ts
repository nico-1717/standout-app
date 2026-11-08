/** I resoconti e i libri che l'IA ha scritto dal diario: l'app li legge soltanto (si creano dal sito, con i crediti). */

export interface AiReportItem {
  id: number;
  year: number;
  quarter: number;
  from: string;
  to: string;
  title: string;
}

export interface AiBookItem {
  id: number;
  title: string;
  from: string;
  to: string;
  done: boolean;
  chapters: number;
}

export interface AiList {
  reports: AiReportItem[];
  books: AiBookItem[];
}

export interface AiReport {
  id: number;
  year: number;
  quarter: number;
  from: string;
  to: string;
  created_at: string;
  content: {
    titolo?: string;
    in_breve?: string;
    pensieri?: string[];
    sentimenti?: string[];
    alti?: string[];
    bassi?: string[];
    temi?: { tema?: string; testo?: string }[];
    abitudini?: string;
    concentrazione?: string;
    spunti?: string[];
  };
  numbers: {
    ora?: Record<string, number | null>;
    prima?: Record<string, number | null>;
    abitudini?: {
      nome: string;
      fatte: number;
      obiettivo: number;
      fatte_prima: number;
      obiettivo_prima: number;
    }[];
  };
}

export interface AiBook {
  id: number;
  title: string;
  from: string;
  to: string;
  done: boolean;
  created_at: string;
  chapters: { title: string; text: string }[];
}

/** Un testo dell'IA diviso in paragrafi (righe vuote), senza paragrafi vuoti. */
export const paragraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/u)
    .map((p) => p.trim())
    .filter(Boolean);

/** Freccia di confronto con il trimestre prima: ↑ ↓ = (niente se manca uno dei due). */
export function trend(now: number | null | undefined, before: number | null | undefined): string {
  if (now == null || before == null) return '';
  return now > before ? ' ↑' : now < before ? ' ↓' : ' =';
}
