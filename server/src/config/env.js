// Settings read from environment variables (.env), with local dev defaults.
export const PORT = Number(process.env.PORT) || 3000;
export const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/campus_claim';
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'; // signs login tokens
// Anyone who knows the secret can make a token for any user, Campus Security included.
// The defaults are public in this repo, so production needs its own long random one.
if (process.env.NODE_ENV === 'production' && (['dev-secret', 'change-me'].includes(JWT_SECRET) || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters when NODE_ENV=production');
}
// Only emails ending in @<this domain> can get a login code.
export const STUDENT_EMAIL_DOMAIN = process.env.STUDENT_EMAIL_DOMAIN || 'my.bcit.ca';
// SMTP connection for sending codes, e.g. smtps://user:pass@smtp.example.com.
// Leave empty in dev: the code is printed in the server console instead.
export const SMTP_URL = process.env.SMTP_URL || '';
// DEMO=true: a public demo for graders. Allows TEST_LOGINS in production and doesn't need
// SMTP_URL. Anyone can then log in as the test accounts, so never use it for real students.
export const DEMO = process.env.DEMO === 'true';
// Test accounts with a fixed login code, "email:code,email:code". Their codes are never
// emailed. Refused in production (they'd be a backdoor) unless DEMO is on.
export const TEST_LOGINS = new Map(
  (process.env.TEST_LOGINS || '')
    .split(',')
    .map((pair) => pair.trim().toLowerCase().split(':'))
    .filter(([email, code]) => email && code)
);
if (TEST_LOGINS.size && process.env.NODE_ENV === 'production' && !DEMO) {
  throw new Error('TEST_LOGINS must not be set when NODE_ENV=production (unless DEMO=true)');
}
export const MAIL_FROM = process.env.MAIL_FROM || 'Campus Claim <no-reply@campusclaim.local>';
