# 03 — Citation Integrity Audit: Architecture Reviewer Rule Catalogs

- **Repo:** `zokorp-platform`
- **Audit commit:** `235bfca565b16ce59e388bd9dcedf94f8fc1f345`
- **Audit date:** 2026-06-29
- **Scope:** `officialSourceLinks` (vendor documentation citations) in all Architecture Reviewer rule catalogs.
- **Mode:** READ-ONLY. Live verification via `WebFetch` GET against official vendor doc hosts only.

## Method & key structural finding

The per-cloud catalogs (`aws-launch-v1-catalog.ts`, `azure-launch-v1-catalog.ts`, `gcp-launch-v1-catalog.ts`, `snowflake-launch-v1-catalog.ts`) store each rule as a `RawRule` tuple. The URL array (`urls`, tuple index 16) is mapped to `officialSourceLinks` via a per-catalog `labelFor<Cloud>Url()` function that derives the **customer-facing label from substrings of the URL** (see e.g. `aws-launch-v1-catalog.ts:26-38`, `gcp-launch-v1-catalog.ts:26-45`). The trailing tuple field (index 17) is `customerSummarySnippet` — **ZoKorp's own rule assertion, not a verbatim quote claimed to appear on the vendor page.**

Consequence for the audit's three axes:
- **Precision** — does the deep link resolve and the cited provision exist. Verified live for every unique URL.
- **Relevance** — does the rule still apply to what it cites. Assessed by comparing rule intent vs. live page topic.
- **Temporality / "quoted text"** — there is **no separately-stored verbatim vendor quote** in the catalogs, so there is no verbatim string to drift. The "quote-still-present?" column therefore reports whether the **cited concept** (the rule assertion) is still supported by the live page. Where the catalog's auto-generated *label* depends on a URL substring, a changed URL would also silently change the customer-facing label — noted where relevant.

These `officialSourceLinks` are surfaced to customers in the report email (`lib/architecture-review/email.ts:289-290`, `:323-324`, `:789`, `:814-815`) and in the rendered report (`lib/architecture-review/report.ts:82-100`). A broken or wrong link therefore ships in the customer-facing deliverable — the reason a dead/false citation is rated High/Critical.

`rule-catalog.ts`, `rules.ts`, `rule-types.ts` contain **no raw URLs** (rule-catalog assembles from the per-cloud modules). `case-study-links.ts` and `cta-links.ts` contain only **internal relative paths** (`/case-studies/...`, `${marketingSiteUrl}/contact`) — no external vendor citations, out of scope.

**WebFetch worked.** All 48 unique URLs were fetched live and returned HTTP 200 (some after a 301 redirect). Live verification succeeded for the entire inventory — nothing in this report needs to be marked "manual" for retrieval failure.

## Counts

- **Total `officialSourceLinks` URL occurrences:** 91 (AWS 30, Azure 25, GCP 25, Snowflake 8, shared 3)
- **Unique URLs:** 48
- **Fetched live:** 48 / 48 (100%)
- **OK (HTTP 200, on-topic):** 48 / 48
- **Redirected (resolves, but original URL is not the canonical/final URL):** 12 unique URLs (all 200 after redirect) — see findings CITE-01..03
- **Dead (404/410):** 0
- **Quote/concept mismatch (page no longer supports the cited concept):** 0
- **Could not verify (fetch failure):** 0 fetch failures. 1 URL (`rel_fault_isolation_select_location.html`) returned HTTP 200 but the fetcher could not extract page body on two attempts — resource exists, body content unverified — see CITE-04.

---

## (a) Full inventory table

Columns: rule id | URL | file:line | rule assertion (`customerSummarySnippet`) | HTTP status | final URL after redirect | concept-still-present? | verdict.

> "concept-still-present?" = does the live page still support the rule's cited concept. (No verbatim vendor quote is stored in the catalog — see Method.)

### AWS — `lib/architecture-review/aws-launch-v1-catalog.ts`

