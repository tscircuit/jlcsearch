import { getDbClient } from '../lib/db/get-db-client';
import { componentSearchFTS } from '../lib/db/optimizations/component-search-fts';
import { sql } from 'kysely';

async function run() {
  const db = getDbClient();
  await sql`DROP TABLE IF EXISTS components_fts`.execute(db);
  await sql`DROP TRIGGER IF EXISTS components_ai`.execute(db);
  await sql`DROP TRIGGER IF EXISTS components_au`.execute(db);
  await sql`DROP TRIGGER IF EXISTS components_ad`.execute(db);
  await componentSearchFTS.execute(db);
  console.log('Rebuilt components_fts!');
}
run();
