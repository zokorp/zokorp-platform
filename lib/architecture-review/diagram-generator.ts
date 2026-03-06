import { extractServiceTokens } from "@/lib/architecture-review/engine";
import type { ArchitectureProvider } from "@/lib/architecture-review/types";

type DiagramLane = "source" | "edge" | "application" | "data" | "operations";

type DiagramNode = {
  id: string;
  label: string;
  lane: DiagramLane;
};

type DiagramEdge = {
  from: string;
  to: string;
  kind: "primary" | "secondary";
};

type ProviderTheme = {
  accent: string;
  accentSoft: string;
  laneFill: string;
  laneStroke: string;
  nodeFill: string;
  nodeStroke: string;
};

type GeneratedArchitectureDiagram = {
  provider: ArchitectureProvider;
  svg: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  title: string;
};

const MAX_NODES_PER_LANE = 3;
const DEFAULT_NARRATIVE =
  "Users send requests through an API gateway to an application service that reads and writes a managed database, while monitoring and alerts track health.";

const PROVIDER_DEFAULTS: Record<ArchitectureProvider, Array<{ label: string; lane: DiagramLane }>> = {
  aws: [
    { label: "Users", lane: "source" },
    { label: "API Gateway", lane: "edge" },
    { label: "Lambda", lane: "application" },
    { label: "DynamoDB", lane: "data" },
    { label: "CloudWatch", lane: "operations" },
  ],
  azure: [
    { label: "Users", lane: "source" },
    { label: "Front Door", lane: "edge" },
    { label: "App Service", lane: "application" },
    { label: "SQL Database", lane: "data" },
    { label: "Azure Monitor", lane: "operations" },
  ],
  gcp: [
    { label: "Users", lane: "source" },
    { label: "API Gateway", lane: "edge" },
    { label: "Cloud Run", lane: "application" },
    { label: "Cloud SQL", lane: "data" },
    { label: "Cloud Monitoring", lane: "operations" },
  ],
};

const PROVIDER_THEMES: Record<ArchitectureProvider, ProviderTheme> = {
  aws: {
    accent: "#ff9900",
    accentSoft: "#fff4e5",
    laneFill: "#fffaf2",
    laneStroke: "#ffd7a3",
    nodeFill: "#ffffff",
    nodeStroke: "#f5b158",
  },
  azure: {
    accent: "#0078d4",
    accentSoft: "#e8f3ff",
    laneFill: "#f4f9ff",
    laneStroke: "#a5d0ff",
    nodeFill: "#ffffff",
    nodeStroke: "#68aef0",
  },
  gcp: {
    accent: "#1a73e8",
    accentSoft: "#eaf1ff",
    laneFill: "#f5f9ff",
    laneStroke: "#b5cdfa",
    nodeFill: "#ffffff",
    nodeStroke: "#7ea8f3",
  },
};

