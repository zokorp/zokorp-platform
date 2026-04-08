function normalizeUrl(raw: string | null | undefined) {
  const cleaned = raw?.replaceAll("\\n", "").replaceAll("\\r", "").trim();
  return cleaned ? cleaned : null;
}

function isSupabasePoolerHost(hostname: string) {
  return hostname.endsWith(".pooler.supabase.com");
}

export function buildRuntimeDatabaseUrl(raw: string | null | undefined) {
  const normalized = normalizeUrl(raw);
  if (!normalized) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return normalized;
  }

  if (!isSupabasePoolerHost(parsed.hostname)) {
    return parsed.toString();
  }

  if (!parsed.searchParams.has("connection_limit")) {
    parsed.searchParams.set("connection_limit", "1");
  }

  if (parsed.port === "6543" && !parsed.searchParams.has("pgbouncer")) {
    parsed.searchParams.set("pgbouncer", "true");
  }

  return parsed.toString();
}
