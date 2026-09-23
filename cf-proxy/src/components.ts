import { Component } from './db/types';

// Existing code that fetches components from the database
export async function getComponentById(id: string): Promise<Component | null> {
  const db = await getD1Client();
  const row = await db.prepare('SELECT * FROM components WHERE id = ?').bind(id).first();
  if (!row) return null;
  // Map database row to Component type
  const component: Component = {
    id: row.id,
    name: row.name,
    // ... map other existing fields
    is_extended_promotional: row.is_extended_promotional ?? false,
  };
  return component;
}
