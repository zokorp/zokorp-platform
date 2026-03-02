# Validator Reference Downloads

This folder stores locally downloaded checklist/calibration reference pages derived from:

- `data/validator/library/**/*-link.txt`

## What is in here

- `manifest.json`: full run output with URL, status, and local file path.
- `files/`: downloaded reference files (ignored by git).

## Current result snapshot

- `300` references downloaded successfully.
- `35` references failed with network errors (likely access/network restrictions or gated portals).
- Downloaded files are currently HTML pages, not PDFs/XLSX files.

## Regenerate

Run:

```bash
python3 scripts/download_validator_references.py --workers 10 --timeout 12
```

## Notes

- Some AWS/Partner Central links are gated and cannot be fetched anonymously.
- If you want these references publicly available later, use only links/files you are authorized to redistribute.
