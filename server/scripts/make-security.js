import pg from 'pg';

// Makes an account Campus Security: npm run make-security -- admin@my.bcit.ca
// Creates the account if it hasn't logged in yet. Uses DATABASE_URL (default: the Docker database).
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error('Usage: npm run make-security -- <email>');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/campus_claim',
});
try {
  await pool.query(
    `INSERT INTO users (school_email, role) VALUES ($1, 'security')
     ON CONFLICT (school_email) DO UPDATE SET role = 'security'`,
    [email],
  );
  console.log(`${email} is now Campus Security. Log out and back in to pick it up.`);
} finally {
  await pool.end();
}
