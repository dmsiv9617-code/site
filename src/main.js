import {createAlbumPreview} from './album-preview.js';
import {variantFor, leatherName} from './album-variants.js';
import './album-variants.css';
import './preview.css';
import './header-collection.css';
import './benefits.css';
import {setupHeaderCollection} from './header-collection.js';
const inlineImages = {"catalog/family-history.png":"/scroll-assets/ebc213ef22f495b9091d.png","concept/album-open.png":"/scroll-assets/1cb52a5d921355f655d6.png","concept/album-turn.png":"/scroll-assets/7d390838829d03dbd7aa.png","concept/hero-scene.png":"/scroll-assets/144c86df5f17442a511d.png","concept/details-source.png":"/scroll-assets/3f8fee0316aa7fd2cb44.png","hero.png":"/scroll-assets/653cf8fe0931c6345787.png","family.png":"/scroll-assets/27c5ffc5b5ecba4c06b9.png","wood-grain.svg":"/scroll-assets/c5e6c8488a06179ed746.svg","in-hands.png":"/scroll-assets/b7a3500becccb277ee85.png","brand/logo.png":"/scroll-assets/b02e7f90d14ea4f664b9.png","brand/mascot-greeting.png":"/scroll-assets/d315c6f4af2807c4bc44.png","brand/mascot-helper.png":"/scroll-assets/4f9f849127af2e4c3ec0.png","brand/mascot-joy.png":"/scroll-assets/11c6ebaeca016a6260ca.png"};
for (const [name, value] of Object.entries(inlineImages)) document.documentElement.style.setProperty('--asset-' + name.replaceAll('.', '-').replaceAll('/', '-'), 'url("' + value + '")');




