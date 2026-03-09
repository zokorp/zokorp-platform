# Architecture Review Pricing Matrix

Canonical implementation sources:

- `lib/architecture-review/engine.ts`
- `lib/architecture-review/quote.ts`
- `lib/architecture-review/pricing-catalog.ts`
- `lib/architecture-review/email.ts`

## How the Architecture Reviewer prices work

1. The reviewer generates deterministic findings from the uploaded diagram evidence and narrative.
2. Each finding has a `pointsDeducted` value and a deterministic `fixCostUSD`.
3. `fixCostUSD` is not a direct invoice line by itself. It is a scope driver used to build the core quote.
4. The core quote starts from a $249 advisory baseline and then applies score-band caps, confidence adjustments, workload criticality, and engagement-preference rules.
5. Low-confidence or partner-led requests intentionally stay diagnostic-first rather than pretending a large fixed remediation quote is approved.

## Package-level pricing posture

| Tier | Current pricing logic | What it represents |
| --- | --- | --- |
| `advisory-review` | Fixed at `$249` | 45-minute review call to prioritize findings, sequence fixes, and assign owners. |
| `remediation-sprint` | Email range is `0.9x-1.2x` of the deterministic core quote, clamped to `$650-$2,200` low and `$850-$2,800` high | Hands-on fix package for the highest-impact deductions with updated architecture artifacts. |
| `implementation-partner` | `Custom` | Broader redesign and execution support. The core quote can still stay at the diagnostic baseline when the engagement preference says the next step should be scoping first. |

## Quote-behavior notes

- `review-call-only` always forces the core quote to `$249`.
- `ongoing-quarterly-reviews` and `architect-on-call` also keep the core quote at the advisory baseline even when the recommended tier becomes `implementation-partner`.
- If confidence drops below `0.85`, the core quote falls back to a diagnostic-first price (`$450` by default with the current hourly-rate setting).
- Optional findings stay at `0` points and `$0` fix effort.
- `INPUT-NOT-ARCH-DIAGRAM` is a rejection path. It does not produce a customer quote.

## Finding-to-Service Matrix

