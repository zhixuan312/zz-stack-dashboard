'use client';

import { useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AgentMark } from '@/components/ui/agent-mark';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SearchInput } from '@/components/ui/search-input';
import { Select, type SelectOption } from '@/components/ui/select';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export type Filter = {
  key: string;
  /** What is filtered, as a person names it: "Status", "Region". */
  label: string;
  value: string;
  /** The first option is "everything": its value is the filter's off state (usually `all`). */
  options: SelectOption[];
  onChange: (v: string) => void;
};

/**
 * Search, filters and view controls for one list, in one row. On phones the search takes the row and the filters move
 * behind one Filters button that opens a sheet. When an agent set the filters, the bar says so ("Set by Claude")
 * until a person changes them, and Clear returns every filter to its off state.
 */
export function FilterBar({
  search,
  filters = [],
  view,
  result,
  setBy,
  onClear,
  className,
}: {
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  filters?: Filter[];
  /** View controls on the right: a Segmented control, a column menu. */
  view?: ReactNode;
  /** A quiet count of what the filters let through: "214 requests". */
  result?: ReactNode;
  /** The agent that set the current filters. */
  setBy?: string;
  /** Return every filter (and the search) to its off state. Shown only while something is filtered. */
  onClear?: () => void;
  className?: string;
}) {
  const active = filters.filter((f) => f.value !== f.options[0]?.value).length + (search?.value ? 1 : 0);
  const [open, setOpen] = useState(false);
  const selects = (size: 'sm' | 'md', block?: boolean) =>
    filters.map((f) => {
      const on = f.value !== f.options[0]?.value;
      const control = (
        <Select
          key={f.key}
          size={size}
          aria-label={f.label}
          value={f.value}
          onValueChange={f.onChange}
          options={f.options}
          leading={<span className="text-xs text-ink-3">{f.label}</span>}
          className={cn(!block && 'w-auto min-w-0', on && !block && 'border-accent-line bg-accent-tint text-ink')}
        />
      );
      return block ? (
        <Field key={f.key} label={f.label}>{(p) => <Select {...p} value={f.value} onValueChange={f.onChange} options={f.options} />}</Field>
      ) : control;
    });

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {search ? (
          <SearchInput
            size="sm"
            value={search.value}
            onValueChange={search.onChange}
            placeholder={search.placeholder ?? 'Search'}
            shortcut="/"
            className="min-w-0 flex-1 md:max-w-72"
          />
        ) : null}
        <div className="flex min-w-0 items-center gap-2 max-md:hidden">{selects('sm')}</div>
        {filters.length ? (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" icon={<SlidersHorizontal />} className="md:hidden">
                Filters{active ? <span className="t-num -mr-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1 text-2xs font-semibold text-on-accent">{active}</span> : null}
              </Button>
            </SheetTrigger>
            <SheetContent
              title="Filters"
              description={result ? <>Showing {result}.</> : undefined}
              footer={
                <>
                  {onClear && active ? <Button variant="ghost" onClick={onClear}>Clear filters</Button> : null}
                  <SheetClose asChild><Button variant="primary">Show results</Button></SheetClose>
                </>
              }
            >
              <div className="flex flex-col gap-5">
                {selects('md', true)}
                {view ? <div className="border-t border-line pt-5">{view}</div> : null}
              </div>
            </SheetContent>
          </Sheet>
        ) : null}
        {onClear && active ? (
          <Button size="sm" variant="ghost" icon={<X />} onClick={onClear} className="max-md:hidden">Clear</Button>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {result ? <span className="t-num text-xs whitespace-nowrap text-ink-3 max-lg:hidden">{result}</span> : null}
          {view ? <div className="max-md:hidden">{view}</div> : null}
        </div>
      </div>
      {setBy && active ? (
        <p className="flex items-center gap-2 text-xs text-ink-2">
          <AgentMark size="sm" />
          <span>
            <span className="font-medium text-ink">Set by {setBy}</span> · these filters came from the assistant
          </span>
          {onClear ? <button type="button" onClick={onClear} className="font-medium text-accent-ink hover:underline">Clear</button> : null}
        </p>
      ) : null}
    </div>
  );
}
