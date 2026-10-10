import './style.css';
import './brand.css';

// Prices remain unset until the workshop supplies its actual price list.
const models = [
  { name: 'Семья', subtitle: 'Где начинается жизнь и не заканчивается любовь', inscription: 'Семья', color: 2, binding: 'woven' },
  { name: 'Однажды мы загадали тебя', subtitle: 'Для первых дней и больших маленьких открытий', inscription: 'Однажды мы загадали тебя…', color: 0, binding: 'bolts' },
  { name: 'Начало твоей истории', subtitle: 'Ладошки, которые хочется помнить маленькими', inscription: 'Начало твоей истории', color: 1, binding: 'woven' },
  { name: 'История нашей семьи', subtitle: 'Семейное дерево и воспоминания поколений', inscription: 'История нашей семьи', color: 1, binding: 'bolts' },
  { name: 'Счастье внутри', subtitle: 'Для всех ваших счастливых мгновений', inscription: 'Счастье внутри', color: 0, binding: 'bolts' },
  { name: 'Счастливые моменты', subtitle: 'Семейные корни и истории, которые остаются', inscription: 'Счастливые моменты', color: 0, binding: 'bolts' },
].map(m => ({ ...m, price: null, size: '33 × 22 см', photos: [] }));
const colors = [{ name: 'Натуральный', value: '#c59b67' }, { name: 'Коричневый', value: '#91603d' }, { name: 'Чёрный', value: '#292929' }];
const bindings = [{ id: 'bolts', name: 'Дизайнерские болты', price: null }, { id: 'woven', name: 'Ручное плетение', price: null }];
const motifs = models.map(m => m.name);
const extras = [{ id: 'box', name: 'Подарочная упаковка', price: null }, { id: 'metric', name: 'Держатель для метрики', price: null }, { id: 'corners', name: 'Уголки для фотографий', price: null }, { id: 'markers', name: 'Золотой и серебряный маркеры', price: null }, { id: 'stickers', name: 'Декоративные наклейки', price: null }];
let state = { model: 0, color: 2, motif: 0, binding: 'woven', inscription: 'Семья', image: null, extras: [], page: 0, imageScale: 1, imageX: 0, imageY: 0, imageRotation: 0, threshold: 140, imageMode: 'engrave' };
let cart;
try { cart = JSON.parse(localStorage.getItem('sloy-cart') || '[]'); if (!Array.isArray(cart)) cart = []; } catch { cart = []; }
const money = n => Number.isFinite(n) ? new Intl.NumberFormat('ru-RU').format(n) + ' ₽' : 'По запросу';
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const total = () => { const parts = [models[state.model].price, bindings.find(b => b.id === state.binding).price, ...extras.filter(e => state.extras.includes(e.id)).map(e => e.price)]; return parts.every(Number.isFinite) ? parts.reduce((sum, price) => sum + price, 0) : null; };
cart = cart.filter(item => item && typeof item === 'object' && Array.isArray(item.extras)).map(item => ({ ...item, price: null }));
const workshopTelegram = ''; // Set the public workshop username when supplied; never a bot token.
const cartTotal = () => cart.every(i => Number.isFinite(i.price)) ? cart.reduce((sum, i) => sum + i.price, 0) : null;
const leaf = `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M8 25C3 6 21 5 26 4c-1 15-6 23-18 21ZM8 25 22 9M13 19l-1-7m5 2 7-1"/></svg>`;
function engraving(i) {
 const drawings = [
  '<path d="M50 75V39m0 21-13-14m13 7 15-15M50 76l-14 12m14-12 14 12m-14-12-2 14m2-14 5 13M27 72h47"/><path d="M34 53C10 49 15 26 29 25c-1-16 23-22 28-8 16-9 32 10 22 22 11 15-10 28-23 18M28 26l13 9m17-17-5 17m20-3-12 9"/><circle cx="50" cy="48" r="39" stroke-width=".5"/>',
  '<path d="M50 76 22 48C4 29 30 9 50 30 70 9 96 29 78 48Z"/><path d="M34 39c-7-10-16 0-8 8m38-8c7-10 16 0 8 8M34 75q16 11 32 0M27 83l-8-8m54 8 8-8"/>',
  '<path d="M50 82V48m0 20-16-9m16 16 17-12"/><path d="M50 48C20 58 14 35 36 32c-10-24 15-28 19-10 19-17 36 3 18 16 19 12 2 31-23 10Z"/><circle cx="50" cy="38" r="8"/><path d="M21 85q29 12 58 0"/>',
  '<path d="m9 73 28-44 17 28 13-18 25 34H9Zm18-28 10 7 9-8m15 5 6 6 5-8M14 82h72"/><circle cx="70" cy="23" r="9"/><path d="m17 23 6-4 6 4m-7-7 6-4 6 4"/>'
 ];
 return `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[i % drawings.length]}</svg>`;
}
function coverDrawing(index) {
 if (index === 0) return '<div class="family-symbol">Семья<small>где начинается жизнь<br>и не заканчивается любовь</small></div>';
 if (index === 1) return '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M17 63q25-8 57-3 19 2 8 9-25 13-53 4L9 70m20-10q-4-18 12-25 24-9 36 14L66 59M44 36q-16-19-27-8-8 12 7 22m0-11 3 2m9-7q-5 2-6 6m12-13q-5 7 1 8M48 47q10 7 16-3"/></svg>';
 if (index === 2) return '<svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path d="M18 46 9 32q-3-6 1-8 4-2 7 4l6 10-3-21q0-7 5-6 4 0 5 6l3 19 1-23q1-6 5-5 5 1 3 7l-1 23 7-20q2-5 6-3 4 2 1 8l-8 23 9-7q5-3 7 1 2 3-4 7L45 64q-10 8-21-3Z"/><path d="m66 72-7-13q-3-5 1-7 3-2 5 3l5 8-2-16q0-5 3-5 4 0 4 5l2 15 2-18q0-5 4-4 3 0 2 5l-1 17 6-15q2-4 5-2 3 2 1 6l-6 17 6-5q4-2 5 1 2 2-3 5L88 83q-8 6-16-2Z"/></svg>';
 if (index === 4) return engraving(1);
 return engraving(0);
}
function spine(binding) { return `<div class="outer-spine ${binding}">${Array.from({length:binding === 'woven' ? 12 : 5}, () => '<i></i>').join('')}</div>`; }
const album = (i, cls = '') => `<div class="album ${cls} ${models[i].color === 2 ? 'dark-cover' : ''}" style="--wood:${colors[models[i].color].value}">${spine(models[i].binding)}<div class="cover-art">${coverDrawing(i)}</div><span>${escape(models[i].inscription)}</span><div class="closure"></div></div>`;

