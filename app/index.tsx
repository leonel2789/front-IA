// app/index.tsx
import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import ChatScreen from '../screens/ChatScreen'
import LoginScreen from '../components/LoginScreen'
import { SessionProvider } from '../contexts/SessionContext'
import { useAuth } from '../contexts/AuthContext'

// Esto le dice a Expo Router / React Navigation que no muestre
// el header automático (ni la flecha ni el texto "index")
export const options = {
  headerShown: false,
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <SessionProvider>
      <ChatScreen />
    </SessionProvider>
  )
}

export default function Index() {
  return <AppContent />
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
})