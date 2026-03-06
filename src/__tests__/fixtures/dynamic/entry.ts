export async function loadLazy() {
  const lazy = await import('./lazy');
  return lazy;
}
