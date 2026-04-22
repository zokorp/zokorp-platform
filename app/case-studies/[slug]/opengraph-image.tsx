import { ImageResponse } from "next/og";

import { CASE_STUDIES, getCaseStudy } from "@/lib/case-studies";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export function generateStaticParams() {
  return CASE_STUDIES.map((study) => ({ slug: study.slug }));
}

export default function OpenGraphImage({ params }: { params: { slug: string } }) {
  const study = getCaseStudy(params.slug);

  const title = study?.title ?? "ZoKorp Case Study";
  const metric = study?.outcomeStat ?? "Founder-led cloud and AI delivery";
  const role = study?.role ?? "ZoKorp";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #f5f2ec 0%, #ece7de 100%)",
          padding: "64px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9999, background: "#3139a1" }} />
          <div style={{ fontSize: 28, fontWeight: 700, color: "#101828" }}>ZoKorp · Case Study</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1000 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "#475467",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            {role}
          </div>
          <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.05, color: "#101828" }}>
            {title}
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: "#3139a1",
              letterSpacing: -0.5,
            }}
          >
            {metric}
          </div>
        </div>
        <div style={{ fontSize: 20, color: "#344054" }}>www.zokorp.com/case-studies</div>
      </div>
    ),
    size,
  );
}
