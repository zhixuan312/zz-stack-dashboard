# Menu

A menu is a list of actions or choices that opens from a trigger: a row's More, an Export menu, a region choice. Items run on click or Enter; a choice shows a check.

Status: beta

## Anatomy

1. **Trigger**: any button; it shows the open state (`data-state="open"`).
2. **Surface**: `surface-raised`, `radius-lg` 16px, 4px inner padding, `shadow-overlay` (the hairline is part of the shadow).
3. **Item**: icon (16px, `ink-3`), label, optional shortcut (`text-xs`, `ink-3`) at the end.
4. **Label** (optional): a group's name in eyebrow style.
5. **Separator**: a 1px `line` rule across the full width.
6. **Check**: on the current choice in a radio group, `accent`, 16px.

## Variants

| Variant | Use |
|---|---|
| Actions | Commands: Copy, Export, Delete. The destructive item is last, after a separator, in `critical-ink`. |
| Choices | A radio group: one of several, the current one checked. |

## Sizes

Minimum width 208px. Item height 32px (44px on a coarse pointer), padding 8px, radius `radius-sm` 8px, gap icon to label 10px, label `text-sm` 13px.

## States

| State | Item |
|---|---|
| Rest | label `ink` |
| Highlighted (pointer or arrow keys) | fill `fill-hover` |
| Disabled | label `ink-disabled`; skipped by the arrow keys |
| Checked | the accent check at the end |

The surface enters with `float-in`: 4px down to place and 97% to full scale over `dur-enter` 320ms `ease-out`; it leaves over `dur-exit` 140ms.

## Behaviour

- Opens on click, Enter, Space or Arrow Down on the trigger; focus moves to the first item.
- Arrow keys move, Home and End jump, typing a letter jumps to the matching item, Enter runs, Escape closes and returns focus to the trigger.
- It aligns to the trigger's start edge (end for a trailing More) and flips to stay 8px inside the viewport.
- Its height is bounded by Radix's available viewport space. Longer menus scroll; keyboard focus scrolls its item into view, including Home and End on a short screen.

## Surfaces

- **Console**: as specified.
- **Mobile**: items grow to 44px on touch; the menu still anchors to its trigger.
- **Embed**: same; menus stay inside the frame through collision padding.

## Agents

Not applicable. An agent never opens a menu: it calls the tool the menu item would.

## Accessibility

- Radix DropdownMenu: `role="menu"`, `menuitem`, `menuitemradio` with `aria-checked`; the trigger carries `aria-expanded`.
- Item text `ink` on `surface-raised` 18.5:1; shortcut `ink-3` 5.3:1 (light, cobalt).
- An icon-only trigger has an `aria-label`.

## Content

- Verb first: "Copy request ID", "Export as JSON", "Delete log entry". A choice is a noun: "eu-west-1".

## Do and do not

- Do put the destructive item last, after a separator.
- Do not hide the only way to do something in a menu; a frequent action belongs on the page.
- Do not nest menus more than one level.

## Implementation

```tsx
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';

<Menu>
  <MenuTrigger asChild><IconButton label="More actions" icon={<MoreHorizontal />} /></MenuTrigger>
  <MenuContent align="end">
    <MenuItem shortcut="⌘C"><Copy />Copy request ID</MenuItem>
    <MenuSeparator />
    <MenuItem tone="critical"><Trash2 />Delete log entry</MenuItem>
  </MenuContent>
</Menu>
```

Also exported: `MenuGroup`, `MenuLabel`, `MenuRadioGroup`, `MenuRadioItem`, and `MENU_CONTENT` / `MENU_ITEM`, the classes a static mock draws with.
