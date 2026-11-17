# Общая ветка сайта и WooCommerce

Ветка `deploy/woodbase-woocommerce` содержит актуальную витрину и WooCommerce.
`main` не изменяется. Для обновления сайта отправляйте изменения в общую ветку,
а не только в main/Vercel. Vercel может собирать preview этой ветки; production
Vercel по-прежнему привязан к main.

VPS каждые две минуты читает эту ветку из публичного GitHub-репозитория.
GitHub Actions, токены GitHub и приватный SSH-ключ в GitHub не требуются.
Контроллер установлен отдельно от репозитория: `/usr/local/sbin/woodbase-autodeploy.py`.
Конфигурация root: `/etc/woodbase-autodeploy.json`, состояние и последние три
резервные копии витрины: `/srv/woodbase/autodeploy/`.

Новый SHA собирается в отдельном непривилегированном Docker-контейнере с
закреплённым digest Node. Сначала `npm ci --ignore-scripts`, затем `npm test`
и `npm run build` с `VITE_COMMERCE_MODE=woocommerce`. Ни socket Docker, ни
секреты, ни данные магазина не монтируются в builder. Публикуется только dist:
сначала ресурсы, затем атомарно index.html. Старые hashed assets сохраняются
для открытых вкладок. После публикации проверяются HTTPS, шесть товаров,
корзина и защита wp-admin; при ошибке возвращается предыдущая витрина.

Любое изменение дерева `integrations/woocommerce` блокирует автоматическую
публикацию до ручной проверки. Контроллер не обновляет backend, контейнеры,
Nginx, БД или Docker volumes и не выполняет миграции. После согласованного
ручного обновления backend администратор фиксирует новый backend_tree в конфиге.
Сам контроллер из GitHub автоматически не обновляется.

Диагностика: `systemctl status woodbase-autodeploy.timer` и
`journalctl -u woodbase-autodeploy.service -n 100 --no-pager`.
Ручная проверка нового коммита: `systemctl start woodbase-autodeploy.service`.
Остановка обновлений: `systemctl disable --now woodbase-autodeploy.timer`
(не останавливает магазин). Товары, заказы, пользователи и загруженные рисунки
хранятся в прежних volumes WordPress/MariaDB/private, а не в Git.

## Проверка установки

17 ноября 2026 первая сборка из общей ветки успешно опубликована на VPS.
Проверены 29 Node-тестов, пять тестов отказов контроллера и браузерная корзина
для всех шести альбомов. Автозапуск выполняется systemd-таймером после push
в deploy/woodbase-woocommerce; ноутбук и Vercel для этого не требуются.

