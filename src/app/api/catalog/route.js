import { db, response, validKind } from '@/lib/db';
import { normalizeGroup } from '@/shared/lib/schedule-utils.mjs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind') || 'group';
  const q = (searchParams.get('q') || '').trim().slice(0, 120);
  if (!validKind(kind, true)) return response({ error: 'Неверный тип справочника' }, 400);
  try {
    const sql = db();
    const escaped = q.replace(/[!%_]/g, character => '!' + character);
    const like = `%${escaped}%`;
    if (kind === 'group' && q) {
      // PostgreSQL's space/hyphen-insensitive expression matches дг304, ДГ 304 and ДГ-304.
      // No user-controlled SQL fragments: all parameters remain bound through Neon.
      const clean = normalizeGroup(q).replace(/[!%_]/g, character => '!' + character);
      const pattern = `%${clean}%`;
      const starts = `${clean}%`;
      const items = await sql`
        SELECT id, label FROM catalog
        WHERE kind = 'group'
          AND NOT EXISTS (
            SELECT 1 FROM schedules s
            WHERE s.kind = catalog.kind AND s.id = catalog.id AND s.exam = false
              AND s.fetched_at > now() - interval '12 hours'
              AND jsonb_array_length(s.payload) = 0
          )
          AND (
          regexp_replace(replace(upper(label), 'Ё', 'Е'), '[-[:space:]_–—‑]', '', 'g') ILIKE ${pattern} ESCAPE '!'
          OR label ILIKE ${like} ESCAPE '!'
        )
        ORDER BY CASE
          WHEN regexp_replace(replace(upper(label), 'Ё', 'Е'), '[-[:space:]_–—‑]', '', 'g') = ${clean} THEN 0
          WHEN regexp_replace(replace(upper(label), 'Ё', 'Е'), '[-[:space:]_–—‑]', '', 'g') ILIKE ${starts} ESCAPE '!' THEN 1
          ELSE 2 END, label
        LIMIT 50
      `;
      return response({ items });
    }
    const items = await sql`
      SELECT id, label FROM catalog
      WHERE kind = ${kind} AND label ILIKE ${like}
        AND (kind = 'room' OR NOT EXISTS (
          SELECT 1 FROM schedules s
          WHERE s.kind = catalog.kind AND s.id = catalog.id AND s.exam = false
            AND s.fetched_at > now() - interval '12 hours'
            AND jsonb_array_length(s.payload) = 0
        )) ESCAPE '!'
      ORDER BY CASE WHEN lower(label) = lower(${q}) THEN 0 ELSE 1 END, label
      LIMIT 50
    `;
    return response({ items });
  } catch (error) {
    console.error('catalog error:', error.message);
    return response({ error: 'База данных недоступна' }, 503);
  }
}
