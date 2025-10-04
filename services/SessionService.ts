import * as Crypto from 'expo-crypto';
import StorageService from './StorageService';
import DatabaseService, { ChatSession as DBChatSession, ChatHistoryRecord } from './DatabaseService';
import SpringBootSessionService from './SpringBootSessionService';

export interface ChatSession {
  id: string;
  name: string;
  createdAt: Date;
  lastMessage: string;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default class SessionService {
  private static readonly SESSIONS_KEY = 'chat_sessions';
  private static readonly CURRENT_SESSION_KEY = 'current_session_id';
  private static readonly USE_DATABASE = process.env.EXPO_PUBLIC_USE_DATABASE === 'true';
  private static readonly USE_SPRING_BOOT = process.env.EXPO_PUBLIC_USE_SPRING_BOOT === 'true';

  // Generar un ID único para la sesión
  static async generateSessionId(userId: string, agentType: string): Promise<string> {
    return `${userId}_${agentType}_${Date.now()}_${Crypto.randomUUID().slice(0, 8)}`;
  }

  // Obtener la sesión actual
  static async getCurrentSessionId(): Promise<string | null> {
    try {
      if (this.USE_SPRING_BOOT) {
        return await SpringBootSessionService.getCurrentSessionId();
      }
      return await StorageService.getItem(this.CURRENT_SESSION_KEY);
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  // Establecer la sesión actual
  static async setCurrentSessionId(sessionId: string): Promise<void> {
    try {
      if (this.USE_SPRING_BOOT) {
        await SpringBootSessionService.setCurrentSessionId(sessionId);
        return;
      }
      await StorageService.setItem(this.CURRENT_SESSION_KEY, sessionId);
    } catch (error) {
      console.error('Error setting current session:', error);
    }
  }

  // Crear una nueva sesión
  static async createNewSession(
    userId: string,
    agentType: string,
    firstMessage?: string
  ): Promise<string> {
    // Si estamos usando Spring Boot, usar su servicio
    if (this.USE_SPRING_BOOT) {
      try {
        const session = await SpringBootSessionService.createSession({
          agentType,
          sessionName: firstMessage ? this.generateSessionName(firstMessage) : undefined,
          firstMessage,
        });
        return session.sessionId;
      } catch (error) {
        console.error('Error creating session in Spring Boot:', error);
        // Fallback a la implementación actual
      }
    }

    const sessionId = await this.generateSessionId(userId, agentType);
    const sessionName = firstMessage ? this.generateSessionName(firstMessage) : 'Nueva conversación';

    if (this.USE_DATABASE) {
      // Crear sesión en PostgreSQL
      try {
        await DatabaseService.createChatSession(userId, agentType, sessionName);
        await this.setCurrentSessionId(sessionId);
        
        // Limpiar sesiones antiguas (mantener solo 30)
        await DatabaseService.cleanupOldSessions(userId, agentType);
        
        return sessionId;
      } catch (error) {
        console.error('Error creating session in database:', error);
        // Fallback to local storage
      }
    }

    // Fallback: usar almacenamiento local
    const session: ChatSession = {
      id: sessionId,
      name: sessionName,
      createdAt: new Date(),
      lastMessage: firstMessage || '',
      messageCount: firstMessage ? 1 : 0,
    };

    await this.saveSession(session);
    await this.setCurrentSessionId(sessionId);
    return sessionId;
  }

  // Generar nombre de sesión basado en el primer mensaje
  static generateSessionName(message: string): string {
    const words = message.trim().split(' ').slice(0, 4);
    return words.join(' ') + (message.length > 30 ? '...' : '');
  }

  // Guardar una sesión
  static async saveSession(session: ChatSession): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.unshift(session);
      }

      await StorageService.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  // Obtener todas las sesiones
  static async getAllSessions(userId: string, agentType: string): Promise<ChatSession[]> {
    // Si estamos usando Spring Boot, usar su servicio
    if (this.USE_SPRING_BOOT) {
      try {
        const springBootSessions = await SpringBootSessionService.getUserSessionsByAgent(agentType);
        return springBootSessions.map(SpringBootSessionService.convertToLocalSession);
      } catch (error) {
        console.error('Error getting sessions from Spring Boot:', error);
        // Fallback a la implementación actual
      }
    }

    if (this.USE_DATABASE) {
      try {
        const dbSessions = await DatabaseService.getUserSessions(userId, agentType);
        return dbSessions.map(this.convertDBSessionToLocal);
      } catch (error) {
        console.error('Error getting sessions from database:', error);
        // Fallback to local storage
      }
    }

    // Fallback: almacenamiento local
    try {
      const stored = await StorageService.getItem(this.SESSIONS_KEY);
      if (!stored) return [];
      
      const sessions = JSON.parse(stored);
      return sessions.map((s: any) => ({
        ...s,
        createdAt: new Date(s.createdAt)
      }));
    } catch (error) {
      console.error('Error getting sessions:', error);
      return [];
    }
  }

  // Convertir sesión de base de datos a formato local
  private static convertDBSessionToLocal(dbSession: DBChatSession): ChatSession {
    return {
      id: dbSession.session_id,
      name: dbSession.session_name,
      createdAt: new Date(dbSession.created_at),
      lastMessage: '', // Se cargará cuando se seleccione la sesión
      messageCount: dbSession.message_count,
    };
  }

  // Actualizar sesión con nuevo mensaje
  static async updateSessionWithMessage(
    sessionId: string,
    userId: string,
    agentType: string,
    message: string,
    isUser: boolean = true
  ): Promise<void> {
    // Si estamos usando Spring Boot, usar su servicio
    if (this.USE_SPRING_BOOT) {
      try {
        await SpringBootSessionService.addMessage(sessionId, agentType, {
          content: message,
          isUser,
        });
        return;
      } catch (error) {
        console.error('Error updating session in Spring Boot:', error);
        // Fallback a la implementación actual
      }
    }

    if (this.USE_DATABASE) {
      try {
        await DatabaseService.saveMessage(sessionId, userId, agentType, message, isUser);
        return;
      } catch (error) {
        console.error('Error updating session in database:', error);
        // Fallback to local storage
      }
    }

    // Fallback: almacenamiento local
    const sessions = await this.getAllSessions(userId, agentType);
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex >= 0) {
      sessions[sessionIndex].lastMessage = message;
      sessions[sessionIndex].messageCount += 1;
      
      if (sessions[sessionIndex].messageCount === 1) {
        sessions[sessionIndex].name = this.generateSessionName(message);
      }
      
      await StorageService.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
    }
  }

  // Obtener mensajes de una sesión
  static async getSessionMessages(sessionId: string, agentType: string): Promise<ChatMessage[]> {
    // Si estamos usando Spring Boot, usar su servicio
    if (this.USE_SPRING_BOOT) {
      try {
        const springBootMessages = await SpringBootSessionService.getSessionMessages(sessionId, agentType);
        return springBootMessages.map(SpringBootSessionService.convertToLocalMessage);
      } catch (error) {
        console.error('Error getting session messages from Spring Boot:', error);
        // Fallback a la implementación actual
      }
    }

    if (this.USE_DATABASE) {
      try {
        const dbMessages = await DatabaseService.getSessionMessages(sessionId, agentType);
        return dbMessages.map(this.convertDBMessageToLocal);
      } catch (error) {
        console.error('Error getting session messages from database:', error);
      }
    }

    // Para almacenamiento local, no tenemos mensajes individuales guardados
    // Esto requeriría una implementación más compleja
    return [];
  }

  // Convertir mensaje de base de datos a formato local
  private static convertDBMessageToLocal(dbMessage: ChatHistoryRecord): ChatMessage {
    return {
      id: `${dbMessage.session_id}_${dbMessage.timestamp}`,
      text: dbMessage.message,
      isUser: dbMessage.is_user,
      timestamp: new Date(dbMessage.timestamp),
    };
  }

  // Eliminar una sesión
  static async deleteSession(sessionId: string, userId: string, agentType: string): Promise<void> {
    if (this.USE_DATABASE) {
      try {
        await DatabaseService.deleteSession(sessionId, agentType);
        
        const currentId = await this.getCurrentSessionId();
        if (currentId === sessionId) {
          await StorageService.removeItem(this.CURRENT_SESSION_KEY);
        }
        return;
      } catch (error) {
        console.error('Error deleting session from database:', error);
        // Fallback to local storage
      }
    }

    // Fallback: almacenamiento local
    try {
      const sessions = await this.getAllSessions(userId, agentType);
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      await StorageService.setItem(this.SESSIONS_KEY, JSON.stringify(filteredSessions));
      
      const currentId = await this.getCurrentSessionId();
      if (currentId === sessionId) {
        await StorageService.removeItem(this.CURRENT_SESSION_KEY);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  // Limpiar todas las sesiones
  static async clearAllSessions(userId: string, agentType: string): Promise<void> {
    if (this.USE_DATABASE) {
      try {
        await DatabaseService.cleanupOldSessions(userId, agentType);
      } catch (error) {
        console.error('Error clearing sessions from database:', error);
      }
    }

    // Fallback: almacenamiento local
    try {
      await StorageService.removeItem(this.SESSIONS_KEY);
      await StorageService.removeItem(this.CURRENT_SESSION_KEY);
    } catch (error) {
      console.error('Error clearing sessions:', error);
    }
  }
}