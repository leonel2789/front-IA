import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYCLOAK_CONFIG } from '../config';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true,
  });

  const keycloakAuthUrl = `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/auth`;
  const keycloakTokenUrl = `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`;
  const keycloakLogoutUrl = `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/logout`;

  const discovery = {
    authorizationEndpoint: keycloakAuthUrl,
    tokenEndpoint: keycloakTokenUrl,
    endSessionEndpoint: keycloakLogoutUrl,
  };

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: KEYCLOAK_CONFIG.clientId,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      codeChallenge: undefined, // Let expo-auth-session generate PKCE automatically
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
      extraParams: {},
      additionalParameters: {},
    },
    discovery
  );

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      handleAuthResponse(response);
    }
  }, [response]);

  const initializeAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        const userInfo = await AsyncStorage.getItem('user_info');
        if (userInfo) {
          setUser(JSON.parse(userInfo));
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthResponse = async (response: AuthSession.AuthSessionResult) => {
    if (response.type === 'success') {
      try {
        const { code } = response.params;
        
        const credentials = btoa(`${KEYCLOAK_CONFIG.clientId}:${KEYCLOAK_CONFIG.clientSecret}`);
        
        const tokenResponse = await fetch(keycloakTokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: KEYCLOAK_CONFIG.clientId,
            code,
            redirect_uri: redirectUri,
            code_verifier: request?.codeVerifier || '',
          }).toString(),
        });

        const tokens = await tokenResponse.json();
        
        if (!tokenResponse.ok) {
          console.error('Token request failed:', tokenResponse.status, tokens);
          throw new Error(`Token request failed: ${tokens.error_description || tokens.error || 'Unknown error'}`);
        }
        
        if (tokens.access_token) {
          await AsyncStorage.setItem('access_token', tokens.access_token);
          await AsyncStorage.setItem('refresh_token', tokens.refresh_token);
          
          const userInfoResponse = await fetch(
            `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/userinfo`,
            {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
              },
            }
          );
          
          const userInfo = await userInfoResponse.json();
          await AsyncStorage.setItem('user_info', JSON.stringify(userInfo));
          
          setUser(userInfo);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error handling auth response:', error);
      }
    }
  };

  const login = async () => {
    try {
      await promptAsync();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('access_token');
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      
      // Invalidar la sesión en Keycloak
      if (refreshToken) {
        try {
          await fetch(keycloakLogoutUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: KEYCLOAK_CONFIG.clientId,
              client_secret: KEYCLOAK_CONFIG.clientSecret,
              refresh_token: refreshToken,
            }).toString(),
          });
        } catch (logoutError) {
          console.error('Error invalidating Keycloak session:', logoutError);
        }
      }
      
      // Limpiar datos locales
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user_info']);
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getAccessToken = async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem('access_token');
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};