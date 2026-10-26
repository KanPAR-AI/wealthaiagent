import { useChatStore } from '../chat';

describe('the pinned agent', () => {
  beforeEach(() => useChatStore.setState({ selectedAgent: null, pinnedAgent: null }));

  it('a default pin fills an empty choice and yields to the user', () => {
    useChatStore.getState().setPinnedAgent({ agent_id: 'gita_ch2_discourse', mode: 'default' });
    expect(useChatStore.getState().selectedAgent).toBe('gita_ch2_discourse');
    useChatStore.getState().setSelectedAgent('knee_arthritis');
    expect(useChatStore.getState().selectedAgent).toBe('knee_arthritis');
    useChatStore.getState().setPinnedAgent({ agent_id: 'gita_ch2_discourse', mode: 'default' });
    expect(useChatStore.getState().selectedAgent).toBe('knee_arthritis');
  });

  it('a locked pin overrides every selection, including smart routing', () => {
    useChatStore.getState().setSelectedAgent('knee_arthritis');
    useChatStore.getState().setPinnedAgent({ agent_id: 'gita_ch2_discourse', mode: 'locked' });
    expect(useChatStore.getState().selectedAgent).toBe('gita_ch2_discourse');
    useChatStore.getState().setSelectedAgent(null);
    expect(useChatStore.getState().selectedAgent).toBe('gita_ch2_discourse');
    useChatStore.getState().setSelectedAgent('knee_arthritis');
    expect(useChatStore.getState().selectedAgent).toBe('gita_ch2_discourse');
  });

  it('an unknown mode reads as default, and a null pin clears', () => {
    useChatStore.getState().setPinnedAgent({ agent_id: 'g', mode: 'sticky' as any });
    expect(useChatStore.getState().pinnedAgent).toEqual({ agent_id: 'g', mode: 'default' });
    useChatStore.getState().setPinnedAgent(null);
    expect(useChatStore.getState().pinnedAgent).toBeNull();
    useChatStore.getState().setPinnedAgent({ agent_id: '', mode: 'locked' } as any);
    expect(useChatStore.getState().pinnedAgent).toBeNull();
  });
});
