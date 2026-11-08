import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
test('persistent Neon cache is used for all clients, never discarded on upstream failure',()=>{
 const route=load('src/app/api/schedule/route.js');
 assert.match(route,/FROM schedules/);
 assert.match(route,/cached: true/);
 assert.match(route,/stale: ageSeconds > 1800/);
 assert.match(route,/s-maxage=30/);
 assert.match(route,/pending: true, cached: false/);
});
test('duplicate requests for same group are coalesced, uncached targets get priority',()=>{
 const route=load('src/app/api/request/route.js');
 assert.match(route,/ON CONFLICT \(kind, id, exam\)/);
 assert.match(route,/interval '5 minutes'/);
 const workerTargets=load('src/app/api/worker/targets/route.js');
 assert.match(workerTargets,/LEFT JOIN schedules/);
 assert.match(workerTargets,/s.fetched_at IS NULL/);
});
