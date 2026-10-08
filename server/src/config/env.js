// Settings read from environment variables (.env), with local dev defaults.
export const PORT = Number(process.env.PORT) || 3000;
export const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/campus_claim';
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'; // signs login tokens
// Only emails ending in @<this domain> can get a login code.
export const STUDENT_EMAIL_DOMAIN = process.env.STUDENT_EMAIL_DOMAIN || 'my.bcit.ca';
// SMTP connection for sending codes, e.g. smtps://user:pass@smtp.example.com.
// Leave empty in dev: the code is printed in the server console instead.
export const SMTP_URL = process.env.SMTP_URL || '';
export const MAIL_FROM = process.env.MAIL_FROM || 'Campus Claim <no-reply@campusclaim.local>';
