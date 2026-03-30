import { describe, expect, it } from "vitest";

import { isStrictDiagramFile } from "@/lib/architecture-review/client";

function createPngHeader() {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

function createJpegHeader() {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
}

function createPdfHeader() {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
}

describe("architecture diagram file validation", () => {
  it("accepts valid png files", async () => {
    const file = new File([createPngHeader()], "diagram.png", { type: "image/png" });
    await expect(isStrictDiagramFile(file)).resolves.toEqual({
      ok: true,
      format: "png",
      mimeType: "image/png",
    });
  });

  it("accepts valid svg files", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><text>api gateway</text></svg>';
    const file = new File([svg], "diagram.svg", { type: "image/svg+xml" });
    await expect(isStrictDiagramFile(file)).resolves.toEqual({
      ok: true,
      format: "svg",
      mimeType: "image/svg+xml",
    });
  });

  it("accepts valid jpeg files", async () => {
    const file = new File([createJpegHeader()], "diagram.jpg", { type: "image/jpeg" });
    await expect(isStrictDiagramFile(file)).resolves.toEqual({
      ok: true,
      format: "jpg",
      mimeType: "image/jpeg",
    });
  });

  it("accepts valid pdf files", async () => {
    const file = new File([createPdfHeader()], "diagram.pdf", { type: "application/pdf" });
    await expect(isStrictDiagramFile(file)).resolves.toEqual({
      ok: true,
      format: "pdf",
      mimeType: "application/pdf",
    });
  });

  it("rejects unsafe svg files", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><text>api gateway</text></svg>';
    const file = new File([svg], "diagram.svg", { type: "image/svg+xml" });
    await expect(isStrictDiagramFile(file)).resolves.toEqual({
      ok: false,
      error: "SVG with script tags is not allowed.",
    });
  });

  it("rejects svg files with external href references", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/track.svg" /><text>api gateway</text></svg>';
    const file = new File([svg], "diagram.svg", { type: "image/svg+xml" });
    await expect(isStrictDiagramFile(file)).resolves.toEqual({
      ok: false,
      error: "SVG with external or data URI references is not allowed.",
    });
  });

  it("allows root-relative icon references used by generated diagrams", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="/architecture-icons/aws/api-gateway.svg" /><text>api gateway</text></svg>';
    const file = new File([svg], "diagram.svg", { type: "image/svg+xml" });
    await expect(isStrictDiagramFile(file)).resolves.toEqual({
      ok: true,
      format: "svg",
      mimeType: "image/svg+xml",
    });
  });

  it("rejects svg files with oversized dimensions", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50000 50000"><text>api gateway</text></svg>';
    const file = new File([svg], "diagram.svg", { type: "image/svg+xml" });
    await expect(isStrictDiagramFile(file)).resolves.toEqual({
      ok: false,
      error: "SVG dimensions are too large.",
    });
  });
});
