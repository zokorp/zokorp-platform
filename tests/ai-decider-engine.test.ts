import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAiDeciderReport } from "@/lib/ai-decider/engine";
import { isAllowedAiDeciderBusinessEmail } from "@/lib/ai-decider/input";
import { buildAiDeciderQuestions, validateAiDeciderAnswers } from "@/lib/ai-decider/questions";
import { extractAiDeciderSignals } from "@/lib/ai-decider/signals";
import type { AiDeciderLeadInput } from "@/lib/ai-decider/types";

function makeLead(overrides: Partial<AiDeciderLeadInput> = {}): AiDeciderLeadInput {
  return {
    email: "owner@acmeops.com",
    fullName: "Jordan Rivera",
    companyName: "Acme Ops",
    roleTitle: "COO",
    website: "acmeops.com",
    narrativeInput:
      "Our support team answers the same questions repeatedly across email and Slack. The best answers are spread across SharePoint, old docs, and a few senior reps. We want faster response times and more consistent answers for customers.",
    ...overrides,
  };
}

describe("ai decider engine", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks common personal email domains", () => {
    expect(isAllowedAiDeciderBusinessEmail("owner@acmeops.com")).toBe(true);
    expect(isAllowedAiDeciderBusinessEmail("someone@gmail.com")).toBe(false);
    expect(isAllowedAiDeciderBusinessEmail("someone@outlook.com")).toBe(false);
  });

  it("extracts signals and adaptive questions for a knowledge-heavy support workflow", () => {
    const signals = extractAiDeciderSignals(makeLead().narrativeInput);
    const questions = buildAiDeciderQuestions(signals);

    expect(signals.businessFunctions).toContain("support");
    expect(signals.dataTypes).toContain("emails");
    expect(signals.dataTypes).toContain("knowledge base");
    expect(signals.desiredOutcomes).toContain("knowledge answers");
    expect(signals.processStability).toBe("stable");
    expect(questions.map((question) => question.id)).toContain("knowledge_source");
    expect(questions.map((question) => question.id)).toContain("error_tolerance");
  });

  it("requires answers for every generated follow-up question", () => {
    const signals = extractAiDeciderSignals(makeLead().narrativeInput);
    const questions = buildAiDeciderQuestions(signals);

    const validation = validateAiDeciderAnswers(questions, {
      task_frequency: "daily",
      process_variability: "mostly_standard",
    });

    expect(validation.ok).toBe(false);
    if (validation.ok) {
      throw new Error("Expected validation failure.");
    }
    expect(validation.error).toContain("follow-up question");
  });

  it("produces a predictive ML recommendation when history and data readiness are strong", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T15:00:00.000Z"));

    const report = buildAiDeciderReport({
      lead: makeLead({
        companyName: "Northstar SaaS",
        roleTitle: "Revenue Operations Lead",
        narrativeInput:
          "We want to predict which subscription customers will churn before renewal. The team reviews churn risk manually every week using CRM data, billing history, and product usage tables. We have two years of reasonably clean history and want earlier interventions from customer success.",
      }),
      answers: {
        task_frequency: "weekly",
        process_variability: "mostly_standard",
        data_state: "structured_ready",
        impact_window: "major",
        error_tolerance: "human_reviewed",
        regulatory_exposure: "customer_or_financial",
        systems_count: "three_four",
        historical_outcomes: "labeled_history",
      },
    });

    expect(report.recommendation).toBe("PREDICTIVE_ML");
    expect(report.quote.engagementType).toBe("Solution Blueprint");
    expect(report.scores.dataReadinessScore).toBeGreaterThanOrEqual(70);
    expect(report.scores.aiFitScore).toBeGreaterThanOrEqual(50);
    expect(report.signals.desiredOutcomes).toContain("prediction");
    expect(report.generatedAtISO).toBe("2026-03-07T15:00:00.000Z");
  });

  it("defaults to discovery when the request is AI-first but the problem is still vague", () => {
    const report = buildAiDeciderReport({
      lead: makeLead({
        companyName: "Brightlane Group",
        narrativeInput:
          "Leadership wants an AI chatbot but we are not sure why. Different teams imagine different use cases, the process changes constantly, and the current answers mostly live in people’s heads. We want to explore what might be possible.",
      }),
      answers: {
        task_frequency: "weekly",
        process_variability: "case_by_case",
        data_state: "scattered_manual",
        impact_window: "moderate",
        error_tolerance: "human_reviewed",
        knowledge_source: "mostly_in_heads",
        decision_logic: "goal_not_decided",
        response_mode: "not_sure",
      },
    });

    expect(report.recommendation).toBe("NEEDS_DISCOVERY");
    expect(report.verdictHeadline).toMatch(/discovery/i);
    expect(report.blockers.length).toBeGreaterThan(0);
  });
});