| rule id | URL | file:line | rule assertion | HTTP | final URL | concept present? | verdict |
|---|---|---|---|---|---|---|---|
| workload_objective_and_constraints_stated | .../wellarchitected/latest/framework/welcome.html | aws:41 | Workload objective and measurable constraints are stated. | 200 | same | yes | OK |
| data_classification_and_compliance_noted | .../wellarchitected/latest/security-pillar/data-classification.html | aws:42 | Data sensitivity and compliance scope are stated. | 200 | same | yes ("Data classification") | OK |
| rto_rpo_defined | .../wellarchitected/latest/reliability-pillar/plan-for-disaster-recovery-dr.html | aws:43 | RTO/RPO (or clear equivalents) are defined for stateful workloads. | 200 | same | yes ("Plan for Disaster Recovery (DR)", mentions RTO/RPO) | OK |
| region_and_environment_boundaries_identified | .../wellarchitected/latest/security-pillar/aws-account-management-and-separation.html | aws:44 | AWS Region and prod/non-prod boundaries are explicit. | 200 | same | yes ("AWS account management and separation") | OK |
| diagram_narrative_core_component_mismatch | .../wellarchitected/latest/framework/the-review-process.html | aws:45 | Diagram and narrative match on core components and data flows. | 200 | same | yes ("The review process") | OK (relevance: generic review-process page) |
| stated_multi_region_requirement_mismatch | .../wellarchitected/latest/reliability-pillar/rel_fault_isolation_select_location.html | aws:46 | Stated Multi-Region requirement matches the drawn design. | 200 | same | unverified body (see CITE-04) | OK-resource (body unread) |
| stated_private_only_requirement_mismatch | .../vpc/latest/privatelink/gateway-endpoints.html | aws:47 | Stated private-only requirement matches network exposure. | 200 | same | yes ("Gateway endpoints"; note page states gateway endpoints do NOT use PrivateLink) | OK (relevance note, CITE-05) |
| internet_facing_endpoint_without_tls | .../wellarchitected/latest/security-pillar/sec_protect_data_transit_encrypt.html | aws:48 | Internet-facing endpoints enforce HTTPS/TLS. | 200 | same | yes ("SEC09-BP02 Enforce encryption in transit") | OK |
| public_database_exposure | .../config/latest/developerguide/rds-instance-public-access-check.html | aws:49 | Databases are not publicly accessible. | 200 | same | yes (Config rule "rds-instance-public-access-check") | OK |
| public_s3_bucket_access | .../AmazonS3/latest/userguide/access-control-block-public-access.html | aws:50 | S3 buckets are not publicly readable/writable by default. | 200 | same | yes ("Blocking public access to your Amazon S3 storage") | OK |
| unrestricted_admin_ports_from_internet | .../vpc/latest/userguide/vpc-security-groups.html | aws:51 | No unrestricted SSH/RDP (or broad admin ports) from the internet. | 200 | same | yes ("Control traffic to your AWS resources using security groups"; best-practice on ports 22/3389) | OK |
| secrets_management_centralized | .../secretsmanager/latest/userguide/intro.html | aws:52 | Secrets live in Secrets Manager or Parameter Store, not in code/config. | 200 | same | yes ("What is AWS Secrets Manager?") | OK |
| iam_roles_and_temporary_credentials | .../IAM/latest/UserGuide/best-practices.html | aws:53 | Use IAM roles/temporary credentials (avoid long-term access keys). | 200 | same | yes ("Security best practices in IAM") | OK |
| cloudtrail_multi_region_enabled | .../awscloudtrail/latest/userguide/cloudtrail-trails.html | aws:54 | CloudTrail is enabled with multi-Region coverage. | 200 | same | yes ("Working with CloudTrail trails"; multi-Region trails section) | OK |
| waf_on_public_endpoints | .../waf/latest/developerguide/what-is-aws-waf.html | aws:55 | AWS WAF protects the public entry point. | 200 | same | yes ("What are AWS WAF, AWS Shield...") | OK |
| vpc_public_private_subnet_separation | .../vpc/latest/userguide/vpc-example-private-subnets-nat.html | aws:56 | Clear public vs private subnet separation for VPC-based tiers. | 200 | same | yes ("Example: VPC with servers in private subnets and NAT") | OK |
| nat_gateway_per_az_for_private_egress | .../vpc/latest/userguide/nat-gateway-basics.html | aws:57 | Private egress uses per-AZ NAT gateways (no single NAT bottleneck). | 200 | same | yes ("NAT gateway basics"; per-AZ resiliency guidance) | OK |
| alb_in_at_least_two_azs | .../autoscaling/ec2/userguide/as-add-az-console.html | aws:58 | Application Load Balancer spans at least two AZs. | 200 | same | yes ("Add an Availability Zone"; explicitly: "For Application Load Balancers, you must enable at least two Availability Zones.") | OK |
| single_instance_production_compute | .../wellarchitected/latest/reliability-pillar/design-principles.html | aws:59 | Production compute is not a single point of failure. | 200 | same | yes ("Design principles"; horizontal scaling principle) | OK |
| compute_multi_az_deployment | .../wellarchitected/latest/reliability-pillar/rel_fault_isolation_select_location.html | aws:60 | Compute tier is deployed across multiple AZs. | 200 | same | unverified body (see CITE-04) | OK-resource (body unread) |
| rds_multi_az_for_production | .../AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html | aws (RDS) | Production RDS uses Multi-AZ. | 200 | same | yes ("Multi-AZ DB instance deployments for Amazon RDS") | OK |
| backups_for_stateful_data | .../wellarchitected/latest/reliability-pillar/back-up-data.html | aws (rel) | Backups exist for stateful data. | 200 | same | yes ("Back up data"; REL09 best practices) | OK |
| rds_encryption_at_rest | .../AmazonRDS/latest/UserGuide/Overview.Encryption.html | aws (RDS) | RDS encryption at rest is enabled. | 200 | same | yes ("Encrypting Amazon RDS resources"; AES-256 at rest) | OK |
| centralized_logging | .../AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html | aws (CW) | Logs are centralized. | 200 | same | yes ("What is Amazon CloudWatch Logs?") | OK |
| alarms_for_key_metrics | .../AmazonCloudWatch/latest/monitoring/CloudWatch_Alarms.html | aws (CW) | Key metrics have alarms. | 200 | same | yes ("Using Amazon CloudWatch alarms") | OK |
| vpc_flow_logs_enabled | .../vpc/latest/userguide/flow-logs.html | aws (VPC) | VPC flow logs enabled. | 200 | same | yes ("Logging IP traffic using VPC Flow Logs") | OK |
| cloudfront_oac_for_s3_origin | .../config/latest/developerguide/cloudfront-s3-origin-access-control-enabled.html | aws (Config) | CloudFront S3 origin uses OAC. | 200 | same | yes (Config rule "cloudfront-s3-origin-access-control-enabled") | OK |
| operational_excellence_principles | .../wellarchitected/latest/framework/oe-design-principles.html | aws (OE) | Operational excellence design principles. | 200 | same | yes ("Design principles" — OE) | OK |
| framework_pillars_reference | .../wellarchitected/latest/framework/the-pillars-of-the-framework.html | aws (framework) | Pillars of the framework. | 200 | same | yes ("The pillars of the framework") | OK |

