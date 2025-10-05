import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type FlatList as RNFlatList,
  Animated,
  TouchableOpacity,
  Modal,
} from 'react-native'
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons'
import ChatInput from '../components/ChatInput'
import MessageBubble from '../components/MessageBubble'
import SessionHistory from '../components/SessionHistory'
import FileUploader from '../components/FileUploader'
import { N8N_URL, ChatMessage, AI_AGENTS } from '../config'
import { useSession } from '../contexts/SessionContext'
import { useAuth } from '../contexts/AuthContext'

type Message = { id: string; text: string; isUser: boolean; isLoading?: boolean }

const MENU_ITEMS = [
  { key: 'new', label: 'Nuevo Chat', icon: 'chat-plus-outline' },
  { key: 'upload', label: 'Subir Archivos', icon: 'cloud-upload-outline' },
  { key: 'history', label: 'Historial', icon: 'history' },
  { key: 'settings', label: 'Ajustes', icon: 'cog-outline' },
  { key: 'logout', label: 'Cerrar Sesión', icon: 'logout' },
] as const

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [showFileUploader, setShowFileUploader] = useState(false)
  const flatListRef = useRef<RNFlatList<Message>>(null)
  const dotAnimations = useRef<Animated.Value[]>([]).current
  const statusPulse = useRef(new Animated.Value(1)).current

  const {
    currentSessionId,
    currentMessages,
    createNewSession,
    switchToSession,
    updateCurrentSession,
    clearAllSessions,
  } = useSession()

  const { logout, user, currentWebhookUrl, userRoles } = useAuth()

  // Obtener información del agente actual
  const getCurrentAgent = () => {
    const currentRole = userRoles[0] || 'ia-general'
    return AI_AGENTS[currentRole]
  }

  const currentAgent = getCurrentAgent()

  // Inicializa animación de puntos
  if (dotAnimations.length === 0) {
    for (let i = 0; i < 3; i++) {
      dotAnimations.push(new Animated.Value(0))
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dotAnimations[i], { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(dotAnimations[i], { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start()
    }

    // Inicializa animación de pulso para el badge "ACTIVO"
    Animated.loop(
      Animated.sequence([
        Animated.timing(statusPulse, { toValue: 0.8, duration: 1000, useNativeDriver: true }),
        Animated.timing(statusPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start()
  }

  // Auto-scroll a fin del chat
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      // Pequeño delay para asegurar que el contenido se haya renderizado
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [messages]); // Cuando cambian los mensajes (incluye contenido y cantidad)

  // Cargar mensajes cuando cambia la sesión
  useEffect(() => {
    // Solo sobrescribir si no hay mensajes pendientes (como loading)
    const hasLoadingMessage = messages.some(msg => msg.isLoading)

    if (!hasLoadingMessage) {
      if (currentMessages.length > 0) {
        // Convertir mensajes de la sesión a formato del componente
        const convertedMessages: Message[] = currentMessages.map(msg => ({
          id: msg.id,
          text: msg.text,
          isUser: msg.isUser,
        }));
        setMessages(convertedMessages);
      } else {
        setMessages([]);
      }
    }
  }, [currentMessages, currentSessionId])

  const handleSend = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    // Agregar mensaje del usuario inmediatamente al estado local
    const userMessage = { id: Date.now().toString(), text: trimmed, isUser: true }
    const loadingMessage = { id: 'loading-msg', text: '', isUser: false, isLoading: true }

    setMessages(prev => [...prev, userMessage, loadingMessage])

    // Si no hay sesión actual, crear una nueva (solo genera el ID localmente)
    let sessionId = currentSessionId
    if (!sessionId) {
      sessionId = await createNewSession(trimmed)
    }
    // NOTA: No guardamos aquí porque N8N lo hace automáticamente

    try {
      // Enviar en formato plano que n8n puede usar directamente
      const payload = {
        chatInput: trimmed,     // Para el AI Agent
        message: trimmed,       // Para compatibilidad
        sessionId: sessionId || 'default-session', // Para el Chat Memory
      }

      const response = await fetch(currentWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      let reply = 'No pude obtener respuesta'

      if (Array.isArray(data) && data[0]?.output) reply = data[0].output
      else if (typeof data === 'string') reply = data
      else if (data.output) reply = data.output

      setMessages(prev => {
        const copy = [...prev]
        copy.pop()
        return [...copy, { id: `${Date.now()}-bot`, text: reply, isUser: false }]
      })

      // N8N ya guardó los mensajes en n8n_chat_histories_laboral
      // No es necesario guardar en Spring Boot (evita duplicados)
      // Solo refrescamos las sesiones para actualizar el historial
      refreshSessions().catch(err => console.error('Error refreshing sessions:', err))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setMessages(prev => {
        const copy = [...prev]
        copy.pop()
        return [...copy, { id: `${Date.now()}-err`, text: `❌ ${msg}`, isUser: false }]
      })
    }
  }

  const handleMenuAction = async (key: string) => {
    switch (key) {
      case 'new':
        await createNewSession()
        break
      case 'upload':
        setShowFileUploader(true)
        break
      case 'history':
        setShowHistory(true)
        break
      case 'settings':
        // Implementar más tarde
        break
      case 'logout':
        await logout()
        break
    }
  }

  const handleSelectSession = (sessionId: string) => {
    switchToSession(sessionId)
  }

  const renderLoading = () => (
    <View style={[styles.bubble, styles.bubbleBot, styles.loadingContainer]}>
      {dotAnimations.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: anim,
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
            },
          ]}
        />
      ))}
    </View>
  )

  const Sidebar = () => (
    <Animated.View style={[styles.sidebar, sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed]}>
      {sidebarOpen ? (
        <>
          <View style={styles.sidebarHeader}>
            <TouchableOpacity onPress={() => setSidebarOpen(false)} style={styles.menuToggle}>
              <MaterialIcons name="chevron-left" size={28} color="#444" />
            </TouchableOpacity>
            <MaterialCommunityIcons name="scale-balance" size={24} color="#444" style={styles.sidebarIcon} />
            <Text style={styles.sidebarTitle}>Legal RAG</Text>
          </View>
          {MENU_ITEMS.map(item => (
            <TouchableOpacity 
              key={item.key} 
              style={styles.menuItem}
              onPress={() => handleMenuAction(item.key)}
            >
              <MaterialCommunityIcons name={item.icon} size={24} color="#444" />
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          
          {/* Información del usuario y IA activa */}
          <View style={[styles.userInfo, { backgroundColor: currentAgent.lightColor, borderLeftColor: currentAgent.borderColor }]}>
            <View style={styles.agentHeader}>
              <MaterialCommunityIcons name={currentAgent.icon} size={20} color={currentAgent.color} />
              <Text style={[styles.agentName, { color: currentAgent.color }]}>
                {currentAgent.shortName}
              </Text>
            </View>
            <Text style={styles.agentDescription}>
              {currentAgent.description}
            </Text>
            <Text style={styles.userInfoTitle}>
              👤 {user?.preferred_username || 'Usuario'}
            </Text>
            {userRoles.length > 1 && (
              <Text style={styles.userInfoTextSecondary}>
                Otros roles: {userRoles.slice(1).map(r => AI_AGENTS[r]?.shortName || r).join(', ')}
              </Text>
            )}
          </View>

          {/* Información de sesión actual */}
          {currentSessionId && (
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionInfoText}>
                Sesión: {currentSessionId.slice(0, 8)}...
              </Text>
            </View>
          )}
        </>
      ) : (
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.menuToggleClosed}>
          <MaterialIcons name="menu" size={32} color="#444" />
        </TouchableOpacity>
      )}
    </Animated.View>
  )

  return (
    <View style={styles.outerContainer}>
      <Sidebar />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Cabecera con información del agente */}
        <View style={[styles.agentBanner, { backgroundColor: currentAgent.lightColor, borderBottomColor: currentAgent.borderColor }]}>
          <View style={styles.agentBannerContent}>
            <MaterialCommunityIcons name={currentAgent.icon} size={24} color={currentAgent.color} />
            <View style={styles.agentBannerText}>
              <Text style={[styles.agentBannerTitle, { color: currentAgent.color }]}>
                {currentAgent.name}
              </Text>
              <Text style={styles.agentBannerSubtitle}>
                {currentAgent.description}
              </Text>
            </View>
            <Animated.View 
              style={[
                styles.agentStatusBadge, 
                { 
                  backgroundColor: currentAgent.color,
                  transform: [{ scale: statusPulse }]
                }
              ]}
            >
              <Text style={styles.agentStatusText}>ACTIVO</Text>
            </Animated.View>
          </View>
        </View>

        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={({ item }) =>
              item.isLoading ? renderLoading() : <MessageBubble message={item.text} isUser={item.isUser} />
            }
            keyExtractor={item => item.id}
            contentContainerStyle={[
              styles.contentContainer,
              messages.length === 0 && { flex: 1 } // Solo usar flex cuando está vacío
            ]}
            style={styles.flatListStyle}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false} // Asegurar que no se quiten elementos del DOM
            onContentSizeChange={() => {
              if (messages.length > 0) {
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
              }
            }}
            onLayout={() => {
              // Scroll al final cuando el componente se monta
              if (messages.length > 0) {
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
              }
            }}
            initialNumToRender={100} // Renderizar muchos más mensajes inicialmente
            maxToRenderPerBatch={50} // Renderizar más mensajes por lote
            windowSize={50} // Ventana mucho más grande para mantener mensajes en memoria
            scrollEnabled={true}
            nestedScrollEnabled={true}
            updateCellsBatchingPeriod={50} // Actualizar más frecuentemente
            legacyImplementation={false} // Usar la implementación moderna
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name={currentAgent.icon} size={64} color={currentAgent.color} />
                <Text style={[styles.emptyText, { color: currentAgent.color }]}>
                  {currentSessionId ? `Consulta tu especialista en ${currentAgent.shortName}` : `Inicia una conversación con ${currentAgent.name}`}
                </Text>
                <Text style={styles.emptySubtext}>
                  {currentAgent.description}
                </Text>
              </View>
            )}
          />
        </View>
        <ChatInput onSend={handleSend} style={styles.chatInput} />
      </KeyboardAvoidingView>

      {/* Modal para historial */}
      <Modal
        visible={showHistory}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SessionHistory
          isVisible={showHistory}
          onClose={() => setShowHistory(false)}
          onSelectSession={handleSelectSession}
        />
      </Modal>

      {/* Modal para subir archivos */}
      <FileUploader
        visible={showFileUploader}
        onClose={() => setShowFileUploader(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
  },
  sidebar: {
    backgroundColor: '#EFEFEF',
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  sidebarOpen: { width: 200 },
  sidebarClosed: { width: 60 },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  menuToggle: {
    marginRight: 12,
  },
  menuToggleClosed: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarIcon: {
    marginRight: 8,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#444',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  menuLabel: {
    color: '#666',
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  userInfo: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  agentDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    lineHeight: 16,
  },
  userInfoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userInfoTextSecondary: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  sessionInfo: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#e8f4fd',
    borderRadius: 6,
  },
  sessionInfoText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
  },
  chatContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  flatListStyle: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    paddingVertical: 16,
    paddingBottom: 120, // Más espacio para evitar que se corten los mensajes
  },
  chatInput: { 
    marginHorizontal: 16, 
    marginVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
  },
  bubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
  },
  bubbleBot: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  loadingContainer: { flexDirection: 'row', padding: 12 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CCC',
    marginHorizontal: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  agentBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  agentBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentBannerText: {
    flex: 1,
    marginLeft: 12,
  },
  agentBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  agentBannerSubtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  agentStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  agentStatusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})