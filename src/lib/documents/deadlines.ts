// Bounded lexical evidence shared by the two saved-insight views. Recognize
// wording only: do not calculate a due date, a starting event or legal effects.
const fold = (text: string) => text.normalize("NFKC").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
const date = String.raw`(?:\d{4}-\d{2}-\d{2}\b|\d{1,2}\.\s*\d{1,2}\.(?:\s*\d{4}\b)?|\d{1,2}\.?\s+(?:ledna|unora|brezna|dubna|kvetna|cervna|cervence|srpna|zari|rijna|listopadu|prosince)\b)`;
const absoluteDeadline = new RegExp(String.raw`\bdo\s+${date}`);

export function hasExplicitRequest(text: string): boolean {
  return /\b(?:doloz\w*|dopln\w*|predloz\w*|dodat|dodani|dodej\w*|poskyt\w*|pozadavek|pozaduj\w*|vyzyvame|musite|povinnost)\b/.test(fold(text));
}

export function hasExplicitResponseDeadline(text: string): boolean {
  const normalized = fold(text);
  return /\blhut(?:a|y|u|e|ou)\b|\btermin (?:reakce|odpovedi|doplneni|dodani|predlozeni)\b|\bnejpozdeji\b/.test(normalized) ||
    absoluteDeadline.test(normalized) ||
    // "do 10 osob" is a quantity, not temporal evidence. Relative durations
    // require an explicit request, just as in the existing Journal rules.
    (hasExplicitRequest(normalized) && /\bdo\s+\d+\s+(?:pracovnich\s+)?(?:dnu|dne|dni|tydnu|tydne|tydny|mesicu|mesice|hodin|hodiny)\b/.test(normalized));
}
