import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, BOLD_STYLES } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
const STATUS_FLOW = ['TODO', 'IN_PROGRESS', 'DONE'];

type Ticket = { id: string; title: string; dueDate: string; priority: string; status: string };

export default function CalendarScreen() {
  const { user, logout } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  
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
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.log("Failed to fetch tickets", error);
      }
    } finally {
      setLoading(false);
    }
  };

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
      const res = await fetch(`${BACKEND_URL}/${ticketId}`, {
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
        Alert.alert('Error', 'Failed to update status');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const getNextStatus = (currentStatus: string) => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus || 'TODO');
    if (currentIndex >= 0 && currentIndex < STATUS_FLOW.length - 1) {
      return STATUS_FLOW[currentIndex + 1];
    }
    return null;
  };

  // Group tickets by date
  const groupedTickets = tickets.reduce((acc: any, ticket) => {
    const date = ticket.dueDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(ticket);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingHorizontal: isMobile ? '5%' : '3%' }]}>
        <View>
          <Text style={styles.headerTitle}>SYSTEM /</Text>
          <Text style={styles.headerHighlight}>AGENDA</Text>
        </View>
        <TouchableOpacity onPress={fetchTickets} style={styles.refreshBtn}>
            <Ionicons name="scan" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.agendaScroll} contentContainerStyle={{ paddingBottom: 40 }}>
          {Object.keys(groupedTickets).length === 0 ? (
              <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>NO UPCOMING EVENTS.</Text>
                  <Text style={styles.emptyTextSub}>SYSTEM CLEAR.</Text>
              </View>
          ) : (
              Object.keys(groupedTickets).map((date) => (
                <View key={date} style={styles.dateGroup}>
                  {/* Heavy Date Divider */}
                  <View style={styles.dateHeader}>
                    <Text style={styles.dateHeaderText}>{date.toUpperCase()}</Text>
                    <View style={styles.dateLine} />
                  </View>

                  {/* Tickets for this date */}
                  {groupedTickets[date].map((ticket: Ticket) => {
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
                          <Text style={styles.badgeText}>PRIORITY: {ticket.priority.toUpperCase()}</Text>
                          
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
              ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    paddingVertical: 16, 
    borderBottomWidth: 1, 
    borderColor: COLORS.borderColor, 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerTitle: { fontSize: 14, fontWeight: '900', color: COLORS.white, letterSpacing: 2 },
  headerHighlight: { fontSize: 24, fontWeight: '900', color: COLORS.primary, letterSpacing: -1, textShadowColor: 'rgba(0, 255, 102, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8, marginBottom: 8 },
  refreshBtn: { padding: 8, borderWidth: 2, borderColor: COLORS.borderColor, borderRadius: BOLD_STYLES.radius.md },
  
  agendaScroll: { flex: 1, paddingHorizontal: '5%', paddingTop: 24 },
  
  dateGroup: { marginBottom: 16 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dateHeaderText: { color: COLORS.primary, fontSize: 18, fontWeight: '900', letterSpacing: 2, marginRight: 16 },
  dateLine: { flex: 1, height: 2, backgroundColor: COLORS.borderColor },
  
  agendaItem: { flexDirection: 'row', marginBottom: 8 },
  timeLineCol: { width: 30, alignItems: 'center' },
  node: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: COLORS.background, zIndex: 10, marginTop: 24 },
  line: { position: 'absolute', top: 36, bottom: -20, width: 2, backgroundColor: COLORS.borderColor },
  
  ticketCard: { flex: 1, backgroundColor: COLORS.cardDark, padding: 20, borderRadius: BOLD_STYLES.radius.lg, borderWidth: BOLD_STYLES.border, borderColor: COLORS.borderColor, marginBottom: 12, shadowColor: '#00FF66', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 8 },
  ticketDone: { opacity: 0.5, borderColor: COLORS.borderColor },
  taskTitle: { fontSize: 16, fontWeight: '900', color: COLORS.white, marginBottom: 8, letterSpacing: -0.5 },
  textDone: { textDecorationLine: 'line-through', color: COLORS.lightText },
  badgeText: { fontSize: 11, color: COLORS.lightText, fontWeight: '900', letterSpacing: 1 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  moveBtn: { flex: 1, backgroundColor: '#000', borderWidth: 2, borderColor: '#00FF66', borderRadius: 8, paddingVertical: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  moveBtnText: { color: '#00FF66', fontWeight: '900', fontSize: 9, letterSpacing: 0.5 },
  moveBtnSecondary: { width: 32, height: 32, borderWidth: 2, borderColor: '#333', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: COLORS.white, fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  emptyTextSub: { color: COLORS.primary, fontSize: 16, fontWeight: '900', letterSpacing: 2, marginTop: 8 }
});