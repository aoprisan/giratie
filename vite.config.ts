import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';

// Emits one self-contained dist/index.html, deployable as-is to GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
});
