import './order-guide.css';

export const orderGuideSection = `
<section id="order-guide" class="order-guide section" aria-labelledby="order-guide-title">
 <div class="order-guide-heading">
  <h2 id="order-guide-title">Как появится <span>ваша история</span></h2>
  <p>От первого выбора до альбома в ваших руках</p>
 </div>
 <div class="order-guide-scene"><picture><source media="(max-width: 700px)" srcset="/order-guide/album-journey-mobile.webp"><img src="/order-guide/album-journey.webp" alt="Альбом с гравировкой на деревянной обложке, кожаным корешком и чёрными страницами" width="1440" height="480" loading="lazy" decoding="async"></picture></div>
 <ol class="order-guide-steps">
  <li><span class="order-guide-number" aria-hidden="true">01</span><h3>Выберите свой альбом</h3><p>Настройте обложку, цвет и детали. Отправьте запрос из корзины</p></li>
  <li><span class="order-guide-number" aria-hidden="true">02</span><h3>Согласуем оформление</h3><p>Вместе уточним макет, стоимость и срок изготовления</p></li>
  <li><span class="order-guide-number" aria-hidden="true">03</span><h3>Создадим и отправим</h3><p>Соберём альбом вручную и согласуем доставку</p></li>
 </ol>
 <a class="order-guide-action" href="#constructor">Собрать свой альбом</a>
 <div class="order-guide-faq"><h3>Остались вопросы?</h3><div>
  <details><summary>Что входит в комплект?</summary><p>Плотные чёрные листы, золотой и серебряный маркеры, матовые стикеры и пять листов уголков для фотографий. Выбранные дополнения согласуем перед изготовлением.</p></details>
  <details><summary>Можно со своим рисунком?</summary><p>Да. Загрузите рисунок в конструктор и настройте его положение. Перед изготовлением согласуем макет: слишком мелкие элементы могут не подойти для лазерной гравировки.</p></details>
  <details><summary>Как оформить индивидуальный заказ?</summary><p>Настройте альбом, добавьте его в корзину и укажите контакты и пожелания. Скопируйте или скачайте запрос либо поделитесь им через Telegram. Проект с загруженным рисунком приложите отдельным файлом. Отправку сообщения нужно подтвердить в выбранном чате.</p></details>
 </div></div>
</section>`;
