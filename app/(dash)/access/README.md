# Access

What lets a person and their agents in, and nothing of anybody else's: their own tokens, the setup that connects a client, the applications and browsers signed in as them, their passkeys and the team they act for, read on the console's server. It replaces Settings. Both roles open it; a team's admin also has the members of the team they act for.

## Structure

- Gate first: the page asks for `access`, which needs `work:read`, before it renders, so a person who does not hold it is answered by the refused page and nothing on the page is read. Its title comes from `gatedMetadata`, so under `refusal: 'absent'` it names nothing; its loading state (`OfferedLoading`) is headed Access for a person whose own rail offers it, at `/access` alone, and keeps `gatedLoading`'s words, which name nothing, for anyone else and in the prerendered shell.
- Masthead: the kicker `ZZ Stack · Work`, the title, one static sentence and the as-of line (the read's own `meta.asOf`), drawn before the read answers. The page is at the form width.
- Sections 56px apart, each a ZZ Meridian `FormSection`, its title and purpose on the left and its card on the right (one column on a phone), all from the one `GET /access`:
  - **Tokens**, the page's protagonist: one row a token, newest first, ten to a page (on a phone, a card: the label and what the hidden columns say on their lines, the state and Revoke under them; an address in a label breaks only between its parts): its label, the application it was minted through (`Issued directly` for one issued here or by `pat_issue`), when it was issued, when it was last used (`Never` when it has made no call) and its state, Live or Revoked; Revoke on a live one, confirmed in place. Issuing one is the card's last line, with an optional label. Ask is in the section's head.
  - **Client setup**: the steps to connect Claude Code, which the gateway writes as Markdown, rendered: their headings, bold and inline code drawn, the heading that names the person left to the section's title, every other heading two levels down so a step sits under the section's title rather than above it, and each block of commands a block of its own with its own Copy. The token's place in them is a placeholder, never a value.
  - **Connected applications**: one row an application the person authorised, by its registered name: how many tokens were minted for them through it and how many are live, the first issued and the last used. Revoke ends every live token of theirs from it and nobody else's, and the registration stays; an application with none live offers nothing.
  - **Signed-in browsers**: one row a live console session of theirs, the one asking first and marked `This browser` with a neutral label (the accent is kept for what a person presses, so `Admin` is neutral too): the browser and system it said it was, when it signed in, when it was last seen and when its sign-in ends. Sign out on every other one; none on this one, which signs out from the menu.
  - **Passkeys**: one row a passkey, newest first: its label (`Unnamed passkey` without one), how it is reached, when it was added and last used. Nothing here adds or removes one.
  - **The team you act for**: the teams the person belongs to, their role in each, and the one this browser acts for, marked `Acting for`; `Act as this team` on every other. Their agents keep their own team, which the ZZ Access agent moves, and the section says so in those words.
  - **`<team>`'s members**: only when the person is the admin of the team they act for: its roster with each role, Remove confirmed in place, and adding a member on the card's last line. An address breaks only between its parts, after the `@` and before a dot; on a phone each member is a card, the address whole on its line and the role and Remove under it.
  - **Assistant**: the person's own switch for the panel ("Show the assistant"), last, and drawn only where the console has an assistant.
- Every write is the person's, through the gateway's own routes: `POST` and `DELETE /settings/me/tokens`, `DELETE /settings/me/applications/:client`, `DELETE /settings/me/browsers/:id`, `POST /settings/me/active-team` and `/settings/team/members`. A refused write keeps what the person typed and says the gateway's sentence; nothing changes.

## States

| State | What shows |
|---|---|
| Loading | `loading.tsx` while the gate asks `/me`, headed Access for a person whose rail offers it (`OfferedLoading`), then the masthead over eight section placeholders, the tallest page's, while the read is under way |
| Default | Every section above |
| A member | The same sections; the members only for the admin of the team acted for |
| A new token | A dialog, outside the page's text, with the value and Copy, shown once and never again; the table reads the new token at once |
| Nothing yet | `No token issued yet`, `No application connected`, `No passkey recorded`, `You are not a member of any team yet`, each in its own section; every other section stands |
| Opened with a token | `No browser signed in`: no browser is signed in as the person |
| A write refused | The gateway's sentence: under the issue line or the member line, which keep what was typed, or in a toast for a revoke, a sign-out or a switch; nothing changes |
| Read failed | The error state with the gateway's sentence and Retry, which reads again |
| Slower than 4.5 seconds | The same error state, saying the read did not answer within 4.5 seconds, with Retry; never an endless skeleton |
| Read again | Retry reads again in the browser, busy only after the person presses it and until that read answers; a read a change starts leaves the state and its Retry where they are, never busy, so a keyboard user keeps their place |
| Refused | The refused page, as an address that names nothing |
| Signed out since the gate | Sign-in |

## Agents

The assistant reads this page and changes nothing: it never issues, revokes or switches. The page shares its context through `accessContext` in `src/views/access-context.ts`, built from the same read and the same words as the page, and `view_access` builds the same context from the same response (`GET /access`), so the assistant quotes what the screen shows. Ask is on Tokens: which are live, which application each is for, and which were never used.

A token's value never reaches the assistant: it is shown once, in a dialog portalled outside the region whose text an Ask sends, and marked `data-assistant="omit"` besides (bug ee35a0d7). Neither the context nor any tool's answer holds a token's value, a hash, a session's id or an enrolment link.

### What the agent reads

The live and revoked tokens, the applications, the signed-in browsers, the passkeys and the team acted for, each with what it counts. What code found, most important first: that every change is the person's, made on the page, and none the assistant's; the live tokens never used; the tokens, newest first, by label, state, application and dates, the first eight; the applications with their token counts and dates; the teams with the role in each; the browsers by kind, the one asking marked; the passkeys; and the sections this caller has. When the budget is tight the last of those go first, and every count stays a fact: neither person the fake signs in loses any. It says that a token's value is shown once and never read again, by anyone.

```text
- Their tokens, newest first: "laptop" live, issued directly, issued 01 Oct 2026, last used 16 Oct 2026; "old ci runner" revoked, issued directly, issued 16 Aug 2026, last used 29 Aug 2026.
```

- **Console assistant:** this text in its prompt's `<view-context>` block, with the page's address, and the page text after it for anything the context does not cover, without the value a dialog shows once; `view_access` answers the same text from anywhere in the console, and `explore_access` (`src/views/access-explore.ts`), offered on this page alone, counts the caller's own tokens by state and by application, a week or a month at a time, down to each token by label and date, from their own Access answer. No answer holds a token's value.

### What the agent does here

Protagonist: Tokens.

- "How many of my tokens are live, and how many are revoked?" — the caller's tokens over all complete days, by state
- "Which applications were my tokens minted for?" — the caller's tokens over all complete days, by application
- "Which tokens did I issue in the last 90 days?" — the caller's tokens issued over 90 complete days, down to each by label and date
- "How many tokens did I issue each month this year?" — the caller's tokens over all complete days, a month at a time
- "Revoke my laptop token for me." — nothing is asked of the prepared query: the answer names /access and the token's Revoke under Tokens, where the person revokes it, and says the assistant revoked nothing

## Surfaces

Console, desktop and phone; at 390px each table keeps its lead column and state, the dates and the application under the lead's name. Reads `GET /access` on the console's server, as the person, once per request and bounded at 4.5 seconds; nothing is cached across callers. A write, and any change another tab or browser makes (the gateway tells every tab `settings`), reads it again in the browser. A team admin's members are a browser read of `GET /settings/team/members`.
