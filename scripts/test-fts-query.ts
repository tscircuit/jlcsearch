import Database from 'bun:sqlite';
const db = new Database('db.sqlite3');
console.log('components_fts count for STM32F401RCT6:', db.prepare(`SELECT count(*) as count FROM components_fts WHERE components_fts MATCH '"stm32f401rct6"*'`).get());
console.log('components count for STM32F401RCT6:', db.prepare(`SELECT count(*) as count FROM components WHERE LOWER(mfr) LIKE '%stm32f401rct6%'`).get());
