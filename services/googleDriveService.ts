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
          preferLocalhost: true 
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

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_DRIVE_CONFIG.clientId!,
          client_secret: GOOGLE_DRIVE_CONFIG.clientSecret!,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
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

  private async findOrCreateFolder(parentId: string, folderName: string): Promise<string | null> {
    if (!this.accessToken) {
      throw new Error('Google Drive not authenticated');
    }

    try {
      // First, try to find existing folder
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${folderName}' and parents in '${parentId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name)`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

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

      if (!createResponse.ok) {
        throw new Error(`HTTP error! status: ${createResponse.status}`);
      }

      const createData = await createResponse.json();
      return createData.id;
    } catch (error) {
      console.error(`Error finding/creating folder ${folderName}:`, error);
      return null;
    }
  }

  private async getTargetFolderId(agentRole: UserRole): Promise<string | null> {
    try {
      // Get the configured folder ID for this specific agent
      const configuredFolderId = GOOGLE_DRIVE_FOLDERS[agentRole];
      
      // If the folder ID is the default placeholder, skip this agent
      if (!configuredFolderId || configuredFolderId === 'your_general_folder_id_here' || configuredFolderId === '1VrlFNS-DmGW9AnKZeBqgii8vDcFdi-dB') {
        throw new Error(`Folder ID not configured for agent: ${agentRole}`);
      }
      
      // Since you already have agent-specific folder IDs configured,
      // we directly create the "no procesados" subfolder inside them
      const subfolderName = AGENT_SUBFOLDER_NAMES[agentRole];
      const targetFolderId = await this.findOrCreateFolder(configuredFolderId, subfolderName);
      
      return targetFolderId;
    } catch (error) {
      console.error('Error getting target folder ID:', error);
      return null;
    }
  }

  private async readFileContent(fileUri: string): Promise<string> {
    if (Platform.OS === 'web') {
      // En web, el fileUri es en realidad un blob URL o un File object
      try {
        const response = await fetch(fileUri);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convertir a base64
        let binary = '';
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        return btoa(binary);
      } catch (error) {
        throw new Error('Failed to read file content on web');
      }
    } else {
      // En móvil, usar expo-file-system
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      return await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
  }

  async uploadFile({ fileUri, fileName, mimeType, agentRole }: UploadFileParams): Promise<boolean> {
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
      const fileContent = await this.readFileContent(fileUri);

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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return !!data.id;
    } catch (error: any) {
      console.error('Error uploading file to Google Drive:', error);
      
      // Try to refresh token if it's an auth error
      if (error.status === 401) {
        const refreshSuccess = await this.refreshToken();
        if (refreshSuccess) {
          // Retry upload once
          return this.uploadFile({ fileUri, fileName, mimeType, agentRole });
        }
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