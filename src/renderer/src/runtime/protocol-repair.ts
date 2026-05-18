/**
 * Best-effort repair for malformed HRP tags emitted by the LLM.
 * Example: `<emotion happy>` → `<emotion value="happy" />`.
 * Real impl in iteration-005.
 */
export function repairTag(raw: string): string {
  // TODO(iteration-005): implement real repair rules.
  return raw
}
