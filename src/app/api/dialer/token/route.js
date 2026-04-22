import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import { generateAccessToken } from '@/lib/twilio-voice';

export async function POST() {
  const { session, mloId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const identity = `mlo-${mloId}`;
  const token = generateAccessToken(identity);

  return Response.json({ token, identity });
}
