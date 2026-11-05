# WoodBase — проект развёртывания в Timeweb Cloud

5 ноября 2026. **Конфигурация подготовлена, реальное развёртывание не выполнялось.** Домен woodbase.ru — проектное значение, не разрешение менять DNS/сервер/Vercel. Приоритет — Timeweb Cloud, регион VM и резервного хранилища в РФ. Наличие конкретных тарифов/образов и цены проверить у провайдера перед заказом; коммерческие ресурсы не приобретались.

## Ресурсы и структура

Начальный ориентир: **4 vCPU, 8 ГБ RAM, 100–120 ГБ SSD/NVMe**, Ubuntu 24.04 LTS или другой поддерживаемый Linux с Docker Compose v2/Python 3.12, мониторингом и обновлениями безопасности. Для малого staging возможно 2 vCPU/4 ГБ/40–60 ГБ, но image processing, backup и параллельная работа PHP должны пройти нагрузочный тест. Это инженерная оценка, не измерение production-трафика. PHP-FPM concurrency ограничить бюджетом памяти: 16M pixels декодирования требуют десятков/сотен МБ на worker; начать с 3–5 workers, MariaDB buffer pool 256–512 МБ, затем измерять.

Docker `vfs` особенно дорог по диску; на обычном поддерживаемом Linux предпочтителен штатный overlay2 при новом provisioning. Не менять storage driver существующего daemon с данными. Для второго тестового стека/restore сценарий требует минимум **8 ГиБ дополнительного свободного места именно Docker daemon**, практически выделить 10–15 ГиБ запаса. Для production держать запас не менее объёма DB+WP+private для scratch и дополнительного encrypted artifact, плюс 20–25% диска; при больших заказах резервное копирование должно перейти на отдельный том/сервер.

Сервисы: статический Vite build, Nginx TLS edge, PHP-FPM WordPress/WooCommerce, MariaDB на приватной сети, приватный volume макетов. Публичны только 80/443; БД и PHP-FPM не публикуются. Путь внутри PHP `/var/woodbase-private`, каталог 0700, файлы 0600. Имена файлов — случайные IDs. Не размещать customer PNG в публичном uploads или Vite public. Код и каталог изображений — неизменяемый release; DB/WP uploads/private — отдельные постоянные volumes.

## Конфигурационные артефакты

- `integrations/woocommerce/ops/compose.yaml`: production template с отдельными volumes и rotation Docker logs (10 МБ × 3 на сервис).
- `ops/staging.yaml`: отдельное имя проекта/volumes, WP_ENVIRONMENT_TYPE=staging и HTTP Basic access. Отдельные hostname, DB credentials, TLS и htpasswd обязательны.
- `ops/nginx/site.conf.template`: единый origin, TLS, безопасные static/dynamic routes, cache policy, ограничение upload на edge.
- `ops/.env.example`: только публичные значения и пустые secret-поля. Реальный env — 0600, вне Git, staging/production не должны делить secrets/volumes.
- `ops/backup.py`, `ops/restore.py`: инструменты зашифрованной подписанной копии и восстановления только в новый изолированный проект. Backup-инструмент выполнен в локальной rehearsal; данные восстановлены в отдельную временную БД/каталог с проверкой заказа и admin PNG. Standalone restore.py на новом Docker stack/сервере пока не выполнен из-за места.

Проверка Compose выполняется `config --quiet` (не печатать `config` с секретами). Синтаксис Nginx и локальный TLS проверяются `python3 scripts/verify-nginx-template.py` на текущем dev web-container отдельным временным процессом, без reload основного Nginx. Публичный DNS/TLS/guest flow этим не подтверждается.

Фиксированный тестовый набор — WP 6.8.3 / WC 10.3.5 / PHP 8.3.28 / MariaDB 11.4 / Nginx 1.28. Перед публичным запуском выбрать актуальные поддерживаемые версии, проверить advisory/changelog и повторить все тесты на зафиксированных image digests. Не переносить устаревающие dev pins в production без проверки; фактических CVE этот документ не утверждает.

## Единый HTTPS-origin и маршруты

