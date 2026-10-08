import nodemailer from 'nodemailer';
import { SMTP_URL, MAIL_FROM } from '../config/env.js';

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
