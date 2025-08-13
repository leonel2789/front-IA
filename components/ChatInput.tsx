// components/ChatInput.tsx
import React, { useState } from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'

interface Props {
  onSend: (text: string) => void
  style?: ViewStyle
  inputStyle?: TextStyle
  buttonStyle?: ViewStyle
}

export default function ChatInput({
  onSend,
  style,
  inputStyle,
  buttonStyle,
}: Props) {
  const [text, setText] = useState('')
  const isDisabled = !text.trim()

  const send = () => {
    if (text.trim()) {
      onSend(text)
      setText('')
    }
  }

  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={[styles.input, inputStyle]}
        value={text}
        onChangeText={setText}
        placeholder="Escribe un mensaje..."
        multiline
      />
      <TouchableOpacity 
        onPress={send} 
        style={[styles.button, isDisabled && styles.buttonDisabled, buttonStyle]}
        disabled={isDisabled}
      >
        <Text style={[styles.buttonText, isDisabled && styles.buttonTextDisabled]}>➤</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
  },
  input: {
    flex: 1,
    fontSize: 16, 
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderRadius: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16, 
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#999',
  },
})
