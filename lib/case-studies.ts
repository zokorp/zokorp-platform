export type CaseStudy = {
  slug: string;
  title: string;
  summary: string;
  context: string;
  challenge: string;
  approach: string;
  outcome: string;
  outcomeStat: string;
  technologies: readonly string[];
};

export const CASE_STUDIES: readonly CaseStudy[] = [
  {
    slug: "ai-ivr-urgent-care",
    title: "HIPAA-Compliant AI IVR Cuts Urgent Care Wait Time from 94 to 22 Minutes",
    summary:
      "A HIPAA-compliant AI IVR with EMR integration reduced average wait time by 77% without adding staff.",
    context:
      "Regional urgent care network needed to reduce patient wait times without adding staff.",
    challenge:
      "Call volume was overwhelming intake staff. Patients were waiting an average of 94 minutes at peak hours. The system had to be HIPAA-compliant and integrate with the existing EMR.",
    approach:
      "Designed and built an AI-powered IVR system with EMR integration, natural language understanding for intake routing, and HIPAA-compliant data handling throughout the conversation flow.",
    outcome:
      "Average wait time dropped from 94 minutes to 22 minutes — a 77% reduction — without changes to staffing levels.",
    outcomeStat: "77% reduction in wait time",
    technologies: ["Azure", "AI / NLP", "IVR", "HIPAA", "EMR integration"],
  },
  {
    slug: "aws-partner-architecture",
    title: "Well-Architected Reviews at Scale: $200M+ in Customer Revenue Influenced",
    summary:
      "Led Well-Architected delivery across dozens of partner and customer accounts, with prioritized remediation tied to real spend and risk.",
    context:
      "AWS partner ecosystem required scalable architecture review delivery across mid-market and enterprise accounts.",
    challenge:
      "Partners needed credible technical architecture support to close and retain accounts. Generic reviews weren't driving measurable cost or risk outcomes.",
    approach:
      "Led Well-Architected review delivery across dozens of accounts in homebuilding, construction, media, and enterprise software. Each engagement produced a prioritized remediation plan with cost and risk findings.",
    outcome:
      "$60M+ in partner contracts closed. $200M+ in customer revenue influenced. 20–70% cloud cost reductions delivered across engagements.",
    outcomeStat: "$60M+ closed, $200M+ influenced",
    technologies: ["AWS", "Well-Architected Framework", "IAM", "Networking", "Cost optimization"],
  },
  {
    slug: "nhl-azure-llmops",
    title: "Production LLMOps on Azure: Multi-GPU Training and Per-Request Cost Attribution for the NHL",
    summary:
      "Built an LLMOps platform on Azure with multi-GPU training, vLLM inference, and per-request cost attribution for production GenAI.",
    context:
      "Professional sports organization needed production-ready GenAI infrastructure on Azure with cost visibility at the request level.",
    challenge:
      "Existing ML infrastructure wasn't built for LLM-scale training or inference. Cost attribution was opaque — no visibility into per-request economics.",
    approach:
      "Architected and deployed an LLMOps platform on Azure with multi-GPU distributed training using PyTorch DDP/FSDP across 8x A100s, vLLM for inference, and custom instrumentation for per-request cost attribution.",
    outcome:
      "Production GenAI deployed on Azure with full cost observability. Per-request cost attribution enabled ROI tracking at the feature level.",
    outcomeStat: "Per-request cost attribution in production",
    technologies: ["Azure", "PyTorch DDP / FSDP", "vLLM", "A100 GPUs", "MLflow", "LLMOps"],
  },
] as const;

export function getCaseStudy(slug: string) {
  return CASE_STUDIES.find((study) => study.slug === slug) ?? null;
}
