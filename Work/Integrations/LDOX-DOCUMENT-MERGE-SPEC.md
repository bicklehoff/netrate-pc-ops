# LDox Document Merge Spec

**Status:** Draft
**Author:** PC-Dev (with David)
**Date:** 2026-03-11
**Scope:** How the portal decides to merge, skip, or create when an LDox document arrives

---

## The Problem

When LDox pushes document data to our portal (via Corebot ingest or future file sync), we need to answer:

1. **Is this the same file we already have?** (exact duplicate — skip it)
2. **Is this a newer version of something we have?** (update/replace)
3. **Is this a second document of the same type?** (e.g., 2nd bank statement, 2nd pay stub — keep both)
4. **Is this brand new?** (create fresh)

Today: every ingest creates a new Document record with no dedup. This will cause duplicates as LDox syncs run repeatedly.

---

## Current State

### What We Have
- `Document` model with: `loanId`, `docType`, `label`, `fileName`, `fileSize`, `fileUrl`, `status`, timestamps
- `Loan.ldoxLoanId` — unique link to LDox loan (primary merge key for loans)
- No file hash, no content fingerprint, no version tracking on documents
- WorkDrive stores files in subfolders (SUBMITTED, EXTRA, CLOSING) — overwrites by filename

### What LDox Gives Us (per document)
- Document type / category
- File name
- File content (binary)
- Loan reference (LDox loan ID)
- Borrower reference
- Upload/creation timestamp from LDox
- Possibly: LDox document ID (unique within their system)

---

## Proposed Matching Strategy

### Step 0: Anchor to Loan
Every incoming document must resolve to a loan first (using existing `ldoxLoanId` match). If no loan match, reject the document — don't create orphans.

### Step 1: Compute File Fingerprint
On every incoming file, compute:
```
sha256 = SHA-256 hash of file content (binary)
```

Add to Document model:
```prisma
fileHash    String?   @map("file_hash")     // SHA-256 of file content
ldoxDocId   String?   @map("ldox_doc_id")   // LDox's unique document ID
ldoxSyncAt  DateTime? @map("ldox_sync_at")  // When this was last synced from LDox
```

### Step 2: Match Cascade

Run these checks **in order** for each incoming document against the target loan's existing documents:

| Priority | Match Type | Signals | Result |
|----------|-----------|---------|--------|
| 1 | **LDox Doc ID match** | `ldoxDocId` matches existing record | **Update metadata** (status, timestamps). If file hash also matches → skip file upload. If hash differs → replace file (newer version). |
| 2 | **Exact content match** | `fileHash` matches any existing doc on same loan | **Skip entirely** — exact duplicate. Log it. |
| 3 | **Same type + similar name** | Same `docType` + filename similarity > 80% (Levenshtein or normalized) | **Likely updated version** → flag for review, don't auto-merge. |
| 4 | **Same type + different name** | Same `docType` but different filename, different hash | **Second document of same type** → create new record. (e.g., Jan pay stub vs Feb pay stub, or Chase statement vs BofA statement) |
| 5 | **No match** | No docType match, no hash match, no ID match | **Brand new document** → create new record. |

### Decision Matrix

```
                    Same ldoxDocId?
                   /              \
                 YES               NO
                  |                 |
            Same hash?        Same hash?
           /         \       /         \
         YES         NO    YES         NO
          |           |      |           |
        SKIP      REPLACE  SKIP     Same docType?
      (no-op)    (new ver) (dup)    /           \
                                  YES            NO
                                   |              |
                              Flag for        CREATE
                              review*          (new)

* "Flag for review" = create record but mark with
  `mergeAction: 'review'` so MLO can decide if it's
  an update or a second doc of same type
```

---

## Merge Actions

Each incoming document gets assigned a `mergeAction` before processing:

| Action | Meaning | What Happens |
|--------|---------|--------------|
| `skip` | Exact duplicate, already have it | Log only. No DB write. No file upload. |
| `replace` | Same LDox doc, new content | Update existing record's `fileUrl`, `fileHash`, `fileSize`, `fileName`, `ldoxSyncAt`. Upload new file to storage. |
| `create` | New document, no match | Create new Document record. Upload file. |
| `review` | Ambiguous — same type, different file | Create new Document record with `status: 'uploaded'` and a note: "Auto-imported from LDox — may be an update to [existing doc label]". MLO decides. |

---

## Schema Changes