// Prices remain unset until the workshop supplies its actual price list.
const models = [
  { name: 'Семья', subtitle: 'Где начинается жизнь и не заканчивается любовь', inscription: 'Семья', color: 2, binding: 'woven' },
  { name: 'Однажды мы загадали тебя', subtitle: 'Для первых дней и больших маленьких открытий', inscription: 'Однажды мы загадали тебя…', color: 0, binding: 'bolts' },
  { name: 'Начало твоей истории', subtitle: 'Ладошки, которые хочется помнить маленькими', inscription: 'Начало твоей истории', color: 1, binding: 'woven' },
  { name: 'История нашей семьи', subtitle: 'Семейное дерево и воспоминания поколений', inscription: 'История нашей семьи', color: 1, binding: 'bolts' },
  { name: 'Счастье внутри', subtitle: 'Для всех ваших счастливых мгновений', inscription: 'Счастье внутри', color: 0, binding: 'bolts' },
  { name: 'Счастливые моменты', subtitle: 'Семейные корни и истории, которые остаются', inscription: 'Счастливые моменты', color: 0, binding: 'bolts' },
].map(m => ({ ...m, price: null, size: '33 × 22 см', photos: m.name === 'История нашей семьи' ? ['/scroll-assets/ebc213ef22f495b9091d.png'] : [] }));
const colors = [{ id: 'natural', name: 'Натуральный', value: '#dec08b' }, { id: 'walnut', name: 'Ореховый', value: '#91603d' }, { id: 'black', name: 'Чёрный', value: '#292929' }, { id: 'copper', name: 'Медный', value: '#bc562b' }];
const bindings = [{ id: 'bolts', name: 'Дизайнерские болты', price: null }, { id: 'woven', name: 'Ручное плетение', price: null }];
const motifs = models.map(m => m.name);
const extras = [{ id: 'box', name: 'Подарочная упаковка', price: null }, { id: 'metric', name: 'Держатель для метрики', price: null }, { id: 'corners', name: 'Уголки для фотографий', price: null }, { id: 'markers', name: 'Золотой и серебряный маркеры', price: null }, { id: 'stickers', name: 'Декоративные наклейки', price: null }];
let state = { model: 0, color: 2, motif: 0, binding: 'woven', leather: 'black', inscription: 'Семья', image: null, extras: [], page: 0, imageScale: 1, imageX: 0, imageY: 0, imageRotation: 0, threshold: 140, imageMode: 'engrave' };
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
<header><a class="logo" href="#" aria-label="WoodBase — главная"><img class="brand-logo" src="/hero-assets/woodbase-light.svg" alt="WoodBase — логотип с дятлом" width="180" height="88"></a><nav aria-label="Основная навигация"><a href="#catalog">Коллекция</a><a href="#constructor">Дизайн</a><a href="#workshop">Мастерская</a><a href="#about">О нас</a></nav><button class="cart-button" id="open-cart" aria-label="Открыть корзину"><svg class="branded-bag" viewBox="500 225 530 530" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"><defs><mask id="bag-rim-mask" maskUnits="userSpaceOnUse" x="500" y="225" width="530" height="530"><rect x="500" y="225" width="530" height="530" fill="white" stroke="none"/><path d="M632 405 C667 309 709 245 771 250 C838 248 859 310 897 417 L931 480 C876 491 861 463 850 418 C831 338 817 265 777 253 C724 269 722 326 733 394 C744 455 748 494 679 503 C696 461 698 422 697 379 C693 318 725 260 771 250" fill="black" stroke="black" stroke-width="24"/></mask></defs><g mask="url(#bag-rim-mask)"><path d="M536 423 917 385 1003 414 1003 666 596 729 525 687Z M536 423 596 455 1003 414 M596 455V729"/></g><path d="M632 405 C667 309 709 245 771 250 C838 248 859 310 897 417 L931 480 C876 491 861 463 850 418 C831 338 817 265 777 253 C724 269 722 326 733 394 C744 455 748 494 679 503 C696 461 698 422 697 379 C693 318 725 260 771 250"/></svg><span id="cart-count">${cart.length}</span></button></header>
<main>
<section class="hero concept-hero"><img class="hero-photo" src="/hero-assets/workshop-soft-background.webp" alt="" aria-hidden="true" width="1536" height="1024" fetchpriority="high"><div class="hero-woody"><img src="/hero-assets/woody-album-sharp.webp" alt="Вуди держит деревянный альбом «История нашей семьи»" width="1024" height="1536" fetchpriority="high"></div><div class="hero-copy"><div class="eyebrow">WOODBASE / ДЕРЕВЯННЫЕ ФОТОАЛЬБОМЫ</div><h1><span>Воспоминания —</span><br>не для галереи<br>телефона.</h1><div class="hero-actions"><a class="button" href="#constructor">Собрать свой альбом <span>→</span></a><a class="text-link" href="#catalog">Посмотреть коллекцию ↓</a></div></div></section>
<section id="details" class="benefits" aria-labelledby="benefits-title">
  <div class="benefits-banner" aria-hidden="true"><div class="benefits-banner-heading"></div>
<div class="benefits-tile" data-benefit-reveal style="left:0.000000%;top:4.622322%;width:49.887260%;height:39.909808%;--benefit-delay:0ms"><img src="/scroll-assets/benefits-approved.webp" alt="" width="1774" height="887" loading="lazy" decoding="async" style="width:200.451977%;height:250.564972%;left:0.000000%;top:-11.581921%"></div>
<div class="benefits-tile" data-benefit-reveal style="left:49.887260%;top:4.622322%;width:50.112740%;height:39.909808%;--benefit-delay:100ms"><img src="/scroll-assets/benefits-approved.webp" alt="" width="1774" height="887" loading="lazy" decoding="async" style="width:199.550056%;height:250.564972%;left:-99.550056%;top:-11.581921%"></div>
<div class="benefits-tile" data-benefit-reveal style="left:0.000000%;top:44.532131%;width:57.046223%;height:36.640361%;--benefit-delay:0ms"><img src="/scroll-assets/benefits-approved.webp" alt="" width="1774" height="887" loading="lazy" decoding="async" style="width:175.296443%;height:272.923077%;left:0.000000%;top:-121.538462%"></div>
<div class="benefits-tile" data-benefit-reveal style="left:57.046223%;top:44.532131%;width:42.953777%;height:36.640361%;--benefit-delay:100ms"><img src="/scroll-assets/benefits-approved.webp" alt="" width="1774" height="887" loading="lazy" decoding="async" style="width:232.808399%;height:272.923077%;left:-132.808399%;top:-121.538462%"></div>
<div class="benefits-tile" data-benefit-reveal style="left:0.000000%;top:81.172492%;width:100.000000%;height:18.827508%;--benefit-delay:0ms"><img src="/scroll-assets/benefits-approved.webp" alt="" width="1774" height="887" loading="lazy" decoding="async" style="width:100.000000%;height:531.137725%;left:0.000000%;top:-431.137725%"></div>
</div>
  <div class="benefits-content">
    <div class="benefits-heading"><span>WoodBase</span><span aria-hidden="true"></span><h2 id="benefits-title">Преимущества</h2></div>
    <div class="benefits-cards">
      <article class="benefit-card" data-benefit-reveal><div class="benefit-photo benefit-material" role="img" aria-label="Крупный план дерева, фактурного кожаного корешка без прошивки и латунных креплений"></div><div class="benefit-copy"><span class="benefit-pill">Натуральные материалы</span><h3>Дерево и кожа</h3><p>Приятно даже просто держать.</p></div></article>
      <article class="benefit-card" data-benefit-reveal><div class="benefit-photo benefit-hands" role="img" aria-label="Мастер держит большой деревянный альбом «История нашей семьи»"></div><div class="benefit-copy"><span class="benefit-pill">Ручная сборка</span><h3>Сделано с душой.</h3><p>Каждый альбом мы собираем вручную с вниманием к деталям.</p></div></article>
      <article class="benefit-card" data-benefit-reveal><img class="benefit-photo" src="/scroll-assets/benefits-markers.webp" alt="Вид сверху: золотой и серебряный маркеры лежат на листах стикеров и чёрных уголков" width="1448" height="1086" loading="lazy" decoding="async"><div class="benefit-copy"><h3>Не просто храни. Создавай.</h3><p>В комплекте — золотой и серебряный маркеры, матовые стикеры и 5 листов уголков для фотографий.</p></div></article>
      <article class="benefit-card benefit-pages" data-benefit-reveal><div class="benefit-pages-banner" role="img" aria-label="Плотные листы. Чёрные страницы. Идеальное пространство для ваших историй. Веер прямоугольных чёрных листов на серебристых кольцах."></div><div class="benefit-pages-text"><span>Плотные листы</span><h3>Чёрные страницы</h3><p>Идеальное пространство для ваших историй.</p></div></article>
      <article class="benefit-card benefit-personal" data-benefit-reveal><img class="benefit-photo" src="/scroll-assets/benefits-personal.webp" alt="Гравировка «Твоя история» на деревянном альбоме, кожаная застёжка посередине правого края обложки" width="1536" height="1024" loading="lazy" decoding="async"><div class="benefit-copy"><span class="benefit-pill">Под заказ</span><h3>Сделай альбом своим.</h3><p>Выбирай цвет, прошивку корешка и надпись.</p></div></article>
    </div>
  </div>
  <a class="benefits-cta" href="#constructor">Собрать свой альбом <span aria-hidden="true">↗</span></a>
</section>
<section id="catalog" class="section"><div class="section-heading"><div><div class="eyebrow">02 / НАША КОЛЛЕКЦИЯ ОБЛОЖЕК</div><h2>Альбомы,<br><em>которые остаются.</em></h2></div><p>Начните с обложки, которая вам близка.<br>Цвет, переплёт и надпись можно изменить.</p></div><div class="catalog">${models.map((m, i) => `<button class="product" data-model="${i}" aria-label="Подробнее об альбоме ${escape(m.name)}"><span class="product-number" aria-hidden="true">0${i+1}</span><div class="product-image tone-${i}">${m.photos.length ? `<img class="real-product-photo" src="${m.photos[0]}" alt="Альбом «${escape(m.name)}» — изображение предоставлено мастерской" loading="lazy" width="1536" height="1024">` : album(i)}</div><div class="product-paper"><div class="product-maker" aria-hidden="true"><span>WOODBASE</span>${leaf}</div><div class="product-info"><h3>${m.name}</h3></div><div class="product-ornament" aria-hidden="true">${leaf}</div><p>${m.subtitle}</p><small>${m.size} · Ручная сборка</small><span class="product-price">${money(m.price)}</span><span class="product-arrow">Сделать своим <span aria-hidden="true">→</span></span></div></button>`).join('')}</div><p class="demo-note">Все альбомы: 33 × 22 см, корешок 3 см. Дизайн, цвет и переплёт можно сочетать свободно. Цены и комплектацию уточняем в мастерской.</p></section>
<section id="constructor" class="constructor section"><div class="section-heading"><div><div class="eyebrow">03 / СОБЕРИТЕ СВОЙ ВАРИАНТ</div><h2>Ваш альбом.<br><em>Собранный по-вашему.</em></h2></div><p>Любимый рисунок, семейная фамилия, особая дата.<br>Добавьте то, что делает этот альбом вашим.</p></div><div class="builder"><div class="preview"><div class="preview-top"><span>СОЗДАЁТСЯ ВАША ИСТОРИЯ</span><span id="preview-size"></span></div><div id="live-album"></div><button id="toggle-album" class="button album-toggle" aria-expanded="false" aria-controls="live-album">Открыть альбом →</button><div class="page-controls"><button id="prev-page" aria-label="Предыдущая страница">←</button><span id="page-label"></span><button id="next-page" aria-label="Следующая страница">→</button></div><p>Загляните внутрь — там место для счастья</p><small id="preview-note" aria-live="polite"></small></div><div class="options"><label for="model">01 <strong>Дизайн обложки</strong></label><select id="model">${models.map((m, i) => `<option value="${i}">${m.name} · ${m.size}</option>`).join('')}</select><label for="binding" class="small-label">Переплёт — независимо от дизайна</label><select id="binding">${bindings.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select><p class="control-hint">Внутри обоих вариантов — кольцевой механизм. Различается оформление корешка.</p><label for="leather" class="small-label">Цвет кожи</label><select id="leather"><option value="black">Чёрная · серебряная фурнитура</option><option value="brown">Коричневая · бронзовая фурнитура</option></select><div class="option-label">02 <strong>Оттенок дерева</strong> <span id="color-name"></span></div><div class="swatches">${colors.map((c, i) => `<button data-color="${i}" aria-label="${c.name}" style="background:${c.value}"></button>`).join('')}</div><div class="option-label">03 <strong>Символ вашей семьи</strong></div><div class="motifs">${motifs.map((m, i) => `<button data-motif="${i}" aria-label="Рисунок ${models[i].name}">${coverDrawing(i)}</button>`).join('')}</div><label class="upload" for="upload">↑ Загрузить свой рисунок <span>PNG, JPG, WebP · до 5 МБ</span></label><input type="file" id="upload" accept="image/png,image/jpeg,image/webp" hidden><div id="upload-status" role="status"></div><details class="art-tools"><summary>Настроить рисунок и гравировку</summary><label>Размер рисунка <input id="image-scale" type="range" min="0.5" max="1.5" step="0.05" value="1"></label><label>По горизонтали <input id="image-x" type="range" min="-20" max="20" value="0"></label><label>По вертикали <input id="image-y" type="range" min="-20" max="20" value="0"></label><label>Поворот <input id="image-rotation" type="range" min="-45" max="45" value="0"></label><label for="image-mode">Обработка загруженного рисунка</label><select id="image-mode"><option value="engrave">Чёрно-белый эскиз гравировки</option><option value="original">Исходное изображение</option></select><label>Порог чёрного <input id="image-threshold" type="range" min="40" max="220" value="140"></label><p class="control-hint">Мелкие детали и полутона могут потеряться. Изображение на экране — эскиз, окончательный макет согласуем.</p><button class="text-link" id="reset-art">Сбросить положение рисунка</button></details><button id="remove-image" class="text-link" hidden>Убрать загруженный рисунок</button><label for="inscription" class="small-label">Слова, которые останутся</label><input id="inscription" maxlength="45" value="Наша история" placeholder="Семья Ивановых · Счастье быть вместе"><div class="option-label">04 <strong>Забота в деталях</strong></div>${extras.map(e => `<label class="extra"><input type="checkbox" value="${e.id}"><span>${e.name}</span><span>Уточним стоимость</span></label>`).join('')}<div id="price-breakdown" class="price-breakdown"></div><div class="price-row"><span>Стоимость после согласования</span><strong id="price"></strong></div><button id="add-cart" class="button">Сохранить нашу историю <span>→</span></button><div id="cart-status" role="status"></div><div id="mascot-success" class="mascot-success" hidden><img class="mascot" src="/scroll-assets/11c6ebaeca016a6260ca.png" alt="" loading="lazy"><p>Отличное начало вашей истории!<small>Альбом добавлен. Откройте корзину, чтобы подготовить запрос.</small></p></div><div class="project-actions"><button id="save-project" class="text-link">Сохранить проект</button><button id="load-project" class="text-link">Восстановить</button><button id="download-project" class="text-link">Скачать проект</button><label for="import-project" class="text-link">Открыть файл проекта</label><input id="import-project" type="file" accept="application/json,.json" hidden></div><div id="project-status" role="status"></div></div></div></section>
<section id="about" class="atelier section"><div><div class="eyebrow">WOODBASE / НАША МАСТЕРСКАЯ</div><h2>Ваш рисунок.<br><em>Наша работа.</em></h2></div><div><p>Лазер переносит рисунок на дерево. Мы собираем обложку, переплёт и страницы в альбом — с вашей фамилией, особой датой или рисунком ребёнка.</p><a class="text-link" href="#constructor">Начать с вашей идеи →</a><a class="text-link atelier-story-link" href="#workshop">Познакомиться с мастерской →</a></div></section>
<section class="order-guide section"><div class="eyebrow">ОТ ВАШЕЙ ИДЕИ ДО СЕМЕЙНОГО АЛЬБОМА</div><h2>Как появится <em>ваша история.</em></h2><div class="order-steps"><article><span>01</span><h3>Соберите альбом</h3><p>Выберите обложку, цвет, переплёт и дополнения. Сохраните проект, чтобы обсудить его с близкими.</p></article><article><span>02</span><h3>Согласуйте детали</h3><p>Мастерская подтверждает комплектацию, цену и макет гравировки до изготовления.</p></article><article><span>03</span><h3>Получите свою историю</h3><p>Срок изготовления, оплату и доставку согласуем отдельно. Онлайн-оплата пока не подключена.</p></article></div><details><summary>Что входит в комплект?</summary><p>Размер обложки 33 × 22 см, корешок 3 см, внутри кольцевой механизм. Количество и цвет листов, упаковка и аксессуары уточняются для заказа.</p></details><details><summary>Можно использовать свой рисунок?</summary><p>Да. Загрузите его в конструктор и настройте положение. До изготовления нужен согласованный макет: не все мелкие элементы подходят для лазерной гравировки.</p></details><details><summary>Как оформить индивидуальный заказ?</summary><p>Соберите корзину и скачайте запрос с контактами и пожеланиями. Откройте текст запроса в Telegram, выберите получателя и подтвердите отправку. Проект с загруженным рисунком приложите отдельным файлом. Пока адрес мастерской не указан, Telegram предложит выбрать чат.</p></details></section><section class="closing"><div class="eyebrow">ДЛЯ СЕБЯ. ДЛЯ БЛИЗКИХ. НА ГОДЫ.</div><h2>Когда-нибудь этот альбом<br>будут листать <em>ваши внуки.</em></h2><p>Начните его историю сегодня.</p><a href="#constructor" class="button">Создать свой семейный альбом →</a></section></main>
<footer><a class="logo" href="#" aria-label="WoodBase — главная"><img class="brand-logo" src="/hero-assets/woodbase-light.svg" alt="WoodBase — логотип с дятлом" width="180" height="88"></a><p>Сохраняем тепло.<br>Передаём дальше.</p><small>WoodBase · лазерная мастерская</small></footer>
<dialog id="product-detail"></dialog><dialog id="cart"><div class="cart-heading"><h2>Ваша корзина</h2><button id="close-cart" aria-label="Закрыть корзину">×</button></div><div id="cart-items"></div><p class="checkout-note">Заявка требует согласования цены и макета. Сайт не отправляет данные автоматически и не принимает оплату. Для передачи запроса используйте Telegram; файл с рисунком нужно приложить отдельно. Ozon пока не подключён.</p><form id="request-form"><label class="small-label" for="customer-name">Ваше имя</label><input id="customer-name" name="name" maxlength="80" autocomplete="name"><label class="small-label" for="customer-contact">Телефон или email для связи</label><input id="customer-contact" name="contact" maxlength="120" autocomplete="email"><label class="small-label" for="customer-comment">Пожелания к заказу</label><textarea id="customer-comment" name="comment" maxlength="1500" rows="3"></textarea><p class="control-hint">Контакты включаются только в скачиваемый файл и не сохраняются в корзине.</p></form><div class="telegram-request"><button class="button" id="telegram-request">Поделиться запросом в Telegram →</button><button class="text-link" id="copy-request">Скопировать текст заявки</button><p id="request-status" role="status"></p><p class="control-hint">Telegram откроется с подготовленным текстом. Отправка — только после вашего подтверждения. Изображения не прикрепляются автоматически.</p></div><button class="button" id="export-order">Скачать запрос в мастерскую ↓</button></dialog>`;

// A separate hash route also works in the downloadable standalone version.
const homePage = document.querySelector('main');
homePage.id = 'home-page';
homePage.insertAdjacentHTML('afterend', `<main id="workshop-page" hidden>
<section class="workshop-intro section"><div class="workshop-intro-copy"><a class="text-link" href="#">← На главную</a><div class="eyebrow">WOODBASE / ЗНАКОМСТВО С МАСТЕРСКОЙ</div><h1 tabindex="-1">За каждой вещью —<br><em>чьи-то руки.</em></h1><p>Мы делаем деревянные альбомы для ваших семейных историй. Вы выбираете то, что дорого вам. Мы помогаем придать этому форму.</p><a class="button" href="#constructor">Собрать свой альбом <span>→</span></a></div><figure class="workshop-character"><div class="character-circle"></div><img class="workshop-mascot" src="/scroll-assets/d315c6f4af2807c4bc44.png" alt="Дятел WoodBase: красный хохолок, очки и голубая толстовка; приветствует гостей"><figcaption><span>ЗНАКОМЬТЕСЬ, НАШ ДЯТЕЛ</span><p>Маленький помощник.<br>Большое внимание к деталям.</p></figcaption></figure></section>
<section class="workshop-values section"><div class="eyebrow">ВО ЧТО МЫ ВЕРИМ</div><h2>Важное заслуживает<br><em>места рядом с вами.</em></h2><div class="workshop-beliefs"><article><span>01 / МАТЕРИАЛ</span><h3>Дерево с характером</h3><p>Рисунок волокон делает каждую обложку особенной. Цвет и гравировка помогают сделать её вашей.</p></article><article><span>02 / ВАША ИДЕЯ</span><h3>История на обложке</h3><p>Фамилия, особая дата или рисунок ребёнка. Готовый дизайн или собственное изображение — выбор за вами.</p></article><article><span>03 / РУЧНАЯ РАБОТА</span><h3>Забота в сборке</h3><p>Ручное плетение или дизайнерские болты. Внутри — кольцевой механизм, снаружи — выбранное вами оформление.</p></article></div></section>
<section class="workshop-team section"><div><div class="eyebrow">ЛЮДИ WOODBASE</div><h2>От вашей идеи<br><em>до последней детали.</em></h2><p class="workshop-team-note">Здесь познакомим вас с командой и покажем жизнь мастерской. Личные истории и фотографии добавим чуть позже.</p></div><div class="workshop-process"><article><span>01</span><div><h3>Обсуждаем вашу задумку</h3><p>Выбираем обложку, цвет, переплёт и дополнения. Согласуем макет и стоимость.</p></div></article><article><span>02</span><div><h3>Переносим рисунок на дерево</h3><p>Готовим дизайн для лазерной гравировки, чтобы он подходил для выбранной обложки.</p></div></article><article><span>03</span><div><h3>Собираем ваш альбом</h3><p>Соединяем детали и страницы. Условия изготовления и доставки обсуждаем с вами отдельно.</p></div></article></div></section>
<section class="workshop-invitation section"><img src="/scroll-assets/4f9f849127af2e4c3ec0.png" alt="" loading="lazy"><div><div class="eyebrow">ДЯТЕЛ ПОДСКАЖЕТ ПЕРВЫЙ ШАГ</div><h2>А какая история<br><em>будет у вас?</em></h2><p>Начните с любимой обложки. Остальное соберём по-вашему.</p><a class="button" href="#constructor">Перейти к конструктору →</a></div></section></main>`);
const homeTitle = document.title;
function showRoute() {
 const workshop = location.hash === '#workshop';
 homePage.hidden = workshop;
 document.querySelector('#workshop-page').hidden = !workshop;
 document.title = workshop ? 'О мастерской — WoodBase' : homeTitle;
 const workshopLink = document.querySelector('nav a[href="#workshop"]');
 if(workshop) workshopLink.setAttribute('aria-current','page'); else workshopLink.removeAttribute('aria-current');
 if(workshop) {
  window.scrollTo({top:0,behavior:'instant'});
  document.querySelector('#workshop-page h1').focus({preventScroll:true});
 } else {
  if(!location.hash || location.hash === '#') window.scrollTo({top:0,behavior:'instant'});
  const target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  if(target) target.scrollIntoView({behavior:'instant',block:'start'});
 }
}
window.addEventListener('hashchange',showRoute);
showRoute();

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
wizardNode.innerHTML=`<div class="step-tabs" role="tablist" aria-label="Настройка альбома">${stepDefinitions.map((step,i)=>`<button role="tab" id="tab-${step.id}" data-step="${step.id}" aria-controls="panel-${step.id}"><span>0${i+1}</span>${step.label}</button>`).join('')}</div><div class="mascot-guide"><img class="mascot" src="/scroll-assets/4f9f849127af2e4c3ec0.png" alt="" loading="lazy"><div><span>ПОДСКАЗКА МАСТЕРСКОЙ</span><p id="step-hint"></p></div></div>`;
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

const albumPreview = createAlbumPreview(document.querySelector('#live-album'));

function renderPreview() {
  const model = models[state.model];
  const pages = ['Обложка', 'Открытый альбом', 'Начало перелистывания', 'Разворот'];
  const variant = variantFor(state, models);
  const transformedArt = `<div class="cover-art" style="transform:translate(${state.imageX}%,${state.imageY}%) rotate(${state.imageRotation}deg) scale(${state.imageScale})">${state.image ? `<img src="${state.image}" alt="Ваш рисунок на обложке" id="uploaded-art">` : coverDrawing(state.motif).replace('>Семья<','>'+escape(state.inscription)+'<')}</div>`;
  if (state.page === 0 && variant) {
    albumPreview.show(variant, model.name + ' — ' + colors[state.color].name + ', ' + leatherName(state.leather) + ' кожа, ' + bindings.find(b=>b.id===state.binding).name);
  } else {
    albumPreview.reset();
  document.querySelector('#live-album').innerHTML = state.page === 0 ? (variant ? `<figure class="configured-album"><img src="${variant}" alt="${escape(model.name)} — ${colors[state.color].name}, ${leatherName(state.leather)} кожа, ${bindings.find(b=>b.id===state.binding).name}" width="1536" height="1024"></figure>` : `<div class="album custom-album ${state.color === 2 ? 'dark-cover' : ''}" style="--wood:${colors[state.color].value}">${spine(state.binding)}${transformedArt}<span>${escape(state.inscription)}</span><div class="closure"></div></div>`) : `<figure class="natural-spread" data-page="${state.page}"><img src="${state.page === 2 ? `/scroll-assets/7d390838829d03dbd7aa.png` : `/scroll-assets/1cb52a5d921355f655d6.png`}" alt="${state.page === 2 ? 'Начало перелистывания: правый нижний угол чёрного листа приподнят' : 'Разворот альбома с четырьмя кольцами на задней обложке'}"><figcaption>Пример внутренней конструкции. Обложка и оформление выбираются отдельно.</figcaption></figure>`;
  }
  document.querySelector('#preview-note').textContent = variant ? 'Выбранное сочетание обложки, кожи и корешка. Оттенок дерева может немного отличаться на вашем экране.' : 'Эскиз индивидуального оформления. Окончательный вид и гравировку согласуем с вами.';
  const sketch = document.querySelector('#live-album .custom-album');
  if (sketch) sketch.dataset.leather = state.leather;
  document.querySelector('#preview-size').textContent = '33 × 22 см · корешок 3 см';
  document.querySelector('#page-label').textContent = pages[state.page] + ` · ${state.page + 1} / 4`;
  const toggle = document.querySelector('#toggle-album');
  toggle.textContent = state.page === 0 ? 'Открыть альбом →' : 'Закрыть альбом ←';
  toggle.setAttribute('aria-expanded', String(state.page > 0));
  document.querySelector('#prev-page').disabled = state.page === 0;
  document.querySelector('#next-page').disabled = state.page === 3;
  document.querySelector('#price').textContent = money(total());
  document.querySelector('#color-name').textContent = colors[state.color].name;
  document.querySelector('#price-breakdown').innerHTML = `<strong>Состав вашего запроса</strong><p>Альбом 33 × 22 см · ${escape(model.name)}</p><p>${colors[state.color].name} · ${leatherName(state.leather)} кожа · ${bindings.find(b => b.id === state.binding).name}</p>${extras.filter(e => state.extras.includes(e.id)).map(e => `<p>${e.name} — стоимость уточняется</p>`).join('')}<small>Цены ещё не опубликованы. Итоговую стоимость и комплектацию подтвердит мастерская.</small>`;
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
 document.querySelector('#leather').value = state.leather;
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
document.querySelector('#leather').onchange = e => { state.leather = e.target.value; state.page = 0; renderPreview(); };

document.querySelector('#binding').onchange = e => { state.binding = e.target.value; state.page = 0; renderPreview(); };
document.querySelectorAll('[data-color]').forEach(el => el.onclick = () => { state.color = +el.dataset.color; state.page = 0; renderPreview(); });
document.querySelectorAll('[data-motif]').forEach(el => el.onclick = () => chooseDesign(+el.dataset.motif));
document.querySelector('#inscription').oninput = e => { state.inscription = e.target.value; renderPreview(); };
document.querySelectorAll('.extra input').forEach(el => el.onchange = () => { state.extras = [...document.querySelectorAll('.extra input:checked')].map(e => e.value); renderPreview(); });
function changeAlbumPage(page) {
 if(page === state.page) return;
 const preview = document.querySelector('#live-album');
 const old = preview.firstElementChild;
 const wasClosed = state.page === 0;
 state.page = page;
 renderPreview();
 const incoming = preview.firstElementChild;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches || !incoming.animate) return;
 incoming.animate([{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'scale(1)'}],{duration:650,easing:'ease-out'});
 if(old) {
  old.classList.add('album-transition');
  old.setAttribute('aria-hidden','true');
  preview.append(old);
  const opening = wasClosed && page > 0;
  const frames = opening ? [{opacity:1,transform:'perspective(1000px) rotateY(0deg)'},{opacity:0,transform:'perspective(1000px) rotateY(-105deg)'}] : [{opacity:1},{opacity:0}];
  const animation = old.animate(frames,{duration:opening ? 850 : 500,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
  animation.finished.then(()=>old.remove()).catch(()=>old.remove());
 }
}
document.querySelector('#toggle-album').onclick = () => changeAlbumPage(state.page === 0 ? 1 : 0);
document.querySelector('#prev-page').onclick = () => changeAlbumPage(Math.max(0,state.page - 1));
document.querySelector('#next-page').onclick = () => changeAlbumPage(Math.min(3,state.page + 1));
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
document.querySelector('#add-cart').onclick = () => { cart.push({ model: models[state.model].name, size: models[state.model].size, color: colors[state.color].name, leather: leatherName(state.leather), preview: variantFor(state, models), inscription: state.inscription, motif: motifs[state.motif], image: state.image, extras: extras.filter(e => state.extras.includes(e.id)).map(e => e.name), price: total(), binding: bindings.find(b => b.id === state.binding).name, artwork: { scale: state.imageScale, x: state.imageX, y: state.imageY, rotation: state.imageRotation, mode: state.imageMode, threshold: state.threshold }, configuration: structuredClone(state) }); document.querySelector('#cart-status').textContent = 'Альбом добавлен в корзину'; document.querySelector('#mascot-success').hidden = false; saveCart(); };
function renderCart() {
  document.querySelector('#cart-items').innerHTML = cart.length ? cart.map((item, i) => `<div class="cart-item"><div><h3>${escape(item.model)}</h3><p>${escape(item.color)} · ${escape(item.size)}${item.leather ? '<br>' + escape(item.leather) + ' кожа' : ''}<br>${escape(item.binding || 'Переплёт нужно уточнить')}<br>${escape(item.inscription)}<br>${item.image ? 'Свой рисунок' : escape(item.motif)}${item.extras.length ? '<br>' + item.extras.map(escape).join(', ') : ''}</p></div><div><strong>${money(null)}</strong><button data-remove="${i}">Удалить</button></div></div>`).join('') + `<div class="price-row"><span>Итого</span><strong>${money(cartTotal())}</strong></div>` : `<div class="empty-cart"><img class="mascot" src="/scroll-assets/d315c6f4af2807c4bc44.png" alt=""><h3>Давайте начнём вашу историю?</h3><p>Выберите обложку и добавьте что-то своё.</p><button id="empty-configure" class="button">Создать альбом →</button></div>`;
  const emptyButton = document.querySelector('#empty-configure'); if(emptyButton) emptyButton.onclick = () => { document.querySelector('#cart').close(); setStep('cover'); location.hash = 'constructor'; showRoute(); };
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
function requestText() { const customer = document.querySelector('#customer-name').value.trim(); const contact=document.querySelector('#customer-contact').value.trim(); const comment=document.querySelector('#customer-comment').value.trim(); return ['Здравствуйте! Хочу согласовать альбом WoodBase.', ...cart.map((item,i)=>`${i+1}. ${item.model} — ${item.size}\nЦвет: ${item.color}\nКожа: ${item.leather||'Уточнить'}\nПереплёт: ${item.binding||'Уточнить'}\nНадпись: ${item.inscription||'Без надписи'}\nРисунок: ${item.image?'Свой, приложу проект':item.motif}\nДополнения: ${item.extras.join(', ')||'Без дополнений'}`), 'Цена, комплектация и срок: по согласованию.', customer ? `Имя: ${customer}` : '', contact ? `Связь: ${contact}` : '', comment ? `Пожелания: ${comment}` : '', cart.some(i=>i.image) ? 'Загруженный рисунок передам в отдельном файле проекта.' : ''].filter(Boolean).join('\n\n'); }
document.querySelector('#image-mode').onchange = e => { state.imageMode = e.target.value; renderPreview(); };
document.querySelector('#reset-art').onclick = () => { Object.assign(state,{ imageScale:1,imageX:0,imageY:0,imageRotation:0 }); syncControls(); renderPreview(); };
const projectStatus = document.querySelector('#project-status');
function validateProject(data) {
 const c=data?.configuration; if(c && c.leather === undefined) c.leather='black';
 if(c && !['black','brown'].includes(c.leather)) throw new Error('Некорректный цвет кожи.');
 if(data?.version!==1 || !c || !Number.isInteger(c.model)||!models[c.model]||!Number.isInteger(c.color)||!colors[c.color]||!bindings.some(b=>b.id===c.binding)||!Number.isInteger(c.motif)||!models[c.motif]||typeof c.inscription!=='string'||c.inscription.length>45||!Array.isArray(c.extras)||c.extras.some(id=>!extras.some(e=>e.id===id))||!['original','engrave'].includes(c.imageMode)) throw new Error('Файл не похож на проект WoodBase.');
 for(const [key,min,max] of [['imageScale',.5,1.5],['imageX',-20,20],['imageY',-20,20],['imageRotation',-45,45],['threshold',40,220]]) if(!Number.isFinite(c[key])||c[key]<min||c[key]>max)throw new Error('Некорректные параметры рисунка.');
 if(c.image!==null && (typeof c.image!=='string'||c.image.length>4000000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(c.image)))throw new Error('Некорректное изображение в проекте.');
 return {model:c.model,color:c.color,leather:c.leather,motif:c.motif,binding:c.binding,inscription:c.inscription,image:c.image,extras:[...new Set(c.extras)],page:0,imageScale:c.imageScale,imageX:c.imageX,imageY:c.imageY,imageRotation:c.imageRotation,threshold:c.threshold,imageMode:c.imageMode};
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
const revealTargets = [...document.querySelectorAll('.section-heading, .memory-photos, .memory-copy, .nature-copy, .builder, .workshop-art, .about > div:last-child, .portfolio-grid article, .closing > *')];
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

// Taller cards stick only after their bottom is visible, including on small phones.
const catalogCards = [...document.querySelectorAll('#catalog .product')];
function fitCatalogStack() {
  catalogCards.forEach((card, index) => {
    card.style.top = `${Math.min(20 + index * 10, innerHeight - card.offsetHeight - 16)}px`;
  });
}
addEventListener('resize', fitCatalogStack, { passive: true });
document.fonts.ready.then(fitCatalogStack);
fitCatalogStack();

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
    if (!cover || motionPreference.matches || !finePointer.matches) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    cancelAnimationFrame(tiltFrame);
    tiltFrame = requestAnimationFrame(() => {
      cover.style.transform = `perspective(600px) rotateX(${-y * 14}deg) rotateY(${x * 18}deg) rotate(-3deg) translateY(-8px)`;
    });
  });
  card.addEventListener('pointerleave', () => { cancelAnimationFrame(tiltFrame); if(cover) cover.style.transform = ''; });
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
;
(() => {
  const actions = document.querySelector('.concept-hero .hero-actions');
  if (!actions) return;
  actions.innerHTML = `<a class="hero-invitation" href="#constructor" aria-label="Давай сохраним их в альбоме? Создать свой альбом — перейти в конструктор"><span class="hero-invitation-copy"><span class="hero-invitation-title">Давай сохраним их в альбоме?</span><span class="hero-invitation-label">Создать свой альбом</span></span><span class="hero-invitation-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 18 18 6M6 6h12v12" stroke-linecap="round" stroke-linejoin="round"/></svg></span></a>`;
})();
;
(() => {
  const section = document.querySelector('#catalog');
  if (!section) return;
  const order = [3, 1, 2, 4, 5, 0];
  const names = ['family-history-three-quarter', 'once-three-quarter', 'beginning-three-quarter', 'happiness-three-quarter', 'moments-three-quarter', 'family-black-three-quarter'];
  order.forEach((id, index) => { models[id].photos = [`/collection-assets/${names[index]}.webp`]; });
  const items = order.map(id => ({ id, ...models[id] }));
  items.push({id:null,name:'Создать свой альбом',custom:true});
  section.classList.add('cosmic-collection');
  const photos = [
    [24,-8,190,-24,2,.32], [46,5,115,19,.6,.45], [74,8,150,25,1,.5],
    [91,28,170,-18,2,.35], [18,62,120,20,1,.4], [-7,76,230,-28,3,.38],
    [73,82,200,19,3,.4], [61,-12,95,-17,3,.25], [3,30,100,-8,2,.18]
  ];
  section.innerHTML = `<div class="cosmic-stage">
    <div class="cosmic-photos is-paused" aria-hidden="true">${photos.map((p,i)=>`<figure class="cosmic-photo" style="--x:${p[0]}%;--y:${p[1]}%;--size:${p[2]}px;--angle:${p[3]}deg;--blur:${p[4]}px;--opacity:${p[5]};--duration:${19+i*2}s;--delay:-${i*3}s;--position:${i%2?'70%':'30%'} center"><img src="${i%2?'/scroll-assets/27c5ffc5b5ecba4c06b9.png':'/scroll-assets/b7a3500becccb277ee85.png'}" alt="" loading="lazy"></figure>`).join('')}</div>
    <div class="cosmic-glow"></div><div class="cosmic-light-trails" aria-hidden="true"><i></i><i></i><i></i></div><div class="cosmic-floor"></div>
    <h2 class="cosmic-sr-only">Коллекция деревянных альбомов</h2>
    <div class="cosmic-details" aria-live="polite" aria-atomic="true"><span class="cosmic-kicker">Коллекция</span><h3 class="cosmic-title"></h3><p class="cosmic-price"></p></div>
    <div class="cosmic-peek-list" aria-label="Следующие альбомы"></div>
    <div class="cosmic-controls" aria-label="Переключение альбомов"><button class="cosmic-prev" aria-label="Предыдущий альбом">‹</button><button class="cosmic-next" aria-label="Следующий альбом">›</button></div>
    <div class="cosmic-dots" aria-label="Выбрать альбом">${items.map((m,i)=>`<button type="button" aria-label="Показать альбом ${escape(m.name)}" aria-pressed="false" data-index="${i}"></button>`).join('')}</div>
    <div class="cosmic-albums">${items.map((m,i)=>`<button type="button" class="cosmic-album ${m.custom?'cosmic-phantom':''}" data-index="${i}" aria-label="${m.custom?'Создать свой альбом':`Выбрать альбом ${escape(m.name)}`}">${m.custom?`<span class="phantom-cover" aria-hidden="true"><span class="phantom-spine">${'<i></i>'.repeat(5)}</span><span class="phantom-plus">+</span><span class="phantom-title">Создать<br>свой альбом</span><span class="phantom-note">Ваша история начинается здесь</span><span class="phantom-closure"></span></span>`:`<img src="${m.photos[0]}" alt="" width="1536" height="1024">`}</button>`).join('')}</div>
    <div class="cosmic-hint">Нажмите на альбом — он станет первым. Нажмите ещё раз, чтобы заглянуть внутрь.</div>
    <div class="cosmic-track" aria-hidden="true"><span></span></div>
  </div>`;
  const covers = [...section.querySelectorAll('.cosmic-album')];
  const title = section.querySelector('.cosmic-title');
  const price = section.querySelector('.cosmic-price');
  const prev = section.querySelector('.cosmic-prev');
  const next = section.querySelector('.cosmic-next');
  const dots = [...section.querySelectorAll('.cosmic-dots button')];
  const bar = section.querySelector('.cosmic-track span');
  const floaters = section.querySelector('.cosmic-photos');
  const peekList = section.querySelector('.cosmic-peek-list');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let active = -1, pending = false, visible = false;
  function update() {
    pending = false;
    const rect = section.getBoundingClientRect();
    const range = Math.max(1, rect.height - innerHeight);
    const progress = Math.max(0, Math.min(1, -rect.top / range));
    const position = progress * (items.length - 1);
    const current = Math.round(position);
    if (current !== active) {
      active = current;
      title.textContent = items[active].name;
      price.textContent = items[active].custom ? 'Ваш дизайн. Ваша история.' : money(items[active].price);
      peekList.innerHTML = items.slice(active+1,active+4).map((m,j)=>`<button type="button" class="cosmic-peek" data-peek="${active+1+j}" aria-label="Выбрать ${escape(m.name)}"><span class="cosmic-peek-name">${escape(m.name)}</span><span class="cosmic-peek-price">${m.custom?'Ваш дизайн':money(m.price)}</span></button>`).join('');
      prev.disabled = active === 0; next.disabled = active === items.length - 1;
      dots.forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===active)));
      covers.forEach((cover,i)=>{cover.tabIndex=i===active?0:-1;cover.setAttribute('aria-label',items[i].custom?'Создать свой альбом':`${i===active?'Посмотреть':'Выбрать'} альбом ${items[i].name}`);});
    }
    const mobile = innerWidth <= 700;
    covers.forEach((cover, i) => {
      const d = i - (reduce.matches ? current : position);
      const scale = d >= 0 ? Math.pow(.78, d) : 1 + Math.min(-d,1)*.1;
      const x = d >= 0 ? d * (mobile ? 100 : 195) : d * (mobile ? 430 : 800);
      const y = d >= 0 ? d * 19 : d * -30;
      cover.style.transform = `translate3d(${x}px,${y}px,${-Math.max(0,d)*25}px) scale(${scale}) rotateY(${d >= 0 ? -Math.min(16,d*5) : -Math.min(25,-d*14)}deg)`;
      cover.style.opacity = d < 0 ? Math.max(0,1+d*1.45) : 1;
      cover.style.filter = `brightness(${d >= 0 ? Math.max(.72,1.03-d*.07) : 1.03}) contrast(1.06) saturate(1.07) drop-shadow(13px 18px 13px #000b)`;
      cover.style.zIndex = 20-i;
      cover.disabled = d < -.7;
      cover.style.pointerEvents = d < -.7 ? 'none' : 'auto';
      cover.setAttribute('aria-hidden', String(d < -.7));
    });
    bar.style.transform = `scaleX(${(active+1)/items.length})`;
    if (visible && !reduce.matches) floaters.style.translate = `${progress*22}px ${-progress*50}px`;
  }
  function schedule() { if (!pending) {pending=true; requestAnimationFrame(update);} }
  function go(index) {
    const rect=section.getBoundingClientRect();
    const top=scrollY+rect.top;
    scrollTo({top:top+Math.max(0,Math.min(items.length-1,index))/(items.length-1)*(rect.height-innerHeight),behavior:reduce.matches?'instant':'smooth'});
  }
  prev.onclick=()=>go(active-1); next.onclick=()=>go(active+1);
  covers.forEach((cover,i)=>{cover.onclick=()=>{
    if(items[i].custom){location.hash='constructor';document.querySelector('#constructor').scrollIntoView({behavior:reduce.matches?'instant':'smooth'});return;}
    if(i!==active){go(i);return;}
    const rect=section.getBoundingClientRect();
    const position=Math.max(0,Math.min(items.length-1,-rect.top/Math.max(1,rect.height-innerHeight)*(items.length-1)));
    if(Math.abs(position-i)>.08){go(i);return;}
    openProduct(items[i].id);
  };});
  dots.forEach((dot,i)=>{dot.onclick=()=>go(i);});
  peekList.onclick=e=>{const target=e.target.closest('[data-peek]');if(target)go(+target.dataset.peek);};
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;floaters.classList.toggle('is-paused',!visible);if(visible)schedule();}).observe(section);
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});reduce.addEventListener('change',schedule);
  update();
})();
;
(() => {
  const sources=["/woody-green-assets/opening-000.webp", "/woody-green-assets/opening-001.webp", "/woody-green-assets/opening-002.webp", "/woody-green-assets/opening-003.webp", "/woody-green-assets/opening-004.webp", "/woody-green-assets/opening-005.webp", "/woody-green-assets/opening-006.webp", "/woody-green-assets/opening-007.webp", "/woody-green-assets/opening-008.webp", "/woody-green-assets/opening-009.webp", "/woody-green-assets/opening-010.webp", "/woody-green-assets/opening-011.webp", "/woody-green-assets/opening-012.webp", "/woody-green-assets/opening-013.webp", "/woody-green-assets/opening-014.webp", "/woody-green-assets/opening-015.webp", "/woody-green-assets/opening-016.webp", "/woody-green-assets/opening-017.webp", "/woody-green-assets/opening-018.webp", "/woody-green-assets/opening-019.webp", "/woody-green-assets/opening-020.webp", "/woody-green-assets/opening-021.webp", "/woody-green-assets/opening-022.webp", "/woody-green-assets/opening-023.webp", "/woody-green-assets/opening-024.webp", "/woody-green-assets/opening-025.webp", "/woody-green-assets/opening-026.webp", "/woody-green-assets/opening-027.webp", "/woody-green-assets/opening-028.webp", "/woody-green-assets/opening-029.webp", "/woody-green-assets/opening-030.webp", "/woody-green-assets/opening-031.webp", "/woody-green-assets/opening-032.webp", "/woody-green-assets/opening-033.webp", "/woody-green-assets/opening-034.webp", "/woody-green-assets/opening-035.webp", "/woody-green-assets/opening-036.webp", "/woody-green-assets/opening-037.webp", "/woody-green-assets/opening-038.webp", "/woody-green-assets/opening-039.webp", "/woody-green-assets/opening-040.webp", "/woody-green-assets/opening-041.webp", "/woody-green-assets/opening-042.webp", "/woody-green-assets/opening-043.webp", "/woody-green-assets/opening-044.webp", "/woody-green-assets/opening-045.webp", "/woody-green-assets/opening-046.webp", "/woody-green-assets/opening-047.webp", "/woody-green-assets/opening-048.webp", "/woody-green-assets/opening-049.webp", "/woody-green-assets/opening-050.webp", "/woody-green-assets/opening-051.webp", "/woody-green-assets/opening-052.webp", "/woody-green-assets/opening-053.webp", "/woody-green-assets/opening-054.webp", "/woody-green-assets/opening-055.webp", "/woody-green-assets/opening-056.webp", "/woody-green-assets/opening-057.webp", "/woody-green-assets/opening-058.webp", "/woody-green-assets/opening-059.webp", "/woody-green-assets/opening-060.webp", "/woody-green-assets/opening-061.webp", "/woody-green-assets/opening-062.webp", "/woody-green-assets/opening-063.webp"];
  const hero=document.querySelector('.concept-hero'),catalog=document.querySelector('#catalog');
  const sequence=document.createElement('section');sequence.className='green-scroll-sequence loading';
  sequence.setAttribute('aria-label','Вуди открывает альбом при прокрутке');
  hero.before(sequence);sequence.append(hero);
  const details=document.querySelector('#details');if(details)catalog.after(details);
  hero.insertAdjacentHTML('beforeend','<canvas class="green-scroll-canvas" role="img" aria-label="Открытие альбома и приближение к чёрной странице"></canvas><div class="green-scroll-black"></div><p class="green-scroll-hint">Прокрутите — Вуди откроет альбом ↓</p><a class="green-scroll-skip" href="#catalog">Перейти к коллекции →</a>');
  const canvas=hero.querySelector('canvas'),ctx=canvas.getContext('2d');
  const copy=hero.querySelector('.hero-copy'),photo=hero.querySelector('.hero-photo'),black=hero.querySelector('.green-scroll-black');
  const header=document.querySelector('header'),hint=hero.querySelector('.green-scroll-hint');
  const stage=catalog.querySelector('.cosmic-stage');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=n=>Math.max(0,Math.min(1,n));const ease=n=>{n=clamp(n);return n*n*n*(n*(n*6-15)+10);};
  const frames=sources.map(()=>null);let queued=false,cursor=0;
  function draw(){
    queued=false;
    const w=hero.clientWidth,h=hero.clientHeight;if(!w||!h)return;
    const dpr=Math.min(devicePixelRatio||1,1.5);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const rect=sequence.getBoundingClientRect();
    const p=reduced.matches?0:clamp(-rect.top/Math.max(1,rect.height-h));
    header.style.setProperty('--hero-header-opacity',String(1-ease((p-.52)/.22)));
    let index=Math.round(clamp((p-.02)/.46)*(sources.length-1));while(index>0&&!frames[index])index--;
    const mobile=w<=700;
    const safeTop=mobile?Math.min(copy.offsetTop+copy.offsetHeight+20,h*.53):header.offsetHeight+18;
    const base=Math.min(w*(mobile?.98:.66)/714,(h-safeTop)/480);
    const dx0=(mobile?w*.5:w*.66)-357*base,dy0=mobile?safeTop:h-480*base;
    const zoom=ease((p-.51)/.28);
    const target=Math.max(w/(170*.90),h/(116*.90));
    const scale=base+(target-base)*zoom;
    const x=dx0*(1-zoom)+(w/2-403*target)*zoom;
    const y=dy0*(1-zoom)+(h/2-352*target)*zoom;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.clearRect(0,0,w,h);if(frames[index])ctx.drawImage(frames[index],x,y,714*scale,480*scale);
    const text=1-ease((p-.05)/.25);copy.style.opacity=String(text);copy.style.pointerEvents=text>.1?'':'none';copy.style.translate=`0 ${-ease(p/.3)*20}px`;
    hint.style.opacity=String(1-ease(p/.13));
    photo.style.opacity=String(1-ease((p-.52)/.20));black.style.opacity=String(ease((p-.58)/.18));
    if(stage){const top=catalog.getBoundingClientRect().top;const reveal=reduced.matches||top<=0?1:ease((p-.72)/.14);stage.style.opacity=String(reveal);stage.style.transform=reduced.matches?'':`translateY(${-Math.max(0,Math.min(h,top))}px)`;stage.style.pointerEvents=reveal>.1?'':'none';}
    sequence.dataset.progress=p.toFixed(3);sequence.dataset.frame=String(index);
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(draw);}}
  async function load(){while(cursor<sources.length){const i=cursor++;const im=new Image();im.src=sources[i];try{await im.decode();frames[i]=im;if(i===0)sequence.classList.remove('loading');schedule();}catch{if(i===0)hint.textContent='Перейдите к коллекции по ссылке';}}}
  Promise.all(Array.from({length:4},load)).then(schedule);
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});reduced.addEventListener('change',schedule);schedule();
})();

setupHeaderCollection({models,openProduct,escape,money});

// Reveal each advantage once; fail open when motion or observation is unavailable.
(() => {
  const section = document.querySelector('.benefits');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (!section || reduceMotion.matches || !('IntersectionObserver' in window)) return;
  const items = [...section.querySelectorAll('[data-benefit-reveal]')];
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });
  section.classList.add('benefits-motion');
  items.forEach(item => observer.observe(item));
  reduceMotion.addEventListener('change', event => {
    if (event.matches) {
      section.classList.remove('benefits-motion');
      observer.disconnect();
    }
  });
})();
