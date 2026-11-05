# Локальный WordPress + WooCommerce WoodBase

Только тестовая среда. Main/Vercel/production не меняются. Один SKU «Счастливые моменты», цена 3540 RUB — неподтверждённые тестовые данные, virtual для изоляции доставки. WP 6.8.3 FPM Alpine, WC 10.3.5 (официальный GitHub release), MariaDB 11.4, Nginx 1.28 Alpine. Это воспроизводимый эксперимент, не рекомендация старых версий для production.

## Запуск

Нужны Docker Compose v2, Python 3, curl, Node 24+, свободное место Docker (VFS может требовать несколько GB). Из корня проекта:

```sh
python3 integrations/woocommerce/setup.py
npm ci
cp .env.example .env.local
```

В `.env.local` установить `VITE_COMMERCE_MODE=woocommerce`, оставить `VITE_WOOCOMMERCE_ORIGIN=` пустым, затем:

```sh
npm run dev
```

Открыть http://localhost:5173 . Выбрать модель «Счастливые моменты», разрешённые материалы, текст и при необходимости исходный PNG/JPEG/WebP. box/metric пока убрать: их цена неизвестна. Нажать добавление, открыть прежней фирменной кнопкой серверную корзину, изменить количество/удалить, перейти к стандартному checkout http://localhost:8088/checkout/ . Любой платёж в тестовой форме — только «Тестовый заказ — не оплачивать»: деньги не переводить. Клиент может оформить заказ без аккаунта.

`setup.py` генерирует `.env` с DB_PASSWORD, DB_ROOT_PASSWORD, WP_ADMIN_PASSWORD и mode 0600; файл игнорируется Git. Пароли не печатаются. Скрипт проверяет версию дистрибутива, распаковывает официальный Woo, инициализирует WordPress/таблицы/страницы/товар и плагин, делает источники плагинов читаемыми PHP-FPM. Повторный запуск не дублирует тестовый товар и не сбрасывает его изменённую администратором цену. Содержимое setup.py/bootstrap.php доступно для ревью; не запускать против внешнего WP.

Администратор: http://localhost:8088/wp-admin/ , логин `woodbase-admin`; пароль смотрите в локальном `integrations/woocommerce/.env` (WP_ADMIN_PASSWORD). WooCommerce → Orders → заказ: параметры и «WoodBase: производственный снимок», ссылка «Скачать макет PNG». Только manage_woocommerce + проверенный nonce дают доступ к файлу, анонимный запрос получает 403.

При отсутствии backend используйте `VITE_COMMERCE_MODE=demo` или удалите `.env.local`, перезапустите Vite. Сохраняются прежние localStorage-корзина/проекты, подпись явно говорит «черновик, заказ не оформляется». Live при ошибке backend блокируется; автоматической подмены demo нет. Старые черновики не мигрируют в серверную корзину. Для отдельного demo на 5174: `VITE_COMMERCE_MODE=demo npm run dev -- --port 5174`.

## Переменные и хранение

| Переменная | Назначение |
|---|---|
| VITE_COMMERCE_MODE | demo (по умолчанию) или woocommerce; публичная, после смены нужен restart/build |
| VITE_WOOCOMMERCE_ORIGIN | пусто для same-origin Vite proxy; только публичный origin, никаких credentials |
| DB_PASSWORD / DB_ROOT_PASSWORD | генерируются локально, только backend/Compose |
| WP_ADMIN_PASSWORD | локальный пароль администратора, используется setup, не frontend |
| WOODBASE_PRIVATE_DIR | PHP constant /var/woodbase-private, вне webroot |
| WOODBASE_FRONTEND_ORIGIN | allowlist http://localhost:5173 для локального API, production требует настройки |
| CHROMIUM_PATH | только тесты; путь к установленному Chromium |
| WB_TEST_ORIGIN | только сквозной тест, разрешён localhost; по умолчанию 5173 |

Данные MariaDB, WordPress/uploads и private — Docker named volumes, не Git. Клиентские рисунки не WP media: приватные PNG после декодирования/пересохранения, до 5 MiB и 4096 px/16M pixels; 10 попыток обработки на сессию. Рисунок из восстановленного старого проекта нужно заново загрузить оригиналом; JSON хранит только прежнее preview. Штатные WP mail/обновления/внешние HTTP заблокированы в локальной среде. Никакие Woo REST API secrets в JS не нужны.

