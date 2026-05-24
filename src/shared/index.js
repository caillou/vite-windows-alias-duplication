// Module-level singleton. If this module is instantiated more than once,
// there will be more than one TOKEN and they will not be ===.
export const TOKEN = Symbol('shared-singleton');
