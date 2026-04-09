import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions, Platform, RefreshControl, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
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
  const [refreshing, setRefreshing] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  
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
      if (data.success) {
        setTickets(data.tickets);
      } else {
        Alert.alert('Error', data.error || 'Failed to load tickets');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch tickets", error);
        Alert.alert('Network Error', 'Could not reach the server. Please check your connection.');
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
        Alert.alert('Error', data.error || 'Failed to update status');
      }
    } catch (e: any) {
      console.error("Failed to update status", e);
      Alert.alert('Network Error', 'Could not update ticket. Please try again.');
    }
  };

  const saveEditedTicket = async () => {
    if (!editingTicket) return;
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets/${editingTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          priority: editPriority,
          dueDate: editDueDate,
          user_id: user?.id
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingTicket(null);
        setEditTitle('');
        setEditPriority('');
        setEditDueDate('');
        fetchTickets();
      } else {
        Alert.alert('Error', data.error || 'Failed to save ticket');
      }
    } catch (e: any) {
      console.error("Failed to save ticket", e);
      Alert.alert('Network Error', 'Could not save ticket. Please try again.');
    }
  };

  const openEditModal = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setEditTitle(ticket.title);
    setEditPriority(ticket.priority);
    setEditDueDate(ticket.dueDate);
  };

  const closeEditModal = () => {
    setEditingTicket(null);
    setEditTitle('');
    setEditPriority('');
    setEditDueDate('');
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
            <TouchableOpacity 
              key={ticket.id} 
              style={styles.brutalistCard}
              onPress={() => openEditModal(ticket)}
              activeOpacity={0.7}
            >
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

              {/* Movement Actions */}
              <View style={styles.actionRow}>
                {ticket.status === 'TODO' && (
                  <TouchableOpacity 
                    style={[styles.moveBtn, { marginLeft: 'auto' }]}
                    onPress={() => updateTicketStatus(ticket.id, 'IN_PROGRESS')}
                  >
                    <Text style={styles.moveBtnText}>{`[ → START ]`}</Text>
                  </TouchableOpacity>
                )}
                
                {ticket.status === 'IN_PROGRESS' && (
                  <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                    <TouchableOpacity 
                      style={[styles.moveBtn, { flex: 1 }]}
                      onPress={() => updateTicketStatus(ticket.id, 'TODO')}
                    >
                      <Text style={styles.moveBtnText}>{`[ ← BACK ]`}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.moveBtn, { flex: 1 }]}
                      onPress={() => updateTicketStatus(ticket.id, 'DONE')}
                    >
                      <Text style={styles.moveBtnText}>{`[ → DONE ]`}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {ticket.status === 'DONE' && (
                  <TouchableOpacity 
                    style={styles.moveBtn}
                    onPress={() => updateTicketStatus(ticket.id, 'IN_PROGRESS')}
                  >
                    <Text style={styles.moveBtnText}>{`[ ← REOPEN ]`}</Text>
                  </TouchableOpacity>
                )}
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
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
          <Ionicons name="scan" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#00FF66', fontWeight: '900', letterSpacing: 2, fontSize: 14 }}>[ SYSTEM_LOADING... ]</Text>
        </View>
      ) : tickets.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '900', letterSpacing: 1, fontSize: 20, marginBottom: 16 }}>[ NO_TASKS_FOUND ]</Text>
          <Text style={{ color: '#666666', fontWeight: '900', letterSpacing: 1, fontSize: 12, textAlign: 'center' }}>BOARD EMPTY. CREATE NEW TASKS TO BEGIN.</Text>
        </View>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00FF66" />}
        >
          {renderColumn('TODO', 'TODO')}
          {renderColumn('IN PROGRESS', 'IN_PROGRESS')}
          {renderColumn('DONE', 'DONE')}
        </ScrollView>
      )}

      {/* EDIT TICKET MODAL */}
      <Modal visible={editingTicket !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={100} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>[ EDIT_SYSTEM_TASK ]</Text>
              
              {/* Title Input */}
              <TextInput
                style={styles.modalInput}
                placeholder="TASK_TITLE"
                placeholderTextColor="#555"
                value={editTitle}
                onChangeText={setEditTitle}
              />
              
              {/* Priority Selector */}
              <Text style={styles.inputLabel}>PRIORITY</Text>
              <View style={styles.prioritySelector}>
                {['low', 'medium', 'high'].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.prioritySelectBtn,
                      editPriority === p && styles.prioritySelectBtnActive
                    ]}
                    onPress={() => setEditPriority(p)}
                  >
                    <Text style={[
                      styles.prioritySelectText,
                      editPriority === p && styles.prioritySelectTextActive
                    ]}>
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Due Date Input */}
              <TextInput
                style={styles.modalInput}
                placeholder="DUE_DATE (YYYY-MM-DD)"
                placeholderTextColor="#555"
                value={editDueDate}
                onChangeText={setEditDueDate}
              />
              
              {/* Modal Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={closeEditModal}>
                  <Text style={styles.cancelText}>[ CANCEL ]</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveEditedTicket}>
                  <Text style={styles.saveBtnText}>[ SAVE_MUTATION ]</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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

  /* Movement Actions */
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    width: '100%',
  },
  moveBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveBtnText: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 8,
    padding: 24,
  },
  modalTitle: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 2,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#000',
    color: '#FFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 12,
    marginBottom: 16,
    fontWeight: '700',
    fontSize: 14,
  },
  inputLabel: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  prioritySelectBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prioritySelectBtnActive: {
    backgroundColor: '#00FF66',
    borderColor: '#00FF66',
  },
  prioritySelectText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
  },
  prioritySelectTextActive: {
    color: '#000',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  cancelText: {
    color: '#666',
    fontWeight: '900',
    fontSize: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    letterSpacing: 1,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#00FF66',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
});