# Claude Memory - Proyecto Front IA Legal

## Resumen del Proyecto
- **Frontend**: React Native con Expo (front-IA)
- **Autenticaci�n**: Keycloak (keycloak-IALegal) 
- **Arquitectura**: App m�vil con login �nicamente

## Integraci�n de Keycloak Completada 

### 1. Frontend (front-IA)
- **Dependencias instaladas**: expo-auth-session, expo-web-browser, expo-crypto, @react-native-async-storage/async-storage
- **AuthProvider**: contexts/AuthContext.tsx - Manejo completo OAuth2/OpenID Connect
- **LoginScreen**: components/LoginScreen.tsx - Pantalla de login con dise�o atractivo
- **Configuraci�n**: config.ts actualizado con KEYCLOAK_CONFIG
- **Integraci�n**: AuthProvider envolviendo la app, control de acceso en index.tsx
- **Logout**: Bot�n agregado al men� del chat

### 2. Keycloak Server (keycloak-IALegal)
- **Docker Compose**: PostgreSQL + Keycloak 23.0.3
- **Realm**: "ia-legal" preconfigurado
- **Cliente**: front-ia-client con secret "front-ia-secret-2024"
- **Usuarios**:
  - admin/admin123 (ia-admin)
  - testuser/test123 (ia-user)
- **Scripts**: start.sh, stop.sh, reset.sh, backup.sh

### Configuraci�n Clave
```typescript
export const KEYCLOAK_CONFIG = {
  url: process.env.EXPO_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080',
  realm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM || 'ia-legal',
  clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID || 'front-ia-client'
};
```

### URLs Importantes
- Admin Console: http://localhost:8080/admin
- Realm: http://localhost:8080/realms/ia-legal
- Auth Endpoint: http://localhost:8080/realms/ia-legal/protocol/openid-connect/auth

### Para Iniciar
```bash
cd keycloak-IALegal
./scripts/start.sh
```

### Estado Actual
-  Keycloak configurado completamente
-  Frontend integrado con autenticaci�n
-  Solo funcionalidad de login implementada
-  Scripts de administraci�n creados
-  Documentaci�n completa

### Pr�ximos Pasos Potenciales
- Configurar SSL/TLS para producci�n
- Personalizar temas de Keycloak
- Configurar proveedores externos (Google, Facebook)
- Implementar roles más granulares

## Sistema de Roles por Categorías de IA (ACTUALIZACIÓN)

### Roles Configurados
- **ia-contratos**: IA especializada en contratos legales
- **ia-laboral**: IA especializada en derecho laboral  
- **ia-defensa-consumidor**: IA especializada en defensa del consumidor
- **ia-general**: IA general para consultas legales (por defecto)

### Mapeo de Webhooks N8N
```typescript
{
  'ia-contratos': 'https://legalcontratos.nilosolutions.com/webhook-test/66c6b4ae-eae4-411c-ad4f-64a359ec245f',
  'ia-laboral': 'https://legallaboral.nilosolutions.com/webhook-test/66c6b4ae-eae4-411c-ad4f-64a359ec245f',
  'ia-defensa-consumidor': 'https://legaldefensadelconsumidor.nilosolutions.com/webhook-test/66c6b4ae-eae4-411c-ad4f-64a359ec245f',
  'ia-general': 'https://legalbackn8n.nilosolutions.com/webhook/66c6b4ae-eae4-411c-ad4f-64a359ec245f'
}
```

### Configuración de Roles en Keycloak

#### 1. Crear Roles en el Realm
1. Acceder a Admin Console: http://localhost:8080/admin
2. Ir a Realm "ia-legal" → Realm roles
3. Crear los siguientes roles:
   - `ia-contratos`
   - `ia-laboral`
   - `ia-defensa-consumidor`
   - `ia-general`

#### 2. Asignar Roles a Usuarios
1. Ir a Users → Seleccionar usuario
2. Tab "Role mappings"
3. Asignar el rol correspondiente según la especialidad del usuario

### Funcionamiento Automático
1. **Login**: Usuario se autentica con Keycloak
2. **Extracción de Roles**: El frontend extrae roles del JWT token
3. **Selección de Webhook**: Se selecciona automáticamente el webhook según el primer rol del usuario
4. **Interfaz Personalizada**: Múltiples indicadores visuales del agente activo

### Indicadores Visuales del Agente Activo

#### 1. Cabecera Principal
- **Banner prominente** con información del agente
- **Colores personalizados** por tipo de agente
- **Badge "ACTIVO"** con animación de pulso
- **Icono representativo** de cada especialidad

#### 2. Barra Lateral
- **Información detallada** del agente y usuario
- **Descripción completa** de la especialidad
- **Roles adicionales** si el usuario tiene múltiples permisos
- **Colores temáticos** coherentes con el agente

#### 3. Estado Vacío
- **Mensaje personalizado** según el agente activo
- **Invitación contextual** para consultar al especialista
- **Iconografía específica** de cada área legal

#### 4. Colores por Agente
- **IA Contratos**: Verde (Documentos/Contratos)
- **IA Laboral**: Azul (Trabajo/Profesional) 
- **IA Defensa Consumidor**: Naranja (Protección/Alerta)
- **IA General**: Violeta (Justicia/Legal)