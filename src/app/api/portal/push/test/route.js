// Test push endpoint — fires a synthetic notification to the authenticated
// staff's devices. Used to validate the push pipeline end-to-end before
// wiring the real trigger on inbound calls.

import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import { sendPushToStaff } from '@/lib/push';

export async function POST() {
  const { session, mloId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const result = await sendPushToStaff(mloId, {
    title: 'NetRate Mortgage',
    body: 'Test notification — push is working.',
    url: '/portal/mlo',
    tag: 'test-push',
  });

  return Response.json(result);
}
