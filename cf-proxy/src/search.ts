import { Component } from './db/types';

// Update search results to include the new field
export async function searchComponents(query: string): Promise<Component[]> {
  const db = await getD1Client();
  const rows = await db.prepare(`
    SELECT *
    FROM components
    WHERE name LIKE ? OR description LIKE ?
  `).bind(`%${query}%`, `%${query}%`).all();

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    // ... map other existing fields
    is_extended_promotional: row.is_extended_promotional ?? false,
  }));
}
