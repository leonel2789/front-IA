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

## Sistema de Carga de Archivos a Google Drive (NUEVA FUNCIONALIDAD)

### Arquitectura de Carpetas
```
Google Drive Root (1VrlFNS-DmGW9AnKZeBqgii8vDcFdi-dB)
├── IA Contratos/
│   └── contratos no procesados/     ← Archivos van aquí
├── IA Laboral/
│   └── laboral no procesados/       ← Archivos van aquí
├── IA Defensa del Consumidor/
│   └── defensaconsumidor no procesados/ ← Archivos van aquí
└── IA General/
    └── general no procesados/       ← Archivos van aquí
```

### Componentes Implementados

#### 1. Servicio Google Drive (`services/googleDriveService.ts`)
- **Autenticación OAuth2** con Google Drive API
- **Mapeo automático** de agentes a carpetas específicas
- **Creación automática** de subcarpetas "no procesados"
- **Manejo de tokens** con refresh automático
- **Subida de archivos** a la carpeta correcta según rol del usuario

#### 2. Componente de Carga (`components/FileUploader.tsx`)
- **Modal full-screen** con diseño cohesivo al agente activo
- **Selector de archivos múltiple** con preview
- **Indicador de progreso** por archivo
- **Autenticación integrada** con Google Drive
- **Validación de archivos** y manejo de errores

#### 3. Integración en ChatScreen
- **Botón "Subir Archivos"** en menú lateral
- **Detección automática del agente activo**
- **Colores y temas coherentes** con el sistema de roles

### Configuración Requerida

#### Variables de Entorno (.env)
```bash
# Google Drive API
EXPO_PUBLIC_GOOGLE_API_KEY=your_api_key
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_SECRET=your_client_secret

# Folder IDs específicos por agente (opcionales)
EXPO_PUBLIC_GD_CONTRATOS_FOLDER_ID=folder_id_contratos
EXPO_PUBLIC_GD_LABORAL_FOLDER_ID=folder_id_laboral
EXPO_PUBLIC_GD_DEFENSA_FOLDER_ID=folder_id_defensa
EXPO_PUBLIC_GD_GENERAL_FOLDER_ID=folder_id_general
```

#### Dependencias Instaladas
```json
{
  "googleapis": "^159.0.0",
  "expo-file-system": "^18.1.11"
}
```

### Flujo de Funcionamiento

1. **Usuario accede a "Subir Archivos"** desde el menú lateral
2. **Sistema detecta el agente activo** basado en roles del usuario
3. **Modal se abre** con colores y branding del agente
4. **Usuario autoriza Google Drive** (solo la primera vez)
5. **Usuario selecciona archivos** desde el dispositivo
6. **Sistema sube archivos automáticamente** a la carpeta correcta:
   - `IA Contratos/contratos no procesados/`
   - `IA Laboral/laboral no procesados/`
   - `IA Defensa del Consumidor/defensaconsumidor no procesados/`
   - `IA General/general no procesados/`

### Mapeo de Agentes a Carpetas
```typescript
const AGENT_SUBFOLDER_NAMES = {
  'ia-contratos': 'contratos no procesados',
  'ia-laboral': 'laboral no procesados', 
  'ia-defensa-consumidor': 'defensaconsumidor no procesados',
  'ia-general': 'general no procesados'
}
```

### Siguientes Pasos para N8N Integration
1. **Crear webhook/trigger en N8N** para detectar archivos nuevos en Google Drive
2. **Procesar archivos** con el RAG system correspondiente al agente
3. **Mover archivos procesados** a carpeta "procesados" 
4. **Notificar al usuario** del procesamiento completado

### Características Destacadas
- ✅ **Detección automática del agente activo**
- ✅ **Subida directa a carpeta correcta** 
- ✅ **Interfaz visual coherente** con sistema de roles
- ✅ **Manejo robusto de errores** y autenticación
- ✅ **Soporte para múltiples archivos**
- ✅ **Preview de archivos** con iconos por tipo
- ✅ **Indicadores de progreso** en tiempo real
- ✅ **Compatibilidad web y móvil** - Funciona en ambas plataformas
- ✅ **OAuth2 con PKCE** - Seguridad mejorada según estándares Google

