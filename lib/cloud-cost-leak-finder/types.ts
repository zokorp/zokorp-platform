import { z } from "zod";

export const CLOUD_COST_LEAK_FINDER_VERSION = "1.0" as const;

export const cloudProviderSchema = z.enum(["aws", "azure", "gcp", "other"]);
export type CloudProvider = z.infer<typeof cloudProviderSchema>;

export const followUpQuestionIdSchema = z.enum([
  "monthlySpendBand",
  "workloadScope",
  "ownershipClarity",
  "budgetsAlerts",
  "customerCriticality",
  "nonProdRuntime",
  "rightsizingCadence",
  "kubernetesUtilization",
  "storageLifecycle",
  "crossRegionTraffic",
  "databaseRightSizing",
  "commitmentCoverage",
  "architectureFlexibility",
  "costVisibility",
]);
export type FollowUpQuestionId = z.infer<typeof followUpQuestionIdSchema>;

export const spendBandSchema = z.enum(["under_5k", "5k_to_15k", "15k_to_50k", "50k_plus"]);
export type SpendBand = z.infer<typeof spendBandSchema>;

export const workloadScopeSchema = z.enum(["one_workload", "a_few_systems", "many_systems"]);
export type WorkloadScope = z.infer<typeof workloadScopeSchema>;

export const ownershipClaritySchema = z.enum(["clear", "partial", "unclear"]);
export type OwnershipClarity = z.infer<typeof ownershipClaritySchema>;

export const guardrailStrengthSchema = z.enum(["strong", "partial", "none"]);
export type GuardrailStrength = z.infer<typeof guardrailStrengthSchema>;

export const customerCriticalitySchema = z.enum(["internal", "customer_facing", "highly_sensitive"]);
export type CustomerCriticality = z.infer<typeof customerCriticalitySchema>;

export const runtimeControlSchema = z.enum(["mostly_off", "mixed", "always_on"]);
export type RuntimeControl = z.infer<typeof runtimeControlSchema>;

export const cadenceSchema = z.enum(["regular", "occasional", "rare"]);
export type Cadence = z.infer<typeof cadenceSchema>;

export const understandingSchema = z.enum(["understood", "partial", "unknown"]);
export type Understanding = z.infer<typeof understandingSchema>;

export const yesPartialNoSchema = z.enum(["yes", "partial", "no"]);
export type YesPartialNo = z.infer<typeof yesPartialNoSchema>;

export const trafficPatternSchema = z.enum(["low", "some", "high"]);
export type TrafficPattern = z.infer<typeof trafficPatternSchema>;

export const architectureFlexibilitySchema = z.enum(["cleanup_first", "some_redesign", "major_redesign"]);
export type ArchitectureFlexibility = z.infer<typeof architectureFlexibilitySchema>;

export const costVisibilitySchema = z.enum(["clear", "partial", "weak"]);
export type CostVisibility = z.infer<typeof costVisibilitySchema>;

export const followUpAnswerValueSchema = z.union([
  spendBandSchema,
  workloadScopeSchema,
  ownershipClaritySchema,
  guardrailStrengthSchema,
  customerCriticalitySchema,
  runtimeControlSchema,
  cadenceSchema,
  understandingSchema,
  yesPartialNoSchema,
  trafficPatternSchema,
  architectureFlexibilitySchema,
  costVisibilitySchema,
]);
export type FollowUpAnswerValue = z.infer<typeof followUpAnswerValueSchema>;

export const workloadSignalSchema = z.enum([
  "web_app_saas",
  "apis_services",
  "data_platform_analytics",
  "kubernetes",
  "vms",
  "serverless",
  "databases",
  "ai_ml_gpu",
  "storage_heavy",
  "networking_heavy",
]);
export type WorkloadSignal = z.infer<typeof workloadSignalSchema>;

export const costPainSignalSchema = z.enum([
  "rapid_growth",
  "unknown_spend_drivers",
  "idle_non_prod_waste",
  "oversized_compute",
  "storage_sprawl",
  "egress_network_costs",
  "database_cost_inflation",
  "kubernetes_inefficiency",
  "gpu_waste",
  "duplicate_environments",
  "overengineered_ha_dr",
  "lack_resource_ownership_tagging",
  "poor_budgeting_alerting",
  "vendor_commitment_gaps",
]);
export type CostPainSignal = z.infer<typeof costPainSignalSchema>;

export const complexitySignalSchema = z.enum([
  "production_critical",
  "regulated_or_sensitive",
  "customer_facing",
  "high_availability_constraints",
  "multi_region",
  "high_data_transfer",
  "many_teams_or_unclear_owners",
  "multi_cloud",
]);
export type ComplexitySignal = z.infer<typeof complexitySignalSchema>;

export const maturityStateSchema = z.enum(["present", "missing", "unknown"]);
export type MaturityState = z.infer<typeof maturityStateSchema>;

export const spendFamilySchema = z.enum([
  "compute",
  "object_storage",
  "database",
  "networking",
  "kubernetes",
  "serverless",
  "analytics",
  "ai_ml",
  "logging",
  "backups",
  "other",
]);
export type SpendFamily = z.infer<typeof spendFamilySchema>;

