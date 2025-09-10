// Mapeo de roles a webhooks de N8N
export const N8N_WEBHOOKS = {
  'ia-contratos': process.env.EXPO_PUBLIC_N8N_CONTRATOS_URL || 'https://legalcontratos.nilosolutions.com/webhook/66c6b4ae-eae4-411c-ad4f-64a359ec245f',
  'ia-laboral': process.env.EXPO_PUBLIC_N8N_LABORAL_URL || 'https://legallaboral.nilosolutions.com/webhook/66c6b4ae-eae4-411c-ad4f-64a359ec245f',
  'ia-defensa-consumidor': process.env.EXPO_PUBLIC_N8N_DEFENSA_URL || 'https://legaldefensadelconsumidor.nilosolutions.com/webhook/66c6b4ae-eae4-411c-ad4f-64a359ec245f',
  'ia-general': process.env.EXPO_PUBLIC_N8N_GENERAL_URL || 'https://legalbackn8n.nilosolutions.com/webhook/66c6b4ae-eae4-411c-ad4f-64a359ec245f'
};

// URL por defecto (IA General - mantiene compatibilidad con versión anterior)
export const N8N_URL = process.env.EXPO_PUBLIC_N8N_URL || 
  'https://legalbackn8n.nilosolutions.com/webhook/66c6b4ae-eae4-411c-ad4f-64a359ec245f';

export const KEYCLOAK_CONFIG = {
  url: process.env.EXPO_PUBLIC_KEYCLOAK_URL || 'https://keycloak.nilosolutions.com',
  realm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM || 'ia-legal',
  clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID || 'front-ia-client',
  clientSecret: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_SECRET || 'front-ia-secret-2024'
};

// Roles disponibles en el sistema
export const AVAILABLE_ROLES = [
  'ia-contratos',
  'ia-laboral', 
  'ia-defensa-consumidor',
  'ia-general'
] as const;

export type UserRole = typeof AVAILABLE_ROLES[number];

// Configuración de agentes IA
export const AI_AGENTS = {
  'ia-contratos': {
    name: 'IA Contratos',
    shortName: 'Contratos',
    description: 'Especialista en contratos y documentos legales',
    icon: 'file-document-outline',
    color: '#2E7D32',
    lightColor: '#E8F5E8',
    borderColor: '#4CAF50'
  },
  'ia-laboral': {
    name: 'IA Laboral',
    shortName: 'Laboral',
    description: 'Especialista en derecho laboral y relaciones de trabajo',
    icon: 'briefcase-outline',
    color: '#1565C0',
    lightColor: '#E3F2FD',
    borderColor: '#2196F3'
  },
  'ia-defensa-consumidor': {
    name: 'IA Defensa al Consumidor',
    shortName: 'Consumidor',
    description: 'Especialista en protección y defensa del consumidor',
    icon: 'shield-account-outline',
    color: '#E65100',
    lightColor: '#FFF3E0',
    borderColor: '#FF9800'
  },
  'ia-general': {
    name: 'IA Legal General',
    shortName: 'General',
    description: 'Consultas legales generales y asesoramiento integral',
    icon: 'scale-balance',
    color: '#6A1B9A',
    lightColor: '#F3E5F5',
    borderColor: '#9C27B0'
  }
} as const;

export interface ChatMessage {
  message: string;
  sessionId?: string;
}

// Configuración de Google Drive
export const GOOGLE_DRIVE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_GOOGLE_API_KEY,
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  clientSecret: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET,
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly'
  ]
};

// Mapeo de agentes a carpetas de Google Drive
export const GOOGLE_DRIVE_FOLDERS = {
  'ia-contratos': process.env.EXPO_PUBLIC_GD_CONTRATOS_FOLDER_ID || '1VrlFNS-DmGW9AnKZeBqgii8vDcFdi-dB',
  'ia-laboral': process.env.EXPO_PUBLIC_GD_LABORAL_FOLDER_ID || '1VrlFNS-DmGW9AnKZeBqgii8vDcFdi-dB', 
  'ia-defensa-consumidor': process.env.EXPO_PUBLIC_GD_DEFENSA_FOLDER_ID || '1VrlFNS-DmGW9AnKZeBqgii8vDcFdi-dB',
  'ia-general': process.env.EXPO_PUBLIC_GD_GENERAL_FOLDER_ID || '1VrlFNS-DmGW9AnKZeBqgii8vDcFdi-dB'
} as const;

// Subfolder names for "no procesados"
export const AGENT_SUBFOLDER_NAMES = {
  'ia-contratos': 'contratos no procesados',
  'ia-laboral': 'laboral no procesados',
  'ia-defensa-consumidor': 'defensaconsumidor no procesados',
  'ia-general': 'general no procesados'
} as const;