# WoodBase: staging на AdminVPS через SSH-туннель

8 ноября 2026. Подготовка конфигурации, **не выполненное развёртывание**. Цель: Ubuntu24.04 LTS, 2vCPU/4GiB/60GiB NVMe. Исходная проверенная база `feature/woodbase-constructor-ux`, `a37d68ef2ab171bf0bf9524b1653df206571f89b`. Инфраструктурная ветка `chore/woodbase-docker-staging`. Коммит подготовки указывается в итоговом сообщении; ветка автоматически не публикуется.

## Архитектура и ограничения

Используется отдельный standalone Compose `integrations/woocommerce/ops/adminvps-staging.yaml`, наследующий сервисы существующего `ops/compose.yaml`. **Не объединять** его через `-f` с production/staging overrides: он уже содержит нужные настройки. Требуется Compose **≥2.24.4**, поддерживающий `!override` для замены, а не добавления публичных ports.

Единственная публикация — **127.0.0.1:8443 → Nginx443**. Порты80/443 VPS не открываются. MariaDB и FPM без published ports; DB находится только в internal data network. Vite — готовый dist, Node/Vite dev/preview на VPS не запускаются. Общий URL для браузера и WP: **https://localhost:8443**. Это staging, не будущий production-домен. На клиенте туннель также должен использовать порт8443; не менять только одну сторону origin.

Именованные volumes проекта `woodbase-adminvps-staging` отделены от production: db/wp/private/acme. Private не монтируется в Nginx, права0700/0600 сохраняются. Код WoodBase/Woo, dist, guard и конфигурации подключаются read-only. Staging Basic Auth завершается на edge; Authorization не передаётся в WordPress. Нельзя снимать Basic Auth для внешних callback: реальные gateways здесь не подключаются.

Лимиты: MariaDB1GiB, buffer pool256MiB, connections30; PHP1GiB, три ondemand workers по256MiB PHP memory limit; Nginx256MiB. Общий контейнерный memory budget≈2,25GiB оставляет место ОС/daemon/cache. CPU limits0,6/1/0,3. Это стартовые ограничения, не гарантия производительности обработки изображений и backup. Private budget1GiB, logs10MiB×3. Следить за OOM/restarts, swap pressure и свободным диском; полный диск60GiB не равен доступному Docker месту.

MU guard обязательно требует staging, подавляет `wp_mail`, закрывает WP indexing, оставляет только ручной BACS без банковских реквизитов и выключает shipping methods. WP HTTP external requests заблокированы. Это не сетевой firewall для произвольных PHP-программ: **не устанавливать реальные платёжные/почтовые/доставочные плагины и credentials**. Нужны только синтетические заказы. Нынешние версии WP6.8.3/WC10.3.5 сохранены для совместимости с проверенным кодом, не объявлены актуальными для коммерческого запуска.

## 1. Диагностика до установки

Команды выполняет администратор **на целевом VPS**, здесь они не запускались:

```sh
cat /etc/os-release
nproc
free -h
df -hT
lsblk -f
sudo ss -lntup
systemctl --type=service --state=running
sudo sshd -t
sudo ufw status verbose
sudo nft list ruleset
sudo apt-get update
apt list --upgradable
```

Подтвердить Ubuntu24.04, ресурсы и отдельный staging-хост. Если уже есть Docker/сервисы/данные — сначала inventory; не удалять пакеты/volumes и не заменять daemon configuration автоматически. Перед настройкой SSH/firewall иметь рабочую консоль AdminVPS и вторую проверенную SSH-сессию. Для этого туннельного этапа требуется только разрешённый SSH-порт; не выполнять слепое включение UFW или изменение SSH-порта.

## 2. Установка Docker из официального APT-репозитория

После проверки существующих пакетов. Обновления ОС/перезагрузка — в отдельное согласованное окно; установка ниже не включает автоматический reboot.

```sh
sudo apt-get install -y ca-certificates curl git unzip apache2-utils gnupg python3
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
test "$ID" = ubuntu && test "$VERSION_ID" = 24.04
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' "$(dpkg --print-architecture)" "$VERSION_CODENAME" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
sudo docker info --format '{{.Driver}}'
```

Использовать sudo; членство в docker group равносильно root. Не менять storage driver существующего daemon. Для нового Ubuntu-хоста штатное Docker-хранилище предпочтительнее vfs. Проверить Compose≥2.24.4. Официальная инструкция: https://docs.docker.com/engine/install/ubuntu/ .

## 3. Release, vendor и сборка

