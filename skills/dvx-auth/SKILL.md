# dvx-auth Skill

## Auth Types

dvx supports two authentication types:

- **service-principal** — App-only, uses client credentials (client ID + secret). Runs as an application user in Dataverse. No interactive login required. Suitable for automation and CI.
- **delegated** — User-delegated, uses PKCE browser flow (no client secret). Runs as the signed-in user. Required when impersonation or user-level audit is needed.

## Service Principal Setup

1. Register an app in Entra ID (Azure AD).
2. Create a client secret under Certificates & Secrets.
3. In Dataverse/Power Platform admin, create an Application User bound to that app registration.
4. Assign the Application User a Dataverse security role.
5. Create the profile: `dvx auth create --environment-url ... --tenant-id ... --client-id ... --client-secret ...`
6. The secret should be stored in the OS keychain or passed via `DATAVERSE_CLIENT_SECRET` env var — never committed.

## Delegated Login (PKCE)

1. Register an app in Entra ID. Under Authentication, add a mobile/desktop redirect URI: `http://localhost`.
2. Grant the app `Dynamics CRM / user_impersonation` delegated permission.
3. Run `dvx auth login --environment-url ... --tenant-id ... --client-id ...`
4. A browser window opens for interactive sign-in.
5. On success, the token is cached in `.dvx/msal-cache.json`. Subsequent calls use silent refresh until the refresh token expires.

## Profile Management

- `dvx auth create` — create service-principal profile
- `dvx auth login` — create delegated profile via browser
- `dvx auth list` — list all profiles; active profile is marked
- `dvx auth select <name>` — switch active profile

Profiles are stored in `.dvx/config.json`. Secrets are never written there.

## CallerObjectId Impersonation

Used with service-principal auth to execute operations as a specific Dataverse user.

```
dvx create account --json '{"name":"Acme"}' --as-user <entra-user-object-id>
```

- Applies the `CallerObjectId` header to mutating requests (POST, PATCH, DELETE).
- Requires the application user to hold the **prvActOnBehalfOfAnotherUser** privilege.
- If the privilege is missing, dvx throws `ImpersonationPrivilegeError` (HTTP 403).
- GET requests are never impersonated — only writes are affected.

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `AuthProfileNotFoundError` | Profile name not in config | Run `dvx auth list` to see valid names |
| `TokenAcquisitionError` | Missing client secret | Set `DATAVERSE_CLIENT_SECRET` env var |
| `PkceFlowError` | Browser flow returned no token | Re-run `dvx auth login` |
| `ImpersonationPrivilegeError` | App user lacks act-on-behalf privilege | Add `prvActOnBehalfOfAnotherUser` to security role |
