import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { getMediaArticleBySlug, getMediaArticles } from "@/data/media-articles";
import { buildPageMetadata } from "@/lib/site";

export async function generateStaticParams() {
  return getMediaArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getMediaArticleBySlug(slug);

  if (!article) {
    return buildPageMetadata({
      title: "Media",
      description: "Guides, operating notes, and platform perspectives from ZoKorp.",
      path: "/media",
    });
  }

  return buildPageMetadata({
    title: article.title,
    description: article.description,
    path: `/media/${article.slug}`,
    type: "article",
  });
}

export default async function MediaArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getMediaArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-4xl space-y-8">
      <section className="glass-surface animate-fade-up rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{article.category}</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold text-slate-900">{article.title}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">{article.description}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
          <span>{new Date(article.publishedAt).toLocaleDateString("en-US")}</span>
          <span>{article.readTime}</span>
        </div>
      </section>

      <section className="surface rounded-2xl p-6 md:p-8">
        <p className="text-base leading-8 text-slate-700">{article.intro}</p>

        <div className="mt-8 space-y-8">
          {article.sections.map((section) => (
            <section key={section.heading} className="space-y-4">
              <h2 className="font-display text-2xl font-semibold text-slate-900">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-slate-700 md:text-base">
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="space-y-2 text-sm text-slate-700 md:text-base">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </section>

      <section className="surface-muted rounded-2xl p-6">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Next step</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Move from guidance to execution with ZoKorp software or a scoped delivery engagement.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/software" className={buttonVariants()}>
            Browse software
          </Link>
          <Link href="/services" className={buttonVariants({ variant: "secondary" })}>
            Browse services
          </Link>
        </div>
      </section>
    </article>
  );
}
