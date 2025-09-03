import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Image,
  Dimensions,
  SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const { login, loading } = useAuth();

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logoPlaceholder}>
              <MaterialCommunityIcons name="scale-balance" size={76} color="#ffffffff" />
            </View>
            <Text style={styles.appName}>Legal RAG</Text>
            <Text style={styles.appDescription}>
              Tu asistente legal inteligente
            </Text>
          </View>

          <View style={styles.loginContainer}>
            <Text style={styles.welcomeText}>Bienvenido</Text>
            <Text style={styles.subtitleText}>
              Inicia sesión para continuar
            </Text>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Powered by Keycloak
            </Text>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: height * 0.1,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
  },
  appDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  loginContainer: {
    alignItems: 'center',
    width: '100%',
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 40,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: 'white',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: width * 0.6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
});