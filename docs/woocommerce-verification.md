# Проверка локального прототипа WoodBase

2026-11-05. База main 3777405, отдельная ветка feature/woocommerce-integration. Push, PR, merge и Vercel deploy не выполнялись.

## Выполнено

| Проверка | Фактический результат |
|---|---|
| Vite demo / woocommerce build | Обе сборки проходят |
| Node contracts + исходные тесты | 13 проверок проходят, включая 96 вариантов изображений, preview race handling, favorites, конфигурацию/ошибки/Cart-Token/fetch receiver |
| PHP 8.3 lint | Плагин без синтаксических ошибок |
| Python setup syntax | py_compile проходит |
| Каталог | Реальный local Woo endpoint: один тестовый товар, ID 10, название, описание, цена 3540 RUB, фото, availability и schema опций |
| Live UI → upload → Store API | Исходный PNG загружен приватно, позиция с надписью/параметрами создана |
| Корзина | Изменение количества, удаление, восстановление cookie-сессии после reload проходят |
| Подмена цены | Переданные 1 RUB в body/config не изменяют серверные 3540 RUB |
| Повторы | Обычный replay возвращает 409; конкурентные запросы с одним requestId дают 201 + 409, в корзине одна позиция quantity=1 |
| Серверная валидация | Отклонены неверные wood/extras, HTML-надпись, длина, placement/NaN/rotation, версия и productId |
| Файлы/доступ | SVG, файл >5 MiB, отсутствие nonce и чужой fileId отклонены; анонимный admin download 403; admin download 200 PNG |
| CSRF/CORS | Чужой Origin 403, upload без session nonce 403 |
| Live outage | HTTP 503 каталога приводит к заблокированному добавлению, без перехода в demo |
| Classic guest checkout | Создан локальный заказ №17 через штатную форму, ручной тестовый BACS без реального платежа; данные персонализации видны в подтверждении |
| HPOS и производство | HPOS включён; PHP-тест подтвердил гостя, snapshot/PNG и сохранность snapshot/суммы после изменения названия/цены товара; каталог восстановлен в finally |
| Администратор | Через реальный wp-login открыт HPOS-заказ, производственный снимок и авторизованное скачивание PNG; анонимный запрос запрещён |
| Demo без backend | Ни одного /wp-json запроса; старые cart/project localStorage сохраняются и восстанавливаются |
| Браузер | Chromium: основной live путь и demo на 1440 px и 390 px без pageerror; нет горизонтального overflow, intro skip работает |

`npm test` использует стандартный Node runner. Для развёрнутого отчёта отдельных сценариев запускался `node --test --test-isolation=none tests/*.test.mjs`. Новые исходные четыре сценария сначала упали из-за отсутствующего модуля; чистая behavioural red-фаза для них не наблюдалась. Browser end-to-end проверки выявили и помогли исправить fetch receiver, token SessionHandler и чтение PHP-плагинов. Новый receiver regression добавлен после исправления; не заявляется строгая test-first история всех изменений.

Диагностические снимки: work/verification/{cart-desktop,checkout-desktop,constructor-mobile,demo-desktop,demo-mobile,order-admin,blocks-entry}.png. Каталог work игнорируется Git; customer uploads, DB и credentials не входят в исходники. Веб-сервисы доступны только для локального тестирования, backend опубликован на loopback:8088.

## Blocks и Ozon — ограничения

Store API guest checkout endpoint с локальным BACS вернул 200 и создал отдельный тестовый заказ №19. Но отдельная страница Blocks показала пустую корзину, хотя API-корзина не пуста; полноценный Blocks UI flow НЕ пройден. Альтернативная страница не назначалась основным checkout. Требуется воспроизведение с корректным назначением страницы/контекстом и проверка cookie/cart state. Производственный выбор типа checkout остаётся открытым, classic — проверенный путь локального прототипа.

Официальные источники docs.ozon.ru и woodev.ru возвращают CONNECT 403 сетевого фильтра. Плагины Ozon не установлены, версии/HPOS/Blocks/webhooks/рефанды/фискализация/ПВЗ не подтверждены. План действий — docs/ozon-integration-plan.md. Реальных платежей, отправлений и обращений к коммерческим аккаунтам нет.

## Что ещё не доказано

Полная визуальная идентичность всех анимаций/экранов/браузеров не подтверждается двумя viewport и отсутствием JS exceptions. CSS, GSAP intro/hero, утверждённые изображения и анимационные модули не переписывались. Клавиатурный/скринридерный аудит всех существующих экранов не выполнялся.

Не выполнены production HTTPS/domain/cookie tests, нагрузочные проверки, глобальный upload rate limiting по IP, резервирование и автоматическая retention/очистка orphan files/receipts/quota options. Квота привязана к гостевой сессии и сама по себе не защищает от создания новых сессий. Клиентский SVG не принимается; MIME/dimensions/content проверяет сервер, но отдельный антивирусный движок не подключён.

Схема опций в плагине, админ-редактор схемы не реализован. Цены дополнительных box/metric неизвестны — они блокируются в live. Цена/комплект/габариты seed не утверждены. Seed virtual, физическая доставка требует настройки. Старый импортированный JSON хранит preview, поэтому live требует повторной загрузки оригинала рисунка. Оформление заказов в production не готово.

## Изменённые и добавленные файлы

- `.gitignore`, `.env.example`, `package.json`, `package-lock.json`, `README.md`, `vite.config.js`.
- `src/main.js` (ограниченные точки подключения), `src/commerce.js`, `src/commerce-ui.js`.
- `integrations/woocommerce/compose.yaml`, `nginx.conf`, `setup.py`, `bootstrap.php`, `plugin/woodbase.php`, `README.md`.
- `tests/commerce.test.mjs`, `tests/woocommerce-server.php`.
- `scripts/verify-commerce.mjs`, `verify-commerce-security.mjs`, `verify-order-admin.mjs`, `verify-demo.mjs`, `verify-blocks.mjs`.
- `docs/woocommerce-audit.md`, `docs/woocommerce-verification.md`, `docs/ozon-integration-plan.md`.

## Следующий релиз

Подтвердить коммерческие товарные данные и схемы надбавок; выбрать поддерживаемые WP/WC и проверить upgrade. Довести production хранение/rate limits/backup/retention. Проверить одну согласованную схему доменов без изменения действующего Vercel до отдельного запуска. Получить официальную документацию и тестовые доступы Ozon, заполнить матрицу classic/Blocks/HPOS, проверить sandbox оплаты/возвраты/чеки и ПВЗ/тарифы/статусы. Затем разрешать коммерческий checkout; остальные пять альбомов переносить только после приёмки одного SKU.

## Повторный контроль

Актуальные результаты повторной проверки, новые найденные и исправленные дефекты, состояние Git и готовность публикации зафиксированы в `docs/woocommerce-control-review.md`. В частности, предыдущий успех не гарантировал готовность после включения Woo Coming Soon: локальный bootstrap теперь явно отключает эту заглушку. Новый полный гостевой UI-сценарий после исправления создал заказ №21. Также исправлены повторное использование старого оригинала при одинаковом preview и принятие JSON-объекта вместо массива дополнений. Проверка чистой установки заблокирована диском Docker, а не объявляется пройденной.
