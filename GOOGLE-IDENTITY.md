# PP Google identity configuration

Status: configured with explicit owner approval on 2026-09-29. Agent Platform API is enabled. Google disallows API keys; that policy remains intact. Vercel Production successfully called Gemini using Workload Identity Federation and passed three synthetic semantic checks. No permanent Google credential was created.

Target project: `project-c174b7fb-23ee-4a19-bcb` (My First Project).

Created resources:

- Pool `pp-vercel`; provider `production`; mapping `google.subject=assertion.sub`
- Issuer `https://oidc.vercel.com/regener00-creators-projects` (team issuer verified in Vercel project configuration)
- Allowed audience `https://vercel.com/regener00-creators-projects`
- Provider condition: `assertion.owner_id == 'team_pzOWcZ6fMt1PwZl00IIMZoo5' && assertion.project_id == 'prj_bzMPDuGQnEgjqSL3LGrPYqs2AI3c' && assertion.environment == 'production'`
- Service account `pp-gemini` with a custom role `ppGeminiInvoker` containing only `aiplatform.endpoints.predict` and `serviceusage.services.use`
- On that service account only, grant `roles/iam.workloadIdentityUser` to the exact pool subject `owner:regener00-creators-projects:project:pp:environment:production`
- Enable IAM / STS / IAM Service Account Credentials APIs only as needed for federation. No broad Owner/Editor/Vertex Admin roles, no service account keys.

The IAM predict permission permits model invocation within this project, not only one model. PP code fixes the selected model and enforces its own monthly cap. This does not limit calls made by other authorized applications or replace a Google account spending limit.

Vercel Production configuration: `GOOGLE_AUTH_MODE=vercel-oidc`, `GOOGLE_VERTEX_PROJECT`, `GOOGLE_WIF_AUDIENCE` (actual project number from Google), `GOOGLE_SERVICE_ACCOUNT_EMAIL`. These values are resource identifiers, not persistent secrets. `@vercel/oidc` supplies short-lived tokens per request. Do not serialize or log tokens.

Authenticated synthetic test passed 3/3: nickname/synonym equivalence, current-meal rejection, and other-person rejection. The first attempt failed while permissions were newly created; retry succeeded. Four monthly slots were consumed including that failure. AI is enabled after this test; the monthly cap is 1000. No real memory content or LINE messages were sent by this test.

Project number: `557018318250`. Audience: `//iam.googleapis.com/projects/557018318250/locations/global/workloadIdentityPools/pp-vercel/providers/production`. Service-account ID: `107404582632218506814`. The Workload Identity User grant is directly on this service account, not the project.

Do not upgrade Google Billing or prepay without a separate owner decision. Disable the pool/provider to revoke Google access, or set `AI_ENABLED=false` and redeploy to stop bot requests. The admin synthetic test remains available while AI is disabled, and still consumes the same monthly allowance. Billing attribution may be delayed; a successful model call does not prove which promotional credit was consumed.

Sources: [Vercel Google OIDC setup](https://vercel.com/docs/oidc/gcp), [Vercel claims](https://vercel.com/docs/oidc/reference), [Google federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-providers), [GenerateContent permission](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/reference/rpc/google.cloud.aiplatform.v1).
