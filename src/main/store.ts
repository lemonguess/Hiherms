import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export interface Conversation {
  id: string
  title: string
  createdAt: number
}

export interface StoredMessage {
  id: number
  conversationId: string
  role: 'user' | 'hermes'
  text: string
  createdAt: number
}

interface StoreData {
  conversations: Conversation[]
  messages: StoredMessage[]
}

export class ConversationStore {
  private path: string
  private data: StoreData

  constructor(userDataPath: string) {
    const dir = join(userDataPath, 'hermespet')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.path = join(dir, 'conversations.json')
    this.data = existsSync(this.path)
      ? JSON.parse(readFileSync(this.path, 'utf-8'))
      : { conversations: [], messages: [] }
    // Migrate old files without messages array
    if (!this.data.messages) this.data.messages = []
  }

  private save(): void {
    writeFileSync(this.path, JSON.stringify(this.data, null, 2))
  }

  list(): Conversation[] {
    return [...this.data.conversations].sort((a, b) => b.createdAt - a.createdAt)
  }

  create(title: string): Conversation {
    const conv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      createdAt: Date.now(),
    }
    this.data.conversations.push(conv)
    this.save()
    return conv
  }

  rename(id: string, title: string): boolean {
    const conv = this.data.conversations.find(c => c.id === id)
    if (!conv) return false
    conv.title = title
    this.save()
    return true
  }

  remove(id: string): boolean {
    const idx = this.data.conversations.findIndex(c => c.id === id)
    if (idx < 0) return false
    this.data.conversations.splice(idx, 1)
    // Also remove all messages for this conversation
    this.data.messages = this.data.messages.filter(m => m.conversationId !== id)
    this.save()
    return true
  }

  getMessages(conversationId: string, before?: number, limit = 10): StoredMessage[] {
    const msgs = this.data.messages
      .filter(m => m.conversationId === conversationId && (before == null || m.createdAt < before))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
    return msgs.reverse() // Return in chronological order
  }

  addMessage(conversationId: string, role: 'user' | 'hermes', text: string): StoredMessage {
    const msg: StoredMessage = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      conversationId,
      role,
      text,
      createdAt: Date.now(),
    }
    this.data.messages.push(msg)
    this.save()
    return msg
  }
}
