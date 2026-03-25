import { afterEach, describe, expect, it } from "vitest";

import { resolveWorkDriveUploadOrigin } from "@/lib/zoho-workdrive";

const ORIGINAL_ENV = {
  ZOHO_WORKDRIVE_API_ORIGIN: process.env.ZOHO_WORKDRIVE_API_ORIGIN,
  ZOHO_WORKDRIVE_BASE_API_URI: process.env.ZOHO_WORKDRIVE_BASE_API_URI,
};

afterEach(() => {
  if (ORIGINAL_ENV.ZOHO_WORKDRIVE_API_ORIGIN === undefined) {
    delete process.env.ZOHO_WORKDRIVE_API_ORIGIN;
  } else {
    process.env.ZOHO_WORKDRIVE_API_ORIGIN = ORIGINAL_ENV.ZOHO_WORKDRIVE_API_ORIGIN;
  }

  if (ORIGINAL_ENV.ZOHO_WORKDRIVE_BASE_API_URI === undefined) {
    delete process.env.ZOHO_WORKDRIVE_BASE_API_URI;
  } else {
    process.env.ZOHO_WORKDRIVE_BASE_API_URI = ORIGINAL_ENV.ZOHO_WORKDRIVE_BASE_API_URI;
  }
});

describe("resolveWorkDriveUploadOrigin", () => {
  it("defaults to the reachable WorkDrive origin", () => {
    delete process.env.ZOHO_WORKDRIVE_API_ORIGIN;
    delete process.env.ZOHO_WORKDRIVE_BASE_API_URI;

    expect(resolveWorkDriveUploadOrigin()).toBe("https://workdrive.zoho.com");
  });

  it("uses an explicit origin override when provided", () => {
    process.env.ZOHO_WORKDRIVE_API_ORIGIN = "https://workdrive.zoho.eu/";
    delete process.env.ZOHO_WORKDRIVE_BASE_API_URI;

    expect(resolveWorkDriveUploadOrigin()).toBe("https://workdrive.zoho.eu");
  });

  it("supports legacy full host overrides", () => {
    delete process.env.ZOHO_WORKDRIVE_API_ORIGIN;
    process.env.ZOHO_WORKDRIVE_BASE_API_URI = "workdrive.zoho.eu";

    expect(resolveWorkDriveUploadOrigin()).toBe("https://workdrive.zoho.eu");
  });

  it("ignores unreachable legacy base-domain values", () => {
    delete process.env.ZOHO_WORKDRIVE_API_ORIGIN;
    process.env.ZOHO_WORKDRIVE_BASE_API_URI = "zohoapis.com";

    expect(resolveWorkDriveUploadOrigin()).toBe("https://workdrive.zoho.com");
  });
});
