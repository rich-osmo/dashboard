import type { Person } from '../api/types';

// Detect @mentions and natural language references to people in text
export function detectEmployees(
  text: string,
  employees: Person[]
): { employees: Person[]; isOneOnOne: boolean } {
  const matched: Person[] = [];
  const seen = new Set<string>();

  // Find all explicit @mentions (global search)
  const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
  let mentionMatch;
  while ((mentionMatch = mentionRegex.exec(text)) !== null) {
    const query = mentionMatch[1].trim().toLowerCase();
    const parts = query.split(/\s+/);
    const firstName = parts[0];
    const hasLastName = parts.length > 1;

    // Try full name match first, then fall back to first-name-only
    let found = employees.find((e) => {
      if (seen.has(e.id)) return false;
      const name = e.name.toLowerCase();
      if (hasLastName && (name === query || name.startsWith(query))) return true;
      return false;
    });
    if (!found) {
      found = employees.find((e) => {
        if (seen.has(e.id)) return false;
        return e.name.toLowerCase().split(' ')[0] === firstName;
      }) ?? null;
      // If first-name match consumed a last name token, rewind the regex
      if (found && hasLastName) {
        mentionRegex.lastIndex = mentionMatch.index + 1 + firstName.length;
      }
    }
    if (found) {
      matched.push(found);
      seen.add(found.id);
    }
  }

  // If no @mentions found, fall back to natural language patterns (single match)
  if (matched.length === 0) {
    const patterns = [
      /follow up with (\w[\w\s]*)/i,
      /ask (\w[\w\s]*?) about/i,
      /discuss with (\w[\w\s]*)/i,
      /(\w[\w\s]*?)(?:'s)?\s+1[:-]1/i,
      /1[:-]1 with (\w[\w\s]*)/i,
      /bring up (?:with |to )(\w[\w\s]*)/i,
      /talk to (\w[\w\s]*)/i,
      /tell (\w[\w\s]*?) (?:about|to|that)/i,
      /remind (\w[\w\s]*?) (?:about|to)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const nameQuery = match[1].trim().toLowerCase();
        const found = employees.find(
          (e) =>
            e.name.toLowerCase().includes(nameQuery) ||
            e.name.toLowerCase().split(' ')[0] === nameQuery
        );
        if (found) {
          matched.push(found);
          break;
        }
      }
    }
  }

  const isOneOnOne = /1[:-]1|follow.?up|bring.?up|discuss|talk to/i.test(text);
  return { employees: matched, isOneOnOne: matched.length > 0 && isOneOnOne };
}