После отдельного разрешения на публикацию инфраструктурной ветки можно клонировать её. Пока она только локальная, альтернативный способ доставки — `git bundle` этой ветки с доверенной машины. Не ожидать, что новой конфигурацией обладает старый коммит a37d68e.

```sh
sudo install -d -m 0755 -o "$USER" /srv/woodbase
umask 022
git clone --branch chore/woodbase-docker-staging https://github.com/dmsiv9617-code/site.git /srv/woodbase/site
cd /srv/woodbase/site
git checkout --detach PREPARED_COMMIT_SHA
```

`PREPARED_COMMIT_SHA` заменить полным SHA из отчёта подготовки. Рабочую копию на VPS не использовать для хранения секретов/backup.

На доверенной build-машине с установленным поддерживаемым Node/npm:

```sh
npm ci
node --test --test-isolation=none tests/*.test.mjs
VITE_COMMERCE_MODE=woocommerce VITE_WOOCOMMERCE_ORIGIN= npm run build
```

Передать **полный dist**, включая public graphics, на `/srv/woodbase/dist-staging`. Сохранить SHA release и manifest SHA256 артефактов. Код/директории0755, публичные файлы0644. В staging используется именно проверенный фронтенд: GSAP/Вуди/конструктор не переписываются. Пакет Vite имеет известное dev advisory; он не должен слушать внешние порты VPS.

В `/srv/woodbase/vendor/woocommerce` подготовить проверенный официальный WooCommerce10.3.5, а `/srv/woodbase/vendor/wp-cli.phar` — официальный WP-CLI2.12.0. Источники из существующего setup: GitHub `woocommerce/woocommerce/releases/tag/10.3.5`, `wp-cli/wp-cli/releases/tag/v2.12.0`. Использовать проверенные release artifacts и утверждённые SHA256/signatures; запись собственного `sha256sum` после загрузки — manifest, **не самостоятельная проверка подлинности**. Не запускать `setup.py` на VPS: это инструмент отдельной local-среды с другими URL/volumes.

## 4. Только новые staging-секреты и TLS

```sh
sudo install -d -m 0700 /srv/woodbase/secrets /srv/woodbase/secrets/tls
sudo install -m 0600 integrations/woocommerce/ops/adminvps/.env.example /srv/woodbase/secrets/adminvps-staging.env
sudoedit /srv/woodbase/secrets/adminvps-staging.env
sudo htpasswd -cB /srv/woodbase/secrets/staging.htpasswd woodbase-reviewer
```

В env вписать два **новых независимых случайных** DB-пароля (например, hex из `openssl rand -hex 32`), заполнить только существующие абсолютные paths. В example реальные значения отсутствуют. Не использовать данные production, не выводить полный `docker compose config`, `env` или secrets в журнал; только `config --quiet`.

TLS можно подготовить на доверенной рабочей машине **вне checkout** (CA private key зашифрован; OpenSSL запросит passphrase):

```sh
umask 077
mkdir -p ~/woodbase-staging-tls
cd ~/woodbase-staging-tls
openssl req -x509 -newkey rsa:3072 -keyout ca.key -out ca.crt -days 90 -subj '/CN=WoodBase staging CA' -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign'
openssl req -new -newkey rsa:2048 -noenc -keyout privkey.pem -out localhost.csr -subj '/CN=localhost'
printf 'subjectAltName=DNS:localhost\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n' > localhost.ext
openssl x509 -req -in localhost.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out localhost.crt -days 30 -sha256 -extfile localhost.ext
cat localhost.crt ca.crt > fullchain.pem
openssl verify -CAfile ca.crt -verify_hostname localhost localhost.crt
```

Передавать server key/fullchain только после проверки SSH host key; CA key на VPS не передавать. Запланировать обновление server certificate до истечения30дней. После генерации вернуться в каталог checkout для следующих команд.

TLS должен быть валиден для `localhost` (SAN). На доверенной машине создать отдельный staging CA/server certificate, передать **только** `fullchain.pem` и `privkey.pem` в TLS_DIR; CA private key хранить отдельно. Доверить публичный CA сертификат только нужному браузеру/профилю/клиенту. Для curl использовать `--cacert`. Альтернатива — заранее проверенный self-signed localhost certificate и явное доверие ему. **Не использовать curl -k или отключение проверки сертификатов.** Сертификат для IP VPS не подходит URL localhost. Private key0600, fullchain0644, enclosing host directory0700. Удалённый сертификат production не копировать.

Определить numeric GID nginx в выбранном image (`docker run --rm --entrypoint id nginx:1.28-alpine -g nginx`), установить group владельцем htpasswd и0640. В контейнер файл должен читать nginx worker; host parent0700 остаётся закрытым. Убедиться, что это хеш staging Basic, а не plaintext пароль.

