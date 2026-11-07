// Settings read from environment variables (.env), with local dev defaults.
export const PORT = Number(process.env.PORT) || 3000;
export const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/campus_claim';
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'; // signs login tokens
// Only emails ending in @<this domain> can get a login code.
export const STUDENT_EMAIL_DOMAIN = process.env.STUDENT_EMAIL_DOMAIN || 'my.bcit.ca';
// SMTP connection for sending codes, e.g. smtps://user:pass@smtp.example.com.
// Leave empty in dev: the code is printed in the server console instead.
export const SMTP_URL = process.env.SMTP_URL || '';
// Dev only: test accounts with a fixed login code, "email:code,email:code".
// Their codes are never emailed. Refused in production, where they'd be a backdoor.
export const TEST_LOGINS = new Map(
  (process.env.TEST_LOGINS || '')
    .split(',')
    .map((pair) => pair.trim().toLowerCase().split(':'))
    .filter(([email, code]) => email && code)
);
if (TEST_LOGINS.size && process.env.NODE_ENV === 'production') {
  throw new Error('TEST_LOGINS must not be set when NODE_ENV=production');
}
export const MAIL_FROM = process.env.MAIL_FROM || 'Campus Claim <no-reply@campusclaim.local>';