Проектный production origin: `https://woodbase.ru`; staging — отдельный согласованный hostname, например `https://staging.woodbase.ru`, до подтверждения не использовать. VITE_COMMERCE_MODE=woocommerce, VITE_WOOCOMMERCE_ORIGIN пустой: API идёт на тот же origin. WordPress WP_HOME/WP_SITEURL и WOODBASE_FRONTEND_ORIGIN равны этому HTTPS-origin. Vercel rewrites/DNS не менялись.

| Маршруты | Обработчик |
|---|---|
| `/`, hash routes, публичные изображения | Vite dist; fallback index.html |
| `/assets/` | Versioned static, immutable |
| `/wp-json/`, `?rest_route=` | WP/Woo/собственный REST, no-store |
| `/checkout/`, `/checkout/order-pay/...`, `/checkout/order-received/...` | WP classic checkout, no-store |
| `/cart/`, `/my-account/` и их endpoints | WP, no-store |
| `?wc-ajax=...`, `/wp-admin/admin-ajax.php` | WC checkout updates и системный AJAX, no-store |
| `/wc-api/...`, `?wc-api=...` | Возможные gateway callbacks; точные URL проверить по официальным модулям |
| `/wp-admin/`, `/wp-login.php`, `/wp-admin/admin-post.php` | Админка, вход, защищённая выдача файла; no-store |
| `/wp-content/`, `/wp-includes/` | Только разрешённые static extensions, не произвольные PHP/SQL/ZIP/backup files |
| `/wp-sitemap...` | WP sitemap; SEO sitemap Vite/robots согласовать перед релизом |
| `/wp-cron.php`, `/xmlrpc.php`, dotfiles, wp-config.php | Публичный доступ запрещён |
| `/.well-known/acme-challenge/` на 80 | Только каталог ACME HTTP-01 |

Не добавлять произвольный PHP handler для всех URL. Если официальный Ozon модуль использует отдельный PHP callback, сначала подтвердить документацию/аутентификацию, затем узко разрешить маршрут и проверить его; текущий шаблон такой маршрут не обещает. WP default `/shop/` не является отдельным утверждённым магазином WoodBase: согласовать redirect на frontend collection перед приёмкой навигации.

## HTTPS, cookie, proxy и защита staging

Nginx завершает TLS (валидная цепочка fullchain.pem, private key 0600), передаёт PHP `HTTPS=on` и проверенный REMOTE_ADDR. По умолчанию **не доверять X-Forwarded-For**. Если появится Timeweb LB/CDN, получить его точные CIDR из первичной документации, настроить Nginx real_ip только для них и проверить forged-header test. Не доверять всем RFC1918/0.0.0.0/0. WP default WOODBASE_TRUSTED_PROXIES=[]; PHP helper поддерживает явно доверенные цепочки, но на обычном edge это не нужно.

Woo cookie-session и Store API Cart-Token восстанавливают корзину. Cookie session — HttpOnly, SameSite=Lax, Secure на HTTPS, срок 48 ч; служебные cart counter cookies могут оставаться читаемыми JS. Lease макета обновляется при загрузке корзины; default session TTL и token TTL выровнены. Не хранить Cart-Token/nonce в exports/localStorage, не включать их в логи. WP auth cookies обслуживает WordPress с FORCE_SSL_ADMIN. Динамические WP/API/checkout/admin ответы исключены из cache; CDN/cache plugin не должен кешировать их или ответы Set-Cookie. CORS собственного API — только текущий разрешённый origin, не wildcard credentials.

Staging: отдельный проект `woodbase-staging`, Basic access + noindex, независимые credentials, только синтетические данные и ручной тестовый gateway. Basic credentials в htpasswd вне Git; не использовать реальные клиентские данные без отдельного плана миграции. Явно отключить реальные gateways, mail transport и shipping automation до тестов: staging != local, поэтому local mail suppressor нельзя считать staging-защитой. Restrict outgoing providers дополнительно на сетевом уровне.

Локальный `woodbase.test` TLS probe проверил сертификат через локальный CA/SAN без отключения TLS-проверки и подтвердил Secure/HttpOnly/SameSite и no-store. **Реальный публичный HTTPS-origin и его полный сценарий покупки не тестировались**: домен/сервер не предоставлены и публикация не разрешена.

