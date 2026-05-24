// The same physical file (src/shared/index.js) is imported through two
// specifiers that resolve to it: a relative path and a tsconfig path alias.
// On Windows, Vite 8 / Rolldown's native tsconfig-path resolution emits the
// alias id with back-slashes while the relative id uses forward-slashes, so
// the module graph keys them separately and the file is bundled twice.
import { TOKEN as viaRelative } from './shared';
import { TOKEN as viaAlias } from '@shared/index';

if (viaRelative !== viaAlias) {
  console.error('DUPLICATED: shared module bundled more than once.');
  console.error('  viaRelative:', viaRelative.toString());
  console.error('  viaAlias   :', viaAlias.toString());
  process.exit(1);
}
console.log('OK: single shared module instance (viaRelative === viaAlias).');
