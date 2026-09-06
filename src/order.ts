/**
 * Stable enumeration for opaque Lync identity strings.
 *
 * This is intentionally UTF-8 byte lexicography, not locale collation and not
 * chronology. Lync readers compare decoded ids as opaque strings; Curare needs
 * only one environment-independent permutation before seeded, set-like work.
 */
const utf8 = new TextEncoder();

export function compareLyncIdentity(a: string, b: string): number {
  if (a === b) return 0;
  const aBytes = utf8.encode(a);
  const bBytes = utf8.encode(b);
  const length = Math.min(aBytes.byteLength, bBytes.byteLength);
  for (let index = 0; index < length; index += 1) {
    if (aBytes[index] < bBytes[index]) return -1;
    if (aBytes[index] > bBytes[index]) return 1;
  }
  return aBytes.byteLength < bBytes.byteLength ? -1 : 1;
}
