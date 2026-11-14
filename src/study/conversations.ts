import type { ConversationStore, LearningArchive, LearningConversation } from '../shared/types';
import { emptyArchive, validateArchive } from './history';

export const emptyConversations = (): ConversationStore => ({ conversations: [], activeId: null });

export function conversationTitle(message: string): string {
  const short = message.replace(/\s+/g, ' ').trim().slice(0, 64);
  return short || 'New conversation';
}

export function newConversation(store: ConversationStore): ConversationStore {
  const now = new Date().toISOString();
  const conversation: LearningConversation = {
    id: crypto.randomUUID(), title: 'New conversation', createdAt: now, updatedAt: now, archive: emptyArchive()
  };
  return { conversations: [conversation, ...store.conversations], activeId: conversation.id };
}

export function selectConversation(store: ConversationStore, id: string): ConversationStore {
  return store.conversations.some(item => item.id === id) ? { ...store, activeId: id } : store;
}

export function changeConversationArchive(store: ConversationStore, update: (archive: LearningArchive) => LearningArchive): ConversationStore {
  return { ...store, conversations: store.conversations.map(conversation =>
    conversation.id === store.activeId ? { ...conversation, archive: update(conversation.archive), updatedAt: new Date().toISOString() } : conversation) };
}

export function titleConversationIfNew(store: ConversationStore, prompt: string): ConversationStore {
  return { ...store, conversations: store.conversations.map(item =>
    item.id === store.activeId && item.title === 'New conversation'
      ? { ...item, title: conversationTitle(prompt), updatedAt: new Date().toISOString() }
      : item) };
}

export function renameConversation(store: ConversationStore, id: string, title: string): ConversationStore {
  const name = conversationTitle(title);
  return { ...store, conversations: store.conversations.map(item =>
    item.id === id ? { ...item, title: name, updatedAt: new Date().toISOString() } : item) };
}

export function deleteConversation(store: ConversationStore, id: string): ConversationStore {
  const conversations = store.conversations.filter(item => item.id !== id);
  return {
    conversations,
    activeId: store.activeId === id ? (conversations[0]?.id ?? null) : store.activeId
  };
}

export function migrateLegacyArchive(raw: unknown): ConversationStore {
  const archive = validateArchive(raw);
  if (!archive.entries.length && !archive.messages.length) return emptyConversations();
  const now = new Date().toISOString();
  const title = archive.messages.find(m => m.role === 'user')?.content
    ?? archive.entries[0]?.session.goal ?? 'Imported learning history';
  const conversation: LearningConversation = {
    id: crypto.randomUUID(), title: conversationTitle(title), createdAt: now, updatedAt: now, archive
  };
  return { conversations: [conversation], activeId: conversation.id };
}

export function validateConversationStore(value: unknown): ConversationStore {
  if (!value || typeof value !== 'object') throw new Error('Invalid conversations.');
  const store = value as Partial<ConversationStore>;
  if (!Array.isArray(store.conversations) || store.conversations.length > 2000 ||
      !(store.activeId === null || typeof store.activeId === 'string')) throw new Error('Invalid conversation index.');
  const ids = new Set<string>();
  for (const item of store.conversations) {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id) ||
        typeof item.title !== 'string' || !item.title.trim() || item.title.length > 100 ||
        typeof item.createdAt !== 'string' || item.createdAt.length > 64 ||
        typeof item.updatedAt !== 'string' || item.updatedAt.length > 64) throw new Error('Invalid conversation metadata.');
    ids.add(item.id);
    validateArchive(item.archive);
  }
  if (store.activeId !== null && !ids.has(store.activeId)) throw new Error('Unknown active conversation.');
  if (!store.conversations.length && store.activeId !== null) throw new Error('Invalid empty conversation list.');
  return store as ConversationStore;
}