## Correcciones y Mejoras Implementadas (Diciembre 2024)

### 1. Solución a Error de Google SDK Logging
**Problema**: `Cannot read properties of undefined (reading 'GOOGLE_SDK_NODE_LOGGING')`
**Solución**: 
- ❌ **Eliminado** `googleapis` package (incompatible con React Native)
- ✅ **Implementado** HTTP requests directos a Google Drive API
- ✅ **Reemplazados** todos los métodos de `googleapis` con `fetch()` nativo

### 2. Corrección de AuthSession.startAsync Deprecated
**Problema**: `AuthSession.startAsync is not a function`
**Solución**:
- ❌ **Eliminado** uso de `AuthSession.startAsync` (deprecated)
- ✅ **Implementado** `AuthSession.AuthRequest` + `promptAsync` (API moderna)
- ✅ **Configurado** discovery endpoints oficiales de Google

### 3. Implementación de OAuth2 con PKCE
**Problema**: `Missing code verifier` error 400
**Solución**:
- ✅ **PKCE habilitado** con `CodeChallengeMethod.S256`
- ✅ **Code verifier automático** generado por Expo
- ✅ **Parámetros flexibles** para Web applications y Mobile apps
- ✅ **Client secret opcional** según tipo de OAuth client

### 4. Configuración de Redirect URIs
**Problema**: Error 404 y CORS issues
**Solución**:
- ✅ **Scheme personalizado** configurado: `iafrontend://`
- ✅ **Desarrollo local** con `preferLocalhost: true`
- ✅ **URIs recomendadas** para Google Cloud Console:
  ```
  http://localhost:19006
  http://localhost:8081
  iafrontend://
  ```

### 5. Compatibilidad Web/Móvil para Upload de Archivos
**Problema**: `expo-file-system.getInfoAsync is not available on web`
**Solución**:
- ✅ **Detección de plataforma** con `Platform.OS === 'web'`
- ✅ **Web**: Usa File API nativo (`fetch()` + `arrayBuffer()`)
- ✅ **Móvil**: Mantiene `expo-file-system`
- ✅ **Conversión base64** unificada para ambas plataformas

### 6. Configuración Completa de Google Drive API

#### Variables de Entorno Requeridas (.env)
```bash
# Google Drive API Configuration
EXPO_PUBLIC_GOOGLE_API_KEY=your_google_api_key
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_SECRET=your_client_secret

# Google Drive Folder IDs por Agente
EXPO_PUBLIC_GD_CONTRATOS_FOLDER_ID=folder_id_contratos
EXPO_PUBLIC_GD_LABORAL_FOLDER_ID=folder_id_laboral
EXPO_PUBLIC_GD_DEFENSA_FOLDER_ID=folder_id_defensa
EXPO_PUBLIC_GD_GENERAL_FOLDER_ID=folder_id_general
```

#### Pasos de Configuración en Google Cloud Console
1. **Habilitar APIs**: Google Drive API
2. **Crear credenciales**: OAuth 2.0 Client ID (Web application)
3. **Configurar redirect URIs**:
   - `http://localhost:19006`
   - `http://localhost:8081`
   - `iafrontend://`
4. **Obtener folder IDs** desde URLs de Google Drive

### 7. Arquitectura Técnica Actualizada

#### Servicio Google Drive (`services/googleDriveService.ts`)
- ✅ **HTTP requests puros** (sin googleapis dependency)
- ✅ **OAuth2 PKCE compliant**
- ✅ **Cross-platform file reading**
- ✅ **Refresh token automático**
- ✅ **Error handling robusto**

#### Componente FileUploader (`components/FileUploader.tsx`)
- ✅ **Modal full-screen** con diseño por agente
- ✅ **Autenticación Google Drive integrada**
- ✅ **Progress indicators** por archivo
- ✅ **Preview con iconos** por tipo de archivo

### Estado Actual: COMPLETAMENTE FUNCIONAL
- ✅ **Autenticación Google Drive**: OAuth2 con PKCE
- ✅ **Upload de archivos**: Web y móvil compatible
- ✅ **Organización automática**: Por agente y subcarpetas
- ✅ **Interfaz intuitiva**: Diseño coherente con sistema de roles
- ✅ **Error handling**: Manejo robusto de fallos de red/auth