| Rule ID | Category | Service line | Trigger | Points logic | Fix-cost contribution | Quote impact |
| --- | --- | --- | --- | --- | --- | --- |
| `MSFT-META-TITLE` | `clarity` | Architecture metadata cleanup | Title metadata missing | Fixed `3` points | `$30` | Included |
| `MSFT-META-OWNER` | `clarity` | Ownership and operating-contact cleanup | Owner metadata missing | Fixed `3` points | `$30` | Included |
| `MSFT-META-LAST-UPDATED` | `clarity` | Review-date hygiene | Last-reviewed metadata missing | Fixed `3` points | `$30` | Included |
| `MSFT-META-VERSION` | `clarity` | Version-control hygiene | Version metadata missing | Fixed `3` points | `$30` | Included |
| `PILLAR-SECURITY` | `security` | Security control mapping | No usable identity, secrets, or encryption controls described | Fixed `12` points | `$237` | Included |
| `PILLAR-RELIABILITY` | `reliability` | Reliability and recovery planning | No usable redundancy, backup/restore, or DR controls described | Fixed `10` points | `$271` | Included |
| `PILLAR-OPERATIONS` | `operations` | Observability and runbook setup | No usable monitoring, alerting, or runbook ownership described | Fixed `8` points | `$168` | Included |
| `PILLAR-PERFORMANCE` | `performance` | Performance and scalability review | No usable caching, load-balancing, or scaling controls described | Fixed `6` points | `$150` | Included |
| `PILLAR-COST` | `cost` | Cost guardrail review | No usable rightsizing, autoscaling-bound, or budget-control language described | Fixed `6` points | `$113` | Included |
| `PILLAR-SECURITY-DEPTH` | `security` | Security control depth expansion | Only one security signal is present | Fixed `6` points | `$189` | Included |
| `PILLAR-RELIABILITY-DEPTH` | `reliability` | Recovery-detail expansion | Only one reliability signal is present | Fixed `5` points | `$232` | Included |
| `PILLAR-OPERATIONS-DEPTH` | `operations` | Observability-depth expansion | Only one operations signal is present | Fixed `4` points | `$158` | Included |
| `PILLAR-SUSTAINABILITY-OPTIONAL` | `sustainability` | Optional sustainability guidance | No sustainability signals found | Always `0` points | `$0` | Optional only |
| `CLAR-OFFICIAL-REFERENCE-PATTERN` | `clarity` | Reference-architecture calibration | Official reference pattern detected and penalties softened | Always `0` points | `$0` | Optional only |
| `INPUT-NOT-ARCH-DIAGRAM` | `clarity` | Submission rejection and re-upload request | OCR strongly indicates non-architecture content | Fixed `35` points in engine | `$75` engine value, but no quote should be sent | Review rejected |
| `INPUT-NON-ARCH-SUSPECT` | `clarity` | Submission-quality triage | OCR indicates mixed non-architecture and architecture signals | Fixed `10` points | `$49` | Included; often drives diagnostic-only pricing |
| `INPUT-PARAGRAPH-QUALITY` | `clarity` | Narrative rewrite and flow clarification | Paragraph is too short or too low-signal | Fixed `8` points | `$43` | Included |
| `AWS-PROVIDER-MISMATCH` | `clarity` | Provider alignment correction | Selected AWS but tokens imply another cloud | Fixed `14` points | `$59` | Included |
| `AZURE-PROVIDER-MISMATCH` | `clarity` | Provider alignment correction | Selected Azure but tokens imply another cloud | Fixed `14` points | `$59` | Included |
| `GCP-PROVIDER-MISMATCH` | `clarity` | Provider alignment correction | Selected GCP but tokens imply another cloud | Fixed `14` points | `$59` | Included |
| `MSFT-FLOW-DIRECTION` | `clarity` | Request/data-flow narration | Directionality is unclear | Fixed `6` points | `$38` | Included |
| `CLAR-UNIDIR-RELATIONSHIPS` | `clarity` | Relationship-arrow cleanup | Bidirectional arrows or wording detected | Fixed `4` points | `$33` | Included |
| `MSFT-COMPONENT-LABEL-COVERAGE` | `clarity` | Component-role explanation pass | More than `8` service tokens detected but too few are explained in the paragraph | `4 + floor(missing explained components / 2)`, capped at `12` | `$33-$54` | Included |
| `CLAR-BOUNDARY-EXPLICIT` | `clarity` | Trust-boundary and scope labeling | Scope or trust boundaries are not explicit | Fixed `4` points | `$33` | Included |
| `CLAR-REL-LABELS-MISSING` | `clarity` | Protocol and transfer labeling | Relationship verbs used without protocol/intent labels | Fixed `4` points | `$33` | Included |
| `CLAR-REGION-ZONE-MISSING` | `clarity` | Region and zone placement review | Region/zone strategy language is absent | Fixed `4` points | `$33` | Included |
| `CLAR-STALE-DIAGRAM` | `clarity` | Diagram refresh and recertification | `lastUpdated` indicates the diagram is stale | `2 + floor((months stale - 6) / 4)`, capped at `6` | `$28-$38` | Included |
| `MSFT-LEGEND-SEMANTICS` | `clarity` | Legend and notation standardization | Multiple transfer semantics found but legend is empty | Fixed `7` points | `$41` | Included |
| `MSFT-LAYERING-DENSITY` | `clarity` | Layered-diagram decomposition | Canvas density is high enough to justify split views | `1 + floor((service token count - 18) / 4)`, capped at `5` | `$25-$36` | Included |
| `MSFT-LAYERING-OPTIONAL` | `clarity` | Optional layered-view recommendation | Diagram is busy enough that a layered view would help | Always `0` points | `$0` | Optional only |
| `REL-RTO-RPO-MISSING` | `reliability` | Recovery-target definition | Stateful services detected without RTO/RPO targets | Fixed `8` points | `$255` | Included |
| `REL-BACKUP-RESTORE` | `reliability` | Backup and restore planning | Stateful services detected without backup/restore coverage | Fixed `8` points | `$255` | Included |
| `SEC-BASELINE-MISSING` | `security` | Compliance baseline mapping | Regulated scope selected without explicit control baseline mapping | Fixed `8` points | `$205` | Included |
| `CLAR-DATA-CLASS-MISSING` | `security` | Sensitive-data classification review | Stateful data exists without PII/PCI/PHI or similar classification language | Fixed `6` points | `$189` | Included |

## Operational interpretation

- The `serviceLine` column is the cleanest internal bridge between a raw finding and the consulting work implied by that finding.
- The per-finding `Fix-cost contribution` is useful for scoping, follow-up, and explaining why the reviewer leaned toward a higher or lower package.
- The customer-facing `Core Quote` in the email is intentionally not a naive sum of all per-finding fix costs. It is a bounded consulting estimate, not a shopping cart.
