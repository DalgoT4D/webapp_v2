import { partitionFields } from '../partition-fields';
import type { FieldNode } from '@/components/connectors/types';

function f(key: string, required: boolean): FieldNode {
  return { type: 'basic', path: [key], title: key, required, hidden: false };
}

describe('partitionFields', () => {
  it('puts required fields in primary and the rest in advanced, preserving order', () => {
    const fields = [f('username', true), f('start_time', false), f('exclude_fields', false)];
    const { primary, advanced } = partitionFields(fields);
    expect(primary.map((x) => x.path[0])).toEqual(['username']);
    expect(advanced.map((x) => x.path[0])).toEqual(['start_time', 'exclude_fields']);
  });

  it('pins a non-required key into primary', () => {
    const fields = [f('username', true), f('start_time', false), f('exclude_fields', false)];
    const { primary, advanced } = partitionFields(fields, { pinned: ['start_time'] });
    expect(primary.map((x) => x.path[0])).toEqual(['username', 'start_time']);
    expect(advanced.map((x) => x.path[0])).toEqual(['exclude_fields']);
  });

  it('drops excluded keys entirely', () => {
    const fields = [
      f('spreadsheet_id', true),
      f('credentials', true),
      f('names_conversion', false),
    ];
    const { primary, advanced } = partitionFields(fields, { exclude: ['credentials'] });
    expect(primary.map((x) => x.path[0])).toEqual(['spreadsheet_id']);
    expect(advanced.map((x) => x.path[0])).toEqual(['names_conversion']);
  });

  it('keys off the last path segment for nested fields', () => {
    const nested: FieldNode = {
      type: 'basic',
      path: ['credentials', 'service_account_info'],
      title: 'svc',
      required: false,
      hidden: false,
    };
    const { primary, advanced } = partitionFields([nested], { pinned: ['service_account_info'] });
    expect(primary).toHaveLength(1);
    expect(advanced).toHaveLength(0);
  });
});