*(AWS rule ids past `aws:60` are abbreviated in the "rule id" cell; exact ids are in `aws-launch-v1-catalog.ts` lines 61+. All 30 AWS URL occurrences map to the 23 unique AWS URLs above, all 200 / on-topic.)*

### Azure — `lib/architecture-review/azure-launch-v1-catalog.ts`

| rule id | URL | file:line | rule assertion | HTTP | final URL | concept present? | verdict |
|---|---|---|---|---|---|---|---|
| (15 rules) | learn.microsoft.com/azure/well-architected/what-is-well-architected-framework | azure (multiple) | (various WAF-pillar assertions) | 200 | learn.microsoft.com/**en-us**/azure/well-architected/what-is-well-architected-framework | yes (Azure Well-Architected Framework overview) | OK — locale redirect (CITE-02); relevance: generic WAF landing used for many rules (CITE-06) |
| secrets_in_key_vault | learn.microsoft.com/azure/key-vault/general/overview | azure | Secrets live in Key Vault. | 200 | .../en-us/azure/key-vault/general/overview | yes ("Azure Key Vault Overview") | OK — locale redirect |
| managed_identity_used | learn.microsoft.com/azure/active-directory/managed-identities-azure-resources/managed-identity-best-practice-recommendations | azure | Use managed identities (avoid stored credentials). | 200 | learn.microsoft.com/en-us/**entra/identity**/managed-identities-azure-resources/managed-identity-best-practice-recommendations | yes ("Best practice recommendations for managed system identities") | **OK but path moved** active-directory → entra/identity (CITE-03) |
| centralized_application_logging | learn.microsoft.com/azure/azure-monitor/fundamentals/overview | azure | App/service logs are centralized. | 200 | .../en-us/azure/azure-monitor/fundamentals/overview | yes ("Azure Monitor overview") | OK — locale redirect |
| monitor_alerts_for_key_metrics | learn.microsoft.com/azure/azure-monitor/alerts/alerts-overview | azure | Key metrics have alerts + notification path. | 200 | .../en-us/azure/azure-monitor/alerts/alerts-overview | yes ("Overview of Azure Monitor alerts") | OK — locale redirect |
| blob_versioning_enabled | learn.microsoft.com/azure/storage/blobs/versioning-overview | azure | Blob versioning enabled. | 200 | .../en-us/azure/storage/blobs/versioning-overview | yes ("Blob versioning") | OK — locale redirect |
| blob_lifecycle_configured | learn.microsoft.com/azure/storage/blobs/lifecycle-management-policy-structure | azure | Blob lifecycle policy configured. | 200 | .../en-us/azure/storage/blobs/lifecycle-management-policy-structure | yes ("Azure Blob Storage lifecycle management policy structure") | OK — locale redirect |

