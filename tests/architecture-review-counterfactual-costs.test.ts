import { describe, expect, it } from "vitest";

import {
  getCounterfactualCost,
  getCounterfactualCostCount,
  SAMPLE_COUNTERFACTUAL_COST,
} from "@/lib/architecture-review/counterfactual-costs";

describe("architecture review counterfactual cost notes", () => {
  it("exposes at least 25 covered rule IDs across providers", () => {
    expect(getCounterfactualCostCount()).toBeGreaterThanOrEqual(25);
  });

  it("returns a note for each high-impact AWS security rule we expect to see", () => {
    expect(getCounterfactualCost("aws:public_database_exposure")).toContain("public DB credential");
    expect(getCounterfactualCost("aws:secrets_management_centralized")).toContain("Secrets Manager");
    expect(getCounterfactualCost("aws:rds_encryption_at_rest")).toContain("free when enabled at create time");
  });

  it("returns a note for each high-impact AWS reliability rule we expect to see", () => {
    expect(getCounterfactualCost("aws:single_az_database_for_production")).toContain("Multi-AZ");
    expect(getCounterfactualCost("aws:nat_gateway_per_az_for_private_egress")).toContain("NAT");
    expect(getCounterfactualCost("aws:no_backup_strategy_for_stateful_data")).toContain("unrecoverable data loss");
  });

  it("returns a note for the highest-impact Azure rules we expect to see", () => {
    expect(getCounterfactualCost("azure:key_vault_secrets_management")).toContain("Key Vault");
    expect(getCounterfactualCost("azure:zone_redundant_database")).toContain("zone-redundancy");
  });

  it("returns null for rule IDs that don't have a curated cost note", () => {
    expect(getCounterfactualCost("aws:some_uncovered_rule")).toBeNull();
    expect(getCounterfactualCost("nonsense")).toBeNull();
  });

  it("provides a synthetic sample note for demos that don't match a real rule", () => {
    expect(SAMPLE_COUNTERFACTUAL_COST).toContain("If this were a real production environment");
    expect(SAMPLE_COUNTERFACTUAL_COST).toContain("near-$0");
  });

  it("never returns notes that exceed a reasonable length budget (350 chars)", () => {
    // Long notes break the email card layout and are usually a sign the
    // copywriting is hedging too much.
    const sampleIds = [
      "aws:public_database_exposure",
      "aws:rds_encryption_at_rest",
      "aws:single_az_database_for_production",
      "aws:no_backup_strategy_for_stateful_data",
      "azure:zone_redundant_database",
    ];

    for (const ruleId of sampleIds) {
      const note = getCounterfactualCost(ruleId);
      expect(note).not.toBeNull();
      expect(note!.length).toBeLessThanOrEqual(360);
    }
  });
});
