import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, BOLD_STYLES } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import { Ionicons } from '@expo/vector-icons';

interface IdentityFact {
  id: string;
  category: string;
  fact: string;
  timestamp: string;
}

export default function MemoryScreen() {
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [identity, setIdentity] = useState<{ [key: string]: IdentityFact[] }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({
    FACT: true,
    PREFERENCE: true,
    GOAL: true,
    PERSON: true,
  });
  const [personnelDossiers, setPersonnelDossiers] = useState<{ [personName: string]: string[] }>({});

  const isMobile = screenWidth < 768;

  const loadIdentity = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/memory/identity?user_id=${user.id}`);
      const data = await res.json();
      
      if (data.success) {
        setIdentity(data.identity || {});
        
        // Process PERSON memories into dossiers
        const personelMemories = data.identity?.PERSON || [];
        const dossiers: { [personName: string]: string[] } = {};
        
        personelMemories.forEach((memory: IdentityFact) => {
          // Parse "PersonName :: Fact" format
          const [personName, ...factParts] = memory.fact.split('::');
          if (personName && factParts.length > 0) {
            const cleanPersonName = personName.trim();
            const cleanFact = factParts.join('::').trim();
            
            if (!dossiers[cleanPersonName]) {
              dossiers[cleanPersonName] = [];
            }
            dossiers[cleanPersonName].push(cleanFact);
          }
        });
        
        setPersonnelDossiers(dossiers);
      } else {
        console.error("Failed to load identity", data.error);
        Alert.alert('SYSTEM_ERR', 'Failed to load neural matrix.');
      }
    } catch (e: any) {
      console.error("Identity load error", e);
      Alert.alert('SYSTEM_ERR', 'Backend connection severed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadIdentity();
    }, [loadIdentity])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadIdentity();
  }, [loadIdentity]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const deleteFact = async (factId: string, category: string) => {
    Alert.alert('DELETE MEMORY', 'Remove this fact permanently?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            const res = await fetch(`${BACKEND_URL}/api/memory/identity/${factId}?user_id=${user?.id}`, {
              method: 'DELETE',
            });
            const data = await res.json();
            if (data.success) {
              await loadIdentity();
            }
          } catch (e: any) {
            console.error("Failed to delete fact", e);
            Alert.alert('SYSTEM_ERR', 'Backend connection severed. Fact deletion failed.');
          }
        },
      },
    ]);
  };

  const compileArchives = async () => {
    if (!user?.id) return;
    
    setIsCompiling(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/memory/compile?user_id=${user.id}`, {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.success) {
        await loadIdentity();
        Alert.alert('ARCHIVES COMPILED', `Extracted ${data.facts_extracted} new facts from chat history`);
      } else {
        Alert.alert('ERROR', data.error || 'Failed to compile archives');
      }
    } catch (e: any) {
      console.error("Compile archives error", e);
      Alert.alert('SYSTEM_ERR', 'Backend connection severed. Archive compilation failed.');
    } finally {
      setIsCompiling(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'FACT': return 'document-text';
      case 'PREFERENCE': return 'heart';
      case 'GOAL': return 'target';
      case 'PERSON': return 'people';
      default: return 'cube';
    }
  };

  const categoryOrder = ['FACT', 'PREFERENCE', 'GOAL'];
  const orderedCategories = categoryOrder.filter(cat => Object.keys(identity).includes(cat));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NEURAL /</Text>
        <Text style={styles.headerHighlight}>MATRIX</Text>
      </View>

      {/* Compile Archives Button */}
      <TouchableOpacity
        style={[
          styles.compileButton,
          isCompiling && styles.compileButtonActive,
        ]}
        onPress={compileArchives}
        disabled={isCompiling}
        activeOpacity={0.9}
      >
        <Text style={[
          styles.compileButtonText,
          isCompiling && styles.compileButtonTextActive,
        ]}>
          {isCompiling ? '[ PROCESSING_NEURAL_DATA... ]' : '[ COMPILE_ARCHIVES ]'}
        </Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00FF66" />
          <Text style={styles.loadingText}>[ INITIALIZING_MEMORY_FABRIC... ]</Text>
        </View>
      ) : orderedCategories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>NO MEMORIES_RECORDED</Text>
          <Text style={styles.emptySubtext}>Facts will appear here as you chat</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00FF66" />}
        >
          {orderedCategories.map((category) => (
            <View key={category} style={styles.categorySection}>
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => toggleCategory(category)}
              >
                <View style={styles.categoryLabelContainer}>
                  <Ionicons name={getCategoryIcon(category) as any} size={16} color="#00FF66" />
                  <Text style={styles.categoryTitle}>{category}</Text>
                  <Text style={styles.factCount}>[{identity[category]?.length || 0}]</Text>
                </View>
                <Ionicons
                  name={expandedCategories[category] ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#00FF66"
                />
              </TouchableOpacity>

              {expandedCategories[category] && (
                <View style={styles.factsContainer}>
                  {identity[category]?.map((fact, idx) => (
                    <View key={fact.id} style={styles.factNode}>
                      <View style={styles.factContent}>
                        <View style={styles.factMeta}>
                          <Text style={styles.factIndex}>[{idx + 1}]</Text>
                          <Text style={styles.factTime}>{new Date(fact.timestamp).toLocaleDateString()}</Text>
                        </View>
                        <Text style={styles.factText}>{fact.fact}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => deleteFact(fact.id, category)}
                      >
                        <Ionicons name="trash" size={14} color="#FF2C55" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          {/* Personnel Archives Section */}
          {Object.keys(personnelDossiers).length > 0 && (
            <View style={styles.personnelSection}>
              <View style={styles.personnelHeader}>
                <Text style={styles.personnelTitle}>[ PERSONNEL_ARCHIVES ]</Text>
                <Text style={styles.personnelCount}>[{Object.keys(personnelDossiers).length}]</Text>
              </View>
              
              <View style={styles.dossiersContainer}>
                {Object.entries(personnelDossiers).map(([personName, facts]) => (
                  <View key={personName} style={styles.dossierCard}>
                    <View style={styles.dossierCardHeader}>
                      <Text style={styles.dossierTitle}>[ DOSSIER: {personName.toUpperCase()} ]</Text>
                      <Text style={styles.dossierCount}>[{facts.length}]</Text>
                    </View>
                    
                    <View style={styles.dossierFacts}>
                      {facts.map((fact, idx) => (
                        <View key={idx} style={styles.dossierFactRow}>
                          <Text style={styles.dossierFactPrefix}>&gt; </Text>
                          <Text style={styles.dossierFactText}>{fact}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* System Stats */}
          <View style={styles.statsSection}>
            <Text style={styles.statsTitle}>SYSTEM_TELEMETRY</Text>
            <View style={styles.statCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>TOTAL_MEMORIES</Text>
                <Text style={styles.statValue}>
                  {Object.values(identity).flat().length}
                </Text>
              </View>
              <View style={[styles.statRow, { borderTopWidth: 1, borderTopColor: '#1a1a1a', marginTop: 12, paddingTop: 12 }]}>
                <Text style={styles.statLabel}>PROFILE_COMPLETENESS</Text>
                <Text style={styles.statValue}>
                  {Object.keys(identity).length > 0 ? '████████░░' : '░░░░░░░░░░'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

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

  compileButton: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#00FF66',
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  compileButtonActive: {
    backgroundColor: '#00FF66',
    borderColor: '#000000',
  },

  compileButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#00FF66',
    letterSpacing: 2,
    fontFamily: 'Courier',
  },

  compileButtonTextActive: {
    color: '#000000',
  },

  content: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 16,
    fontFamily: 'Courier',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  emptyText: {
    color: '#666666',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: 8,
  },

  emptySubtext: {
    color: '#444444',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: 'Courier',
  },

  /* Category Section */
  categorySection: {
    borderBottomWidth: 1,
    borderColor: '#1a1a1a',
  },

  categoryHeader: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#0A0A0A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: '#1a1a1a',
  },

  categoryLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  categoryTitle: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 2,
    fontFamily: 'Courier',
  },

  factCount: {
    color: '#666666',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
  },

  factsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },

  factNode: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  factContent: {
    flex: 1,
    marginRight: 12,
  },

  factMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },

  factIndex: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: 'Courier',
  },

  factTime: {
    color: '#666666',
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.5,
    fontFamily: 'Courier',
  },

  factText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Courier',
    letterSpacing: 0.3,
  },

  deleteBtn: {
    padding: 12,
  },

  /* Personnel Archives Section */
  personnelSection: {
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#1a1a1a',
    marginVertical: 12,
  },

  personnelHeader: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#0A0A0A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: '#1a1a1a',
  },

  personnelTitle: {
    color: '#FF2C55',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 2,
    fontFamily: 'Courier',
  },

  personnelCount: {
    color: '#666666',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
  },

  dossiersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },

  dossierCard: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    overflow: 'hidden',
  },

  dossierCardHeader: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#1a1a1a',
  },

  dossierTitle: {
    color: '#FF2C55',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.5,
    fontFamily: 'Courier',
  },

  dossierCount: {
    color: '#666666',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1,
  },

  dossierFacts: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },

  dossierFactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  dossierFactPrefix: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 11,
    fontFamily: 'Courier',
    marginRight: 6,
  },

  dossierFactText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Courier',
    letterSpacing: 0.3,
    flex: 1,
  },

  /* Statistics Section */
  statsSection: {
    padding: 24,
    marginTop: 12,
    borderTopWidth: 2,
    borderColor: '#1a1a1a',
  },

  statsTitle: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 16,
    textTransform: 'uppercase',
  },

  statCard: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    padding: 20,
  },

  statRow: {
    marginBottom: 12,
  },

  statLabel: {
    color: '#666666',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  statValue: {
    color: '#00FF66',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
    fontFamily: 'Courier',
  },
});
