import type { Prisma, User } from "@prisma/client";
import type Stripe from "stripe";

import { db } from "@/lib/db";

type BillingUser = Pick<User, "id" | "email" | "name" | "stripeCustomerId">;

export class StripeCustomerBindingError extends Error {
  status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.name = "StripeCustomerBindingError";
    this.status = status;
  }
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

async function writeBillingAuditLog(
  userId: string,
  action: string,
  metadataJson: Prisma.JsonObject,
) {
  try {
    await db.auditLog.create({
      data: {
        userId,
        action,
        metadataJson,
      },
    });
  } catch (error) {
    console.error("Failed to write billing audit log", action, error);
  }
}

export async function ensureStripeCustomerForUser(
  user: BillingUser,
  stripe: Stripe,
) {
  if (!user.stripeCustomerId) {
    if (!user.email) {
      throw new StripeCustomerBindingError("Account email is required for billing.", 400);
    }

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });

    await db.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  let customer: Stripe.Customer | Stripe.DeletedCustomer;

  try {
    customer = await stripe.customers.retrieve(user.stripeCustomerId);
  } catch {
    await writeBillingAuditLog(user.id, "billing.customer_binding_rejected", {
      reason: "retrieve_failed",
      stripeCustomerId: user.stripeCustomerId,
    });
    throw new StripeCustomerBindingError(
      "Billing profile could not be verified. Please contact support.",
    );
  }

  if ("deleted" in customer && customer.deleted) {
    await writeBillingAuditLog(user.id, "billing.customer_binding_rejected", {
      reason: "deleted_customer",
      stripeCustomerId: user.stripeCustomerId,
    });
    throw new StripeCustomerBindingError(
      "Billing profile could not be verified. Please contact support.",
    );
  }

  const metadataUserId = customer.metadata.userId?.trim() ?? "";
  if (metadataUserId === user.id) {
    return customer.id;
  }

  const customerEmail = normalizeEmail(customer.email);
  const userEmail = normalizeEmail(user.email);
  const canBackfillByEmail = !metadataUserId && Boolean(customerEmail) && customerEmail === userEmail;

  if (canBackfillByEmail) {
    try {
      await stripe.customers.update(customer.id, {
        metadata: {
          ...customer.metadata,
          userId: user.id,
        },
      });

      await writeBillingAuditLog(user.id, "billing.customer_binding_backfilled", {
        stripeCustomerId: customer.id,
        repair: "metadata_userId",
      });
    } catch {
      await writeBillingAuditLog(user.id, "billing.customer_binding_backfill_failed", {
        stripeCustomerId: customer.id,
        repair: "metadata_userId",
      });
    }

    return customer.id;
  }

  await writeBillingAuditLog(user.id, "billing.customer_binding_rejected", {
    reason: metadataUserId ? "metadata_user_mismatch" : "email_mismatch_or_missing",
    stripeCustomerId: customer.id,
    metadataUserIdPresent: Boolean(metadataUserId),
  });

  throw new StripeCustomerBindingError(
    "Billing profile could not be verified. Please contact support.",
  );
}