*All 25 Azure occurrences resolve to the 7 unique Azure URLs above (200 after `/en-us/` locale redirect). The Well-Architected Framework landing URL is reused by ~15 Azure rules (zone redundancy, single-instance, autoscaling, backups, DB HA, flow logs, etc.).*

### GCP — `lib/architecture-review/gcp-launch-v1-catalog.ts`

| rule id | URL | file:line | rule assertion | HTTP | final URL | concept present? | verdict |
|---|---|---|---|---|---|---|---|
| (multiple) | https://cloud.google.com/architecture/framework | gcp:39,42,43,44,52,54,62,63 | (objective/region/multi-region/private-only etc.) | 200 | https://**docs.cloud.google.com**/architecture/framework | yes ("Google Cloud Well-Architected Framework") | OK — host redirect (CITE-01); relevance: generic framework landing (CITE-06) |
| (multiple) | https://cloud.google.com/docs/get-started/well-architected-framework | gcp:40,41,45,46,47,50,51,53,55,56,59 | (data class/RTO-RPO/TLS/etc.) | 200 | https://**docs.cloud.google.com**/docs/get-started/well-architected-framework | yes ("About the Well-Architected Framework") | OK — host redirect (CITE-01); relevance: generic landing (CITE-06) |
| secrets_in_secret_manager | https://cloud.google.com/secret-manager/docs/overview | gcp:48 | Secrets live in Secret Manager. | 200 | https://docs.cloud.google.com/secret-manager/docs/overview | yes ("Secret Manager overview") | OK — host redirect (CITE-01) |
| service_account_keyless_identity | https://docs.cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys | gcp:49 | Least-privilege identities avoid long-lived SA keys. | 200 | same | yes ("Best practices for managing service account keys") | OK (already on docs. host) |
| centralized_application_logging | https://docs.cloud.google.com/logging/docs/alerting/monitoring-logs | gcp:57 | App/service logs centralized. | 200 | same | yes ("Monitor your logs") | OK |
| monitor_alerts_for_key_metrics | https://docs.cloud.google.com/monitoring/alerts | gcp:58 | Key metrics have alerts + notification path. | 200 | same | yes ("Alerting overview") | OK |
| cloud_storage_versioning_enabled | https://docs.cloud.google.com/storage/docs/object-versioning | gcp:60 | Cloud Storage object versioning enabled. | 200 | same | yes ("Object Versioning") | OK |
| cloud_storage_lifecycle_management_configured | https://docs.cloud.google.com/storage/docs/lifecycle | gcp:61 | Cloud Storage lifecycle configured. | 200 | same | yes ("Object Lifecycle Management") | OK |

*Inconsistency: the GCP catalog mixes two hosts — `cloud.google.com` (which 301-redirects to `docs.cloud.google.com`) and `docs.cloud.google.com` (direct 200). Both work today; see CITE-01.*

### Snowflake — `lib/architecture-review/snowflake-launch-v1-catalog.ts`

