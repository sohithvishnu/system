import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions, TextInput, Platform, Modal, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONT, FONT_FAMILY, SPACE, RADIUS } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, PageHeader, Section, Card, GhostButton } from '../../components/ui';
import { scale } from '../../utils/responsive';

export default function SettingsScreen() {
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [models, setModels] = useState<string[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Prompt management state
  const [prompts, setPrompts] = useState<any[]>([]);
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptContent, setNewPromptContent] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptsLoading, setPromptsLoading] = useState(false);

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
      setError('SYSTEM_ERR: Backend connection severed.');
      Alert.alert('SYSTEM_ERR', 'Could not fetch available AI models.');
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

  // Load custom prompts from backend
  const loadPrompts = useCallback(async () => {
    if (!user?.id) return;
    setPromptsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/prompts?user_id=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setPrompts(data.prompts);
        const active = data.prompts.find((p: any) => p.is_active);
        if (active) {
          setActivePromptId(active.id);
        }
      }
    } catch (e: any) {
      console.error("Failed to load prompts", e);
      Alert.alert('SYSTEM_ERR', 'Backend connection severed. Could not load custom prompts.');
    } finally {
      setPromptsLoading(false);
    }
  }, [user?.id]);

  const createNewPrompt = useCallback(async () => {
    if (!newPromptName.trim() || !newPromptContent.trim() || !user?.id) {
      Alert.alert('ERROR', 'Name and content required');
      return;
    }
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/prompts?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPromptName.trim(), content: newPromptContent.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('SUCCESS', 'Prompt created');
        setNewPromptName('');
        setNewPromptContent('');
        setShowCreateModal(false);
        await loadPrompts();
      } else {
        Alert.alert('ERROR', data.error || 'Failed to create prompt');
      }
    } catch (e: any) {
      console.error("Failed to create prompt", e);
      Alert.alert('SYSTEM_ERR', 'Backend connection severed. Could not create prompt.');
    }
  }, [newPromptName, newPromptContent, user?.id, loadPrompts]);

  const deletePrompt = useCallback(async (promptId: string) => {
    if (!user?.id) return;
    
    Alert.alert('DELETE PROMPT', 'Are you sure?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            const res = await fetch(`${BACKEND_URL}/api/prompts/${promptId}?user_id=${user.id}`, {
              method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
              await loadPrompts();
            }
          } catch (e: any) {
            console.error("Failed to delete prompt", e);
            Alert.alert('SYSTEM_ERR', 'Backend connection severed. Could not delete prompt.');
          }
        },
      },
    ]);
  }, [user?.id, loadPrompts]);

  const activatePrompt = useCallback(async (promptId: string) => {
    if (!user?.id) return;
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/prompts/${promptId}/activate?user_id=${user.id}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setActivePromptId(promptId);
        // Save to AsyncStorage for quick access in chat
        const prompt = prompts.find(p => p.id === promptId);
        if (prompt) {
          await AsyncStorage.setItem('@system_custom_prompt', prompt.content);
        }
        await loadPrompts();
      }
    } catch (e: any) {
      Alert.alert('ERROR', 'Failed to activate prompt');
    }
  }, [user?.id, prompts, loadPrompts]);

  const selectModel = async (modelName: string) => {
    try {
      await AsyncStorage.setItem('@system_active_model', modelName);
      setActiveModel(modelName);
    } catch (e: any) {
      console.error("Failed to save model selection", e);
      Alert.alert('Error', 'Failed to save model selection');
    }
  };

  // Open documentation in browser
  const openDocumentation = async () => {
    try {
      const docsUrl = 'http://localhost:8001';
      const canOpen = await Linking.canOpenURL(docsUrl);
      if (canOpen) {
        await Linking.openURL(docsUrl);
      } else {
        Alert.alert('ERROR', 'Cannot open documentation URL');
      }
    } catch (e: any) {
      console.error("Failed to open documentation", e);
      Alert.alert('ERROR', 'Failed to open documentation');
    }
  };



  useFocusEffect(
    useCallback(() => {
      fetchModels();
      loadActiveModel();
      loadPrompts();
    }, [fetchModels, loadActiveModel, loadPrompts])
  );

  return (
    <Screen>
      <PageHeader title="settings" subtitle="~/config" />

      <ScrollView contentContainerStyle={{ paddingBottom: SPACE.lg }}>
        {/* CONNECTION SECTION */}
        <Section label="connection">
          <Card style={styles.urlInputContainer}>
            <TextInput
              style={styles.urlInput}
              value={BACKEND_URL}
              editable={false}
              placeholderTextColor={COLORS.textMuted}
            />
          </Card>
          
          <GhostButton 
            label="test connection" 
            onPress={() => {
              Alert.alert('Connection Test', `Backend: ${BACKEND_URL}`);
            }}
            style={{ marginBottom: SPACE.md }}
          />
          
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: COLORS.accent }]} />
            <Text style={styles.statusText}>connected</Text>
          </View>
        </Section>

        {/* MODEL SECTION */}
        <Section label="model">
          {activeModel && (
            <Card style={styles.currentModelPill}>
              <View style={styles.modelPillContent}>
                <View style={styles.modelDot} />
                <Text style={styles.modelPillText}>{activeModel}</Text>
              </View>
            </Card>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={COLORS.accent} />
              <Text style={styles.loadingText}>fetching models...</Text>
            </View>
          ) : error ? (
            <Card style={styles.errorBlock}>
              <Text style={styles.errorTitle}>connection failed</Text>
              <Text style={styles.errorMessage}>{error}</Text>
            </Card>
          ) : models.length === 0 ? (
            <Card style={styles.emptyBlock}>
              <Text style={styles.emptyText}>no models available</Text>
            </Card>
          ) : (
            <View style={styles.modelsGrid}>
              {models.map((model) => (
                <Card
                  key={model}
                  style={[
                    styles.modelCard,
                    activeModel === model && styles.modelCardActive
                  ]}
                  onPress={() => selectModel(model)}
                >
                  <View style={styles.modelCardContent}>
                    <Text style={[
                      styles.modelName,
                      activeModel === model && styles.modelNameActive
                    ]}>
                      {model}
                    </Text>
                    {activeModel === model && (
                      <Feather name="check" size={FONT.md} color={COLORS.accent} />
                    )}
                  </View>
                </Card>
              ))}
            </View>
          )}
        </Section>

        {/* APPEARANCE SECTION */}
        <Section label="appearance">
          <Card style={styles.promptContainer}>
            <TextInput
              style={styles.promptTextarea}
              placeholder="custom ai directives (monospace, optional)"
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
              numberOfLines={4}
            />
          </Card>
        </Section>

        {/* DATA SECTION */}
        <Section label="data">
          <GhostButton 
            label="clear cache" 
            onPress={() => Alert.alert('Clear Cache', 'Cache cleared')}
            style={{ marginBottom: SPACE.md }}
          />
          <GhostButton 
            label="clear history" 
            onPress={() => Alert.alert('Clear History', 'History cleared')}
            danger
          />
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // CONNECTION SECTION
  urlInputContainer: {
    marginBottom: SPACE.md,
  },
  urlInput: {
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.textPrimary,
  },

  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.textSecondary,
  },

  // MODEL SECTION
  currentModelPill: {
    marginBottom: SPACE.md,
    backgroundColor: COLORS.surface,
  },
  modelPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  modelDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.accent,
  },
  modelPillText: {
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.textPrimary,
  },

  loadingContainer: {
    paddingVertical: SPACE.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.md,
  },
  loadingText: {
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.textSecondary,
  },

  errorBlock: {
    backgroundColor: 'rgba(255, 44, 85, 0.06)',
    borderColor: COLORS.danger,
    padding: SPACE.md,
  },
  errorTitle: {
    color: COLORS.danger,
    fontWeight: '600',
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    marginBottom: SPACE.xs,
  },
  errorMessage: {
    color: COLORS.textSecondary,
    fontWeight: '400',
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
  },

  emptyBlock: {
    paddingVertical: SPACE.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT.sm,
  },

  modelsGrid: {
    gap: SPACE.md,
  },
  modelCard: {
    marginBottom: SPACE.sm,
  },
  modelCardActive: {
    backgroundColor: COLORS.accentTint,
    borderColor: 'rgba(0,255,102,0.18)',
  },
  modelCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelName: {
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  modelNameActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },

  // APPEARANCE SECTION
  promptContainer: {
    padding: 0,
  },
  promptTextarea: {
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.textSecondary,
    padding: SPACE.md,
    minHeight: scale(100),
    lineHeight: FONT.md * 1.6,
  },
});
