import type { Component } from 'svelte';
import type { Permission } from './permissions';

/**
 * The contract every business module follows.
 *
 * The core never imports a specific module directly — it only reads this shape from the
 * registry. To add a new business type (hotel, fuel station…), create a folder in
 * src/lib/modules/, export a PosModule, and add it to the registry. Nothing else changes.
 */
export type ModuleKey = 'retail' | 'restaurant' | 'pharmacy' | 'salon';

export interface NavItem {
	label: string;
	href: string;
	icon: Component;
	/** Hide the link from users without this permission. */
	permission?: Permission;
}

export interface CustomField {
	key: string;
	label: string;
	/** 'money' is entered in cedis and stored in pesewas, like every other price. */
	type: 'text' | 'number' | 'money' | 'date' | 'boolean';
	required?: boolean;
}

export interface PosModule {
	key: ModuleKey;
	name: string;
	description: string;
	icon: Component;
	/** 'available' modules are finished; 'preview' ones can be switched on but are still being built. */
	status: 'available' | 'preview';
	/** Roadmap phase the module is planned for. */
	phase: number;
	/** Links added to the app sidebar when the module is switched on. */
	nav: NavItem[];
	/** Extra permissions the module adds to the role editor. */
	permissions: Record<string, string>;
	/** Extra fields shown on the product form when the module is on (stored in products.custom_fields). */
	productFields: CustomField[];
}

/** Modules switched on automatically for every new business. */
export const DEFAULT_MODULE_KEYS: ModuleKey[] = ['retail'];