function escapeXml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toTitleCase(input: string) {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeLabel(token: string) {
  const normalized = token
    .replace(/\baws\b/gi, "AWS")
    .replace(/\bgcp\b/gi, "GCP")
    .replace(/\bapi\b/gi, "API")
    .replace(/\bdb\b/gi, "DB");
  return toTitleCase(normalized);
}

function laneForToken(token: string): DiagramLane {
  const lower = token.toLowerCase();
  if (
    lower.includes("gateway") ||
    lower.includes("front door") ||
    lower.includes("route 53") ||
    lower.includes("load balancer") ||
    lower.includes("traffic manager") ||
    lower.includes("cdn")
  ) {
    return "edge";
  }

  if (
    lower.includes("lambda") ||
    lower.includes("app service") ||
    lower.includes("cloud run") ||
    lower.includes("cloud functions") ||
    lower.includes("functions") ||
    lower.includes("ec2") ||
    lower.includes("virtual machine") ||
    lower.includes("compute") ||
    lower.includes("eks") ||
    lower.includes("aks") ||
    lower.includes("gke")
  ) {
    return "application";
  }

  if (
    lower.includes("database") ||
    lower.includes("dynamodb") ||
    lower.includes("sql") ||
    lower.includes("cosmos") ||
    lower.includes("spanner") ||
    lower.includes("bigquery") ||
    lower.includes("storage") ||
    lower.includes("s3") ||
    lower.includes("cache") ||
    lower.includes("queue") ||
    lower.includes("pub/sub") ||
    lower.includes("service bus") ||
    lower.includes("event")
  ) {
    return "data";
  }

  if (
    lower.includes("monitor") ||
    lower.includes("cloudwatch") ||
    lower.includes("insights") ||
    lower.includes("log") ||
    lower.includes("trace")
  ) {
    return "operations";
  }

  return "application";
}

function uniqueByLabel(nodes: DiagramNode[]) {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    const key = node.label.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function collectNodesFromNarrative(provider: ArchitectureProvider, narrative: string) {
  const input = narrative.trim() || DEFAULT_NARRATIVE;
  const tokens = extractServiceTokens(provider, input);

  const buckets: Record<DiagramLane, DiagramNode[]> = {
    source: [{ id: "source-users", label: "Users", lane: "source" }],
    edge: [],
    application: [],
    data: [],
    operations: [],
  };

  for (const token of tokens) {
    const lane = laneForToken(token);
    if (lane === "source") {
      continue;
    }
    buckets[lane].push({
      id: `node-${lane}-${buckets[lane].length + 1}`,
      label: normalizeLabel(token),
      lane,
    });
  }

  for (const lane of ["edge", "application", "data", "operations"] as const) {
    const deduped = uniqueByLabel(buckets[lane]).slice(0, MAX_NODES_PER_LANE);
    buckets[lane] = deduped.map((node, index) => ({
      ...node,
      id: `node-${lane}-${index + 1}`,
    }));
  }

  const hasAnyGeneratedNodes =
    buckets.edge.length + buckets.application.length + buckets.data.length + buckets.operations.length > 0;

  if (!hasAnyGeneratedNodes) {
    const defaults = PROVIDER_DEFAULTS[provider];
    return defaults.map((item, index) => ({
      id: `node-${item.lane}-${index + 1}`,
      label: item.label,
      lane: item.lane,
    }));
  }

  return [
    ...buckets.source,
    ...buckets.edge,
    ...buckets.application,
    ...buckets.data,
    ...buckets.operations,
  ];
}

function buildEdges(nodes: DiagramNode[]) {
  const byLane = {
    source: nodes.filter((node) => node.lane === "source"),
    edge: nodes.filter((node) => node.lane === "edge"),
    application: nodes.filter((node) => node.lane === "application"),
    data: nodes.filter((node) => node.lane === "data"),
    operations: nodes.filter((node) => node.lane === "operations"),
  };

  const edges: DiagramEdge[] = [];

  const mainSequence = [
    ...byLane.source.slice(0, 1),
    ...(byLane.edge.length > 0 ? byLane.edge.slice(0, 1) : []),
    ...(byLane.application.length > 0 ? byLane.application.slice(0, 1) : []),
    ...(byLane.data.length > 0 ? byLane.data.slice(0, 1) : []),
  ];

  for (let index = 0; index < mainSequence.length - 1; index += 1) {
    edges.push({
      from: mainSequence[index].id,
      to: mainSequence[index + 1].id,
      kind: "primary",
    });
  }

  for (const lane of [byLane.edge, byLane.application, byLane.data]) {
    for (let index = 0; index < lane.length - 1; index += 1) {
      edges.push({
        from: lane[index].id,
        to: lane[index + 1].id,
        kind: "secondary",
      });
    }
  }

  if (byLane.operations.length > 0) {
    const opsTarget = byLane.operations[0];
    for (const sourceNode of [...byLane.application.slice(0, 2), ...byLane.data.slice(0, 1)]) {
      edges.push({
        from: sourceNode.id,
        to: opsTarget.id,
        kind: "secondary",
      });
    }
  }

  return edges;
}

function wrapLabelLines(label: string, maxChars = 18) {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [label];
  }

  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxChars) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 3);
}

