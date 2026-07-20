export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest("button, input, select, textarea, a[href], [contenteditable='true']"),
  );
}
