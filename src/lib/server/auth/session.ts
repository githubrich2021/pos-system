import type { Cookies } from '@sveltejs/kit';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, schema } from '../db';
import { generateToken, sha256 } from './crypto';

export const SESSION_COOKIE = 'pos_session';
export const DEVICE_COOKIE = 'pos_device';

const DAY = 24 * 60 * 60 * 1000;
/** Password sessions last 30 days; PIN sessions end after one working day. */
const SESSION_LENGTH = { password: 30 * DAY, pin: 14 * 60 * 60 * 1000 } as const;

export async function createSession(
	cookies: Cookies,
	userId: string,
	method: 'password' | 'pin',
	deviceId: string | null = null
) {
	const token = generateToken();
	const expiresAt = new Date(Date.now() + SESSION_LENGTH[method]);
	await db.insert(schema.sessions).values({ id: sha256(token), userId, method, deviceId, expiresAt });
	await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId));
	cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', expires: expiresAt });
}

export async function destroySession(cookies: Cookies) {
	const token = cookies.get(SESSION_COOKIE);
	if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** Look up the signed-in user, their role and their business from the session cookie. */
export async function validateSession(token: string) {
	const [row] = await db
		.select({
			session: schema.sessions,
			user: schema.users,
			role: schema.roles,
			tenant: schema.tenants
		})
		.from(schema.sessions)
		.innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
		.innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
		.innerJoin(schema.tenants, eq(schema.tenants.id, schema.users.tenantId))
		.where(
			and(
				eq(schema.sessions.id, sha256(token)),
				gt(schema.sessions.expiresAt, new Date()),
				eq(schema.users.isActive, true)
			)
		)
		.limit(1);
	return row ?? null;
}

/** The till this browser is registered as, if any. */
export async function validateDevice(token: string) {
	const [device] = await db
		.select()
		.from(schema.devices)
		.where(and(eq(schema.devices.tokenHash, sha256(token)), isNull(schema.devices.revokedAt)))
		.limit(1);
	return device ?? null;
}

export function setDeviceCookie(cookies: Cookies, token: string) {
	cookies.set(DEVICE_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365 * 5
	});
}
