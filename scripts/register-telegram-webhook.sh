#!/usr/bin/env bash
set -euo pipefail
# Run this locally after deploying Vercel and configuring TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET.
python3 - <<'PY'
import getpass, json, urllib.request, urllib.error
url='https://uspu-schedule.vercel.app/api/telegram/webhook'
token=getpass.getpass('TELEGRAM_BOT_TOKEN (из BotFather, не выводится): ').strip()
secret=getpass.getpass('TELEGRAM_WEBHOOK_SECRET (то же значение, что в Vercel): ').strip()
if not token or not secret:
    raise SystemExit('STOP: необходимо заполнить оба секрета')
if any(not(ch.isalnum() or ch in '_-') or ord(ch)>127 for ch in secret):
    raise SystemExit('STOP: webhook secret может содержать только A-Z, a-z, 0-9, _ и -')
def api(method,body=None):
    payload=json.dumps(body,ensure_ascii=False).encode() if body is not None else None
    req=urllib.request.Request(f'https://api.telegram.org/bot{token}/{method}',data=payload,headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=20) as resp:return json.load(resp)
    except urllib.error.HTTPError as error:
        raise SystemExit('Ошибка Telegram Bot API: HTTP '+str(error.code)) from None
current=api('getWebhookInfo').get('result',{}).get('url','')
print('Текущий webhook:',current or '(не установлен)')
if current and current != url:
    print('ВНИМАНИЕ: установка нового webhook отключит предыдущий обработчик этого бота.')
    if input('Точно заменить? Напиши YES: ').strip()!='YES':raise SystemExit('Отменено')
result=api('setWebhook',{'url':url,'secret_token':secret,'allowed_updates':['message','callback_query'],'drop_pending_updates':False})
if not result.get('ok'):raise SystemExit('Telegram отклонил webhook')
info=api('getWebhookInfo').get('result',{})
print('WEBHOOK_OK:',info.get('url')==url)
print('URL:',info.get('url'))
print('Сообщение для теста: /group ДГ-304')
PY
