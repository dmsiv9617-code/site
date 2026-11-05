# WoodBase — отчёт этапа 3: безопасность и стабильность

5 ноября 2026 (Europe/Moscow). Ветка **feature/woocommerce-hardening**, база — актуальная опубликованная `feature/woocommerce-integration`, SHA `6b2dee6dc0a2a7c1a7197ec7e925dd9626d874de`. Перед созданием ветки рабочая копия была чистой. Изменения фиксируются отдельным локальным коммитом; SHA сообщается после commit. Публикация/PR/merge/production deploy не выполняются. `main` и Vercel не менялись.

## Результат и границы приёмки

Реализованы DB-backed lifecycle/квоты, безопасная пакетная очистка, rate limiting, защищённые ошибки и конфигурация единого HTTPS-origin. Подтверждены guest checkout/HPOS/file access, сохранение сессии после закрытия браузера, реальное encrypted+signed backup и восстановление данных с админским скачиванием. Визуальные CSS, изображения, WB/Вуди/GSAP/каталог/конструктор не переписывались.

**Полная внешняя приёмка не закрыта:** новый full Docker clean install/независимый restore stack требуют дополнительного диска; публичный HTTPS staging/domain не предоставлен и не разворачивался; Ozon modules не подтверждены первичными источниками. Локальные TLS и logical restore не выдаются за независимую production-инфраструктуру.

## Серверное хранилище и состояния

Новый `plugin/state.php` использует InnoDB таблицы (с WP prefix):

| Таблица | Назначение и удаление |
|---|---|
| wb_assets | id, HMAC owner, создано, bytes/reservation, state, expires, hold. Удаляются только незащищённые истёкшие файлы без активных ссылок. |
| wb_refs | File→cart lease/request hash; file→order с реальным object_id; pending order pin до сохранения. Истёкшие cart refs очищаются пакетами. Order/pending refs не age-deleted. |
| wb_receipts | Atomic idempotency key, TTL не меньше session+24h (default72h); мигрированные старые ключи минимум7days. Удаляются по expiry, также инкрементально на add. |
| wb_rates | HMAC scoped counter/window, expiry до120s. Global gate ограничивает новые IP/session buckets; expiry также инкрементальная при запросах. |

Состояния: reserved (до15min после crash), temporary (24h), cart (lease до48h с обновлением по действительной загрузке корзины), order (неограниченный hold), legacy (защищённая миграция), deleting (повтор unlink после ошибки). Заказ получает pin **до** сохранения line item и окончательную связь через WC CRUD hook после записи item. При ошибке создания заказа pin сохраняется для ручной проверки, не удаляется по возрасту. Все order statuses, включая completed, остаются защищёнными. WOODBASE_COMPLETED_RETENTION_DAYS настраивает дату рассмотрения хранения, не включает автоматическое уничтожение без согласованной политики.

Metadata не содержит raw IP, raw guest cookie или клиентской цены. AlbumConfiguration v1 и производственный JSON snapshot сохраняются. Старые snapshots заказов не переписываются. Для прежних заказов ссылки восстанавливаются по общим Woo order-item metadata, а каждый item читается через WC CRUD: поддерживается HPOS. Неустановленная связь legacy не считается основанием удаления; неизвестные старые данные требуют ручного inventory/reconciliation.

Миграция `wb_file_*` сначала сохраняет owner/date/size в защищённый asset, потом удаляет option. `wb_req_*` сохраняет atomic receipt на безопасный остаточный TTL; `wb_quota_*` старые slots удаляются, поскольку новая квота рассчитывается по действительным строкам. Новые requests не создают эти options. Остаются лишь постоянные version/cursor/complete flags и WordPress cron schedule. Миграция ограничена batch, повторно безопасна; malformed unknown legacy records не уничтожаются.

## Квоты, конкуренция и очистка

Default:10 временных файлов/50MiB на владельца, максимум20MiB финальный нормализованный PNG, total512MiB local/5GiB template и10000 assets. Order/legacy holds освобождают временную owner-quota, но продолжают занимать общий бюджет. Reservation создаётся атомарно под quota lock и пересчитывается в фактический размер только после успешного сохранения. Ошибка decode/save/oversize удаляет partial и reservation; при unlink failure запись остаётся для повторной очистки, чтобы место не исчезло из учёта. После crash сохраняется reservation с TTL15min; пока процесс жив/держит asset lock, очистка его не удаляет.

Физический рабочий запас учитывает до64MiB на каждый inflight encoder плюс64MiB свободного резерва: промежуточный PNG может быть больше допускаемого финального. Это дополняет logical byte quota, а не подменяет free-space monitoring.