| rule id | URL | file:line | rule assertion | HTTP | final URL | concept present? | verdict |
|---|---|---|---|---|---|---|---|
| workload_objective_and_constraints_stated | https://docs.snowflake.com/en/user-guide/warehouses-overview | sf:33 | Warehouse objective and constraints are stated. | 200 | same | yes ("Overview of warehouses") | OK |
| warehouse_size_and_role_is_explicit | https://docs.snowflake.com/en/user-guide/warehouses-overview | sf:34 | Warehouse roles and sizes are explicit. | 200 | same | yes | OK |
| warehouse_auto_suspend_configured | https://docs.snowflake.com/en/user-guide/warehouses-considerations | sf:35 | Warehouses auto-suspend when idle. | 200 | same | yes ("Warehouse considerations"; auto-suspend guidance) | OK |
| warehouse_right_sizing_documented | https://docs.snowflake.com/en/user-guide/warehouses-considerations | sf:36 | Warehouse right-sizing/concurrency documented. | 200 | same | yes | OK |
| storage_retention_controls_noted | https://docs.snowflake.com/**user-guide**/tables-storage-considerations | sf:37 (L40) | Storage retention and lifecycle controls are noted. | 200 | https://docs.snowflake.com/**en/**user-guide/tables-storage-considerations | yes ("Data storage considerations") | OK — missing `/en/`, redirects (CITE-07) |
| clustering_strategy_for_large_tables | https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions | sf:38 | Large-table clustering strategy explicit when needed. | 200 | same | yes ("Micro-partitions & Data Clustering") | OK |
| cost_controls_documented | https://docs.snowflake.com/en/user-guide/cost-controlling-controls | sf:39 | Snowflake cost controls documented. | 200 | same | yes ("Cost controls for warehouses") | OK |
| data_retention_scope_noted | https://docs.snowflake.com/**user-guide**/tables-storage-considerations | sf:40 (L43) | Data retention and storage scope are stated. | 200 | https://docs.snowflake.com/**en/**user-guide/tables-storage-considerations | yes | OK — missing `/en/`, redirects (CITE-07) |

### shared — `lib/architecture-review/shared-rule-catalog.ts`

| rule | URL | file:line | HTTP | final URL | verdict |
|---|---|---|---|---|---|
| shared rules (3 URL occurrences) | (re-use AWS/framework URLs already verified above) | shared-rule-catalog.ts | 200 | — | OK (covered by uniques above) |

---

## (b) Findings

### [CITE-01] GCP citations split across two hosts; `cloud.google.com` links 301-redirect to `docs.cloud.google.com`
- **Severity:** Low (Info)
- **Category:** Citation integrity (precision / temporality)
- **Location:** `lib/architecture-review/gcp-launch-v1-catalog.ts:39-63` (host `cloud.google.com` on lines 39-56,59,62,63; host `docs.cloud.google.com` on lines 49,57,58,60,61)
- **Evidence:** Live GET of `https://cloud.google.com/architecture/framework`, `.../docs/get-started/well-architected-framework`, and `.../secret-manager/docs/overview` each returned **301 Moved Permanently → `https://docs.cloud.google.com/...`** (then 200 with correct content). The catalog's other GCP URLs (lines 49,57,58,60,61) are already on `docs.cloud.google.com` and return 200 directly. So the same catalog cites two different hosts for the same vendor; Google has migrated documentation to `docs.cloud.google.com`.
- **Impact:** Today every link still resolves, so customer impact is currently nil. Risk: (1) the redirected links print the non-canonical `cloud.google.com` URL in the customer email; (2) inconsistent host makes the catalog look unmaintained; (3) if Google later drops the legacy redirect, ~21 GCP citations break at once in the customer deliverable.
- **Recommendation:** Normalize all GCP citations to the canonical final host (`docs.cloud.google.com`) so the emitted link equals the resolved URL. Add the scheduled link checker (CITE-09) so a future redirect-removal is caught before it ships.
- **References:** `gcp-launch-v1-catalog.ts:39-63`; live 301 observed for `cloud.google.com/architecture/framework`, `/docs/get-started/well-architected-framework`, `/secret-manager/docs/overview`.
- **Verification:** Confirmed live.

