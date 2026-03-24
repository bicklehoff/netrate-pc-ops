import { PrismaClient } from '@/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neon } from '@neondatabase/serverless';

export async function GET(request) {
  const results = {};

  try {
    // Step 1: Raw SQL — does the row exist?
    const sql = neon(process.env.DATABASE_URL);
    const rawRows = await sql`SELECT * FROM mlos WHERE email = 'david@netratemortgage.com'`;
    results.rawSql = { success: true, columns: rawRows.length > 0 ? Object.keys(rawRows[0]) : [], rowCount: rawRows.length };
  } catch (e) {
    results.rawSql = { success: false, error: e.message };
  }

  try {
    // Step 2: Prisma query with logging
    const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
    const prisma = new PrismaClient({
      adapter,
      log: ['query', 'error', 'warn'],
    });

    const mlo = await prisma.mlo.findUnique({
      where: { email: 'david@netratemortgage.com' },
    });

    results.prismaQuery = { success: true, found: !!mlo, fields: mlo ? Object.keys(mlo) : [] };
    await prisma.$disconnect();
  } catch (e) {
    results.prismaQuery = { success: false, error: e.message, code: e.code, meta: e.meta };
  }

  try {
    // Step 3: List ALL tables and their columns to find schema drift
    const sql = neon(process.env.DATABASE_URL);
    const allCols = await sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('mlos', 'loans', 'documents', 'call_logs', 'call_notes', 'sms_messages', 'hecm_scenarios')
      ORDER BY table_name, ordinal_position
    `;

    const byTable = {};
    for (const row of allCols) {
      if (!byTable[row.table_name]) byTable[row.table_name] = [];
      byTable[row.table_name].push(row.column_name);
    }
    results.dbSchema = byTable;
  } catch (e) {
    results.dbSchema = { error: e.message };
  }

  return Response.json(results, { status: 200 });
}
