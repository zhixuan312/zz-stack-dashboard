# Enrol

Register a passkey from a one-time enrolment link.

## Structure

- The poster sentence and the register panel.

## States

- No link in the address: a banner saying to open the whole link.
- Cancelled: the link is spent, and the panel says to ask for another.

## Surfaces

Console, desktop and phone. Reads `POST /auth/passkey/register/*`.