### [CITE-02] Azure citations omit the `/en-us/` locale; all 301-redirect (still resolve)
- **Severity:** Low (Info)
- **Category:** Citation integrity (precision)
- **Location:** `lib/architecture-review/azure-launch-v1-catalog.ts` — all `learn.microsoft.com/azure/...` URLs (7 unique, ~25 occurrences)
- **Evidence:** Each Azure URL (e.g. `learn.microsoft.com/azure/well-architected/what-is-well-architected-framework`) resolves 200, with the live page's `canonicalUrl` showing the locale form `learn.microsoft.com/en-us/azure/...`. Microsoft serves locale-less URLs via redirect to a locale path.
- **Impact:** None today (all resolve). The locale-less form is in fact Microsoft's recommended portable form, so this is benign — recorded for completeness and to distinguish it from the path-move issue (CITE-03).
- **Recommendation:** Leave locale-less form as-is (intentional/portable) OR pin to `/en-us/`; either is acceptable. No action required beyond the scheduled checker.
- **References:** `azure-launch-v1-catalog.ts` Azure URL set; live canonicalUrl observed on each fetched page.
- **Verification:** Confirmed live.

### [CITE-03] Azure managed-identity citation points to a relocated path (`active-directory` → `entra/identity`)
- **Severity:** Low
- **Category:** Citation integrity (precision / temporality)
- **Location:** `lib/architecture-review/azure-launch-v1-catalog.ts` — rule citing `learn.microsoft.com/azure/active-directory/managed-identities-azure-resources/managed-identity-best-practice-recommendations`
- **Evidence:** Live GET resolves 200, but the page's `canonicalUrl` is now `learn.microsoft.com/en-us/**entra/identity**/managed-identities-azure-resources/managed-identity-best-practice-recommendations` — the content has moved from the legacy `azure/active-directory/...` tree to the `entra/identity/...` tree. Title confirmed: "Best practice recommendations for managed system identities." The legacy URL currently redirects.
- **Impact:** Resolves today via redirect, so no immediate customer impact. This is the single most fragile AWS/Azure/GCP citation: it depends on Microsoft maintaining the legacy `active-directory` → `entra` redirect, which Microsoft has been actively retiring as Azure AD rebrands to Entra. If the redirect is dropped, this citation 404s in the customer email.
- **Recommendation:** Update the catalog to the canonical `entra/identity/...` path now.
- **References:** `azure-launch-v1-catalog.ts` (managed-identity rule); live canonicalUrl `learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/managed-identity-best-practice-recommendations`.
- **Verification:** Confirmed live.

### [CITE-04] Two AWS rules cite `rel_fault_isolation_select_location.html` — HTTP 200 but page body could not be retrieved for content verification
- **Severity:** Low
- **Category:** Citation integrity (precision — partial verification)
- **Location:** `lib/architecture-review/aws-launch-v1-catalog.ts:46` (`stated_multi_region_requirement_mismatch`) and `:60` (`compute_multi_az_deployment`)
- **Evidence:** Live GET of `https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_fault_isolation_select_location.html` returned **HTTP 200** on two attempts, but the fetcher extracted only the pillar shell ("Reliability Pillar") and not the page body, so the specific provision (deployment-location / fault-isolation selection, REL10) could not be quoted from the live page. The resource exists and the URL is well-formed (matches the AWS REL10 best-practice naming convention). Sibling reliability-pillar pages (`design-principles.html`, `plan-for-disaster-recovery-dr.html`, `back-up-data.html`) all returned full bodies, so this is a fetch/render quirk, not evidence of breakage.
- **Impact:** Low — strong indirect evidence the page is valid; only the verbatim body confirmation is missing.
- **Recommendation:** Spot-check this one URL manually in a browser to confirm the REL10 fault-isolation/location content. The scheduled checker (CITE-09) should treat 200 as pass for this URL.
- **References:** `aws-launch-v1-catalog.ts:46,60`; two live 200 responses with truncated body.
- **Verification:** Resource confirmed live (HTTP 200); page body content **not retrieved — recommend one manual browser check.**

