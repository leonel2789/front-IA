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
import { N8N_URL, ChatMessage } from '../config'
import { useSession } from '../contexts/SessionContext'
import { useAuth } from '../contexts/AuthContext'

type Message = { id: string; text: string; isUser: boolean; isLoading?: boolean }

const N8N_WEBHOOK_URL = N8N_URL

const MENU_ITEMS = [
  { key: 'new', label: 'Nuevo Chat', icon: 'chat-plus-outline' },
  { key: 'history', label: 'Historial', icon: 'history' },
  { key: 'settings', label: 'Ajustes', icon: 'cog-outline' },
  { key: 'logout', label: 'Cerrar Sesión', icon: 'logout' },
] as const

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const flatListRef = useRef<RNFlatList<Message>>(null)
  const dotAnimations = useRef<Animated.Value[]>([]).current

  const {
    currentSessionId,
    createNewSession,
    switchToSession,
    updateCurrentSession,
    clearAllSessions,
  } = useSession()

  const { logout, user } = useAuth()

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
  }

  // Auto-scroll a fin del chat
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      // Pequeño delay para asegurar que el contenido se haya renderizado
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [messages.length]); // Solo cuando cambia la cantidad de mensajes

  // Limpiar mensajes cuando cambia la sesión
  useEffect(() => {
    setMessages([])
  }, [currentSessionId])

  const handleSend = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    // Si no hay sesión actual, crear una nueva
    let sessionId = currentSessionId
    if (!sessionId) {
      sessionId = await createNewSession(trimmed)
    } else {
      updateCurrentSession(trimmed)
    }

    setMessages(prev => [...prev, { id: Date.now().toString(), text: trimmed, isUser: true }])
    setMessages(prev => [...prev, { id: 'loading-msg', text: '', isUser: false, isLoading: true }])

    try {
      // Enviar en formato plano que n8n puede usar directamente
      const payload = {
        chatInput: trimmed,     // Para el AI Agent
        message: trimmed,       // Para compatibilidad
        sessionId: sessionId || 'default-session', // Para el Chat Memory
      }

      console.log('🚀 Enviando payload:', JSON.stringify(payload, null, 2))

      const response = await fetch(N8N_WEBHOOK_URL, {
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
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={({ item }) =>
              item.isLoading ? renderLoading() : <MessageBubble message={item.text} isUser={item.isUser} />
            }
            keyExtractor={item => item.id}
            contentContainerStyle={styles.contentContainer}
            style={styles.flatListStyle}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            onContentSizeChange={() => {
              if (messages.length > 0) {
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
              }
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="scale-balance" size={64} color="#ccc" />
                <Text style={styles.emptyText}>
                  {currentSessionId ? 'Escribe tu consulta legal' : 'Inicia una nueva conversación'}
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
  sessionInfo: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#e8f4fd',
    borderRadius: 8,
  },
  sessionInfoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
  },
  chatContainer: {
    flex: 1,
  },
  flatListStyle: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentContainer: { 
    paddingVertical: 16,
    paddingBottom: 20,
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
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
})