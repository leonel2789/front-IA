export const N8N_URL = process.env.EXPO_PUBLIC_N8N_URL || 
  'https://legalbackn8n.nilosolutions.com/webhook-test/66c6b4ae-eae4-411c-ad4f-64a359ec245f';

export interface ChatMessage {
  message: string;
  sessionId?: string;
}