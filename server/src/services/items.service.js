import { query } from '../config/db.js';

const PUBLIC_FIELDS = `
  id,
  title,
  category,
  location,
  building,
  latitude,
  longitude,
  created_at AS "postedAt",
  status
`;

const EDITABLE_FIELDS = {
  title: 'title',
  category: 'category',
  location: 'location',
  building: 'building',
  latitude: 'latitude',
  longitude: 'longitude',
  sensitive: 'is_sensitive',
};

// Retrieves ownership information before an edit is attempted. The controller
// uses finder_id for authorization and does not expose it in the API response.
export async function getItemById(id) {
  const { rows } = await query(
    `SELECT id, finder_id
     FROM items
     WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

// Updates only the allowlisted item fields. Column names come from a fixed map;
// all user-provided values remain PostgreSQL parameters.
export async function updateItem(id, changes) {
  const entries = Object.entries(changes)
    .filter(([field, value]) => EDITABLE_FIELDS[field] && value !== undefined);

  if (!entries.length) return null;

  const values = [];
  const assignments = entries.map(([field, value]) => {
    values.push(value);
    return `${EDITABLE_FIELDS[field]} = $${values.length}`;
  });
  values.push(id);

  const { rows } = await query(
    `UPDATE items
     SET ${assignments.join(', ')}
     WHERE id = $${values.length}
     RETURNING ${PUBLIC_FIELDS}`,
    values
  );
  return rows[0] ?? null;
}
