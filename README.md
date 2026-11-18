# Bag-Builder01

3-D cornhole bag design builder. One shared package: the bag shape, the flat-fabric editor and the live 3D preview.
It runs as a standalone page, and the same code is meant to be dropped into manufacturer apps and websites.

## How it works

The bag skin is one flat fabric square (7.5 x 7.5 in, bleed included). Every spot on the 3D bag has a place in that
square, laid out like unfolded fabric, so the shoulder roll and wall are not stretched. The customer places an image in
the square (move, zoom, turn); the 3D bag shows the result live. Top and bottom each have their own square.

Guides in the editor:

- Cut edge (gold dashed): the 7.5 in square. Art must reach every edge.
- Seam line (white): about 6.67 in across. Everything inside it shows on the bag.
- Safe zone (teal dotted): 6 in. Keep text and logos inside. Change it with `safeIn`.

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
