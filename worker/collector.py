#!/usr/bin/env python3
"""Read-only USPU collector. Only requests schedules selected by app users.

Run on the Russian VPS that can reach uspu.ru. The worker does not run a public
listener or connect to the Vercel database; it pushes over authenticated HTTPS.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import time
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup, Comment
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name('.env'))

SCHEDULE_URL = 'https://uspu.ru/education/eios/schedule/'
GROUP_URL = 'https://uspu.ru/ajax/rasp.php'
TEACHER_URL = 'https://uspu.ru/ajax/rasp_teacher.php'
MOSCOW = ZoneInfo('Europe/Moscow')
EKATERINBURG = ZoneInfo('Asia/Yekaterinburg')
MONTHS = {
    'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4, 'мая': 5,
    'июня': 6, 'июля': 7, 'августа': 8, 'сентября': 9,
    'октября': 10, 'ноября': 11, 'декабря': 12,
}
LOG = logging.getLogger('uspu_collector')


def today_ru() -> date:
    return datetime.now(EKATERINBURG).date()


def parse_day(label: str, today: date | None = None) -> str | None:
    """Schedule dates are usually '13 ноября', with no year.

    Select the closest plausible academic date around the current period,
    including a December→January rollover.
    """
    today = today or today_ru()
    match = re.search(r'(\d{1,2})\s+([А-Яа-яёЁ]+)', label)
    if not match:
        return None
    day = int(match.group(1))
    month = MONTHS.get(match.group(2).lower())
    if not month:
        return None
    candidates = []
    for year in (today.year - 1, today.year, today.year + 1):
        try:
            candidate = date(year, month, day)
        except ValueError:
            continue
        difference = (candidate - today).days
        # Prefer dates within the current term; preserve the closest outside it.
        penalty = 0 if -75 <= difference <= 210 else 1000
        candidates.append((penalty + abs(difference), candidate))
    if not candidates:
        return None
    return min(candidates, key=lambda x: x[0])[1].isoformat()


def normalize(value: str) -> str:
    return ' '.join(value.split()).strip(' \u00a0')


def parse_catalog(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, 'html.parser')
    maps = {'group_name': 'group', 'teacher_search': 'teacher',
            'kab_stud': 'room', 'kab_prep': 'room'}
    results = {}
    for field, kind in maps.items():
        node = soup.select_one(f'select[name="{field}"]')
        if node is None:
            LOG.warning('Missing select %s', field)
            continue
        for opt in node.select('option'):
            value = normalize(opt.get('value', ''))
            label = normalize(opt.get_text(' ', strip=True))
            if not value or value == '-1' or value == ':' or label in ('', ':'):
                continue
            results[(kind, value)] = {'kind': kind, 'id': value, 'label': label}
    return sorted(results.values(), key=lambda item: (item['kind'], item['label']))


def parse_lessons(html: str, reference: date | None = None) -> tuple[list[dict], str | None]:
    soup = BeautifulSoup(html, 'html.parser')
    lessons = []
    for day_node in soup.select('.rasp-item'):
        day_label = day_node.select_one('.rasp-day')
        if not day_label:
            continue  # excludes .rasp-item-inner which doesn't contain .rasp-day
        iso = parse_day(day_label.get_text(' ', strip=True), reference)
        if not iso:
            continue
        for para in day_node.select('.rasp-para'):
            time_node = para.select_one('.para-time')
            desc_node = para.select_one('.rasp-desc')
            if not time_node or not desc_node:
                continue
            time_str = normalize(time_node.get_text(' ', strip=True))
            if not re.search(r'\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}', time_str):
                continue
            text = desc_node.get_text('\n', strip=True)
            lines = [normalize(s) for s in text.splitlines() if normalize(s)]
            if not lines:
                continue
            title = lines.pop(0)
            kind_match = re.match(r'^(.*?)\s+\(([^()]*)\)\s*$', title)
            subject = kind_match.group(1).strip() if kind_match else title
            lesson_type = kind_match.group(2).strip() if kind_match else ''
            entry = {'date': iso, 'time': time_str, 'subject': subject,
                     'type': lesson_type, 'room': '', 'teacher': '', 'group': '', 'subgroup': ''}
            # USPU sometimes supplies a placeholder "Подгруппа: 0" in an HTML
            # comment while the visible group line contains the real subgroup,
            # e.g. "Группа: Дг-304 подгруппа 1". Looking at comments first
            # would match 0 and silently discard the real number.
            subgroup_re = re.compile(r'подгрупп[а-яё]*\s*[:№-]?\s*(\d+)', re.I)
            visible_text = ' '.join(lines)
            comments = ' '.join(str(c) for c in para.find_all(string=lambda s: isinstance(s, Comment)))
            # Prefer visible labels. Ignore placeholder zero but keep looking.
            for source_text in (visible_text, comments):
                numbers = [m.group(1) for m in subgroup_re.finditer(source_text)
                           if int(m.group(1)) > 0]
                if numbers:
                    entry['subgroup'] = numbers[0]
                    break
            leftover = []
            for line in lines:
                prefix, _, value = line.partition(':')
                key = prefix.lower().strip()
                if key.startswith('преподавател'):
                    entry['teacher'] = normalize(value)
                elif key.startswith('группа') or key.startswith('группы'):
                    # A subgroup number is metadata, not part of the group ID.
                    group_label = re.sub(r'\s+подгрупп[а-яё]*\s*[:№-]?\s*\d+\s*$',
                                         '', normalize(value), flags=re.I)
                    entry['group'] = normalize(group_label)
                elif key.startswith('аудитори') or key.startswith('кабинет'):
                    entry['room'] = normalize(value)
                elif not key.startswith('подгрупп'):
                    leftover.append(line)
            if not entry['room'] and leftover:
                # USPU places the room before the 'Преподаватель:' label.
                entry['room'] = leftover[0]
            lessons.append(entry)
    # Update information is embedded in returned JS, not in a dedicated JSON field.
    match = re.search(r'Расписание обновлено\s+([0-9.]{10}\s+в\s+[0-9:]{8})', html)
    source_updated = match.group(1) if match else None
    lessons.sort(key=lambda l: (l['date'], l['time'], l['subject'], l['room']))
    return lessons, source_updated


def source_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        'User-Agent': 'USPU Schedule Sync/0.1 (educational timetable mirror)',
        'Referer': SCHEDULE_URL,
        'Accept': 'text/html, */*',
    })
    return s


def worker_session(token: str) -> requests.Session:
    s = requests.Session()
    s.headers.update({'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    return s


def fetch_url(session: requests.Session, url: str, data=None) -> str:
    r = session.post(url, data=data, timeout=(10, 35)) if data is not None else session.get(url, timeout=(10, 35))
    r.raise_for_status()
    r.encoding = 'utf-8'
    return r.text


def post_api(session: requests.Session, api: str, payload: dict) -> dict:
    r = session.post(api.rstrip('/') + '/api/worker/ingest', json=payload, timeout=(10, 40))
    r.raise_for_status()
    return r.json()


def catalog_sync(source: requests.Session, out: requests.Session, api: str) -> None:
    html = fetch_url(source, SCHEDULE_URL)
    items = parse_catalog(html)
    counts = {kind: sum(item['kind'] == kind for item in items) for kind in ('group', 'teacher', 'room')}
    LOG.info('Catalog: %s', counts)
    if counts['group'] < 10 or counts['teacher'] < 10:
        raise RuntimeError('Unexpected catalog response; refusing to overwrite with incomplete data')
    for offset in range(0, len(items), 100):
        post_api(out, api, {'type': 'catalog', 'items': items[offset:offset+100]})
    LOG.info('Catalog uploaded: %d entries', len(items))


def schedule_sync(source: requests.Session, out: requests.Session, api: str,
                  kind: str, item_id: str, exam: bool = False) -> None:
    if kind not in ('group', 'teacher') or not isinstance(item_id, str) or not item_id:
        raise ValueError('Invalid schedule target')
    params = ({'group_name': item_id, 'exam_stud': 'true'} if exam else {'group_name': item_id}) if kind == 'group' \
        else ({'teacher_name': item_id, 'exam_prep': 'true'} if exam else {'teacher_name': item_id})
    url = GROUP_URL if kind == 'group' else TEACHER_URL
    html = fetch_url(source, url, params)
    lessons, source_updated = parse_lessons(html)
    if not lessons and not ('Расписание обновлено' in html or 'rasp-item' in html):
        raise RuntimeError('Unexpected empty schedule response; preserving last saved version')
    canonical = json.dumps(lessons, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    digest = hashlib.sha256(canonical).hexdigest()
    result = post_api(out, api, {'type': 'schedule', 'kind': kind, 'id': item_id,
                   'exam': exam, 'lessons': lessons, 'hash': digest, 'source_updated': source_updated})
    LOG.info('Synced %s:%s exam=%s lessons=%d changed=%s', kind, item_id, exam, len(lessons), result.get('changed'))


def loop(api: str, token: str, once: bool = False) -> None:
    if not api.startswith('https://') and not api.startswith('http://localhost:'):
        raise RuntimeError('API_URL must use HTTPS (except localhost during development)')
    if not token or token == 'the-same-secret-as-vercel':
        raise RuntimeError('Set WORKER_TOKEN in worker/.env first')
    source, out = source_session(), worker_session(token)
    interval = max(60, int(os.environ.get('POLL_SECONDS', '120')))
    catalog_seconds = max(3600, float(os.environ.get('CATALOG_INTERVAL_HOURS', '12')) * 3600)
    pause = max(1.5, float(os.environ.get('REQUEST_PAUSE_SECONDS', '3')))
    last_catalog = 0.0
    while True:
        if time.monotonic() - last_catalog >= catalog_seconds:
            try:
                catalog_sync(source, out, api)
                last_catalog = time.monotonic()
            except Exception as exc:
                LOG.exception('Catalog refresh failed: %s', exc)
                # Back off failed full-catalog checks without losing schedule sync.
                last_catalog = time.monotonic() - catalog_seconds + 600
        try:
            response = out.get(api.rstrip('/') + '/api/worker/targets', timeout=(10, 30))
            response.raise_for_status()
            targets = response.json()['targets']
            for target in targets:
                try:
                    schedule_sync(source, out, api, target['kind'], target['id'], bool(target['exam']))
                except Exception as exc:
                    LOG.exception('Schedule request failed for %s: %s', target.get('id'), exc)
                time.sleep(pause)
            if targets:
                LOG.info('Processed target batch: %d', len(targets))
        except Exception as exc:
            LOG.exception('Polling failed: %s', exc)
        if once:
            break
        time.sleep(interval)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    ap = argparse.ArgumentParser()
    ap.add_argument('--once', action='store_true', help='Sync catalogs and a single batch then exit')
    ap.add_argument('--test-html', type=Path, help='Offline parser test with saved rasp.php HTML')
    ap.add_argument('--test-catalog', type=Path, help='Offline catalog test with downloaded schedule page')
    args = ap.parse_args()
    if args.test_html:
        html = args.test_html.read_text(encoding='utf-8')
        lessons, stamp = parse_lessons(html)
        print(f'LESSONS={len(lessons)} SOURCE_UPDATED={stamp!r}')
        print(json.dumps(lessons[:2], indent=2, ensure_ascii=False))
        return
    if args.test_catalog:
        html = args.test_catalog.read_text(encoding='utf-8')
        items = parse_catalog(html)
        print({k: sum(x['kind'] == k for x in items) for k in ('group', 'teacher', 'room')})
        return
    loop(os.environ.get('API_URL', ''), os.environ.get('WORKER_TOKEN', ''), once=args.once)


if __name__ == '__main__':
    main()
