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
    // Each valid selection keeps the schedule active; worker caps its own request rate.
    await sql`
      INSERT INTO interests (kind, id, exam, requested_at)
      VALUES (${kind}, ${id}, ${exam}, now())
      ON CONFLICT (kind, id, exam)
      DO UPDATE SET requested_at = now()
    `;
    return response({ queued: true });
  } catch (error) {
    console.error('request error:', error.message);
    return response({ error: 'База данных недоступна' }, 503);
  }
}
