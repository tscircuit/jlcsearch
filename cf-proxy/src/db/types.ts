// Existing imports and other types
export interface Component {
  id: string;
  name: string;
  // ... other existing fields
  // New field to indicate if the component is an extended promotional item
  is_extended_promotional?: boolean;
}
