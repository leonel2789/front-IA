# 📱 IA Legal - Frontend

Sistema de asistencia legal inteligente para abogados, con múltiples agentes especializados en diferentes áreas del derecho argentino.

## 🎯 Descripción

**IA Legal** es una aplicación móvil desarrollada con React Native y Expo que permite a los abogados consultar información legal, buscar jurisprudencia, acceder a documentos del estudio y obtener referencias normativas de forma rápida y eficiente.

### ✨ Características Principales

- 🤖 **4 Agentes Especializados:**
  - IA Contratos (Derecho contractual)
  - IA Laboral (Derecho del trabajo)
  - IA Defensa al Consumidor (Ley 24.240)
  - IA Legal General (Consultas generales)

- 💬 **Chat Inteligente con Memoria:** Conversaciones contextuales que recuerdan el historial
- 📁 **Gestión de Sesiones:** Organiza conversaciones por casos o temas
- ☁️ **Integración con Google Drive:** Sube y procesa documentos
- 🔐 **Autenticación con Keycloak:** Seguridad empresarial
- 📊 **Backend con Spring Boot:** API REST para gestión de sesiones
- 🧠 **Integración con N8N:** Workflows de IA con OpenAI

---

## 📚 Documentación para Usuarios

Si eres un **abogado** que va a usar la aplicación:

- 🚀 **[Inicio Rápido](./INICIO_RAPIDO.md)** - Comienza a usar la app en 3 pasos
- 📖 **[Guía Completa de Usuario](./GUIA_USUARIO.md)** - Documentación detallada

---

## 🛠️ Documentación Técnica

### Stack Tecnológico

**Frontend:**
- React Native + Expo
- TypeScript
- AsyncStorage (persistencia local)
- React Navigation
- Expo Vector Icons

**Backend:**
- Spring Boot (API REST)
- PostgreSQL (base de datos)
- Keycloak (autenticación OAuth2)
- N8N (workflows de IA)
- OpenAI API (GPT-4)
- Google Drive API (almacenamiento de documentos)

**Infraestructura:**
- Vector Store (PGVector) para búsquedas semánticas
- Embeddings OpenAI para procesamiento de documentos

---

## 🚀 Instalación y Configuración

### Requisitos Previos

- Node.js 18+
- npm o yarn
- Expo CLI
- Android Studio / Xcode (para desarrollo móvil)

### 1. Clonar el Repositorio

```bash
git clone https://github.com/[tu-usuario]/front-IA.git
cd front-IA
```

### 2. Instalar Dependencias

```bash
npm install
# o
yarn install
```

### 3. Configurar Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:

```bash
# Keycloak
EXPO_PUBLIC_KEYCLOAK_URL=https://keycloak.tudominio.com
EXPO_PUBLIC_KEYCLOAK_REALM=ia-legal
EXPO_PUBLIC_KEYCLOAK_CLIENT_ID=front-ia-client
EXPO_PUBLIC_KEYCLOAK_CLIENT_SECRET=tu-secret

# N8N Webhooks
EXPO_PUBLIC_N8N_CONTRATOS_URL=https://n8n.tudominio.com/webhook/contratos
EXPO_PUBLIC_N8N_LABORAL_URL=https://n8n.tudominio.com/webhook/laboral
EXPO_PUBLIC_N8N_DEFENSA_URL=https://n8n.tudominio.com/webhook/defensa
EXPO_PUBLIC_N8N_GENERAL_URL=https://n8n.tudominio.com/webhook/general

# Google Drive
EXPO_PUBLIC_GOOGLE_API_KEY=tu-api-key
EXPO_PUBLIC_GOOGLE_CLIENT_ID=tu-client-id
EXPO_PUBLIC_GOOGLE_CLIENT_SECRET=tu-client-secret

# Backend Spring Boot
EXPO_PUBLIC_USE_SPRING_BOOT=true
EXPO_PUBLIC_SPRING_BOOT_URL=https://backend.tudominio.com
```

### 4. Ejecutar en Desarrollo

```bash
npx expo start
```

Luego:
- Presiona `a` para Android
- Presiona `i` para iOS
- Escanea el QR con Expo Go

---

## 📁 Estructura del Proyecto

