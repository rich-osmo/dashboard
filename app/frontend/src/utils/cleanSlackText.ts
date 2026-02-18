/**
 * Clean Slack markup from message text for display.
 *
 * Handles:
 *  - <@U12345|name> → @name
 *  - <@U12345>      → @user (stripped)
 *  - <#C12345|name>  → #name
 *  - <#C12345>       → #channel
 *  - <url|label>     → label
 *  - <url>           → url (cleaned)
 *  - <!subteam^...|@handle> → @handle
 *  - <!here>, <!channel>, <!everyone> → @here, @channel, @everyone
 *  - HTML entities: &amp; &lt; &gt;
 */
export function cleanSlackText(text: string): string {
  return text
    // User mentions: <@U12345|name> → @name
    .replace(/<@U[A-Z0-9]+\|([^>]+)>/g, '@$1')
    // User mentions without name: <@U12345> → (remove)
    .replace(/<@U[A-Z0-9]+>/g, '')
    // Channel refs: <#C12345|name> → #name
    .replace(/<#C[A-Z0-9]+\|([^>]+)>/g, '#$1')
    // Channel refs without name: <#C12345> → (remove)
    .replace(/<#C[A-Z0-9]+>/g, '')
    // Subteam/usergroup: <!subteam^...|@handle> → @handle
    .replace(/<!subteam\^[A-Z0-9]+\|([^>]+)>/g, '$1')
    // Special mentions: <!here>, <!channel>, <!everyone>
    .replace(/<!here>/g, '@here')
    .replace(/<!channel>/g, '@channel')
    .replace(/<!everyone>/g, '@everyone')
    // URLs with label: <http://url|label> → label
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2')
    // URLs without label: <http://url> → url
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    // Catch-all: any remaining <...> tags
    .replace(/<[^>]+>/g, '')
    // HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Clean up extra whitespace from removed tags
    .replace(/\s{2,}/g, ' ')
    .trim();
}
