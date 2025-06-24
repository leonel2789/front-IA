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
} from 'react-native'
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons'
import ChatInput from '../components/ChatInput'
import MessageBubble from '../components/MessageBubble'
import { N8N_URL } from '../config'

type Message = { id: string; text: string; isUser: boolean; isLoading?: boolean }

const N8N_WEBHOOK_URL = N8N_URL

const MENU_ITEMS = [
  { key: 'new', label: 'Nuevo Chat', icon: 'chat-plus-outline' },
  { key: 'history', label: 'Historial', icon: 'history' },
  { key: 'settings', label: 'Ajustes', icon: 'cog-outline' },
] as const

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const flatListRef = useRef<RNFlatList<Message>>(null)
  const dotAnimations = useRef<Animated.Value[]>([]).current

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
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)
    }
  }, [messages])

  const handleSend = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    setMessages(prev => [...prev, { id: Date.now().toString(), text: trimmed, isUser: true }])
    setMessages(prev => [...prev, { id: 'loading-msg', text: '', isUser: false, isLoading: true }])

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
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
            <TouchableOpacity key={item.key} style={styles.menuItem}>
              <MaterialCommunityIcons name={item.icon} size={24} color="#444" />
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) =>
            item.isLoading ? renderLoading() : <MessageBubble message={item.text} isUser={item.isUser} />
          }
          keyExtractor={item => item.id}
          contentContainerStyle={styles.contentContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        <ChatInput onSend={handleSend} style={styles.chatInput} />
      </KeyboardAvoidingView>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  contentContainer: { padding: 16, paddingBottom: 12 },
  chatInput: { marginHorizontal: 16, marginVertical: 10 },
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
})
