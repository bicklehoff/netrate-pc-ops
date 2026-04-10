import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);

export default sql;
