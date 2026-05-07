import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Alert, useWindowDimensions, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, BOLD_STYLES, FONT, FONT_FAMILY, RADIUS, SPACE } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import { Feather } from '@expo/vector-icons';
import { BlinkingCursor } from '../../components/ui';

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
        const personelMemories = data.identity?.PERSON || [];
        const dossiers: { [personName: string]: string[] } = {};
        personelMemories.forEach((memory: IdentityFact) => {
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
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const deleteFact = async (factId: string, category: string) => {
    Alert.alert('delete memory', 'Remove this fact permanently?', [
      { text: 'cancel', onPress: () => {} },
      {
        text: 'delete',
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
      const res = await fetch(`${BACKEND_URL}/api/memory/compile?user_id=${user.id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await loadIdentity();
        Alert.alert('archives compiled', `Extracted ${data.facts_extracted} new facts from chat history`);
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

  const getCategoryIcon = (category: string): any => {
    switch (category) {
      case 'FACT':       return 'file-text';
      case 'PREFERENCE': return 'heart';
      case 'GOAL':       return 'target';
      case 'PERSON':     return 'users';
      default:           return 'box';
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'FACT':       return COLORS.warning;
      case 'PREFERENCE': return COLORS.purple;
      case 'GOAL':       return COLORS.accent;
      case 'PERSON':     return COLORS.danger;
      default:           return COLORS.info;
    }
  };

  const categoryOrder = ['FACT', 'PREFERENCE', 'GOAL'];
  const orderedCategories = categoryOrder.filter(cat => Object.keys(identity).includes(cat));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>memory</Text>
          <Text style={styles.headerSubtitle}>~/identity</Text>
        </View>
        <TouchableOpacity
          style={[styles.compileButton, isCompiling && styles.compileButtonActive]}
          onPress={compileArchives}
          disabled={isCompiling}
          activeOpacity={0.9}
        >
          {isCompiling ? (
            <BlinkingCursor />
          ) : (
            <>
              <Feather name="cpu" size={FONT.sm} color={COLORS.accent} />
              <Text style={styles.compileButtonText}>compile</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <BlinkingCursor />
          <Text style={styles.loadingText}>loading memory fabric...</Text>
        </View>
      ) : orderedCategories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>$ no memories recorded</Text>
          <Text style={styles.emptySubtext}>facts will appear here as you chat</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: SPACE.xl * 2 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        >
          {orderedCategories.map((category) => {
            const catColor = getCategoryColor(category);
            return (
              <View key={category} style={styles.categorySection}>
                <TouchableOpacity
                  style={styles.categoryHeader}
                  onPress={() => toggleCategory(category)}
                >
                  <View style={styles.categoryLabelContainer}>
                    <Feather name={getCategoryIcon(category)} size={FONT.sm} color={catColor} />
                    <Text style={[styles.categoryTitle, { color: catColor }]}>{category.toLowerCase()}</Text>
                    <Text style={styles.factCount}>{identity[category]?.length || 0}</Text>
                  </View>
                  <Feather
                    name={expandedCategories[category] ? 'chevron-up' : 'chevron-down'}
                    size={FONT.md}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>

                {expandedCategories[category] && (
                  <View style={styles.factsContainer}>
                    {identity[category]?.map((fact, idx) => (
                      <View key={fact.id} style={styles.factNode}>
                        <View style={styles.factContent}>
                          <View style={styles.factMeta}>
                            <Text style={[styles.factIndex, { color: catColor }]}>{idx + 1}</Text>
                            <Text style={styles.factTime}>{new Date(fact.timestamp).toLocaleDateString()}</Text>
                          </View>
                          <Text style={styles.factText}>{fact.fact}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => deleteFact(fact.id, category)}
                        >
                          <Feather name="trash-2" size={FONT.sm} color={COLORS.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {Object.keys(personnelDossiers).length > 0 && (
            <View style={styles.personnelSection}>
              <View style={styles.personnelHeader}>
                <Text style={styles.personnelTitle}>personnel</Text>
                <Text style={styles.personnelCount}>{Object.keys(personnelDossiers).length}</Text>
              </View>
              <View style={styles.dossiersContainer}>
                {Object.entries(personnelDossiers).map(([personName, facts]) => (
                  <View key={personName} style={styles.dossierCard}>
                    <View style={styles.dossierCardHeader}>
                      <Text style={styles.dossierTitle}>{personName.toLowerCase()}</Text>
                      <Text style={styles.dossierCount}>{facts.length}</Text>
                    </View>
                    <View style={styles.dossierFacts}>
                      {facts.map((fact, idx) => (
                        <View key={idx} style={styles.dossierFactRow}>
                          <Text style={styles.dossierFactPrefix}>›</Text>
                          <Text style={styles.dossierFactText}>{fact}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.statsSection}>
            <Text style={styles.statsTitle}>telemetry</Text>
            <View style={styles.statCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>total memories</Text>
                <Text style={styles.statValue}>{Object.values(identity).flat().length}</Text>
              </View>
              <View style={[styles.statRow, { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: SPACE.sm, paddingTop: SPACE.sm }]}>
                <Text style={styles.statLabel}>profile completeness</Text>
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: FONT.xxl, fontWeight: '500', color: COLORS.textPrimary, fontFamily: FONT_FAMILY.sans },
  headerSubtitle: { fontSize: FONT.md, color: COLORS.textMuted, fontFamily: FONT_FAMILY.mono, marginTop: 2 },

  compileButton: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    backgroundColor: COLORS.accentTint,
    borderWidth: 1, borderColor: 'rgba(0,255,102,0.18)',
    borderRadius: RADIUS.sm, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md,
  },
  compileButtonActive: { backgroundColor: COLORS.surface },
  compileButtonText: { fontSize: FONT.md, fontWeight: '500', color: COLORS.accent, fontFamily: FONT_FAMILY.mono },

  content: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE.md },
  loadingText: { color: COLORS.textMuted, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.xl },
  emptyText: { color: COLORS.textMuted, fontSize: FONT.base, fontFamily: FONT_FAMILY.mono, marginBottom: SPACE.xs },
  emptySubtext: { color: COLORS.textGhost, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono, textAlign: 'center' },

  categorySection: { borderBottomWidth: 1, borderColor: COLORS.border },
  categoryHeader: {
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg,
    backgroundColor: COLORS.surfaceAlt,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderColor: COLORS.border,
  },
  categoryLabelContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  categoryTitle: { fontSize: FONT.sm, fontWeight: '500', fontFamily: FONT_FAMILY.mono },
  factCount: { color: COLORS.textGhost, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },

  factsContainer: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, gap: SPACE.sm },
  factNode: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.md, padding: SPACE.sm,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  factContent: { flex: 1, marginRight: SPACE.sm },
  factMeta: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.xs },
  factIndex: { fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  factTime: { color: COLORS.textGhost, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  factText: { color: COLORS.textSecondary, fontSize: FONT.md, lineHeight: FONT.md * 1.5, fontFamily: FONT_FAMILY.sans },
  deleteBtn: { padding: SPACE.sm },

  personnelSection: {
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, marginVertical: SPACE.sm,
  },
  personnelHeader: {
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg,
    backgroundColor: COLORS.surfaceAlt,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderColor: COLORS.border,
  },
  personnelTitle: { color: COLORS.danger, fontSize: FONT.sm, fontWeight: '500', fontFamily: FONT_FAMILY.mono },
  personnelCount: { color: COLORS.textGhost, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  dossiersContainer: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, gap: SPACE.sm },
  dossierCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.md, overflow: 'hidden',
  },
  dossierCardHeader: {
    paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md,
    backgroundColor: COLORS.surfaceAlt,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderColor: COLORS.border,
  },
  dossierTitle: { color: COLORS.danger, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono, fontWeight: '500' },
  dossierCount: { color: COLORS.textGhost, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  dossierFacts: { paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md, gap: SPACE.xs },
  dossierFactRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dossierFactPrefix: { color: COLORS.accent, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono, marginRight: SPACE.sm, marginTop: 1 },
  dossierFactText: { color: COLORS.textSecondary, fontSize: FONT.md, lineHeight: FONT.md * 1.5, fontFamily: FONT_FAMILY.sans, flex: 1 },

  statsSection: { padding: SPACE.lg, marginTop: SPACE.sm, borderTopWidth: 1, borderColor: COLORS.border },
  statsTitle: { color: COLORS.textMuted, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono, fontWeight: '500', marginBottom: SPACE.md },
  statCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACE.md },
  statRow: { marginBottom: SPACE.sm },
  statLabel: { color: COLORS.textGhost, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono, marginBottom: SPACE.xs },
  statValue: { color: COLORS.accent, fontSize: FONT.md, fontFamily: FONT_FAMILY.mono },
});
