# Bag-Builder01

3-D cornhole bag design builder. One shared package: the bag shape, the flat-fabric editor and the live 3D preview.
It runs as a standalone page, and the same code is meant to be dropped into manufacturer apps and websites.

## How it works

The bag skin is one flat fabric square (7.5 x 7.5 in, bleed included). Every spot on the 3D bag has a place in that
square, laid out like unfolded fabric, so the shoulder roll and wall are not stretched. The customer places an image in
the square (move, zoom, turn); the 3D bag shows the result live. Top and bottom each have their own square.

Guides in the editor:

- Cut edge (gold dashed): the 7.5 in square. Art must reach every edge.
- Seam line (white): about 6.5 in across. Everything inside it shows on the bag.
- Safe zone (teal dotted): 6 in. Keep text and logos inside. Change it with `safeIn`.

## The bag shape

Each panel has a slightly crowned top (about 1.5 mm), then a rounded edge that tapers in to the seam, so the end reads as a
half dome rather than a bull nose. The edge rings sit an even distance in from the seam outline all the way round, so the edge
cross section is the same at every angle. The seam crease tucks in 0.016 in, and the front edge has a pinch with a zigzag
stitch. Tune it in `DEFAULTS` in `src/core/shape.js`: `endBlend` (0 = round dome, 1 = fully tapered), `taperStartIn`,
`taperPower`, `crownIn`, `pinchDepthIn`, `seamGapIn`.

## Layout

- `src/core/shape.js` bag geometry and flat-fabric layout. No browser code, so it is testable in node.
- `src/editor/` the flat editor (guides, touch gestures), image placement, built-in test images and fabric looks.
- `src/preview/BagPreview.js` the three.js 3D bag.
- `src/index.js` `createBagBuilder(container, options)`, the one entry point other apps call.
- `src/main.js` the standalone page.

## Commands

- `npm install`
- `npm run dev` local dev server
- `npm run build` standalone page into `dist/`
- `npm run build:lib` embeddable script and stylesheet into `dist-lib/` (`window.BagBuilder.createBagBuilder`)
- `npm test` geometry checks

## Using it in another app

```html
<link rel="stylesheet" href="bag-builder.css">
<div id="builder"></div>
<script src="bag-builder.js"></script>
<script>
  BagBuilder.createBagBuilder(document.getElementById('builder'), {
    safeIn: 6,
    onSave: ({ top, bottom }) => { /* two 300 dpi PNG blobs of the flat fabric */ }
  });
</script>
```

Hosting: build on Cloudflare (build command `npm run build`, output `dist`). The repo is private, so GitHub Pages is not used.

## The phone layout

One screen, built for a phone. Top to bottom:

- 3D bag (live), then the flat art with the cut edge, seam line and safe area drawn on it.
- Left rail: both views, 3D only (with a small flat picture in the corner), flat only.
- Step strip: Upload, Adjust, Fabric, Review. Each step shows the current choice under its name.
- Upload opens a sheet: Photo library, Take photo, Files, plus a test design.
- No bottom bar. The Review step has the summary and a Submit button. Pass `onSave` to hand the two images to the host app when Submit is pressed.
- Logo step edit strip: Size and Rotate sliders for the selected logo, series name or stamp, plus Remove. Brand logo and series name also get Auto color (src/editor/autocolor.js), which steps through five colorways picked from the art behind the logo, then back to the original.

Options: `title`, `start` (fabric names for each side), `safeIn`, `cutIn`, `onChange`, `onSave`.

### Series and the two paths
The first step picks a series. Carpet series (Power Draggin', XTRA, Double Draggin' X) print one side and add a Slow side color step, which flips the bag to its bottom. Double Fast series (WGCB) print both sides: the Image step has Image 1 (Top) and Image 2 (Bottom). Pass `options.series` to change the list. Each item has a name and a speed shown after a dash.

- Header holds the view buttons (both, 3D only, flat only) and Reset. The flip button is a small icon square in the corner of the 3D window.
- Step sizing: Logo and Review keep the full tools panel (original sizing). Series, Image, Adjust and Slow side use a shorter panel so the 3D bag and flat art are bigger (expanded sizing). On the Logo step an arrow in the flat window folds the tools away to enlarge the viewing area, and flips to bring them back.
