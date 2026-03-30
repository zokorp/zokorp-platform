import { z } from "zod";

import { quoteLineItemSchema } from "@/lib/quote-line-items";
import { toolConsentSchema } from "@/lib/tool-consent";

export const ARCHITECTURE_REVIEW_VERSION = "1.0" as const;

export const architectureProviderSchema = z.enum(["aws", "azure", "gcp"]);
export type ArchitectureProvider = z.infer<typeof architectureProviderSchema>;

export const architectureDiagramFormatSchema = z.enum(["png", "jpg", "pdf", "svg"]);
export type ArchitectureDiagramFormat = z.infer<typeof architectureDiagramFormatSchema>;

export const architectureCategorySchema = z.enum([
  "clarity",
  "security",
  "reliability",
  "operations",
  "performance",
  "cost",
  "sustainability",
]);
export type ArchitectureCategory = z.infer<typeof architectureCategorySchema>;

export const architectureAnalysisConfidenceSchema = z.enum(["high", "medium", "low"]);
export type ArchitectureAnalysisConfidence = z.infer<typeof architectureAnalysisConfidenceSchema>;

export const architectureQuoteTierSchema = z.enum([
  "advisory-review",
  "remediation-sprint",
  "implementation-partner",
]);
export type ArchitectureQuoteTier = z.infer<typeof architectureQuoteTierSchema>;

export const architectureWorkloadCriticalitySchema = z.enum(["low", "standard", "mission-critical"]);
export type ArchitectureWorkloadCriticality = z.infer<typeof architectureWorkloadCriticalitySchema>;

export const architectureRegulatoryScopeSchema = z.enum(["none", "soc2", "pci", "hipaa", "other"]);
export type ArchitectureRegulatoryScope = z.infer<typeof architectureRegulatoryScopeSchema>;

export const architectureEnvironmentSchema = z.enum(["dev", "test", "prod"]);
export type ArchitectureEnvironment = z.infer<typeof architectureEnvironmentSchema>;

export const architectureLifecycleStageSchema = z.enum(["early-design", "pre-prod", "production"]);
export type ArchitectureLifecycleStage = z.infer<typeof architectureLifecycleStageSchema>;

export const architectureEngagementPreferenceSchema = z.enum([
  "review-call-only",
  "hands-on-remediation",
  "diagram-rebuild",
  "ongoing-quarterly-reviews",
  "architect-on-call",
]);
export type ArchitectureEngagementPreference = z.infer<typeof architectureEngagementPreferenceSchema>;

export const architectureRuleCatalogPricingModeSchema = z.enum(["DERIVED", "OVERRIDE"]);
export type ArchitectureRuleCatalogPricingMode = z.infer<typeof architectureRuleCatalogPricingModeSchema>;

export const architectureRuleCatalogReviewStatusSchema = z.enum(["UNREVIEWED", "DRAFT", "PUBLISHED", "STALE"]);
export type ArchitectureRuleCatalogReviewStatus = z.infer<typeof architectureRuleCatalogReviewStatusSchema>;

export const architectureFindingSchema = z.object({
  ruleId: z.string().trim().min(1).max(80),
  category: architectureCategorySchema,
  pointsDeducted: z.number().int().min(0).max(100),
  message: z.string().trim().min(1).max(120),
  fix: z.string().trim().min(1).max(160),
  evidence: z.string().trim().min(1).max(240),
  fixCostUSD: z.number().int().min(0),
});
export type ArchitectureFinding = z.infer<typeof architectureFindingSchema>;

export const architectureFindingDraftSchema = architectureFindingSchema.omit({
  fixCostUSD: true,
});
export type ArchitectureFindingDraft = z.infer<typeof architectureFindingDraftSchema>;

export const architectureReviewReportSchema = z.object({
  reportVersion: z.literal(ARCHITECTURE_REVIEW_VERSION),
  provider: architectureProviderSchema,
  overallScore: z.number().int().min(0).max(100),
  analysisConfidence: architectureAnalysisConfidenceSchema,
  quoteTier: architectureQuoteTierSchema,
  flowNarrative: z.string().trim().min(1).max(2000),
  findings: z.array(architectureFindingSchema).max(20),
  consultationQuoteUSD: z.number().int().min(0),
  consultationQuote: z.object({
    quoteLow: z.number().int().min(0),
    quoteHigh: z.number().int().min(0),
    lineItems: z.array(quoteLineItemSchema).min(1).max(6),
    rationaleLines: z.array(z.string().trim().min(1).max(180)).min(1).max(4),
  }),
  generatedAtISO: z.string().datetime({ offset: true }),
  userEmail: z.string().email(),
});
export type ArchitectureReviewReport = z.infer<typeof architectureReviewReportSchema>;

export const architectureEstimateLineItemSchema = z.object({
  ruleId: z.string().trim().min(1).max(80),
  category: architectureCategorySchema,
  pointsDeducted: z.number().int().min(0).max(100),
  serviceLineLabel: z.string().trim().min(1).max(160),
  publicFixSummary: z.string().trim().min(1).max(240),
  amountUsd: z.number().int().min(0),
  estimatedHours: z.number().min(0).max(200),
  source: z.enum(["published", "fallback"]),
  publishedRevisionId: z.string().cuid().nullable().optional(),
});
export type ArchitectureEstimateLineItem = z.infer<typeof architectureEstimateLineItemSchema>;