document.querySelector('#app').innerHTML = `
<header><a class="logo" href="#" aria-label="WoodBase — главная"><img class="brand-logo" src="/images/brand/logo.png" alt="WoodBase — логотип с дятлом" width="180" height="88"></a><nav aria-label="Основная навигация"><a href="#catalog">Коллекция</a><a href="#constructor">Создать свой альбом</a><a href="#about">Наша мастерская</a></nav><button class="cart-button" id="open-cart">Корзина <span id="cart-count">${cart.length}</span></button></header>
<main>
<section class="hero"><img class="hero-photo" src="/images/hero.png" alt="Деревянный семейный альбом на столе у окна с видом на лес" fetchpriority="high"><div class="hero-shade"></div><div class="hero-copy"><div class="eyebrow"><span></span> ПРИРОДА ДАЁТ ФОРМУ. ВЫ НАПОЛНЯЕТЕ ЕЁ ЖИЗНЬЮ.</div><h1>Ваша семья.<br>Ваша история.<br><em>В дереве.</em></h1><p>Альбомы из дерева для первых шагов, семейных праздников и воспоминаний, которые передают детям.</p><div class="hero-actions"><a class="button" href="#constructor">Создать семейный альбом <span>→</span></a><a class="text-link" href="#catalog">Найти свою историю ↓</a></div><div class="hero-note"><span>${engraving(0)}</span> Из натурального дерева.<br>Для самого дорогого.</div></div><div class="hero-caption"><span>WOODBASE / ВЕЩИ, КОТОРЫЕ ОСТАЮТСЯ</span><p>У дерева — свои кольца.<br>У семьи — свои истории.</p></div><a class="scroll-hint" href="#memories">ПОЧУВСТВОВАТЬ ↓</a></section>
<div class="values"><span>${leaf} Живая фактура дерева</span><i>·</i><span>Ваши слова на обложке</span><i>·</i><span>Точная гравировка</span><i>·</i><span>Ручная сборка с заботой</span></div>
<section id="memories" class="memories section"><div class="memory-photos"><figure class="memory-main"><img src="/images/family.png" alt="Семья идёт за руки по лугу в тёплом вечернем свете" loading="lazy"><figcaption>Наше маленькое большое счастье.</figcaption></figure><div class="memory-stamp">не просто фото.<br><em>целая жизнь.</em></div><span class="memory-date">ЛЕТО, КОТОРОЕ ВСЕГДА С НАМИ</span></div><div class="memory-copy"><div class="eyebrow">БЛИЖЕ, ЧЕМ КАЖЕТСЯ</div><h2>Есть моменты,<br>которые хочется<br><em>подержать в руках.</em></h2><p>Телефон хранит тысячи фотографий. А альбом — те самые. Где папа ещё молодой, где вы смеётесь до слёз, где маленькая рука впервые держит вашу.</p><p>Открыть его вместе. Узнать себя в детях. Услышать: «Расскажи ещё». Из таких мгновений и складывается семья.</p><div class="handwritten">Пусть у вашего счастья будет дом.</div><a class="text-link" href="#catalog">Выбрать альбом для своей семьи →</a></div></section>
<section id="catalog" class="section"><div class="section-heading"><div><div class="eyebrow">01 / НАША КОЛЛЕКЦИЯ ОБЛОЖЕК</div><h2>Для того, что<br><em>никогда не повторится.</em></h2></div><p>Первое свидание. Первые шаги. Вся семья за столом.<br>Выберите альбом для своего самого важного.</p></div><div class="catalog">${models.map((m, i) => `<button class="product" data-model="${i}"><div class="product-image tone-${i}"><span class="product-number">0${i+1}</span>${m.photos.length ? `<img class="real-product-photo" src="${m.photos[0]}" alt="${escape(m.name)}" loading="lazy">` : album(i)}<span class="product-arrow">Сделать своим →</span></div><div class="product-info"><h3>${m.name}</h3><span>${money(m.price)}</span></div><p>${m.subtitle}</p><small>${m.size} · ${m.binding === 'woven' ? 'Ручное плетение' : 'Дизайнерские болты'}</small></button>`).join('')}</div><p class="demo-note">Все альбомы: 33 × 22 см, корешок 3 см. Дизайн, цвет и переплёт можно сочетать свободно. Цены и комплектацию уточняем в мастерской.</p></section>
<section class="nature-story"><div class="nature-shade"></div><div class="nature-copy"><div class="eyebrow">СОЗДАНО ПРИРОДОЙ. ПРОДОЛЖЕНО ВАМИ.</div><h2>Дерево помнит годы.<br><em>Пусть оно запомнит ваши.</em></h2><p>Неповторимый рисунок волокон. Тепло под пальцами.<br>Обложка, которая становится частью семейной истории.</p><span class="nature-mark">${engraving(0)}</span></div></section>
<section id="constructor" class="constructor section"><div class="section-heading"><div><div class="eyebrow">02 / ВАША СЕМЬЯ. ВАШ АЛЬБОМ.</div><h2>Ваш альбом.<br><em>Собранный по-вашему.</em></h2></div><p>Любимый рисунок, семейная фамилия, особая дата.<br>Добавьте то, что делает этот альбом вашим.</p></div><div class="builder"><div class="preview"><div class="preview-top"><span>СОЗДАЁТСЯ ВАША ИСТОРИЯ</span><span id="preview-size"></span></div><div id="live-album"></div><div class="page-controls"><button id="prev-page" aria-label="Предыдущая страница">←</button><span id="page-label"></span><button id="next-page" aria-label="Следующая страница">→</button></div><p>Загляните внутрь — там место для счастья</p><small>Эскиз по конструкции ваших альбомов. Точная гравировка и оттенок согласуются; изображения обложек пока иллюстративные.</small></div><div class="options"><label for="model">01 <strong>Дизайн обложки</strong></label><select id="model">${models.map((m, i) => `<option value="${i}">${m.name} · ${m.size}</option>`).join('')}</select><label for="binding" class="small-label">Переплёт — независимо от дизайна</label><select id="binding">${bindings.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select><p class="control-hint">Внутри обоих вариантов — кольцевой механизм. Различается оформление корешка.</p><div class="option-label">02 <strong>Оттенок дерева</strong> <span id="color-name"></span></div><div class="swatches">${colors.map((c, i) => `<button data-color="${i}" aria-label="${c.name}" style="background:${c.value}"></button>`).join('')}</div><div class="option-label">03 <strong>Символ вашей семьи</strong></div><div class="motifs">${motifs.map((m, i) => `<button data-motif="${i}" aria-label="Рисунок ${models[i].name}">${coverDrawing(i)}</button>`).join('')}</div><label class="upload" for="upload">↑ Загрузить свой рисунок <span>PNG, JPG, WebP · до 5 МБ</span></label><input type="file" id="upload" accept="image/png,image/jpeg,image/webp" hidden><div id="upload-status" role="status"></div><details class="art-tools"><summary>Настроить рисунок и гравировку</summary><label>Размер рисунка <input id="image-scale" type="range" min="0.5" max="1.5" step="0.05" value="1"></label><label>По горизонтали <input id="image-x" type="range" min="-20" max="20" value="0"></label><label>По вертикали <input id="image-y" type="range" min="-20" max="20" value="0"></label><label>Поворот <input id="image-rotation" type="range" min="-45" max="45" value="0"></label><label for="image-mode">Обработка загруженного рисунка</label><select id="image-mode"><option value="engrave">Чёрно-белый эскиз гравировки</option><option value="original">Исходное изображение</option></select><label>Порог чёрного <input id="image-threshold" type="range" min="40" max="220" value="140"></label><p class="control-hint">Мелкие детали и полутона могут потеряться. Изображение на экране — эскиз, окончательный макет согласуем.</p><button class="text-link" id="reset-art">Сбросить положение рисунка</button></details><button id="remove-image" class="text-link" hidden>Убрать загруженный рисунок</button><label for="inscription" class="small-label">Слова, которые останутся</label><input id="inscription" maxlength="45" value="Наша история" placeholder="Семья Ивановых · Счастье быть вместе"><div class="option-label">04 <strong>Забота в деталях</strong></div>${extras.map(e => `<label class="extra"><input type="checkbox" value="${e.id}"><span>${e.name}</span><span>Уточним стоимость</span></label>`).join('')}<div id="price-breakdown" class="price-breakdown"></div><div class="price-row"><span>Стоимость после согласования</span><strong id="price"></strong></div><button id="add-cart" class="button">Сохранить нашу историю <span>→</span></button><div id="cart-status" role="status"></div><div id="mascot-success" class="mascot-success" hidden><img class="mascot" src="/images/brand/mascot-joy.png" alt="" loading="lazy"><p>Отличное начало вашей истории!<small>Альбом добавлен. Откройте корзину, чтобы подготовить запрос.</small></p></div><div class="project-actions"><button id="save-project" class="text-link">Сохранить проект</button><button id="load-project" class="text-link">Восстановить</button><button id="download-project" class="text-link">Скачать проект</button><label for="import-project" class="text-link">Открыть файл проекта</label><input id="import-project" type="file" accept="application/json,.json" hidden></div><div id="project-status" role="status"></div></div></div></section>
<section id="about" class="about section"><div class="workshop-art"><img src="/images/hero.png" alt="Концепция деревянного альбома с гравировкой и семейными фотографиями" loading="lazy"><div class="workshop-tag">WOODBASE<small>ДЕРЕВО · ТОЧНОСТЬ · ЗАБОТА</small></div></div><div><div class="eyebrow">03 / ЗА КАЖДОЙ ВЕЩЬЮ — ЧЕЛОВЕК</div><h2>Сделано руками.<br><em>Чтобы трогало сердце.</em></h2><p>В WoodBase дерево становится хранителем ваших воспоминаний. Лазер точно переносит рисунок на обложку, а мы собираем детали в вещь, которая будет жить рядом с вами.</p><p>Фамилия, написанная вашей рукой. Рисунок ребёнка. Место, где вы встретились. Нам нравится, когда за дизайном есть история.</p><div class="workshop-host"><img class="mascot" src="/images/brand/mascot-greeting.png" alt="Дятел — помощник мастерской WoodBase" loading="lazy"><p>Привет! Здесь начинается<br><strong>ваша семейная история.</strong><small>От рисунка до последней детали — соберём альбом вместе.</small></p></div><div class="craft-details"><div><span>01</span>Вы выбираете<br>важное для вас</div><div><span>02</span>Мы готовим<br>личный дизайн</div><div><span>03</span>Ваша история<br>обретает форму</div></div><a class="text-link" href="#constructor">Добавить в альбом частичку себя →</a></div></section>
<section class="craft-gallery section"><div class="section-heading"><div><div class="eyebrow">04 / КРАСОТА В ДЕТАЛЯХ</div><h2>Почувствовать дерево.<br><em>Рассмотреть мастерство.</em></h2></div><p>Живая фактура, личный рисунок и продуманный переплёт.<br>Особенная вещь начинается с деталей.</p></div><div class="craft-grid"><article class="craft-feature"><div class="craft-photo"><img src="/images/in-hands.png" alt="Визуализация альбома в руках: деревянный разворот и четыре кольца" loading="lazy"></div><div class="craft-caption"><span>01 / ВАШ ФОРМАТ</span><h3>История, которую держат в руках</h3><p>Обложка 33 × 22 см. Корешок 3 см. Внутри — кольцевой механизм.</p></div></article><article><div class="craft-photo macro-wood"><img src="/images/hero.png" alt="Визуализация фактуры дерева и гравировки семейного дерева" loading="lazy"></div><div class="craft-caption"><span>02 / ЖИВОЕ ДЕРЕВО</span><h3>У каждого альбома свой рисунок</h3><p>Тёплая поверхность и неповторимые волокна. Ваше изображение или надпись становятся частью обложки.</p></div></article><article><div class="craft-photo binding-detail">${spine('woven')}${spine('bolts')}</div><div class="craft-caption"><span>03 / ДВА ПЕРЕПЛЁТА</span><h3>Плетение или дизайнерские болты</h3><p>Выбирайте оформление корешка независимо от цвета и рисунка обложки.</p></div></article></div><p class="demo-note">Кадры — визуализации по вашим примерам, переплёты — эскизы. Оригинальные фотографии изделий добавим после получения исходных файлов.</p></section>
<section class="order-guide section"><div class="eyebrow">ОТ ВАШЕЙ ИДЕИ ДО СЕМЕЙНОГО АЛЬБОМА</div><h2>Как появится <em>ваша история.</em></h2><div class="order-steps"><article><span>01</span><h3>Соберите альбом</h3><p>Выберите обложку, цвет, переплёт и дополнения. Сохраните проект, чтобы обсудить его с близкими.</p></article><article><span>02</span><h3>Согласуйте детали</h3><p>Мастерская подтверждает комплектацию, цену и макет гравировки до изготовления.</p></article><article><span>03</span><h3>Получите свою историю</h3><p>Срок изготовления, оплату и доставку согласуем отдельно. Онлайн-оплата пока не подключена.</p></article></div><details><summary>Что входит в комплект?</summary><p>Размер обложки 33 × 22 см, корешок 3 см, внутри кольцевой механизм. Количество и цвет листов, упаковка и аксессуары уточняются для заказа.</p></details><details><summary>Можно использовать свой рисунок?</summary><p>Да. Загрузите его в конструктор и настройте положение. До изготовления нужен согласованный макет: не все мелкие элементы подходят для лазерной гравировки.</p></details><details><summary>Как оформить индивидуальный заказ?</summary><p>Соберите корзину и скачайте запрос с контактами и пожеланиями. Откройте текст запроса в Telegram, выберите получателя и подтвердите отправку. Проект с загруженным рисунком приложите отдельным файлом. Пока адрес мастерской не указан, Telegram предложит выбрать чат.</p></details></section><section class="closing"><div class="eyebrow">ДЛЯ СЕБЯ. ДЛЯ БЛИЗКИХ. НА ГОДЫ.</div><h2>Когда-нибудь этот альбом<br>будут листать <em>ваши внуки.</em></h2><p>Начните его историю сегодня.</p><a href="#constructor" class="button">Создать свой семейный альбом →</a></section></main>
<footer><a class="logo" href="#" aria-label="WoodBase — главная"><img class="brand-logo" src="/images/brand/logo.png" alt="WoodBase — логотип с дятлом" width="180" height="88"></a><p>Сохраняем тепло.<br>Передаём дальше.</p><small>WoodBase · лазерная мастерская</small></footer>
<dialog id="product-detail"></dialog><dialog id="cart"><div class="cart-heading"><h2>Ваша корзина</h2><button id="close-cart" aria-label="Закрыть корзину">×</button></div><div id="cart-items"></div><p class="checkout-note">Заявка требует согласования цены и макета. Сайт не отправляет данные автоматически и не принимает оплату. Для передачи запроса используйте Telegram; файл с рисунком нужно приложить отдельно. Ozon пока не подключён.</p><form id="request-form"><label class="small-label" for="customer-name">Ваше имя</label><input id="customer-name" name="name" maxlength="80" autocomplete="name"><label class="small-label" for="customer-contact">Телефон или email для связи</label><input id="customer-contact" name="contact" maxlength="120" autocomplete="email"><label class="small-label" for="customer-comment">Пожелания к заказу</label><textarea id="customer-comment" name="comment" maxlength="1500" rows="3"></textarea><p class="control-hint">Контакты включаются только в скачиваемый файл и не сохраняются в корзине.</p></form><div class="telegram-request"><button class="button" id="telegram-request">Поделиться запросом в Telegram →</button><button class="text-link" id="copy-request">Скопировать текст заявки</button><p id="request-status" role="status"></p><p class="control-hint">Telegram откроется с подготовленным текстом. Отправка — только после вашего подтверждения. Изображения не прикрепляются автоматически.</p></div><button class="button" id="export-order">Скачать запрос в мастерскую ↓</button></dialog>`;

