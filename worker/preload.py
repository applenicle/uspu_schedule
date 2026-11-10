#!/usr/bin/env python3
"""Gentle, resumable prewarming of USPU group and teacher schedules into Neon.

Run as uspu-sync alongside the existing collector; only sends authenticated
worker ingest requests and public cache reads, never writes to PostgreSQL directly.
No new API routes or database migrations are necessary.
"""
from __future__ import annotations

import argparse
import fcntl
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

# Imports the existing installed worker; reads worker/.env via python-dotenv.
from collector import (SCHEDULE_URL, fetch_url, parse_catalog,
                       schedule_sync, source_session, worker_session)

LOG = logging.getLogger('uspu_preload')
LOCK = Path(__file__).with_name('.preload.lock')


def read_cache(session: requests.Session, base: str, kind: str, ident: str,
               refresh_after_hours: float) -> bool:
    """Return True if a usable cached row exists and is fresh enough."""
    response = session.get(base.rstrip('/') + '/api/schedule',
                           params={'kind': kind, 'id': ident}, timeout=(8, 25))
    response.raise_for_status()
    data = response.json()
    if data.get('pending') is True:
        return False
    if not isinstance(data.get('lessons'), list):
        raise ValueError('Unexpected cache API response: lessons is not a list')
    stamp = data.get('fetched_at')
    if not stamp:
        # Already cached, but API didn't expose an age; don't needlessly refetch.
        return True
    cached_at = datetime.fromisoformat(str(stamp).replace('Z', '+00:00'))
    if cached_at.tzinfo is None:
        cached_at = cached_at.replace(tzinfo=timezone.utc)
    age_seconds = (datetime.now(timezone.utc) - cached_at).total_seconds()
    return age_seconds < refresh_after_hours * 3600


def one_pass(args, source, out, base: str) -> dict[str, int]:
    LOG.info('Reading catalog from USPU (no mass request to Vercel)')
    entries = parse_catalog(fetch_url(source, SCHEDULE_URL))
    counts = {key: sum(e['kind'] == key for e in entries) for key in ('group', 'teacher')}
    if counts['group'] < 10 or counts['teacher'] < 10:
        raise RuntimeError(f'Unexpectedly incomplete catalog: {counts}')
    wanted = set(args.kinds)
    entries = [e for e in entries if e['kind'] in wanted]
    # Student groups first; teacher schedules afterward. Keep stable order.
    entries.sort(key=lambda e: (e['kind'] != 'group', e['label'].casefold()))
    LOG.info('Targets available: %s. Previously cached records will be skipped.', counts)
    results = {'cached': 0, 'synced': 0, 'failed': 0}
    consecutive_failures = 0
    started = time.monotonic()
    for index, entry in enumerate(entries, 1):
        kind, ident = entry['kind'], entry['id']
        try:
            if read_cache(out, base, kind, ident, args.refresh_after_hours):
                results['cached'] += 1
                continue
            if args.dry_run:
                results['synced'] += 1
                LOG.info('DRY_RUN target=%s:%s', kind, ident)
                continue
            # Do not fetch the next source schedule too quickly, even after errors.
            if results['synced'] + results['failed']:
                elapsed = time.monotonic() - started
                due = (results['synced'] + results['failed']) * args.pause_seconds
                if due > elapsed:
                    time.sleep(due - elapsed)
            schedule_sync(source, out, base, kind, ident, False)
            results['synced'] += 1
            consecutive_failures = 0
        except requests.HTTPError as exc:
            code = exc.response.status_code if exc.response is not None else None
            LOG.warning('HTTP error target=%s:%s status=%s (no secrets printed)', kind, ident, code)
            if code in (403, 429):
                LOG.error('Access/rate limit observed; stopping to protect source and API.')
                # Successful exit deliberately prevents systemd auto-restart loops.
                raise SystemExit(0) from None
            results['failed'] += 1
            consecutive_failures += 1
            if consecutive_failures >= 5:
                LOG.error('Five source/API failures in a row: pausing prewarm until manually restarted.')
                raise SystemExit(0) from None
            time.sleep(15)
        except (requests.RequestException, ValueError, RuntimeError) as exc:
            results['failed'] += 1
            consecutive_failures += 1
            LOG.warning('Target failed %s:%s: %s', kind, ident, type(exc).__name__)
            if consecutive_failures >= 5:
                LOG.error('Five source/API failures in a row: pausing prewarm until manually restarted.')
                raise SystemExit(0) from None
            time.sleep(15)
        if index % 25 == 0:
            LOG.info('Progress %d/%d cached=%d synced=%d failed=%d',
                     index, len(entries), results['cached'], results['synced'], results['failed'])
    LOG.info('Completed pass: %s', results)
    return results


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--kinds', nargs='+', choices=('group', 'teacher'),
                    default=['group', 'teacher'], help='What to preload')
    ap.add_argument('--pause-seconds', type=float, default=15.0,
                    help='Minimum average spacing between source timetable requests (min 10)')
    ap.add_argument('--refresh-after-hours', type=float, default=36.0,
                    help='Skip already-cached schedules newer than this (min 12)')
    ap.add_argument('--repeat', action='store_true',
                    help='Run another pass once every interval-hours')
    ap.add_argument('--interval-hours', type=float, default=12.0)
    ap.add_argument('--dry-run', action='store_true',
                    help='Show uncached targets without fetching timetables')
    args = ap.parse_args()
    args.pause_seconds = max(10.0, args.pause_seconds)
    args.refresh_after_hours = max(12.0, args.refresh_after_hours)
    args.interval_hours = max(6.0, args.interval_hours)
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

    base = os.environ.get('API_URL', '').strip().rstrip('/')
    token = os.environ.get('WORKER_TOKEN', '').strip()
    if not base.startswith('https://') or not token or token.startswith('CHANGE_ME'):
        raise SystemExit('Missing API_URL (HTTPS) or WORKER_TOKEN in worker/.env')
    # An exclusive lock prevents accidental concurrent backfills.
    with LOCK.open('a+') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('A prewarm process is already running') from None
        source, out = source_session(), worker_session(token)
        while True:
            one_pass(args, source, out, base)
            if not args.repeat:
                break
            LOG.info('Resting until next cache pass')
            time.sleep(args.interval_hours * 3600)


if __name__ == '__main__':
    main()