```
front-IA/
├── app/                          # Navegación y layouts
│   ├── (tabs)/                   # Tabs principales
│   └── _layout.tsx               # Layout raíz
├── components/                   # Componentes reutilizables
│   ├── ChatInput.tsx             # Input de mensajes
│   ├── MessageBubble.tsx         # Burbuja de chat
│   ├── SessionHistory.tsx        # Lista de sesiones
│   └── FileUploader.tsx          # Subida de archivos
├── contexts/                     # Contextos de React
│   ├── AuthContext.tsx           # Autenticación y roles
│   └── SessionContext.tsx        # Gestión de sesiones
├── screens/                      # Pantallas principales
│   └── ChatScreen.tsx            # Pantalla de chat
├── services/                     # Servicios y APIs
│   ├── SessionService.ts         # Lógica de sesiones
│   ├── SpringBootSessionService.ts  # API Spring Boot
│   ├── DatabaseService.ts        # Acceso a PostgreSQL
│   ├── StorageService.ts         # AsyncStorage
│   └── uploadHistoryService.ts  # Google Drive
├── config.ts                     # Configuración de agentes
├── .env                          # Variables de entorno
├── GUIA_USUARIO.md              # Documentación para usuarios
├── INICIO_RAPIDO.md             # Quick start guide
└── README.md                     # Este archivo
```

---

## 🔧 Configuración de Agentes

Los agentes se configuran en `config.ts`:

```typescript
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
  // ... otros agentes
}
```

Cada agente tiene:
- **Webhook N8N:** URL para procesamiento de consultas
- **Vector Store:** Base de datos de documentos específicos
- **Carpeta Google Drive:** Para subida de archivos
- **Tabla PostgreSQL:** Historial de chat

---

## 🔐 Autenticación

El sistema usa **Keycloak** para autenticación OAuth2:

1. Usuario inicia sesión con credenciales
2. Keycloak devuelve JWT con roles
3. Frontend extrae roles y asigna agentes
4. Cada request al backend incluye el token

**Roles disponibles:**
- `ia-contratos`
- `ia-laboral`
- `ia-defensa-consumidor`
- `ia-general`

---

## 🤖 Integración con N8N

### Flujo de una Consulta

```
Usuario escribe mensaje
    ↓
Frontend envía a webhook N8N
    ↓
N8N recupera historial (Postgres Chat Memory)
    ↓
N8N consulta Vector Store (documentos)
    ↓
N8N envía a OpenAI GPT-4
    ↓
N8N guarda respuesta en historial
    ↓
Frontend recibe respuesta
```

### Payload del Webhook

```json
{
  "chatInput": "Buscame el CCT 130/75",
  "message": "Buscame el CCT 130/75",
  "sessionId": "user123_ia-laboral_1234567890_abc123"
}
```

### Configuración de Memoria en N8N

**Importante:** El nodo `Postgres Chat Memory` debe tener:

```json
{
  "sessionKey": "={{ $json.body.sessionId }}",
  "contextWindowLength": 15
}
```

---

## 📊 Base de Datos

### Tablas de Chat History

Cada agente tiene su tabla:
- `n8n_chat_histories_contratos`
- `n8n_chat_histories_laboral`
- `n8n_chat_histories_defensa`
- `n8n_chat_histories_general`

**Estructura:**
```sql
CREATE TABLE n8n_chat_histories_laboral (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255),
  user_id VARCHAR(255),
  message TEXT,
  response TEXT,
  is_user BOOLEAN,
  agent_type VARCHAR(50),
  timestamp TIMESTAMP,
  metadata JSONB
);
```

### Vector Stores

Tablas para búsqueda semántica:
- `n8n_contratos` (documentos de contratos)
- `n8n_laboral` (CCT, jurisprudencia laboral)
- `n8n_defensa` (Ley 24.240, casos consumidor)
- `n8n_general` (normativa general)

---

## 🐛 Debugging

### Ver Logs de Expo

```bash
npx expo start --dev-client
```

### Inspeccionar Network

Usa React Native Debugger:
```bash
npm install -g react-native-debugger
react-native-debugger
```

### Limpiar Cache

```bash
npx expo start --clear
```

---

## 📦 Build y Deploy

### Build para Android

```bash
eas build --platform android
```

### Build para iOS

```bash
eas build --platform ios
```

### Configurar EAS

```bash
npm install -g eas-cli
eas login
eas build:configure
```

---

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests (próximamente)
npm run test:e2e
```

---

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'Agrega nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

---

## 📝 Roadmap

- [ ] Búsqueda en historial de sesiones
- [ ] Exportar conversaciones a PDF
- [ ] Notificaciones push
- [ ] Modo offline básico
- [ ] Estadísticas de uso
- [ ] Multi-idioma (PT, EN)

---

## 🆘 Soporte

- **Issues:** [GitHub Issues](https://github.com/[tu-usuario]/front-IA/issues)
- **Documentación:** Ver carpeta `/docs`
- **Email:** [tu-email]

---

## 📄 Licencia

[Especificar licencia]

---

## 👥 Equipo

- **Desarrollo:** [Nombres]
- **Backend:** [Repositorio back-IALegal](https://github.com/[tu-usuario]/back-IALegal)
- **Infraestructura:** N8N + PostgreSQL + OpenAI

---

**Versión:** 1.0.0
**Última actualización:** Octubre 2025
