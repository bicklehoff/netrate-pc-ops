---
name: fetch-fed-statement
description: "Fetch and cache the latest FOMC statement from the Federal Reserve website. Use when a new Fed statement is released after an FOMC meeting, when the user says 'fetch fed statement', 'update fed statement', 'new FOMC', or when a scheduled task triggers after a meeting date."
---

# Fetch Fed Statement

Scrape the latest FOMC press release from federalreserve.gov, parse it into paragraphs, cache it in the database, and trigger a diff against the previous statement.

## Working Directory

`D:\PROJECTS\netrate-pc-ops`

## When to Run

After each FOMC meeting when the statement is released (typically 2:00 PM ET on the last day of the meeting). 2026 meeting end dates:

| Meeting | Statement Date | URL Suffix |
|---------|---------------|------------|
| Jan 27-28 | 2026-01-28 | monetary20260128a.htm |
| Mar 17-18 | 2026-03-18 | monetary20260318a.htm |
| Apr 28-29 | 2026-04-29 | monetary20260429a.htm |
| Jun 16-17 | 2026-06-17 | monetary20260617a.htm |
| Jul 28-29 | 2026-07-29 | monetary20260729a.htm |
| Sep 15-16 | 2026-09-16 | monetary20260916a.htm |
| Oct 27-28 | 2026-10-28 | monetary20261028a.htm |
| Dec 8-9 | 2026-12-09 | monetary20261209a.htm |

## Steps

1. **Determine which statement to fetch**
   - Check the FOMC meeting schedule above
   - If triggered by schedule, use the meeting date from the task
   - If manual, use the most recent past meeting date

2. **Fetch the statement HTML**
   ```
   URL: https://www.federalreserve.gov/newsevents/pressreleases/monetary{YYYYMMDD}a.htm
   ```
   - Use fetch with 15s timeout
   - User-Agent: "NetRate Mortgage Rate Watch (educational)"
   - If 404, the statement hasn't been published yet — retry later

3. **Parse the HTML**
   - Extract `<p>` tags from the page
   - Stop at "Voting for the monetary policy action" or "Voting for this action"
   - Skip metadata lines: "For immediate release", date lines, lines < 30 chars
   - Strip inner HTML tags, normalize whitespace
   - Result: array of paragraph strings

4. **Cache in database**
   ```
   Table: fomc_statements
   Fields: meeting_date (unique), statement_url, statement_text, paragraphs (JSON), scraped_at
   ```
   - Upsert by meeting_date (safe to re-run)

5. **Verify the diff works**
   - Hit `GET /api/fomc/statements` to confirm both current and previous statements are cached
   - Check that the diff renders correctly
   - The API auto-computes the word-level diff between the two most recent statements

6. **Report**
   - Log: meeting date, paragraph count, cache status
   - If this is a new statement (not previously cached), send a relay to notify David:
     ```
     send_relay(from="pc", to="dave", type="info", content="New FOMC statement cached: {date}. Rate Watch page updated with statement diff.")
     ```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/fomc-diff.js` | Meeting dates, URL builder, HTML parser, diff engine |
| `src/app/api/fomc/statements/route.js` | API route — fetches, caches, returns diff |
| `src/components/RateWatch/FedStatementDiff.js` | Display component on Rate Watch page |
| `prisma/schema.prisma` | FomcStatement model |

## Troubleshooting

- **404 from Fed website**: Statement not yet published. Wait and retry. Statements are released at 2:00 PM ET on meeting day.
- **0 paragraphs parsed**: Fed may have changed HTML structure. Inspect the raw HTML and update `parseStatementHtml()` in `fomc-diff.js`.
- **Diff looks wrong**: Check that both statements are parsing correctly. Compare `paragraphs` JSON in the database against the actual statement text.
- **DB error**: Ensure `PC_DATABASE_URL` is set. Run `npx prisma db push` if schema is out of sync.

## Manual Trigger

To manually fetch and cache a specific statement:
```bash
curl "https://www.netratemortgage.com/api/fomc/statements"
```
This triggers the fetch-and-cache flow for the two most recent meetings automatically.
