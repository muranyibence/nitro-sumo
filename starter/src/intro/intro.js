/**
 * Nitrowise -> WISE leesik -> NITRO SUMO.
 * A stinghez idozitve (~10.03s). Soha nem skippelheto, soha nem dob.
 */

import { playSting, stopSting } from './sound.js';

const SRC_WISE = 'img/logo/Nitrowise_Logo_no_tagline.png';
const SRC_NITRO = 'img/logo/Nitro_Logo_no_WISE.png';
const SRC_SUMO = 'img/logo/NitroSumo_Logo.png';

const STING_MS = 10030;
const FADE_MS = 400;

function injectCss() {
  if (document.querySelector('link[data-nitro-intro]')) {
    return Promise.resolve();
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./intro.css', import.meta.url).href;
  link.dataset.nitroIntro = '1';
  document.head.appendChild(link);
  return new Promise((resolve) => {
    link.onload = () => resolve();
    link.onerror = () => resolve();
  });
}

function loadImg(src) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(true);
    im.onerror = () => resolve(false);
    im.src = src;
  });
}

function waitMs(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function waitGesture() {
  return new Promise((resolve) => {
    let raf = 0;
    const go = () => {
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
      if (raf) cancelAnimationFrame(raf);
      resolve();
    };
    window.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
    const poll = () => {
      try {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < pads.length; i++) {
          const gp = pads[i];
          if (!gp || !gp.buttons) continue;
          for (let b = 0; b < gp.buttons.length; b++) {
            if (gp.buttons[b] && gp.buttons[b].pressed) { go(); return; }
          }
        }
      } catch (_) { /* */ }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
  });
}

function mount() {
  const root = document.createElement('div');
  root.className = 'intro-root';
  root.innerHTML =
    '<div class="intro-glow"></div>' +
    '<div class="intro-stage">' +
      '<img class="intro-img intro-nitro" alt="" src="' + SRC_NITRO + '">' +
      '<img class="intro-img intro-full" alt="" src="' + SRC_WISE + '">' +
      '<img class="intro-img intro-wise" alt="" src="' + SRC_WISE + '">' +
      '<img class="intro-img intro-sumo" alt="" src="' + SRC_SUMO + '">' +
      '<div class="intro-flash"></div>' +
    '</div>' +
    '<p class="intro-hint">CLICK TO CONTINUE...</p>';
  document.body.appendChild(root);
  return root;
}

export function playIntro() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      stopSting();
      resolve();
    };

    const run = async () => {
      let root = null;
      try {
        await injectCss();
        root = mount();
        await Promise.race([
          Promise.all([loadImg(SRC_WISE), loadImg(SRC_NITRO), loadImg(SRC_SUMO)]),
          waitMs(4000),
        ]);

        root.classList.add('is-wait');
        await waitGesture();
        try { await playSting(); } catch (_) { /* */ }
        root.classList.add('is-run');

        await waitMs(STING_MS);
        root.classList.add('is-out');
        await waitMs(FADE_MS);
      } catch (_) { /* */ }

      try { if (root) root.remove(); } catch (_) { /* */ }
      finish();
    };

    run();
  });
}

export default playIntro;
