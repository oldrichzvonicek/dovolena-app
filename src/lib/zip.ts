/**
 * Minimalistický ZIP writer (uložení bez komprese — metoda "stored"), bez závislosti na externí knihovně.
 * Mzdový balíček spojuje pár malých textových/Excel souborů do jednoho stažení; komprese by tu nic
 * nepřinesla a přidávat kvůli tomu novou npm závislost (mění se tím package.json/package-lock.json,
 * které teď sdílí souběžně rozpracovaná větev) by stálo víc, než to je hodno.
 * Formát: https://en.wikipedia.org/wiki/ZIP_(file_format) — jen lokální hlavičky + centrální adresář, žádný ZIP64.
 */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

// CRC-32 (standardní ZIP/PNG polynom), tabulka se spočítá jednou při prvním použití.
let crcTable: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}
function crc32(data: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

function writeUint32LE(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}
function writeUint16LE(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

/** Sestaví .zip (Blob) z pojmenovaných souborů. Jména bez podadresářů — pro tenhle účel stačí. */
export function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(new Date());
  const chunks: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    writeUint32LE(lv, 0, 0x04034b50); // local file header signature
    writeUint16LE(lv, 4, 20); // version needed
    writeUint16LE(lv, 6, 0); // flags
    writeUint16LE(lv, 8, 0); // method 0 = stored
    writeUint16LE(lv, 10, time);
    writeUint16LE(lv, 12, date);
    writeUint32LE(lv, 14, crc);
    writeUint32LE(lv, 18, size); // compressed size
    writeUint32LE(lv, 22, size); // uncompressed size
    writeUint16LE(lv, 26, nameBytes.length);
    writeUint16LE(lv, 28, 0); // extra field length
    localHeader.set(nameBytes, 30);

    chunks.push(localHeader, entry.data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    writeUint32LE(cv, 0, 0x02014b50); // central directory signature
    writeUint16LE(cv, 4, 20); // version made by
    writeUint16LE(cv, 6, 20); // version needed
    writeUint16LE(cv, 8, 0); // flags
    writeUint16LE(cv, 10, 0); // method
    writeUint16LE(cv, 12, time);
    writeUint16LE(cv, 14, date);
    writeUint32LE(cv, 16, crc);
    writeUint32LE(cv, 20, size);
    writeUint32LE(cv, 24, size);
    writeUint16LE(cv, 28, nameBytes.length);
    writeUint16LE(cv, 30, 0); // extra length
    writeUint16LE(cv, 32, 0); // comment length
    writeUint16LE(cv, 34, 0); // disk number start
    writeUint16LE(cv, 36, 0); // internal attrs
    writeUint32LE(cv, 38, 0); // external attrs
    writeUint32LE(cv, 42, offset); // relative offset of local header
    central.set(nameBytes, 46);
    centralRecords.push(central);

    offset += localHeader.length + entry.data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of centralRecords) centralSize += c.length;

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  writeUint32LE(ev, 0, 0x06054b50); // end of central directory signature
  writeUint16LE(ev, 4, 0); // disk number
  writeUint16LE(ev, 6, 0); // disk with central directory
  writeUint16LE(ev, 8, entries.length); // entries on this disk
  writeUint16LE(ev, 10, entries.length); // total entries
  writeUint32LE(ev, 12, centralSize);
  writeUint32LE(ev, 16, centralStart);
  writeUint16LE(ev, 20, 0); // comment length

  // TS's DOM lib types Blob's parts as ArrayBufferView<ArrayBuffer> specifically; our Uint8Arrays are typed
  // ArrayBufferLike (fine at runtime — none of them are ever backed by a SharedArrayBuffer here).
  return new Blob([...chunks, ...centralRecords, end] as BlobPart[], { type: "application/zip" });
}
