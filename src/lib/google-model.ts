import "server-only";
import { createVertex } from "@ai-sdk/google-vertex";
import { ExternalAccountClient } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";
import { required } from "./env";
import { AI_MODEL } from "./semantic-config";

export function googleModel() {
  if (process.env.GOOGLE_AUTH_MODE === "vercel-oidc") {
    const project = required("GOOGLE_VERTEX_PROJECT");
    const audience = required("GOOGLE_WIF_AUDIENCE");
    const account = required("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    if (!/^\/\/iam\.googleapis\.com\/projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/.test(audience) ||
        !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(account)) throw Error("Invalid Google identity configuration");
    const authClient = ExternalAccountClient.fromJSON({
      type: "external_account", audience,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      token_url: "https://sts.googleapis.com/v1/token",
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${account}:generateAccessToken`,
      subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
    });
    if (!authClient) throw Error("Google identity unavailable");
    return createVertex({ project, location: "global", googleAuthOptions: { authClient, projectId: project } })(AI_MODEL);
  }
  const vertex = process.env.GOOGLE_VERTEX_API_KEY
    ? createVertex({ apiKey: process.env.GOOGLE_VERTEX_API_KEY })
    : createVertex({ project: required("GOOGLE_VERTEX_PROJECT"), location: "global",
        googleAuthOptions: { credentials: JSON.parse(required("GOOGLE_VERTEX_CREDENTIALS")) } });
  return vertex(AI_MODEL);
}
