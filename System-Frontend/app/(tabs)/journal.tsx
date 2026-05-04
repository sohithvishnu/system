import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Alert, useWindowDimensions, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONT, FONT_FAMILY, RADIUS, SPACE } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import { BlinkingCursor } from '../../components/ui';

type Journal = {
  id: string;
  date: string;
  summary: string;
  timestamp: string;
};

export default function JournalScreen() {
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const isMobile = screenWidth < 768;

  const fetchJournals = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/journal/history?user_id=${user?.id}&limit=30`);
      const data = await response.json();
      if (data.success) {
        setJournals(data.journals);
      } else {
        console.error("Failed to fetch journals:", data.error);
        Alert.alert('SYSTEM_ERR', 'Failed to load EOD journal entries.');
      }
    } catch (error: any) {
      console.error("Failed to fetch journals", error);
      Alert.alert('SYSTEM_ERR', 'Backend connection severed.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchJournals();
    }, [])
  );

  const generateEODReport = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/journal/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'EOD Report generated');
        fetchJournals();
      } else {
        Alert.alert('Error', data.error || 'Failed to generate report');
      }
    } catch (error: any) {
      console.error("Failed to generate report", error);
      Alert.alert('SYSTEM_ERR', 'Backend connection severed. EOD report generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJournals();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>journal</Text>
          <Text style={styles.headerSubtitle}>~/eod</Text>
        </View>
        <TouchableOpacity
          style={[styles.generateBtn, isGenerating && styles.generateBtnActive]}
          onPress={generateEODReport}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <BlinkingCursor />
          ) : (
            <>
              <Feather name="zap" size={FONT.sm} color={COLORS.accent} />
              <Text style={styles.generateBtnText}>generate</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <BlinkingCursor />
        </View>
      ) : journals.length > 0 ? (
        <ScrollView
          style={styles.journalsContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.accent} />}
          contentContainerStyle={{ paddingVertical: SPACE.lg, paddingHorizontal: isMobile ? SPACE.md : SPACE.xl }}
        >
          {journals.map((journal) => (
            <View key={journal.id} style={styles.journalPrintout}>
              <Text style={styles.journalDate}>{journal.date}</Text>
              <Text style={styles.journalSummary}>{journal.summary}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>$ no entries yet</Text>
          <Text style={styles.emptySubtext}>generate your first eod report to get started</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: FONT.xxl, fontWeight: '500', color: COLORS.textPrimary, fontFamily: FONT_FAMILY.sans },
  headerSubtitle: { fontSize: FONT.md, color: COLORS.textMuted, fontFamily: FONT_FAMILY.mono, marginTop: 2 },

  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    backgroundColor: COLORS.accentTint,
    borderWidth: 1,
    borderColor: 'rgba(0,255,102,0.18)',
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
  },
  generateBtnActive: { backgroundColor: COLORS.surface },
  generateBtnText: { color: COLORS.accent, fontSize: FONT.md, fontFamily: FONT_FAMILY.mono, fontWeight: '500' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  journalsContainer: { flex: 1 },

  journalPrintout: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    marginBottom: SPACE.md,
  },
  journalDate: {
    color: COLORS.textMuted,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    marginBottom: SPACE.sm,
  },
  journalSummary: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
    lineHeight: FONT.md * 1.65,
    fontFamily: FONT_FAMILY.sans,
  },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.xl },
  emptyText: { color: COLORS.textMuted, fontSize: FONT.base, fontFamily: FONT_FAMILY.mono, marginBottom: SPACE.xs },
  emptySubtext: { color: COLORS.textGhost, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono, textAlign: 'center' },
});
