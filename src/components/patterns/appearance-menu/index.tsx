'use client';

import { Monitor, Moon, Settings2, Sun } from 'lucide-react';
import { ACCENTS } from '@/lib/preferences';
import { cn } from '@/lib/cn';
import { usePreferences } from '@/components/base/providers';
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';


/** The person's appearance: theme, accent and density, applied at once and kept on this device. */
export function AppearanceMenu({ className }: { className?: string }) {
  const { prefs, set } = usePreferences();
  return (
    <Menu>
      <MenuTrigger aria-label="Appearance" className={cn('press grid size-8 place-items-center rounded-md text-ink-3 hover:bg-fill-hover hover:text-ink data-[state=open]:bg-fill-active data-[state=open]:text-ink', className)}>
        <Settings2 className="size-4" strokeWidth={1.75} />
      </MenuTrigger>
      <MenuContent side="top" align="end" className="w-60">
        <MenuLabel>Theme</MenuLabel>
        <MenuRadioGroup value={prefs.theme} onValueChange={(v) => set({ theme: v as typeof prefs.theme })}>
          <MenuRadioItem value="system"><Monitor />System</MenuRadioItem>
          <MenuRadioItem value="light"><Sun />Light</MenuRadioItem>
          <MenuRadioItem value="dark"><Moon />Dark</MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuLabel>Accent</MenuLabel>
        <div role="radiogroup" aria-label="Accent" className="flex gap-1.5 px-2 pt-0.5 pb-2">
          {ACCENTS.map((a) => {
            return (
              <button
                key={a}
                role="radio"
                aria-checked={prefs.accent === a}
                aria-label={a}
                title={a[0].toUpperCase() + a.slice(1)}
                onClick={() => set({ accent: a })}
                className="press hit grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-surface-raised transition-[box-shadow,transform] aria-checked:ring-2 aria-checked:ring-ink"
              >
                <span data-accent={a} className="size-5 rounded-full bg-accent" />
              </button>
            );
          })}
        </div>
        <MenuSeparator />
        <MenuLabel>Density</MenuLabel>
        <MenuRadioGroup value={prefs.density} onValueChange={(v) => set({ density: v as typeof prefs.density })}>
          <MenuRadioItem value="comfortable">Comfortable</MenuRadioItem>
          <MenuRadioItem value="compact">Compact</MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
