import fs from 'fs';
import path from 'path';

/**
 * Column casting is offered only for cast-supported sources, so "does anyone actually cast
 * anything" is the adoption question for the feature — and the answer has to ride on the
 * connection events, since casting is saved as part of the connection's post_sync_transform.
 *
 * Guards the shape rather than re-running the form: the cast values are column names and
 * types, i.e. warehouse data, so the event must carry counts only. A future change that
 * starts sending the cast map itself would be a PII leak, and this fails on it.
 */
const BODY = fs.readFileSync(path.join(__dirname, '..', 'connection-form-body.tsx'), 'utf8');

describe('connection casting analytics', () => {
  it('sends the cast summary on both create and update', () => {
    const createBlock = BODY.slice(BODY.indexOf('ANALYTICS_EVENTS.CONNECTION_CREATED'));
    const updateBlock = BODY.slice(BODY.indexOf('ANALYTICS_EVENTS.CONNECTION_UPDATED'));

    expect(createBlock.slice(0, createBlock.indexOf('});'))).toContain('castSummary()');
    expect(updateBlock.slice(0, updateBlock.indexOf('});'))).toContain('castSummary()');
  });

  it('summarises casting as counts, never as column names or cast types', () => {
    const summary = BODY.slice(BODY.indexOf('const castSummary'), BODY.indexOf('const handleSave'));

    expect(summary).toContain('casting_used');
    expect(summary).toContain('cast_column_count');
    // The per-column cast map (name -> type) must not be assembled into the event payload.
    expect(summary).not.toContain('config[c.name]');
    expect(summary).not.toContain('cast_to_type:');
  });

  it('carries connection_id on both events so a connection can be joined across its life', () => {
    const createBlock = BODY.slice(BODY.indexOf('ANALYTICS_EVENTS.CONNECTION_CREATED'));
    const updateBlock = BODY.slice(BODY.indexOf('ANALYTICS_EVENTS.CONNECTION_UPDATED'));

    expect(createBlock.slice(0, createBlock.indexOf('});'))).toContain('connection_id');
    expect(updateBlock.slice(0, updateBlock.indexOf('});'))).toContain('connection_id');
  });
});
