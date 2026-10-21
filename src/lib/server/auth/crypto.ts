import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const KEY_LEN = 64;

/**
 * Hash a password or PIN with scrypt (built into Node — no native add-ons,
 * so it installs cleanly on Windows tills). Format: scrypt$<salt>$<hash>
 */
export async function hashSecret(secret: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await scryptAsync(secret.normalize('NFKC'), salt, KEY_LEN);
	return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifySecret(secret: string, stored: string | null | undefined): Promise<boolean> {
	if (!stored) return false;
	const [algo, saltB64, hashB64] = stored.split('$');
	if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
	const expected = Buffer.from(hashB64, 'base64url');
	const actual = await scryptAsync(secret.normalize('NFKC'), Buffer.from(saltB64, 'base64url'), expected.length);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Random token for cookies. Only its SHA-256 is stored in the database. */
export function generateToken(): string {
	return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}
