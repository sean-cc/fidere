# Access control

Fidere is single-user and expects to run on your own machine. It still ships with a real access boundary, because a server bound to `localhost` is reachable by every process and every browser tab on that machine.

## Access token

Every API route needs an access token.

- Read from `FIDERE_TOKEN` if set.
- Otherwise generated on first start into `~/.pi/agent/fidere-token` with mode `0600`.
- The path is printed at startup.

Sign in once by opening `/#token=<token>` or by pasting the token into the login overlay. The fragment never reaches the server or the proxy log.

## Session cookie

- `HttpOnly`, `SameSite=Strict`
- Lasts 30 days; override with `FIDERE_SESSION_MAX_AGE` (seconds)
- `FIDERE_COOKIE_SECURE=auto|on|off` controls the `Secure` flag (default: follow `X-Forwarded-Proto`)

## CSRF

State-changing requests also need a double-submit CSRF token, which the UI sends automatically. Scripts may send `Authorization: Bearer <token>` instead.

## Turning it off

`FIDERE_AUTH=off` disables all of the above. Only do this on a machine nobody else can reach.

## Remote access

The server listens on `127.0.0.1` by default. Do not expose it directly to the internet. Use a reverse proxy with TLS, or a private tunnel.

`HOST=0.0.0.0` is only for trusted networks.
