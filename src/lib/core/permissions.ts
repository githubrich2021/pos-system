/**
 * Every action a user can take is guarded by a permission key.
 * Roles are just named lists of these keys, so owners can build custom roles.
 *
 * Core permissions live here. Business modules add their own (see each module's index.ts).
 */
export const CORE_PERMISSIONS = {
	'sales.create': 'Make sales',
	'sales.discount': 'Give discounts',
	'sales.refund': 'Refund sales',
	'sales.void': 'Void sales',
	'products.view': 'View products',
	'products.manage': 'Add and edit products and prices',
	'stock.adjust': 'Adjust stock levels',
	'customers.manage': 'Manage customers',
	'shifts.manage': 'Open and close shifts',
	'reports.view': 'View reports',
	'staff.manage': 'Manage staff and roles',
	'settings.manage': 'Change business settings and modules',
	'devices.manage': 'Set up tills and devices'
} as const;

export type CorePermission = keyof typeof CORE_PERMISSIONS;

/** A permission key — core or module-defined (e.g. "restaurant.tables.manage"). */
export type Permission = CorePermission | (string & {});

/** "*" grants everything. Only the Owner role has it by default. */
export const ALL = '*';

export function can(granted: readonly string[] | undefined, permission: Permission): boolean {
	if (!granted) return false;
	return granted.includes(ALL) || granted.includes(permission);
}

/** Default roles created for every new business. */
export const DEFAULT_ROLES: { name: string; permissions: string[] }[] = [
	{ name: 'Owner', permissions: [ALL] },
	{
		name: 'Manager',
		permissions: [
			'sales.create',
			'sales.discount',
			'sales.refund',
			'sales.void',
			'products.view',
			'products.manage',
			'stock.adjust',
			'customers.manage',
			'shifts.manage',
			'reports.view',
			'staff.manage',
			'devices.manage'
		]
	},
	{
		name: 'Cashier',
		permissions: ['sales.create', 'products.view', 'customers.manage', 'shifts.manage']
	},
	{ name: 'Accountant', permissions: ['products.view', 'reports.view'] }
];