Политика production retention/backup и очистка служебных receipts, квот и непривязанных файлов пока не реализованы. В прототипе файлы сохраняются для мастера, даже если каталог меняется. Не удалять private volume, если нужны тестовые заказы.

Остановка без удаления данных:

```sh
docker compose -f integrations/woocommerce/compose.yaml --env-file integrations/woocommerce/.env stop
```

Не выполнять `down -v`, если требуется сохранить данные. Никаких файлов БД и uploads в Git не добавлять.

## Проверка

Тесты создают только локальные гостевые тестовые заказы, BACS не вызывает внешние API. Для браузерных тестов установите Chromium и задайте CHROMIUM_PATH при необходимости (по умолчанию /usr/bin/chromium). Playwright-core входит в devDependencies, браузер сам не скачивает.

```sh
npm test
npm run build
VITE_COMMERCE_MODE=woocommerce npm run build
# Нужен Vite live на 5173 и локальный WP:
npm run test:commerce
node scripts/verify-commerce-security.mjs
node scripts/verify-order-admin.mjs
# Дополнительно нужен Vite demo на 5174:
node scripts/verify-demo.mjs
# Диагностика Blocks, НЕ приёмка Blocks UI:
node scripts/verify-blocks.mjs
```

Для серверных тестов после browser guest-order test:

```sh
docker --host=unix:///var/run/docker.sock cp tests/woocommerce-server.php woodbase-local-wordpress-1:/tmp/woodbase-server-test.php
docker --host=unix:///var/run/docker.sock compose -f integrations/woocommerce/compose.yaml --env-file integrations/woocommerce/.env exec -T wordpress php /tmp/woodbase-server-test.php
```

Проверяются валидация/неизвестные значения/цена, HPOS, параметры заказа, приватный файл, сохранность снимка и суммы при последующем изменении товара (каталог временно меняется и восстанавливается в finally). Скриншоты и диагностические результаты — `work/verification/`, игнорируются Git. `verify-order-admin` читает только сгенерированный локальный пароль; не передавать ему production окружение.

## Дальнейший выпуск

Нужны подтверждённые товары/комплектации/масса, поддерживаемые и проверенные версии WP/WC, production storage/rate limits/retention/backups, HTTPS/reverse proxy/cookie/cache tests, официальная матрица Ozon, sandbox webhooks/refunds/fiscalization и ПВЗ/тарифы/статусы. Checkout Blocks ещё не допущен к frontend handoff. Не подключать коммерческие credentials в этот прототип.

## Контрольные исправления и дополнительные проверки

Bootstrap явно отключает **локальный** Coming Soon WooCommerce: иначе API-корзина работает, но гостю вместо checkout показывается заглушка. Bootstrap отказывается работать при WP_ENVIRONMENT_TYPE, отличном от local. Файл макета привязывается к исходному File: одинаковое уменьшенное preview не означает одинаковый производственный оригинал.

```sh
node scripts/verify-artwork-replacement.mjs
# Необязательная проверка первого запуска на одноразовых volumes, требуется дополнительное место Docker:
python3 scripts/verify-fresh-woocommerce.py
```

Первый тест подтверждает отдельное сохранение оригиналов 600/1200 px с одинаковым preview. Второй использует только новый проект `woodbase-review-fresh`, отказывается переиспользовать существующие контейнеры/volumes с таким именем и удаляет только созданные им ресурсы. Рабочий проект `woodbase-local` и его заказы остаются на месте. При сбое диагностика без значений локальных паролей сохраняется в `work/fresh-install-diagnostic.log`. В контрольном запуске новая MariaDB не смогла создать системную БД из-за нехватки места Docker; этот тест **не пройден**, повторить после увеличения места. Ошибку не следует устранять удалением рабочего private/db volume.

Отчёт текущего контроля: `docs/woocommerce-control-review.md` (путь от корня репозитория). Production-план очистки не реализован: PHP удаляет multipart temp-файл после запроса, а приватные PNG, в том числе непривязанные к заказу, сохраняются без автоматического TTL. До реальных клиентов согласовать retention, ссылки на заказы/корзины, безопасную очистку, резервирование и общий rate limiting.
