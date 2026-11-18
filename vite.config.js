import { defineConfig } from 'vite';

// `npm run build`      -> standalone web app in dist/
// `npm run build:lib`  -> embeddable script + stylesheet in dist-lib/
//                         (window.BagBuilder.createBagBuilder(el, options))
export default defineConfig(({ mode }) => {
  if (mode === 'lib') {
    return {
      build: {
        outDir: 'dist-lib',
        emptyOutDir: true,
        cssCodeSplit: false,
        lib: {
          entry: 'src/index.js',
          name: 'BagBuilder',
          formats: ['iife'],
          fileName: () => 'bag-builder.js',
          cssFileName: 'bag-builder'
        }
      }
    };
  }
  return { base: './', build: { outDir: 'dist', emptyOutDir: true } };
});
