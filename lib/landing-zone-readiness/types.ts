import { z } from "zod";

export const LANDING_ZONE_READINESS_VERSION = "1.0" as const;

export const cloudProviderSchema = z.enum(["aws", "azure", "gcp"]);
export type CloudProvider = z.infer<typeof cloudProviderSchema>;

export const yesPartialNoSchema = z.enum(["yes", "partial", "no"]);
export type YesPartialNo = z.infer<typeof yesPartialNoSchema>;

export const manualProductionChangeSchema = z.enum(["blocked", "emergency_only", "allowed"]);
export type ManualProductionChange = z.infer<typeof manualProductionChangeSchema>;

export const environmentCountSchema = z.enum(["1", "2", "3", "4_plus"]);
export type EnvironmentCount = z.infer<typeof environmentCountSchema>;

export const regionCountSchema = z.enum(["1", "2_3", "4_plus"]);
export type RegionCount = z.infer<typeof regionCountSchema>;

export const employeeCountSchema = z.enum(["1_25", "26_100", "101_500", "500_plus"]);
export type EmployeeCount = z.infer<typeof employeeCountSchema>;

export const engineeringTeamSizeSchema = z.enum(["1_5", "6_20", "21_50", "51_plus"]);
export type EngineeringTeamSize = z.infer<typeof engineeringTeamSizeSchema>;

export const maturityBandSchema = z.enum([
  "Strong Foundation",
  "Usable but Gapped",
  "At Risk",
  "Fragile Foundation",
]);
export type MaturityBand = z.infer<typeof maturityBandSchema>;

export const findingSeveritySchema = z.enum(["low", "medium", "high"]);
export type FindingSeverity = z.infer<typeof findingSeveritySchema>;

export const quoteTierSchema = z.enum([
  "Advisory Review",
  "Foundation Fix Sprint",
  "Landing Zone Hardening",
  "Custom Scope Required",
]);
export type QuoteTier = z.infer<typeof quoteTierSchema>;

export const quoteConfidenceSchema = z.enum(["high", "medium", "low"]);
export type QuoteConfidence = z.infer<typeof quoteConfidenceSchema>;

export const readinessCategorySchema = z.enum([
  "identity_access",
  "org_structure",
  "network_foundation",
  "security_baseline",
  "logging_monitoring",
  "backup_dr",
  "iac_delivery",
  "cost_governance",
  "environment_separation",
  "operations_readiness",
]);
export type ReadinessCategory = z.infer<typeof readinessCategorySchema>;

const websiteRegex = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i;

export const landingZoneReadinessAnswersBaseSchema = z.object({
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

    numberOfEnvironments: environmentCountSchema,
    numberOfRegions: regionCountSchema,
    employeeCount: employeeCountSchema,
    engineeringTeamSize: engineeringTeamSizeSchema,
    handlesSensitiveData: z.boolean(),

    hasSso: yesPartialNoSchema,
    enforcesMfa: yesPartialNoSchema,
    centralizedIdentity: yesPartialNoSchema,
    breakGlassProcess: yesPartialNoSchema,
    documentedRbac: yesPartialNoSchema,
    serviceAccountHygiene: yesPartialNoSchema,

    usesOrgHierarchy: yesPartialNoSchema,
    separateCloudAccounts: yesPartialNoSchema,
    sharedServicesModel: yesPartialNoSchema,
    guardrailsPolicy: yesPartialNoSchema,

    standardNetworkArchitecture: yesPartialNoSchema,
    productionIsolation: yesPartialNoSchema,
    ingressEgressControls: yesPartialNoSchema,
    privateConnectivity: yesPartialNoSchema,
    documentedDnsStrategy: yesPartialNoSchema,
    networkCleanup: yesPartialNoSchema,

    secretsManagement: yesPartialNoSchema,
    keyManagement: yesPartialNoSchema,
    baselineSecurityLogging: yesPartialNoSchema,
    vulnerabilityScanning: yesPartialNoSchema,
    privilegeReviews: yesPartialNoSchema,
    patchingOwnership: yesPartialNoSchema,

    centralizedLogs: yesPartialNoSchema,
    metricsDashboards: yesPartialNoSchema,
    alertingCoverage: yesPartialNoSchema,

    backupCoverage: yesPartialNoSchema,
    restoreTesting: yesPartialNoSchema,
    definedRecoveryTargets: yesPartialNoSchema,
    crossRegionResilience: yesPartialNoSchema,
    drDocumentation: yesPartialNoSchema,

    infrastructureAsCode: yesPartialNoSchema,
    changesViaCiCd: yesPartialNoSchema,
    manualProductionChanges: manualProductionChangeSchema,
    codeReviewRequired: yesPartialNoSchema,
    driftDetection: yesPartialNoSchema,

    taggingStandard: yesPartialNoSchema,
    budgetAlerts: yesPartialNoSchema,
    resourceOwnership: yesPartialNoSchema,
    lifecycleCleanup: yesPartialNoSchema,
    nonProdShutdown: yesPartialNoSchema,

    clearEnvironmentSeparation: yesPartialNoSchema,

    runbooks: yesPartialNoSchema,
    onCallOwnership: yesPartialNoSchema,
    incidentResponseProcess: yesPartialNoSchema,

    biggestChallenge: z.string().trim().max(500).optional().default(""),
  });

