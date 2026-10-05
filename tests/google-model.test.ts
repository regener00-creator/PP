import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ create: vi.fn(), auth: vi.fn(), token: vi.fn() }));
vi.mock("@ai-sdk/google-vertex", () => ({ createVertex: state.create }));
vi.mock("google-auth-library", () => ({ ExternalAccountClient: { fromJSON: state.auth } }));
vi.mock("@vercel/oidc", () => ({ getVercelOidcToken: state.token }));
import { googleModel } from "../src/lib/google-model";
import { semanticConfig } from "../src/lib/semantic-config";
describe("Google workload identity", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("GOOGLE_AUTH_MODE", "vercel-oidc"); vi.stubEnv("GOOGLE_VERTEX_PROJECT", "pp-project");
    vi.stubEnv("GOOGLE_WIF_AUDIENCE", "//iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/pp-vercel/providers/production");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "pp-gemini@pp-project.iam.gserviceaccount.com");
    vi.stubEnv("AI_ENABLED", "true"); vi.stubEnv("AI_MONTHLY_LIMIT", "1000");
    state.create.mockReturnValue((id: string) => id); state.auth.mockReturnValue({ credentials: "short-lived" });
    state.token.mockResolvedValue("RUNTIME_TOKEN");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("uses fixed Google endpoints and obtains the token only when Google requests it", async () => {
    expect(semanticConfig().enabled).toBe(true); expect(googleModel()).toBe("gemini-3.5-flash-lite");
    expect(state.token).not.toHaveBeenCalled();
    const config = state.auth.mock.calls[0][0];
    expect(config.token_url).toBe("https://sts.googleapis.com/v1/token");
    expect(config.service_account_impersonation_url).toBe("https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/pp-gemini@pp-project.iam.gserviceaccount.com:generateAccessToken");
    expect(await config.subject_token_supplier.getSubjectToken()).toBe("RUNTIME_TOKEN");
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({ project: "pp-project", location: "global" }));
  });
  it("rejects malformed identity configuration before exchanging any token", () => {
    vi.stubEnv("GOOGLE_WIF_AUDIENCE", "https://untrusted.example"); expect(googleModel).toThrow("Invalid Google identity configuration"); expect(state.token).not.toHaveBeenCalled();
  });
  it("does not enable incomplete workload identity configuration", () => {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", ""); expect(semanticConfig().enabled).toBe(false);
  });
});
