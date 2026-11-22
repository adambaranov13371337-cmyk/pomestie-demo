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
  if (event.ctrlKey || event.metaKey || event.defaultPrevented || !event.cancelable || modal?.open) return;
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
