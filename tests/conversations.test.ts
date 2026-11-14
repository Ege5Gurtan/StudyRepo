import { describe, expect, it } from 'vitest';
import { addChallenge, emptyArchive } from '../src/study/history';
import { changeConversationArchive, conversationTitle, deleteConversation, emptyConversations, migrateLegacyArchive, newConversation, renameConversation, selectConversation, titleConversationIfNew, updateConversationById, validateConversationStore } from '../src/study/conversations';
import type { LearningSession } from '../src/shared/types';

const lesson: LearningSession = {
  goal: 'Learn arrays', topics: [{ id: 'arrays', title: 'Arrays', objective: 'Iterate arrays' }],
  topicIndex: 0, sourceContext: 'const a = [];',
  lesson: { introduction: 'Intro', explanation: 'Explain', references: [],
    challenge: { title: 'Filter values', description: 'Filter a list', language: 'javascript', starterCode: 'const a = [];', criteria: ['Return array'] } }
};

describe('repository-scoped conversations', () => {
  it('creates independent conversations with distinct histories, updates only selected chat and restores it', () => {
    let store = newConversation(emptyConversations());
    const first = store.activeId!;
    store = titleConversationIfNew(store, 'Teach me JavaScript arrays');
    store = changeConversationArchive(store, a => addChallenge(a, lesson));
    store = newConversation(store);
    const second = store.activeId!;
    expect(second).not.toBe(first);
    store = changeConversationArchive(store, a => ({ ...a, messages: [{ role: 'user', content: 'New topic' }] }));
    expect(store.conversations.find(c => c.id === second)?.archive.entries).toHaveLength(0);
    store = selectConversation(store, first);
    expect(store.conversations.find(c => c.id === first)?.archive.entries[0].session.lesson.challenge.title).toBe('Filter values');
    store = updateConversationById(store, second, a => ({ ...a, messages: [...a.messages, { role: 'assistant', content: 'Reply' }] }));
    expect(store.conversations.find(c => c.id === first)?.archive.messages).toEqual([]);
    expect(store.conversations.find(c => c.id === second)?.archive.messages).toHaveLength(2);
    expect(validateConversationStore(store)).toEqual(store);
  });

  it('preserves original challenge history when migrating pre-conversation archive', () => {
    const old = { ...addChallenge(emptyArchive(), lesson), messages: [{ role: 'user' as const, content: 'Learn arrays' }] };
    const store = migrateLegacyArchive(old);
    expect(store.conversations).toHaveLength(1);
    expect(store.conversations[0].archive).toEqual(old);
    expect(store.conversations[0].title).toBe('Learn arrays');
  });

  it('renames, deletes and validates conversations without mixing archives', () => {
    let store = newConversation(newConversation(emptyConversations()));
    const first = store.activeId!;
    store = renameConversation(store, first, 'My exercises');
    expect(store.conversations.find(c => c.id === first)?.title).toBe('My exercises');
    store = deleteConversation(store, first);
    expect(store.conversations).toHaveLength(1);
    expect(store.activeId).toBe(store.conversations[0].id);
    expect(conversationTitle('  hello   world  ')).toBe('hello world');
    expect(() => validateConversationStore({ ...store, activeId: 'not-found' })).toThrow();
    expect(() => validateConversationStore({ ...store, conversations: [...store.conversations, store.conversations[0]] })).toThrow();
  });
});
