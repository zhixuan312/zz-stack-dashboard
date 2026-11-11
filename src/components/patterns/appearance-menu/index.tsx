'use client';

import { Monitor, Moon, Settings2, Sun } from 'lucide-react';
import { ACCENTS } from '../../../lib/preferences';
import { cn } from '../../../lib/cn';
import { usePreferences } from '../../base/providers';
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '../../ui/menu/index';


/** The person's appearance: theme, accent and density, applied at once and kept on this device. */
export function AppearanceMenu({ className }: { className?: string }) {
  const { prefs, set } = usePreferences();
  return (
    <Menu>
      <MenuTrigger aria-label="Appearance" className={cn('press hit grid size-8 place-items-center rounded-md text-ink-3 hover:bg-fill-hover hover:text-ink data-[state=open]:bg-fill-active data-[state=open]:text-ink', className)}>
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
        <MenuRadioGroup value={prefs.accent} onValueChange={(accent) => set({ accent })}>
          {ACCENTS.map((accent) => (
            <MenuRadioItem key={accent} value={accent} aria-label={accent}>
              <span data-accent={accent} data-swatch className="size-4 rounded-full bg-accent" />
              {accent[0].toUpperCase() + accent.slice(1)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
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
