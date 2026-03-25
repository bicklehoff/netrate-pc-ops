// Borrower Actions — lead/loan agnostic actions
// These work on a contact regardless of whether they have a lead, loan, or borrower record.

import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/resend';
import { welcomeTemplate, docRequestTemplate } from '@/lib/email-templates/borrower';
import { encrypt } from '@/lib/encryption';

/**
 * Ensure a contact has a linked Borrower record.
 * Creates a minimal borrower if needed (placeholder SSN/DOB).
 */
async function ensureBorrower(contact) {
  if (contact.borrowerId) {
    return await prisma.borrower.findUnique({ where: { id: contact.borrowerId } });
  }

  if (!contact.email) {
    throw new Error('Contact must have an email to create a borrower');
  }

  const emailLower = contact.email.toLowerCase().trim();

  // Check if borrower exists by email
  let borrower = await prisma.borrower.findUnique({ where: { email: emailLower } });

  if (!borrower) {
    borrower = await prisma.borrower.create({
      data: {
        email: emailLower,
        firstName: contact.firstName || 'Unknown',
        lastName: contact.lastName || 'Unknown',
        phone: contact.phone || null,
        ssnEncrypted: encrypt('000000000'),
        dobEncrypted: encrypt('1900-01-01'),
        ssnLastFour: '0000',
      },
    });
  }

  // Link contact to borrower
  await prisma.contact.update({
    where: { id: contact.id },
    data: { borrowerId: borrower.id },
  });

  return borrower;
}

/**
 * Send a portal invite to a contact.
 * Creates a borrower if needed, generates a magic link, sends welcome email.
 */
export async function sendPortalInvite(contactId, actorId) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error('Contact not found');
  if (!contact.email) throw new Error('Contact must have an email');

  const borrower = await ensureBorrower(contact);

  // Generate magic token
  const crypto = await import('crypto');
  const magicToken = crypto.randomBytes(32).toString('hex');
  const magicExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours for invite

  await prisma.borrower.update({
    where: { id: borrower.id },
    data: { magicToken, magicExpires },
  });

  const portalUrl = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';
  const magicLink = `${portalUrl}/portal/auth/verify?token=${magicToken}`;

  const template = welcomeTemplate({
    firstName: contact.firstName,
    portalUrl: magicLink,
  });

  await sendEmail({ to: contact.email, ...template });

  // Log as contact note
  await prisma.contactNote.create({
    data: {
      contactId,
      content: `Portal invite sent to ${contact.email}`,
      authorType: 'mlo',
      authorId: actorId || null,
      source: 'email',
      title: 'Portal Invite',
    },
  });

  // Update last contacted
  await prisma.contact.update({
    where: { id: contactId },
    data: { lastContactedAt: new Date() },
  });

  return { success: true, borrowerId: borrower.id };
}

/**
 * Send a needs list (document request) to a contact.
 * Works with or without a loan — just sends the email.
 */
export async function sendNeedsList(contactId, documents, actorId) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error('Contact not found');
  if (!contact.email) throw new Error('Contact must have an email');

  if (!documents || documents.length === 0) {
    throw new Error('At least one document must be specified');
  }

  const template = docRequestTemplate({
    firstName: contact.firstName,
    documents,
  });

  await sendEmail({ to: contact.email, ...template });

  // Log as contact note
  await prisma.contactNote.create({
    data: {
      contactId,
      content: `Needs list sent: ${documents.join(', ')}`,
      authorType: 'mlo',
      authorId: actorId || null,
      source: 'email',
      title: 'Needs List',
    },
  });

  await prisma.contact.update({
    where: { id: contactId },
    data: { lastContactedAt: new Date() },
  });

  return { success: true };
}

/**
 * Send a custom email to a contact and log it in the timeline.
 */
export async function sendContactEmail(contactId, { subject, body }, actorId) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error('Contact not found');
  if (!contact.email) throw new Error('Contact must have an email');

  // Simple HTML wrapper
  const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333;">
    <p>Hi ${contact.firstName},</p>
    ${body.split('\n').map(p => `<p>${p}</p>`).join('')}
    <p>Best,<br>David Burson<br>NetRate Mortgage<br>303-444-5251</p>
  </div>`;

  await sendEmail({
    to: contact.email,
    subject,
    html,
    text: `Hi ${contact.firstName},\n\n${body}\n\nBest,\nDavid Burson\nNetRate Mortgage\n303-444-5251`,
  });

  // Log as contact note
  await prisma.contactNote.create({
    data: {
      contactId,
      content: body.length > 200 ? body.substring(0, 200) + '...' : body,
      authorType: 'mlo',
      authorId: actorId || null,
      source: 'email',
      title: subject,
    },
  });

  await prisma.contact.update({
    where: { id: contactId },
    data: { lastContactedAt: new Date() },
  });

  return { success: true };
}
