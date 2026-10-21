import type { ModuleKey, PosModule } from '#lib/core/modules.ts';
import { retail } from './retail';
import { restaurant } from './restaurant';
import { pharmacy } from './pharmacy';
import { salon } from './salon';

/**
 * The module registry. To add a business type, import it here and add it to the list.
 */
export const MODULES: PosModule[] = [retail, restaurant, pharmacy, salon];

export const MODULE_KEYS = MODULES.map((m) => m.key) as ModuleKey[];

export function getModule(key: string): PosModule | undefined {
	return MODULES.find((m) => m.key === key);
}

export function isModuleKey(key: string): key is ModuleKey {
	return MODULE_KEYS.includes(key as ModuleKey);
}

/** Modules a business has switched on, in registry order. */
export function enabledModules(keys: readonly string[]): PosModule[] {
	return MODULES.filter((m) => keys.includes(m.key));
}
