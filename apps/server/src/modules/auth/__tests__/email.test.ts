import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Isolated from the rest of the suite: every test resets the module registry and re-imports both
// config/env.ts and email.service.ts fresh, since env.ts parses process.env once at import time
// and memoizes the result — the only way to exercise a different transport-precedence combination
// per test is a genuinely fresh module graph, not just reassigning process.env.
const sendMailMock = vi.fn(async () => ({ messageId: "test-id", response: "250 OK" }));
const verifyMock = vi.fn(async () => true);

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: sendMailMock, verify: verifyMock })),
  },
}));

// getEmailTestMode() normally reads the admin-controlled DB setting (default ON, fail-safe) —
// mocked to OFF here so these tests exercise transport *selection*, which is what they're actually
// about; the test-mode toggle itself has no dedicated test yet and isn't this file's concern.
vi.mock("../../admin/service.js", () => ({
  getEmailTestMode: vi.fn(async () => false),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  sendMailMock.mockClear();
  process.env = { ...ORIGINAL_ENV, NODE_ENV: "test" };
  delete process.env.RESEND_API_KEY;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = ORIGINAL_ENV;
});

describe("email.service transport precedence", () => {
  it("logs only (sends nothing) when neither Resend nor SMTP is configured", async () => {
    const { sendVerificationEmail } = await import("../email.service.js");
    vi.stubGlobal("fetch", vi.fn());

    await sendVerificationEmail("user@example.com", "tok");

    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("uses Resend when RESEND_API_KEY is set, even if SMTP is also configured", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "app-password";

    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { sendVerificationEmail } = await import("../email.service.js");
    await sendVerificationEmail("user@example.com", "tok");

    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.any(Object));
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("falls back to SMTP when RESEND_API_KEY is unset but SMTP_* are all set", async () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "development1043@gmail.com";
    process.env.SMTP_PASS = "app-password";

    vi.stubGlobal("fetch", vi.fn());

    const { sendPasswordResetEmail } = await import("../email.service.js");
    await sendPasswordResetEmail("user@example.com", "tok");

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0]?.[0] as { to: string; subject: string };
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toContain("Reset");
  });

  it("a partial SMTP config (missing SMTP_PASS) is treated as not-configured, falls back to log-only", async () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "development1043@gmail.com";
    // SMTP_PASS intentionally left unset.

    vi.stubGlobal("fetch", vi.fn());

    const { sendVerificationEmail } = await import("../email.service.js");
    await sendVerificationEmail("user@example.com", "tok");

    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("a failed SMTP send is non-fatal — never throws out of sendVerificationEmail/sendPasswordResetEmail", async () => {
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "development1043@gmail.com";
    process.env.SMTP_PASS = "wrong-password";
    sendMailMock.mockRejectedValueOnce(new Error("535 Authentication failed"));

    vi.stubGlobal("fetch", vi.fn());

    const { sendVerificationEmail } = await import("../email.service.js");
    await expect(sendVerificationEmail("user@example.com", "tok")).resolves.toBeUndefined();
  });
});
