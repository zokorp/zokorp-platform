/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient, AccessModel, PriceKind } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
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

  const freeTemplate = await prisma.product.upsert({
    where: { slug: "free-template-tool" },
    update: {
      name: "Free Template Tool",
      description: "Example free tool slot for upcoming software offerings.",
      accessModel: AccessModel.FREE,
      active: true,
    },
    create: {
      slug: "free-template-tool",
      name: "Free Template Tool",
      description: "Example free tool slot for upcoming software offerings.",
      accessModel: AccessModel.FREE,
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
        productId: validator.id,
      },
      create: {
        stripePriceId: item.envVar,
        amount: item.amount,
        currency: "usd",
        kind: item.kind,
        creditsGranted: item.creditsGranted,
        creditTier: item.creditTier,
        active: true,
        productId: validator.id,
      },
    });
  }

  console.log(`Seeded products: ${validator.slug}, ${freeTemplate.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
