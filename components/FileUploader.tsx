import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { AI_AGENTS, UserRole } from '../config';
import googleDriveService from '../services/googleDriveService';
import uploadHistoryService, { UploadSession, UploadHistoryItem } from '../services/uploadHistoryService';

interface FileUploadItem {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

interface FileUploaderProps {
  visible: boolean;
  onClose: () => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ visible, onClose }) => {
  const { userRoles } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<FileUploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: boolean }>({});
  const [driveAuthenticated, setDriveAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadResults, setUploadResults] = useState<{successful: number, total: number}>({successful: 0, total: 0});
  const [showHistory, setShowHistory] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<UploadSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const currentRole = userRoles[0] || 'ia-general';
  const agentInfo = AI_AGENTS[currentRole];

  useEffect(() => {
    if (visible) {
      checkGoogleDriveAuth();
      loadUploadHistory();
      // Reset upload state when modal opens
      setUploadComplete(false);
      setUploadResults({successful: 0, total: 0});
    }
  }, [visible]);

  const loadUploadHistory = async () => {
    try {
      const history = await uploadHistoryService.getHistory();
      setUploadHistory(history);
    } catch (error) {
      console.error('Error loading upload history:', error);
    }
  };

  const checkGoogleDriveAuth = async () => {
    setCheckingAuth(true);
    try {
      const isAuth = await googleDriveService.isAuthenticated();
      setDriveAuthenticated(isAuth);
    } catch (error) {
      console.error('Error checking Google Drive auth:', error);
      setDriveAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const authenticateGoogleDrive = async () => {
    try {
      setCheckingAuth(true);
      const success = await googleDriveService.authenticate();
      if (success) {
        setDriveAuthenticated(true);
        // No mostramos alert, el estado visual ya indica la conexión
      } else {
        Alert.alert('Error', 'No se pudo conectar a Google Drive');
      }
    } catch (error) {
      console.error('Google Drive auth error:', error);
      Alert.alert('Error', 'Error al conectar con Google Drive');
    } finally {
      setCheckingAuth(false);
    }
  };

  const pickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const newFiles = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/octet-stream',
          size: asset.size || 0,
        }));
        
        setSelectedFiles(prev => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error('Error picking files:', error);
      Alert.alert('Error', 'No se pudieron seleccionar los archivos');
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) {
      Alert.alert('Aviso', 'No hay archivos seleccionados para subir');
      return;
    }

    if (!driveAuthenticated) {
      Alert.alert('Error', 'Primero debes conectar con Google Drive');
      return;
    }

    // Verificar tamaños de archivo antes de subir
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const oversizedFiles = selectedFiles.filter(file => file.size > MAX_FILE_SIZE);

    if (oversizedFiles.length > 0) {
      Alert.alert(
        'Archivos muy grandes',
        `Los siguientes archivos superan el límite de 50MB:\n${oversizedFiles.map(f => f.name).join('\n')}\n\nPor favor, selecciona archivos más pequeños.`
      );
      return;
    }

    setUploading(true);
    const newProgress: { [key: string]: boolean } = {};

    // Crear nueva sesión de historial
    const sessionId = uploadHistoryService.generateSessionId();
    setCurrentSessionId(sessionId);
    const newSession: UploadSession = {
      id: sessionId,
      date: new Date(),
      agentRole: currentRole,
      totalFiles: selectedFiles.length,
      successCount: 0,
      errorCount: 0,
      items: []
    };

    try {
      // Guardar sesión inicial
      await uploadHistoryService.saveSession(newSession);

      // Subida paralela con límite de concurrencia
      const CONCURRENT_UPLOADS = 3;
      let uploadIndex = 0;
      const uploadResults: Promise<{name: string, success: boolean, error?: string}>[] = [];

      const uploadFile = async (file: FileUploadItem): Promise<{name: string, success: boolean, error?: string}> => {
        const fileKey = file.name;
        newProgress[fileKey] = false;
        setUploadProgress({ ...newProgress });

        const startTime = Date.now();
        const historyItem: UploadHistoryItem = {
          id: uploadHistoryService.generateItemId(),
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.mimeType,
          agentRole: currentRole,
          status: 'pending',
          timestamp: new Date()
        };

        try {
          const success = await googleDriveService.uploadFile({
            fileUri: file.uri,
            fileName: file.name,
            mimeType: file.mimeType,
            agentRole: currentRole,
          });

          const uploadDuration = Date.now() - startTime;
          historyItem.status = success ? 'success' : 'error';
          historyItem.uploadDuration = uploadDuration;

          // Guardar en historial
          await uploadHistoryService.addItemToCurrentSession(historyItem, sessionId);

          newProgress[fileKey] = success;
          setUploadProgress({ ...newProgress });
          return { name: file.name, success };
        } catch (error: any) {
          console.error(`Error uploading ${file.name}:`, error);

          const uploadDuration = Date.now() - startTime;

          // Mensajes de error más específicos
          let errorMessage = `No se pudo subir ${file.name}`;
          if (error.message) {
            if (error.message.includes('Tipo de archivo no permitido')) {
              errorMessage = `Tipo de archivo no permitido`;
            } else if (error.message.includes('demasiado grande')) {
              errorMessage = `Archivo demasiado grande`;
            } else if (error.message.includes('Authentication failed')) {
              errorMessage = 'Sesión expirada';
            } else {
              errorMessage = error.message;
            }
          }

          // Guardar error en historial
          historyItem.status = 'error';
          historyItem.errorMessage = errorMessage;
          historyItem.uploadDuration = uploadDuration;
          await uploadHistoryService.addItemToCurrentSession(historyItem, sessionId);

          Alert.alert('Error', `${file.name}: ${errorMessage}`);
          newProgress[fileKey] = false;
          setUploadProgress({ ...newProgress });
          return { name: file.name, success: false, error: errorMessage };
        }
      };

      // Procesar archivos en lotes
      while (uploadIndex < selectedFiles.length) {
        const batch = selectedFiles.slice(uploadIndex, uploadIndex + CONCURRENT_UPLOADS);
        const batchPromises = batch.map(file => uploadFile(file));
        const batchResults = await Promise.all(batchPromises);
        uploadResults.push(...batchPromises);
        uploadIndex += CONCURRENT_UPLOADS;
      }

      const successCount = Object.values(newProgress).filter(Boolean).length;

      // Recargar historial actualizado
      await loadUploadHistory();

      // Mostrar resultado del upload
      setUploadResults({ successful: successCount, total: selectedFiles.length });
      setUploadComplete(true);

      // Auto-limpiar después de 3 segundos si todos fueron exitosos
      if (successCount === selectedFiles.length) {
        setTimeout(() => {
          resetUploadState();
        }, 3000);
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Error durante la subida de archivos');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadState = () => {
    setSelectedFiles([]);
    setUploadProgress({});
    setUploadComplete(false);
    setUploadResults({successful: 0, total: 0});
  };

  const disconnectGoogleDrive = async () => {
    try {
      await googleDriveService.logout();
      setDriveAuthenticated(false);
      resetUploadState();
    } catch (error) {
      console.error('Error disconnecting Google Drive:', error);
      Alert.alert('Error', 'Error al desconectar de Google Drive');
    }
  };

  const handleClose = () => {
    if (!uploading) {
      resetUploadState();
      setShowHistory(false);
      onClose();
    }
  };

  const renderHistoryItem = ({ item }: { item: UploadHistoryItem }) => (
    <View style={[styles.historyItem, item.status === 'error' && styles.historyItemError]}>
      <MaterialIcons
        name={item.status === 'success' ? 'check-circle' : 'error'}
        size={20}
        color={item.status === 'success' ? '#4CAF50' : '#F44336'}
      />
      <View style={styles.historyItemContent}>
        <Text style={styles.historyItemName} numberOfLines={1}>{item.fileName}</Text>
        <Text style={styles.historyItemDetails}>
          {uploadHistoryService.formatFileSize(item.fileSize)}
          {item.uploadDuration && ` • ${uploadHistoryService.formatDuration(item.uploadDuration)}`}
        </Text>
        {item.errorMessage && (
          <Text style={styles.historyItemErrorText}>{item.errorMessage}</Text>
        )}
      </View>
    </View>
  );

  const renderSession = ({ item }: { item: UploadSession }) => {
    const isExpanded = expandedSession === item.id;
    const agentInfo = AI_AGENTS[item.agentRole];

    return (
      <View style={styles.sessionContainer}>
        <TouchableOpacity
          style={styles.sessionHeader}
          onPress={() => setExpandedSession(isExpanded ? null : item.id)}
        >
          <View style={styles.sessionInfo}>
            <View style={[styles.sessionAgentBadge, { backgroundColor: agentInfo.lightColor }]}>
              <Text style={[styles.sessionAgentText, { color: agentInfo.color }]}>
                {agentInfo.shortName}
              </Text>
            </View>
            <View>
              <Text style={styles.sessionDate}>
                {item.date.toLocaleDateString()} {item.date.toLocaleTimeString()}
              </Text>
              <Text style={styles.sessionStats}>
                {item.successCount} exitosos, {item.errorCount} errores de {item.totalFiles} archivos
              </Text>
            </View>
          </View>
          <MaterialIcons
            name={isExpanded ? 'expand-less' : 'expand-more'}
            size={24}
            color="#666"
          />
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.sessionItems}>
            {item.items.map((historyItem) => (
              <View key={historyItem.id}>
                {renderHistoryItem({ item: historyItem })}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'picture-as-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'description';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'table-chart';
    if (mimeType.includes('image')) return 'image';
    if (mimeType.includes('text')) return 'text-snippet';
    return 'insert-drive-file';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={[agentInfo.color, agentInfo.borderColor]}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <MaterialIcons name={agentInfo.icon as any} size={24} color="white" />
              <Text style={styles.headerTitle}>Subir Archivos</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>
            Los archivos se subirán a: {agentInfo.name}
          </Text>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Google Drive Connection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conexión a Google Drive</Text>
            {checkingAuth ? (
              <View style={styles.authStatus}>
                <ActivityIndicator size="small" color={agentInfo.color} />
                <Text style={styles.authStatusText}>Verificando conexión...</Text>
              </View>
            ) : driveAuthenticated ? (
              <View style={[styles.authStatus, styles.authConnected]}>
                <View style={styles.connectedInfo}>
                  <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
                  <Text style={[styles.authStatusText, { color: '#4CAF50' }]}>
                    ✅ Conectado a Google Drive
                  </Text>
                  <View style={styles.connectedBadge}>
                    <Text style={styles.connectedBadgeText}>LISTO</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.disconnectButton}
                  onPress={disconnectGoogleDrive}
                >
                  <MaterialIcons name="logout" size={14} color="#666" />
                  <Text style={styles.disconnectButtonText}>Desconectar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.authDisconnected}>
                <MaterialIcons name="cloud-off" size={20} color="#F44336" />
                <Text style={[styles.authStatusText, { color: '#F44336' }]}>
                  No conectado a Google Drive
                </Text>
                <TouchableOpacity 
                  style={[styles.connectButton, { backgroundColor: agentInfo.color }]}
                  onPress={authenticateGoogleDrive}
                  disabled={checkingAuth}
                >
                  {checkingAuth ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <MaterialIcons name="cloud" size={16} color="white" />
                      <Text style={styles.connectButtonText}>Conectar a Drive</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* File Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seleccionar Archivos</Text>
            <TouchableOpacity
              style={[styles.selectButton, { borderColor: agentInfo.borderColor }]}
              onPress={pickFiles}
              disabled={!driveAuthenticated || uploading}
            >
              <MaterialIcons name="file-upload" size={24} color={agentInfo.color} />
              <Text style={[styles.selectButtonText, { color: agentInfo.color }]}>
                Seleccionar Archivos
              </Text>
            </TouchableOpacity>
          </View>

          {/* Upload Results */}
          {uploadComplete && (
            <View style={styles.section}>
              <View style={[
                styles.uploadResults,
                uploadResults.successful === uploadResults.total 
                  ? { backgroundColor: '#E8F5E8', borderColor: '#4CAF50' }
                  : { backgroundColor: '#FFF3E0', borderColor: '#FF9800' }
              ]}>
                <MaterialIcons 
                  name={uploadResults.successful === uploadResults.total ? 'check-circle' : 'warning'} 
                  size={24} 
                  color={uploadResults.successful === uploadResults.total ? '#4CAF50' : '#FF9800'} 
                />
                <View style={styles.uploadResultsText}>
                  <Text style={[
                    styles.uploadResultsTitle,
                    { color: uploadResults.successful === uploadResults.total ? '#4CAF50' : '#FF9800' }
                  ]}>
                    {uploadResults.successful === uploadResults.total 
                      ? '✓ ¡Subida exitosa!' 
                      : '⚠ Subida parcial'
                    }
                  </Text>
                  <Text style={styles.uploadResultsSubtitle}>
                    {uploadResults.successful} de {uploadResults.total} archivos subidos correctamente
                  </Text>
                  {uploadResults.successful === uploadResults.total && (
                    <Text style={styles.uploadResultsNote}>
                      Los archivos están listos para procesamiento
                    </Text>
                  )}
                </View>
                {uploadResults.successful === uploadResults.total && (
                  <TouchableOpacity 
                    style={styles.resetButton}
                    onPress={resetUploadState}
                  >
                    <Text style={styles.resetButtonText}>Nuevo upload</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Selected Files */}
          {selectedFiles.length > 0 && !uploadComplete && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Archivos Seleccionados ({selectedFiles.length})
              </Text>
              {selectedFiles.map((file, index) => (
                <View key={index} style={styles.fileItem}>
                  <View style={styles.fileInfo}>
                    <MaterialIcons 
                      name={getFileIcon(file.mimeType) as any} 
                      size={24} 
                      color={agentInfo.color} 
                    />
                    <View style={styles.fileDetails}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={styles.fileSize}>
                        {formatFileSize(file.size)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.fileActions}>
                    {uploadProgress[file.name] === true && (
                      <View style={styles.uploadSuccess}>
                        <MaterialIcons name="check-circle" size={18} color="#4CAF50" />
                        <Text style={styles.uploadSuccessText}>Subido</Text>
                      </View>
                    )}
                    {uploadProgress[file.name] === false && uploading && (
                      <View style={styles.uploadingStatus}>
                        <ActivityIndicator size="small" color={agentInfo.color} />
                        <Text style={[styles.uploadingText, { color: agentInfo.color }]}>Subiendo...</Text>
                      </View>
                    )}
                    {!uploading && uploadProgress[file.name] !== true && (
                      <TouchableOpacity onPress={() => removeFile(index)} style={styles.removeButton}>
                        <MaterialIcons name="close" size={18} color="#F44336" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Upload Button */}
          {selectedFiles.length > 0 && !uploadComplete && (
            <View style={styles.section}>
              <TouchableOpacity
                style={[
                  styles.uploadButton,
                  { 
                    backgroundColor: driveAuthenticated ? agentInfo.color : '#CCCCCC',
                    opacity: uploading ? 0.7 : 1 
                  }
                ]}
                onPress={uploadFiles}
                disabled={!driveAuthenticated || uploading || selectedFiles.length === 0}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <MaterialIcons name="cloud-upload" size={24} color="white" />
                )}
                <Text style={styles.uploadButtonText}>
                  {uploading ? 'Subiendo...' : `Subir ${selectedFiles.length} archivo(s)`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* History Button */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.historyButton, { borderColor: agentInfo.color }]}
              onPress={() => setShowHistory(!showHistory)}
            >
              <MaterialIcons name="history" size={24} color={agentInfo.color} />
              <Text style={[styles.historyButtonText, { color: agentInfo.color }]}>
                {showHistory ? 'Ocultar Historial' : 'Ver Historial de Subidas'}
              </Text>
              {uploadHistory.length > 0 && (
                <View style={[styles.historyBadge, { backgroundColor: agentInfo.color }]}>
                  <Text style={styles.historyBadgeText}>{uploadHistory.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Upload History */}
          {showHistory && (
            <View style={styles.section}>
              <View style={styles.historyHeader}>
                <Text style={styles.sectionTitle}>Historial de Subidas</Text>
                {uploadHistory.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Limpiar Historial',
                        '¿Estás seguro de que quieres eliminar todo el historial?',
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Eliminar',
                            style: 'destructive',
                            onPress: async () => {
                              await uploadHistoryService.clearHistory();
                              setUploadHistory([]);
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.clearHistoryText}>Limpiar</Text>
                  </TouchableOpacity>
                )}
              </View>
              {uploadHistory.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <MaterialIcons name="history" size={48} color="#CCC" />
                  <Text style={styles.emptyHistoryText}>No hay historial de subidas</Text>
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
          )}

          {/* Info */}
          <View style={styles.infoSection}>
            <MaterialIcons name="info" size={20} color="#666" />
            <Text style={styles.infoText}>
              Los archivos se subirán automáticamente a la carpeta correspondiente del agente{' '}
              <Text style={{ fontWeight: 'bold', color: agentInfo.color }}>
                {agentInfo.name}
              </Text>
              {' '}para su procesamiento.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
  },
  historyButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  historyBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  historyBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  clearHistoryText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '500',
  },
  historyList: {
    maxHeight: 300,
  },
  emptyHistory: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
  },
  emptyHistoryText: {
    marginTop: 10,
    fontSize: 14,
    color: '#999',
  },
  sessionContainer: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionAgentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 10,
  },
  sessionAgentText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  sessionStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sessionItems: {
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyItemError: {
    backgroundColor: '#FFF5F5',
  },
  historyItemContent: {
    marginLeft: 8,
    flex: 1,
  },
  historyItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  historyItemDetails: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  historyItemErrorText: {
    fontSize: 11,
    color: '#F44336',
    marginTop: 2,
    fontStyle: 'italic',
  },
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
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  authStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
  },
  authConnected: {
    backgroundColor: '#E8F5E8',
  },
  authDisconnected: {
    backgroundColor: '#FFEBEE',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  connectedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  connectedBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  connectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 10,
  },
  disconnectButtonText: {
    marginLeft: 4,
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  authStatusText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  connectButton: {
    marginTop: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
    justifyContent: 'center',
  },
  connectButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 5,
  },
  uploadResults: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
  },
  uploadResultsText: {
    flex: 1,
    marginLeft: 10,
  },
  uploadResultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  uploadResultsSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  uploadResultsNote: {
    fontSize: 11,
    color: '#4CAF50',
    fontStyle: 'italic',
  },
  resetButton: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  uploadSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  uploadSuccessText: {
    marginLeft: 4,
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  uploadingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  uploadingText: {
    marginLeft: 6,
    fontSize: 11,
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#FFEBEE',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
  },
  selectButtonText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    marginBottom: 8,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileDetails: {
    marginLeft: 10,
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  fileActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 15,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    marginBottom: 20,
  },
  infoText: {
    marginLeft: 10,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    flex: 1,
  },
});

export default FileUploader;