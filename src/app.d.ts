import type { ModuleKey } from '#lib/core/modules.ts';

declare global {
	namespace App {
		interface Locals {
			/** The signed-in user and their business. null when signed out. */
			auth: {
				userId: string;
				name: string;
				email: string | null;
				roleName: string;
				permissions: string[];
				tenantId: string;
				tenantName: string;
				currency: string;
				branchId: string;
				modules: ModuleKey[];
				method: 'password' | 'pin';
			} | null;
			/** The till this browser is registered as. null on an unregistered browser. */
			device: {
				id: string;
				tenantId: string;
				branchId: string;
				name: string;
				code: string;
			} | null;
		}
	}
}

export {};
