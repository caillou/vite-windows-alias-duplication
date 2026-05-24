import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// No plugins. The `@shared/*` alias is resolved by Vite 8 / Rolldown's OWN
// native tsconfig-path resolution (it auto-discovers tsconfig.json and applies
// `compilerOptions.paths`). `resolve.tsconfigPaths` is left at its default
// (`false`) — that default is exactly what triggers the Windows duplication.
export default defineConfig({
  build: {
    target: 'esnext',
    minify: false,
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
  },
});
