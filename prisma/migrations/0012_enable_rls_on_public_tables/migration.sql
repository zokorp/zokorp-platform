-- Supabase exposes all tables in the public schema through the Data API.
-- This app currently uses server-side Prisma + NextAuth rather than browser-side
-- Supabase table access, so the safest baseline is:
--   1. enable RLS on every public table
--   2. leave the tables closed by default
--   3. avoid FORCE ROW LEVEL SECURITY so owner/bypassrls roles keep working
--
-- Future tables that truly need browser-side access should add explicit,
-- narrow policies in a follow-up migration.

ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Price" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Entitlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UsageEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CheckoutFulfillment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CreditBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServiceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeadLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UserAuth" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LandingZoneReadinessSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArchitectureReviewJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ArchitectureReviewEmailOutbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CloudCostLeakFinderSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AiDeciderSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RateLimitBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
