/**
 * Simple in-memory limiter to slow down password and PIN guessing.
 * Fine for one server process; swap for a database or Redis limiter when you scale out.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

export function tooManyAttempts(key: string, max = 5, windowMs = 5 * 60 * 1000): boolean {
	const now = Date.now();
	const entry = attempts.get(key);
	if (!entry || entry.resetAt < now) {
		attempts.set(key, { count: 1, resetAt: now + windowMs });
		return false;
	}
	entry.count++;
	return entry.count > max;
}

export function clearAttempts(key: string) {
	attempts.delete(key);
}
