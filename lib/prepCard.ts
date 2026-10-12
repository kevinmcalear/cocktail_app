export interface PrepCardInput {
  name: string;
  /** "Makes 1.1 L", "Keeps 8 weeks": the fact tiles, as label and value. */
  facts: { label: string; value: string }[];
  lines: { amount: string; name: string }[];
  steps: string[];
}

/** A prep's card as plain text: name, facts, recipe lines, numbered steps. For the fridge or the binder. */
export function prepCardText({ name, facts, lines, steps }: PrepCardInput): string {
  const out = [name.toUpperCase()];
  if (facts.length) out.push(facts.map((f) => `${f.label} ${f.value}`).join(' · '));
  if (lines.length) out.push('', ...lines.map((l) => `${l.amount ? `${l.amount}  ` : ''}${l.name}`));
  if (steps.length) out.push('', ...steps.map((s, i) => `${i + 1}. ${s}`));
  return out.join('\n');
}
