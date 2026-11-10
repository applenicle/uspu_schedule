#!/usr/bin/env python3
"""Safely fill the shared Neon timetable cache for groups and teachers.

Room timetables are derived by the application from cached lesson room fields;
USPU has no independently verified room-only schedule feed. This script does
not invent such a source or issue one request per room.
"""
from __future__ import annotations

import argparse
import fcntl
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from collector import (SCHEDULE_URL, fetch_url, parse_catalog,
                       schedule_sync, source_session, worker_session)

LOG = logging.getLogger('uspu_preload')
LOCK = Path(__file__).with_name('.preload.lock')


def balanced_targets(entries: list[dict]) -> list[dict]:
    """Alternate groups and teachers: teachers must not wait behind 900 groups."""
    groups = sorted((x for x in entries if x['kind'] == 'group'),
                    key=lambda x: x['label'].casefold())
    teachers = sorted((x for x in entries if x['kind'] == 'teacher'),
                      key=lambda x: x['label'].casefold())
    targets = []
    for index in range(max(len(groups), len(teachers))):
        if index < len(groups):
            targets.append(groups[index])
        if index < len(teachers):
            targets.append(teachers[index])
    return targets


def is_fresh(session: requests.Session, api: str, kind: str, ident: str,
             exam: bool, refresh_hours: float) -> bool:
    """Cached [] is a real checked-empty timetable, NOT an uncached target."""
    r = session.get(api.rstrip('/') + '/api/schedule',
                    params={'kind': kind, 'id': ident, 'exam': str(exam).lower()},
                    timeout=(8, 25))
    r.raise_for_status()
    value = r.json()
    if value.get('pending') is True or value.get('cached') is False:
        return False
    if not isinstance(value.get('lessons'), list):
        raise ValueError('Unexpected schedule API response: missing lessons list')
    stamp = value.get('fetched_at')
    if not stamp:
        return False
    moment = datetime.fromisoformat(str(stamp).replace('Z', '+00:00'))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - moment).total_seconds() < refresh_hours * 3600


def run_pass(args, upstream, api_session, api: str) -> dict[str, int]:
    catalog = parse_catalog(fetch_url(upstream, SCHEDULE_URL))
    targets = balanced_targets(catalog)
    groups = sum(x['kind'] == 'group' for x in targets)
    teachers = sum(x['kind'] == 'teacher' for x in targets)
    if groups < 10 or teachers < 10:
        raise RuntimeError('Incomplete source catalog; refusing bulk collection')
    phases = [False, True] if args.include_exams else [False]
    totals = {'cached': 0, 'synced': 0, 'failed': 0, 'checked': 0}
    errors = 0
    last_source = None
    LOG.info('Catalog groups=%d teachers=%d rooms=%d modes=%s; interleaved',
             groups, teachers, sum(x['kind'] == 'room' for x in catalog),
             'normal+exam' if args.include_exams else 'normal')
    for exam in phases:
        for target in targets:
            kind, ident = target['kind'], target['id']
            totals['checked'] += 1
            try:
                if is_fresh(api_session, api, kind, ident, exam, args.refresh_hours):
                    totals['cached'] += 1
                    continue
                if args.dry_run:
                    totals['synced'] += 1
                    LOG.info('DRY_RUN uncached %s:%s exam=%s', kind, ident, exam)
                else:
                    if last_source is not None:
                        time.sleep(max(0.0, args.pause_seconds - (time.monotonic() - last_source)))
                    last_source = time.monotonic()
                    schedule_sync(upstream, api_session, api, kind, ident, exam)
                    totals['synced'] += 1
                errors = 0
            except requests.HTTPError as exc:
                status = exc.response.status_code if exc.response is not None else 0
                LOG.warning('HTTP error kind=%s status=%s (no secrets printed)', kind, status)
                if status in (403, 429):
                    LOG.error('Rate/access limit detected; stopping prewarm safely')
                    return totals
                totals['failed'] += 1
                errors += 1
            except (requests.RequestException, ValueError, RuntimeError) as exc:
                LOG.warning('Cannot sync %s:%s: %s', kind, ident, type(exc).__name__)
                totals['failed'] += 1
                errors += 1
            if errors >= 5:
                LOG.error('Five consecutive errors; stopping prewarm to protect source')
                return totals
            if totals['checked'] % 25 == 0:
                LOG.info('Progress checked=%d cached=%d synced=%d failed=%d',
                         totals['checked'], totals['cached'], totals['synced'], totals['failed'])
            if args.max_new and totals['synced'] >= args.max_new:
                LOG.info('Requested max-new reached: %s', totals)
                return totals
    LOG.info('Pass finished: %s', totals)
    return totals


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pause-seconds', type=float, default=15)
    parser.add_argument('--refresh-hours', type=float, default=48)
    parser.add_argument('--include-exams', action='store_true')
    parser.add_argument('--repeat', action='store_true')
    parser.add_argument('--interval-hours', type=float, default=12)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--max-new', type=int, default=0)
    args = parser.parse_args()
    args.pause_seconds = max(10, args.pause_seconds)
    args.refresh_hours = max(12, args.refresh_hours)
    args.interval_hours = max(6, args.interval_hours)
    if args.max_new < 0:
        parser.error('--max-new cannot be negative')
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    api = os.environ.get('API_URL', '').rstrip('/')
    token = os.environ.get('WORKER_TOKEN', '')
    if not api.startswith('https://') or not token or token.startswith('CHANGE_ME'):
        raise SystemExit('Configure HTTPS API_URL and WORKER_TOKEN in worker/.env')
    with LOCK.open('a+') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('Another prewarm instance is running') from None
        upstream, api_session = source_session(), worker_session(token)
        while True:
            stats = run_pass(args, upstream, api_session, api)
            if not args.repeat or (stats['failed'] >= 5):
                break
            LOG.info('Waiting between coverage passes')
            time.sleep(args.interval_hours * 3600)


if __name__ == '__main__':
    main()