export const wasteCategorySchema = z.enum([
  "IDLE_NON_PROD",
  "OVERPROVISIONED_COMPUTE",
  "WEAK_AUTOSCALING",
  "KUBERNETES_INEFFICIENCY",
  "DATABASE_OVERSPEND",
  "STORAGE_LIFECYCLE_GAPS",
  "BACKUP_SNAPSHOT_SPRAWL",
  "LOG_RETENTION_SPRAWL",
  "NETWORK_EGRESS_WASTE",
  "UNCLEAR_RESOURCE_OWNERSHIP",
  "TAGGING_GAPS",
  "NO_BUDGET_ALERTS",
  "COMMITMENT_GAPS",
  "OVERENGINEERED_ARCHITECTURE",
  "GPU_WASTE",
  "MANAGED_SERVICE_MISMATCH",
  "TOO_MANY_ENVIRONMENTS",
  "NEEDS_REAL_BILLING_DATA",
]);
export type WasteCategory = z.infer<typeof wasteCategorySchema>;

export const verdictClassSchema = z.enum([
  "QUICK_WINS_LIKELY",
  "MODERATE_SAVINGS_WITH_DISCIPLINE_GAPS",
  "SAVINGS_REQUIRE_ARCHITECTURE_CHANGES",
  "BILLING_DATA_NEEDED",
  "ALREADY_FAIRLY_DISCIPLINED",
  "HIGH_COMPLEXITY_REVIEW_RECOMMENDED",
]);
export type VerdictClass = z.infer<typeof verdictClassSchema>;

export const findingSeveritySchema = z.enum(["low", "medium", "high"]);
export type FindingSeverity = z.infer<typeof findingSeveritySchema>;

export const quoteTierSchema = z.enum([
  "Cost Triage Call",
  "Savings Opportunity Memo",
  "FinOps Cleanup Sprint",
  "Architecture Cost Review",
  "Cost + Platform Rationalization Sprint",
  "Custom Scope Required",
]);
export type QuoteTier = z.infer<typeof quoteTierSchema>;

export const quoteConfidenceSchema = z.enum(["high", "medium", "low"]);
export type QuoteConfidence = z.infer<typeof quoteConfidenceSchema>;

const websiteRegex = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i;

export const cloudCostLeakFinderAnswersBaseSchema = z.object({
  email: z.string().trim().email().max(160),
  fullName: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(2).max(160),
  roleTitle: z.string().trim().min(2).max(160),
  website: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(websiteRegex, "Enter a valid company website or domain."),
  primaryCloud: cloudProviderSchema,
  secondaryCloud: cloudProviderSchema.optional(),
  narrativeInput: z.string().trim().min(20).max(4000),
  billingSummaryInput: z.string().trim().max(6000).optional().default(""),
  adaptiveAnswers: z
    .partialRecord(followUpQuestionIdSchema, z.string().trim().min(1).max(40))
    .optional()
    .default({}),
});

export const cloudCostLeakFinderAnswersSchema = cloudCostLeakFinderAnswersBaseSchema.superRefine(
  (input, ctx) => {
    if (input.secondaryCloud && input.secondaryCloud === input.primaryCloud) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryCloud"],
        message: "Secondary cloud must be different from the primary cloud.",
      });
    }
  },
);
export type CloudCostLeakFinderAnswers = z.infer<typeof cloudCostLeakFinderAnswersSchema>;

export const cloudCostLeakFinderScoreSetSchema = z.object({
  wasteRiskScore: z.number().int().min(0).max(100),
  finopsMaturityScore: z.number().int().min(0).max(100),
  savingsConfidenceScore: z.number().int().min(0).max(100),
  implementationComplexityScore: z.number().int().min(0).max(100),
  roiPlausibilityScore: z.number().int().min(0).max(100),
  confidenceScore: z.number().int().min(0).max(100),
});
export type CloudCostLeakFinderScoreSet = z.infer<typeof cloudCostLeakFinderScoreSetSchema>;

export const cloudCostLeakFinderSavingsEstimateSchema = z.object({
  likelyMonthlySavingsLow: z.number().int().min(0),
  likelyMonthlySavingsHigh: z.number().int().min(0),
  likelyAnnualSavingsLow: z.number().int().min(0),
  likelyAnnualSavingsHigh: z.number().int().min(0),
  estimatedMonthlySavingsRange: z.string().trim().min(1).max(80),
  estimatedAnnualSavingsRange: z.string().trim().min(1).max(80),
});
export type CloudCostLeakFinderSavingsEstimate = z.infer<typeof cloudCostLeakFinderSavingsEstimateSchema>;

export const cloudCostLeakFinderFindingSchema = z.object({
  category: wasteCategorySchema,
  severity: findingSeveritySchema,
  finding: z.string().trim().min(1).max(180),
  fix: z.string().trim().min(1).max(180),
});
export type CloudCostLeakFinderFinding = z.infer<typeof cloudCostLeakFinderFindingSchema>;

