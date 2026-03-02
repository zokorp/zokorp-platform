const services = [
  {
    title: "AWS Consultation",
    points: [
      "Reference architecture and roadmap reviews",
      "Model lifecycle and MLOps guidance",
      "Security and reliability baselines",
    ],
  },
  {
    title: "APN Consulting",
    points: [
      "Partner program readiness",
      "Validation and evidence preparation",
      "Operational support for AWS engagement workflows",
    ],
  },
  {
    title: "AWS ML Products",
    points: [
      "Reusable tooling for validation checklists",
      "Delivery accelerators and templates",
      "Future catalog expansion for platform products",
    ],
  },
];

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Services</h1>
      <p className="max-w-3xl text-slate-600">
        ZoKorp services combine architecture depth and delivery execution, designed for teams that
        need measurable cloud AI outcomes.
      </p>
      <div className="grid gap-5 md:grid-cols-3">
        {services.map((service) => (
          <section key={service.title} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">{service.title}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              {service.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
