// Keep the last decoded image visible until the newest selection is ready.
export function createAlbumPreview(container) {
  let figure, current, requestedSource, revision = 0, transition;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function settle() { transition?.cleanup(); }
  function reset() {
    revision++; requestedSource = null;
    settle(); figure = current = null;
  }
  async function show(source, alt) {
    if (figure?.isConnected && requestedSource === source) {
      if (current) current.alt = alt;
      return;
    }
    const request = ++revision;
    requestedSource = source;
    settle();
    if (!figure?.isConnected) {
      figure = document.createElement('figure');
      figure.className = 'configured-album';
      figure.innerHTML = '<span class="configured-album-status" role="status">Загружаем ваш альбом…</span>';
      container.replaceChildren(figure); current = null;
    }
    const target = figure;
    const status = target.querySelector('.configured-album-status');
    target.setAttribute('aria-busy', 'true');
    if (current?.getAttribute('src') === source) {
      current.alt = alt; target.setAttribute('aria-busy', 'false'); return;
    }
    const image = new Image();
    image.width = 1536; image.height = 1024; image.alt = alt; image.src = source;
    try { await image.decode(); }
    catch {
      if (request !== revision || !target.isConnected) return;
      requestedSource = null;
      target.setAttribute('aria-busy', 'false');
      target.classList.add('has-error');
      status.textContent = 'Изображение не загрузилось. Выберите вариант ещё раз.';
      return;
    }
    if (request !== revision || !target.isConnected) return;
    const previous = current;
    current = image;
    target.append(image); target.classList.remove('has-error');
    target.classList.add('is-ready'); target.setAttribute('aria-busy', 'false');
    if (!previous || reduced.matches || !image.animate) { previous?.remove(); return; }
    previous.setAttribute('aria-hidden', 'true');
    const timing = {duration:400, easing:'cubic-bezier(.4,0,.2,1)', fill:'both'};
    const animations = [
      previous.animate([{opacity:1},{opacity:0}], timing),
      image.animate([{opacity:0,transform:'scale(.98)'},{opacity:1,transform:'scale(1)'}], timing),
    ];
    const active = {cleanup() {
      previous.remove();
      animations.forEach(animation => animation.cancel());
      if (transition === active) { transition = null; target.dataset.transition = 'idle'; }
    }};
    transition = active; target.dataset.transition = 'running';
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (transition === active) active.cleanup();
    });
  }
  reduced.addEventListener('change', settle);
  return {show, reset};
}
