import * as Sentry from "@sentry/nextjs";

import { getServerSentryOptions } from "@/lib/sentry-config";

Sentry.init(getServerSentryOptions());