export const architectureEstimateSnapshotSchema = z.object({
  referenceCode: z.string().trim().min(1).max(40),
  bookingUrl: z.string().trim().url(),
  totalUsd: z.number().int().min(0),
  lineItems: z.array(architectureEstimateLineItemSchema).max(20),
  assumptions: z.array(z.string().trim().min(1).max(220)).min(1).max(6),
  exclusions: z.array(z.string().trim().min(1).max(220)).min(1).max(6),
});
export type ArchitectureEstimateSnapshot = z.infer<typeof architectureEstimateSnapshotSchema>;

export const architectureSubmissionContextSchema = z.object({
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(160).optional(),
  landingPage: z.string().trim().max(300).optional(),
  referrer: z.string().trim().max(300).optional(),
  deviceClass: z.enum(["mobile", "tablet", "desktop", "unknown"]).optional(),
});
export type ArchitectureSubmissionContext = z.infer<typeof architectureSubmissionContextSchema>;

export const architectureClientTimingSchema = z.object({
  startedAtISO: z.string().datetime({ offset: true }).optional(),
  submittedAtISO: z.string().datetime({ offset: true }).optional(),
  precheckMs: z.number().int().min(0).max(600_000).optional(),
  totalClientMs: z.number().int().min(0).max(600_000).optional(),
});
export type ArchitectureClientTiming = z.infer<typeof architectureClientTimingSchema>;

const architectureSvgDimensionsSchema = z.object({
  width: z.number().positive().max(12_000),
  height: z.number().positive().max(12_000),
});

export const architectureReviewMetadataSchema = z.object({
  diagramFormat: architectureDiagramFormatSchema.optional(),
  archiveForFollowup: z.boolean().optional(),
  saveForFollowUp: toolConsentSchema.shape.saveForFollowUp.optional(),
  allowCrmFollowUp: toolConsentSchema.shape.allowCrmFollowUp.optional(),
  title: z.string().trim().max(160).optional(),
  owner: z.string().trim().max(160).optional(),
  lastUpdated: z.string().trim().max(60).optional(),
  version: z.string().trim().max(60).optional(),
  legend: z.string().trim().max(600).optional(),
  paragraphInput: z.string().trim().min(1).max(2000).optional(),
  tokenCount: z.number().int().min(0).max(5000).optional(),
  ocrCharacterCount: z.number().int().min(0).max(50000).optional(),
  mode: z.enum(["rules-only", "webllm"]).optional(),
  workloadCriticality: architectureWorkloadCriticalitySchema.optional(),
  regulatoryScope: architectureRegulatoryScopeSchema.optional(),
  environment: architectureEnvironmentSchema.optional(),
  lifecycleStage: architectureLifecycleStageSchema.optional(),
  desiredEngagement: architectureEngagementPreferenceSchema.optional(),
  submissionContext: architectureSubmissionContextSchema.optional(),
  clientTiming: architectureClientTimingSchema.optional(),
  clientPngOcrText: z.string().trim().max(50_000).optional(),
  clientPdfText: z.string().trim().max(50_000).optional(),
  clientSvgText: z.string().trim().max(50_000).optional(),
  clientSvgDimensions: architectureSvgDimensionsSchema.optional(),
  analysisConfidence: architectureAnalysisConfidenceSchema.optional(),
});
export type ArchitectureReviewMetadata = z.infer<typeof architectureReviewMetadataSchema>;

export const submitArchitectureReviewMetadataSchema = architectureReviewMetadataSchema.extend({
  provider: architectureProviderSchema,
  paragraphInput: z.string().trim().min(1).max(2000),
});
export type SubmitArchitectureReviewMetadata = z.infer<typeof submitArchitectureReviewMetadataSchema>;

export const submitArchitectureReviewPayloadSchema = z.object({
  report: architectureReviewReportSchema,
  metadata: architectureReviewMetadataSchema,
});
export type SubmitArchitectureReviewPayload = z.infer<typeof submitArchitectureReviewPayloadSchema>;

export const architectureReviewPhaseSchema = z.enum([
  "upload-validate",
  "diagram-precheck",
  "ocr",
  "rules",
  "llm-refine",
  "package-email",
  "send-fallback",
  "completed",
]);
export type ArchitectureReviewPhase = z.infer<typeof architectureReviewPhaseSchema>;

export const llmRefinementSchema = z.object({
  flowNarrative: z.string().trim().min(1).max(2000),
  findings: z.array(architectureFindingDraftSchema).max(20),
});
export type LlmRefinement = z.infer<typeof llmRefinementSchema>;

export type ArchitectureEvidenceBundle = {
  provider: ArchitectureProvider;
  paragraph: string;
  ocrText: string;
  serviceTokens: string[];
  metadata: {
    diagramFormat?: ArchitectureDiagramFormat;
    title?: string;
    owner?: string;
    lastUpdated?: string;
    version?: string;
    legend?: string;
    workloadCriticality?: ArchitectureWorkloadCriticality;
    regulatoryScope?: ArchitectureRegulatoryScope;
    environment?: ArchitectureEnvironment;
    lifecycleStage?: ArchitectureLifecycleStage;
    desiredEngagement?: ArchitectureEngagementPreference;
  };
};
