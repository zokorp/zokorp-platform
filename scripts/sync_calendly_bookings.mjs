const API_BASE = "https://api.calendly.com";
const DEFAULT_LOOKBACK_HOURS = 72;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function stripApiBase(uri) {
  if (!uri) {
    return null;
  }

  if (uri.startsWith(API_BASE)) {
    return uri.slice(API_BASE.length);
  }

  return uri;
}

function extractTracking(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const candidate =
    record.tracking ??
    record.resource?.tracking ??
    record.payload?.tracking ??
    null;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return {
    utm_source: typeof candidate.utm_source === "string" ? candidate.utm_source.trim() : "",
    utm_medium: typeof candidate.utm_medium === "string" ? candidate.utm_medium.trim() : "",
    utm_campaign: typeof candidate.utm_campaign === "string" ? candidate.utm_campaign.trim() : "",
    utm_content: typeof candidate.utm_content === "string" ? candidate.utm_content.trim() : "",
  };
}

function isArchitectureFollowUpTracking(tracking) {
  if (!tracking) {
    return false;
  }

  const source = tracking.utm_source.toLowerCase();
  const medium = tracking.utm_medium.toLowerCase();
  const campaign = tracking.utm_campaign.toLowerCase();
  const content = tracking.utm_content.toUpperCase();

  return (
    (source === "zokorp" && medium === "architecture-review-email") ||
    campaign === "architecture-follow-up" ||
    content.startsWith("ZK-ARCH-")
  );
}

async function apiGet(path, token) {
  const url = path.startsWith("http") ? path : new URL(path, API_BASE).toString();
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Calendly API ${response.status} for ${url}: ${body}`);
  }

  return response.json();
}

async function listCollection(path, token) {
  const items = [];
  let nextPath = path;

  while (nextPath) {
    const json = await apiGet(nextPath, token);
    if (Array.isArray(json.collection)) {
      items.push(...json.collection);
    } else if (json.resource) {
      items.push(json.resource);
    }

    const nextPage = json.pagination?.next_page;
    nextPath = typeof nextPage === "string" && nextPage.trim() ? nextPage.trim() : null;
  }

  return items;
}

async function fetchInviteeDetail(invitee, token) {
  const path = stripApiBase(invitee?.uri ?? "");
  if (!path) {
    return invitee;
  }

  try {
    const json = await apiGet(path, token);
    return json.resource ?? json;
  } catch {
    return invitee;
  }
}

async function ingestBookedCall(input, ingestUrl, syncSecret) {
  const response = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-calendly-sync-secret": syncSecret,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ingest route ${response.status}: ${body}`);
  }

  return response.json();
}

async function main() {
  const token = requireEnv("CALENDLY_PERSONAL_ACCESS_TOKEN");
  const ingestUrl = requireEnv("CALENDLY_SYNC_INGEST_URL");
  const syncSecret = requireEnv("CALENDLY_SYNC_SECRET");
  const lookbackHours = Number(process.env.CALENDLY_SYNC_LOOKBACK_HOURS ?? DEFAULT_LOOKBACK_HOURS);

  const me = await apiGet("/users/me", token);
  const userUri = me.resource?.uri;
  if (typeof userUri !== "string" || !userUri) {
    throw new Error("Calendly current user URI missing from /users/me response");
  }

  const minStartTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
  const events = await listCollection(
    `/scheduled_events?user=${encodeURIComponent(userUri)}&status=active&min_start_time=${encodeURIComponent(minStartTime)}&count=100`,
    token,
  );

  const summary = {
    eventsScanned: events.length,
    inviteesScanned: 0,
    matched: 0,
    ingested: 0,
  };

  for (const event of events) {
    const eventUri = typeof event?.uri === "string" ? event.uri : "";
    if (!eventUri) {
      continue;
    }

    const eventPath = stripApiBase(eventUri);
    const invitees = await listCollection(`${eventPath}/invitees?count=100`, token);

    for (const invitee of invitees) {
      summary.inviteesScanned += 1;

      const detail = await fetchInviteeDetail(invitee, token);
      const tracking = extractTracking(detail) ?? extractTracking(invitee);
      if (!isArchitectureFollowUpTracking(tracking)) {
        continue;
      }

      const email =
        typeof detail?.email === "string"
          ? detail.email.trim().toLowerCase()
          : typeof invitee?.email === "string"
            ? invitee.email.trim().toLowerCase()
            : "";

      if (!email) {
        continue;
      }

      summary.matched += 1;

      const externalEventId =
        (typeof detail?.uri === "string" && detail.uri) ||
        (typeof invitee?.uri === "string" && invitee.uri) ||
        `${eventUri}:${email}`;

      await ingestBookedCall(
        {
          email,
          name:
            typeof detail?.name === "string"
              ? detail.name.trim()
              : typeof invitee?.name === "string"
                ? invitee.name.trim()
                : null,
          externalEventId,
          bookedAtIso:
            (typeof event?.start_time === "string" && event.start_time) ||
            (typeof detail?.scheduled_event?.start_time === "string" && detail.scheduled_event.start_time) ||
            null,
          estimateReferenceCode: tracking?.utm_content || null,
          provider: "calendly",
        },
        ingestUrl,
        syncSecret,
      );
      summary.ingested += 1;
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
