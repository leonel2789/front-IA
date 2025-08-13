import { Platform } from 'react-native';

class StorageService {
  private static isWeb = Platform.OS === 'web';
  private static memoryStorage: { [key: string]: string } = {};

  static async getItem(key: string): Promise<string | null> {
    try {
      if (this.isWeb && typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      } else {
        return this.memoryStorage[key] || null;
      }
    } catch (error) {
      console.error('Error getting item from storage:', error);
      return null;
    }
  }

  static async setItem(key: string, value: string): Promise<void> {
    try {
      if (this.isWeb && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      } else {
        this.memoryStorage[key] = value;
      }
    } catch (error) {
      console.error('Error setting item in storage:', error);
    }
  }

  static async removeItem(key: string): Promise<void> {
    try {
      if (this.isWeb && typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      } else {
        delete this.memoryStorage[key];
      }
    } catch (error) {
      console.error('Error removing item from storage:', error);
    }
  }

  static async clear(): Promise<void> {
    try {
      if (this.isWeb && typeof localStorage !== 'undefined') {
        localStorage.clear();
      } else {
        this.memoryStorage = {};
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}

export default StorageService;