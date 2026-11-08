import { createHash } from 'node:crypto';
import { db } from '@/lib/db';

/** Limit anonymous schedule requests to 20/minute/IP. Raw addresses are never persisted. */
export async function allowRequest(request) {
  const raw = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const salt = process.env.RATE_LIMIT_SALT || process.env.WORKER_TOKEN;
  if (!salt) throw new Error('RATE_LIMIT_SALT / WORKER_TOKEN is missing');
  const clientHash = createHash('sha256').update(`${salt}:${raw}`).digest('hex');
  const sql = db();
  const rows = await sql`
    INSERT INTO request_rate_limits (client_hash, window_start, counter)
    VALUES (${clientHash}, now(), 1)
    ON CONFLICT (client_hash) DO UPDATE SET
      counter = CASE
        WHEN request_rate_limits.window_start < now() - interval '1 minute' THEN 1
        ELSE request_rate_limits.counter + 1 END,
      window_start = CASE
        WHEN request_rate_limits.window_start < now() - interval '1 minute' THEN now()
        ELSE request_rate_limits.window_start END
    RETURNING counter
  `;
  return rows[0]?.counter <= 20;
}
