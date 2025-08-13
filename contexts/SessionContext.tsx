import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import SessionService, { ChatSession } from '../services/SessionService';

interface SessionContextType {
  currentSessionId: string | null;
  sessions: ChatSession[];
  createNewSession: (firstMessage?: string) => Promise<string>;
  switchToSession: (sessionId: string) => Promise<void>;
  updateCurrentSession: (message: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearAllSessions: () => Promise<void>;
  refreshSessions: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const sessions = await SessionService.getAllSessions();
    const currentId = await SessionService.getCurrentSessionId();
    
    setSessions(sessions);
    setCurrentSessionId(currentId);
  };

  const createNewSession = async (firstMessage?: string): Promise<string> => {
    const newSessionId = await SessionService.createNewSession(firstMessage);
    setCurrentSessionId(newSessionId);
    await refreshSessions();
    return newSessionId;
  };

  const switchToSession = async (sessionId: string) => {
    await SessionService.setCurrentSessionId(sessionId);
    setCurrentSessionId(sessionId);
  };

  const updateCurrentSession = async (message: string) => {
    if (currentSessionId) {
      await SessionService.updateSessionWithMessage(currentSessionId, message);
      await refreshSessions();
    }
  };

  const deleteSession = async (sessionId: string) => {
    await SessionService.deleteSession(sessionId);
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
    }
    await refreshSessions();
  };

  const clearAllSessions = async () => {
    await SessionService.clearAllSessions();
    setCurrentSessionId(null);
    setSessions([]);
  };

  const refreshSessions = async () => {
    const updatedSessions = await SessionService.getAllSessions();
    setSessions(updatedSessions);
  };

  const value: SessionContextType = {
    currentSessionId,
    sessions,
    createNewSession,
    switchToSession,
    updateCurrentSession,
    deleteSession,
    clearAllSessions,
    refreshSessions,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};