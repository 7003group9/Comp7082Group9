import nodemailer from 'nodemailer';
import { SMTP_URL, MAIL_FROM } from '../config/env.js';

// Without SMTP_URL, codes are printed in the server console (handy in dev). In
// production that would mean nobody gets an email and anyone who can read the
// log could log in as anyone, so refuse to start instead.
if (!SMTP_URL && process.env.NODE_ENV === 'production') {
  throw new Error('SMTP_URL must be set when NODE_ENV=production');
}
const transport = SMTP_URL ? nodemailer.createTransport(SMTP_URL) : null;

// Emails the login code. With no SMTP_URL (dev) it just prints it.
export async function sendLoginCode(to, code) {
  if (!transport) return console.log(`[dev] login code for ${to}: ${code}`);
  await transport.sendMail({
    from: MAIL_FROM,
    to,
    subject: 'Your Campus Claim login code',
    text: `Your Campus Claim code is ${code}. It expires in 10 minutes.`,
  });
}
