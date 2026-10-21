import { defineConfig } from 'drizzle-kit';

// Load variables from .env (Node 20.12+ / 21.7+)
try {
	process.loadEnvFile('.env');
} catch {
	// no .env file — rely on real environment variables
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema/index.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	strict: true
});