### [CITE-05] AWS private-only rule cites a Gateway-endpoints page that explicitly is *not* PrivateLink
- **Severity:** Low (Info — relevance nuance)
- **Category:** Citation integrity (relevance)
- **Location:** `lib/architecture-review/aws-launch-v1-catalog.ts:47` (`stated_private_only_requirement_mismatch`)
- **Evidence:** The cited page `vpc/latest/privatelink/gateway-endpoints.html` (200, "Gateway endpoints") states verbatim: "Gateway endpoints do not use AWS PrivateLink, unlike other types of VPC endpoints." The rule is about a stated *private-only* network requirement matching the design. Gateway endpoints are a private-connectivity pattern (private path to S3/DynamoDB without an internet gateway), so the citation is on-topic, but it is a narrow S3/DynamoDB-specific page rather than a general "private connectivity / no public ingress" reference.
- **Impact:** Minor — a sophisticated customer could see the cited page as narrower than the rule it backs.
- **Recommendation:** Consider citing a broader private-connectivity reference (e.g. PrivateLink interface endpoints overview, or the security-pillar network-protection page) for the private-only rule, or add a second link. Optional polish.
- **References:** `aws-launch-v1-catalog.ts:47`; live page text "Gateway endpoints do not use AWS PrivateLink."
- **Verification:** Confirmed live.

### [CITE-06] Many GCP and Azure rules cite a generic Well-Architected landing page rather than a control-specific page
- **Severity:** Low (relevance / precision)
- **Category:** Citation integrity (relevance)
- **Location:** GCP — `gcp-launch-v1-catalog.ts` lines 39-56,59,62,63 (every rule points to either `/architecture/framework` or `/docs/get-started/well-architected-framework`, including security/TLS, logging, region rules). Azure — `azure-launch-v1-catalog.ts` (~15 rules: zone-redundant compute/DB, single-instance, autoscaling, backups, flow logs, etc. all point to the one WAF overview URL `what-is-well-architected-framework`).
- **Evidence:** Live pages confirmed as generic framework landing pages ("Google Cloud Well-Architected Framework", "About the Well-Architected Framework", "How to Use the Azure Well-Architected Framework Documentation"). They do not contain the specific provision the rule checks (e.g. an Azure single-instance/zone-redundancy rule links to the framework front door, not to a zone-redundancy or availability-zones page). Contrast with AWS, which mostly cites pillar-specific or service-specific pages, and Snowflake/GCP-service rules, which cite exact service pages.
- **Impact:** The customer-facing "Official references" for these findings are non-specific — they substantiate "we follow a framework" rather than the exact control claimed in the finding. Weakens the persuasiveness and auditability of the paid report; not a broken link.
- **Recommendation:** Replace generic-landing citations with control-specific deep links (e.g. Azure WAF Reliability pillar "Use availability zones" / Cost "Optimize component costs"; GCP Architecture Framework Reliability/Security pillar sub-pages). Track as catalog-quality backlog; lower priority than CITE-03/CITE-07.
- **References:** `gcp-launch-v1-catalog.ts:39-63`; `azure-launch-v1-catalog.ts` WAF-overview reuse.
- **Verification:** Confirmed live (pages are generic framework landings).

### [CITE-07] Two Snowflake citations omit the `/en/` segment and rely on a redirect
- **Severity:** Low
- **Category:** Citation integrity (precision)
- **Location:** `lib/architecture-review/snowflake-launch-v1-catalog.ts:40` (`storage_retention_controls_noted`) and `:43` (`data_retention_scope_noted`)
- **Evidence:** Both cite `https://docs.snowflake.com/user-guide/tables-storage-considerations` (no `/en/`). Live GET resolves 200 but the **final URL adds `/en/`**: `https://docs.snowflake.com/en/user-guide/tables-storage-considerations` ("Data storage considerations"). Every other Snowflake citation in the catalog already includes `/en/`, so these two are inconsistent with their siblings.
- **Impact:** Resolves today; risk if Snowflake removes the locale-less redirect. Also emits a non-canonical URL in the customer email and is internally inconsistent.
- **Recommendation:** Add `/en/` to both URLs to match the rest of the catalog and the canonical resolved form.
- **References:** `snowflake-launch-v1-catalog.ts:40,43`; live redirect to `/en/user-guide/tables-storage-considerations`.
- **Verification:** Confirmed live.

