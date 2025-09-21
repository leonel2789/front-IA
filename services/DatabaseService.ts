interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  tableName: string;
}

export interface ChatHistoryRecord {
  id?: number;
  session_id: string;
  user_id: string;
  agent_type: string;
  message: string;
  is_user: boolean;
  timestamp: string;
  response?: string;
}

export interface ChatSession {
  session_id: string;
  user_id: string;
  agent_type: string;
  session_name: string;
  created_at: string;
  last_message_at: string;
  message_count: number;
}

export default class DatabaseService {
  // Configuraciones de base de datos por agente
  private static configs: Record<string, DatabaseConfig> = {
    'ia-contratos': {
      host: process.env.EXPO_PUBLIC_CONTRATOS_DB_HOST || 'localhost',
      port: parseInt(process.env.EXPO_PUBLIC_CONTRATOS_DB_PORT || '5432'),
      database: process.env.EXPO_PUBLIC_CONTRATOS_DB_NAME || 'n8n_contratos',
      username: process.env.EXPO_PUBLIC_CONTRATOS_DB_USER || 'n8n',
      password: process.env.EXPO_PUBLIC_CONTRATOS_DB_PASSWORD || 'n8n',
      tableName: process.env.EXPO_PUBLIC_CONTRATOS_DB_TABLE || 'n8n_chat_histories_contratos',
    },
    'ia-laboral': {
      host: process.env.EXPO_PUBLIC_LABORAL_DB_HOST || 'localhost',
      port: parseInt(process.env.EXPO_PUBLIC_LABORAL_DB_PORT || '5432'),
      database: process.env.EXPO_PUBLIC_LABORAL_DB_NAME || 'n8n_laboral',
      username: process.env.EXPO_PUBLIC_LABORAL_DB_USER || 'n8n',
      password: process.env.EXPO_PUBLIC_LABORAL_DB_PASSWORD || 'n8n',
      tableName: process.env.EXPO_PUBLIC_LABORAL_DB_TABLE || 'n8n_chat_histories_laboral',
    },
    'ia-defensa-consumidor': {
      host: process.env.EXPO_PUBLIC_DEFENSA_DB_HOST || 'localhost',
      port: parseInt(process.env.EXPO_PUBLIC_DEFENSA_DB_PORT || '5432'),
      database: process.env.EXPO_PUBLIC_DEFENSA_DB_NAME || 'n8n_defensa',
      username: process.env.EXPO_PUBLIC_DEFENSA_DB_USER || 'n8n',
      password: process.env.EXPO_PUBLIC_DEFENSA_DB_PASSWORD || 'n8n',
      tableName: process.env.EXPO_PUBLIC_DEFENSA_DB_TABLE || 'n8n_chat_histories_defensa',
    },
    'ia-general': {
      host: process.env.EXPO_PUBLIC_GENERAL_DB_HOST || 'localhost',
      port: parseInt(process.env.EXPO_PUBLIC_GENERAL_DB_PORT || '5432'),
      database: process.env.EXPO_PUBLIC_GENERAL_DB_NAME || 'n8n_general',
      username: process.env.EXPO_PUBLIC_GENERAL_DB_USER || 'n8n',
      password: process.env.EXPO_PUBLIC_GENERAL_DB_PASSWORD || 'n8n',
      tableName: process.env.EXPO_PUBLIC_GENERAL_DB_TABLE || 'n8n_chat_histories_general',
    },
  };

  // Obtener configuración para un agente específico
  private static getConfigForAgent(agentType: string): DatabaseConfig {
    const config = this.configs[agentType];
    if (!config) {
      console.warn(`No database config found for agent: ${agentType}, using default`);
      return this.configs['ia-general'];
    }
    return config;
  }

  // Construir URL de API específica por agente
  private static getApiUrl(endpoint: string, agentType: string): string {
    // URLs de API específicas por agente (puedes usar diferentes puertos/hosts)
    const apiUrls: Record<string, string> = {
      'ia-contratos': process.env.EXPO_PUBLIC_CONTRATOS_API_URL || 'http://localhost:3001',
      'ia-laboral': process.env.EXPO_PUBLIC_LABORAL_API_URL || 'http://localhost:3002',
      'ia-defensa-consumidor': process.env.EXPO_PUBLIC_DEFENSA_API_URL || 'http://localhost:3003',
      'ia-general': process.env.EXPO_PUBLIC_GENERAL_API_URL || 'http://localhost:3004',
    };

    const baseUrl = apiUrls[agentType] || apiUrls['ia-general'];
    return `${baseUrl}/api/chat/${endpoint}`;
  }

