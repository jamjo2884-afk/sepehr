#!/usr/bin/env node
/**
 * Resend "first email" test.
 *
 * 1. Install the SDK:      npm install resend
 * 2. Replace re_xxxxxxxxx below with your real Resend API key.
 * 3. Run:                  node scripts/send-test-email.mjs
 *
 * Note: `onboarding@resend.dev` only works for test sends before you add and
 * verify a domain in Resend. Once you have a domain, use your own address
 * (e.g. from: 'Acme <noreply@yourdomain.com>').
 */
import { Resend } from 'resend';

const resend = new Resend('re_xxxxxxxxx'); // TODO: replace with your real API key

try {
  const { data, error } = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'jamjo2884@gmail.com',
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
  });

  if (error) {
    console.error('Resend error:', error);
    process.exit(1);
  }
  console.log('Email sent — id:', data?.id);
} catch (err) {
  console.error('Failed to send email:', err);
  process.exit(1);
}
