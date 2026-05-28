const localFallbackOrigin = "http://localhost:3000";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeConfiguredOrigin(value: string | undefined) {
  const raw = value?.trim();

  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    return trimTrailingSlash(new URL(withProtocol).origin);
  } catch {
    return "";
  }
}

function isReachableHost(host: string) {
  const normalized = host.trim().toLowerCase();

  if (!normalized) return false;
  if (normalized === "0.0.0.0" || normalized === "::" || normalized === "[::]") return false;
  if (normalized.startsWith("0.0.0.0:")) return false;
  if (normalized.startsWith("[::]:")) return false;

  return true;
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

function getConfiguredOrigin() {
  return (
    normalizeConfiguredOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeConfiguredOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeConfiguredOrigin(process.env.APP_URL) ||
    normalizeConfiguredOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeConfiguredOrigin(process.env.VERCEL_URL)
  );
}

export function getAppOrigin(headers?: Headers, fallbackUrl?: string | URL) {
  const configuredOrigin = getConfiguredOrigin();

  if (configuredOrigin) return configuredOrigin;

  const forwardedProto = firstHeaderValue(headers?.get("x-forwarded-proto") ?? null);
  const forwardedHost = firstHeaderValue(headers?.get("x-forwarded-host") ?? null);
  const host = firstHeaderValue(headers?.get("host") ?? null);
  const requestHost = forwardedHost || host;

  if (requestHost && isReachableHost(requestHost)) {
    return `${forwardedProto || "http"}://${requestHost}`;
  }

  if (fallbackUrl) {
    try {
      const fallbackOrigin = new URL(fallbackUrl).origin;
      const fallbackHost = new URL(fallbackOrigin).host;

      if (isReachableHost(fallbackHost)) {
        return fallbackOrigin;
      }
    } catch {
      return localFallbackOrigin;
    }
  }

  return localFallbackOrigin;
}
