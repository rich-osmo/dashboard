export interface ParsedIssue {
  isIssue: boolean;
  title: string;
  tshirtSize: string;
  priority: number;
}

/**
 * Parse [i][size][priority] prefix from text.
 * Tags can appear in any order after [i]. Examples:
 *   [i][s][p0] Important but small
 *   [i][l][p2] Large issue lower priority
 *   [i] Just an issue with defaults
 */
export function parseIssuePrefix(text: string): ParsedIssue {
  if (!text.match(/^\[i\]/i)) {
    return { isIssue: false, title: text, tshirtSize: 'm', priority: 1 };
  }

  let remaining = text;
  let tshirtSize = 'm';
  let priority = 1;

  const prefixRegex = /^\[(i|s|m|l|xl|p0|p1|p2|p3)\]\s*/i;

  while (prefixRegex.test(remaining)) {
    const match = remaining.match(prefixRegex)!;
    const tag = match[1].toLowerCase();

    if (['s', 'm', 'l', 'xl'].includes(tag)) {
      tshirtSize = tag;
    } else if (tag.startsWith('p')) {
      priority = parseInt(tag[1]);
    }

    remaining = remaining.slice(match[0].length);
  }

  return { isIssue: true, title: remaining.trim(), tshirtSize, priority };
}
