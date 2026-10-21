import { LayoutDashboard, Package, Settings } from '@lucide/svelte';
import type { NavItem } from './core/modules';
import { can } from './core/permissions';
import { enabledModules } from './modules';

const CORE_TOP: NavItem[] = [
	{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
	{ label: 'Products', href: '/products', icon: Package, permission: 'products.view' }
];

/**
 * Builds the sidebar from the core links plus whatever the business's
 * switched-on modules add. Links the user has no permission for are hidden.
 */
export function buildNav(moduleKeys: string[], permissions: string[]) {
	const visible = (item: NavItem) => !item.permission || can(permissions, item.permission);
	const moduleItems = enabledModules(moduleKeys).flatMap((m) => m.nav);

	const showSettings = ['settings.manage', 'staff.manage', 'devices.manage'].some((p) => can(permissions, p));

	return {
		main: [...moduleItems, ...CORE_TOP].filter(visible).sort((a, b) =>
			// Keep Dashboard first
			a.href === '/dashboard' ? -1 : b.href === '/dashboard' ? 1 : 0
		),
		bottom: showSettings ? [{ label: 'Settings', href: '/settings', icon: Settings } as NavItem] : []
	};
}
