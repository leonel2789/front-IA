import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSession } from '../contexts/SessionContext';
import { ChatSession } from '../services/SessionService';

interface SessionHistoryProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
}

const SessionHistory: React.FC<SessionHistoryProps> = ({
  isVisible,
  onClose,
  onSelectSession,
}) => {
  const { sessions, currentSessionId, deleteSession } = useSession();

  if (!isVisible) return null;

  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    onClose();
  };

  const handleDeleteSession = (session: ChatSession) => {
    Alert.alert(
      'Eliminar conversación',
      `¿Estás seguro de que quieres eliminar "${session.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteSession(session.id),
        },
      ]
    );
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffInDays < 7) {
      return date.toLocaleDateString('es-AR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
      });
    }
  };

  const renderSessionItem = ({ item }: { item: ChatSession }) => {
    const isActive = item.id === currentSessionId;

    return (
      <TouchableOpacity
        style={[styles.sessionItem, isActive && styles.activeSession]}
        onPress={() => handleSelectSession(item.id)}
      >
        <View style={styles.sessionContent}>
          <Text
            style={[styles.sessionName, isActive && styles.activeSessionText]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={styles.sessionDate}>
            {formatDate(item.createdAt)}
          </Text>
          {item.lastMessage ? (
            <Text
              style={[styles.lastMessage, isActive && styles.activeLastMessage]}
              numberOfLines={2}
            >
              {item.lastMessage}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteSession(item)}
        >
          <MaterialCommunityIcons name="delete-outline" size={18} color="#999" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historial de Conversaciones</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={24} color="#444" />
        </TouchableOpacity>
      </View>
      
      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="chat-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No hay conversaciones</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSessionItem}
          keyExtractor={(item) => item.id}
          style={styles.sessionList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#444',
  },
  closeButton: {
    padding: 4,
  },
  sessionList: {
    flex: 1,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activeSession: {
    backgroundColor: '#e8f4fd',
  },
  sessionContent: {
    flex: 1,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  activeSessionText: {
    color: '#007AFF',
  },
  sessionDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  activeLastMessage: {
    color: '#555',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
});

export default SessionHistory;