## 5. Запуск и одноразовое заполнение

В оболочке администратора определить helper (не сохраняет паролей):

```sh
dc() { sudo docker compose -f /srv/woodbase/site/integrations/woocommerce/ops/adminvps-staging.yaml --env-file /srv/woodbase/secrets/adminvps-staging.env "$@"; }
dc config --quiet
# Перед up проверить ≥15 GiB свободно для images/данных/backup scratch.
dc pull
dc up -d db wordpress
dc exec -T -u root wordpress sh -c 'chown www-data:www-data /var/woodbase-private && chmod 700 /var/woodbase-private'
read -rs -p 'Новый пароль тестового WP admin: ' staging_admin_password
printf '\n'
printf '%s' "$staging_admin_password" | dc exec -T wordpress php /opt/woodbase-staging-bootstrap.php
unset staging_admin_password
# Второй процесс загружает уже активированный WooCommerce и создаёт тестовый товар/pages.
dc exec -T wordpress php /opt/woodbase-staging-bootstrap.php
dc up -d web
dc ps
dc exec -T web nginx -t
dc exec -T wordpress php-fpm -t
```

Ничего из этого не выполнено на VPS в рамках подготовки. Bootstrap отказывается работать с unmarked установленной БД, неподходящим environment или URL. Использовать только новые volumes; **не копировать production DB и не ставить marker вручную для обхода проверки**. Он создаёт WP admin `woodbase-admin`, RUB, HPOS, гостевой classic checkout, один virtual тестовый альбом3540₽ и BACS «не оплачивать». Это не настройка настоящего физического магазина. Script можно повторить в своём отмеченном staging для завершения seed, но он перезаписывает тестовые settings; не запускать как ежедневный cron.

## 6. Доступ с компьютера администратора

Сначала подтвердить IP/пользователя и **полный** host fingerprint через независимую консоль AdminVPS. RSA host key и клиентский Ed25519 — разные ключи. Настроить verified known_hosts; сканирование ssh-keyscan само по себе не подтверждает подлинность.

```sh
ssh -i /path/to/dedicated_staging_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ExitOnForwardFailure=yes -N -L 127.0.0.1:8443:127.0.0.1:8443 woodbase-deploy@VERIFIED_VPS_IP
```

Открыть `https://localhost:8443`, пройти staging Basic Auth, затем WP login. Не связывать локальный8443 с0.0.0.0. Внешний HTTP-доступ и DNS woodbase.ru/Vercel не нужны. Если среда Codex блокирует SSH/TCP, выполнять tunnel на своей рабочей машине; это не основание отключать host verification.

## 7. Приёмка и cron

Проверить `sudo ss -lntp`: веб-8443 слушает только127.0.0.1, DB3306/FPM9000 отсутствуют среди published ports. Docker bypass UFW для published ports — причина не полагаться только на UFW, а явно bind loopback.

```sh
# Через туннель; -u без значения пароля запрашивает его интерактивно.
curl --cacert /path/to/staging-ca.pem -u woodbase-reviewer -I https://localhost:8443/
curl --cacert /path/to/staging-ca.pem -u woodbase-reviewer https://localhost:8443/wp-json/woodbase/v1/product
dc exec -T -u www-data wordpress php /opt/wp-cli.phar --path=/var/www/html woodbase status
dc exec -T -u www-data wordpress php /opt/wp-cli.phar --path=/var/www/html woodbase cleanup --dry-run --batch-size=100
dc stats --no-stream
```

Без Basic ожидается401, с Basic200. Проверить guest корзину/reload/reopen, Secure/HttpOnly/SameSite=Lax cookie, персонализацию, оригинал PNG, classic checkout/HPOS, admin download и anonymous deny. Создать только синтетический заказ, проверить отсутствие письма и коммерческих gateway/shipping вызовов. Чистый первоначальный товар один, остальные модели остаются demo.

WP-Cron отключён намеренно. Системный cron root каждую минуту: `flock -n /run/lock/woodbase-adminvps-staging-cron.lock /usr/bin/docker compose -f /srv/woodbase/site/integrations/woocommerce/ops/adminvps-staging.yaml --env-file /srv/woodbase/secrets/adminvps-staging.env exec -T -u www-data wordpress php /opt/wp-cli.phar --path=/var/www/html cron event run --due-now`. Вывод — в закрытый ротируемый журнал. Во время backup/restore/deploy приостановить cron и убедиться, что активных одноразовых PHP workers нет. Контролировать последний успешный запуск, disk/inodes, OOMKilled/restarts, DB/private usage. Не запускать delete по возрасту для order/pending/legacy макетов.

