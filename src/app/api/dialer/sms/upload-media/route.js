import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import { put } from '@vercel/blob';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — Twilio MMS limit

export async function POST(req) {
  const { session } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return Response.json({ error: 'Missing file' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: `Unsupported type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'File exceeds 5 MB limit' }, { status: 400 });
  }

  try {
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    const filename = `sms-media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: file.type,
    });

    return Response.json({ url: blob.url, contentType: file.type });
  } catch (e) {
    console.error('[upload-media] Blob put failed:', e?.message || e);
    return Response.json({ error: e?.message || 'Upload failed' }, { status: 500 });
  }
}