const stepDefinitions = [
 {id:'cover',label:'Обложка',hint:'Выберите готовый рисунок или загрузите свой. Добавьте фамилию, дату или слова, которые важны вашей семье.'},
 {id:'binding',label:'Переплёт',hint:'Ручное плетение или дизайнерские болты? Внутри каждого варианта — один и тот же кольцевой механизм.'},
 {id:'color',label:'Цвет',hint:'Выберите оттенок для вашей обложки. Рисунок и переплёт остаются такими, как вы выбрали.'},
 {id:'extras',label:'Дополнения',hint:'Добавьте упаковку, держатель метрики или аксессуары. Комплектацию и цену подтвердит мастерская.'},
];
let activeStep = 'cover';
const optionsNode = document.querySelector('.options');
const stepPanels = Object.fromEntries(stepDefinitions.map(step => { const panel=document.createElement('div'); panel.id='panel-'+step.id;panel.className='config-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tab-'+step.id);return [step.id,panel]; }));
for(const heading of optionsNode.querySelectorAll('.option-label,label[for=model]')) if(heading.firstChild?.nodeType===Node.TEXT_NODE) heading.firstChild.textContent=heading.firstChild.textContent.replace(/^\d+\s*/, '');
let group='cover';
for(const node of [...optionsNode.children]) {
 if(node.id==='price-breakdown')break;
 if(node.matches('label[for="binding"]'))group='binding';
 if(node.matches('.option-label')&&node.textContent.includes('Оттенок'))group='color';
 if(node.matches('.option-label')&&node.textContent.includes('Символ'))group='cover';
 if(node.matches('.option-label')&&node.textContent.includes('Забота'))group='extras';
 stepPanels[group].append(node);
}
const wizardNode=document.createElement('div');wizardNode.className='config-wizard';
wizardNode.innerHTML=`<div class="step-tabs" role="tablist" aria-label="Настройка альбома">${stepDefinitions.map((step,i)=>`<button role="tab" id="tab-${step.id}" data-step="${step.id}" aria-controls="panel-${step.id}"><span>0${i+1}</span>${step.label}</button>`).join('')}</div><div class="mascot-guide"><img class="mascot" src="/images/brand/mascot-helper.png" alt="" loading="lazy"><div><span>ПОДСКАЗКА МАСТЕРСКОЙ</span><p id="step-hint"></p></div></div>`;
for(const step of stepDefinitions)wizardNode.append(stepPanels[step.id]);
const stepActions=document.createElement('div');stepActions.className='step-actions';stepActions.innerHTML='<button id="step-back" class="text-link">← Назад</button><span id="step-position"></span><button id="step-next" class="button">Продолжить →</button>';wizardNode.append(stepActions);optionsNode.prepend(wizardNode);
function setStep(id, focus=false) {
 activeStep=id;const index=stepDefinitions.findIndex(step=>step.id===id);
 for(const step of stepDefinitions){const tab=document.querySelector('[data-step="'+step.id+'"]');tab.setAttribute('aria-selected',step.id===id);tab.tabIndex=step.id===id?0:-1;stepPanels[step.id].hidden=step.id!==id;}
 document.querySelector('#step-hint').textContent=stepDefinitions[index].hint;
 document.querySelector('#step-back').disabled=index===0;
 document.querySelector('#step-next').hidden=index===3;
 document.querySelector('#step-position').textContent=`${index+1} / 4`;
 if(focus) document.querySelector('[data-step="'+id+'"]').focus();
}
for(const tab of document.querySelectorAll('[data-step]')){
 tab.onclick=()=>setStep(tab.dataset.step);
 tab.onkeydown=e=>{let index=stepDefinitions.findIndex(step=>step.id===activeStep);if(e.key==='ArrowRight')index=(index+1)%4;else if(e.key==='ArrowLeft')index=(index+3)%4;else if(e.key==='Home')index=0;else if(e.key==='End')index=3;else return;e.preventDefault();setStep(stepDefinitions[index].id,true);};
}
document.querySelector('#step-next').onclick=()=>setStep(stepDefinitions[Math.min(3,stepDefinitions.findIndex(step=>step.id===activeStep)+1)].id,true);
document.querySelector('#step-back').onclick=()=>setStep(stepDefinitions[Math.max(0,stepDefinitions.findIndex(step=>step.id===activeStep)-1)].id,true);
setStep('cover');

