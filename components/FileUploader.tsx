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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { AI_AGENTS, UserRole } from '../config';
import googleDriveService from '../services/googleDriveService';

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

  const currentRole = userRoles[0] || 'ia-general';
  const agentInfo = AI_AGENTS[currentRole];

  useEffect(() => {
    if (visible) {
      checkGoogleDriveAuth();
      // Reset upload state when modal opens
      setUploadComplete(false);
      setUploadResults({successful: 0, total: 0});
    }
  }, [visible]);

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

    setUploading(true);
    const newProgress: { [key: string]: boolean } = {};
    
    try {
      for (const file of selectedFiles) {
        const fileKey = file.name;
        newProgress[fileKey] = false;
        setUploadProgress({ ...newProgress });

        try {
          const success = await googleDriveService.uploadFile({
            fileUri: file.uri,
            fileName: file.name,
            mimeType: file.mimeType,
            agentRole: currentRole,
          });

          if (success) {
            newProgress[fileKey] = true;
          } else {
            throw new Error('Upload failed');
          }
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          Alert.alert('Error', `No se pudo subir el archivo ${file.name}`);
        }

        setUploadProgress({ ...newProgress });
      }

      const successCount = Object.values(newProgress).filter(Boolean).length;
      
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
      onClose();
    }
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