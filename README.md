# Joshua Mertz · Portfolio (ABC)

Everything I've built, told through 60,000 particles. Scroll and the particles morph from my name into a portrait, a Minecraft grass block, an esports trophy, a tennis ball, a spiraling football, a galaxy of every project, and finally "SAY HI".

- **Particle story**: a small hand-written WebGL2 engine (`src/gl/particles.js`) morphs point clouds generated in `src/gl/shapes.js`. Move your cursor through them, click to send a shockwave.
- **The collection**: all 22 projects as holographic trading cards that tilt toward the pointer. Tap one for the full story, screenshots, videos and the UHC Reddit archive.
- **Live board**: a split-flap board with my teams' records and next games, plus the live ATP ranking of my favorite players, from ESPN's public feeds through a Vercel function (`api/fan.js`).
- **Command palette**: press `Ctrl K` / `⌘ K` (or `/`) anywhere to jump to a section, open any project or copy my email. On phones, the "Jump to" button opens it.
- Works without WebGL (typographic fallback) and respects reduced motion.

## Run it

```bash
npm install
npm run dev
```

`npm run build` outputs a static site in `dist/`. On Vercel, the `api/` folder deploys as serverless functions automatically; no settings needed.

## Add pictures

Drop images in `public/img/projects/` and list them in the project's `images` in `src/data/projects.js`:

```js
images: [
  ['projects/migaku-home.png', 'The lab index'],
],
```

Keys with an extension (`.png`, `.jpg`, `.webp`) are used as-is. MiGaKu Labs currently uses screenshots captured from the live site (`projects/migaku1`–`migaku6`); replace them whenever you like.

## Built with

Vite, GSAP (ScrollTrigger, SplitText, Flip), Lenis, Geist, Instrument Serif, raw WebGL2 and a lot of AI.