function renderSvg(input: {
  provider: ArchitectureProvider;
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}) {
  const laneOrder: DiagramLane[] = ["source", "edge", "application", "data", "operations"];
  const theme = PROVIDER_THEMES[input.provider];
  const width = 1280;
  const laneHeight = 130;
  const laneGap = 20;
  const topPadding = 90;
  const leftPadding = 44;
  const innerWidth = width - leftPadding * 2;
  const height = topPadding + laneOrder.length * (laneHeight + laneGap) + 40;

  const laneY = new Map<DiagramLane, number>();
  laneOrder.forEach((lane, index) => {
    laneY.set(lane, topPadding + index * (laneHeight + laneGap));
  });

  const laneLabel: Record<DiagramLane, string> = {
    source: "Source",
    edge: "Edge",
    application: "Application",
    data: "Data",
    operations: "Observability",
  };

  const byLane = laneOrder.map((lane) => ({
    lane,
    nodes: input.nodes.filter((node) => node.lane === lane),
  }));

  const nodeRects = new Map<string, { x: number; y: number; width: number; height: number }>();

  const laneBlocks = byLane
    .map(({ lane }) => {
      const y = laneY.get(lane) ?? topPadding;
      return [
        `<rect x="${leftPadding}" y="${y}" width="${innerWidth}" height="${laneHeight}" rx="16" fill="${theme.laneFill}" stroke="${theme.laneStroke}" stroke-width="1.5" />`,
        `<text x="${leftPadding + 18}" y="${y + 26}" fill="#28405a" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="700" font-size="14">${laneLabel[lane]}</text>`,
      ].join("");
    })
    .join("");

  const nodesSvg = byLane
    .map(({ lane, nodes }) => {
      if (nodes.length === 0) {
        return "";
      }

      const nodeWidth = 190;
      const nodeHeight = 74;
      const y = (laneY.get(lane) ?? topPadding) + 38;
      const usableWidth = innerWidth - 60;
      const step = nodes.length === 1 ? 0 : Math.max(0, (usableWidth - nodeWidth) / (nodes.length - 1));
      const startX = leftPadding + 40;

      return nodes
        .map((node, index) => {
          const x = startX + step * index;
          nodeRects.set(node.id, { x, y, width: nodeWidth, height: nodeHeight });
          const lines = wrapLabelLines(node.label);
          const textY = y + 30 - (lines.length - 1) * 9;
          const text = lines
            .map(
              (line, lineIndex) =>
                `<tspan x="${x + nodeWidth / 2}" y="${textY + lineIndex * 18}">${escapeXml(line)}</tspan>`,
            )
            .join("");

          return [
            `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="12" fill="${theme.nodeFill}" stroke="${theme.nodeStroke}" stroke-width="1.6" />`,
            `<rect x="${x}" y="${y}" width="${nodeWidth}" height="10" rx="10" fill="${theme.accentSoft}" />`,
            `<text x="${x + nodeWidth / 2}" y="${y + 42}" text-anchor="middle" fill="#1f2e3f" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="14" font-weight="600">${text}</text>`,
          ].join("");
        })
        .join("");
    })
    .join("");

  const edgesSvg = input.edges
    .map((edge) => {
      const from = nodeRects.get(edge.from);
      const to = nodeRects.get(edge.to);
      if (!from || !to) {
        return "";
      }

      const startX = from.x + from.width;
      const startY = from.y + from.height / 2;
      const endX = to.x;
      const endY = to.y + to.height / 2;
      const dx = Math.max(50, Math.abs(endX - startX) * 0.45);
      const path = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
      const dash = edge.kind === "secondary" ? ` stroke-dasharray="6 6"` : "";

      return `<path d="${path}" fill="none" stroke="${theme.accent}" stroke-width="2"${dash} marker-end="url(#arrow-head)" />`;
    })
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(input.title)}">`,
    "<defs>",
    `<marker id="arrow-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">`,
    `<path d="M0,0 L8,4 L0,8 Z" fill="${theme.accent}" />`,
    "</marker>",
    "</defs>",
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#f8fbff" />`,
    `<rect x="0" y="0" width="${width}" height="62" fill="${theme.accentSoft}" />`,
    `<text x="32" y="38" fill="#1f2e3f" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="24" font-weight="700">${escapeXml(input.title)}</text>`,
    `<text x="${width - 190}" y="38" fill="${theme.accent}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="16" font-weight="700">${input.provider.toUpperCase()}</text>`,
    laneBlocks,
    edgesSvg,
    nodesSvg,
    "</svg>",
  ].join("");
}

export function generateArchitectureDiagramFromNarrative(input: {
  provider: ArchitectureProvider;
  narrative: string;
}): GeneratedArchitectureDiagram {
  const trimmed = input.narrative.trim();
  const nodes = collectNodesFromNarrative(input.provider, trimmed);
  const edges = buildEdges(nodes);
  const title = `${input.provider.toUpperCase()} reference architecture`;
  const svg = renderSvg({
    provider: input.provider,
    title,
    nodes,
    edges,
  });

  return {
    provider: input.provider,
    svg,
    nodes,
    edges,
    title,
  };
}

export function makeGeneratedDiagramSvgFile(input: {
  provider: ArchitectureProvider;
  svg: string;
  at?: Date;
}) {
  const now = input.at ?? new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `generated-${input.provider}-architecture-${stamp}.svg`;
  return new File([input.svg], filename, {
    type: "image/svg+xml",
  });
}
