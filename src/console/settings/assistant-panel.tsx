'use client';

import { Suspense, use } from 'react';
import { app } from '@/app.config';
import { usePreferences } from '@/components/base/providers';
import { useAssistantAvailable } from '@/components/base/shell';
import { FormSection } from '@/components/patterns/form-section';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';

/**
 * The person's own switch for the assistant: its launcher in the top bar and its panel, on this device.
 *
 * Drawn only where the console has an assistant to switch. Whether it has one is the layout's promise, resolved from
 * the environment at request time, so this section waits for it behind its own boundary and holds its place meanwhile.
 *
 * DELIBERATE: last on the page. A console with no model configured resolves to nothing here, and a section that
 * disappears above five others would move all of them; at the foot of the page it moves nothing.
 */
export function AssistantPanel() {
  const available = useAssistantAvailable();
  return (
    <Suspense fallback={<AssistantPlace />}>
      <AssistantSection available={available} />
    </Suspense>
  );
}

/** The section's place while the request says whether there is an assistant. */
function AssistantPlace() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-3 w-96 max-w-full" />
      <Skeleton className="h-9 w-full max-w-lg rounded-md" />
    </div>
  );
}

function AssistantSection({ available }: { available: Promise<boolean> }) {
  const { prefs, set } = usePreferences();
  if (!use(available)) return null;
  return (
    <FormSection title="Assistant" description={`The assistant answers questions about ${app.name} from the page you are on and from the platform's own records. It changes nothing.`}>
      <Switch
        label="Show the assistant"
        description="The panel and its launcher in the top bar. Your conversation stays on this device, and hiding the assistant keeps it."
        checked={prefs.assistant}
        onCheckedChange={(on) => { set({ assistant: on }); toast({ tone: 'neutral', title: on ? 'Assistant shown' : 'Assistant hidden' }); }}
      />
    </FormSection>
  );
}
