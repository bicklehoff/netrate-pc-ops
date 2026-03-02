// Dialer Token API — Generates Twilio Voice Access Token
// Called by the browser SDK on init to register as a Twilio Client device.
// Auth: MLO session required (NextAuth)

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateAccessToken } from '@/lib/twilio-voice';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use MLO id as the Twilio Client identity — unique per agent
  const identity = `mlo-${session.user.id}`;
  const token = generateAccessToken(identity);

  return Response.json({ token, identity });
}
