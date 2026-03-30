import { diffWords } from 'diff';

// 2026 FOMC meeting end dates (when statements are released)
export const FOMC_MEETINGS_2026 = [
  '2026-01-28',
  '2026-03-18',
  '2026-04-29',
  '2026-06-17',
  '2026-07-29',
  '2026-09-16',
  '2026-10-28',
  '2026-12-09',
];

// Build statement URL from meeting date
export function statementUrl(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `https://www.federalreserve.gov/newsevents/pressreleases/monetary${yyyy}${mm}${dd}a.htm`;
}

// Get the two most recent meetings that have already happened
export function getRecentMeetings() {
  const today = new Date().toISOString().split('T')[0];
  const past = FOMC_MEETINGS_2026.filter(d => d <= today);
  if (past.length < 2) return null;
  return {
    current: past[past.length - 1],
    previous: past[past.length - 2],
  };
}

// Parse FOMC statement HTML into paragraph strings
export function parseStatementHtml(html) {
  // Remove newlines and normalize whitespace
  const clean = html.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');

  // Narrow to the article content area — Fed uses <div id="article"> or col-xs-12 col-sm-8
  let content = clean;
  const articleMatch = clean.match(/<div[^>]*id="article"[^>]*>(.*)/i);
  if (articleMatch) {
    content = articleMatch[1];
  } else {
    // Fallback: find the content column
    const colMatch = clean.match(/<div[^>]*class="[^"]*col-xs-12 col-sm-8[^"]*"[^>]*>(.*)/i);
    if (colMatch) content = colMatch[1];
  }

  // Extract paragraphs — Fed uses <p> tags for statement content
  const paragraphs = [];
  const pRegex = /<p[^>]*>(.*?)<\/p>/gi;
  let match;
  while ((match = pRegex.exec(content)) !== null) {
    // Strip HTML tags from within paragraphs
    let text = match[1].replace(/<[^>]+>/g, '').trim();
    // Decode HTML entities
    text = text.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
    if (!text) continue;

    // Stop at voting record
    if (text.startsWith('Voting for the monetary policy action')
      || text.startsWith('Voting for this action')
      || text.startsWith('For release at')) continue;

    // Skip metadata lines
    if (text.match(/^(For immediate release|Release Date|Last Update|Implementation Note)/i)) continue;
    if (text.match(/^\w+ \d{1,2}, \d{4}$/)) continue;

    // Skip government banner / nav text
    if (text.match(/official website|\.gov website|United States Government|HTTPSA? lock|padlock icon/i)) continue;

    // Skip very short lines that are likely headers/links
    if (text.length < 30) continue;

    paragraphs.push(text);
  }

  return paragraphs;
}

// Compute word-level diff between two statements
export function diffStatements(previousParagraphs, currentParagraphs) {
  const previousText = previousParagraphs.join('\n\n');
  const currentText = currentParagraphs.join('\n\n');

  const changes = diffWords(previousText, currentText);

  // Map to our format
  return changes.map(part => ({
    type: part.added ? 'added' : part.removed ? 'removed' : 'equal',
    text: part.value,
  }));
}