function renderPreview() {
  const model = models[state.model];
  const pages = ['Обложка', 'Кольцевой механизм', 'Семейные фотографии', 'Ваши воспоминания'];
  const transformedArt = `<div class="cover-art" style="transform:translate(${state.imageX}%,${state.imageY}%) rotate(${state.imageRotation}deg) scale(${state.imageScale})">${state.image ? `<img src="${state.image}" alt="Ваш рисунок на обложке" id="uploaded-art">` : coverDrawing(state.motif).replace('>Семья<','>'+escape(state.inscription)+'<')}</div>`;
  document.querySelector('#live-album').innerHTML = state.page === 0 ? `<div class="album custom-album ${state.color === 2 ? 'dark-cover' : ''}" style="--wood:${colors[state.color].value}">${spine(state.binding)}${transformedArt}<span>${escape(state.inscription)}</span><div class="closure"></div></div>` : `<div class="open-book" data-page="${state.page}"><div class="inside-rings"><i></i><i></i><i></i><i></i></div><div class="paper ${state.page === 1 ? 'inside-cover' : ''}">${state.page === 1 ? '<div class="inside-note">33 × 22 см<br><small>Кольцевой механизм<br>Корешок 3 см</small></div>' : '<div class="photo-placeholder"><img src="/images/family.png" alt="Пример оформления страницы — визуальная концепция"></div>'}</div><div class="paper ${state.page === 1 ? 'flyleaf' : ''}"><span class="page-quote">${['', 'Ваша история<br>начинается здесь.', 'Счастье —<br>быть вместе.', 'Самое важное —<br>быть рядом.'][state.page]}</span><small>${state.page === 1 ? 'Цвет листов уточняется' : state.page * 2}</small></div></div>`;
  document.querySelector('#preview-size').textContent = '33 × 22 см · корешок 3 см';
  document.querySelector('#page-label').textContent = pages[state.page] + ` · ${state.page + 1} / 4`;
  document.querySelector('#prev-page').disabled = state.page === 0;
  document.querySelector('#next-page').disabled = state.page === 3;
  document.querySelector('#price').textContent = money(total());
  document.querySelector('#color-name').textContent = colors[state.color].name;
  document.querySelector('#price-breakdown').innerHTML = `<strong>Состав вашего запроса</strong><p>Альбом 33 × 22 см · ${escape(model.name)}</p><p>${colors[state.color].name} · ${bindings.find(b => b.id === state.binding).name}</p>${extras.filter(e => state.extras.includes(e.id)).map(e => `<p>${e.name} — стоимость уточняется</p>`).join('')}<small>Цены ещё не опубликованы. Итоговую стоимость и комплектацию подтвердит мастерская.</small>`;
  document.querySelectorAll('[data-color]').forEach(el => { el.classList.toggle('selected', +el.dataset.color === state.color); el.setAttribute('aria-pressed', +el.dataset.color === state.color); });
  document.querySelectorAll('[data-motif]').forEach(el => { el.classList.toggle('selected', +el.dataset.motif === state.motif && !state.image); el.setAttribute('aria-pressed', +el.dataset.motif === state.motif && !state.image); });
  document.querySelector('#remove-image').hidden = !state.image;
  renderUploadedArt();
}
function chooseDesign(i, preset = false) {
 state.model = i; state.motif = i; state.inscription = models[i].inscription; state.image = null; state.page = 0;
 if (preset) { state.color = models[i].color; state.binding = models[i].binding; }
 syncControls(); renderPreview(); if(preset) setStep('cover');
}
function syncControls() {
 document.querySelector('#model').value = state.model; document.querySelector('#binding').value = state.binding; document.querySelector('#inscription').value = state.inscription;
 for (const [id,key] of [['image-scale','imageScale'],['image-x','imageX'],['image-y','imageY'],['image-rotation','imageRotation'],['image-threshold','threshold'],['image-mode','imageMode']]) document.querySelector('#'+id).value = state[key];
 document.querySelectorAll('.extra input').forEach(el => el.checked = state.extras.includes(el.value));
}
function openProduct(i) {
 const m = models[i]; const dialog = document.querySelector('#product-detail');
 dialog.innerHTML = `<div class="cart-heading"><h2>${escape(m.name)}</h2><button id="close-detail" aria-label="Закрыть карточку">×</button></div><div class="detail-gallery">${m.photos.length ? m.photos.map(url => `<img src="${url}" alt="Альбом ${escape(m.name)}">`).join('') : `<div class="detail-illustration">${album(i)}</div><p class="control-hint">Иллюстрация по присланному оформлению. Исходные фотографии добавим после загрузки файлов.</p>`}</div><p>${escape(m.subtitle)}</p><dl class="specs"><dt>Обложка</dt><dd>33 × 22 см</dd><dt>Корешок</dt><dd>3 см</dd><dt>Внутри</dt><dd>Кольцевой механизм</dd><dt>На этом варианте</dt><dd>${bindings.find(b => b.id === m.binding).name}</dd><dt>Цена</dt><dd>По запросу</dd></dl><p class="control-hint">Любой рисунок, цвет и переплёт можно сочетать. Количество листов и комплектация подтверждаются отдельно.</p><button id="configure-detail" class="button">Настроить этот альбом →</button>`;
 document.querySelector('#close-detail').onclick = () => dialog.close();
 document.querySelector('#configure-detail').onclick = () => { chooseDesign(i,true); dialog.close(); document.querySelector('#constructor').scrollIntoView({behavior:'smooth'}); };
 dialog.showModal();
}
let engravingCanvas;
function renderUploadedArt() {
 const target = document.querySelector('#uploaded-art'); if (!target || !state.image) return;
 if (state.imageMode === 'original') { target.style.filter = 'none'; return; }
 target.style.filter = state.color === 2 ? 'invert(1)' : 'none'; target.style.mixBlendMode = state.color === 2 ? 'screen' : 'multiply';
 const source = new Image(); const expected = state.image; const threshold = state.threshold;
 source.onload = () => { if (state.image !== expected || state.imageMode !== 'engrave' || state.threshold !== threshold || !target.isConnected) return;
  engravingCanvas ||= document.createElement('canvas'); engravingCanvas.width = source.width; engravingCanvas.height = source.height;
  const ctx = engravingCanvas.getContext('2d',{willReadFrequently:true}); ctx.clearRect(0,0,source.width,source.height); ctx.drawImage(source,0,0);
  const pixels=ctx.getImageData(0,0,source.width,source.height);
  for(let i=0;i<pixels.data.length;i+=4){const dark = (pixels.data[i]*.299+pixels.data[i+1]*.587+pixels.data[i+2]*.114)<threshold; pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=0; if(!dark) pixels.data[i+3]=0;}
  ctx.putImageData(pixels,0,0); target.src=engravingCanvas.toDataURL('image/png');
 }; source.src=expected;
}
document.querySelectorAll('[data-model]').forEach(el => el.onclick = () => openProduct(+el.dataset.model));
document.querySelector('#model').onchange = e => chooseDesign(+e.target.value);
document.querySelector('#binding').onchange = e => { state.binding = e.target.value; renderPreview(); };
document.querySelectorAll('[data-color]').forEach(el => el.onclick = () => { state.color = +el.dataset.color; renderPreview(); });
document.querySelectorAll('[data-motif]').forEach(el => el.onclick = () => chooseDesign(+el.dataset.motif));
document.querySelector('#inscription').oninput = e => { state.inscription = e.target.value; renderPreview(); };
document.querySelectorAll('.extra input').forEach(el => el.onchange = () => { state.extras = [...document.querySelectorAll('.extra input:checked')].map(e => e.value); renderPreview(); });
document.querySelector('#prev-page').onclick = () => { state.page = Math.max(0, state.page - 1); renderPreview(); };
document.querySelector('#next-page').onclick = () => { state.page = Math.min(3, state.page + 1); renderPreview(); };
document.querySelector('#remove-image').onclick = () => { state.image = null; document.querySelector('#upload').value = ''; document.querySelector('#upload-status').textContent = ''; renderPreview(); };
document.querySelector('#upload').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  const status = document.querySelector('#upload-status');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { status.textContent = 'Выберите PNG, JPG или WebP размером до 5 МБ.'; return; }
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas'); const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height)); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale)); canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    state.image = canvas.toDataURL('image/png'); state.page = 0; status.textContent = 'Рисунок загружен. Он хранится только в вашем браузере.'; renderPreview();
  } catch { status.textContent = 'Не удалось открыть изображение. Попробуйте другой файл.'; }
};
function saveCart() { document.querySelector('#cart-count').textContent = cart.length; try { localStorage.setItem('sloy-cart', JSON.stringify(cart)); } catch { document.querySelector('#cart-status').textContent = 'Корзина доступна до закрытия страницы: хранилище браузера заполнено.'; } }
document.querySelector('#add-cart').onclick = () => { cart.push({ model: models[state.model].name, size: models[state.model].size, color: colors[state.color].name, inscription: state.inscription, motif: motifs[state.motif], image: state.image, extras: extras.filter(e => state.extras.includes(e.id)).map(e => e.name), price: total(), binding: bindings.find(b => b.id === state.binding).name, artwork: { scale: state.imageScale, x: state.imageX, y: state.imageY, rotation: state.imageRotation, mode: state.imageMode, threshold: state.threshold }, configuration: structuredClone(state) }); document.querySelector('#cart-status').textContent = 'Альбом добавлен в корзину'; document.querySelector('#mascot-success').hidden = false; saveCart(); };
function renderCart() {
  document.querySelector('#cart-items').innerHTML = cart.length ? cart.map((item, i) => `<div class="cart-item"><div><h3>${escape(item.model)}</h3><p>${escape(item.color)} · ${escape(item.size)}<br>${escape(item.binding || 'Переплёт нужно уточнить')}<br>${escape(item.inscription)}<br>${item.image ? 'Свой рисунок' : escape(item.motif)}${item.extras.length ? '<br>' + item.extras.map(escape).join(', ') : ''}</p></div><div><strong>${money(null)}</strong><button data-remove="${i}">Удалить</button></div></div>`).join('') + `<div class="price-row"><span>Итого</span><strong>${money(cartTotal())}</strong></div>` : `<div class="empty-cart"><img class="mascot" src="/images/brand/mascot-greeting.png" alt=""><h3>Давайте начнём вашу историю?</h3><p>Выберите обложку и добавьте что-то своё.</p><button id="empty-configure" class="button">Создать альбом →</button></div>`;
  const emptyButton = document.querySelector('#empty-configure'); if(emptyButton) emptyButton.onclick = () => { document.querySelector('#cart').close(); setStep('cover'); document.querySelector('#constructor').scrollIntoView({behavior: 'smooth'}); };
  document.querySelector('#export-order').disabled = !cart.length; document.querySelector('#telegram-request').disabled = !cart.length; document.querySelector('#copy-request').disabled = !cart.length;
  document.querySelectorAll('[data-remove]').forEach(el => el.onclick = () => { cart.splice(+el.dataset.remove, 1); saveCart(); renderCart(); });
}
document.querySelector('#open-cart').onclick = () => { renderCart(); document.querySelector('#cart').showModal(); };
document.querySelector('#close-cart').onclick = () => document.querySelector('#cart').close();
document.querySelector('#cart').onclick = e => { if (e.target === e.currentTarget && (e.clientX < e.currentTarget.getBoundingClientRect().left || e.clientX > e.currentTarget.getBoundingClientRect().right || e.clientY < e.currentTarget.getBoundingClientRect().top || e.clientY > e.currentTarget.getBoundingClientRect().bottom)) e.currentTarget.close(); };
document.querySelector('#export-order').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify({ status: 'draft', items: cart, total: cartTotal(), pricingStatus: 'pending', customer: { name: document.querySelector('#customer-name').value.trim(), contact: document.querySelector('#customer-contact').value.trim(), comment: document.querySelector('#customer-comment').value.trim() } }, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'album-order-draft.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
for (const [id,key] of [['image-scale','imageScale'],['image-x','imageX'],['image-y','imageY'],['image-rotation','imageRotation'],['image-threshold','threshold']]) document.querySelector('#'+id).oninput = e => { state[key] = +e.target.value; renderPreview(); };
document.querySelector('#telegram-request').onclick = () => { const text = requestText(); const base = workshopTelegram ? `https://t.me/${workshopTelegram}?text=` : 'https://t.me/share/url?url=&text='; window.open(base + encodeURIComponent(text),'_blank','noopener,noreferrer'); document.querySelector('#request-status').textContent = workshopTelegram ? 'Проверьте текст в Telegram и подтвердите отправку. Файл проекта приложите отдельно.' : 'Выберите чат мастерской в Telegram. Публичный адрес получателя ещё не настроен; рисунок приложите отдельно.'; };
document.querySelector('#copy-request').onclick = async () => { try { await navigator.clipboard.writeText(requestText()); document.querySelector('#request-status').textContent='Текст скопирован. Вставьте его в чат мастерской и приложите скачанный файл запроса.'; } catch { document.querySelector('#request-status').textContent='Копирование недоступно. Используйте кнопку Telegram или скачайте запрос.'; } };
function requestText() { const customer = document.querySelector('#customer-name').value.trim(); const contact=document.querySelector('#customer-contact').value.trim(); const comment=document.querySelector('#customer-comment').value.trim(); return ['Здравствуйте! Хочу согласовать альбом WoodBase.', ...cart.map((item,i)=>`${i+1}. ${item.model} — ${item.size}\nЦвет: ${item.color}\nПереплёт: ${item.binding||'Уточнить'}\nНадпись: ${item.inscription||'Без надписи'}\nРисунок: ${item.image?'Свой, приложу проект':item.motif}\nДополнения: ${item.extras.join(', ')||'Без дополнений'}`), 'Цена, комплектация и срок: по согласованию.', customer ? `Имя: ${customer}` : '', contact ? `Связь: ${contact}` : '', comment ? `Пожелания: ${comment}` : '', cart.some(i=>i.image) ? 'Загруженный рисунок передам в отдельном файле проекта.' : ''].filter(Boolean).join('\n\n'); }
document.querySelector('#image-mode').onchange = e => { state.imageMode = e.target.value; renderPreview(); };
document.querySelector('#reset-art').onclick = () => { Object.assign(state,{ imageScale:1,imageX:0,imageY:0,imageRotation:0 }); syncControls(); renderPreview(); };
const projectStatus = document.querySelector('#project-status');
function validateProject(data) {
 const c=data?.configuration; if(data?.version!==1 || !c || !Number.isInteger(c.model)||!models[c.model]||!Number.isInteger(c.color)||!colors[c.color]||!bindings.some(b=>b.id===c.binding)||!Number.isInteger(c.motif)||!models[c.motif]||typeof c.inscription!=='string'||c.inscription.length>45||!Array.isArray(c.extras)||c.extras.some(id=>!extras.some(e=>e.id===id))||!['original','engrave'].includes(c.imageMode)) throw new Error('Файл не похож на проект WoodBase.');
 for(const [key,min,max] of [['imageScale',.5,1.5],['imageX',-20,20],['imageY',-20,20],['imageRotation',-45,45],['threshold',40,220]]) if(!Number.isFinite(c[key])||c[key]<min||c[key]>max)throw new Error('Некорректные параметры рисунка.');
 if(c.image!==null && (typeof c.image!=='string'||c.image.length>4000000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(c.image)))throw new Error('Некорректное изображение в проекте.');
 return {model:c.model,color:c.color,motif:c.motif,binding:c.binding,inscription:c.inscription,image:c.image,extras:[...new Set(c.extras)],page:0,imageScale:c.imageScale,imageX:c.imageX,imageY:c.imageY,imageRotation:c.imageRotation,threshold:c.threshold,imageMode:c.imageMode};
}
const project = () => ({ version:1, brand:'WoodBase', configuration:structuredClone(state) });
function restoreProject(data){state=validateProject(data);syncControls();renderPreview();projectStatus.textContent='Проект восстановлен.';}
function downloadJSON(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.querySelector('#save-project').onclick=()=>{try{localStorage.setItem('woodbase-project',JSON.stringify(project()));projectStatus.textContent='Проект сохранён в этом браузере. Для передачи близким скачайте файл проекта.';}catch{projectStatus.textContent='Не удалось сохранить в браузере. Скачайте проект файлом.';}};
document.querySelector('#load-project').onclick=()=>{try{const saved=localStorage.getItem('woodbase-project');if(!saved)throw new Error('В этом браузере ещё нет сохранённого проекта.');restoreProject(JSON.parse(saved));}catch(e){projectStatus.textContent=e.message;}};
document.querySelector('#download-project').onclick=()=>downloadJSON(project(),'WoodBase-project.json');
document.querySelector('#import-project').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024)throw new Error('Файл проекта слишком большой.');restoreProject(JSON.parse(await file.text()));}catch{projectStatus.textContent='Не удалось открыть проект. Выберите файл, скачанный из конструктора WoodBase.';}finally{e.target.value='';}};
syncControls();renderPreview();

