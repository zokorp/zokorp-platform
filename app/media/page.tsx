import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { getMediaArticles } from "@/data/media-articles";
import { cn } from "@/lib/utils";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Media",
  description: "Guides, operating notes, and platform perspectives from ZoKorp.",
  path: "/media",
});

export default function MediaPage() {
  const articles = getMediaArticles();

  return (
    <div className="space-y-8">
      <section className="glass-surface animate-fade-up rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Media</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold text-slate-900">
          Guides, notes, and platform thinking
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          ZoKorp publishes practical guidance around architecture reviews, AWS delivery readiness, and
          account-linked software operations.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {articles.map((article) => (
          <article key={article.slug} className="surface lift-card rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{article.category}</p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">{article.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{article.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{article.readTime}</span>
              <span>{new Date(article.publishedAt).toLocaleDateString("en-US")}</span>
            </div>
            <Link href={`/media/${article.slug}`} className={`${buttonVariants()} mt-5`}>
              Read article
            </Link>
          </article>
        ))}
      </section>

      <section className="hero-surface px-6 py-8 text-white md:px-8">
        <h2 className="font-display text-3xl font-semibold">Need a tool, not just an article?</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
          Explore ZoKorp software for architecture review and validation workflows, or request delivery support
          for larger readiness work.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/software" className={buttonVariants({ variant: "secondary" })}>
            Browse software
          </Link>
          <Link
            href="/services"
            className={cn(buttonVariants({ variant: "ghost" }), "border border-white/30 text-white hover:bg-white/10")}
          >
            Browse services
          </Link>
        </div>
      </section>
    </div>
  );
}
