import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import 'lenis/dist/lenis.css';
import './styles/main.css';

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { reduceMotion } from './lib/dom.js';
import { initStory } from './modules/story.js';
import { initDeck } from './modules/deck.js';
import { initLightbox } from './modules/lightbox.js';
import { initSheet } from './modules/sheet.js';
import { initBoard } from './modules/board.js';
import { initPalette } from './modules/palette.js';
import { initUI } from './modules/ui.js';

gsap.registerPlugin(ScrollTrigger);

// Start at the top so the name always gets to assemble.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) window.scrollTo(0, 0);

const reduce = reduceMotion();

initDeck();

let lenis = null;
if (!reduce) {
  lenis = new Lenis({ autoRaf: false, lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

const lightbox = initLightbox(lenis);
const sheet = initSheet(lenis, lightbox);
initBoard();
initPalette({ lenis, sheet });
initUI({ lenis });
initStory();

document.addEventListener('layout:changed', () => ScrollTrigger.refresh());
