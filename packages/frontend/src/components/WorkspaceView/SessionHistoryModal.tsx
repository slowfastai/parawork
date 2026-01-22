/**
 * Session History Modal - Browse and resume completed sessions
 */
import { useState, useEffect } from 'react';
import { X, Clock, MessageCircle, Play, Search } from 'lucide-react';
import { api } from '../../lib/api';
import type { SessionHistoryItem, ConversationEvent } from '@parawork/shared';
import { ConversationTimeline } from './ConversationTimeline';

interface SessionHistoryModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSessionResume: (sessionId: string) => void;
}

export function SessionHistoryModal({ 
  workspaceId, 
  isOpen, 
  onClose, 
  onSessionResume 
}: SessionHistoryModalProps) {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionHistoryItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionHistoryItem | null>(null);
  const [conversation, setConversation] = useState<ConversationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen && workspaceId) {
      loadSessions();
    }
  }, [isOpen, workspaceId]);

  useEffect(() => {
    // Filter sessions based on search term
    if (searchTerm.trim() === '') {
      setFilteredSessions(sessions);
    } else {
      const filtered = sessions.filter(session => 
        session.agentType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (session.lastMessage && session.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredSessions(filtered);
    }
  }, [sessions, searchTerm]);

  const loadSessions = async () => {
    try {
      const response = await api.sessions.getHistory(workspaceId);
      setSessions(response);
      setFilteredSessions(response);
    } catch (error) {
      console.error('Error loading session history:', error);
    }
  };

  const loadConversation = async (sessionId: string) => {
    setLoading(true);
    try {
      const response = await api.sessions.getFullConversation(sessionId);
      setConversation(response);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionSelect = (session: SessionHistoryItem) => {
    setSelectedSession(session);
    loadConversation(session.id);
  };

  const handleResume = () => {
    if (selectedSession) {
      onSessionResume(selectedSession.id);
      onClose();
    }
  };

  const formatDuration = (duration: number) => {
    const minutes = Math.round(duration / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-6xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Session History</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Session List */}
          <div className="w-96 border-r overflow-hidden flex flex-col">
            {/* Search Bar */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            
            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="font-medium mb-3">Completed Sessions</h3>
              {filteredSessions.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {searchTerm ? 'No sessions found matching search' : 'No completed sessions found'}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedSession?.id === session.id 
                          ? 'bg-primary/10 border-primary' 
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleSessionSelect(session)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm capitalize">{session.agentType}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          session.status === 'completed' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                        }`}>
                          {session.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(session.startedAt!).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {session.messageCount} messages
                        </div>
                        {session.duration > 0 && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(session.duration)}
                          </div>
                        )}
                      </div>
                      {session.lastMessage && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {session.lastMessage}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Conversation Preview */}
          <div className="flex-1 flex flex-col">
            {selectedSession ? (
              <>
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium capitalize">
                        {selectedSession.agentType} Session
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(selectedSession.startedAt!).toLocaleString()} • 
                        {selectedSession.messageCount} messages • 
                        {selectedSession.duration > 0 ? formatDuration(selectedSession.duration) : 'No duration'}
                      </p>
                    </div>
                    <button
                      onClick={handleResume}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      Resume Session
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                        <p>Loading conversation...</p>
                      </div>
                    </div>
                  ) : (
                    <ConversationTimeline events={conversation} />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a session to view conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}