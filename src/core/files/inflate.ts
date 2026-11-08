/**
 * La decompressione DEFLATE (RFC 1951), scritta qui perché un .xlsx è uno ZIP compresso e il telefono non ha un modo
 * incorporato per aprirlo. Piccola, senza librerie, provata contro file veri.
 */

const LEN_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LEN_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

type Huffman = { count: Uint16Array; symbol: Uint16Array };

function build(lengths: ArrayLike<number>, n: number): Huffman {
  const count = new Uint16Array(16);
  for (let i = 0; i < n; i++) count[lengths[i]!]!++;
  const offs = new Uint16Array(16);
  for (let i = 1; i < 15; i++) offs[i + 1] = offs[i]! + count[i]!;
  const symbol = new Uint16Array(n);
  for (let i = 0; i < n; i++) if (lengths[i]) symbol[offs[lengths[i]!]!++] = i;
  return { count, symbol };
}

let fixedLit: Huffman | null = null;
let fixedDist: Huffman | null = null;

/** Decomprime un flusso DEFLATE grezzo (senza intestazione zlib). Lancia un errore se i dati sono rotti. */
export function inflate(src: Uint8Array, sizeHint = 0): Uint8Array {
  let out = new Uint8Array(Math.max(sizeHint, src.length * 3, 1024));
  let outLen = 0;
  let pos = 0;
  let bitBuf = 0;
  let bitCnt = 0;

  const need = (extra: number) => {
    if (outLen + extra > out.length) {
      const bigger = new Uint8Array(Math.max(out.length * 2, outLen + extra));
      bigger.set(out.subarray(0, outLen));
      out = bigger;
    }
  };
  const bits = (n: number): number => {
    while (bitCnt < n) {
      if (pos >= src.length) throw new Error('inflate: fine dei dati');
      bitBuf |= src[pos++]! << bitCnt;
      bitCnt += 8;
    }
    const v = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitCnt -= n;
    return v;
  };
  const decode = (h: Huffman): number => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len <= 15; len++) {
      code |= bits(1);
      const c = h.count[len]!;
      if (code - c < first) return h.symbol[index + (code - first)]!;
      index += c;
      first += c;
      first <<= 1;
      code <<= 1;
    }
    throw new Error('inflate: codice non valido');
  };

  const codes = (lit: Huffman, dist: Huffman) => {
    for (;;) {
      let sym = decode(lit);
      if (sym < 256) {
        need(1);
        out[outLen++] = sym;
      } else if (sym === 256) {
        return;
      } else {
        sym -= 257;
        if (sym >= 29) throw new Error('inflate: lunghezza non valida');
        const len = LEN_BASE[sym]! + bits(LEN_EXTRA[sym]!);
        const ds = decode(dist);
        if (ds >= 30) throw new Error('inflate: distanza non valida');
        const d = DIST_BASE[ds]! + bits(DIST_EXTRA[ds]!);
        if (d > outLen) throw new Error('inflate: distanza oltre l’inizio');
        need(len);
        for (let i = 0; i < len; i++) {
          out[outLen] = out[outLen - d]!;
          outLen++;
        }
      }
    }
  };

  let last = 0;
  while (!last) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitBuf = 0;
      bitCnt = 0; // si salta ai byte interi
      if (pos + 4 > src.length) throw new Error('inflate: fine dei dati');
      const len = src[pos]! | (src[pos + 1]! << 8);
      const nlen = src[pos + 2]! | (src[pos + 3]! << 8);
      if (len !== (~nlen & 0xffff)) throw new Error('inflate: blocco non valido');
      pos += 4;
      if (pos + len > src.length) throw new Error('inflate: fine dei dati');
      need(len);
      out.set(src.subarray(pos, pos + len), outLen);
      outLen += len;
      pos += len;
    } else if (type === 1) {
      if (!fixedLit) {
        const l = new Uint8Array(288);
        for (let i = 0; i < 144; i++) l[i] = 8;
        for (let i = 144; i < 256; i++) l[i] = 9;
        for (let i = 256; i < 280; i++) l[i] = 7;
        for (let i = 280; i < 288; i++) l[i] = 8;
        fixedLit = build(l, 288);
        fixedDist = build(new Uint8Array(30).fill(5), 30);
      }
      codes(fixedLit, fixedDist!);
    } else if (type === 2) {
      const nlen = bits(5) + 257;
      const ndist = bits(5) + 1;
      const ncode = bits(4) + 4;
      const lengths = new Uint8Array(320);
      for (let i = 0; i < ncode; i++) lengths[CL_ORDER[i]!] = bits(3);
      const cl = build(lengths, 19);
      let idx = 0;
      const all = new Uint8Array(320);
      while (idx < nlen + ndist) {
        const sym = decode(cl);
        if (sym < 16) {
          all[idx++] = sym;
        } else {
          let prev = 0;
          let rep: number;
          if (sym === 16) {
            if (idx === 0) throw new Error('inflate: ripetizione senza niente prima');
            prev = all[idx - 1]!;
            rep = 3 + bits(2);
          } else if (sym === 17) rep = 3 + bits(3);
          else rep = 11 + bits(7);
          if (idx + rep > nlen + ndist) throw new Error('inflate: troppe lunghezze');
          while (rep--) all[idx++] = prev;
        }
      }
      codes(build(all, nlen), build(all.subarray(nlen), ndist));
    } else {
      throw new Error('inflate: tipo di blocco non valido');
    }
  }
  return out.subarray(0, outLen);
}

export type ZipFiles = Map<string, Uint8Array>;

/** Apre uno ZIP (file «stored» o compressi con DEFLATE) e dà i file per nome. */
export function unzip(bytes: Uint8Array): ZipFiles {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && v.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error('zip: non è un file ZIP');
  const count = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const out: ZipFiles = new Map();
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (v.getUint32(at, true) !== 0x02014b50) throw new Error('zip: elenco rotto');
    const method = v.getUint16(at + 10, true);
    const csize = v.getUint32(at + 20, true);
    const usize = v.getUint32(at + 24, true);
    const nameLen = v.getUint16(at + 28, true);
    const extraLen = v.getUint16(at + 30, true);
    const commentLen = v.getUint16(at + 32, true);
    const local = v.getUint32(at + 42, true);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, inflate(raw, usize));
    else throw new Error(`zip: compressione ${method} non supportata`);
  }
  return out;
}
