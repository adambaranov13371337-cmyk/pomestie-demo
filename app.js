'use strict';
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const railElements = [...document.querySelectorAll('[data-rail]')];
const modal = document.querySelector('#viewer');
const nav = document.querySelector('.mobnav');
const html = document.documentElement;
const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
let motion = null;
let frame = 0;
function stopScroll() {
  cancelAnimationFrame(frame);
  frame = 0;
  motion = null;
}
function position(element) {
  return element === window ? window.scrollY : element.scrollLeft;
}
function limit(element) {
  return element === window ? html.scrollHeight - html.clientHeight : element.scrollWidth - element.clientWidth;
}
function place(element, value) {
  if (element === window) window.scrollTo({top: value, behavior: 'instant'});
  else element.scrollTo({left: value, behavior: 'instant'});
}
function tick(time) {
  if (!motion) return;
  const {element, target, lastTime} = motion;
  const value = position(element);
  const delta = target - value;
  if (Math.abs(delta) < 1.5) {
    place(element, target);
    stopScroll();
    return;
  }
  const elapsed = clamp(time - lastTime, 9, 48);
  const step = Math.sign(delta) * Math.max(1, Math.abs(delta) * (1 - Math.exp(-elapsed / 75)));
  place(element, value + step);
  motion.lastTime = time;
  frame = requestAnimationFrame(tick);
}
function advance(element, delta) {
  const start = motion?.element === element ? motion.target : position(element);
  const target = clamp(start + delta, 0, limit(element));
  if (Math.abs(target - start) < .5) return false;
  if (reduced.matches) {
    place(element, target);
    return true;
  }
  if (motion?.element !== element) stopScroll();
  motion = {element, target, lastTime: performance.now()};
  if (!frame) frame = requestAnimationFrame(tick);
  return true;
}
window.addEventListener('wheel', event => {
  if (event.ctrlKey || event.metaKey || event.defaultPrevented || !event.cancelable || modal.open) return;
  const rail = event.target.closest?.('[data-rail]');
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
  let dy = event.deltaY * unit;
  const dx = event.deltaX * unit;
  if (rail) {
    const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    const from = motion?.element === rail ? motion.target : rail.scrollLeft;
    const right = delta > 0;
    const edge = right ? limit(rail) : 0;
    if (Math.abs(edge - from) > 1 && advance(rail, delta)) {
      event.preventDefault();
      return;
    }
    // Complete the last few pixels before the next wheel impulse moves the page.
    if (motion?.element === rail) {
      place(rail, motion.target);
      stopScroll();
    }
    if (!dy || event.shiftKey) return;
  }
  if (Math.abs(dx) > Math.abs(dy) || reduced.matches || event.shiftKey) return;
  if (advance(window, dy)) event.preventDefault();
}, {passive:false});
for (const name of ['pointerdown','touchstart','keydown','hashchange','resize']) {
  window.addEventListener(name, stopScroll, {passive:true});
}
for (const rail of railElements) {
  rail.addEventListener('keydown', event => {
    if (event.target !== rail || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    let delta = rail.clientWidth * .72 * (event.key === 'ArrowLeft' ? -1 : 1);
    if (event.key === 'Home') delta = -rail.scrollWidth;
    if (event.key === 'End') delta = rail.scrollWidth;
    // The global key handler cancels obsolete animations before a new one starts.
    event.stopPropagation();
    advance(rail, delta);
  });
}
document.addEventListener('click', event => {
  if (event.target.closest('a[href^="#"]')) stopScroll();
  if (nav.open && (!nav.contains(event.target) || event.target.closest('a'))) nav.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') nav.open = false;
});
const facadeButtons = [...document.querySelectorAll('[data-angle]')];
const facadeImages = facadeButtons.map((button, index) => ({
  url: `assets/view-${index}.webp`,
  caption: button.textContent.trim()
}));
const mainView = document.querySelector('.main-view');
const mainImage = document.querySelector('#main-view-image');
const largeImage = document.querySelector('#viewer-img');
const label = document.querySelector('#viewer-label');
const counter = document.querySelector('#counter');
const workImages = [...document.querySelectorAll('[data-work]')].map((button, index) => {
  const name = button.closest('article').querySelector('h3').textContent;
  return Array.from({length: 4}, (_, number) => ({
    url: `assets/projects/${String(index + 1).padStart(2, '0')}-${number + 1}.webp`,
    caption: name
  }));
});

function showPhoto(image, item) {
  image.src = item.url;
  image.alt = item.caption;
  if (!reduced.matches && image.animate) {
    image.getAnimations().forEach(animation => animation.cancel());
    image.animate([{opacity: .65}, {opacity: 1}], {duration: 200, easing: 'ease-out'});
  }
}

function selectAngle(index) {
  const selected = (index + facadeImages.length) % facadeImages.length;
  const item = facadeImages[selected];
  if (Number(mainView.dataset.image) === selected) return;
  mainView.dataset.image = selected;
  mainView.setAttribute('aria-label', 'Увеличить. ' + item.caption);
  mainView.classList.toggle('plan-selected', selected === 1);
  mainView.querySelector('.view-caption').textContent = item.caption;
  showPhoto(mainImage, item);
  for (const [i, button] of facadeButtons.entries()) {
    button.setAttribute('aria-pressed', String(i === selected));
  }
  const button = facadeButtons[selected];
  const rail = button.parentElement;
  const box = button.getBoundingClientRect();
  const frame = rail.getBoundingClientRect();
  if (box.left < frame.left || box.right > frame.right) {
    rail.scrollBy({left: box.left - frame.left - (rail.clientWidth - button.clientWidth) / 2,
      behavior: reduced.matches ? 'instant' : 'smooth'});
  }
}
facadeButtons.forEach((button, index) => button.addEventListener('click', () => selectAngle(index)));

const roomButtons = [...document.querySelectorAll('[data-room]')];
const roomShade = document.querySelector('.room-shade');
function highlightRoom(which) {
  roomShade.dataset.highlight = String(which);
  roomButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(which === index)));
}
roomButtons.forEach((button, index) => {
  button.addEventListener('click', () => highlightRoom(index));
});

