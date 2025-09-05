export const N8N_URL = process.env.EXPO_PUBLIC_N8N_URL || 
  'https://legalbackn8n.nilosolutions.com/webhook/66c6b4ae-eae4-411c-ad4f-64a359ec245f';

export const KEYCLOAK_CONFIG = {
  url: process.env.EXPO_PUBLIC_KEYCLOAK_URL || 'https://keycloak.nilosolutions.com',
  realm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM || 'ia-legal',
  clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID || 'front-ia-client',
  clientSecret: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_SECRET || 'front-ia-secret-2024'
};

export interface ChatMessage {
  message: string;
  sessionId?: string;
}