/** Small helpers for reading form fields safely. */
export function field(form: FormData, name: string): string {
	const v = form.get(name);
	return typeof v === 'string' ? v.trim() : '';
}

export function checkbox(form: FormData, name: string): boolean {
	return form.get(name) === 'on' || form.get(name) === 'true';
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const isPin = (v: string) => /^\d{4,6}$/.test(v);
