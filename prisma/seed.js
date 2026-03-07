/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient, AccessModel, PriceKind } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.product.updateMany({
    where: { slug: "free-template-tool" },
    data: { active: false },
  });

  const validator = await prisma.product.upsert({
    where: { slug: "zokorp-validator" },
    update: {
      name: "ZoKorpValidator",
      description:
        "ValidationChecklistValidator for FTR, SDP/SRP, and Competency workflows.",
      accessModel: AccessModel.ONE_TIME_CREDIT,
      active: true,
    },
    create: {
      slug: "zokorp-validator",
      name: "ZoKorpValidator",
      description:
        "ValidationChecklistValidator for FTR, SDP/SRP, and Competency workflows.",
      accessModel: AccessModel.ONE_TIME_CREDIT,
      active: true,
    },
  });

  const freeReviewer = await prisma.product.upsert({
    where: { slug: "architecture-diagram-reviewer" },
    update: {
      name: "Architecture Diagram Reviewer",
      description:
        "Free cloud architecture diagram reviewer for PNG uploads with deterministic findings delivered by email.",
      accessModel: AccessModel.FREE,
      active: true,
    },
    create: {
      slug: "architecture-diagram-reviewer",
      name: "Architecture Diagram Reviewer",
      description:
        "Free cloud architecture diagram reviewer for PNG uploads with deterministic findings delivered by email.",
      accessModel: AccessModel.FREE,
      active: true,
    },
  });

  const landingZoneChecker = await prisma.product.upsert({
    where: { slug: "landing-zone-readiness-checker" },
    update: {
      name: "Landing Zone Readiness Checker",
      description:
        "Free deterministic landing-zone assessment for SMB teams with emailed scoring, findings, and consultation quote.",
      accessModel: AccessModel.FREE,
      active: true,
    },
    create: {
      slug: "landing-zone-readiness-checker",
      name: "Landing Zone Readiness Checker",
      description:
        "Free deterministic landing-zone assessment for SMB teams with emailed scoring, findings, and consultation quote.",
      accessModel: AccessModel.FREE,
      active: true,
    },
  });

  const cloudCostLeakFinder = await prisma.product.upsert({
    where: { slug: "cloud-cost-leak-finder" },
    update: {
      name: "Cloud Cost Leak Finder",
      description:
        "Free deterministic cloud cost diagnostic for SMB teams with an emailed advisory memo, likely savings range, and consulting quote.",
      accessModel: AccessModel.FREE,
      active: true,
    },
    create: {
      slug: "cloud-cost-leak-finder",
      name: "Cloud Cost Leak Finder",
      description:
        "Free deterministic cloud cost diagnostic for SMB teams with an emailed advisory memo, likely savings range, and consulting quote.",
      accessModel: AccessModel.FREE,
      active: true,
    },
  });

  const mlopsPlatform = await prisma.product.upsert({
    where: { slug: "mlops-foundation-platform" },
    update: {
      name: "ZoKorp MLOps Foundation Platform",
      description:
        "Subscription SaaS for SMB teams needing streamlined MLOps workflows, governance checks, and delivery visibility.",
      accessModel: AccessModel.SUBSCRIPTION,
      active: true,
    },
    create: {
      slug: "mlops-foundation-platform",
      name: "ZoKorp MLOps Foundation Platform",
      description:
        "Subscription SaaS for SMB teams needing streamlined MLOps workflows, governance checks, and delivery visibility.",
      accessModel: AccessModel.SUBSCRIPTION,
      active: true,
    },
  });

  const prices = [
    {
      envVar: process.env.STRIPE_PRICE_ID_FTR_SINGLE,
      amount: 5000,
      kind: PriceKind.CREDIT_PACK,
      creditsGranted: 1,
      creditTier: "FTR",
    },
    {
      envVar: process.env.STRIPE_PRICE_ID_SDP_SRP_SINGLE,
      amount: 15000,
      kind: PriceKind.CREDIT_PACK,
      creditsGranted: 1,
      creditTier: "SDP_SRP",
    },
    {
      envVar: process.env.STRIPE_PRICE_ID_COMPETENCY_REVIEW,
      amount: 50000,
      kind: PriceKind.CREDIT_PACK,
      creditsGranted: 1,
      creditTier: "COMPETENCY",
    },
    {
      envVar: process.env.STRIPE_PRICE_ID_PLATFORM_MONTHLY,
      amount: 100,
      kind: PriceKind.SUBSCRIPTION,
      creditsGranted: 0,
      creditTier: "GENERAL",
    },
    {
      envVar: process.env.STRIPE_PRICE_ID_PLATFORM_ANNUAL,
      amount: 1000,
      kind: PriceKind.SUBSCRIPTION,
      creditsGranted: 0,
      creditTier: "GENERAL",
    },
  ];

  for (const item of prices) {
    if (!item.envVar) {
      continue;
    }

    await prisma.price.upsert({
      where: { stripePriceId: item.envVar },
      update: {
        amount: item.amount,
        kind: item.kind,
        creditsGranted: item.creditsGranted,
        creditTier: item.creditTier,
        active: true,
        productId:
          item.kind === PriceKind.SUBSCRIPTION
            ? mlopsPlatform.id
            : validator.id,
      },
      create: {
        stripePriceId: item.envVar,
        amount: item.amount,
        currency: "usd",
        kind: item.kind,
        creditsGranted: item.creditsGranted,
        creditTier: item.creditTier,
        active: true,
        productId:
          item.kind === PriceKind.SUBSCRIPTION
            ? mlopsPlatform.id
            : validator.id,
      },
    });
  }

  console.log(
    `Seeded products: ${validator.slug}, ${freeReviewer.slug}, ${landingZoneChecker.slug}, ${cloudCostLeakFinder.slug}, ${mlopsPlatform.slug}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
