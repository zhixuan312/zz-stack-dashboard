import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, refresh() {}, replace() {} }), usePathname: () => '/' }));
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const WRAP = ['grid', 'min-w-0', 'grid-cols-[minmax(0,max-content)]'];
const classes = (el: Element) => el.getAttribute('class')?.split(/\s+/) ?? [];
const wrapOf = (td: Element) => [...td.children].find((c) => WRAP.every((k) => classes(c).includes(k)));

/** A cut cell asks for its whole content and shrinks only when the table has no room; it never zeroes its width. */
function expectWrapped(td: Element, text: string) {
  expect(classes(td)).not.toContain('max-w-0');
  expect(classes(td)).not.toContain('truncate');
  const wrap = wrapOf(td);
  expect(wrap, 'the one-track wrapper').toBeTruthy();
  expect(wrap!.children).toHaveLength(1);
  expect(classes(wrap!.children[0])).toContain('truncate');
  expect(wrap!.textContent).toContain(text);
  return wrap!;
}

describe('a cut cell keeps its content width (spec AC-1.4)', () => {
  it('TableCell wraps a truncating value and keeps its title', () => {
    const { container } = render(
      <Table>
        <TableHead><TableRow><TableHeader grow>Request</TableHeader><TableHeader>Status</TableHeader></TableRow></TableHead>
        <TableBody><TableRow><TableCell truncate>/v1/messages/with/a/long/tail</TableCell><TableCell>200</TableCell></TableRow></TableBody>
      </Table>,
    );
    const td = container.querySelector('td')!;
    expectWrapped(td, '/v1/messages/with/a/long/tail');
    expect(td.getAttribute('title')).toBe('/v1/messages/with/a/long/tail');
    const heads = [...container.querySelectorAll('th')];
    expect(heads.some((th) => classes(th).includes('w-full'))).toBe(false);
    expect(classes(heads[0])).toEqual(expect.arrayContaining(['min-w-40']));
  });
});

type Row = { id: string; name: string; plan: string; region: string };
const rows: Row[] = [{ id: 'cus_8f2a', name: 'Northwind Labs International Holdings', plan: 'Enterprise', region: 'eu-west-1' }];

describe('DataTable shares the spare (spec AC-1.4, AC-1.6)', () => {
  it('wraps every cut column, claims no spare on any head, and keeps fixed widths and the floor', () => {
    const columns: Column<Row>[] = [
      { key: 'name', header: 'Customer', grow: true, truncate: true, mobile: 'title', title: (r) => r.name, cell: (r) => <span className="flex min-w-0 items-center gap-3"><span className="truncate font-medium">{r.name}</span></span> },
      { key: 'id', header: 'ID', width: 'w-28', cell: (r) => r.id },
      { key: 'plan', header: 'Plan', truncate: true, mobile: 'fact', cell: (r) => r.plan },
    ];
    const { container } = render(<DataTable caption="Customers" noun="customers" rows={rows} columns={columns} rowKey={(r) => r.id} selectable selected={new Set()} onSelectedChange={() => {}} />);
    const cells = [...container.querySelectorAll('tbody tr:first-child td')];
    const byText = (t: string) => cells.find((td) => td.textContent?.includes(t))!;
    expectWrapped(byText('Northwind'), 'Northwind Labs International Holdings');
    expect(byText('Northwind').getAttribute('title')).toBe('Northwind Labs International Holdings');
    expectWrapped(byText('Enterprise'), 'Enterprise');
    expect(classes(byText('cus_8f2a'))).not.toContain('max-w-0');
    const heads = [...container.querySelectorAll('thead th')];
    expect(heads.some((th) => classes(th).includes('w-full'))).toBe(false);
    expect(classes(heads[0])).toContain('w-10');
    expect(heads[0].hasAttribute('data-check')).toBe(true);
    const customer = heads.find((th) => th.textContent?.includes('Customer'))!;
    expect(classes(customer)).toEqual(expect.arrayContaining(['min-w-40']));
    expect(classes(heads.find((th) => th.textContent?.includes('ID'))!)).toContain('w-28');
  });

  it("keeps a fact cell's separator outside the wrapper, and the row link and the phone span inside it", () => {
    const columns: Column<Row>[] = [
      { key: 'name', header: 'Customer', grow: true, truncate: true, mobile: 'title', title: (r) => r.name, cell: (r) => r.name },
      { key: 'plan', header: 'Plan', truncate: true, mobile: 'fact', cell: (r) => r.plan, mobileCell: (r) => `${r.plan} plan` },
      { key: 'region', header: 'Region', truncate: true, mobile: 'fact', cell: (r) => r.region },
    ];
    const { container } = render(<DataTable caption="Customers" noun="customers" rows={rows} columns={columns} rowKey={(r) => r.id} rowHref={(r) => `/customers/${r.id}`} />);
    const [title, plan, region] = [...container.querySelectorAll('tbody tr:first-child td')];
    const titleWrap = expectWrapped(title, 'Northwind Labs International Holdings');
    expect(titleWrap.querySelector('a[href="/customers/cus_8f2a"]')).toBeTruthy();
    expectWrapped(plan, 'Enterprise plan');
    const sep = region.querySelector('[data-sep]')!;
    expect(sep).toBeTruthy();
    expect(sep.parentElement).toBe(region);
    expect(sep.nextElementSibling).toBe(wrapOf(region));
    expectWrapped(region, 'eu-west-1');
  });
});
