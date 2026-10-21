import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'PostgreSQL connection string.' },
	PUBLIC_APP_NAME: {
		description: 'Product name shown in the app, on the login page and on receipts.',
		public: true,
		schema: (value: string | undefined) => value || "POS System"
	}
});
