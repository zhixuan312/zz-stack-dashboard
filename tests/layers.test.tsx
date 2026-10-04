import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageFrame } from '@/components/base/shell';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';

type Row = { id: string; name: string; calls: number };
const rows: Row[] = [
  { id: 'a', name: 'Northwind Labs', calls: 643_000 },
  { id: 'b', name: 'Halcyon Health', calls: 375_000 },
];
const columns: Column<Row>[] = [
  { key: 'name', header: 'Customer', grow: true, mobile: 'title', cell: (r) => r.name, sortValue: (r) => r.name },
  { key: 'calls', header: 'Requests', numeric: true, width: 'w-28', mobile: 'fact', cell: (r) => r.calls.toLocaleString('en-US'), sortValue: (r) => r.calls },
];

// The setup file stands in for what a Next request provides (the router, the search params, IntersectionObserver), so a
// product's tests can render the layers, not only the leaves.
describe('the layers render in a test', () => {
  it('a page with a filter bar and a data table', () => {
    render(
      <PageFrame title="Customers" description="Who is calling the API.">
        <DataTable caption="Customers" noun="customers" rows={rows} columns={columns} rowKey={(r) => r.id} toolbar={<FilterBar search={{ value: '', onChange: () => {}, placeholder: 'Search customers' }} />} />
      </PageFrame>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Customers' })).toBeInTheDocument();
    expect(screen.getAllByText('Northwind Labs').length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText('Search customers').length).toBeGreaterThan(0);
  });
});
