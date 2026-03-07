import {
  COMPLEXITY_TOKENS,
  COST_PAIN_TOKENS,
  MATURITY_SIGNAL_KEYS,
  MATURITY_SIGNAL_TOKENS,
  PROVIDER_TOKENS,
  SERVICE_ALIASES,
  type MaturitySignals,
  type ServiceAliasDefinition,
  WORKLOAD_TOKENS,
} from "@/lib/cloud-cost-leak-finder/dictionaries";
import { evaluateNarrativeQuality, normalizeFreeText } from "@/lib/cloud-cost-leak-finder/input";
import type {
  CloudCostLeakFinderAnswers,
  CloudProvider,
  ComplexitySignal,
  CostPainSignal,
  SpendFamily,
  WorkloadSignal,
} from "@/lib/cloud-cost-leak-finder/types";

export type ParsedBillingService = {
  service: string;
  family: SpendFamily;
  provider?: CloudProvider;
  amount: number | null;
  sourceLine: string;
};

export type ExtractedCloudCostSignals = {
  providers: CloudProvider[];
  workloadSignals: WorkloadSignal[];
  costPainSignals: CostPainSignal[];
  complexitySignals: ComplexitySignal[];
  maturitySignals: MaturitySignals;
  narrativeQuality: {
    charCount: number;
    wordCount: number;
    detailBand: "low" | "medium" | "high";
  };
  spendSignals: {
    billingSummaryProvided: boolean;
    parsedServiceCount: number;
    parsedAmountCount: number;
    spendClarity: "low" | "medium" | "high";
    dominantFamily: SpendFamily | null;
    dominantSharePercent: number | null;
    totalParsedMonthlySpend: number | null;
    familyBreakdown: Array<{
      family: SpendFamily;
      amount: number;
      count: number;
    }>;
    parsedServices: ParsedBillingService[];
  };
};

