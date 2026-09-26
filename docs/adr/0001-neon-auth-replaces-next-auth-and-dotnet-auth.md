# Neon Auth replaces next-auth and the .NET auth service

The `web-shop` prototype signed Customers in with next-auth Credentials calling a separate .NET API (`/auth/login`, `/auth/refresh`, JWT refresh tokens). This app is one full-stack Next.js project, so login, sessions and email verification use Neon's Managed Better Auth (`@neondatabase/auth`) with cookie sessions on the same Neon project as our data. We rejected keeping next-auth in front of Neon Auth because it would mean two session layers and our own token-refresh logic for no benefit, and we rejected carrying the .NET API over because there is no reason to run a second backend for auth.

## Consequences

- Neon Auth's user record is not extensible (only name and image can be updated), so the Contact number and Addresses live in our own tables that reference the Neon user id. We never write to `neon_auth.*`. Because login and Customer details are two separate writes, sign-up can half-fail; a signed-in person without Customer details is sent to `/complete-profile`.
- Moving to another auth provider later means migrating credentials and sessions, not just swapping a library.
