import { authorized, db, response, validKind, validId } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!authorized(request)) return response({ error: 'Unauthorized' }, 401);
  const size = Number(request.headers.get('content-length') || 0);
  if (size > 400000) return response({ error: 'Payload too large' }, 413);
  let body;
  try { body = await request.json(); } catch { return response({ error: 'Invalid JSON' }, 400); }
  try {
    const sql = db();
    if (body.type === 'catalog') {
      const items = body.items;
      if (!Array.isArray(items) || items.length > 120 || !items.every(x =>
        validKind(x.kind, true) && validId(x.id) && typeof x.label === 'string' && x.label.length <= 200
      )) return response({ error: 'Invalid catalog' }, 400);
      if (!items.length) return response({ updated: 0 });
      const json = JSON.stringify(items);
      await sql`
        INSERT INTO catalog (kind, id, label, updated_at)
        SELECT kind, id, label, now()
        FROM jsonb_to_recordset(${json}::jsonb) AS x(kind text, id text, label text)
        ON CONFLICT (kind, id)
        DO UPDATE SET label = excluded.label, updated_at = now()
      `;
      return response({ updated: items.length });
    }
    if (body.type === 'schedule') {
      const { kind, id, lessons, hash, source_updated } = body;
      const exam = body.exam === true;
      if (!validKind(kind) || !validId(id) || !Array.isArray(lessons) || lessons.length > 500 ||
          typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash) ||
          (source_updated != null && (typeof source_updated !== 'string' || source_updated.length > 150)))
        return response({ error: 'Invalid schedule' }, 400);
      const encoded = JSON.stringify(lessons);
      if (encoded.length > 250000) return response({ error: 'Schedule too large' }, 413);
      const previous = await sql`
        SELECT content_hash FROM schedules WHERE kind=${kind} AND id=${id} AND exam=${exam} LIMIT 1
      `;
      await sql`
        INSERT INTO schedules (kind, id, exam, payload, content_hash, source_updated, fetched_at)
        VALUES (${kind}, ${id}, ${exam}, ${encoded}::jsonb, ${hash}, ${source_updated ?? null}, now())
        ON CONFLICT (kind, id, exam)
        DO UPDATE SET payload=excluded.payload, content_hash=excluded.content_hash,
          source_updated=excluded.source_updated, fetched_at=now()
      `;
      await sql`
        UPDATE interests SET last_synced_at=now()
        WHERE kind=${kind} AND id=${id} AND exam=${exam}
      `;
      if (previous.length && previous[0].content_hash !== hash) {
        await sql`
          INSERT INTO schedule_changes (kind, id, exam, old_hash, new_hash)
          VALUES (${kind}, ${id}, ${exam}, ${previous[0].content_hash}, ${hash})
        `;
      }
      return response({ updated: true, changed: !!previous.length && previous[0].content_hash !== hash });
    }
    return response({ error: 'Unknown type' }, 400);
  } catch (error) {
    console.error('ingest error:', error.message);
    return response({ error: 'Ingest failed' }, 503);
  }
}
