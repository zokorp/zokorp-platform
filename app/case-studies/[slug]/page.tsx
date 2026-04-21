import { permanentRedirect } from "next/navigation";

import { CASE_STUDIES, getCaseStudy } from "@/lib/case-studies";

type PageParams = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return CASE_STUDIES.map((study) => ({ slug: study.slug }));
}

export default async function CaseStudyRedirectPage({ params }: PageParams) {
  const { slug } = await params;
  const study = getCaseStudy(slug);

  if (!study) {
    permanentRedirect("/case-studies");
  }

  permanentRedirect(`/case-studies#${study.slug}`);
}