export const cloudCostLeakFinderQuoteLineItemSchema = z.object({
  label: z.string().trim().min(1).max(140),
  amountLow: z.number().int().min(0),
  amountHigh: z.number().int().min(0),
  reason: z.string().trim().min(1).max(180),
});
export type CloudCostLeakFinderQuoteLineItem = z.infer<typeof cloudCostLeakFinderQuoteLineItemSchema>;

export const cloudCostLeakFinderQuoteSchema = z.object({
  engagementType: quoteTierSchema,
  quoteLow: z.number().int().min(0),
  quoteHigh: z.number().int().min(0),
  confidence: quoteConfidenceSchema,
  lineItems: z.array(cloudCostLeakFinderQuoteLineItemSchema).min(1).max(8),
  rationaleLines: z.array(z.string().trim().min(1).max(180)).max(3),
});
export type CloudCostLeakFinderQuote = z.infer<typeof cloudCostLeakFinderQuoteSchema>;

export const cloudCostLeakFinderReportSchema = z.object({
  reportVersion: z.literal(CLOUD_COST_LEAK_FINDER_VERSION),
  generatedAtISO: z.string().datetime({ offset: true }),
  scores: cloudCostLeakFinderScoreSetSchema,
  likelyWasteCategories: z.array(wasteCategorySchema).min(1).max(6),
  savingsEstimate: cloudCostLeakFinderSavingsEstimateSchema,
  topFindings: z.array(cloudCostLeakFinderFindingSchema).max(12),
  topActions: z.array(z.string().trim().min(1).max(180)).max(5),
  quote: cloudCostLeakFinderQuoteSchema,
  verdictClass: verdictClassSchema,
  verdictHeadline: z.string().trim().min(1).max(140),
  shortSummary: z.string().trim().min(1).max(280),
  primaryCauseLine: z.string().trim().min(1).max(220),
  firstStepLine: z.string().trim().min(1).max(180),
  extractedSignals: z.object({
    providers: z.array(cloudProviderSchema),
    workloadSignals: z.array(workloadSignalSchema),
    costPainSignals: z.array(costPainSignalSchema),
    complexitySignals: z.array(complexitySignalSchema),
    maturitySignals: z.object({
      budgets: maturityStateSchema,
      tagging: maturityStateSchema,
      ownership: maturityStateSchema,
      autoscaling: maturityStateSchema,
      scheduledShutdowns: maturityStateSchema,
      costReviews: maturityStateSchema,
      commitments: maturityStateSchema,
      environmentSeparation: maturityStateSchema,
      cleanupProcess: maturityStateSchema,
    }),
    narrativeQuality: z.object({
      charCount: z.number().int().min(0),
      wordCount: z.number().int().min(0),
      detailBand: z.enum(["low", "medium", "high"]),
    }),
    spendSignals: z.object({
      billingSummaryProvided: z.boolean(),
      parsedServiceCount: z.number().int().min(0),
      parsedAmountCount: z.number().int().min(0),
      spendClarity: z.enum(["low", "medium", "high"]),
      dominantFamily: spendFamilySchema.nullable(),
      dominantSharePercent: z.number().int().min(0).max(100).nullable(),
      totalParsedMonthlySpend: z.number().int().min(0).nullable(),
      familyBreakdown: z.array(
        z.object({
          family: spendFamilySchema,
          amount: z.number().int().min(0),
          count: z.number().int().min(0),
        }),
      ),
      parsedServices: z.array(
        z.object({
          service: z.string().trim().min(1).max(120),
          family: spendFamilySchema,
          provider: cloudProviderSchema.optional(),
          amount: z.number().int().min(0).nullable(),
          sourceLine: z.string().trim().min(1).max(280),
        }),
      ),
    }),
  }),
  adaptiveQuestionIds: z.array(followUpQuestionIdSchema).min(5).max(7),
});
export type CloudCostLeakFinderReport = z.infer<typeof cloudCostLeakFinderReportSchema>;

export const cloudCostLeakFinderSubmissionResponseSchema = z.union([
  z.object({
    status: z.literal("sent"),
    verdictHeadline: z.string().trim().min(1).max(140),
    savingsRangeLine: z.string().trim().min(1).max(120).optional(),
  }),
  z.object({
    status: z.literal("fallback"),
    verdictHeadline: z.string().trim().min(1).max(140),
    savingsRangeLine: z.string().trim().min(1).max(120).optional(),
    reason: z.string().trim().min(1).max(240),
  }),
  z.object({
    error: z.string().trim().min(1).max(240),
  }),
]);
export type CloudCostLeakFinderSubmissionResponse = z.infer<typeof cloudCostLeakFinderSubmissionResponseSchema>;

export type FollowUpOption = {
  value: FollowUpAnswerValue;
  label: string;
  description: string;
};

export type FollowUpQuestionDefinition = {
  id: FollowUpQuestionId;
  label: string;
  detail: string;
  options: FollowUpOption[];
};
