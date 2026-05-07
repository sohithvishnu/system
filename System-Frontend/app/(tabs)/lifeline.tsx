import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Alert, RefreshControl, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { COLORS, ENTITY_COLORS, FONT, FONT_FAMILY, RADIUS, SPACE } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import { scale } from '../../utils/responsive';

type Ticket = {
  id: string;
  title: string;
  dueDate: string;
  priority: string;
  status: string;
  entity_type?: string;
  project_id?: string;
};

export default function LifelineScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeModel, setActiveModel] = useState<string>('NONE');
  const abortControllerRef = useRef<AbortController | null>(null);

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getTodaysTasks = () => {
    const today = getTodayDate();
    const todaysTasks = tickets.filter(t =>
      t.dueDate?.startsWith(today) && t.status !== 'DONE'
    );
    return todaysTasks.sort((a, b) => {
      const timeA = a.dueDate?.split(' ')[1] || '00:00';
      const timeB = b.dueDate?.split(' ')[1] || '00:00';
      return timeA.localeCompare(timeB);
    });
  };

  const fetchTickets = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/tickets?user_id=${user?.id}`, {
        signal: abortControllerRef.current.signal
      });
      const data = await response.json();
      if (data.success) {
        setTickets(data.tickets);
      } else {
        Alert.alert('Error', data.error || 'Failed to load tickets');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch tickets", error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTickets();
  }, []);

  const loadActiveModel = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('@system_active_model');
      setActiveModel(saved || 'NONE');
    } catch (e) {
      console.error('Failed to load active model', e);
      setActiveModel('NONE');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTickets();
      loadActiveModel();
      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [loadActiveModel])
  );

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return COLORS.danger;
    if (priority === 'medium') return COLORS.warning;
    return COLORS.accent;
  };

  const handleActionPress = async (action: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (action === 'project') router.push('/(tabs)/projects');
    else if (action === 'journal') router.push('/(tabs)/journal');
    else if (action === 'topology') router.push('/(tabs)/topology');
  };

  const todaysTasks = getTodaysTasks();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>lifeline</Text>
        <Text style={styles.headerSubtitle}>~/timeline</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>loading...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.accent} />}
          contentContainerStyle={styles.scrollContent}
        >
          {/* BENTO GRID */}
          <View style={styles.bentoGrid}>
            {/* ROW 1: MACRO VIEW */}
            <View style={styles.bentoRow}>
              {/* SYSTEM STATUS CELL */}
              <View style={[styles.bentoCell, styles.cellSquare]}>
                <Text style={styles.cellLabel}>[ CORE ]</Text>
                <View style={styles.cellContent}>
                  <Feather
                    name="cpu"
                    size={scale(80)}
                    color={COLORS.textGhost}
                    style={styles.backgroundIcon}
                  />
                  <Text style={styles.statusText}>Active Model</Text>
                  <Text style={styles.modelText}>{activeModel}</Text>
                </View>
              </View>

              {/* NEURAL SYNAPSE CELL */}
              <View style={[styles.bentoCell, styles.cellWide]}>
                <Text style={styles.cellLabel}>[ LATEST_THOUGHT ]</Text>
                <View style={styles.cellContent}>
                  <Text style={styles.synapseText}>
                    {todaysTasks.length > 0
                      ? `Next: ${todaysTasks[0].title}`
                      : 'No tasks for today'}
                  </Text>
                  {todaysTasks.length > 0 && (
                    <Text style={styles.synapseTime}>
                      {todaysTasks[0].dueDate?.split(' ')[1] || '—'}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* ROW 2: DATA LAYER */}
            <View style={styles.bentoRow}>
              {/* PIPELINE CELL */}
              <View style={[styles.bentoCell, styles.cellPipeline]}>
                <Text style={styles.cellLabel}>[ TODAY'S_TASKS ]</Text>
                <View style={styles.taskList}>
                  {todaysTasks.slice(0, 5).map((task) => (
                    <View key={task.id} style={styles.taskListItem}>
                      <View
                        style={[
                          styles.taskDot,
                          { backgroundColor: getPriorityColor(task.priority) }
                        ]}
                      />
                      <Text style={styles.taskListTitle} numberOfLines={1}>
                        {task.title}
                      </Text>
                    </View>
                  ))}
                  {todaysTasks.length === 0 && (
                    <Text style={styles.emptyTaskText}>no tasks today</Text>
                  )}
                </View>
              </View>

              {/* IDENTITY MATRIX CELL */}
              <View style={[styles.bentoCell, styles.cellMemory]}>
                <Text style={styles.cellLabel}>[ NEW_MEMORY ]</Text>
                <View style={styles.cellContent}>
                  <Text style={styles.memoryText}>
                    User: {user?.username || 'Unknown'}
                  </Text>
                  <Text style={styles.memorySubtext}>
                    Tasks Today: {todaysTasks.length}
                  </Text>
                  <Text style={styles.memorySubtext}>
                    Total Tasks: {tickets.length}
                  </Text>
                </View>
              </View>
            </View>

            {/* ROW 3: ACTION ROW */}
            <View style={[styles.bentoRow, styles.actionRow]}>
              <Pressable
                style={[styles.bentoCell, styles.actionCell]}
                onPress={() => handleActionPress('project')}
              >
                <Feather name="folder" size={FONT.xl} color={COLORS.accent} />
                <Text style={styles.actionLabel}>new project</Text>
              </Pressable>

              <Pressable
                style={[styles.bentoCell, styles.actionCell]}
                onPress={() => handleActionPress('journal')}
              >
                <Feather name="book-open" size={FONT.xl} color={COLORS.accent} />
                <Text style={styles.actionLabel}>log journal</Text>
              </Pressable>

              <Pressable
                style={[styles.bentoCell, styles.actionCell]}
                onPress={() => handleActionPress('topology')}
              >
                <Feather name="share-2" size={FONT.xl} color={COLORS.accent} />
                <Text style={styles.actionLabel}>view topology</Text>
              </Pressable>
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
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: FONT.xxl, fontWeight: '500', color: COLORS.textPrimary, fontFamily: FONT_FAMILY.sans },
  headerSubtitle: { fontSize: FONT.md, color: COLORS.textMuted, fontFamily: FONT_FAMILY.mono, marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.xl },
  loadingText: { color: COLORS.textMuted, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono },

  // BENTO GRID LAYOUT
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.lg },
  bentoGrid: { gap: SPACE.sm },
  bentoRow: { flexDirection: 'row', gap: SPACE.sm },

  // BENTO CELLS - SHARED
  bentoCell: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: 2,
    padding: SPACE.lg,
    justifyContent: 'flex-start',
  },

  // ROW 1 CELLS
  cellSquare: { flex: 1, height: scale(180) },
  cellWide: { flex: 2, height: scale(180) },

  // ROW 2 CELLS
  cellPipeline: { flex: 1.5, height: scale(220) },
  cellMemory: { flex: 1, height: scale(220) },

  // ROW 3 CELLS
  actionRow: { height: scale(100) },
  actionCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // CELL CONTENTS
  cellLabel: {
    fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.textMuted,
    marginBottom: SPACE.md,
    fontWeight: '500',
  },

  cellContent: { flex: 1, justifyContent: 'center' },

  // SYSTEM STATUS
  backgroundIcon: { position: 'absolute', bottom: SPACE.sm, right: SPACE.sm, opacity: 0.1 },
  statusText: { fontSize: FONT.xs, color: COLORS.textMuted, fontFamily: FONT_FAMILY.mono, marginBottom: SPACE.xs },
  modelText: { fontSize: FONT.lg, color: COLORS.accent, fontFamily: FONT_FAMILY.mono, fontWeight: '600' },

  // NEURAL SYNAPSE
  synapseText: { fontSize: FONT.md, color: COLORS.textPrimary, fontFamily: FONT_FAMILY.sans, fontWeight: '500', marginBottom: SPACE.sm },
  synapseTime: { fontSize: FONT.sm, color: COLORS.textMuted, fontFamily: FONT_FAMILY.mono },

  // TASK LIST
  taskList: { gap: SPACE.sm },
  taskListItem: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  taskDot: { width: 5, height: 5, borderRadius: 2.5 },
  taskListTitle: { fontSize: FONT.sm, color: COLORS.textPrimary, fontFamily: FONT_FAMILY.mono, flex: 1 },
  emptyTaskText: { fontSize: FONT.sm, color: COLORS.textGhost, fontFamily: FONT_FAMILY.mono },

  // IDENTITY MATRIX
  memoryText: { fontSize: FONT.sm, color: COLORS.textPrimary, fontFamily: FONT_FAMILY.mono, fontWeight: '500', marginBottom: SPACE.sm },
  memorySubtext: { fontSize: FONT.xs, color: COLORS.textMuted, fontFamily: FONT_FAMILY.mono, marginBottom: SPACE.xs },

  // ACTION LABELS
  actionLabel: { fontSize: FONT.xs, color: COLORS.accent, fontFamily: FONT_FAMILY.mono, fontWeight: '500', marginTop: SPACE.sm },
});
