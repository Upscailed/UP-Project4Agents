/**
 * Password hashing met Node's native scrypt — geen externe dependencies.
 * Opslag: "scrypt$N$saltHex$keyHex" zodat het zelf-beschrijvend is.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 1 << 14; // 16384, gebalanceerd voor login (snel genoeg, traag voor brute-force)
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, nStr, saltHex, keyHex] = stored.split('$');
    if (scheme !== 'scrypt') return false;
    const N = parseInt(nStr, 10);
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(keyHex, 'hex');
    const actual = scryptSync(password, salt, expected.length, { N });
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
