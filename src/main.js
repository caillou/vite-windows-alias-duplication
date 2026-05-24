import { TOKEN as viaRelative } from './importerRelative';
import { TOKEN as viaAlias } from './importerAlias';

if (viaRelative !== viaAlias) {
  console.error('DUPLICATED: shared module bundled more than once.');
  console.error('  viaRelative:', viaRelative.toString());
  console.error('  viaAlias   :', viaAlias.toString());
  process.exit(1);
}
console.log('OK: single shared module instance (viaRelative === viaAlias).');
