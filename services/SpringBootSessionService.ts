import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SpringBootSession {
  sessionId: string;
  userId: string;
  agentType: string;
  sessionName: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  isActive: boolean;
  messages?: SpringBootMessage[];
}

export interface SpringBootMessage {
  id: number;
  sessionId: string;
  content: string;
  isUser: boolean;
  createdAt: Date;
  messageOrder: number;
  agentResponse?: string;
  processingTimeMs?: number;
  errorMessage?: string;
  metadata?: string;
}

export interface CreateSessionRequest {
  agentType: string;
  sessionName?: string;
  firstMessage?: string;
}

export interface AddMessageRequest {
  content: string;
  isUser: boolean;
  agentResponse?: string;
  processingTimeMs?: number;
  errorMessage?: string;
  metadata?: string;
}

export default class SpringBootSessionService {
  private static readonly BASE_URL = process.env.EXPO_PUBLIC_SPRING_BOOT_URL || 'https://ialegalbackend.nilosolutions.com';
  private static readonly CURRENT_SESSION_KEY = 'sb_current_session_id';

  /**
   * Obtener token de autorización desde AsyncStorage
   */
  private static async getAuthToken(): Promise<string> {
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    return token;
  }

  /**
   * Crear headers para requests autenticados
   */
  private static async getAuthHeaders(): Promise<HeadersInit> {
    const token = await this.getAuthToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Manejar respuestas de la API
   */
  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Crear una nueva sesión
   */
  static async createSession(request: CreateSessionRequest): Promise<SpringBootSession> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.BASE_URL}/api/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      const session = await this.handleResponse<SpringBootSession>(response);

      // Guardar como sesión actual
      await this.setCurrentSessionId(session.sessionId);

      return {
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      };
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las sesiones del usuario
   * @param agentType - Tipo de agente (opcional, por defecto 'ia-general')
   */
  static async getUserSessions(agentType?: string): Promise<SpringBootSession[]> {
    try {
      const headers = await this.getAuthHeaders();
      const agent = agentType || 'ia-general';
      const response = await fetch(`${this.BASE_URL}/api/sessions?agentType=${encodeURIComponent(agent)}`, {
        method: 'GET',
        headers,
      });

      const sessions = await this.handleResponse<SpringBootSession[]>(response);
      return sessions.map(session => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      }));
    } catch (error) {
      console.error('Error getting user sessions:', error);
      throw error;
    }
  }

  /**
   * Obtener sesiones por tipo de agente
   */
  static async getUserSessionsByAgent(agentType: string): Promise<SpringBootSession[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.BASE_URL}/api/sessions/agent/${agentType}`, {
        method: 'GET',
        headers,
      });

      const sessions = await this.handleResponse<SpringBootSession[]>(response);
      return sessions.map(session => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      }));
    } catch (error) {
      console.error('Error getting sessions by agent:', error);
      throw error;
    }
  }

  /**
   * Obtener una sesión específica con sus mensajes
   */
  static async getSession(sessionId: string, agentType: string): Promise<SpringBootSession> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.BASE_URL}/api/sessions/${sessionId}?agentType=${encodeURIComponent(agentType)}`, {
        method: 'GET',
        headers,
      });

      const session = await this.handleResponse<SpringBootSession>(response);
      return {
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages?.map(msg => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        })),
      };
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  }

  /**
   * Obtener mensajes de una sesión
   */
  static async getSessionMessages(sessionId: string, agentType: string): Promise<SpringBootMessage[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.BASE_URL}/api/sessions/${sessionId}/messages?agentType=${encodeURIComponent(agentType)}`, {
        method: 'GET',
        headers,
      });

      const messages = await this.handleResponse<SpringBootMessage[]>(response);
      return messages.map(msg => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
      }));
    } catch (error) {
      console.error('Error getting session messages:', error);
      throw error;
    }
  }

  /**
   * Agregar mensaje a una sesión
   */
  static async addMessage(sessionId: string, agentType: string, request: AddMessageRequest): Promise<SpringBootMessage> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.BASE_URL}/api/sessions/${sessionId}/messages?agentType=${encodeURIComponent(agentType)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      const message = await this.handleResponse<SpringBootMessage>(response);
      return {
        ...message,
        createdAt: new Date(message.createdAt),
      };
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  /**
   * Actualizar nombre de sesión
   * NOTA: Esta funcionalidad no está implementada en el backend actual
   */
  static async updateSessionName(sessionId: string, agentType: string, sessionName: string): Promise<SpringBootSession> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.BASE_URL}/api/sessions/${sessionId}/name?agentType=${encodeURIComponent(agentType)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ sessionName }),
      });

      const session = await this.handleResponse<SpringBootSession>(response);
      return {
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      };
    } catch (error) {
      console.error('Error updating session name:', error);
      throw error;
    }
  }

  /**
   * Eliminar una sesión
   * NOTA: Esta funcionalidad no está implementada en el backend actual
   */
  static async deleteSession(sessionId: string, agentType: string): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.BASE_URL}/api/sessions/${sessionId}?agentType=${encodeURIComponent(agentType)}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Si era la sesión actual, limpiarla
      const currentSessionId = await this.getCurrentSessionId();
      if (currentSessionId === sessionId) {
        await AsyncStorage.removeItem(this.CURRENT_SESSION_KEY);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  /**
   * Buscar sesiones por contenido
   */
  static async searchSessions(query: string, agentType: string): Promise<SpringBootSession[]> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.BASE_URL}/api/sessions/search?query=${encodeURIComponent(query)}&agentType=${encodeURIComponent(agentType)}`, {
        method: 'GET',
        headers,
      });

      const sessions = await this.handleResponse<SpringBootSession[]>(response);
      return sessions.map(session => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
      }));
    } catch (error) {
      console.error('Error searching sessions:', error);
      throw error;
    }
  }

  /**
   * Health check del servicio
   */
  static async healthCheck(): Promise<{ status: string; timestamp: number; service: string }> {
    try {
      const response = await fetch(`${this.BASE_URL}/api/sessions/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      return this.handleResponse(response);
    } catch (error) {
      console.error('Error checking health:', error);
      throw error;
    }
  }

  // Métodos de utilidad para sesión actual

  /**
   * Obtener ID de sesión actual
   */
  static async getCurrentSessionId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.CURRENT_SESSION_KEY);
    } catch (error) {
      console.error('Error getting current session ID:', error);
      return null;
    }
  }

  /**
   * Establecer sesión actual
   */
  static async setCurrentSessionId(sessionId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.CURRENT_SESSION_KEY, sessionId);
    } catch (error) {
      console.error('Error setting current session ID:', error);
    }
  }

  /**
   * Limpiar sesión actual
   */
  static async clearCurrentSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CURRENT_SESSION_KEY);
    } catch (error) {
      console.error('Error clearing current session:', error);
    }
  }

  // Métodos de conversión para compatibilidad con la implementación actual

  /**
   * Convertir sesión de Spring Boot a formato local
   */
  static convertToLocalSession(session: SpringBootSession) {
    return {
      id: session.sessionId,
      name: session.sessionName,
      createdAt: session.createdAt,
      lastMessage: session.messages?.[session.messages.length - 1]?.content || '',
      messageCount: session.messageCount,
    };
  }

  /**
   * Convertir mensaje de Spring Boot a formato local
   */
  static convertToLocalMessage(message: SpringBootMessage) {
    return {
      id: message.id.toString(),
      text: message.content,
      isUser: message.isUser,
      timestamp: message.createdAt,
    };
  }
}