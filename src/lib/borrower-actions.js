// Borrower Actions — lead/loan agnostic actions.
// Post-UAD Layer-1b3: borrower auth lives on `contacts` directly.

import sql from '@/lib/db';
import { sendEmail } from '@/lib/resend';
import { welcomeTemplate, docRequestTemplate } from '@/lib/email-templates/borrower';

/**
 * Send a portal invite to a contact.
 * Writes a magic token to the contact and emails the welcome + link.
 */
export async function sendPortalInvite(contactId, actorId) {
  const contactRows = await sql`SELECT * FROM contacts WHERE id = ${contactId} LIMIT 1`;
  const contact = contactRows[0];
  if (!contact) throw new Error('Contact not found');
  if (!contact.email) throw new Error('Contact must have an email');

  // Generate magic token
  const crypto = await import('crypto');
  const magicToken = crypto.randomBytes(32).toString('hex');
  const magicExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours for invite

  await sql`
    UPDATE contacts SET magic_token = ${magicToken}, magic_expires = ${magicExpires}, updated_at = NOW()
    WHERE id = ${contactId}
  `;

  const portalUrl = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';
  const magicLink = `${portalUrl}/portal/auth/verify?token=${magicToken}`;

  const template = welcomeTemplate({
    firstName: contact.first_name,
    portalUrl: magicLink,
  });

  await sendEmail({ to: contact.email, ...template });

  // Log as contact note
  await sql`
    INSERT INTO contact_notes (contact_id, content, author_type, author_id, source, title)
    VALUES (${contactId}, ${'Portal invite sent to ' + contact.email}, 'mlo', ${actorId || null}, 'email', 'Portal Invite')
  `;

  // Update last contacted
  await sql`UPDATE contacts SET last_contacted_at = NOW() WHERE id = ${contactId}`;

  return { success: true, contactId };
}

/**
 * Send a needs list (document request) to a contact.
 * Works with or without a loan — just sends the email.
 */
export async function sendNeedsList(contactId, documents, actorId) {
  const contactRows = await sql`SELECT * FROM contacts WHERE id = ${contactId} LIMIT 1`;
  const contact = contactRows[0];
  if (!contact) throw new Error('Contact not found');
  if (!contact.email) throw new Error('Contact must have an email');

  if (!documents || documents.length === 0) {
    throw new Error('At least one document must be specified');
  }

  const template = docRequestTemplate({
    firstName: contact.first_name,
    documents,
  });

  await sendEmail({ to: contact.email, ...template });

  // Log as contact note
  await sql`
    INSERT INTO contact_notes (contact_id, content, author_type, author_id, source, title)
    VALUES (${contactId}, ${'Needs list sent: ' + documents.join(', ')}, 'mlo', ${actorId || null}, 'email', 'Needs List')
  `;

  await sql`UPDATE contacts SET last_contacted_at = NOW(), updated_at = NOW() WHERE id = ${contactId}`;

  return { success: true };
}

/**
 * Send a custom email to a contact and log it in the timeline.
 */
export async function sendContactEmail(contactId, { subject, body }, actorId) {
  const contactRows = await sql`SELECT * FROM contacts WHERE id = ${contactId} LIMIT 1`;
  const contact = contactRows[0];
  if (!contact) throw new Error('Contact not found');
  if (!contact.email) throw new Error('Contact must have an email');

  // Simple HTML wrapper
  const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333;">
    <p>Hi ${contact.first_name},</p>
    ${body.split('\n').map(p => `<p>${p}</p>`).join('')}
    <p>Best,<br>David Burson<br>NetRate Mortgage<br>303-444-5251</p>
  </div>`;

  await sendEmail({
    to: contact.email,
    subject,
    html,
    text: `Hi ${contact.first_name},\n\n${body}\n\nBest,\nDavid Burson\nNetRate Mortgage\n303-444-5251`,
  });

  // Log as contact note
  const noteContent = body.length > 200 ? body.substring(0, 200) + '...' : body;
  await sql`
    INSERT INTO contact_notes (contact_id, content, author_type, author_id, source, title)
    VALUES (${contactId}, ${noteContent}, 'mlo', ${actorId || null}, 'email', ${subject})
  `;

  await sql`UPDATE contacts SET last_contacted_at = NOW(), updated_at = NOW() WHERE id = ${contactId}`;

  return { success: true };
}