## 8. Backup/restore и остановка

Использовать существующие `ops/backup.py`/`ops/restore.py` и политику [основного плана](production-deployment-plan.md). Compose path теперь **adminvps-staging.yaml**, project **woodbase-adminvps-staging**. Дополнительно backup исключает readonly staging MU guard из wordpress.tar: его код уже входит в infrastructure.tar/ops и при восстановлении монтируется из того же release, а не перезаписывается поверх read-only bind.

До backup: согласовать maintenance, приостановить cron, проверить свободное место, GPG keys/fingerprints и отдельное зашифрованное filesystem для plaintext scratch вне checkout/web. Source PHP кратко останавливается. Пример (placeholders заменить проверенными значениями):

```sh
sudo python3 integrations/woocommerce/ops/backup.py --compose integrations/woocommerce/ops/adminvps-staging.yaml --env-file /srv/woodbase/secrets/adminvps-staging.env --project woodbase-adminvps-staging --destination /srv/woodbase-encrypted-backups --scratch /secure-encrypted-scratch --recipient FULL_RECIPIENT_FINGERPRINT --signer FULL_SIGNER_FINGERPRINT --proof-order SYNTHETIC_ORDER_ID --confirm-maintenance
```

Копия зашифрована и подписана, но локальный каталог не является off-host backup. Перенести encrypted artifact в отдельное закрытое хранилище/сервер; хранение/rotation ключей и retention согласовать отдельно. Main decrypt private key на VPS не нужен. Не переносить test-only secrets в production.

Восстановить **в новый** `woodbase-restore-*` проект с отдельными volumes/env-out через restore.py; он требует≥8GiB free, matching PHP release hash и валидную подпись. Не запускать web до проверки URL/secrets/guard и контроля изоляции. Проверить заказ/JSON/PNG SHA256, затем через изолированный tunnel — вход в admin, PNG200 и запрет анониму. На том же хосте новый web тоже претендует на8443: держать его остановленным; для browser rehearsal остановить исходный staging web в согласованное окно либо использовать отдельный VPS. Независимый restore — отдельная приёмка, не выдавать наличие архива за её PASS.

Остановка без удаления данных: `dc stop`. `dc down` сохраняет named volumes, но останавливает сеть/контейнеры; **не добавлять -v**. Не выполнять `docker system prune --volumes`. Перед обновлением snapshot+backup и согласованный release SHA; откат DB/private должен быть согласованным, не одним откатом plugin поверх мигрированной БД.

## Результаты локальной подготовки

- **PASS:** `python3 scripts/verify-adminvps-staging.py` — resolved Compose: только loopback8443, без DB/FPM ports, отдельные volumes/internal DB, read-only mounts, resource/log limits, staging guard и общий origin.
- **PASS:** тот же скрипт с `--php-container woodbase-local-wordpress-1` — PHP syntax, FPM config parser, mail suppression/manual-only gateway/shipping off/noindex и отказ guard работать в production. Контейнер существующий локальный; новые staging volumes не создавались.
- **PASS:** 22 Node tests, две Vite demo/live build. Live bundle `index-pYDm4gt0.js` совпадает с проверенной базой; исходники фронтенда и графика не менялись.
- **PASS:** существующий `verify-nginx-template.py` — Nginx syntax, доверенный локальный TLS/SAN, cookie Secure/HttpOnly/SameSiteLax, no-store, safe503 и Basic401/200 без передачи Basic credentials в WP. Это проверка общего шаблона, не нового полного staging stack.
- **PASS:** Python compile, diff whitespace checks.
- **НЕ ВЫПОЛНЕНО:** fresh staging bootstrap с новой БД, полный browser guest flow именно нового Compose, Docker install на Ubuntu/VPS, off-host backup и independent restore. Старые PASS покупки/backup не выдаются за повторную приёмку новой инфраструктуры.
- Существующий backup tool изменён только для исключения readonly staging guard из WP tar; его синтаксис проверен, новый encrypted backup/restore цикл в этом этапе не запускался.

Ни одна команда SSH/SCP к VPS не выполнялась. Старые настройки Vercel, frontend/GSAP/конструктор и базовая feature-ветка не менялись. Полный новый stack/clean install и независимый restore здесь не запущены: около1GiB free на executor против≥8GiB preflight/≥15GiB практического резерва. Целевой AdminVPS60GiB нужно проверить фактически; «свободно60GiB» не предполагается автоматически.