Проверки: failed processor после записи partial освобождает quota; шесть PHP-процессов с лимитом2 допускают ровно2 успешные обработки; шесть настоящих параллельных HTTP PNG uploads успешны; rate limiter срабатывает отдельно от storage quota. Decoder failure не возвращает SQL/stack/path. PHP max upload теперь5M/post6M/memory256M; валидный JPEG между2 и5MiB действительно принимается — устранён конфликт с default PHP2MiB.

`cleanup` по WP-Cron каждые5min или системному cron/CLI:

- dry-run не удаляет и не меняет lifecycle/service строки; проверено сравнением counts до/после;
- глобальный cleanup lock не допускает второй процесс; per-asset locks общие для cleanup/cart/order/upload;
- используются MariaDB advisory locks и **256 фиксированных filesystem flock stripes** в private/.locks: они сохраняют защиту при потере DB-lock/reconnect, освобождаются ОС после завершения процесса и не растут на каждый файл;
- перед unlink повторно проверяются hold и активные refs под lock; order/pending refs защищены независимо от возраста/expiry;
- максимум1000 assets и10000 expired service rows на категорию/run; истёкшие orphan refs дочищаются пакетно без неограниченного DELETE на один asset;
- удаление повторяемое: после crash между unlink и metadata deletion следующий проход удалит только metadata; unlink failure оставляет deleting row/учёт;
- журнал — только aggregate counts/dry/busy/errors, без имён, IP, исходных PNG, SQL и токенов.

В реальном dev dry-run counts не изменились; реальный maintenance удалил истёкшие service counters, **не удалил защищённые order PNG**. Тесты удаления/прыжка времени выполняются в отдельных случайных DB tables и отдельном /tmp root; рабочие заказы не становятся жертвами искусственного test clock.

## Rate limiting и HTTP

IP определяется из REMOTE_ADDR. XFF игнорируется, если непосредственный peer не входит в явно доверенные CIDR; цепь читается справа до последнего недоверенного hop. Production edge передаёт проверенный адрес; defaults не доверяют всем private ranges/произвольным заголовкам. Проверены forged XFF и создание новых cookies: IP limit остаётся общим, возвращает429/Retry-After.

Default60sec: upload IP30/owner10, session IP60, catalog IP120, add IP120/owner30 (включая создание конфигурации), cart IP120, checkout IP30; global500/category ограничивает cardinality/поток. Все лимиты положительно настраиваются WOODBASE_RATE_LIMITS. Конструктор не отправляет API на каждое движение preview — ограничения касаются серверных действий. Production Nginx добавляет upload2r/s burst10; это не обещание полной DDoS-защиты.

Ошибки:400 invalid schema/content,403 session/ownership/origin,404 отсутствующий файл/товар,409 replay/conflict/unavailable state,413 size/normalized oversize,429 quota/rate+Retry-After,503 DB/storage/unavailable,500 неожиданный backend failure. 401 сохраняется для требующей логина аутентификации; guest upload не требует регистрации, но требует собственную сессию/nonce. Клиент переводит status в русское понятное сообщение и не выводит произвольный server error text. Timeout/non-JSON/network errors безопасно обрабатываются. PHP display_errors off, собственные DB errors подавлены для вывода и приводят к fail-closed503. Download дополнительно проверяет readable stream до headers и не следует symlink.

## RF/Timeweb конфигурация и backup

Подробный план — `docs/production-deployment-plan.md`: VM4vCPU/8GiB/100–120GiB ориентир, единый HTTPS-origin, статический Vite+PHP/MariaDB/Nginx, маршруты WP/Woo/callback, отдельные staging secrets/volumes, system cron, log rotation, backup/rollback. Это не заказ ресурсов и не DNS deployment.

Nginx/Compose schemas проверены. Локальный TLS probe с SAN/CA (без отключения верификации) подтвердил cookie Secure/HttpOnly/SameSite=Lax, no-store, Basic staging gate401/200 и отсутствие передачи Basic credentials как WP application password. Это **локальный** HTTPS woodbase.test; не публичный HTTPS acceptance. PHP/Nginx разные UID: найдено и исправлено чтение публичного Woo checkout JS (404 при umask0077 →200 при0755/0644). Приватные PNG остались0600/0700. Local setup скачивает официальный pinned WP-CLI при отсутствии и использует atomic temporary downloads.

Выполнена реальная backup/restore rehearsal: синтетический GPG key вне Git, encrypted+signed artifact, проверка подписи и decrypt, отдельная временная DB с временным grant, восстановление WP/private в отдельный root, WC snapshot/file SHA256, вход в восстановленную админку заказа23, PNG200 с ожидаемым hash и anonymous403. Источник не перезаписывался, временные DB/grants/files/key/proxy удалены, source checkout URL и доступность подтверждены. Этап не ограничен проверкой архива. Rehearsal запускала только локальный PHP maintenance; direct Docker HTTP сначала блокировался proxy, окончательная проверка выполнена через уникальный loopback localhost path без изменения исходных routes.

