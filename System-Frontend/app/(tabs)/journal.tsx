import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';

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
        <Text style={styles.title}>[ EOD_LOGS ]</Text>
        <Text style={styles.subtitle}>End-of-Day Journal</Text>
      </View>

      <View style={[styles.generateButtonContainer, isGenerating && styles.generateButtonContainerActive]}>
        <TouchableOpacity
          style={[styles.generateBtn, isGenerating && styles.generateBtnActive]}
          onPress={generateEODReport}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator color="#0A0A0A" size="small" />
          ) : (
            <Text style={[styles.generateBtnText, isGenerating && styles.generateBtnTextActive]}>
              [ GENERATE_EOD_REPORT ]
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00FF66" />
        </View>
      ) : journals.length > 0 ? (
        <ScrollView
          style={styles.journalsContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: isMobile ? 12 : 20 }}
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
          <Text style={styles.emptyText}>[ no_entries_yet ]</Text>
          <Text style={styles.emptySubtext}>Generate your first EOD report to get started</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
  },
  title: {
    color: '#00FF66',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 1,
  },
  generateButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
  },
  generateButtonContainerActive: {
    borderBottomColor: '#00FF66',
  },
  generateBtn: {
    backgroundColor: '#00FF66',
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 56,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnActive: {
    backgroundColor: '#0A0A0A',
  },
  generateBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  generateBtnTextActive: {
    color: '#00FF66',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  journalsContainer: {
    flex: 1,
  },
  journalPrintout: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 16,
  },
  journalDate: {
    color: '#00FF66',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'Courier New',
    letterSpacing: 1,
    marginBottom: 12,
  },
  journalSummary: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#444',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
