/**
 * Design-system barrel. Screens import primitives from `@/components/ui`:
 *   import { Button, Card, Field, Input, Badge } from '@/components/ui';
 *
 * DELIBERATE: two modules are not re-exported here and are imported by path, so that each
 * has one valid import path:
 *   - `./toast`     — a module-level store plus the `Toaster` mount, not a primitive
 *                     you compose into a screen (`@/components/ui/toast`).
 *   - `./nav-tabs`  — the page sub-nav, whose callers are themselves components
 *                     rather than screens (`@/components/ui/nav-tabs`).
 */

// Foundation
export * from './typography';
export * from './button';
export * from './card';

// Forms
export * from './field';
export * from './field-styles';
export * from './input';
export * from './textarea';
export * from './select';
export * from './segmented';
export * from './switch';

// Display & status
export * from './table';
export * from './pagination';
export * from './badge';
export * from './banner';
export * from './empty-state';
export * from './freshness';
export * from './skeleton';
export * from './metric-card';
export * from './spinner';
export * from './popover';
export * from './tooltip';

// Overlays & navigation
export * from './breadcrumb';

// Layout
export * from './field-grid';
export * from './search-input';
export * from './tab-bar';
export * from './toolbar';
export * from './layout';
export * from './shell';
export * from './time';
