import nodemailer from "nodemailer";
import { config } from "../config.js";

let transportPromise;

/** Real SMTP when SMTP_URL is set; otherwise a free Ethereal test inbox (messages viewable via a preview link). */
function transport() {
  transportPromise ??= (async () => {
    if (config.smtpUrl) return { mailer: nodemailer.createTransport(config.smtpUrl), test: false };
    const account = await nodemailer.createTestAccount();
    console.log(`Email: using Ethereal test inbox ${account.user}`);
    return {
      mailer: nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      }),
      test: true,
    };
  })().catch((err) => {
    transportPromise = undefined;
    throw err;
  });
  return transportPromise;
}

/**
 * Sends an email and resolves to { status, previewUrl }. Never throws: email is a
 * side effect, and a mail outage must not break bookings or invites.
 */
export async function sendMail({ to, subject, html, text, attachments = [] }) {
  try {
    const { mailer, test } = await transport();
    const info = await Promise.race([
      mailer.sendMail({ from: config.mailFrom, to, subject, html, text, attachments }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Email timed out")), 15_000)),
    ]);
    return { status: "sent", previewUrl: test ? nodemailer.getTestMessageUrl(info) || null : null };
  } catch (err) {
    console.warn(`Email to ${to} failed: ${err.message}`);
    return { status: "failed", previewUrl: null };
  }
}
