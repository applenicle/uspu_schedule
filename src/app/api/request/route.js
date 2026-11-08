import { db, response, validKind, validId } from '@/lib/db';
import { allowRequest } from '@/lib/rate-limit';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return response({ error: 'Неверный JSON' }, 400); }
  const { kind, id } = body || {};
  const exam = body?.exam === true;
  if (!validKind(kind) || !validId(id)) return response({ error: 'Неверные параметры' }, 400);
  try {
    if (!(await allowRequest(request))) return response({ error: 'Слишком много запросов. Попробуйте через минуту.' }, 429);
    const sql = db();
    const available = await sql`SELECT 1 FROM catalog WHERE kind = ${kind} AND id = ${id} LIMIT 1`;
    if (!available.length) return response({ error: 'Нет такого элемента в каталоге' }, 404);
    // Coalesce requests across visitors; keep active schedules on the worker's refresh list.
    // Frequent users never multiply the number of upstream calls.
    await sql`
      INSERT INTO interests (kind, id, exam, requested_at)
      VALUES (${kind}, ${id}, ${exam}, now())
      ON CONFLICT (kind, id, exam) DO UPDATE SET requested_at = now()
      WHERE interests.requested_at < now() - interval '5 minutes'
    `;
    const existing = await sql`
      SELECT fetched_at FROM schedules WHERE kind=${kind} AND id=${id} AND exam=${exam} LIMIT 1
    `;
    return response({ queued: !existing.length, cached: existing.length > 0 });
  } catch (error) {
    console.error('request error:', error.message);
    return response({ error: 'База данных недоступна' }, 503);
  }
}