let activeGallery = facadeImages;
let photoIndex = 0;
function viewPhoto(index) {
  photoIndex = (index + activeGallery.length) % activeGallery.length;
  const item = activeGallery[photoIndex];
  label.textContent = item.caption;
  counter.textContent = (photoIndex + 1) + ' / ' + activeGallery.length;
  showPhoto(largeImage, item);
}
function openViewer(gallery, index) {
  stopScroll();
  activeGallery = gallery;
  viewPhoto(index);
  modal.showModal();
  html.style.overflow = 'hidden';
}
for (const button of document.querySelectorAll('[data-image]')) {
  button.addEventListener('click', () => openViewer(facadeImages, Number(button.dataset.image)));
}
for (const button of document.querySelectorAll('[data-work]')) {
  button.addEventListener('click', () => openViewer(workImages[Number(button.dataset.work)], 0));
}
document.querySelector('#close').addEventListener('click', () => modal.close());
modal.addEventListener('close', () => { html.style.overflow = ''; });
modal.addEventListener('click', event => {
  if (event.target === modal) modal.close();
  const turn = event.target.closest('[data-turn]');
  if (turn) viewPhoto(photoIndex + Number(turn.dataset.turn));
});
modal.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    viewPhoto(photoIndex + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
function addSwipe(element, handleTurn) {
  let start = null;
  let suppressClickUntil = 0;
  element.addEventListener('touchstart', event => {
    start = event.touches.length === 1 ? event.touches[0] : null;
  }, {passive: true});
  element.addEventListener('touchcancel', () => { start = null; });
  element.addEventListener('touchend', event => {
    if (!start || event.touches.length) return;
    const dx = event.changedTouches[0].clientX - start.clientX;
    const dy = event.changedTouches[0].clientY - start.clientY;
    start = null;
    if (Math.abs(dx) < 48 || Math.abs(dy) > Math.abs(dx) * .55) return;
    suppressClickUntil = performance.now() + 450;
    handleTurn(dx < 0 ? 1 : -1);
  }, {passive: true});
  element.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil && event.detail) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}
addSwipe(mainView, delta => selectAngle(Number(mainView.dataset.image) + delta));
addSwipe(largeImage, delta => viewPhoto(photoIndex + delta));
document.querySelector('#changes-form').addEventListener('submit', event => {
  event.preventDefault();
  const selected = new FormData(event.currentTarget).getAll('change');
  const body = 'Здравствуйте! Прошу рассчитать стоимость изменений проекта «Лаврентий».' +
    (selected.length ? '\n\n' + selected.map(item => '• ' + item).join('\n') : '');
  location.href = 'mailto:info@skpomestie.ru?subject=' + encodeURIComponent('Расчёт изменений проекта «Лаврентий»') + '&body=' + encodeURIComponent(body);
});
reduced.addEventListener('change', stopScroll);
if (!reduced.matches && 'IntersectionObserver' in window) {
  html.classList.add('js-motion');
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      entry.target.classList.remove('waiting');
      observer.unobserve(entry.target);
    }
  }, {threshold:.05});
  for (const el of document.querySelectorAll('.section-line,.plan-step h2,.split h2,.steps li,.person')) {
    if (el.getBoundingClientRect().top < innerHeight) continue;
    el.setAttribute('data-reveal', '');
    el.classList.add('waiting');
    observer.observe(el);
  }
}