## Порядок развёртывания после отдельного согласования

1. Зафиксировать image digests, версии PHP/WP/WC/плагина; утвердить коммерческий SKU/опции/цены/массу/габариты и политику файлов. Уточнить Timeweb RF region и off-host backup region.
2. Создать отдельную VM/SSH keys/firewall, non-root deployment user, Docker/Compose/Python/GnuPG; ОС и Docker patching plan. Не трогать действующий Vercel.
3. Доставить утверждённый Git release в `/srv/woodbase/releases/<sha>`, получить официальный Woo release и WP-CLI из первичных источников, проверить версии/checksums; не скачивать сторонние сборки. Custom/Woo plugin sources read-only, права каталогов 0755/исходников 0644.
4. Сгенерировать отдельные DB/admin credentials (например cryptographic hex), сохранить env 0600. Секреты никогда не VITE_*. Никаких дампов/ключей в Git. Утвердить hostname, выпустить валидный TLS, настроить renewal без публикации private keys.
5. Собрать `VITE_COMMERCE_MODE=woocommerce npm run build`, разместить полный dist вместе с публичными assets. Проверить Compose `config --quiet` и Nginx `-t`.
6. Запустить сначала staging DB/PHP, установить WP через официальный WP-CLI, назначить URLs, ru_RU и официальные core/Woo language packs, HPOS, гостевой checkout. Local bootstrap намеренно запрещён вне local — не запускать его в production. Пользоваться WP-CLI prompt для admin password, не класть пароль в shell history.
7. До активации плагинов подготовить private 0700 с владельцем PHP и публичные vendor dirs/files 0755/0644. Подключить проверенный Woo и WoodBase, создать staging SKU; назначить страницу `[woocommerce_checkout]`, для проверки staging отключить Coming Soon и включить только ручной тестовый BACS. Подготовить каталог private 0700 с владельцем PHP UID (для Alpine www-data обычно 82). Не путать virtual test SKU с физическим коммерческим товаром.
8. Настроить system cron и мониторинг, encrypted off-host backup; выполнить **полное восстановление** в отдельный stack и admin file download, не только создание архива.
9. Провести матрицу реального HTTPS staging: guest upload/cart/reload/close-reopen/checkout/order/admin file, CSRF/CORS/proxy spoofing, Secure cookies, cache, error codes, quotas/rates/cleanup/race/HPOS; проверить отсутствие реальных сетевых операций оплаты/доставки.
10. Только после отдельной приёмки/согласования — production deployment/DNS. Окончательный Ozon compatibility gate остаётся отдельным этапом; никакой собственный платёжной формы.

## Cron и лимиты

В development разрешён WP-Cron (`wb_maintenance`, каждые 5 минут). Production DISABLE_WP_CRON=true: системный cron каждые 5 минут вызывает официальный WP-CLI внутри PHP контейнера:

```sh
# Упаковать в root-owned script с абсолютными путями; stdout/stderr в ротируемый закрытый журнал.
flock -n /run/lock/woodbase-cron.lock docker --host=unix:///var/run/docker.sock compose -p woodbase-staging -f /srv/woodbase/current/integrations/woocommerce/ops/compose.yaml -f /srv/woodbase/current/integrations/woocommerce/ops/staging.yaml --env-file /srv/woodbase/secrets/staging.env exec -T -u www-data wordpress php /opt/wp-cli.phar --path=/var/www/html cron event run --due-now
```

Для ручной проверки: `wp woodbase cleanup --dry-run --batch-size=250`, затем без dry-run; `wp woodbase status`. DB advisory locks и файловые flock-блокировки блокируют одновременные очистки; 256 фиксированных stripe lock-файлов в private/.locks защищают переходы даже при потере DB-lock/reconnect и не накапливаются на каждый файл; один run ограничен 1000 файлами и 10000 service rows на категорию. Проверять возраст последнего успешного cron, число pending/legacy holds, ошибки unlink, место/количество файлов и размер БД. Не чистить order/pending/legacy holds по возрасту.

