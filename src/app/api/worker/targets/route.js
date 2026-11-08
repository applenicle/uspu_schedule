import { authorized, db, response } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!authorized(request)) return response({ error: 'Unauthorized' }, 401);
  try {
    const sql = db();
    const targets = await sql`
      SELECT i.kind, i.id, i.exam
      FROM interests i
      WHERE i.requested_at > now() - interval '7 days'
        AND (i.last_synced_at IS NULL OR i.last_synced_at < now() - interval '30 minutes')
      ORDER BY i.last_synced_at ASC NULLS FIRST, i.requested_at DESC
      LIMIT 15
    `;
    return response({ targets });
  } catch (error) {
    console.error('targets error:', error.message);
    return response({ error: 'Database unavailable' }, 503);
  }
}
