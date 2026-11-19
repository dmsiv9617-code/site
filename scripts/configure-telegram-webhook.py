#!/usr/bin/env python3
"""Run manually on the approved server. Secrets come only from its environment."""
import argparse,json,os,re,sys,urllib.request,urllib.parse
parser=argparse.ArgumentParser(description='Configure WoodBaseLazerBot without printing credentials.')
parser.add_argument('--discover-groups',action='store_true',help='Read group IDs before a webhook is installed; never prints message text.')
parser.add_argument('--url',default='https://woodbase-lazer.ru/wp-json/woodbase/v1/telegram/webhook')
args=parser.parse_args()
def fail(message):
 print(message,file=sys.stderr);sys.exit(1)
token=os.environ.get('WOODBASE_TELEGRAM_BOT_TOKEN','')
if not re.fullmatch(r'[0-9]+:[A-Za-z0-9_-]{30,}',token):fail('Set the bot token in the protected server environment.')
def call(method,data=None):
 request=urllib.request.Request('https://api.telegram.org/bot'+token+'/'+method,data=json.dumps(data or {}).encode(),headers={'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(request,timeout=15) as response:body=json.load(response)
 except Exception:fail('Telegram API request failed; credentials and provider response were not printed.')
 if not body.get('ok'):fail('Telegram declined the request; verify server configuration.')
 return body['result']
me=call('getMe')
if me.get('username','').lower()!='woodbaselazerbot':fail('This token belongs to a different bot; nothing was configured.')
if args.discover_groups:
 if call('getWebhookInfo').get('url'):fail('A webhook already exists. Group discovery will not replace or interrupt it.')
 groups={}
 for update in call('getUpdates',{'timeout':0,'limit':100}):
  chat=update.get('message',{}).get('chat',{})
  if chat.get('type') in ['group','supergroup']:groups[str(chat['id'])]=chat.get('title','')
 for chat_id,title in groups.items():print(chat_id,title)
 if not groups:print('No groups found. Add the bot to the closed staff group and send /setup@WoodBaseLazerBot there, then repeat.')
 sys.exit(0)
secret=os.environ.get('WOODBASE_TELEGRAM_WEBHOOK_SECRET','');group=os.environ.get('WOODBASE_TELEGRAM_GROUP_ID','')
if not re.fullmatch(r'[A-Za-z0-9_-]{32,256}',secret) or not re.fullmatch(r'-[0-9]+',group):fail('Set webhook secret and closed group ID in the protected environment.')
url=urllib.parse.urlparse(args.url)
if url.scheme!='https' or not url.hostname or url.username or url.password:fail('The webhook must use a public HTTPS URL.')
chat=call('getChat',{'chat_id':group})
if chat.get('type') not in ['group','supergroup'] or chat.get('username'):fail('Use a closed staff group, not a public group/channel or private customer chat.')
member=call('getChatMember',{'chat_id':group,'user_id':me['id']})
if member.get('status') not in ['member','administrator','creator']:fail('Add the bot to the closed staff group first.')
call('setWebhook',{'url':args.url,'secret_token':secret,'allowed_updates':['message','callback_query'],'drop_pending_updates':False})
if call('getWebhookInfo').get('url')!=args.url:fail('Webhook URL could not be verified.')
print('Webhook registered for @WoodBaseLazerBot. Check a staging order and both directions of replies before enabling customer traffic.')
