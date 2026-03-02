
import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/client.ts';
const p = new PrismaClient();
try {
  const tables = await p.("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables:', JSON.stringify(tables, null, 2));
  const loanCols = await p.("SELECT column_name FROM information_schema.columns WHERE table_name = 'loans' ORDER BY ordinal_position");
  console.log('Loan columns:', JSON.stringify(loanCols.map(c => c.column_name)));
} catch(e) {
  console.error('Error:', e.message);
} finally {
  await p.();
}
