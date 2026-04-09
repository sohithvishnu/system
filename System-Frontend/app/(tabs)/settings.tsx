import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, BOLD_STYLES } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [models, setModels] = useState<string[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMobile = screenWidth < 768;

  // Fetch models on mount
  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/models`);
      const data = await response.json();
      
      if (data.success) {
        setModels(data.models);
      } else {
        setError(data.error || 'Failed to fetch models');
      }
    } catch (e: any) {
      console.error("Failed to fetch models", e);
      setError('Connection error. Check your backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load active model from storage
  const loadActiveModel = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('@system_active_model');
      if (saved) {
        setActiveModel(saved);
      }
    } catch (e: any) {
      console.error("Failed to load active model", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchModels();
      loadActiveModel();
    }, [fetchModels, loadActiveModel])
  );

  const selectModel = async (modelName: string) => {
    try {
      await AsyncStorage.setItem('@system_active_model', modelName);
      setActiveModel(modelName);
    } catch (e: any) {
      console.error("Failed to save model selection", e);
      Alert.alert('Error', 'Failed to save model selection');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SYSTEM /</Text>
        <Text style={styles.headerHighlight}>CONFIG</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* AI CORE SELECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI_CORE_SELECTION</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>[ FETCHING_NEURAL_CORES... ]</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorTitle}>[ OLLAMA_OFFLINE ]</Text>
              <Text style={styles.errorMessage}>Please run 'ollama serve' on the host machine.</Text>
              <Text style={styles.errorDetail}>{error}</Text>
            </View>
          ) : models.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>NO MODELS AVAILABLE</Text>
            </View>
          ) : (
            <View style={styles.modelsGrid}>
              {models.map((model) => (
                <TouchableOpacity
                  key={model}
                  style={[
                    styles.modelCard,
                    activeModel === model && styles.modelCardActive
                  ]}
                  onPress={() => selectModel(model)}
                >
                  <Text style={[
                    styles.modelName,
                    activeModel === model && styles.modelNameActive
                  ]}>
                    {model}
                  </Text>
                  {activeModel === model && (
                    <Text style={styles.activeIndicator}>[ ACTIVE ]</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* SYSTEM STATUS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SYSTEM_STATUS</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>BACKEND_URL</Text>
              <Text style={styles.statusValue}>{BACKEND_URL}</Text>
            </View>
            <View style={[styles.statusRow, { borderTopWidth: 1, borderTopColor: '#1a1a1a', marginTop: 12, paddingTop: 12 }]}>
              <Text style={styles.statusLabel}>ACTIVE_MODEL</Text>
              <Text style={styles.statusValue}>{activeModel || 'NOT_SELECTED'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderColor: '#1a1a1a',
    backgroundColor: '#000000',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  headerHighlight: {
    fontSize: 28,
    fontWeight: '900',
    color: '#00FF66',
    letterSpacing: -1,
    marginTop: 4,
  },
  content: { flex: 1 },

  /* Sections */
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#1a1a1a',
  },
  sectionTitle: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 2,
    marginBottom: 16,
    textTransform: 'uppercase',
  },

  /* Loading State */
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 2,
  },

  /* Error State */
  errorBlock: {
    backgroundColor: 'rgba(255, 44, 85, 0.08)',
    borderWidth: 2,
    borderColor: '#FF2C55',
    borderRadius: 6,
    padding: 16,
  },
  errorTitle: {
    color: '#FF2C55',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
    marginBottom: 8,
  },
  errorMessage: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 8,
  },
  errorDetail: {
    color: '#999999',
    fontWeight: '700',
    fontSize: 11,
    fontFamily: 'Courier',
  },

  /* Empty State */
  emptyBlock: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666666',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },

  /* Models Grid */
  modelsGrid: {
    gap: 12,
  },
  modelCard: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 6,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelCardActive: {
    backgroundColor: '#00FF66',
    borderColor: '#00FF66',
  },
  modelName: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
    fontFamily: 'Courier',
    flex: 1,
  },
  modelNameActive: {
    color: '#000000',
  },
  activeIndicator: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
    marginLeft: 12,
  },

  /* Status Card */
  statusCard: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 6,
    padding: 16,
  },
  statusRow: {
    marginBottom: 12,
  },
  statusLabel: {
    color: '#666666',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#00FF66',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
    fontFamily: 'Courier',
  },
});
