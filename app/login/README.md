# Sign in

The one screen a visitor sees before they are anyone: a passkey and nothing to type.

## Structure

- The poster sentence and what the console answers.
- The sign-in panel: the passkey button, the method and this site's relying party.

## States

- Refused: a warning banner with the gateway's own reason.
- Not configured: a banner naming the gateway setting.
- Signed in already: sent on to where they were going.

## Surfaces

Console, desktop and phone. Reads `GET /me`, `GET /auth/status`, `POST /auth/passkey/login/*`.
