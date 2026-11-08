import { neon } from '@neondatabase/serverless';

export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return neon(process.env.DATABASE_URL);
}

export function response(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function validKind(kind, allowRoom = false) {
  return kind === 'group' || kind === 'teacher' || (allowRoom && kind === 'room');
}

export function validId(value) {
  return typeof value === 'string' && value.length >= 1 && value.length <= 160 && !/[\r\n\x00-\x1f]/.test(value);
}

export function authorized(request) {
  // Do not use this for end-user auth. It is exclusively a private VPS→Vercel token.
  const token = process.env.WORKER_TOKEN;
  const candidate = request.headers.get('authorization');
  if (!token || token === 'change-me' || !candidate?.startsWith('Bearer ')) return false;
  const supplied = candidate.slice(7);
  // Constant-time compare for shared secret.
  if (supplied.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= supplied.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
