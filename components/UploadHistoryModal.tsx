import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import uploadHistoryService, { UploadSession, UploadHistoryItem } from '../services/uploadHistoryService';
import googleDriveService from '../services/googleDriveService';
import { AI_AGENTS, UserRole } from '../config';

interface UploadHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  currentRole: UserRole;
}

const UploadHistoryModal: React.FC<UploadHistoryModalProps> = ({
  visible,
  onClose,
  currentRole
}) => {
  const [uploadHistory, setUploadHistory] = useState<UploadSession[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [retryingItem, setRetryingItem] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({});

  const agentInfo = AI_AGENTS[currentRole];

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    try {
      const [history, statistics] = await Promise.all([
        uploadHistoryService.getHistory(),
        uploadHistoryService.getStatsByAgent()
      ]);
      setUploadHistory(history);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading upload data:', error);
    }
  };

  const retryUpload = async (item: UploadHistoryItem) => {
    Alert.alert(
      'Reintentar Subida',
      `¿Quieres volver a subir el archivo "${item.fileName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reintentar',
          onPress: async () => {
            setRetryingItem(item.id);
            try {
              // Nota: Aquí necesitarías el URI original del archivo
              // Para esta implementación, mostramos un mensaje informativo
              Alert.alert(
                'Función no disponible',
                'Para reintentar la subida, por favor selecciona el archivo nuevamente desde el selector de archivos principal.',
                [{ text: 'Entendido' }]
              );
            } catch (error) {
              console.error('Error retrying upload:', error);
              Alert.alert('Error', 'No se pudo reintentar la subida');
            } finally {
              setRetryingItem(null);
            }
          }
        }
      ]
    );
  };

  const deleteSession = async (sessionId: string) => {
    Alert.alert(
      'Eliminar Sesión',
      '¿Estás seguro de que quieres eliminar esta sesión del historial?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await uploadHistoryService.removeSession(sessionId);
            await loadData();
          }
        }
      ]
    );
  };

  const renderHistoryItem = ({ item }: { item: UploadHistoryItem }) => (
    <View style={[styles.historyItem, item.status === 'error' && styles.historyItemError]}>
      <View style={styles.historyItemLeft}>
        <MaterialIcons
          name={item.status === 'success' ? 'check-circle' : item.status === 'error' ? 'error' : 'hourglass-empty'}
          size={20}
          color={item.status === 'success' ? '#4CAF50' : item.status === 'error' ? '#F44336' : '#FF9800'}
        />
        <View style={styles.historyItemContent}>
          <Text style={styles.historyItemName} numberOfLines={1}>{item.fileName}</Text>
          <Text style={styles.historyItemDetails}>
            {uploadHistoryService.formatFileSize(item.fileSize)}
            {item.uploadDuration && ` • ${uploadHistoryService.formatDuration(item.uploadDuration)}`}
            {item.retryCount && item.retryCount > 0 && ` • ${item.retryCount} reintentos`}
          </Text>
          {item.errorMessage && (
            <Text style={styles.historyItemErrorText}>{item.errorMessage}</Text>
          )}
        </View>
      </View>
      {item.status === 'error' && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => retryUpload(item)}
          disabled={retryingItem === item.id}
        >
          <MaterialIcons
            name="refresh"
            size={16}
            color={retryingItem === item.id ? '#CCC' : agentInfo.color}
          />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSession = ({ item }: { item: UploadSession }) => {
    const isExpanded = expandedSession === item.id;
    const sessionAgentInfo = AI_AGENTS[item.agentRole];
    const errorRate = item.totalFiles > 0 ? ((item.errorCount / item.totalFiles) * 100).toFixed(0) : '0';

    return (
      <View style={styles.sessionContainer}>
        <TouchableOpacity
          style={styles.sessionHeader}
          onPress={() => setExpandedSession(isExpanded ? null : item.id)}
        >
          <View style={styles.sessionInfo}>
            <View style={[styles.sessionAgentBadge, { backgroundColor: sessionAgentInfo.lightColor }]}>
              <Text style={[styles.sessionAgentText, { color: sessionAgentInfo.color }]}>
                {sessionAgentInfo.shortName}
              </Text>
            </View>
            <View style={styles.sessionDetails}>
              <Text style={styles.sessionDate}>
                {item.date.toLocaleDateString()} - {item.date.toLocaleTimeString()}
              </Text>
              <Text style={styles.sessionStats}>
                {item.successCount} exitosos, {item.errorCount} errores de {item.totalFiles} archivos
                {item.errorCount > 0 && ` (${errorRate}% errores)`}
              </Text>
            </View>
          </View>
          <View style={styles.sessionActions}>
            <TouchableOpacity
              style={styles.deleteSessionButton}
              onPress={(e) => {
                e.stopPropagation();
                deleteSession(item.id);
              }}
            >
              <MaterialIcons name="delete" size={16} color="#F44336" />
            </TouchableOpacity>
            <MaterialIcons
              name={isExpanded ? 'expand-less' : 'expand-more'}
              size={24}
              color="#666"
            />
          </View>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.sessionItems}>
            <FlatList
              data={item.items}
              renderItem={renderHistoryItem}
              keyExtractor={historyItem => historyItem.id}
              nestedScrollEnabled
            />
          </View>
        )}
      </View>
    );
  };

  const renderStats = () => {
    const currentAgentStats = stats[currentRole];
    if (!currentAgentStats) return null;

    const successRate = currentAgentStats.total > 0
      ? ((currentAgentStats.success / currentAgentStats.total) * 100).toFixed(1)
      : '0';

    return (
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Estadísticas de {agentInfo.name}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{currentAgentStats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{currentAgentStats.success}</Text>
            <Text style={styles.statLabel}>Exitosos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#F44336' }]}>{currentAgentStats.error}</Text>
            <Text style={styles.statLabel}>Errores</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: agentInfo.color }]}>{successRate}%</Text>
            <Text style={styles.statLabel}>Éxito</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={[agentInfo.color, agentInfo.borderColor]}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <MaterialIcons name="history" size={24} color="white" />
              <Text style={styles.headerTitle}>Historial de Subidas</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>
            Registro de archivos subidos a {agentInfo.name}
          </Text>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Stats */}
          {renderStats()}

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: agentInfo.lightColor, borderColor: agentInfo.color }]}
              onPress={loadData}
            >
              <MaterialIcons name="refresh" size={20} color={agentInfo.color} />
              <Text style={[styles.actionButtonText, { color: agentInfo.color }]}>Actualizar</Text>
            </TouchableOpacity>
            {uploadHistory.length > 0 && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#FFEBEE', borderColor: '#F44336' }]}
                onPress={() => {
                  Alert.alert(
                    'Limpiar Historial',
                    '¿Estás seguro de que quieres eliminar todo el historial? Esta acción no se puede deshacer.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Eliminar Todo',
                        style: 'destructive',
                        onPress: async () => {
                          await uploadHistoryService.clearHistory();
                          await loadData();
                        }
                      }
                    ]
                  );
                }}
              >
                <MaterialIcons name="delete-forever" size={20} color="#F44336" />
                <Text style={[styles.actionButtonText, { color: '#F44336' }]}>Limpiar Todo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* History List */}
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Sesiones de Subida</Text>
            {uploadHistory.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="history" size={64} color="#E0E0E0" />
                <Text style={styles.emptyStateText}>No hay historial de subidas</Text>
                <Text style={styles.emptyStateSubtext}>
                  Los archivos que subas aparecerán aquí con detalles de éxito o errores
                </Text>
              </View>
            ) : (
              <FlatList
                data={uploadHistory}
                renderItem={renderSession}
                keyExtractor={item => item.id}
                style={styles.historyList}
                nestedScrollEnabled
              />
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 10,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  historySection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#999',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  historyList: {
    flex: 1,
  },
  sessionContainer: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionAgentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 12,
  },
  sessionAgentText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  sessionDetails: {
    flex: 1,
  },
  sessionDate: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  sessionStats: {
    fontSize: 13,
    color: '#666',
    marginTop: 3,
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteSessionButton: {
    padding: 8,
    marginRight: 8,
  },
  sessionItems: {
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyItemError: {
    backgroundColor: '#FFF8F8',
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  historyItemContent: {
    marginLeft: 10,
    flex: 1,
  },
  historyItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  historyItemDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },
  historyItemErrorText: {
    fontSize: 11,
    color: '#F44336',
    marginTop: 4,
    fontStyle: 'italic',
  },
  retryButton: {
    padding: 8,
    borderRadius: 4,
  },
});

export default UploadHistoryModal;