Независимый restore.py с новыми containers/volumes, внешний backup repository РФ и public HTTPS staging не выполнены. Clean-install preflight фиксирует около1,2GiB free Docker vfs против требуемых8GiB; **BLOCKED до создания volumes**. `docker system prune --volumes` не использовался, working volumes не удалялись. Logical restore на том же DB engine — не доказательство восстановления после полной потери сервера.

## Проверки

| Проверка | Статус |
|---|---|
| npm test /14 Node assertions | PASS |
| Vite demo и woocommerce build | PASS |
| PHP syntax3 plugin files, Python compile, Node --check, diff --check | PASS |
| Lifecycle/quota/cleanup/race/legacy/expired counters/DB-lock loss/proxy tests | PASS (отдельные tables/root) |
| 6 HTTP uploads, decoder failures,429+Retry-After, новые cookies/forged XFF | PASS |
| Server price tampering/replay, owner access, error API outage | PASS |
| Guest cart reload, classic checkout/HPOS, admin PNG/anonymous deny | PASS; новый source order23 |
| Actual Chromium close/reopen WC cookie/session | PASS |
| Different originals/same600px preview | PASS |
| Valid JPEG2–5MiB | PASS |
| Demo без API/localStorage persistence/mobile390px | PASS |
| CLI dry-run counts неизменны / actual bounded service cleanup | PASS |
| Nginx production/staging schema, local TLS/cookie/cache, Basic auth isolation | PASS |
| Encrypted+signed backup → isolated DB/files → restored admin download | PASS; order23 |
| Clean full stack | BLOCKED disk preflight, не PASS |
| Restore на независимый сервер/новый полный stack | Не выполнен, требуется дополнительный диск/сервер |
| Off-host encrypted RF backup storage | Не подключено |
| Public HTTPS staging полный guest flow | Не выполнен, нет согласованного домена/сервера |
| Ozon Pay / WooDev official modules | Не подтверждены, primary docs CONNECT403 |

Предыдущие browser/PHP проверки сохранены; ожидания статусов обновлены только там, где исправлена taxonomy (invalid400, ownership403, size413), replay остаётся409. Это не ослабление проверок. Новые quota/lifecycle tests первоначально обнаружили отсутствие механизма; полная test-first история всей интеграции не заявляется.

## Оставшиеся блокеры

**Критические до production:** публичный HTTPS staging и guest/session/callback matrix; актуальные поддерживаемые WP/WC/module versions; независимая disaster-recovery/off-host rehearsal; подтверждённые Ozon compatibility/sandbox и физические SKU/масса/габариты. Ни один из этих пунктов не разрешает сейчас реальную оплату/отправление.

**Нужны решения владельца:** сроки завершённых/неоплаченных заказов и backups, архивирование/удаление order/legacy/pending holds; до согласования они остаются защищёнными. Просроченные незавершённые order pins требуют ручного расследования. Unknown unregistered legacy files не уничтожаются directory-scan по возрасту.

**Эксплуатационные:** контроль успешного cron, места/инодов/БД, budget и lock/DB health, актуализация пакетов, secret management/GPG key rotation, проверка callback исключений staging Basic, нагрузочные тесты/NAT fairness. Нынешние defaults не заменяют edge anti-abuse и мониторинг.

## Изменённые файлы

- `integrations/woocommerce/plugin/{woodbase,hardening,state}.php`: APIs/lifecycle/schema/quotas/cleanup/rates/HPOS.
- `integrations/woocommerce/{compose.yaml,php-uploads.ini,setup.py,README.md}`: согласованные limits, публичные vendor permissions, WP-CLI и запуск.
- `integrations/woocommerce/ops/`: production/staging Compose/Nginx/access/auth/env templates, signed backup и isolated restore tools.
- `src/{commerce,commerce-ui,commerce-errors}.js`: только необходимые ошибки/init race, дизайн/анимации не переписаны.
- `tests/woocommerce-hardening*.php`, `tests/woocommerce-server.php`, `tests/commerce*.test.mjs`.
- `scripts/verify-*`: lifecycle/HTTP/reopen/large-upload/Nginx/backup+restore/regression utilities; clean-install preflight.
- `package.json`, `.gitignore`, README/docs.
- `docs/production-deployment-plan.md`, `docs/ozon-compatibility-review.md`, этот отчёт.

Все screenshot/proof/test profiles/vendor downloads — ignored work или временные каталоги вне Git. Secrets, dumps, GPG/TLS private keys, raw uploads и private volumes не включаются в commit. Ветка не публикуется без нового отдельного подтверждения.