const GENERIC_BILLING_ALIASES: Array<{
  alias: string;
  service: string;
  family: SpendFamily;
}> = [
  { alias: "compute", service: "Compute", family: "compute" },
  { alias: "instances", service: "Compute", family: "compute" },
  { alias: "storage", service: "Storage", family: "object_storage" },
  { alias: "database", service: "Database", family: "database" },
  { alias: "network", service: "Networking", family: "networking" },
  { alias: "egress", service: "Networking", family: "networking" },
  { alias: "logs", service: "Logs", family: "logging" },
  { alias: "backup", service: "Backups", family: "backups" },
  { alias: "analytics", service: "Analytics", family: "analytics" },
  { alias: "gpu", service: "GPU", family: "ai_ml" },
];

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseRegex(phrase: string) {
  const escaped = escapeRegExp(phrase).replace(/\\ /g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
}

function hasPhrase(text: string, phrase: string) {
  return phraseRegex(phrase).test(text);
}

function countMatches(text: string, phrases: string[]) {
  return phrases.reduce((count, phrase) => count + (hasPhrase(text, phrase) ? 1 : 0), 0);
}

function sortByKnownOrder<T extends string>(values: Iterable<T>, order: readonly T[]) {
  return [...new Set(values)].sort((left, right) => order.indexOf(left) - order.indexOf(right));
}

function scaleAmount(rawValue: string, suffix?: string) {
  const numeric = Number(rawValue.replaceAll(",", ""));
  if (Number.isNaN(numeric)) {
    return null;
  }

  if (suffix?.toLowerCase() === "k") {
    return Math.round(numeric * 1_000);
  }

  if (suffix?.toLowerCase() === "m") {
    return Math.round(numeric * 1_000_000);
  }

  return Math.round(numeric);
}

function parseAmountCandidates(line: string) {
  const amounts = new Map<string, { amount: number; start: number; end: number }>();
  const patterns = [
    /(?:\$|usd\s*)(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?/gi,
    /(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?\s*(?:usd|\/mo|per month|monthly)/gi,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(line);
    while (match) {
      const value = scaleAmount(match[1], match[2]);
      if (value !== null) {
        const rawStart = match.index ?? 0;
        const valueOffset = match[0].indexOf(match[1]);
        const start = rawStart + Math.max(valueOffset, 0);
        const end = start + match[1].length + (match[2]?.length ?? 0);
        amounts.set(`${start}:${end}:${value}`, {
          amount: value,
          start,
          end,
        });
      }

      match = pattern.exec(line);
    }
  }

  return [...amounts.values()].sort((left, right) => left.start - right.start);
}

function parseFallbackAmountCandidates(line: string) {
  const amounts = new Map<string, { amount: number; start: number; end: number }>();
  const pattern = /(^|[,\t: -])(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?(?=$|[,\t ]|\/)/g;
  let match = pattern.exec(line);

  while (match) {
    const value = scaleAmount(match[2], match[3]);
    if (value !== null && value >= 10) {
      const rawStart = match.index ?? 0;
      const valueOffset = match[0].indexOf(match[2]);
      const start = rawStart + Math.max(valueOffset, 0);
      const end = start + match[2].length + (match[3]?.length ?? 0);
      amounts.set(`${start}:${end}:${value}`, {
        amount: value,
        start,
        end,
      });
    }

    match = pattern.exec(line);
  }

  return [...amounts.values()].sort((left, right) => left.start - right.start);
}

function findPhraseMatches(text: string, phrase: string) {
  const escaped = escapeRegExp(phrase).replace(/\\ /g, "\\s+");
  const pattern = new RegExp(`(?:^|[^a-z0-9])(${escaped})(?=[^a-z0-9]|$)`, "gi");
  const matches: Array<{ start: number; end: number }> = [];
  let match = pattern.exec(text);

  while (match) {
    const rawStart = match.index ?? 0;
    const valueOffset = match[0].indexOf(match[1]);
    const start = rawStart + Math.max(valueOffset, 0);
    matches.push({
      start,
      end: start + match[1].length,
    });
    match = pattern.exec(text);
  }

  return matches;
}

function findServiceMatches(
  text: string,
  aliases: ServiceAliasDefinition[],
): Array<ParsedBillingService & { start: number; end: number }> {
  const matches: Array<ParsedBillingService & { start: number; end: number }> = [];

  for (const alias of aliases) {
    for (const occurrence of findPhraseMatches(text, alias.alias)) {
      matches.push({
        service: alias.service,
        family: alias.family,
        provider: alias.provider,
        amount: null,
        sourceLine: "",
        start: occurrence.start,
        end: occurrence.end,
      });
    }
  }

  return matches
    .sort((left, right) => left.start - right.start)
    .filter(
      (match, index, collection) =>
        index === 0 ||
        match.service !== collection[index - 1].service ||
        match.start !== collection[index - 1].start ||
        match.end !== collection[index - 1].end,
    );
}

function closestAmount(
  candidates: Array<{ amount: number; start: number; end: number }>,
  anchor: number,
  direction: "before" | "after",
) {
  if (candidates.length === 0) {
    return null;
  }

  const ranked = [...candidates].sort((left, right) => {
    const leftDistance = direction === "after" ? left.start - anchor : anchor - left.end;
    const rightDistance = direction === "after" ? right.start - anchor : anchor - right.end;
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return direction === "after" ? left.start - right.start : right.start - left.start;
  });

  return ranked[0]?.amount ?? null;
}

function assignAmountToServiceMatch(
  serviceMatch: ParsedBillingService & { start: number; end: number },
  index: number,
  serviceMatches: Array<ParsedBillingService & { start: number; end: number }>,
  amountMatches: Array<{ amount: number; start: number; end: number }>,
) {
  const previousBoundary = index === 0 ? 0 : serviceMatches[index - 1].end;
  const nextBoundary = index === serviceMatches.length - 1 ? Number.POSITIVE_INFINITY : serviceMatches[index + 1].start;
  const afterMatches = amountMatches.filter((candidate) => candidate.start >= serviceMatch.end && candidate.start < nextBoundary);
  if (afterMatches.length > 0) {
    return closestAmount(afterMatches, serviceMatch.end, "after");
  }

  const beforeMatches = amountMatches.filter(
    (candidate) => candidate.end <= serviceMatch.start && candidate.start >= previousBoundary,
  );
  if (beforeMatches.length > 0) {
    return closestAmount(beforeMatches, serviceMatch.start, "before");
  }

  if (serviceMatches.length === 1) {
    const anyAfter = amountMatches.filter((candidate) => candidate.start >= serviceMatch.end);
    if (anyAfter.length > 0) {
      return closestAmount(anyAfter, serviceMatch.end, "after");
    }

    const anyBefore = amountMatches.filter((candidate) => candidate.end <= serviceMatch.start);
    if (anyBefore.length > 0) {
      return closestAmount(anyBefore, serviceMatch.start, "before");
    }
  }

  return null;
}

function parseBillingServices(summary: string) {
  const normalized = summary
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const services = new Map<string, ParsedBillingService>();

  for (const line of normalized) {
    const lower = line.toLowerCase();
    const matchedAliases = findServiceMatches(lower, SERVICE_ALIASES);
    const serviceMatches =
      matchedAliases.length > 0 ? matchedAliases : findServiceMatches(lower, GENERIC_BILLING_ALIASES);

    if (serviceMatches.length === 0) {
      continue;
    }

    const amountCandidates = parseAmountCandidates(lower);
    const amountMatches = amountCandidates.length > 0 ? amountCandidates : parseFallbackAmountCandidates(lower);

    for (const [index, alias] of serviceMatches.entries()) {
      const key = `${alias.service}:${line}:${alias.start}`;
      services.set(key, {
        service: alias.service,
        family: alias.family,
        provider: alias.provider,
        amount: assignAmountToServiceMatch(alias, index, serviceMatches, amountMatches),
        sourceLine: line.slice(0, 280),
      });
    }
  }

  return [...services.values()];
}

function detectProviders(text: string, answers: CloudCostLeakFinderAnswers) {
  const providers = new Set<CloudProvider>([answers.primaryCloud]);
  if (answers.secondaryCloud) {
    providers.add(answers.secondaryCloud);
  }

  for (const [provider, phrases] of Object.entries(PROVIDER_TOKENS) as Array<[CloudProvider, string[]]>) {
    if (countMatches(text, phrases) > 0) {
      providers.add(provider);
    }
  }

  return sortByKnownOrder(providers, ["aws", "azure", "gcp", "other"]);
}

function detectWorkloads(text: string, parsedServices: ParsedBillingService[]) {
  const workloads = new Set<WorkloadSignal>();
  for (const [signal, phrases] of Object.entries(WORKLOAD_TOKENS) as Array<[WorkloadSignal, string[]]>) {
    if (countMatches(text, phrases) > 0) {
      workloads.add(signal);
    }
  }

  for (const service of parsedServices) {
    if (service.family === "compute") {
      workloads.add("vms");
    }
    if (service.family === "database") {
      workloads.add("databases");
    }
    if (service.family === "kubernetes") {
      workloads.add("kubernetes");
    }
    if (service.family === "serverless") {
      workloads.add("serverless");
    }
    if (service.family === "analytics") {
      workloads.add("data_platform_analytics");
    }
    if (service.family === "ai_ml") {
      workloads.add("ai_ml_gpu");
    }
    if (service.family === "object_storage" || service.family === "logging" || service.family === "backups") {
      workloads.add("storage_heavy");
    }
    if (service.family === "networking") {
      workloads.add("networking_heavy");
    }
  }

  return sortByKnownOrder(workloads, [
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
}

function detectCostPains(text: string) {
  const pains = new Set<CostPainSignal>();
  for (const [signal, phrases] of Object.entries(COST_PAIN_TOKENS) as Array<[CostPainSignal, string[]]>) {
    if (countMatches(text, phrases) > 0) {
      pains.add(signal);
    }
  }

  return sortByKnownOrder(pains, [
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
}

function detectComplexity(text: string, providers: CloudProvider[]) {
  const complexity = new Set<ComplexitySignal>();
  for (const [signal, phrases] of Object.entries(COMPLEXITY_TOKENS) as Array<[ComplexitySignal, string[]]>) {
    if (countMatches(text, phrases) > 0) {
      complexity.add(signal);
    }
  }

  if (providers.filter((provider) => provider !== "other").length > 1) {
    complexity.add("multi_cloud");
  }

  return sortByKnownOrder(complexity, [
    "production_critical",
    "regulated_or_sensitive",
    "customer_facing",
    "high_availability_constraints",
    "multi_region",
    "high_data_transfer",
    "many_teams_or_unclear_owners",
    "multi_cloud",
  ]);
}

function classifyMaturitySignal(text: string, key: keyof MaturitySignals) {
  const signal = MATURITY_SIGNAL_TOKENS[key];
  const presentMatches = countMatches(text, signal.present);
  const missingMatches = countMatches(text, signal.missing);

  if (presentMatches === 0 && missingMatches === 0) {
    return "unknown" as const;
  }

  return presentMatches >= missingMatches ? "present" : "missing";
}

function detectMaturitySignals(text: string) {
  return MATURITY_SIGNAL_KEYS.reduce(
    (signals, key) => {
      signals[key] = classifyMaturitySignal(text, key);
      return signals;
    },
    {} as MaturitySignals,
  );
}

function buildSpendSignals(summary: string) {
  const parsedServices = parseBillingServices(summary);
  const familyTotals = new Map<SpendFamily, { amount: number; count: number }>();
  let parsedAmountCount = 0;
  let totalParsedMonthlySpend = 0;

  for (const service of parsedServices) {
    const current = familyTotals.get(service.family) ?? { amount: 0, count: 0 };
    familyTotals.set(service.family, {
      amount: current.amount + (service.amount ?? 0),
      count: current.count + 1,
    });

    if (typeof service.amount === "number") {
      parsedAmountCount += 1;
      totalParsedMonthlySpend += service.amount;
    }
  }

  const familyBreakdown = [...familyTotals.entries()]
    .map(([family, totals]) => ({
      family,
      amount: totals.amount,
      count: totals.count,
    }))
    .sort((left, right) => {
      if (right.amount !== left.amount) {
        return right.amount - left.amount;
      }

      return right.count - left.count;
    });

  const dominantFamily = familyBreakdown[0]?.family ?? null;
  const dominantSharePercent =
    totalParsedMonthlySpend > 0 && familyBreakdown[0]
      ? Math.round((familyBreakdown[0].amount / totalParsedMonthlySpend) * 100)
      : null;
  const billingSummaryProvided = summary.trim().length > 0;
  const spendClarity =
    parsedAmountCount >= 2 && totalParsedMonthlySpend > 0
      ? "high"
      : parsedServices.length >= 2 || parsedAmountCount >= 1
        ? "medium"
        : "low";

  return {
    billingSummaryProvided,
    parsedServiceCount: parsedServices.length,
    parsedAmountCount,
    spendClarity,
    dominantFamily,
    dominantSharePercent,
    totalParsedMonthlySpend: totalParsedMonthlySpend > 0 ? totalParsedMonthlySpend : null,
    familyBreakdown,
    parsedServices,
  } as const;
}

export function extractCloudCostSignals(answers: CloudCostLeakFinderAnswers): ExtractedCloudCostSignals {
  const narrativeQuality = evaluateNarrativeQuality(answers.narrativeInput);
  const normalizedText = normalizeFreeText(`${answers.narrativeInput}\n${answers.billingSummaryInput}`.trim()).toLowerCase();
  const spendSignals = buildSpendSignals(answers.billingSummaryInput);
  const providers = detectProviders(normalizedText, answers);
  const workloadSignals = detectWorkloads(normalizedText, spendSignals.parsedServices);
  const costPainSignals = detectCostPains(normalizedText);
  const complexitySignals = detectComplexity(normalizedText, providers);
  const maturitySignals = detectMaturitySignals(normalizedText);

  return {
    providers,
    workloadSignals,
    costPainSignals,
    complexitySignals,
    maturitySignals,
    narrativeQuality: {
      charCount: narrativeQuality.charCount,
      wordCount: narrativeQuality.wordCount,
      detailBand: narrativeQuality.detailBand,
    },
    spendSignals,
  };
}
