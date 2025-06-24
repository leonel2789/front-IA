// app/index.tsx
import React from 'react'
import ChatScreen from '../screens/ChatScreen'

// Esto le dice a Expo Router / React Navigation que no muestre
// el header automático (ni la flecha ni el texto "index")
export const options = {
  headerShown: false,
}

export default function Index() {
  return <ChatScreen />
}
