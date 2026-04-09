import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions, TextInput, Platform, Modal } from 'react-native';
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

  useFocusEffect(
    useCallback(() => {
      fetchModels();
      loadActiveModel();
      loadPrompts();
    }, [fetchModels, loadActiveModel, loadPrompts])
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

        {/* PROMPTS MANAGEMENT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>[ PROMPTS ]</Text>
          <Text style={styles.directiveDescription}>MANAGE_CUSTOM_AI_DIRECTIVES</Text>
          
          {promptsLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>[ LOADING_PROMPTS... ]</Text>
            </View>
          ) : prompts.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyText}>NO_PROMPTS_CREATED</Text>
            </View>
          ) : (
            <View style={styles.promptsList}>
              {prompts.map((prompt) => (
                <View key={prompt.id} style={styles.promptCard}>
                  <TouchableOpacity
                    style={[
                      styles.promptSelect,
                      activePromptId === prompt.id && styles.promptSelectActive,
                    ]}
                    onPress={() => activatePrompt(prompt.id)}
                  >
                    <Text style={[
                      styles.promptName,
                      activePromptId === prompt.id && styles.promptNameActive,
                    ]}>
                      {prompt.name}
                    </Text>
                    {activePromptId === prompt.id && (
                      <Text style={styles.activeIndicator}>[ ACTIVE ]</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => deletePrompt(prompt.id)}
                  >
                    <Text style={styles.deleteBtnText}>DELETE</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createBtnText}>[ + CREATE_PROMPT ]</Text>
          </TouchableOpacity>
        </View>

        {/* CREATE PROMPT MODAL */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showCreateModal}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>CREATE NEW PROMPT</Text>
              
              <Text style={styles.inputLabel}>PROMPT NAME</Text>
              <TextInput
                style={styles.modalInput}
                value={newPromptName}
                onChangeText={setNewPromptName}
                placeholder="e.g., Code Assistant..."
                placeholderTextColor="#555"
              />
              
              <Text style={styles.inputLabel}>PROMPT CONTENT</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={newPromptContent}
                onChangeText={setNewPromptContent}
                placeholder="Define the AI's behavior and instructions..."
                placeholderTextColor="#555"
                multiline
                textAlignVertical="top"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowCreateModal(false);
                    setNewPromptName('');
                    setNewPromptContent('');
                  }}
                >
                  <Text style={styles.cancelBtnText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={createNewPrompt}
                >
                  <Text style={styles.submitBtnText}>CREATE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
    borderRadius: 0,
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
    borderRadius: 0,
    padding: 24,
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
    borderRadius: 0,
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

  /* Directive Input Styles */
  directiveDescription: {
    color: '#888',
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 12,
    fontFamily: 'Courier New',
  },
  directiveInput: {
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Courier New',
    padding: 16,
    minHeight: 150,
    marginBottom: 16,
    fontWeight: '500',
  },
  directiveInputFocused: {
    borderColor: '#00FF66',
    backgroundColor: '#0A0A0A',
  },
  directiveBtn: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#00FF66',
    borderRadius: 0,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  directiveBtnText: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: 'Courier New',
  },

  /* Prompts List */
  promptsList: {
    gap: 10,
    marginBottom: 16,
  },
  promptCard: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promptSelect: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#1a1a1a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promptSelectActive: {
    backgroundColor: '#00FF66',
    borderColor: '#00FF66',
  },
  promptName: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
    fontFamily: 'Courier',
  },
  promptNameActive: {
    color: '#000000',
    fontWeight: '900',
  },
  deleteBtn: {
    backgroundColor: '#FF2C55',
    borderWidth: 2,
    borderColor: '#FF2C55',
    borderRadius: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
  },
  createBtn: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#00FF66',
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  createBtnText: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: 'Courier New',
  },

  /* Modal */
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#000000',
    borderTopWidth: 2,
    borderColor: '#00FF66',
    padding: 20,
    minHeight: 400,
  },
  modalTitle: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
    marginBottom: 20,
  },
  inputLabel: {
    color: '#888',
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
    fontFamily: 'Courier New',
  },
  modalInput: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Courier New',
    padding: 12,
    marginBottom: 4,
  },
  modalTextArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#2C2C2C',
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#888',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#00FF66',
    borderWidth: 2,
    borderColor: '#00FF66',
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
  },
});
