import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, ENTITY_COLORS, FONT, FONT_FAMILY, RADIUS, SPACE } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';

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
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      fetchTickets();
      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [])
  );

  const getEntityColor = (entityType?: string) => {
    return ENTITY_COLORS[entityType || 'TO_DO'] || COLORS.accent;
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return COLORS.danger;
    if (priority === 'medium') return COLORS.warning;
    return COLORS.accent;
  };

  const todaysTasks = getTodaysTasks();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>lifeline</Text>
          <Text style={styles.headerSubtitle}>~/timeline</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>loading...</Text>
        </View>
      ) : todaysTasks.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>$ nothing today</Text>
          <Text style={styles.emptySubtext}>you're all caught up.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.timeline}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.accent} />}
          contentContainerStyle={{ paddingVertical: SPACE.lg }}
        >
          {todaysTasks.map((task, index) => {
            const entityColor = getEntityColor(task.entity_type);
            const isLast = index === todaysTasks.length - 1;

            return (
              <View key={task.id} style={styles.timelineItem}>
                {!isLast && <View style={[styles.timelineLine, { backgroundColor: COLORS.border }]} />}
                <View style={[styles.timelineDot, { borderColor: entityColor }]} />
                <View style={[styles.taskCard, { borderLeftColor: entityColor }]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.timeText}>{task.dueDate?.split(' ')[1] || '00:00'}</Text>
                    <Text style={[styles.entityBadge, { color: entityColor }]}>
                      {(task.entity_type || 'to_do').toLowerCase().replace('_', ' ')}
                    </Text>
                  </View>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <View style={styles.cardFooter}>
                    <View style={styles.priorityRow}>
                      <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(task.priority) }]} />
                      <Text style={styles.priorityText}>{task.priority?.toLowerCase() || 'medium'}</Text>
                    </View>
                    {task.project_id && (
                      <Text style={styles.projectText}>@ {task.project_id.toLowerCase()}</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg,
    borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: FONT.xxl, fontWeight: '500', color: COLORS.textPrimary, fontFamily: FONT_FAMILY.sans },
  headerSubtitle: { fontSize: FONT.md, color: COLORS.textMuted, fontFamily: FONT_FAMILY.mono, marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.xl },
  loadingText: { color: COLORS.textMuted, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono },
  emptyTitle: { color: COLORS.textMuted, fontSize: FONT.base, fontFamily: FONT_FAMILY.mono, marginBottom: SPACE.xs },
  emptySubtext: { color: COLORS.textGhost, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono },

  timeline: { flex: 1, paddingHorizontal: SPACE.lg },
  timelineItem: { position: 'relative', marginBottom: SPACE.xl + SPACE.sm },
  timelineLine: {
    position: 'absolute', left: SPACE.sm - 1,
    top: SPACE.xl + SPACE.xs, bottom: -(SPACE.xl + SPACE.sm),
    width: 1,
  },
  timelineDot: {
    position: 'absolute', left: 0, top: SPACE.xs,
    width: SPACE.md + SPACE.xs, height: SPACE.md + SPACE.xs,
    borderRadius: (SPACE.md + SPACE.xs) / 2,
    backgroundColor: COLORS.bg, borderWidth: 1.5,
  },
  taskCard: {
    marginLeft: SPACE.xl + SPACE.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.borderMid,
    borderLeftWidth: 1.5,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACE.sm,
  },
  timeText: { color: COLORS.textMuted, fontSize: FONT.md, fontFamily: FONT_FAMILY.mono },
  entityBadge: { fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  taskTitle: { color: COLORS.textPrimary, fontWeight: '500', fontSize: FONT.md, marginBottom: SPACE.sm, fontFamily: FONT_FAMILY.sans },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  priorityDot: { width: 5, height: 5, borderRadius: 3 },
  priorityText: { color: COLORS.textMuted, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  projectText: { color: COLORS.textGhost, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
});
