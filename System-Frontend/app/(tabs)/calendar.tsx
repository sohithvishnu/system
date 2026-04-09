import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, useWindowDimensions, RefreshControl, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, BOLD_STYLES } from '../../constants/theme';
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
  
  // State Management: Selected date for calendar filtering (default to today)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Responsive logic
  const isMobile = screenWidth < 768;
  
  // AbortController for canceling ticket requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTickets = async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
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
        // Cancel request when screen loses focus
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
        body: JSON.stringify({ 
          status: newStatus,
          user_id: user?.id 
        }),
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

  // Group tickets by date
  const groupedTickets = tickets.reduce((acc: any, ticket) => {
    const date = ticket.dueDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(ticket);
    return acc;
  }, {});

  // Filter tasks to show only those for selected date
  const displayedTasks = tickets.filter(t => t.dueDate && t.dueDate.startsWith(selectedDate));

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, backgroundColor: '#000000', alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 768, flex: 1 }}>
          
          {/* HEADER */}
          <View style={[styles.header, { paddingHorizontal: isMobile ? '5%' : '3%' }]}>
            <View>
              <Text style={styles.headerTitle}>SYSTEM /</Text>
              <Text style={styles.headerHighlight}>CALENDAR</Text>
            </View>
            <TouchableOpacity onPress={fetchTickets} style={styles.refreshBtn}>
              <Ionicons name="scan" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#00FF66', fontWeight: '900', letterSpacing: 2, fontSize: 14 }}>[ SYSTEM_LOADING... ]</Text>
            </View>
          ) : (
            <ScrollView 
              style={{ flex: 1, paddingHorizontal: isMobile ? '5%' : '3%', paddingTop: 16 }}
              contentContainerStyle={{ paddingBottom: 40 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00FF66" />}
            >
              
              {/* COMPACT BRUTALIST CALENDAR */}
              <View style={styles.calendarContainer}>
                <Calendar
                  onDayPress={(day) => setSelectedDate(day.dateString)}
                  enableSwipeMonths={true}
                  hideExtraDays={false}
                  markedDates={{
                    [selectedDate]: { selected: true, marked: true, selectedColor: '#00FF66' }
                  }}
                  theme={{
                    calendarBackground: '#000000',
                    textSectionTitleColor: '#666666',
                    dayTextColor: '#FFFFFF',
                    todayTextColor: '#FF2C55',
                    monthTextColor: '#00FF66',
                    arrowColor: '#00FF66',
                    textDayHeaderFontWeight: '900',
                    textMonthFontWeight: '900',
                  }}
                />
              </View>

              {/* SELECTED DATE INDICATOR */}
              <View style={styles.dateIndicator}>
                <Text style={styles.dateIndicatorText}>SELECTED: {selectedDate.toUpperCase()}</Text>
              </View>

              {/* FILTERED TASK LIST FOR SELECTED DATE */}
              <View style={styles.taskListSection}>
                {displayedTasks.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>NO TASKS</Text>
                    <Text style={styles.emptyTextSub}>FOR THIS DATE</Text>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.taskCountText}>{displayedTasks.length} TASK{displayedTasks.length !== 1 ? 'S' : ''}</Text>
                    {displayedTasks.map((ticket: Ticket) => {
                      const nextStatus = getNextStatus(ticket.status);
                      return (
                        <View key={ticket.id} style={styles.agendaItem}>
                          <View style={styles.timeLineCol}>
                            <View style={[styles.node, { backgroundColor: ticket.status === 'DONE' ? COLORS.borderColor : COLORS.primary }]} />
                            <View style={styles.line} />
                          </View>
                          
                          <View style={[styles.ticketCard, ticket.status === 'DONE' && styles.ticketDone]}>
                            <Text style={[styles.taskTitle, ticket.status === 'DONE' && styles.textDone]}>
                              {ticket.title.toUpperCase()}
                            </Text>
                            <Text style={styles.taskMeta}>
                              {ticket.dueDate} • {ticket.priority.toUpperCase()}
                            </Text>
                            
                            {/* Status Movement Row */}
                            <View style={styles.actionRow}>
                              {nextStatus && (
                                <TouchableOpacity 
                                  style={styles.moveBtn}
                                  onPress={() => updateTicketStatus(ticket.id, nextStatus)}
                                >
                                  <Ionicons name="arrow-forward" size={14} color="#00FF66" />
                                  <Text style={styles.moveBtnText}>{nextStatus === 'TODO' ? 'NOT STARTED' : nextStatus === 'IN_PROGRESS' ? 'PROGRESSING' : 'DONE'}</Text>
                                </TouchableOpacity>
                              )}
                              
                              {ticket.status !== 'TODO' && (
                                <TouchableOpacity 
                                  style={styles.moveBtnSecondary}
                                  onPress={() => updateTicketStatus(ticket.id, 'TODO')}
                                >
                                  <Ionicons name="arrow-back" size={14} color="#A0A0A0" />
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    paddingVertical: 16, 
    borderBottomWidth: 2, 
    borderColor: COLORS.borderColor, 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerTitle: { fontSize: 14, fontWeight: '900', color: COLORS.white, letterSpacing: 2, fontFamily: 'Courier New' },
  headerHighlight: { fontSize: 24, fontWeight: '900', color: COLORS.primary, letterSpacing: -1, marginBottom: 8, fontFamily: 'Courier New' },
  refreshBtn: { padding: 8, borderWidth: 2, borderColor: COLORS.borderColor, borderRadius: 0 },
  
  // Compact Calendar Container
  calendarContainer: {
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#00FF66',
    borderRadius: 0,
    padding: 12,
    marginBottom: 16,
  },

  // Date Indicator
  dateIndicator: {
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#00FF66',
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  dateIndicatorText: {
    color: '#00FF66',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'Courier New',
  },

  // Task List Section
  taskListSection: {
    marginBottom: 24,
  },
  taskCountText: {
    color: '#00FF66',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 12,
    fontFamily: 'Courier New',
  },
  
  agendaItem: { flexDirection: 'row', marginBottom: 8 },
  timeLineCol: { width: 30, alignItems: 'center' },
  node: { width: 12, height: 12, borderRadius: 0, borderWidth: 2, borderColor: COLORS.background, zIndex: 10, marginTop: 24 },
  line: { position: 'absolute', top: 36, bottom: -20, width: 2, backgroundColor: COLORS.borderColor },
  
  ticketCard: { flex: 1, backgroundColor: COLORS.cardDark, padding: 16, borderRadius: 0, borderWidth: BOLD_STYLES.border, borderColor: COLORS.borderColor, marginBottom: 12 },
  ticketDone: { opacity: 0.5, borderColor: COLORS.borderColor },
  taskTitle: { fontSize: 14, fontWeight: '900', color: COLORS.white, marginBottom: 6, letterSpacing: -0.5 },
  taskMeta: { fontSize: 11, color: COLORS.lightText, fontWeight: '900', letterSpacing: 0.5, marginBottom: 12 },
  textDone: { textDecorationLine: 'line-through', color: COLORS.lightText },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  moveBtn: { flex: 1, backgroundColor: '#000', borderWidth: 2, borderColor: '#00FF66', borderRadius: 0, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  moveBtnText: { color: '#00FF66', fontWeight: '900', fontSize: 8, letterSpacing: 0.5 },
  moveBtnSecondary: { width: 32, height: 32, borderWidth: 2, borderColor: '#333', borderRadius: 0, justifyContent: 'center', alignItems: 'center' },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: COLORS.white, fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  emptyTextSub: { color: COLORS.primary, fontSize: 14, fontWeight: '900', letterSpacing: 2, marginTop: 8 }
});