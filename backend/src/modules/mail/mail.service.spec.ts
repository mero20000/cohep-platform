import { ConfigService } from "@nestjs/config";
import { MailService } from "./mail.service";

const fetchMock = jest.fn();

describe("MailService", () => {
  let service: MailService;
  let configGet: jest.Mock;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => "",
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    configGet = jest.fn((key: string, def?: any) => {
      if (key === "SENDGRID_API_KEY") return "SG.test-key";
      return def;
    });
    service = new MailService({ get: configGet } as unknown as ConfigService);
  });

  it("sends a password reset email with an absolute CTA link", async () => {
    await service.sendPasswordReset(
      "user@example.com",
      "https://cohep-platform.vercel.app/reset-password?token=abc123",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.sendgrid.com/v3/mail/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer SG.test-key",
          "Content-Type": "application/json",
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as {
      from: { email: string };
      personalizations: Array<{ to: Array<{ email: string }> }>;
      subject: string;
      content: Array<{ type: string; value: string }>;
    };
    expect(body.from.email).toBe("noreply@niangelos.app");
    expect(body.personalizations[0].to[0].email).toBe("user@example.com");
    expect(body.subject).toBe("Reset your COHEP password");
    expect(body.content[0].value).toContain(
      "https://cohep-platform.vercel.app/reset-password?token=abc123",
    );
    expect(body.content[0].value).toContain("Reset Your Password");
    expect(body.content[0].value).toContain("expires in 1 hour");
  });

  it("uses MAIL_FROM when configured", async () => {
    configGet.mockImplementation((key: string, def?: any) => {
      if (key === "SENDGRID_API_KEY") return "SG.test-key";
      if (key === "MAIL_FROM") return "custom@example.com";
      return def;
    });
    service = new MailService({ get: configGet } as unknown as ConfigService);

    await service.sendPasswordReset(
      "user@example.com",
      "https://x.example/reset?token=1",
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as {
      from: { email: string };
    };
    expect(body.from.email).toBe("custom@example.com");
  });

  it("logs and throws when SendGrid returns an error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"errors":[{"message":"invalid api key"}]}',
    });
    const logSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      service.sendPasswordReset(
        "user@example.com",
        "https://x.example/reset?token=1",
      ),
    ).rejects.toThrow("SendGrid 401");
    expect(logSpy).toHaveBeenCalledWith(
      '[mail] FAILED to=user@example.com subject="Reset your COHEP password"',
      'SendGrid 401: {"errors":[{"message":"invalid api key"}]}',
    );
    logSpy.mockRestore();
  });

  it("fails fast with a clear error when SENDGRID_API_KEY is missing", async () => {
    configGet.mockImplementation((key: string, def?: any) =>
      key === "SENDGRID_API_KEY" ? "" : def,
    );
    const logSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    service = new MailService({ get: configGet } as unknown as ConfigService);

    await expect(
      service.sendPasswordReset(
        "user@example.com",
        "https://x.example/reset?token=1",
      ),
    ).rejects.toThrow("SENDGRID_API_KEY is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
