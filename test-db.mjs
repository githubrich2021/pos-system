import postgres from 'postgres';

const url = process.env.DATABASE_URL;
console.log('Connecting to:', url?.replace(/:[^:@/]+@/, ':****@'));

const sql = postgres(url, { connect_timeout: 10 });

try {
  const result = await sql`SELECT version()`;
  console.log('✅ Connected:', result[0].version);
} catch (err) {
  console.error('❌ Failed:', err.code, err.message);
} finally {
  await sql.end();
}