export const landingZoneReadinessAnswersSchema = landingZoneReadinessAnswersBaseSchema.superRefine((input, ctx) => {
    if (input.secondaryCloud && input.secondaryCloud === input.primaryCloud) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryCloud"],
        message: "Secondary cloud must be different from the primary cloud.",
      });
    }
  });
export type LandingZoneReadinessAnswers = z.infer<typeof landingZoneReadinessAnswersSchema>;

export const landingZoneReadinessFindingSchema = z.object({
  ruleId: z.string().trim().min(1).max(80),
  category: readinessCategorySchema,
  pointsDeducted: z.number().int().min(1).max(15),
  severity: findingSeveritySchema,
  finding: z.string().trim().min(1).max(140),
  fix: z.string().trim().min(1).max(180),
});
export type LandingZoneReadinessFinding = z.infer<typeof landingZoneReadinessFindingSchema>;

export const landingZoneReadinessQuoteSchema = z.object({
  quoteTier: quoteTierSchema,
  quoteLow: z.number().int().min(0),
  quoteHigh: z.number().int().min(0),
  confidence: quoteConfidenceSchema,
  rationaleLines: z.array(z.string().trim().min(1).max(140)).max(3),
});
export type LandingZoneReadinessQuote = z.infer<typeof landingZoneReadinessQuoteSchema>;

export const landingZoneReadinessReportSchema = z.object({
  reportVersion: z.literal(LANDING_ZONE_READINESS_VERSION),
  generatedAtISO: z.string().datetime({ offset: true }),
  overallScore: z.number().int().min(0).max(100),
  categoryScores: z.record(readinessCategorySchema, z.number().int().min(0).max(100)),
  maturityBand: maturityBandSchema,
  findings: z.array(landingZoneReadinessFindingSchema).max(12),
  quote: landingZoneReadinessQuoteSchema,
  summaryLine: z.string().trim().min(1).max(200),
});
export type LandingZoneReadinessReport = z.infer<typeof landingZoneReadinessReportSchema>;

export const landingZoneReadinessSubmissionResponseSchema = z.union([
  z.object({
    status: z.literal("sent"),
    overallScore: z.number().int().min(0).max(100),
    maturityBand: maturityBandSchema,
    quoteTier: quoteTierSchema,
  }),
  z.object({
    status: z.literal("fallback"),
    overallScore: z.number().int().min(0).max(100),
    maturityBand: maturityBandSchema,
    quoteTier: quoteTierSchema,
    reason: z.string().trim().min(1).max(240),
  }),
  z.object({
    error: z.string().trim().min(1).max(240),
  }),
]);
export type LandingZoneReadinessSubmissionResponse = z.infer<typeof landingZoneReadinessSubmissionResponseSchema>;
