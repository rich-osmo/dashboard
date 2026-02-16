import type { Employee } from '../api/types';

export function detectEmployees(
  text: string,
  employees: Employee[]
): { employees: Employee[]; isOneOnOne: boolean } {
  const matched: Employee[] = [];
  const seen = new Set<string>();

  // Find all explicit @mentions (global search)
  const mentionRegex = /@(\w+)(?:\s+(\w+))?/g;
  let mentionMatch;
  while ((mentionMatch = mentionRegex.exec(text)) !== null) {
    const firstName = mentionMatch[1].trim().toLowerCase();
    const secondWord = mentionMatch[2]?.trim().toLowerCase();
    const fullQuery = secondWord ? `${firstName} ${secondWord}` : null;
    const found = employees.find((e) => {
      if (seen.has(e.id)) return false;
      const name = e.name.toLowerCase();
      if (fullQuery && (name === fullQuery || name.includes(fullQuery))) return true;
      return name.split(' ')[0] === firstName;
    });
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
      /(\w[\w\s]*?)(?:'s)?\s+1[:\-]1/i,
      /1[:\-]1 with (\w[\w\s]*)/i,
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

  const isOneOnOne = /1[:\-]1|follow.?up|bring.?up|discuss|talk to/i.test(text);
  return { employees: matched, isOneOnOne: matched.length > 0 && isOneOnOne };
}
