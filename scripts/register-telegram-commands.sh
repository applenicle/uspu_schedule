#!/usr/bin/env bash
set -Eeuo pipefail
# Registers the Telegram slash-command suggestions without changing webhook or chat state.
python3 - <<'PYCOMMANDS'
import getpass, json, urllib.request, urllib.error

token = getpass.getpass('TELEGRAM_BOT_TOKEN (не отображается): ').strip()
if not token or ':' not in token or any(ch.isspace() for ch in token):
    raise SystemExit('STOP: нужен действительный TELEGRAM_BOT_TOKEN')
commands = [
  {'command':'start', 'description':'Открыть меню расписания'},
  {'command':'search','description':'Найти группу или преподавателя'},
  {'command':'group','description':'Расписание группы'},
  {'command':'teacher','description':'Расписание преподавателя'},
  {'command':'today','description':'Занятия сегодня'},
  {'command':'tomorrow','description':'Занятия завтра'},
  {'command':'week','description':'Расписание на неделю'},
  {'command':'help','description':'Как пользоваться ботом'},
]
# Telegram Bot API: setMyCommands (no reload/redeploy of webhook is required).
body=json.dumps({'commands':commands,'scope':{'type':'default'}},ensure_ascii=False).encode()
req=urllib.request.Request(f'https://api.telegram.org/bot{token}/setMyCommands', data=body, headers={'Content-Type':'application/json'})
try:
    with urllib.request.urlopen(req,timeout=20) as response:
        result=json.load(response)
except urllib.error.HTTPError as e:
    raise SystemExit(f'Telegram Bot API: HTTP {e.code} (токен не выводится)') from None
except Exception:
    raise SystemExit('Не удалось подключиться к Telegram API') from None
if not result.get('ok'):
    raise SystemExit('Telegram не подтвердил сохранение списка команд')
print('TELEGRAM_COMMANDS_OK: 8 команд доступны в меню бота')
PYCOMMANDS