Настройки PHP constants: WOODBASE_STORAGE_LIMITS (по умолчанию owner_files=10, owner_bytes=50 MiB, reserve_bytes=20 MiB, total_bytes=512 MiB local, total_files=10000, temporary_ttl=86400, session_ttl=172800, receipt_ttl=259200, причём он не меньше session_ttl+24 ч). Production template total_bytes=5 GiB. Нормализованный PNG >20 MiB отклоняется с 413 и освобождением reservation. Физический working budget учитывает до 64 MiB на каждую незавершённую обработку плюс минимум 64 MiB свободного резерва (даже если допустимый финальный PNG меньше); дополнительно monitor/reject threshold от disk budget. WOODBASE_COMPLETED_RETENTION_DAYS=0 означает отсутствие review срока; ненулевое значение ставит дату **ручного рассмотрения**, не разрешает автоматическое удаление заказов.

WOODBASE_RATE_LIMITS позволяет переопределить положительные лимиты: upload IP30/owner10, session IP60, catalog IP120, add IP120/owner30, cart IP120, checkout IP30 за 60 сек; global gate500 на категорию. IP/session IDs хранятся HMAC, окно rate row до 120 сек, истёкшие строки также удаляются инкрементально при запросах. XFF не превращает новые cookies в новый IP. Nginx upload edge2r/s burst10 — дополнительная защита, не замена PHP лимитам. Подбор значений подтвердить нагрузкой/NAT users, не отключать все ограничения.

## Backup и восстановление

Цель: согласованный снимок MariaDB + WP/uploads + private + infrastructure/env. `ops/backup.py` требует подтверждённого maintenance window: останавливает PHP (останавливаются uploads/cleanup/checkout), делает transaction-consistent DB dump и tar компонентов, затем всегда запускает PHP обратно. Все внешние PHP workers/cron должны относиться к этому стеку; чужие DB writers не должны работать в окно. Read-only plugin code исключён из WP tar и входит в infrastructure/release, Woo восстанавливается из проверенного release.

Scratch **вне Git/web source**, 0700 на защищённом/зашифрованном filesystem. Там временно есть plaintext DB/config/private; после операции временный каталог удаляется. Backup stream шифруется GnuPG на полный проверенный recipient fingerprint и подписывается отдельным signing key. Private decrypt key не должен жить на основном сервере; backup machine может иметь только public encryption key и отдельный signing key. Не передавать passphrases в argv/Git; использовать защищённый agent/operator key management.

Пример команды **для будущей rehearsal, здесь не выполнялась**:

```sh
python3 integrations/woocommerce/ops/backup.py --compose integrations/woocommerce/ops/compose.yaml --env-file /srv/woodbase/secrets/production.env --project woodbase-production --destination /srv/woodbase/backups --scratch /srv/woodbase-backup-scratch --recipient FULL_RECIPIENT_FINGERPRINT --signer FULL_SIGNER_FINGERPRINT --proof-order TEST_ORDER_ID --confirm-maintenance
```

Шифрованный artifact 0600 перенести по TLS/SSH в отдельное приватное хранилище/сервер российского региона (например согласованное S3-compatible object storage), с версионированием/неизменяемостью и отдельными credentials. Не считать off-host сохранение выполненным: аккаунт/хранилище не подключались. Регулярно тестировать decrypt/signature, rotation ключей и отсутствие публичных ACL. Срок backup/заказов требует согласования; автоматическое удаление производственных файлов пока запрещено.

Restore tool требует **новый** проект `woodbase-restore-*`, отказывается от существующих containers/volumes/env-out, проверяет 8 GiB free через Docker container probe, подпись ожидаемого primary/signing fingerprint, пути tar (без traversal/devices/symlinks). Поднимает только DB/PHP, не web/порты, восстанавливает dump/WP/private и сравнивает контрольный заказ через WC CRUD, hash JSON snapshot и SHA256 файла. Расшифрованный env сохраняется 0600 вне Git; перед дальнейшим запуском изменить URLs/секреты/почту/gateways под изолированный staging. Никакого автоматического overwrite рабочего стека.

