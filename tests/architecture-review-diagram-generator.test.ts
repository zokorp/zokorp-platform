import { describe, expect, it } from "vitest";

import {
  generateArchitectureDiagramFromNarrative,
  makeGeneratedDiagramSvgFile,
} from "@/lib/architecture-review/diagram-generator";

describe("architecture diagram generator", () => {
  it("generates deterministic svg output for the same narrative", () => {
    const input = {
      provider: "aws" as const,
      narrative:
        "Users call API Gateway, Lambda handles requests, DynamoDB stores records, and CloudWatch monitors errors.",
    };

    const first = generateArchitectureDiagramFromNarrative(input);
    const second = generateArchitectureDiagramFromNarrative(input);

    expect(first.svg).toBe(second.svg);
    expect(first.nodes.length).toBeGreaterThanOrEqual(4);
    expect(first.edges.length).toBeGreaterThan(0);
    expect(first.svg).toContain("AWS");
    expect(first.svg).toContain("API Gateway");
  });

  it("falls back to provider defaults for low-signal narrative", () => {
    const generated = generateArchitectureDiagramFromNarrative({
      provider: "azure",
      narrative: "asdf qwer",
    });

    expect(generated.nodes.some((node) => /front door/i.test(node.label))).toBe(true);
    expect(generated.nodes.some((node) => /app service/i.test(node.label))).toBe(true);
    expect(generated.nodes.some((node) => /sql database/i.test(node.label))).toBe(true);
  });

  it("creates downloadable svg files with stable metadata", () => {
    const generated = generateArchitectureDiagramFromNarrative({
      provider: "gcp",
      narrative: "Traffic enters API Gateway, Cloud Run serves requests, and Cloud SQL stores data.",
    });

    const file = makeGeneratedDiagramSvgFile({
      provider: "gcp",
      svg: generated.svg,
      at: new Date("2026-03-06T12:00:00.000Z"),
    });

    expect(file.type).toBe("image/svg+xml");
    expect(file.name).toMatch(/^generated-gcp-architecture-/);
    expect(file.name.endsWith(".svg")).toBe(true);
  });
});
