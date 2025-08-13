import * as Crypto from 'expo-crypto';
import StorageService from './StorageService';

export interface ChatSession {
  id: string;
  name: string;
  createdAt: Date;
  lastMessage: string;
  messageCount: number;
}

export default class SessionService {
  private static readonly SESSIONS_KEY = 'chat_sessions';
  private static readonly CURRENT_SESSION_KEY = 'current_session_id';

  // Generar un ID único para la sesión
  static async generateSessionId(): Promise<string> {
    const uuid = Crypto.randomUUID();
    return uuid;
  }

  // Obtener la sesión actual
  static async getCurrentSessionId(): Promise<string | null> {
    try {
      return await StorageService.getItem(this.CURRENT_SESSION_KEY);
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  // Establecer la sesión actual
  static async setCurrentSessionId(sessionId: string): Promise<void> {
    try {
      await StorageService.setItem(this.CURRENT_SESSION_KEY, sessionId);
    } catch (error) {
      console.error('Error setting current session:', error);
    }
  }

  // Crear una nueva sesión
  static async createNewSession(firstMessage?: string): Promise<string> {
    const sessionId = await this.generateSessionId();
    const session: ChatSession = {
      id: sessionId,
      name: firstMessage ? this.generateSessionName(firstMessage) : 'Nueva conversación',
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
  static async getAllSessions(): Promise<ChatSession[]> {
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

  // Actualizar sesión con nuevo mensaje
  static async updateSessionWithMessage(sessionId: string, message: string): Promise<void> {
    const sessions = await this.getAllSessions();
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

  // Eliminar una sesión
  static async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
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
  static async clearAllSessions(): Promise<void> {
    try {
      await StorageService.removeItem(this.SESSIONS_KEY);
      await StorageService.removeItem(this.CURRENT_SESSION_KEY);
    } catch (error) {
      console.error('Error clearing sessions:', error);
    }
  }
}