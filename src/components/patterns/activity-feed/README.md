# Activity feed

The activity feed lists what happened, who did it and when, one line per event, newest first, and always says when an agent acted and for whom.

Status: beta

## Anatomy

1. **Actor**: a 24px Avatar for a person; a dot in a soft disc for the system (toned when the event is good or needs attention); an Agent mark for an agent; an empty disc in a dashed `line-strong` hairline, with no initials, for an actor the record does not hold, so nobody unknown reads as a person.
2. **Sentence**: the actor (`ink` 500), the verb (`ink-2`) and the object (`ink`), which is a link to its record (`ink` 500, `accent-ink` on hover, a → after it) when it has one; for an agent, "· for Jonas Weber" in `ink-3`.
3. **Time**: relative (`text-xs`, `ink-3`, tabular), the exact time in its title.
4. **Thread**: a 1px `line` joining the actors down the list.

## Composition

Avatar, Agent mark, and the date formatters, inside a Card with a divided header.

## Data

`ActivityEvent { id, at, actor, system?, unknown?, via?, verb, object, href?, tone? }`. `via` names the agent when an assistant acted for `actor`. `unknown` says the record does not hold who acted: `actor` is then the product's words for that ("Someone not recorded"), read in the line as any actor is, beside the empty disc. `href` is the object's record: an event about a record opens it, so the feed is never a dead end. `tone` (`positive`, `warning`, `critical`) colours the system's dot only.

## States

| State | What shows |
|---|---|
| Events | One line each, 16px apart |
| Empty | The feed draws only events: with none, its card says so in its own words in place of the list ("No activity yet. Changes to keys, limits and deployments appear here.") |
| Loading | The page's loading draws the card as lines (`LinesSkeleton` from Page loading); the events arrive with the page, so the feed has no loading state of its own |

## Surfaces

- **Console** and **Mobile**: the same; on phones the sentence wraps and the time stays top right. A word wider than the line, such as an actor named by an email address, breaks inside itself rather than spilling.
- **Embed**: the five newest, with Expand for the rest.

## Agents

This is where provenance lives. An agent's change reads "Claude raised the rate limit for Parallax AI to 2,000 rpm · for Jonas Weber", with the square Agent mark, never a person's round avatar.

## Accessibility

- An ordered list; each time is a `time` element with its ISO value.
- Contrast (dark): verb `ink-2` 8.0:1 on surface, time `ink-3` 6.4:1.

## Content

- Past tense, plain verbs: "rotated the production signing key", "deployed gateway v4.18.2". The object is specific.

## Do and do not

- Do write the agent and the person on every agent event.
- Do not log reads; the feed is for changes.

## Implementation

```tsx
import { ActivityFeed } from '@/components/patterns/activity-feed';

<ActivityFeed events={events} now={updatedAt} />
```
