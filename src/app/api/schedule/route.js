import { db, response, validKind, validId } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind');
  const id = searchParams.get('id');
  const exam = searchParams.get('exam') === 'true';
  if (!validKind(kind, true) || !validId(id)) return response({ error: 'Некорректный запрос' }, 400);
  try {
    const sql = db();
    if (kind === 'room') {
      // Partial coverage: only cached group/teacher schedules, NOT a complete occupancy feed.
      const rows = await sql`
        SELECT l.value AS lesson, s.fetched_at
        FROM schedules s
        CROSS JOIN LATERAL jsonb_array_elements(s.payload) AS l(value)
        WHERE s.exam = ${exam}
          AND (l.value->>'room' = ${id})
        ORDER BY l.value->>'date', l.value->>'time', s.fetched_at DESC
        LIMIT 300
      `;
      const seen = new Set();
      const lessons = rows.map(r => r.lesson).filter(l => {
        const key = [l.date,l.time,l.subject,l.room,l.group].join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return response({ lessons, partial: true, fetched_at: rows[0]?.fetched_at || null });
    }
    const rows = await sql`
      SELECT payload, fetched_at, source_updated FROM schedules
      WHERE kind = ${kind} AND id = ${id} AND exam = ${exam}
      LIMIT 1
    `;
    if (!rows.length) return response({ lessons: [], pending: true, cached: false });
    // A persistent, cross-user cache in Neon: every visitor reads the same snapshot.
    // Keep stale snapshots visible if the upstream is temporarily unavailable.
    const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(rows[0].fetched_at).getTime()) / 1000));
    return Response.json({ lessons: rows[0].payload, fetched_at: rows[0].fetched_at,
      source_updated: rows[0].source_updated, pending: false, cached: true,
      stale: ageSeconds > 1800, age_seconds: ageSeconds },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60', 'X-USPU-Cache': 'HIT' } });
  } catch (error) {
    console.error('schedule error:', error.message);
    return response({ error: 'База данных недоступна' }, 503);
  }
}