  // Crear una nueva sesión de chat
  static async createChatSession(
    userId: string,
    agentType: string,
    sessionName: string
  ): Promise<string> {
    try {
      const sessionId = `${userId}_${agentType}_${Date.now()}`;
      const config = this.getConfigForAgent(agentType);
      
      const response = await fetch(this.getApiUrl('sessions', agentType), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: userId,
          agent_type: agentType,
          session_name: sessionName,
          table_name: config.tableName,
          db_config: {
            host: config.host,
            port: config.port,
            database: config.database,
            username: config.username,
            password: config.password,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      return sessionId;
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
  }

  // Obtener sesiones de un usuario por agente (limitado a 30)
  static async getUserSessions(userId: string, agentType: string): Promise<ChatSession[]> {
    try {
      const config = this.getConfigForAgent(agentType);
      
      const response = await fetch(
        this.getApiUrl(`sessions/${userId}/${agentType}?limit=30&table=${config.tableName}`, agentType),
        {
          method: 'POST', // Cambiar a POST para enviar config en body
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            db_config: {
              host: config.host,
              port: config.port,
              database: config.database,
              username: config.username,
              password: config.password,
            },
            table_name: config.tableName,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get sessions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  // Guardar mensaje en el historial
  static async saveMessage(
    sessionId: string,
    userId: string,
    agentType: string,
    message: string,
    isUser: boolean,
    response?: string
  ): Promise<void> {
    try {
      const config = this.getConfigForAgent(agentType);
      
      const response_req = await fetch(this.getApiUrl('messages', agentType), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: userId,
          agent_type: agentType,
          message,
          is_user: isUser,
          response,
          timestamp: new Date().toISOString(),
          table_name: config.tableName,
          db_config: {
            host: config.host,
            port: config.port,
            database: config.database,
            username: config.username,
            password: config.password,
          },
        }),
      });

      if (!response_req.ok) {
        throw new Error(`Failed to save message: ${response_req.status}`);
      }
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  // Obtener mensajes de una sesión
  static async getSessionMessages(sessionId: string, agentType: string): Promise<ChatHistoryRecord[]> {
    try {
      const config = this.getConfigForAgent(agentType);
      
      const response = await fetch(
        this.getApiUrl(`messages/${sessionId}`, agentType),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_name: config.tableName,
            db_config: {
              host: config.host,
              port: config.port,
              database: config.database,
              username: config.username,
              password: config.password,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get messages: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting session messages:', error);
      return [];
    }
  }

  // Eliminar una sesión completa
  static async deleteSession(sessionId: string, agentType: string): Promise<void> {
    try {
      const config = this.getConfigForAgent(agentType);
      
      const response = await fetch(this.getApiUrl(`sessions/${sessionId}`, agentType), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: config.tableName,
          db_config: {
            host: config.host,
            port: config.port,
            database: config.database,
            username: config.username,
            password: config.password,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  // Limpiar sesiones antiguas (mantener solo las 30 más recientes)
  static async cleanupOldSessions(userId: string, agentType: string): Promise<void> {
    try {
      const config = this.getConfigForAgent(agentType);
      
      const response = await fetch(this.getApiUrl('cleanup', agentType), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          agent_type: agentType,
          keep_latest: 30,
          table_name: config.tableName,
          db_config: {
            host: config.host,
            port: config.port,
            database: config.database,
            username: config.username,
            password: config.password,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to cleanup sessions: ${response.status}`);
      }
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
      // No throw - cleanup failure shouldn't break app
    }
  }

  // Actualizar nombre de sesión
  static async updateSessionName(sessionId: string, agentType: string, newName: string): Promise<void> {
    try {
      const config = this.getConfigForAgent(agentType);
      
      const response = await fetch(this.getApiUrl(`sessions/${sessionId}/name`, agentType), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_name: newName,
          table_name: config.tableName,
          db_config: {
            host: config.host,
            port: config.port,
            database: config.database,
            username: config.username,
            password: config.password,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update session name: ${response.status}`);
      }
    } catch (error) {
      console.error('Error updating session name:', error);
      throw error;
    }
  }

  // Verificar conexión a base de datos para un agente específico
  static async testConnection(agentType: string): Promise<boolean> {
    try {
      const config = this.getConfigForAgent(agentType);
      
      const response = await fetch(this.getApiUrl('health', agentType), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          db_config: {
            host: config.host,
            port: config.port,
            database: config.database,
            username: config.username,
            password: config.password,
          },
        }),
      });
      
      return response.ok;
    } catch (error) {
      console.error(`Database connection test failed for ${agentType}:`, error);
      return false;
    }
  }
}