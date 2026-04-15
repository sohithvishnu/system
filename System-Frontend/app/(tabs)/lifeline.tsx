import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, ENTITY_COLORS } from '../../constants/theme';
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

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Filter tasks for today and sort by time
  const getTodaysTasks = () => {
    const today = getTodayDate();
    const todaysTasks = tickets.filter(t => 
      t.dueDate?.startsWith(today) && t.status !== 'DONE'
    );
    
    // Sort by time (oldest to newest)
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
    return ENTITY_COLORS[entityType || 'TO_DO'] || COLORS.primary;
  };

  const todaysTasks = getTodaysTasks();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>DAILY /</Text>
          <Text style={styles.headerHighlight}>LIFELINE</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#00FF66', fontWeight: '900', letterSpacing: 2, fontSize: 14 }}>[ SYSTEM_LOADING... ]</Text>
        </View>
      ) : todaysTasks.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '900', letterSpacing: 1, fontSize: 20, marginBottom: 16 }}>[ NO_TASKS_TODAY ]</Text>
          <Text style={{ color: '#666666', fontWeight: '900', letterSpacing: 1, fontSize: 12, textAlign: 'center' }}>YOU'RE ALL CAUGHT UP FOR NOW.</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.timeline}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00FF66" />}
          contentContainerStyle={{ paddingVertical: 16 }}
        >
          {todaysTasks.map((task, index) => {
            const entityColor = getEntityColor(task.entity_type);
            const isLast = index === todaysTasks.length - 1;

            return (
              <View key={task.id} style={styles.timelineItem}>
                {/* Vertical Timeline Line (except for last item) */}
                {!isLast && <View style={[styles.timelineLine, { backgroundColor: entityColor }]} />}
                
                {/* Timeline Dot */}
                <View style={[styles.timelineDot, { borderColor: entityColor }]} />
                
                {/* Task Card */}
                <View style={[styles.taskCard, { borderLeftColor: entityColor, borderLeftWidth: 4 }]}>
                  {/* Header with time and entity badge */}
                  <View style={styles.cardHeader}>
                    <Text style={styles.timeText}>
                      {task.dueDate?.split(' ')[1] || '00:00'}
                    </Text>
                    <Text style={[styles.entityBadge, { color: entityColor }]}>
                      [ {task.entity_type || 'TO_DO'} ]
                    </Text>
                  </View>

                  {/* Title */}
                  <Text style={styles.taskTitle}>{task.title.toUpperCase()}</Text>

                  {/* Footer with priority and project */}
                  <View style={styles.cardFooter}>
                    <View style={[styles.priorityBadge, getPriorityBackgroundColor(task.priority)]}>
                      <Text style={[styles.priorityText, { color: getPriorityColor(task.priority) }]}>
                        {task.priority?.toUpperCase() || 'MEDIUM'}
                      </Text>
                    </View>
                    {task.project_id && (
                      <Text style={styles.projectText}>
                        @ {task.project_id.toUpperCase()}
                      </Text>
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

const getPriorityColor = (priority: string) => {
  if (priority === 'high') return COLORS.danger;
  if (priority === 'medium') return COLORS.warning;
  return COLORS.success;
};

const getPriorityBackgroundColor = (priority: string) => {
  const isHigh = priority === 'high';
  return {
    backgroundColor: isHigh ? 'rgba(255, 44, 85, 0.08)' : 'rgba(0, 255, 102, 0.08)',
    borderColor: isHigh ? '#FF2C55' : '#00FF66',
  };
};

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
  timeline: {
    flex: 1,
    paddingHorizontal: 20,
  },
  timelineItem: {
    position: 'relative',
    marginBottom: 32,
  },
  timelineLine: {
    position: 'absolute',
    left: 7,
    top: 40,
    bottom: -32,
    width: 1,
  },
  timelineDot: {
    position: 'absolute',
    left: 0,
    top: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0A0A0A',
    borderWidth: 3,
  },
  taskCard: {
    marginLeft: 40,
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeText: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
    fontFamily: 'Courier New',
  },
  entityBadge: {
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: 'Courier New',
  },
  taskTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priorityBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
  },
  priorityText: {
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  projectText: {
    color: '#666666',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
    fontFamily: 'Courier New',
  },
});
