// components/MessageBubble.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface MessageBubbleProps {
  message: string;
  isUser: boolean;
  isLoading?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isUser, isLoading = false }) => {
  // Referencias para las animaciones de los puntos
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  
  // Efecto para la animación de los puntos
  useEffect(() => {
    if (!isLoading) return;
    
    const createAnimation = (dot: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(dot, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: true,
        }),
      ]);
    };
    
    const animation = Animated.loop(
      Animated.parallel([
        createAnimation(dot1, 0),
        createAnimation(dot2, 300),
        createAnimation(dot3, 600),
      ])
    );
    
    animation.start();
    
    return () => {
      animation.stop();
    };
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={[
        styles.bubbleContainer, 
        styles.botBubbleContainer
      ]}>
        <View style={[
          styles.bubble,
          styles.botBubble
        ]}>
          <View style={styles.dotsContainer}>
            <Animated.View style={[styles.dot, { opacity: dot1 }]} />
            <Animated.View style={[styles.dot, { opacity: dot2 }]} />
            <Animated.View style={[styles.dot, { opacity: dot3 }]} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.bubbleContainer, 
      isUser ? styles.userBubbleContainer : styles.botBubbleContainer
    ]}>
      <View style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.botBubble
      ]}>
        <Text style={isUser ? styles.userText : styles.botText}>
          {message}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bubbleContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  userBubbleContainer: {
    alignSelf: 'flex-end',
  },
  botBubbleContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  userBubble: {
    backgroundColor: '#DCEFFF',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#E8ECF3',
    borderBottomLeftRadius: 4,
  },
  userText: {
    color: 'black',
    fontSize: 16,
  },
  botText: {
    color: 'black',
    fontSize: 16,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 30, // Altura para los puntos grandes
  },
  dot: {
    width: 12, // tamaño de Puntos de loading
    height: 12, // tamaño de Puntos de loading
    borderRadius: 7,
    backgroundColor: '#333',
    marginHorizontal: 4, //espacio entre puntos
  },
});

export default MessageBubble;