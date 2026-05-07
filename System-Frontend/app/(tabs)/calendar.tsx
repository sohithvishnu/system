import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, useWindowDimensions, RefreshControl, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, BOLD_STYLES, FONT, FONT_FAMILY, RADIUS, SPACE } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import { DateTimePicker } from '../../components/DateTimePicker';
import { Calendar } from 'react-native-calendars';

const STATUS_FLOW = ['TODO', 'IN_PROGRESS', 'DONE'];

type Ticket = { id: string; title: string; dueDate: string; priority: string; status: string };

export default function CalendarScreen() {
  const { user, logout } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const isMobile = screenWidth < 768;

  const abortControllerRef = useRef<AbortController | null>(null);

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
        const validTickets = data.tickets
          .filter((t: Ticket) => t.dueDate)
          .sort((a: Ticket, b: Ticket) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        setTickets(validTickets);
      } else {
        Alert.alert('Error', data.error || 'Failed to load agenda');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch tickets", error);
        Alert.alert('SYSTEM_ERR', 'Backend connection severed.');
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

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, user_id: user?.id }),
      });
      const data = await res.json();
      if (data.success) {
        fetchTickets();
      } else {
        Alert.alert('Error', data.error || 'Failed to update status');
      }
    } catch (e: any) {
      console.error("Failed to update status", e);
      Alert.alert('Network Error', 'Could not update ticket. Please try again.');
    }
  };

  const getNextStatus = (currentStatus: string) => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus || 'TODO');
    if (currentIndex >= 0 && currentIndex < STATUS_FLOW.length - 1) {
      return STATUS_FLOW[currentIndex + 1];
    }
    return null;
  };

  const openEditModal = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setEditTitle(ticket.title);
    setEditDueDate(ticket.dueDate);
    setEditPriority(ticket.priority);
  };

  const closeEditModal = () => {
    setEditingTicket(null);
    setEditTitle('');
    setEditDueDate('');
    setEditPriority('');
  };

  const saveEditedTicket = async () => {
    if (!editingTicket) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets/${editingTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          priority: editPriority.toUpperCase(),
          dueDate: editDueDate,
          user_id: user?.id
        }),
      });
      const data = await res.json();
      if (data.success) {
        closeEditModal();
        fetchTickets();
      } else {
        Alert.alert('Error', data.error || 'Failed to save ticket');
      }
    } catch (e: any) {
      console.error("Failed to save ticket", e);
      Alert.alert('Network Error', 'Could not save ticket. Please try again.');
    }
  };

  const groupedTickets = tickets.reduce((acc: any, ticket) => {
    const date = ticket.dueDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(ticket);
    return acc;
  }, {});

  const displayedTasks = tickets.filter(t => t.dueDate && t.dueDate.startsWith(selectedDate));

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return COLORS.danger;
    if (priority === 'medium') return COLORS.warning;
    return COLORS.accent;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 768, flex: 1 }}>

          <View style={[styles.header, { paddingHorizontal: isMobile ? SPACE.lg : SPACE.md }]}>
            <View>
              <Text style={styles.headerTitle}>calendar</Text>
              <Text style={styles.headerSubtitle}>~/agenda</Text>
            </View>
            <TouchableOpacity onPress={fetchTickets} style={styles.refreshBtn}>
              <Feather name="refresh-cw" size={FONT.md} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centered}>
              <Text style={styles.loadingText}>loading...</Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1, paddingHorizontal: isMobile ? SPACE.lg : SPACE.md, paddingTop: SPACE.lg }}
              contentContainerStyle={{ paddingBottom: SPACE.xl * 2 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.accent} />}
            >
              <View style={styles.calendarContainer}>
                <Calendar
                  onDayPress={(day) => setSelectedDate(day.dateString)}
                  enableSwipeMonths={true}
                  hideExtraDays={false}
                  markedDates={{
                    [selectedDate]: { selected: true, marked: true, selectedColor: COLORS.accent }
                  }}
                  theme={{
                    calendarBackground: COLORS.bg,
                    textSectionTitleColor: COLORS.textGhost,
                    dayTextColor: COLORS.textMuted,
                    todayTextColor: COLORS.textPrimary,
                    monthTextColor: COLORS.textSecondary,
                    arrowColor: COLORS.accent,
                    textDayHeaderFontWeight: '500',
                    textMonthFontWeight: '500',
                    selectedDayBackgroundColor: COLORS.accent,
                    selectedDayTextColor: '#000',
                    dotColor: COLORS.accent,
                    selectedDotColor: '#000',
                  }}
                />
              </View>

              <View style={styles.dateIndicator}>
                <Text style={styles.dateIndicatorText}>{selectedDate}</Text>
              </View>

              <View style={styles.taskListSection}>
                {displayedTasks.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>$ no tasks today</Text>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.taskCountText}>{displayedTasks.length} task{displayedTasks.length !== 1 ? 's' : ''}</Text>
                    {displayedTasks.map((ticket: Ticket) => {
                      const nextStatus = getNextStatus(ticket.status);
                      return (
                        <View key={ticket.id} style={styles.agendaItem}>
                          <View style={styles.timeLineCol}>
                            <View style={[styles.node, { backgroundColor: ticket.status === 'DONE' ? COLORS.borderMid : COLORS.accent }]} />
                            <View style={styles.line} />
                          </View>

                          <View style={[styles.ticketCard, ticket.status === 'DONE' && styles.ticketDone]}>
                            <Text style={[styles.taskTitle, ticket.status === 'DONE' && styles.textDone]}>
                              {ticket.title}
                            </Text>
                            <View style={styles.taskMetaRow}>
                              <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(ticket.priority) }]} />
                              <Text style={styles.taskMeta}>
                                {ticket.dueDate} · {ticket.priority.toLowerCase()}
                              </Text>
                            </View>

                            <View style={styles.actionRow}>
                              {nextStatus && (
                                <TouchableOpacity
                                  style={styles.moveBtn}
                                  onPress={() => updateTicketStatus(ticket.id, nextStatus)}
                                >
                                  <Feather name="arrow-right" size={FONT.xs} color={COLORS.accent} />
                                  <Text style={styles.moveBtnText}>
                                    {nextStatus === 'TODO' ? 'not started' : nextStatus === 'IN_PROGRESS' ? 'start' : 'done'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                              {ticket.status !== 'TODO' && (
                                <TouchableOpacity
                                  style={styles.moveBtnSecondary}
                                  onPress={() => updateTicketStatus(ticket.id, 'TODO')}
                                >
                                  <Feather name="arrow-left" size={FONT.xs} color={COLORS.textMuted} />
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingVertical: SPACE.md,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: FONT.xxl, fontWeight: '500', color: COLORS.textPrimary, fontFamily: FONT_FAMILY.sans },
  headerSubtitle: { fontSize: FONT.md, color: COLORS.textMuted, fontFamily: FONT_FAMILY.mono, marginTop: 2 },
  refreshBtn: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.sm },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textMuted, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono },

  calendarContainer: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACE.sm,
    marginBottom: SPACE.md,
  },
  dateIndicator: {
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    marginBottom: SPACE.lg,
  },
  dateIndicatorText: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
  },
  taskListSection: { marginBottom: SPACE.xl },
  taskCountText: {
    color: COLORS.textMuted, fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono, marginBottom: SPACE.sm,
  },

  agendaItem: { flexDirection: 'row', marginBottom: SPACE.sm },
  timeLineCol: { width: SPACE.xl + SPACE.sm, alignItems: 'center' },
  node: {
    width: SPACE.sm + 2, height: SPACE.sm + 2,
    borderRadius: RADIUS.sm, borderWidth: 1,
    borderColor: COLORS.bg, zIndex: 10,
    marginTop: SPACE.lg,
  },
  line: {
    position: 'absolute', top: SPACE.xl + SPACE.xs, bottom: -SPACE.lg,
    width: 1, backgroundColor: COLORS.border,
  },
  ticketCard: {
    flex: 1, backgroundColor: COLORS.surface,
    padding: SPACE.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderMid, marginBottom: SPACE.sm,
  },
  ticketDone: { opacity: 0.5 },
  taskTitle: { fontSize: FONT.md, fontWeight: '500', color: COLORS.textPrimary, marginBottom: SPACE.xs, fontFamily: FONT_FAMILY.sans },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginBottom: SPACE.sm },
  priorityDot: { width: 5, height: 5, borderRadius: 3 },
  taskMeta: { fontSize: FONT.xs, color: COLORS.textMuted, fontFamily: FONT_FAMILY.mono },
  textDone: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  actionRow: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm, alignItems: 'center' },
  moveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sm, paddingVertical: SPACE.xs,
    justifyContent: 'center',
  },
  moveBtnText: { color: COLORS.textMuted, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  moveBtnSecondary: {
    width: SPACE.xl + SPACE.xs, height: SPACE.xl + SPACE.xs,
    borderWidth: 1, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center',
  },
  emptyState: { alignItems: 'center', marginTop: SPACE.xl },
  emptyText: { color: COLORS.textMuted, fontSize: FONT.base, fontFamily: FONT_FAMILY.mono },
});