// Motion is progressive: content remains visible without JavaScript or animation support.
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const revealTargets = [...document.querySelectorAll('.section-heading, .memory-photos, .memory-copy, .product, .nature-copy, .builder, .workshop-art, .about > div:last-child, .portfolio-grid article, .closing > *')];
let revealObserver;
function setupReveals() {
  revealObserver?.disconnect();
  revealTargets.forEach(el => el.classList.remove('motion-pending'));
  if (motionPreference.matches || !('IntersectionObserver' in window)) return;
  revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.remove('motion-pending');
    entry.target.classList.add('motion-visible');
    revealObserver.unobserve(entry.target);
  }), { threshold: 0.08 });
  revealTargets.forEach((el, index) => {
    el.classList.add('motion-reveal');
    el.style.setProperty('--reveal-delay', `${el.matches('.product, .portfolio-grid article') ? (index % 3) * 70 : 0}ms`);
    if (el.getBoundingClientRect().top > innerHeight) el.classList.add('motion-pending');
    revealObserver.observe(el);
  });
}
setupReveals();

const progress = document.createElement('div');
progress.className = 'reading-progress'; progress.setAttribute('aria-hidden', 'true');
document.body.append(progress);
const heroPhoto = document.querySelector('.hero-photo');
let scrollFrame;
function updateScrollMotion() {
  scrollFrame = undefined;
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${maxScroll > 0 ? Math.min(1, scrollY / maxScroll) : 0})`;
  if (!motionPreference.matches && finePointer.matches && scrollY < innerHeight + 200) {
    heroPhoto.style.transform = `translateY(${Math.min(scrollY * 0.13, 100)}px) scale(1.12)`;
  } else heroPhoto.style.transform = '';
}
function scheduleScrollMotion() { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollMotion); }
addEventListener('scroll', scheduleScrollMotion, { passive: true });
addEventListener('resize', scheduleScrollMotion, { passive: true });
motionPreference.addEventListener('change', () => { setupReveals(); updateScrollMotion(); });
finePointer.addEventListener('change', updateScrollMotion);
updateScrollMotion();

for (const card of document.querySelectorAll('.product-image')) {
  const cover = card.querySelector('.album');
  let tiltFrame;
  card.addEventListener('pointermove', e => {
    if (motionPreference.matches || !finePointer.matches) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    cancelAnimationFrame(tiltFrame);
    tiltFrame = requestAnimationFrame(() => {
      cover.style.transform = `perspective(600px) rotateX(${-y * 14}deg) rotateY(${x * 18}deg) rotate(-3deg) translateY(-8px)`;
    });
  });
  card.addEventListener('pointerleave', () => { cancelAnimationFrame(tiltFrame); cover.style.transform = ''; });
}

const priceNode = document.querySelector('#price');
new MutationObserver(() => {
  if (motionPreference.matches) return;
  priceNode.animate([{ opacity: 0.4, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240, easing: 'ease-out' });
}).observe(priceNode, { childList: true });

document.querySelector('#add-cart').addEventListener('click', () => {
  if (motionPreference.matches) return;
  const cartButton = document.querySelector('#open-cart');
  cartButton.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)', background: '#e8cfaa' }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' });
  const cover = document.querySelector('#live-album > div');
  cover?.animate([{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], { duration: 450 });
});
