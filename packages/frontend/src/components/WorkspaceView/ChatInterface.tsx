/**
 * Chat Interface - Chat with agent
 */
import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { Send } from 'lucide-react';
import { api } from '../../lib/api';
import { useWebSocket } from '../../contexts/WebSocketContext';
import type { Session, Message } from '@parawork/shared';

interface ChatInterfaceProps {
  session: Session | null;
  messages: Message[];
  onMessagesUpdate: Dispatch<SetStateAction<Message[]>>;
}

export function ChatInterface({ session, messages, onMessagesUpdate }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    if (!session?.id) {
      onMessagesUpdate([]);
      return;
    }

    // Load messages for this session
    const sessionId = session.id;
    api.sessions.getMessages(sessionId)
      .then((msgs) => onMessagesUpdate(msgs))
      .catch(console.error);
  }, [session?.id, onMessagesUpdate]);

  // Subscribe to real-time message events via WebSocket
  useEffect(() => {
    if (!session?.id) return;

    const sessionId = session.id;
    return subscribe((event) => {
      if (event.type === 'agent_message' && event.data.sessionId === sessionId) {
        const newMessage: Message = {
          id: `${Date.now()}`, // Temporary ID
          sessionId: event.data.sessionId,
          role: event.data.role,
          content: event.data.content,
          timestamp: event.data.timestamp,
        };
        onMessagesUpdate((prevMessages) => [...prevMessages, newMessage]);
      }
    });
  }, [session?.id, subscribe, onMessagesUpdate]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !session || sending) return;

    setSending(true);
    try {
      const message = await api.sessions.sendMessage(session.id, {
        content: input.trim(),
      });
      onMessagesUpdate([...messages, message]);
      setInput('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            <p>No messages yet</p>
            <p className="text-sm mt-2">
              {session ? 'Start chatting with the agent' : 'Start a session to begin'}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={session ? 'Type a message...' : 'Start a session to chat'}
            disabled={!session || sending}
            className="flex-1 px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !session || sending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
