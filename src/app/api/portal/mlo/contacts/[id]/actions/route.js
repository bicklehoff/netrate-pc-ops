// API: Contact Actions
// POST /api/portal/mlo/contacts/:id/actions
// Dispatches lead/loan-agnostic actions: portal invite, needs list, email
// Auth: MLO session required

import { sendPortalInvite, sendNeedsList, sendContactEmail } from '@/lib/borrower-actions';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function POST(req, { params }) {
  try {
    const { session, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'send_portal_invite': {
        const result = await sendPortalInvite(id, mloId);
        return Response.json(result);
      }

      case 'send_needs_list': {
        const { documents } = body;
        if (!documents?.length) {
          return Response.json({ error: 'documents[] is required' }, { status: 400 });
        }
        const result = await sendNeedsList(id, documents, mloId);
        return Response.json(result);
      }

      case 'send_email': {
        const { subject, emailBody } = body;
        if (!subject || !emailBody) {
          return Response.json({ error: 'subject and emailBody are required' }, { status: 400 });
        }
        const result = await sendContactEmail(id, { subject, body: emailBody }, mloId);
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
