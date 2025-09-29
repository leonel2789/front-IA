import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GOOGLE_DRIVE_CONFIG, GOOGLE_DRIVE_FOLDERS, AGENT_SUBFOLDER_NAMES, UserRole } from '../config';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

interface DriveFile {
  id?: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

interface UploadFileParams {
  fileUri: string;
  fileName: string;
  mimeType: string;
  agentRole: UserRole;
}

class GoogleDriveService {
  private accessToken: string | null = null;

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      const accessToken = await AsyncStorage.getItem('google_drive_token');
      if (accessToken) {
        this.accessToken = accessToken;
      }
    } catch (error) {
      console.error('Error initializing Google Drive auth:', error);
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      // Configuración del discovery document para Google
      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
      };

      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_DRIVE_CONFIG.clientId!,
        scopes: GOOGLE_DRIVE_CONFIG.scopes,
        responseType: AuthSession.ResponseType.Code,
        redirectUri: AuthSession.makeRedirectUri({ 
          scheme: 'iafrontend',
          preferLocalhost: process.env.NODE_ENV === 'development'
        }),
        codeChallenge: null, // Esto forzará a Expo a generar PKCE automáticamente
        codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
        extraParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      });

      const result = await request.promptAsync(discovery);
      
      if (result.type === 'success' && result.params.code) {
        // Preparar los parámetros del token con PKCE
        const tokenParams: any = {
          client_id: GOOGLE_DRIVE_CONFIG.clientId!,
          code: result.params.code,
          grant_type: 'authorization_code',
          redirect_uri: request.redirectUri!,
        };

        // Agregar client_secret solo si está disponible (para web clients)
        if (GOOGLE_DRIVE_CONFIG.clientSecret) {
          tokenParams.client_secret = GOOGLE_DRIVE_CONFIG.clientSecret;
        }

        // Agregar code_verifier para PKCE
        if (request.codeVerifier) {
          tokenParams.code_verifier = request.codeVerifier;
        }

        const tokenResponse = await fetch(discovery.tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(tokenParams).toString(),
        });

        const tokens = await tokenResponse.json();
        
        if (tokens.access_token) {
          await AsyncStorage.setItem('google_drive_token', tokens.access_token);
          if (tokens.refresh_token) {
            await AsyncStorage.setItem('google_drive_refresh_token', tokens.refresh_token);
          }
          
          this.accessToken = tokens.access_token;
          return true;
        } else {
          console.error('No access token received:', tokens);
        }
      } else {
        console.error('Authentication failed or cancelled:', result);
      }
      
      return false;
    } catch (error) {
      console.error('Google Drive authentication error:', error);
      return false;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem('google_drive_token');
    return !!token && !!this.accessToken;
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await AsyncStorage.getItem('google_drive_refresh_token');
      if (!refreshToken) return false;

      const tokenParams: any = {
        client_id: GOOGLE_DRIVE_CONFIG.clientId!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      };

      // Solo agregar client_secret si está disponible
      if (GOOGLE_DRIVE_CONFIG.clientSecret) {
        tokenParams.client_secret = GOOGLE_DRIVE_CONFIG.clientSecret;
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenParams).toString(),
      });

      const tokens = await response.json();
      
      if (tokens.access_token) {
        await AsyncStorage.setItem('google_drive_token', tokens.access_token);
        this.accessToken = tokens.access_token;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing Google Drive token:', error);
      return false;
    }
  }

  private async findOrCreateFolder(parentId: string, folderName: string, retryCount = 0): Promise<string | null> {
    if (!this.accessToken) {
      throw new Error('Google Drive not authenticated');
    }

    // Límite de reintentos para evitar recursión infinita
    if (retryCount > 3) {
      throw new Error('Max retry attempts reached for folder creation');
    }

    try {
      // First, try to find existing folder
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${folderName}' and parents in '${parentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name)`;

      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.status === 401) {
        // Token expired, try to refresh
        const refreshSuccess = await this.refreshToken();
        if (refreshSuccess) {
          // Retry with new token (con contador de reintentos)
          return this.findOrCreateFolder(parentId, folderName, retryCount + 1);
        } else {
          throw new Error('Authentication failed - please log in again');
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }

      // If not found, create new folder
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        }),
      });

      if (createResponse.status === 401) {
        // Token expired, try to refresh
        const refreshSuccess = await this.refreshToken();
        if (refreshSuccess) {
          // Retry with new token (con contador de reintentos)
          return this.findOrCreateFolder(parentId, folderName, retryCount + 1);
        } else {
          throw new Error('Authentication failed - please log in again');
        }
      }

      if (!createResponse.ok) {
        throw new Error(`HTTP error! status: ${createResponse.status}`);
      }

      const createData = await createResponse.json();
      return createData.id;
    } catch (error: any) {
      console.error(`Error finding/creating folder ${folderName}:`, error);
      throw error; // Re-throw to handle it in the calling method
    }
  }

  private async getTargetFolderId(agentRole: UserRole): Promise<string | null> {
    try {
      // Get the configured folder ID for this specific agent
      const configuredFolderId = GOOGLE_DRIVE_FOLDERS[agentRole];

      // Verificar si todos los IDs son iguales (no configurados)
      const allFolderIds = Object.values(GOOGLE_DRIVE_FOLDERS);
      const uniqueFolderIds = new Set(allFolderIds);

      if (uniqueFolderIds.size === 1 && allFolderIds[0] === '1VrlFNS-DmGW9AnKZeBqgii8vDcFdi-dB') {
        // Si todos usan el mismo ID por defecto, usar ese ID como carpeta raíz
        console.warn(`Using default folder ID for all agents. Consider configuring specific folder IDs.`);
      } else if (!configuredFolderId || configuredFolderId === 'your_general_folder_id_here') {
        throw new Error(`Folder ID not configured for agent: ${agentRole}`);
      }

      // Since you already have agent-specific folder IDs configured,
      // we directly create the "no procesados" subfolder inside them
      const subfolderName = AGENT_SUBFOLDER_NAMES[agentRole];
      const targetFolderId = await this.findOrCreateFolder(configuredFolderId, subfolderName);

      return targetFolderId;
    } catch (error: any) {
      console.error('Error getting target folder ID:', error);
      // Re-throw authentication errors to be handled at a higher level
      if (error.message && error.message.includes('Authentication failed')) {
        throw error;
      }
      return null;
    }
  }

  private async readFileContent(fileUri: string, maxSize: number = 50 * 1024 * 1024): Promise<string> {
    if (Platform.OS === 'web') {
      // En web, el fileUri es en realidad un blob URL o un File object
      try {
        const response = await fetch(fileUri);
        const blob = await response.blob();

        // Verificar tamaño del archivo
        if (blob.size > maxSize) {
          throw new Error(`El archivo es demasiado grande. Tamaño máximo permitido: ${maxSize / (1024 * 1024)}MB`);
        }

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Convertir a base64 en chunks para evitar problemas de memoria
        const chunkSize = 1024 * 1024; // 1MB chunks
        let binary = '';

        for (let i = 0; i < uint8Array.byteLength; i += chunkSize) {
          const chunk = uint8Array.slice(i, Math.min(i + chunkSize, uint8Array.byteLength));
          for (let j = 0; j < chunk.length; j++) {
            binary += String.fromCharCode(chunk[j]);
          }
        }

        return btoa(binary);
      } catch (error: any) {
        if (error.message && error.message.includes('demasiado grande')) {
          throw error;
        }
        throw new Error('Failed to read file content on web: ' + error.message);
      }
    } else {
      // En móvil, usar expo-file-system
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      // Verificar tamaño del archivo
      if (fileInfo.size && fileInfo.size > maxSize) {
        throw new Error(`El archivo es demasiado grande. Tamaño máximo permitido: ${maxSize / (1024 * 1024)}MB`);
      }

      return await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
  }

  async uploadFile({ fileUri, fileName, mimeType, agentRole }: UploadFileParams, retryCount = 0): Promise<boolean> {
    // Límite de tamaño de archivo (50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB en bytes

    // Validación de tipo MIME
    const ALLOWED_MIME_TYPES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    if (!ALLOWED_MIME_TYPES.includes(mimeType) && !mimeType.startsWith('text/')) {
      throw new Error(`Tipo de archivo no permitido: ${mimeType}`);
    }

    // Límite de reintentos
    if (retryCount > 2) {
      throw new Error('Max retry attempts reached for file upload');
    }
    if (!this.accessToken) {
      const authSuccess = await this.authenticate();
      if (!authSuccess) {
        throw new Error('Failed to authenticate with Google Drive');
      }
    }

    try {
      // Get the target folder ID
      const targetFolderId = await this.getTargetFolderId(agentRole);
      if (!targetFolderId) {
        throw new Error('Failed to get target folder ID');
      }

      // Read file content (compatible con web y móvil)
      const fileContent = await this.readFileContent(fileUri, MAX_FILE_SIZE);

      // Create multipart upload
      const metadata = {
        name: fileName,
        parents: [targetFolderId],
      };

      const delimiter = '-------314159265358979323846';
      const closeDelimiter = `\r\n--${delimiter}--`;

      let body = `--${delimiter}\r\n`;
      body += 'Content-Type: application/json\r\n\r\n';
      body += JSON.stringify(metadata) + '\r\n';
      body += `--${delimiter}\r\n`;
      body += `Content-Type: ${mimeType}\r\n`;
      body += 'Content-Transfer-Encoding: base64\r\n\r\n';
      body += fileContent;
      body += closeDelimiter;

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary="${delimiter}"`,
        },
        body: body,
      });

      if (response.status === 401) {
        // Token expired, try to refresh
        const refreshSuccess = await this.refreshToken();
        if (refreshSuccess) {
          // Retry upload with new token (con contador de reintentos)
          return this.uploadFile({ fileUri, fileName, mimeType, agentRole }, retryCount + 1);
        } else {
          throw new Error('Authentication failed - please log in again');
        }
      }

      // Manejar errores de red con reintentos
      if (response.status >= 500 && retryCount < 2) {
        console.log(`Server error ${response.status}, retrying... (attempt ${retryCount + 1})`);
        // Esperar antes de reintentar (backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return this.uploadFile({ fileUri, fileName, mimeType, agentRole }, retryCount + 1);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return !!data.id;
    } catch (error: any) {
      console.error('Error uploading file to Google Drive:', error);

      // Check if it's an authentication error that needs user action
      if (error.message && error.message.includes('Authentication failed')) {
        // Clear stored tokens and force re-authentication
        await this.logout();
        throw new Error('Session expired. Please log in again to continue uploading files.');
      }

      throw error;
    }
  }

  async listFiles(agentRole: UserRole, maxResults: number = 10): Promise<any[]> {
    if (!this.accessToken) {
      throw new Error('Google Drive not authenticated');
    }

    try {
      const targetFolderId = await this.getTargetFolderId(agentRole);
      if (!targetFolderId) {
        return [];
      }

      const query = `parents in '${targetFolderId}' and trashed=false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&pageSize=${maxResults}&fields=files(id,name,mimeType,createdTime,size)`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.files || [];
    } catch (error: any) {
      console.error('Error listing files from Google Drive:', error);
      
      if (error.status === 401) {
        const refreshSuccess = await this.refreshToken();
        if (refreshSuccess) {
          return this.listFiles(agentRole, maxResults);
        }
      }
      
      return [];
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    if (!this.accessToken) {
      throw new Error('Google Drive not authenticated');
    }

    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      return response.ok;
    } catch (error: any) {
      console.error('Error deleting file from Google Drive:', error);
      
      if (error.status === 401) {
        const refreshSuccess = await this.refreshToken();
        if (refreshSuccess) {
          return this.deleteFile(fileId);
        }
      }
      
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(['google_drive_token', 'google_drive_refresh_token']);
      this.accessToken = null;
    } catch (error) {
      console.error('Error logging out from Google Drive:', error);
    }
  }
}

export const googleDriveService = new GoogleDriveService();
export default googleDriveService;