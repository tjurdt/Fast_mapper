/** 最小 ZIP（store，無壓縮）寫入器。移植自 legacy crc32 / buildZip。 */

export function crc32(buf: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

const u16 = (n: number) => [n & 255, (n >> 8) & 255];
const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function buildZip(files: ZipEntry[]): Uint8Array {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nm = utf8(f.name);
    const dt = f.data;
    const crc = crc32(dt);
    const lh = [
      0x50,
      0x4b,
      3,
      4,
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(dt.length),
      ...u32(dt.length),
      ...u16(nm.length),
      ...u16(0),
    ];
    local.push(new Uint8Array(lh), nm, dt);
    const ch = [
      0x50,
      0x4b,
      1,
      2,
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(dt.length),
      ...u32(dt.length),
      ...u16(nm.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
    ];
    central.push(new Uint8Array(ch), nm);
    offset += lh.length + nm.length + dt.length;
  }

  const centralSize = central.reduce((s, x) => s + x.length, 0);
  const end = [
    0x50,
    0x4b,
    5,
    6,
    ...u16(0),
    ...u16(0),
    ...u16(files.length),
    ...u16(files.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),
  ];

  const chunks = [...local, ...central, new Uint8Array(end)];
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}
