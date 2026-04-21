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
  summary: string;
  outcomeStat: string;
  outcomeHeadline: string;
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
    slug: "ai-ivr-urgent-care",
    title: "HIPAA-Compliant AI IVR Cuts Urgent Care Wait Time from 94 to 22 Minutes",
    summary:
      "A HIPAA-compliant AI IVR with EMR integration reduced average wait time by 77% without adding staff.",
    outcomeStat: "77% reduction in wait time",
    outcomeHeadline:
      "Average wait time dropped from 94 minutes to 22 minutes — a 77% reduction — without any change to staffing levels.",
    glance: {
      industry: "Healthcare — regional urgent-care network",
      timeframe: "90-day design, build, and phased rollout",
      environment: "Azure, HIPAA-regulated, EMR-integrated",
    },
    situation: [
      "A regional urgent-care network was losing patients at the front door. Peak-hour intake lines backed up at multiple clinics, and the average patient wait time had crept to 94 minutes. Every minute over 30 correlated with higher abandonment and worse clinical satisfaction scores.",
      "The network could not meaningfully expand headcount in the near term. Any solution had to run entirely inside a HIPAA posture — PHI encrypted in transit and at rest, Business Associate Agreements honored at every boundary, and auditable logs retained for the statutory window.",
    ],
    task: [
      "Cut the average patient wait time by more than half without adding intake staff.",
      "Integrate with the existing EMR so the IVR could authenticate patients, look up upcoming appointments, and route callbacks back into the scheduling system of record.",
      "Ship to production inside 90 days and pass a full HIPAA audit before the first patient call hit the new system.",
    ],
    action: {
      intro:
        "Delivered as a three-tier flow (triage → intake routing → callback queue) on Azure, scoped tight to the intake-call domain. No general-purpose assistant, no clever edge cases — just the top intents that covered the overwhelming majority of call volume.",
      moves: [
        {
          heading: "Narrow NLU, built for intake",
          detail:
            "Trained an intent model focused on the top intake paths (appointment, prescription, triage escalation, billing, transfer). Refused to automate long-tail intents on day one — staff kept the long tail, the model kept its accuracy.",
        },
        {
          heading: "HIPAA-scoped architecture",
          detail:
            "VNet-isolated inference endpoints behind Private Link, Key Vault-managed PHI encryption keys, audit logs written to immutable storage with 7-year retention, and BAA boundaries verified at every service edge.",
        },
        {
          heading: "EMR integration via private scheduling API",
          detail:
            "Patient authentication and appointment lookup ran over a Private Link path to the EMR's scheduling API. Callback routing wrote back into the same system of record so staff never saw a second queue to reconcile.",
        },
        {
          heading: "Graceful human handoff",
          detail:
            "A break-glass escalation path was built in from day one. If confidence dropped or the patient asked for a person, the call routed to the existing intake team with full conversational context attached — no repeat, no friction.",
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
        "Average wait time dropped from 94 minutes to 22 minutes — a 77% reduction — without any change to staffing levels.",
      secondary: [
        "Call abandonment rate fell from 18% to 4% within the first 90 days of full rollout.",
        "Intake staff hours reallocated from phone queue triage to higher-touch patient-facing work.",
        "HIPAA audit passed on first review with no findings on the new system boundary.",
        "99.95% system availability across the first six months post-launch.",
      ],
      metrics: [
        { label: "Wait time reduction", value: "77%" },
        { label: "Abandonment drop", value: "18% → 4%" },
        { label: "Audit findings on launch", value: "0" },
        { label: "Delivery window", value: "90 days" },
      ],
    },
    portable: [
      "Start with the 20% of intents that cover 80% of calls. Long-tail intents belong to humans until the model earns them.",
      "Scope PHI inside the inference boundary from the first line of code. Retrofitting compliance is where schedule and budget go to die.",
      "Build the break-glass handoff before the first patient call. Trust in the system grows faster than trust in any single model.",
    ],
    technologies: ["Azure", "AI / NLP", "IVR", "HIPAA", "EMR integration", "Private Link", "Key Vault"],
  },
  {
    slug: "aws-partner-architecture",
    title: "Well-Architected Reviews at Scale: $200M+ in Customer Revenue Influenced",
    summary:
      "Led Well-Architected delivery across dozens of partner and customer accounts, with prioritized remediation tied to real spend and risk.",
    outcomeStat: "$60M+ closed · $200M+ influenced",
    outcomeHeadline:
      "$60M+ in partner contracts closed, $200M+ in customer cloud spend influenced, and cost reductions ranging from 20% to 70% delivered across engagements.",
    glance: {
      industry: "Homebuilding, construction, media, enterprise software",
      timeframe: "Multi-year delivery across dozens of accounts",
      environment: "AWS, Well-Architected Framework, multi-account landing zones",
    },
    situation: [
      "An AWS partner ecosystem needed scalable architecture review delivery across mid-market and enterprise accounts. Generic reviews — checklists, screenshots, thirty-page PDFs — were not moving the needle. Findings were landing as shelfware.",
      "Partners needed technical architecture support credible enough to close deals and retain accounts, with cost and risk findings that executive buyers could actually act on.",
    ],
    task: [
      "Deliver Well-Architected reviews across dozens of customer accounts with consistent depth and quality.",
      "Translate every finding into business-language impact — dollars saved, risk avoided, delivery unblocked.",
      "Build reusable playbooks so partner teams could carry remediation after the review, not stall once the formal engagement closed.",
    ],
    action: {
      intro:
        "Applied the AWS Well-Architected Framework's six pillars — operational excellence, security, reliability, performance efficiency, cost optimization, and sustainability — per engagement. Treated every finding as a delivery contract with the customer's engineering team, not a slide in a deck.",
      moves: [
        {
          heading: "Pillar-based review with evidence",
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
        "$60M+ in partner contracts closed, $200M+ in customer cloud spend influenced, and cost reductions ranging from 20% to 70% delivered across engagements.",
      secondary: [
        "Typical engagement produced 30–45% cloud cost reduction within six months of remediation.",
        "Average review-to-remediation cycle shortened to roughly six weeks.",
        "Remediation completion rate held above 75% inside six months post-engagement — well above the industry norm.",
        "Review templates and playbooks became standard delivery artifacts across the partner organization.",
      ],
      metrics: [
        { label: "Partner contracts closed", value: "$60M+" },
        { label: "Customer revenue influenced", value: "$200M+" },
        { label: "Cost reduction range", value: "20–70%" },
        { label: "Remediation completion", value: "~75% @ 6 mo" },
      ],
    },
    portable: [
      "Tie every technical finding to a dollar or risk number. Otherwise it will not get prioritized, no matter how correct it is.",
      "Write two documents — executive and engineering — not one hybrid. Different readers, different decisions, different failure modes.",
      "Leave every prioritized finding with a named remediation owner on the customer side before the engagement closes.",
    ],
    technologies: ["AWS", "Well-Architected Framework", "IAM", "VPC design", "Cost allocation tags", "Landing zones"],
  },
  {
    slug: "nhl-azure-llmops",
    title: "Production LLMOps on Azure: Multi-GPU Training and Per-Request Cost Attribution for the NHL",
    summary:
      "An Azure LLMOps platform with multi-GPU training, vLLM inference, and per-request cost attribution took production GenAI from opaque to observable.",
    outcomeStat: "Per-request cost attribution in production",
    outcomeHeadline:
      "Production GenAI deployed on Azure with full cost observability, including per-request cost attribution that enabled ROI evaluation at the individual feature level.",
    glance: {
      industry: "Professional sports — enterprise AI",
      timeframe: "Phased production rollout on Azure",
      environment: "Azure ML, AKS, 8× NVIDIA A100, PyTorch DDP/FSDP, vLLM",
    },
    situation: [
      "A professional sports organization needed production-ready GenAI infrastructure. The existing ML platform was not built for LLM-scale training or inference, and cost attribution was opaque — leadership had no way to evaluate whether a given LLM-powered feature was carrying its weight.",
      "The environment was Azure-first. Any platform built here had to respect existing enterprise agreements, security postures, and identity boundaries.",
    ],
    task: [
      "Stand up an LLMOps platform capable of distributed training, production inference with bounded latency, and end-to-end observability.",
      "Expose per-request cost attribution so feature teams could be charged back accurately and leadership could evaluate ROI at the individual feature level.",
      "Keep the platform defensible from a security standpoint: private networking, scoped identity, auditable model storage, and reproducible training runs.",
    ],
    action: {
      intro:
        "Architected and deployed an LLMOps platform on Azure with a clean separation between the training tier, inference tier, and the observability and cost-attribution layer that spans both. Every design choice was tested against a single question: does this make per-request cost visible?",
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
        "Production GenAI deployed on Azure with full cost observability, including per-request cost attribution that enabled ROI evaluation at the individual feature level.",
      secondary: [
        "Monthly chargeback reports became a standard input to feature prioritization — features were evaluated on ROI, not enthusiasm.",
        "Inference latency SLAs held at target p95 under production load across request classes.",
        "Training wall-clock time dropped meaningfully after FSDP + activation-checkpointing tuning.",
        "Full reproducibility — every model in production traced to a specific commit, dataset version, and compute configuration.",
      ],
      metrics: [
        { label: "Cost attribution granularity", value: "Per request" },
        { label: "Training hardware", value: "8× A100" },
        { label: "Inference runtime", value: "vLLM on AKS" },
        { label: "Experiment lineage", value: "MLflow-tracked" },
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
