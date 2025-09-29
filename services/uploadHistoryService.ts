import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRole } from '../config';

export interface UploadHistoryItem {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  agentRole: UserRole;
  status: 'success' | 'error' | 'pending';
  errorMessage?: string;
  timestamp: Date;
  uploadDuration?: number; // en milisegundos
  retryCount?: number;
}

export interface UploadSession {
  id: string;
  date: Date;
  agentRole: UserRole;
  totalFiles: number;
  successCount: number;
  errorCount: number;
  items: UploadHistoryItem[];
}

class UploadHistoryService {
  private readonly STORAGE_KEY = 'upload_history';
  private readonly MAX_HISTORY_ITEMS = 100;
  private readonly MAX_SESSIONS = 20;

  async getHistory(): Promise<UploadSession[]> {
    try {
      const historyJson = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!historyJson) return [];

      const sessions = JSON.parse(historyJson);
      // Convertir strings de fecha a Date objects
      return sessions.map((session: any) => ({
        ...session,
        date: new Date(session.date),
        items: session.items.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }))
      }));
    } catch (error) {
      console.error('Error loading upload history:', error);
      return [];
    }
  }

  async saveSession(session: UploadSession): Promise<void> {
    try {
      const history = await this.getHistory();

      // Agregar nueva sesión al principio
      history.unshift(session);

      // Limitar número de sesiones
      if (history.length > this.MAX_SESSIONS) {
        history.splice(this.MAX_SESSIONS);
      }

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving upload session:', error);
    }
  }

  async addItemToCurrentSession(item: UploadHistoryItem, sessionId: string): Promise<void> {
    try {
      const history = await this.getHistory();
      const sessionIndex = history.findIndex(s => s.id === sessionId);

      if (sessionIndex !== -1) {
        history[sessionIndex].items.push(item);

        // Actualizar contadores
        if (item.status === 'success') {
          history[sessionIndex].successCount++;
        } else if (item.status === 'error') {
          history[sessionIndex].errorCount++;
        }

        history[sessionIndex].totalFiles = history[sessionIndex].items.length;

        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
      }
    } catch (error) {
      console.error('Error updating current session:', error);
    }
  }

  async getSessionById(sessionId: string): Promise<UploadSession | null> {
    try {
      const history = await this.getHistory();
      return history.find(s => s.id === sessionId) || null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async getRecentErrors(limit: number = 10): Promise<UploadHistoryItem[]> {
    try {
      const history = await this.getHistory();
      const allErrors: UploadHistoryItem[] = [];

      for (const session of history) {
        const errors = session.items.filter(item => item.status === 'error');
        allErrors.push(...errors);
      }

      // Ordenar por fecha más reciente
      allErrors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return allErrors.slice(0, limit);
    } catch (error) {
      console.error('Error getting recent errors:', error);
      return [];
    }
  }

  async getStatsByAgent(): Promise<Record<UserRole, { total: number; success: number; error: number }>> {
    try {
      const history = await this.getHistory();
      const stats: any = {};

      for (const session of history) {
        if (!stats[session.agentRole]) {
          stats[session.agentRole] = { total: 0, success: 0, error: 0 };
        }

        stats[session.agentRole].total += session.totalFiles;
        stats[session.agentRole].success += session.successCount;
        stats[session.agentRole].error += session.errorCount;
      }

      return stats;
    } catch (error) {
      console.error('Error getting stats by agent:', error);
      return {} as any;
    }
  }

  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing upload history:', error);
    }
  }

  async removeSession(sessionId: string): Promise<void> {
    try {
      const history = await this.getHistory();
      const filtered = history.filter(s => s.id !== sessionId);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing session:', error);
    }
  }

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    const seconds = milliseconds / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)}min`;
  }
}

export const uploadHistoryService = new UploadHistoryService();
export default uploadHistoryService;