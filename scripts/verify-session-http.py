#!/usr/bin/env python3
"""Exercise only local WordPress: authenticated and guest cart/nonce continuity."""
import http.cookiejar
import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request

BASE = 'http://localhost:8088'
root = pathlib.Path(__file__).resolve().parents[1]
secret = dict(line.split('=', 1) for line in (root / 'integrations/woocommerce/.env').read_text().splitlines() if '=' in line)['WP_ADMIN_PASSWORD']

def client(logged_in=False):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    if logged_in:
        opener.open(BASE + '/wp-login.php', timeout=15).read()
        opener.open(BASE + '/wp-login.php', urllib.parse.urlencode({'log': 'woodbase-admin', 'pwd': secret, 'testcookie': '1', 'redirect_to': BASE + '/wp-admin/'}).encode(), timeout=15).read()
    def call(path, body=None, headers=None):
        req = urllib.request.Request(BASE + '/wp-json/' + path, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type': 'application/json', **(headers or {})})
        try:
            response = opener.open(req, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        return response.status, json.load(response), response.headers
    return call

for logged_in in [False, True]:
    call = client(logged_in)
    status, session, _ = call('woodbase/v1/session')
    assert status == 200
    nonce = session['nonce']
    status, cart, headers = call('wc/store/v1/cart')
    assert status == 200
    token = headers['Cart-Token']
    # A mutation through Store API must not change the custom endpoint owner.
    product = call('woodbase/v1/product')[1]
    config = {'version': 1, 'productId': product['id'], 'options': {'model': 'moments', 'wood': 'natural', 'binding': 'bolts', 'leather': 'black', 'motif': 'moments', 'extras': []}, 'inscription': 'Локальная проверка сессии', 'artwork': {'fileId': None, 'x': 0, 'y': 0, 'scale': 1, 'rotation': 0, 'threshold': 140, 'mode': 'engrave'}}
    import secrets
    status, cart, _ = call('wc/store/v1/cart/add-item', {'id': product['id'], 'quantity': 1, 'extensions': {'woodbase': {'configuration': config, 'requestId': secrets.token_hex(16)}}}, {'Cart-Token': token})
    assert status in (200, 201), (logged_in, status, cart.get('code'))
    payload = {'requestId': 'local-session-regression-' + secrets.token_hex(12)}
    status, body, _ = call('woodbase/v1/orders/recover', payload, {'X-Woodbase-Nonce': nonce})
    assert status == 200 and body == {'order': None}, (logged_in, status, body.get('code'))
    status, body, _ = call('woodbase/v1/orders/recover', payload, {'X-Woodbase-Nonce': 'invalid'})
    assert status == 403 and body['code'] == 'wb_nonce'
    assert call('woodbase/v1/orders/recover', payload)[0] == 403
    assert call('woodbase/v1/orders/recover', payload, {'X-Woodbase-Nonce': nonce, 'Origin': 'https://untrusted.example'})[0] == 403
    # The exception must not authenticate unrelated WordPress endpoints.
    assert call('wp/v2/users/me')[0] == 401
    print('PASS session continuity and CSRF boundaries:', 'logged-in administrator' if logged_in else 'guest')
