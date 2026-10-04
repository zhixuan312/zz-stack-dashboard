import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';

/** Server actions read a native form: Select and Checkbox must post their values through hidden native controls. */
describe('form posting', () => {
  it('posts a Select and a Checkbox by name inside a form', () => {
    const { container } = render(
      <form>
        <Select name="plan" defaultValue="scale" options={[{ value: 'starter', label: 'Starter' }, { value: 'scale', label: 'Scale' }]} aria-label="Plan" />
        <Checkbox name="notify" defaultChecked label="Notify me" />
      </form>,
    );
    const data = new FormData(container.querySelector('form')!);
    expect(data.get('plan')).toBe('scale');
    expect(data.get('notify')).toBe('on');
  });
});