```sh
python3 integrations/woocommerce/ops/restore.py --archive /secure-backups/backup.tar.gpg --compose integrations/woocommerce/ops/compose.yaml --project woodbase-restore-rehearsal --scratch /srv/woodbase-restore-scratch --env-out /srv/woodbase/secrets/restored.env --probe-container woodbase-production-wordpress-1 --signer FULL_SIGNER_FINGERPRINT
```

После hash proof обязательно открыть заказ через изолированную staging admin, скачать PNG, сверить параметры/цену, проверить запрет анониму и гостевую покупку без реальных provider calls. Сохранить проверяемый restore report/RPO/RTO. При ошибке новый restore stack остаётся изолированным для диагностики; удалять только его после проверки, не рабочие volumes.

**Текущий статус:** `scripts/verify-backup-rehearsal.py` выполнил реальный цикл: GnuPG encrypted+signed backup, проверка подписи/decrypt, восстановление dump в отдельную временную БД, WP/private в отдельный каталог, WC CRUD snapshot/file SHA256, вход в восстановленную админку, скачивание PNG с тем же SHA256 и отказ анониму. Использовались синтетические данные и одноразовый test key; временные данные/ключи/DB/grants и loopback-маршрут удалены. Исходная DB и файлы не перезаписывались. Rehearsal кратко останавливает только локальный PHP для согласованного backup; исходные маршруты возвращаются в finally.

Независимый новый stack/сервер и off-host RF-хранилище **не проверены**: Docker около 1,2 ГБ free (vfs), standalone restore preflight требует 8 GiB. Логическое восстановление на существующем DB engine не доказывает disaster recovery после потери VM. До реальных данных выполнить вторую rehearsal на дополнительном диске/сервере и подключить off-host storage с проверкой ключей/RPO/RTO. Команда для воспроизводимого дешёвого локального теста: `python3 scripts/verify-backup-rehearsal.py` (требует 700 MiB свободно, GnuPG, Chromium и исходный тестовый order.json). Прямой доступ браузера к private Docker hostname блокировался proxy; итоговый тест использует только уникальный временный путь на loopback localhost, сохраняет исходные Nginx routes и удаляет конфигурацию после проверки.

## Откат

До каждого изменения — согласованный backup, проверенный restore и release SHA/digests. Для frontend/custom plugin откатить immutable release symlink и image pin с конфигурацией прежнего origin; сделать health/guest-session checks. Для схемы БД/метаданных нельзя откатывать только plugin code поверх изменённой БД без compatibility-test: сначала maintenance, восстановить согласованную DB+private+WP копию в изолированный стек, проверить заказ/файл, затем переключить маршрутизацию после согласования. Сохранить новые заказы, принятые после backup: не перетирать production dump без плана их переноса. Old schema wb_file options мигрируются в таблицы; автоматического reverse migration нет. Никакого `docker system prune --volumes` и удаления рабочего private/db volume.


## Замечания по HTTP и сборке

`php-uploads.ini` согласует upload_max_filesize=5M, post_max_size=6M, memory_limit=256M, timeouts60s, display_errors=Off. Это устраняет конфликт 5 MiB приложения с дефолтными 2 MiB PHP; большой валидный JPEG проверен отдельно. Права vendor assets должны быть 0755/0644: PHP и Nginx работают под разными UID. В hardening исправлен local setup, чтобы Nginx мог читать Woo checkout JS при umask0077; приватные файлы не делаются публичными.

Staging Basic credentials завершаются на edge и очищаются перед WP FastCGI (`staging-auth.conf`), иначе WordPress может принять их за application password и отказать guest REST. Production сохраняет Authorization через `production-auth.conf`. Nginx access log не содержит query args, Referer, Authorization, Cart-Token или request body; ограниченная Docker log rotation остаётся обязательной. Локальная проверка подтвердила 401 anonymous/200 Basic на staging gate без передачи credentials в WP. Это не полная проверка внешнего staging.

Файл htpasswd должен читаться worker Nginx, например `0640 root:nginx`, с доступными родительскими каталогами. Restore требует подготовить ту же версию WoodBase: SHA256 PHP-файлов проверяется по подписанному manifest; приложение автоматически не перезаписывается.
