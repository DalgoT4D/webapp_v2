import fs from 'fs';
import path from 'path';

/**
 * Column casting is saved as the connection's post_sync_transform, so the connection events
 * are where "was this connection created with a transform or not" has to be answered.
 *
 * Guards the shape rather than re-running the form: the transform's contents are column names
 * and cast types, i.e. warehouse data. A change that starts sending the transform itself
 * instead of a boolean would be a PII leak, and this fails on it.
 */
const BODY = fs.readFileSync(path.join(__dirname, '..', 'connection-form-body.tsx'), 'utf8');

function eventPayload(eventName: string): string {
  const from = BODY.slice(BODY.indexOf(`ANALYTICS_EVENTS.${eventName}`));
  return from.slice(0, from.indexOf('});'));
}

describe('connection post-sync transform analytics', () => {
  it('reports has_post_sync_transform as a boolean on create and update', () => {
    for (const event of ['CONNECTION_CREATED', 'CONNECTION_UPDATED']) {
      expect(eventPayload(event)).toContain('has_post_sync_transform: postSyncTransform !== null');
    }
  });

  it('never sends the transform itself, only whether there was one', () => {
    for (const event of ['CONNECTION_CREATED', 'CONNECTION_UPDATED']) {
      const payload = eventPayload(event);
      // The ops array carries schema/table/column names and cast types.
      expect(payload).not.toContain('post_sync_transform: postSyncTransform,');
      expect(payload).not.toContain('ops');
      expect(payload).not.toContain('cast_to_type');
    }
  });

  // The event must describe the request that was actually made, so both read one variable
  // rather than each re-deriving the transform and risking a drift between them.
  it('derives the flag from the same value that was sent in the payload', () => {
    expect(BODY).toContain('const postSyncTransform = buildPostSyncTransform();');
    // buildPostSyncTransform is invoked exactly once — at that assignment.
    expect(BODY.match(/buildPostSyncTransform\(\)/g)).toHaveLength(1);
  });

  it('carries connection_id on both events so a connection can be joined across its life', () => {
    for (const event of ['CONNECTION_CREATED', 'CONNECTION_UPDATED']) {
      expect(eventPayload(event)).toContain('connection_id');
    }
  });
});