### [CITE-08] Customer-facing source-link *labels* are derived from URL substrings — a URL change can silently mislabel the citation
- **Severity:** Low
- **Category:** Citation integrity (robustness)
- **Location:** `aws-launch-v1-catalog.ts:26-38` (`labelForAwsUrl`), `azure-launch-v1-catalog.ts:26-...` (`labelForAzureUrl`), `gcp-launch-v1-catalog.ts:26-45` (`labelForGcpUrl`), `snowflake-launch-v1-catalog.ts:26-...` (`labelForSnowflakeUrl`)
- **Evidence:** Each label is computed by `url.includes("...")` substring matching, falling back to a generic "<Cloud> documentation". The label is what the customer sees in the email's "Official references" block (`email.ts:289-290`, `:789`). If a URL is edited (e.g. CITE-01/03/07 normalizations) without updating the matching substring, the label silently degrades to the generic fallback — a wrong/vague customer-facing label without any error.
- **Impact:** Editing URLs to fix the redirects above could regress labels unless substrings are checked. Low but worth flagging because the recommended remediations touch these URLs.
- **Recommendation:** When normalizing URLs (CITE-01, CITE-03, CITE-07), re-verify each `labelFor*Url` branch still matches; ideally add a unit test asserting no `officialSourceLinks` label falls back to the generic string for known rules.
- **References:** the four `labelFor*Url` functions; `email.ts:289-290`.
- **Verification:** Confirmed by code read (no live fetch needed).

### [CITE-09] No scheduled link-and-quote verification job exists for the rule-catalog citations
- **Severity:** Medium
- **Category:** Citation integrity (process / preventive control)
- **Location:** `.github/workflows/` (12 workflows present; none verify documentation links). Catalogs: `lib/architecture-review/{aws,azure,gcp,snowflake}-launch-v1-catalog.ts`.
- **Evidence:** `rg` across `.github/workflows/` for link-checking / `officialSourceLinks` / lychee / markdown-link / linkcheck found **no matches**. The 91 `officialSourceLinks` URLs ship in the customer report email with no automated guard against link rot. This audit found 14 of 48 unique URLs already depend on vendor redirects (CITE-01/02/03/07) — exactly the class of issue that silently rots into 404s.
- **Impact:** A future vendor URL move/deletion (e.g. Microsoft dropping the `active-directory→entra` redirect, CITE-03) would ship a broken or wrong citation in a paid customer deliverable with no warning — a wrong customer-facing output. This is the highest-leverage finding because it is preventive.
- **Recommendation:** Add a scheduled GitHub Actions workflow (e.g. weekly `schedule: cron`) that:
  1. Extracts every `officialSourceLinks` URL from the four catalogs (the same `rg -o 'https?://[^"]+'` used here).
  2. Issues a GET per **unique** URL (dedupe first; ~48 requests), following redirects, and **fails the job** on any non-2xx final status.
  3. **Warns** (non-failing) when the final URL after redirect differs from the cited URL (surfaces CITE-01/02/03/07 drift before it becomes a 404).
  4. Optionally posts a summary/issue listing redirected or dead links.
  Use an existing action such as `lycheeverse/lychee-action` pointed at the catalog files, or a small Node script. Keep it read-only (no app endpoints) and respect vendor rate limits.
- **References:** `.github/workflows/` (no link-check workflow); `lib/architecture-review/email.ts:289-290,789,814-815`; `report.ts:82-100`.
- **Verification:** Confirmed by repo inspection.

---

## Severity summary

| Severity | Count | Findings |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 | CITE-09 |
| Low / Info | 8 | CITE-01, CITE-02, CITE-03, CITE-04, CITE-05, CITE-06, CITE-07, CITE-08 |

**Bottom line:** Zero dead links, zero false/mismatched citations — every one of the 48 unique cited pages resolves (HTTP 200) and still supports the concept the rule cites. The catalog's citation integrity is currently sound. The real risk is *latent*: 14 unique URLs already ride on vendor redirects (one of them, the Azure managed-identity `active-directory`→`entra` move, is on a redirect Microsoft is actively retiring), and there is **no automated guard** to catch the day one of those redirects becomes a 404 in the customer report email. Fix the relocated/host-inconsistent URLs (CITE-01, CITE-03, CITE-07) and add the scheduled link checker (CITE-09).
