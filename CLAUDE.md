# Claude Memory - Proyecto Front IA Legal

## Resumen del Proyecto
- **Frontend**: React Native con Expo (front-IA)
- **Autenticación**: Keycloak (keycloak-IALegal) 
- **Arquitectura**: App móvil con login únicamente

## Integración de Keycloak Completada 

### 1. Frontend (front-IA)
- **Dependencias instaladas**: expo-auth-session, expo-web-browser, expo-crypto, @react-native-async-storage/async-storage
- **AuthProvider**: contexts/AuthContext.tsx - Manejo completo OAuth2/OpenID Connect
- **LoginScreen**: components/LoginScreen.tsx - Pantalla de login con diseño atractivo
- **Configuración**: config.ts actualizado con KEYCLOAK_CONFIG
- **Integración**: AuthProvider envolviendo la app, control de acceso en index.tsx
- **Logout**: Botón agregado al menú del chat

### 2. Keycloak Server (keycloak-IALegal)
- **Docker Compose**: PostgreSQL + Keycloak 23.0.3
- **Realm**: "ia-legal" preconfigurado
- **Cliente**: front-ia-client con secret "front-ia-secret-2024"
- **Usuarios**:
  - admin/admin123 (ia-admin)
  - testuser/test123 (ia-user)
- **Scripts**: start.sh, stop.sh, reset.sh, backup.sh

### Configuración Clave
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
-  Frontend integrado con autenticación
-  Solo funcionalidad de login implementada
-  Scripts de administración creados
-  Documentación completa

### Próximos Pasos Potenciales
- Configurar SSL/TLS para producción
- Personalizar temas de Keycloak
- Configurar proveedores externos (Google, Facebook)
- Implementar roles más granulares