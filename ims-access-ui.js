// Legacy compatibility tombstone.
// Current IMS builds no longer use this module. This file intentionally does nothing
// so older cached clients requesting the former path do not generate a 404 while
// they refresh to the current module loader.
console.info('IMS legacy access UI shim loaded; refresh to the current IMS build.');