```prisma
model Document {
  // ... existing fields ...

  // New: LDox integration
  fileHash    String?   @map("file_hash")       // SHA-256 of content
  ldoxDocId   String?   @map("ldox_doc_id")     // LDox unique doc ID
  ldoxSyncAt  DateTime? @map("ldox_sync_at")    // Last sync timestamp
  supersededBy String?  @map("superseded_by") @db.Uuid  // Points to newer version

  @@index([loanId, fileHash])          // Fast hash lookup per loan
  @@index([ldoxDocId])                 // Fast LDox ID lookup
  @@index([loanId, docType])           // Fast type grouping
}
```

`supersededBy` enables version chains: when a document is replaced, the old record points to the new one instead of being deleted. This preserves audit history.

---

## Implementation Notes

### File Hash Computation
```javascript
import { createHash } from 'crypto';

function computeFileHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}
```

Hash the raw file bytes **before** uploading to storage. Store the hash on the Document record. This is the single source of truth for "is this the same file."

### Filename Similarity (for Priority 3)
Don't overthink this. Normalize both filenames:
1. Strip extension
2. Lowercase
3. Replace separators (`-`, `_`, `.`, spaces) with single space
4. Compare with basic similarity ratio

```
"Flores_PayStub_Jan2026.pdf"  → "flores paystub jan2026"
"Flores_PayStub_Feb2026.pdf"  → "flores paystub feb2026"
→ High similarity, same docType → flag for review (probably 2 different stubs)

"Flores_PayStub_Jan2026.pdf"  → "flores paystub jan2026"
"Flores_PayStub_Jan2026 (1).pdf" → "flores paystub jan2026 1"
→ High similarity + same docType → check hash. If same hash → skip (browser dup). If different → flag.
```

### WorkDrive Collision
WorkDrive uploads with `override: true` replace files with the same name in the same folder. This is already the behavior. The Document record should reflect the latest file URL. If we're keeping version history (via `supersededBy`), don't override — upload with a versioned filename:
```
Flores_PayStub_Jan2026.pdf         (v1)
Flores_PayStub_Jan2026_v2.pdf      (v2, after replace)
```

Or: let WorkDrive override the file but keep the Document chain in our DB for audit.

### Sync Direction
This spec covers **LDox → Portal** (ingest direction). We are NOT pushing documents back to LDox. The portal is the system of record for document status (requested/uploaded/reviewed/accepted/rejected).

---

## Edge Cases

### Same Borrower, Multiple Loans
A borrower might have 2 loans (purchase + refi, or consecutive loans). Documents are always scoped to a loan via `loanId`. Same file appearing on 2 different loans = 2 separate Document records (correct behavior, not a duplicate).

### Borrower Uploads Same File Twice
Borrower uploads via portal → already handled today (creates 2 records). With hash check, we can catch this:
- If hash matches existing doc on same loan with status `uploaded` or `accepted` → warn borrower "This file was already uploaded" instead of creating a duplicate.

### LDox Re-Syncs
LDox may re-send the entire loan file during status changes. The `ldoxDocId` match (Priority 1) handles this — if the doc ID matches and the hash matches, skip entirely. No churn.

### Document Was Rejected, Borrower Re-Uploads
Different file (new hash) for the same doc request. This is a `create` — new Document record linked to same Condition if applicable. The rejected record stays for audit trail.

### Large Files / Timeouts
Hash computation happens on the file buffer in memory before upload. For the max 25 MB file, SHA-256 is ~instant. No concern here.

---

## Priority / Sequencing

1. **Add `fileHash`, `ldoxDocId`, `ldoxSyncAt` columns** — migration, backfill hash for existing files (fetch from storage + compute)
2. **Compute hash on all new uploads** — both borrower and MLO routes
3. **Add exact-dup check (hash match)** — prevents the most common duplicate: same file uploaded twice
4. **Add LDox doc ID tracking** — when Corebot ingest includes doc data, store the ID
5. **Build full merge cascade** — Priority 1-5 checks during LDox document sync
6. **Add `supersededBy` for version tracking** — nice-to-have, enables "show me previous versions"

Steps 1-3 are quick wins that prevent 90% of duplicates. Steps 4-6 are the full LDox integration.

---

## Open Questions for David

- [ ] Does LDox expose a unique document ID per file? (If yes, Priority 1 match is reliable. If no, we fall back to hash + type matching.)
- [ ] Should replaced/superseded documents be visible to the borrower, or MLO-only?
- [ ] When a "review" merge action is flagged, where should the MLO see it? (Documents section badge? Pipeline notification?)
- [ ] Do we want to backfill hashes for all existing documents in storage, or only hash going forward?
