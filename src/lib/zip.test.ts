import { describe, expect, it } from "vitest";
import { createZip } from "./zip";

async function blobBytes(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await b.arrayBuffer());
}

describe("createZip", () => {
  it("crc32 matches the well-known test vector for a pangram", async () => {
    const data = new TextEncoder().encode("The quick brown fox jumps over the lazy dog");
    const zip = await blobBytes(createZip([{ name: "a.txt", data }]));
    const view = new DataView(zip.buffer);
    // Local file header: signature(4) version(2) flags(2) method(2) time(2) date(2) crc32(4)…
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(14, true)).toBe(0x414fa339); // known CRC-32("The quick brown fox jumps over the lazy dog")
  });

  it("stores each file's exact bytes (method 0, no compression) and they land back at the right offset", async () => {
    const files = [
      { name: "prvni.csv", data: new TextEncoder().encode("a;b;c\n1;2;3\n") },
      { name: "druhy.txt", data: new TextEncoder().encode("žluťoučký kůň") },
    ];
    const zip = await blobBytes(createZip(files));
    const view = new DataView(zip.buffer);

    let offset = 0;
    for (const f of files) {
      expect(view.getUint32(offset, true)).toBe(0x04034b50);
      expect(view.getUint16(offset + 8, true)).toBe(0); // stored, not deflated
      const nameLen = view.getUint16(offset + 26, true);
      const size = view.getUint32(offset + 18, true);
      expect(size).toBe(f.data.length);
      const name = new TextDecoder().decode(zip.slice(offset + 30, offset + 30 + nameLen));
      expect(name).toBe(f.name);
      const body = zip.slice(offset + 30 + nameLen, offset + 30 + nameLen + size);
      expect(Array.from(body)).toEqual(Array.from(f.data));
      offset += 30 + nameLen + size;
    }
  });

  it("end-of-central-directory reports the right entry count", async () => {
    const files = [
      { name: "x.csv", data: new TextEncoder().encode("x") },
      { name: "y.csv", data: new TextEncoder().encode("y") },
      { name: "z.csv", data: new TextEncoder().encode("z") },
    ];
    const zip = await blobBytes(createZip(files));
    const view = new DataView(zip.buffer);
    // Find EOCD signature from the end (no comment written, so it's the last 22 bytes).
    const eocdOffset = zip.length - 22;
    expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);
    expect(view.getUint16(eocdOffset + 8, true)).toBe(3);
    expect(view.getUint16(eocdOffset + 10, true)).toBe(3);
  });

  it("produces an empty-but-valid archive for zero entries", async () => {
    const zip = await blobBytes(createZip([]));
    expect(zip.length).toBe(22);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x06054b50);
  });
});
