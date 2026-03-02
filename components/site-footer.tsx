export function SiteFooter() {
  return (
    <footer className="border-t border-slate-300 bg-slate-100/70">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 text-sm text-slate-600 md:grid-cols-3 md:px-6">
        <section>
          <p className="font-display text-xl font-semibold text-slate-900">ZoKorp</p>
          <p className="mt-2 max-w-xs text-sm text-slate-600">
            AWS-focused AI/ML delivery plus productized validation software for teams that need
            measurable outcomes.
          </p>
        </section>

        <section>
          <p className="font-semibold text-slate-900">Office</p>
          <p className="mt-2">Houston, TX 77479</p>
          <p>United States</p>
        </section>

        <section>
          <p className="font-semibold text-slate-900">Contact</p>
          <p className="mt-2">zkhawaja@zokorp.com</p>
          <p className="mt-3 text-xs text-slate-500">
            Terms, Privacy, and support workflows will be published before production launch.
          </p>
        </section>
      </div>
    </footer>
  );
}
