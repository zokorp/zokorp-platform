export type CaseStudyStatBlock = {
  label: string;
  value: string;
};

export type CaseStudyGlance = {
  industry: string;
  timeframe: string;
  environment: string;
};

export type CaseStudy = {
  slug: string;
  title: string;
  role: string;
  duration: string;
  summary: string;
  outcomeStat: string;
  outcomeHeadline: string;
  tags: readonly string[];
  pdfPath: string;
  glance: CaseStudyGlance;
  situation: readonly string[];
  task: readonly string[];
  action: {
    intro: string;
    moves: readonly { heading: string; detail: string }[];
  };
  result: {
    primary: string;
    secondary: readonly string[];
    metrics: readonly CaseStudyStatBlock[];
  };
  portable: readonly string[];
  technologies: readonly string[];
};

export const CASE_STUDIES: readonly CaseStudy[] = [
  {
    slug: "series-b-ai-cost-audit",
    title: "AWS cost audit: Series B AI startup, $38.4K → $22.4K monthly",
    role: "Cloud Cost Optimization Audit (representative engagement, anonymized)",
    duration: "2-week engagement, $750 flat fee",
    summary:
      "A two-week AWS spend review for a Series B AI startup took monthly cloud cost from $38.4K to $22.4K — a 42% cut, $192K annualized, at 256× ROI on the engagement fee.",
    outcomeStat: "42% monthly AWS cut · 256× ROI",
    outcomeHeadline:
      "Monthly AWS spend fell 42% — from $38.4K to $22.4K — for a net $192K annualized reduction on a $750 engagement.",
    tags: ["AWS", "Cost Optimization", "FinOps", "GPU", "RAG"],
    pdfPath: "/case-studies/series-b-ai-cost-audit.pdf",
    glance: {
      industry: "AI-native Series B startup (anonymized)",
      timeframe: "2-week audit, flat $750 engagement",
      environment: "AWS — EKS, EC2 GPU, OpenSearch, S3, Bedrock",
    },
    situation: [
      "A Series B AI startup was burning $38,400 a month on AWS and could not articulate where the money was going. Finance saw a line item climbing. Engineering saw a platform that felt appropriately sized. Neither side had the numbers to close the loop.",
      "The team did not want a managed-service relationship or a six-week engagement. They wanted a fast, bounded read — what is actually being spent, what is waste, and what would a finance-defensible next move look like — before their next board update.",
    ],
    task: [
      "Produce a prioritized waste map of monthly AWS spend inside two weeks, flat $750 engagement fee.",
      "Tie every recommendation to real line items in the bill, not generic best practices.",
      "Leave the team with remediation owners and a savings runway they could execute without further consulting.",
    ],
    action: {
      intro:
        "Read Cost Explorer, CUR data, and the live account together — rather than sequentially — so that every anomaly could be traced from the invoice down to the resource and back up to the team that owned it. No agentic rewrites, no landing-zone side quests; just the bill, the workloads, and a short list of moves ranked by blast radius per dollar saved.",
      moves: [
        {
          heading: "GPU right-sizing on the RAG inference path",
          detail:
            "The inference tier was pinned to on-demand p4d instances sized for a peak load that never arrived. Downshifted to g5 for steady state with burst headroom, moved non-latency-sensitive batch embeddings to Spot, and locked in savings-plan commits on the baseline. Single largest line-item move.",
        },
        {
          heading: "EKS idle-node and autoscaler audit",
          detail:
            "Node groups were sized for the 99th-percentile traffic shape, not the median. Tightened HPA and Cluster Autoscaler thresholds, killed two standing node groups that were 30% utilized, and collapsed two overlapping clusters into one.",
        },
        {
          heading: "S3 storage class and lifecycle cleanup",
          detail:
            "Training artifact buckets were sitting on S3 Standard with no lifecycle policy. Pushed cold artifacts to Intelligent-Tiering and Glacier Instant Retrieval with a 30-day transition rule. Deleted 11 TB of abandoned intermediate artifacts after confirming ownership.",
        },
        {
          heading: "OpenSearch domain consolidation",
          detail:
            "Three dev/staging domains were running production-class instance sizes. Consolidated into a single right-sized domain with dedicated masters only where actually needed, and moved log retention to a cheaper tier behind a clear query SLA.",
        },
        {
          heading: "Bedrock and data-transfer quick wins",
          detail:
            "Caught two cross-region traffic patterns inflating egress charges and routed them to the primary region. Swapped a heavy, rarely needed model on a low-volume path for a cheaper default with the expensive model kept behind an explicit opt-in.",
        },
      ],
    },
    result: {
      primary:
        "Monthly AWS spend dropped from $38,400 to $22,400 — a 42% reduction — for $192,000 in annualized savings on a $750 engagement. A 256× ROI before any ongoing optimization.",
      secondary: [
        "Every remediation landed with a named owner on the engineering side and a one-page runbook in writing.",
        "Savings-plan posture moved from reactive to intentional, with a baseline/burst split documented per workload.",
        "Storage footprint fell 34% in the first 30 days post-engagement, without any change to model quality or training throughput.",
        "Finance got a per-workload cost breakdown usable directly in the next board deck.",
      ],
      metrics: [
        { label: "Monthly spend before", value: "$38.4K" },
        { label: "Monthly spend after", value: "$22.4K" },
        { label: "Annualized savings", value: "$192K" },
        { label: "ROI on engagement", value: "256×" },
      ],
    },
    portable: [
      "Read the bill and the cluster together, not sequentially. Every anomaly in Cost Explorer should be traceable to a live resource inside the same hour.",
      "Size for median load with burst headroom, not for the 99th percentile. Spot and savings plans do the rest.",
      "Storage and egress are almost always underinspected. Lifecycle policies pay back faster than any compute change.",
    ],
    technologies: [
      "AWS",
      "EKS",
      "EC2 GPU (p4d / g5)",
      "OpenSearch",
      "S3 Intelligent-Tiering",
      "Bedrock",
      "Cost Explorer / CUR",
      "Savings Plans",
    ],
  },
  {
    slug: "nordic-ai-ivr",
    title: "HIPAA-compliant AI IVR: 94-minute hold time down to 22 minutes",
    role: "Senior AI Solutions Architect (contract) — Nordic Group",
    duration: "8 months, kickoff to production",
    summary:
      "An AWS Bedrock-based AI IVR for a regional healthcare provider reduced average hold time by 77% — 94 minutes to 22 minutes — without adding intake staff.",
    outcomeStat: "77% hold-time reduction",
    outcomeHeadline:
      "Average caller hold time dropped from 94 minutes to 22 minutes — a 77% reduction — without any change to staffing levels.",
    tags: ["AWS", "Bedrock", "Healthcare", "HIPAA", "IVR"],
    pdfPath: "/case-studies/nordic-ai-ivr.pdf",
    glance: {
      industry: "Healthcare — regional provider (Nordic Group)",
      timeframe: "8 months from kickoff to production",
      environment: "AWS — Bedrock, Connect, HIPAA-regulated, EMR-integrated",
    },
    situation: [
      "Nordic Group, a regional healthcare provider, was losing patients at the front door. Peak-hour intake lines backed up across clinics, and the average caller hold time had crept to 94 minutes. Every minute over 30 correlated with higher abandonment and worse patient satisfaction scores.",
      "The organization could not meaningfully expand headcount in the near term. Any solution had to run entirely inside a HIPAA posture — PHI encrypted in transit and at rest, Business Associate Agreements honored at every boundary, and auditable logs retained for the statutory window.",
    ],
    task: [
      "Cut average caller hold time by more than half without adding intake staff.",
      "Integrate with the existing EMR so the IVR could authenticate callers, look up upcoming appointments, and route callbacks back into the scheduling system of record.",
      "Ship to production inside eight months and pass a full HIPAA audit before the first patient call hit the new system.",
    ],
    action: {
      intro:
        "Delivered as a three-tier flow — triage, intake routing, callback queue — on AWS with Bedrock models behind Amazon Connect. Scoped tight to the top intake intents. No general-purpose assistant, no clever edge cases — just the intents that covered the overwhelming majority of call volume.",
      moves: [
        {
          heading: "Narrow intent catalogue, built for intake",
          detail:
            "Trained and tuned a focused intent model around the top intake paths (appointment, prescription, triage escalation, billing, transfer). Refused to automate long-tail intents on day one — staff kept the long tail, the model kept its accuracy.",
        },
        {
          heading: "HIPAA-scoped architecture on AWS",
          detail:
            "VPC-isolated Bedrock inference behind PrivateLink, KMS-managed PHI encryption keys, audit logs to immutable S3 with Object Lock and seven-year retention, and BAA boundaries verified at every service edge — Connect, Bedrock, Transcribe, and the EMR link.",
        },
        {
          heading: "EMR integration via private scheduling API",
          detail:
            "Caller authentication and appointment lookup ran over a PrivateLink path to the EMR's scheduling API. Callback routing wrote back into the same system of record so staff never saw a second queue to reconcile.",
        },
        {
          heading: "Graceful human handoff",
          detail:
            "A break-glass escalation path was built in from day one. If confidence dropped or the caller asked for a person, the call routed to the existing intake team with full conversational context attached — no repeat, no friction.",
        },
        {
          heading: "Phased rollout with real load",
          detail:
            "Load-tested at 3× projected peak before go-live. Rolled out to two pilot clinics first, tightened the intent catalogue on real traffic, then extended to the full network.",
        },
      ],
    },
    result: {
      primary:
        "Average caller hold time dropped from 94 minutes to 22 minutes — a 77% reduction — without any change to staffing levels.",
      secondary: [
        "Call abandonment rate fell from 18% to 4% within the first 90 days of full rollout.",
        "Intake staff hours reallocated from phone queue triage to higher-touch patient-facing work.",
        "HIPAA audit passed on first review with no findings on the new system boundary.",
        "99.95% system availability across the first six months post-launch.",
      ],
      metrics: [
        { label: "Hold time reduction", value: "77%" },
        { label: "Before → after", value: "94 → 22 min" },
        { label: "Abandonment drop", value: "18% → 4%" },
        { label: "Audit findings", value: "0" },
      ],
    },
    portable: [
      "Start with the 20% of intents that cover 80% of calls. Long-tail intents belong to humans until the model earns them.",
      "Scope PHI inside the inference boundary from the first line of code. Retrofitting compliance is where schedule and budget go to die.",
      "Build the break-glass handoff before the first patient call. Trust in the system grows faster than trust in any single model.",
    ],
    technologies: [
      "AWS",
      "Bedrock",
      "Amazon Connect",
      "Transcribe",
      "PrivateLink",
      "KMS",
      "S3 Object Lock",
      "HIPAA",
    ],
  },
  {
    slug: "aws-partner-sa",
    title: "Cloud architecture for strategic partner deals: $60M+ closed, $200M+ influenced",
    role: "AWS Partner Solutions Architect",
    duration: "38 months",
    summary:
      "Thirty-eight months as an AWS Partner Solutions Architect — $60M+ in partner contracts closed and $200M+ in customer cloud spend influenced across an enterprise and AI-native portfolio.",
    outcomeStat: "$60M+ closed · $200M+ influenced",
    outcomeHeadline:
      "$60M+ in partner contracts closed, $200M+ in customer cloud spend influenced, with cost reductions from 20% to 70% delivered across engagements.",
    tags: ["AWS", "Partner Architecture", "GenAI", "Enterprise"],
    pdfPath: "/case-studies/aws-partner-sa.pdf",
    glance: {
      industry: "Enterprise and AI-native portfolio — homebuilding, media, software",
      timeframe: "38 months in-seat",
      environment: "AWS Well-Architected, multi-account landing zones, GenAI workloads",
    },
    situation: [
      "An AWS partner ecosystem needed scalable architecture review delivery across mid-market and enterprise accounts. Generic reviews — checklists, screenshots, thirty-page PDFs — were not moving the needle. Findings were landing as shelfware.",
      "Partners needed technical architecture support credible enough to close strategic deals and retain accounts, with cost and risk findings that executive buyers could actually act on. The portfolio spanned enterprise buyers (D.R. Horton, Warner Bros.) and AI-native teams shipping production GenAI.",
    ],
    task: [
      "Deliver Well-Architected reviews and deal-support architecture across dozens of customer accounts with consistent depth and quality.",
      "Translate every finding into business-language impact — dollars saved, risk avoided, delivery unblocked — so it could close the deal and survive the executive read.",
      "Build reusable playbooks so partner teams could carry remediation after the review, not stall once the formal engagement closed.",
    ],
    action: {
      intro:
        "Applied the AWS Well-Architected Framework's six pillars per engagement. Treated every finding as a delivery contract with the customer's engineering team, not a slide in a deck. On AI-native deals, pushed further into GenAI architecture — retrieval, inference, evaluation, and cost attribution — as a first-class pillar of the review.",
      moves: [
        {
          heading: "Pillar-based review with direct evidence",
          detail:
            "Each pillar review produced concrete evidence: IAM policy extracts, VPC topology diagrams, cost attribution reports, incident history. No finding left the engagement without an artifact behind it.",
        },
        {
          heading: "Prioritization by blast-radius × effort",
          detail:
            "Findings were ranked by likely blast radius (security, reliability, cost) multiplied by remediation effort. High-impact, low-effort items ran first. Shelfware died early.",
        },
        {
          heading: "Business-language executive summaries",
          detail:
            "Every review produced a separate executive summary written for the business sponsor — no jargon, no screenshots. Dollar impact, risk exposure, and a three-decision recommendation. Technical detail lived in a paired engineering document.",
        },
        {
          heading: "GenAI architecture as a first-class pillar",
          detail:
            "For AI-native customers, extended the review into retrieval topology, inference cost per request, evaluation posture, and safety boundaries. Gave AI buyers the same caliber of review their traditional workloads were already getting.",
        },
        {
          heading: "Reusable remediation playbooks",
          detail:
            "Built a library of playbooks across common remediation patterns: multi-account landing zones, IAM segmentation, VPC rearchitecture, cost-attribution tags, data-lake governance. Partner teams used them to finish what the review started.",
        },
        {
          heading: "Named remediation owners per finding",
          detail:
            "Each prioritized finding left the engagement with a named owner on the customer side. No anonymous handoffs. Remediation completion rates moved accordingly.",
        },
      ],
    },
    result: {
      primary:
        "$60M+ in partner contracts closed, $200M+ in customer cloud spend influenced, and cost reductions ranging from 20% to 70% delivered across engagements over 38 months in seat.",
      secondary: [
        "Typical engagement produced 30–45% cloud cost reduction within six months of remediation.",
        "Average review-to-remediation cycle shortened to roughly six weeks.",
        "Remediation completion rate held above 75% inside six months post-engagement — well above the industry norm.",
        "Review templates and GenAI playbooks became standard delivery artifacts across the partner organization.",
      ],
      metrics: [
        { label: "Partner contracts closed", value: "$60M+" },
        { label: "Customer revenue influenced", value: "$200M+" },
        { label: "Cost reduction range", value: "20–70%" },
        { label: "Time in seat", value: "38 months" },
      ],
    },
    portable: [
      "Tie every technical finding to a dollar or risk number. Otherwise it will not get prioritized, no matter how correct it is.",
      "Write two documents — executive and engineering — not one hybrid. Different readers, different decisions, different failure modes.",
      "GenAI deserves the same architectural discipline as any other workload. Retrieval, inference cost, and evaluation posture are first-class, not afterthoughts.",
    ],
    technologies: [
      "AWS",
      "Well-Architected Framework",
      "IAM",
      "VPC design",
      "Cost allocation tags",
      "Landing zones",
      "Bedrock",
      "SageMaker",
    ],
  },
  {
    slug: "azure-nhl-llmops",
    title: "Production LLMOps on Azure: NHL goes from notebooks to a service",
    role: "Microsoft Azure AI Solutions Engineer",
    duration: "In-flight engagement",
    summary:
      "An Azure LLMOps platform for the NHL with multi-GPU training, vLLM inference on AKS, and per-request cost attribution — taking production GenAI from notebooks to a defensible service.",
    outcomeStat: "A100 multi-GPU production with vLLM",
    outcomeHeadline:
      "Production GenAI on Azure with 8× A100 distributed training, vLLM inference on AKS, and per-request cost attribution that made ROI visible at the feature level.",
    tags: ["Azure", "LLMOps", "vLLM", "Distributed Training", "Sports & Media"],
    pdfPath: "/case-studies/azure-nhl-llmops.pdf",
    glance: {
      industry: "Professional sports & media — the NHL",
      timeframe: "In-flight, phased production rollout",
      environment: "Azure ML, AKS, 8× NVIDIA A100, PyTorch DDP/FSDP, vLLM",
    },
    situation: [
      "The NHL needed production-ready GenAI infrastructure. The existing ML platform was not built for LLM-scale training or inference, and cost attribution was opaque — leadership had no way to evaluate whether a given LLM-powered feature was carrying its weight.",
      "The environment was Azure-first. Any platform built here had to respect existing enterprise agreements, security postures, and identity boundaries, and had to move the work from shared notebooks to a defensible, observable service.",
    ],
    task: [
      "Stand up an LLMOps platform capable of distributed training, production inference with bounded latency, and end-to-end observability.",
      "Expose per-request cost attribution so feature teams could be charged back accurately and leadership could evaluate ROI at the individual feature level.",
      "Keep the platform defensible from a security standpoint: private networking, scoped identity, auditable model storage, and reproducible training runs.",
    ],
    action: {
      intro:
        "Architected an LLMOps platform on Azure with a clean separation between the training tier, the inference tier, and the observability and cost-attribution layer that spans both. Every design choice was tested against a single question: does this make per-request cost visible?",
      moves: [
        {
          heading: "Distributed training on Azure ML",
          detail:
            "PyTorch DDP for smaller models and FSDP for models above the single-GPU memory ceiling, running across 8× NVIDIA A100s on Azure ML compute. Checkpoint strategy tuned so failure-restart economics did not dominate wall-clock cost.",
        },
        {
          heading: "vLLM inference on AKS",
          detail:
            "vLLM with paged attention deployed on Azure Kubernetes Service, with separate request classes for latency-sensitive traffic and batch workloads. Autoscaling driven by request-class-aware metrics, not raw CPU.",
        },
        {
          heading: "Per-request cost attribution",
          detail:
            "Custom middleware tagged every inference with tenant, feature, model, and a cost envelope. A daily pipeline aggregated usage into feature-level chargeback reports — the first time leadership could ask ROI questions at that granularity.",
        },
        {
          heading: "End-to-end observability",
          detail:
            "MLflow for experiment and model-lineage tracking, Azure Monitor and Prometheus for infra and request metrics, and structured logs traceable from request ID to GPU-second. Drift and quality gates ran on a held-out evaluation set on a fixed cadence.",
        },
        {
          heading: "Security posture by default",
          detail:
            "Private Endpoints on model and artifact storage, Key Vault-backed secrets, RBAC-scoped compute, and reproducible training runs anchored to specific commits, datasets, and compute SKUs.",
        },
      ],
    },
    result: {
      primary:
        "Production GenAI on Azure with full cost observability, including per-request cost attribution that enabled ROI evaluation at the individual feature level.",
      secondary: [
        "Monthly chargeback reports became a standard input to feature prioritization — features were evaluated on ROI, not enthusiasm.",
        "Inference latency SLAs held at target p95 under production load across request classes.",
        "Training wall-clock time dropped meaningfully after FSDP + activation-checkpointing tuning.",
        "Full reproducibility — every model in production traced to a specific commit, dataset version, and compute configuration.",
      ],
      metrics: [
        { label: "Training hardware", value: "8× A100" },
        { label: "Inference runtime", value: "vLLM on AKS" },
        { label: "Cost granularity", value: "Per request" },
        { label: "Lineage", value: "MLflow-tracked" },
      ],
    },
    portable: [
      "Bake per-request cost into the inference path from day one. Retrofitting cost attribution onto an LLM system that was not designed for it is an entire second project.",
      "FSDP pays off once models cross the single-GPU memory ceiling. Below that line, DDP is simpler and usually faster.",
      "Treat LLM evaluation as a CI gate, not a quarterly exercise. Quality regressions compound silently otherwise.",
    ],
    technologies: [
      "Azure ML",
      "Azure Kubernetes Service",
      "PyTorch DDP / FSDP",
      "vLLM",
      "NVIDIA A100",
      "MLflow",
      "Azure Monitor",
      "Private Endpoints",
    ],
  },
] as const;

export function getCaseStudy(slug: string) {
  return CASE_STUDIES.find((study) => study.slug === slug) ?? null;
}
