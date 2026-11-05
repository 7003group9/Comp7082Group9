import { query } from '../config/db.js';

const PUBLIC_FIELDS = `
  id,
  title,
  category,
  location,
  latitude,
  longitude,
  created_at AS "postedAt",
  status
`;

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;

const likePattern = (value) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;

const EDITABLE_FIELDS = {
  title: 'title',
  category: 'category',
  location: 'location',
  latitude: 'latitude',
  longitude: 'longitude',
  sensitive: 'is_sensitive',
};

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

function parseDate(value, fieldName) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    error.status = 400;
    throw error;
  }
  return date.toISOString();
}

// Fetches public items using only parameterized values. Drafts are stored in a
// separate table, so excluding them is implicit in querying items.
export async function fetchItems({
  q = '',
  category = '',
  location = '',
  date = '',
  dateTo = '',
  page = 1,
  limit = PAGE_SIZE_DEFAULT,
  before = null,
} = {}) {
  const values = [];
  const conditions = [
    'i.is_sensitive = FALSE',
    "i.status <> 'handed off'",
  ];

  const addValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (q) {
    const parameter = addValue(likePattern(q));
    conditions.push(`(i.title ILIKE ${parameter} OR i.location ILIKE ${parameter})`);
  }
  if (category) conditions.push(`i.category = ${addValue(category)}`);
  if (location) conditions.push(`i.location = ${addValue(location)}`);
  if (date) conditions.push(`i.created_at >= ${addValue(parseDate(date, 'date'))}`);
  if (dateTo) conditions.push(`i.created_at < ${addValue(parseDate(dateTo, 'dateTo'))}`);

  const parsedBefore = before == null || before === ''
    ? null
    : positiveInteger(before, null);
  if (parsedBefore !== null) conditions.push(`i.id < ${addValue(parsedBefore)}`);

  const parsedPage = positiveInteger(page, 1);
  const parsedLimit = positiveInteger(limit, PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX);
  const offset = (parsedPage - 1) * parsedLimit;

  values.push(parsedLimit + 1, offset);
  const limitParameter = `$${values.length - 1}`;
  const offsetParameter = `$${values.length}`;

  const text = `
    SELECT ${PUBLIC_FIELDS}
    FROM items i
    WHERE ${conditions.join('\n      AND ')}
    ORDER BY i.created_at DESC, i.id DESC
    LIMIT ${limitParameter}
    OFFSET ${offsetParameter}
  `;

  const { rows } = await query(text, values);
  const items = rows.slice(0, parsedLimit);
  return {
    items,
    page: parsedPage,
    limit: parsedLimit,
    hasMore: rows.length > parsedLimit,
  };
}

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
