import { searchComponents } from '../src/search';
import { Component } from '../src/db/types';

test('searchComponents returns components with is_extended_promotional field', async () => {
  const results: Component[] = await searchComponents('test');
  expect(results).toBeInstanceOf(Array);
  if (results.length > 0) {
    const comp = results[0];
    // The field should be present and default to false if not set
    expect(comp).toHaveProperty('is_extended_promotional');
    expect(typeof comp.is_extended_promotional).toBe('boolean');
  }
});
