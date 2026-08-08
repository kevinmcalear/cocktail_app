/** Decide whether URL hydration should reset the Creator Hub stack. */

export type StackNode = { id: string; type: string };

/**
 * URL is the sidebar/root selection. Nested in-app frames must survive when
 * the URL still points at the stack root (or the current top).
 */
export function shouldKeepCreatorStack(
  urlType: string,
  urlId: string,
  stack: StackNode[]
): boolean {
  if (stack.length === 0) return false;
  const top = stack[stack.length - 1];
  if (top.id === urlId && top.type === urlType) return true;
  const root = stack[0];
  return root.id === urlId && root.type === urlType;
}
