import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import SessionService, { ChatSession, ChatMessage } from '../services/SessionService';
import { useAuth } from './AuthContext';

interface SessionContextType {
  currentSessionId: string | null;
  sessions: ChatSession[];
  currentMessages: ChatMessage[];
  createNewSession: (firstMessage?: string) => Promise<string>;
  switchToSession: (sessionId: string) => Promise<void>;
  updateCurrentSession: (message: string, isUser?: boolean) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearAllSessions: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  loadSessionMessages: (sessionId: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const { user, userRoles } = useAuth();

  useEffect(() => {
    if (user && userRoles.length > 0) {
      loadInitialData();
    }
  }, [user, userRoles]);

  const getCurrentAgentType = (): string => {
    return userRoles[0] || 'ia-general';
  };

  const getUserId = (): string => {
    return user?.preferred_username || user?.sub || 'anonymous';
  };

  const loadInitialData = async () => {
    const userId = getUserId();
    const agentType = getCurrentAgentType();
    
    const sessions = await SessionService.getAllSessions(userId, agentType);
    const currentId = await SessionService.getCurrentSessionId();
    
    setSessions(sessions);
    setCurrentSessionId(currentId);

    // Cargar mensajes de la sesión actual si existe
    if (currentId) {
      await loadSessionMessages(currentId);
    }
  };

  const createNewSession = async (firstMessage?: string): Promise<string> => {
    const userId = getUserId();
    const agentType = getCurrentAgentType();

    // IMPORTANTE: Limpiar sessionId actual antes de crear uno nuevo
    await SessionService.clearCurrentSession();

    // Crear nueva sesión (ahora createOrGetSession no encontrará un sessionId viejo)
    const newSessionId = await SessionService.createNewSession(userId, agentType, firstMessage);
    setCurrentSessionId(newSessionId);
    setCurrentMessages([]); // Limpiar mensajes al crear nueva sesión

    // Refrescar la lista de sesiones para que aparezca la nueva
    await refreshSessions();

    return newSessionId;
  };

  const switchToSession = async (sessionId: string) => {
    await SessionService.setCurrentSessionId(sessionId);
    setCurrentSessionId(sessionId);
    await loadSessionMessages(sessionId);
  };

  const updateCurrentSession = async (message: string, isUser: boolean = true) => {
    const userId = getUserId();
    const agentType = getCurrentAgentType();
    
    if (currentSessionId) {
      await SessionService.updateSessionWithMessage(currentSessionId, userId, agentType, message, isUser);
      await refreshSessions();
      
      // Agregar mensaje a los mensajes actuales
      const newMessage: ChatMessage = {
        id: `${currentSessionId}_${Date.now()}`,
        text: message,
        isUser,
        timestamp: new Date(),
      };
      setCurrentMessages(prev => [...prev, newMessage]);
    }
  };

  const deleteSession = async (sessionId: string) => {
    const userId = getUserId();
    const agentType = getCurrentAgentType();
    
    await SessionService.deleteSession(sessionId, userId, agentType);
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setCurrentMessages([]);
    }
    await refreshSessions();
  };

  const clearAllSessions = async () => {
    const userId = getUserId();
    const agentType = getCurrentAgentType();
    
    await SessionService.clearAllSessions(userId, agentType);
    setCurrentSessionId(null);
    setSessions([]);
    setCurrentMessages([]);
  };

  const refreshSessions = async () => {
    const userId = getUserId();
    const agentType = getCurrentAgentType();
    
    const updatedSessions = await SessionService.getAllSessions(userId, agentType);
    setSessions(updatedSessions);
  };

  const loadSessionMessages = async (sessionId: string) => {
    const agentType = getCurrentAgentType();
    const messages = await SessionService.getSessionMessages(sessionId, agentType);
    setCurrentMessages(messages);
  };

  const value: SessionContextType = {
    currentSessionId,
    sessions,
    currentMessages,
    createNewSession,
    switchToSession,
    updateCurrentSession,
    deleteSession,
    clearAllSessions,
    refreshSessions,
    loadSessionMessages,
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