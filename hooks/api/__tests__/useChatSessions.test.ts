/**
 * Chat with Data session hooks — SWR CRUD over /api/chat-with-data/.
 * Backend responses use the {success, data} envelope; hooks unwrap it.
 */

import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';
import {
  mockApiGet,
  mockApiPost,
  mockApiPut,
  mockApiDelete,
  resetApiMocks,
} from '@/test-utils/api';
import {
  useChatSessions,
  useChatWithDataStatus,
  createChatSession,
  renameChatSession,
  deleteChatSession,
} from '../useChatSessions';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    children
  );

describe('useChatSessions', () => {
  beforeEach(() => resetApiMocks());

  it('lists sessions, unwrapping the response envelope', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: [
        { id: 2, title: 'Water surveys', created_at: 'c2', updated_at: 'u2' },
        { id: 1, title: 'New chat', created_at: 'c1', updated_at: 'u1' },
      ],
    });

    const { result } = renderHook(() => useChatSessions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockApiGet).toHaveBeenCalledWith('/api/chat-with-data/sessions/');
    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.sessions[0].title).toBe('Water surveys');
  });

  it('exposes the availability status with its blocking reason', async () => {
    mockApiGet.mockResolvedValue({
      success: true,
      data: { enabled: false, reason: 'llm_consent_required' },
    });

    const { result } = renderHook(() => useChatWithDataStatus(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockApiGet).toHaveBeenCalledWith('/api/chat-with-data/status');
    expect(result.current.status).toEqual({ enabled: false, reason: 'llm_consent_required' });
  });

  it('create/rename/delete call the right endpoints and unwrap results', async () => {
    mockApiPost.mockResolvedValue({
      success: true,
      data: { id: 7, title: 'New chat', created_at: 'c', updated_at: 'u' },
    });
    const created = await createChatSession();
    expect(mockApiPost).toHaveBeenCalledWith('/api/chat-with-data/sessions/', {});
    expect(created.id).toBe(7);

    mockApiPut.mockResolvedValue({
      success: true,
      data: { id: 7, title: 'Pune surveys', created_at: 'c', updated_at: 'u' },
    });
    const renamed = await renameChatSession(7, 'Pune surveys');
    expect(mockApiPut).toHaveBeenCalledWith('/api/chat-with-data/sessions/7', {
      title: 'Pune surveys',
    });
    expect(renamed.title).toBe('Pune surveys');

    mockApiDelete.mockResolvedValue({ success: true });
    await deleteChatSession(7);
    expect(mockApiDelete).toHaveBeenCalledWith('/api/chat-with-data/sessions/7');
  });
});
