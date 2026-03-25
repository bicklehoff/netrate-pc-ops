// API: Contact Actions
// POST /api/portal/mlo/contacts/:id/actions
// Dispatches lead/loan-agnostic actions: portal invite, needs list, email
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendPortalInvite, sendNeedsList, sendContactEmail } from '@/lib/borrower-actions';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'send_portal_invite': {
        const result = await sendPortalInvite(id, session.user.id);
        return Response.json(result);
      }

      case 'send_needs_list': {
        const { documents } = body;
        if (!documents?.length) {
          return Response.json({ error: 'documents[] is required' }, { status: 400 });
        }
        const result = await sendNeedsList(id, documents, session.user.id);
        return Response.json(result);
      }

      case 'send_email': {
        const { subject, emailBody } = body;
        if (!subject || !emailBody) {
          return Response.json({ error: 'subject and emailBody are required' }, { status: 400 });
        }
        const result = await sendContactEmail(id, { subject, body: emailBody }, session.user.id);
        return Response.json(result);
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Contact action error:', error?.message);
    return Response.json({ error: error?.message || 'Action failed' }, { status: 500 });
  }
}
