/**
 * geoDevice.ts
 * Utility for resolving network environment details, user agents,
 * and data privacy masking for BCF-SL Administration System.
 */

export function extractClientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const getHeader = (key: string): string | null => {
    if (typeof (headers as any).get === "function") {
      return (headers as Headers).get(key);
    }
    const val = (headers as Record<string, any>)[key.toLowerCase()];
    if (Array.isArray(val)) return val[0];
    return val || null;
  };

  const cfIp = getHeader("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = getHeader("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) {
    const list = forwarded.split(",");
    if (list.length > 0 && list[0].trim()) {
      return list[0].trim();
    }
  }

  const clientIp = getHeader("x-client-ip");
  if (clientIp) return clientIp.trim();

  return "127.0.0.1";
}

export function resolveApproximateLocation(ip: string): {
  country: string;
  city: string;
  region: string;
} {
  const clean = (ip || "").trim();

  // Local loopback or internal subnet
  if (
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean.startsWith("192.168.") ||
    clean.startsWith("10.")
  ) {
    return {
      country: "Sierra Leone",
      city: "Freetown",
      region: "Western Area",
    };
  }

  // Known Sierra Leone mobile & enterprise prefixes (Africell, Orange, QCell)
  if (
    clean.startsWith("197.234.") ||
    clean.startsWith("196.207.") ||
    clean.startsWith("41.223.") ||
    clean.startsWith("154.113.") ||
    clean.startsWith("102.164.")
  ) {
    return {
      country: "Sierra Leone",
      city: "Freetown",
      region: "Western Area Urban",
    };
  }

  // European IP ranges
  if (clean.startsWith("82.") || clean.startsWith("86.") || clean.startsWith("151.")) {
    return {
      country: "United Kingdom",
      city: "London",
      region: "Greater London",
    };
  }

  // North American ranges
  if (clean.startsWith("54.") || clean.startsWith("3.") || clean.startsWith("104.")) {
    return {
      country: "United States",
      city: "Washington",
      region: "District of Columbia",
    };
  }

  return {
    country: "Sierra Leone",
    city: "Freetown",
    region: "Western Area",
  };
}

export function parseUserAgentDetails(userAgent: string): {
  os: string;
  deviceModel: string;
  browser: string;
} {
  const ua = userAgent || "";
  let os = "Windows";
  let deviceModel = "Desktop PC";
  let browser = "Chrome";

  if (/iPhone/i.test(ua)) {
    os = "iOS";
    deviceModel = "Apple iPhone";
  } else if (/iPad/i.test(ua)) {
    os = "iPadOS";
    deviceModel = "Apple iPad";
  } else if (/Android/i.test(ua)) {
    os = "Android";
    deviceModel = "Mobile Device";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "macOS";
    deviceModel = "Apple Mac";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
    deviceModel = "Workstation";
  } else if (/Windows/i.test(ua)) {
    os = "Windows 11";
    deviceModel = "Desktop PC";
  }

  if (/Edg\/([\d.]+)/i.test(ua)) {
    browser = `Edge ${ua.match(/Edg\/([\d.]+)/i)?.[1].split(".")[0] || ""}`.trim();
  } else if (/Chrome\/([\d.]+)/i.test(ua)) {
    browser = `Chrome ${ua.match(/Chrome\/([\d.]+)/i)?.[1].split(".")[0] || ""}`.trim();
  } else if (/Firefox\/([\d.]+)/i.test(ua)) {
    browser = `Firefox ${ua.match(/Firefox\/([\d.]+)/i)?.[1].split(".")[0] || ""}`.trim();
  } else if (/Safari\/([\d.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = "Safari";
  }

  return { os, deviceModel, browser };
}

export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***@bcf-sl.org";
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || local.length <= 1) {
    return `*@${domain}`;
  }
  if (local.length === 2) {
    return `${local[0]}*@${domain}`;
  }
  const maskedLocal = `${local[0]}${"*".repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}`;
  return `${maskedLocal}@${domain}`;
}

export function maskIp(ip: string): string {
  if (!ip) return "***.***.***.***";
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  return ip.slice(0, 4) + "***";
}
