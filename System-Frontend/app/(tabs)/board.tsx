import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, BOLD_STYLES } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';

type Ticket = { id: string; title: string; dueDate: string; priority: string; status: string };

const STATUS_FLOW = ['TODO', 'IN_PROGRESS', 'DONE'];

export default function BoardScreen() {
  const { user, logout } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Responsive logic
  const isMobile = screenWidth < 768;
  const COLUMN_WIDTH = isMobile ? screenWidth * 0.75 : 340;
  
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
      if (data.success) setTickets(data.tickets);
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
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

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

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return COLORS.danger;
    if (priority === 'medium') return COLORS.warning;
    return COLORS.success;
  };

  const getPriorityPillStyle = (priority: string) => {
    const isHigh = priority === 'high';
    return {
      backgroundColor: isHigh ? 'rgba(255, 44, 85, 0.08)' : 'rgba(0, 255, 102, 0.08)',
      borderColor: isHigh ? '#FF2C55' : '#00FF66',
    };
  };

  const renderColumn = (title: string, filterStatus: string) => {
    const columnTickets = tickets.filter(t => (t.status || 'TODO').toUpperCase() === filterStatus);
    
    return (
      <View style={[styles.column, { width: COLUMN_WIDTH }]}>
        {/* Column Header */}
        <View style={styles.columnHeaderContainer}>
          <Text style={styles.columnHeaderText}>{filterStatus}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{columnTickets.length}</Text>
          </View>
        </View>
        
        {/* Scrollable Cards */}
        <ScrollView style={styles.cardList} showsVerticalScrollIndicator={false}>
          {columnTickets.map((ticket) => (
            <TouchableOpacity key={ticket.id} style={styles.brutalistCard}>
              {/* Title */}
              <Text style={styles.cardTitle}>{ticket.title.toUpperCase()}</Text>
              
              {/* Footer: Priority Pill + Due Date */}
              <View style={styles.cardFooter}>
                <View style={[styles.priorityPill, getPriorityPillStyle(ticket.priority)]}>
                  <Text style={[styles.priorityText, { color: getPriorityColor(ticket.priority) }]}>
                    {ticket.priority.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.dueDateText}>{ticket.dueDate ? `[ ${ticket.dueDate} ]` : '[ NO DATE ]'}</Text>
              </View>
            </TouchableOpacity>
          ))}
          
          {/* Add Ticket Button */}
          <TouchableOpacity style={styles.addTicketBtn}>
            <Ionicons name="add" size={18} color="#00FF66" />
            <Text style={styles.addTicketText}>ADD TICKET</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>PROJECT /</Text>
          <Text style={styles.headerHighlight}>BOARD</Text>
        </View>
        <TouchableOpacity onPress={fetchTickets} style={styles.refreshBtn}>
          <Ionicons name="scan" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          horizontal
          scrollEnabled={isMobile}
          snapToInterval={isMobile ? COLUMN_WIDTH + 16 : undefined}
          snapToAlignment={isMobile ? 'start' : undefined}
          decelerationRate={isMobile ? 'fast' : 'normal'}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={styles.boardScroll}
          contentContainerStyle={isMobile ? { paddingHorizontal: 16, gap: 16, paddingVertical: 16 } : { paddingHorizontal: 20, paddingVertical: 16, gap: 16, flexDirection: 'row' }}
        >
          {renderColumn('TODO', 'TODO')}
          {renderColumn('IN PROGRESS', 'IN_PROGRESS')}
          {renderColumn('DONE', 'DONE')}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { 
    paddingVertical: 16, 
    paddingHorizontal: 20,
    borderBottomWidth: 2, 
    borderColor: '#1a1a1a', 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#000000',
  },
  headerTitle: { fontSize: 12, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  headerHighlight: { fontSize: 28, fontWeight: '900', color: '#00FF66', letterSpacing: -1, marginTop: 4 },
  refreshBtn: { padding: 8, borderWidth: 2, borderColor: '#1a1a1a', borderRadius: 8 },
  
  boardScroll: { flex: 1 },
  
  /* Column Styles */
  column: { minHeight: '100%' },
  columnHeaderContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
  },
  columnHeaderText: { 
    fontSize: 14, 
    fontWeight: '900', 
    color: '#FFFFFF', 
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  countBadge: { 
    backgroundColor: '#1a1a1a', 
    borderWidth: 1,
    borderColor: '#00FF66',
    paddingHorizontal: 8, 
    paddingVertical: 4,
    borderRadius: 4,
  },
  countBadgeText: { 
    color: '#00FF66', 
    fontWeight: '900', 
    fontSize: 12,
    letterSpacing: 1,
  },
  
  /* Card List */
  cardList: { flex: 1 },
  
  /* Brutalist Ticket Card */
  brutalistCard: {
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priorityText: {
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
  },
  dueDateText: {
    color: '#666666',
    fontWeight: '900',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  
  /* Add Ticket Button */
  addTicketBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  addTicketText: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
});