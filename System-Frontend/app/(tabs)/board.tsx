import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions, Platform, RefreshControl, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, BOLD_STYLES, ENTITY_COLORS, FONT, FONT_FAMILY, RADIUS, SPACE } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import { formatDateTime, getDateTimeHint } from '../../utils/dateTimeFormatter';

type Ticket = { id: string; title: string; dueDate: string; priority: string; status: string; entity_type?: string; project_id?: string };

const STATUS_FLOW = ['TODO', 'IN_PROGRESS', 'DONE'];
const ENTITY_TYPES = ['TO_DO', 'DEADLINE', 'MEETING', 'REST'];

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
  const [editEntityType, setEditEntityType] = useState('TO_DO');
  const [editProjectId, setEditProjectId] = useState('');
  const [dateTimeError, setDateTimeError] = useState('');

  const isMobile = screenWidth < 768;
  const COLUMN_WIDTH = isMobile ? screenWidth * 0.75 : 340;

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
      Alert.alert('SYSTEM_ERR', 'Backend connection severed. Ticket status update failed.');
    }
  };

  const saveEditedTicket = async () => {
    if (!editingTicket) return;
    const formatted = formatDateTime(editDueDate, true);
    if (!formatted) {
      setDateTimeError('Invalid date/time. Use: DD/MM/YYYY HH:MM or DD/MM/YYYY');
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets/${editingTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          priority: editPriority.toUpperCase(),
          dueDate: formatted,
          entity_type: editEntityType,
          project_id: editProjectId || null,
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
      Alert.alert('SYSTEM_ERR', 'Backend connection severed. Ticket save failed.');
    }
  };

  const deleteTicket = async () => {
    if (!editingTicket) return;
    Alert.alert(
      'delete ticket',
      'Remove this ticket permanently?',
      [
        { text: 'cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'delete',
          onPress: async () => {
            try {
              const res = await fetch(`${BACKEND_URL}/api/tickets/${editingTicket.id}?user_id=${user?.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
              });
              const data = await res.json();
              if (data.success) {
                setEditingTicket(null);
                setEditTitle('');
                setEditPriority('');
                setEditDueDate('');
                fetchTickets();
                Alert.alert('Success', 'Ticket deleted');
              } else {
                Alert.alert('Error', data.error || 'Failed to delete ticket');
              }
            } catch (e: any) {
              console.error("Failed to delete ticket", e);
              Alert.alert('SYSTEM_ERR', 'Backend connection severed. Ticket deletion failed.');
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  const openEditModal = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setEditTitle(ticket.title);
    setEditPriority(ticket.priority);
    setEditDueDate(ticket.dueDate);
    setEditEntityType(ticket.entity_type || 'TO_DO');
    setEditProjectId(ticket.project_id || '');
    setDateTimeError('');
  };

  const closeEditModal = () => {
    setEditingTicket(null);
    setEditTitle('');
    setEditPriority('');
    setEditDueDate('');
    setEditEntityType('TO_DO');
    setEditProjectId('');
    setDateTimeError('');
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
    return COLORS.accent;
  };

  const getPriorityPillStyle = (priority: string) => {
    const isHigh = priority === 'high';
    return {
      backgroundColor: isHigh ? 'rgba(255, 44, 85, 0.06)' : 'rgba(0, 255, 102, 0.06)',
      borderColor: isHigh ? COLORS.danger : COLORS.accent,
    };
  };

  const renderColumn = (title: string, filterStatus: string) => {
    const columnTickets = tickets.filter(t => (t.status || 'TODO').toUpperCase() === filterStatus);
    const isDone = filterStatus === 'DONE';

    return (
      <View style={[styles.column, { width: COLUMN_WIDTH }]}>
        <View style={styles.columnHeaderContainer}>
          <Text style={styles.columnHeaderText}>{filterStatus.toLowerCase().replace('_', ' ')}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{columnTickets.length}</Text>
          </View>
        </View>

        <ScrollView style={styles.cardList} showsVerticalScrollIndicator={false}>
          {columnTickets.map((ticket) => (
            <TouchableOpacity
              key={ticket.id}
              style={[styles.brutalistCard, isDone && styles.brutalistCardDone]}
              onPress={() => openEditModal(ticket)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardTitle, isDone && styles.cardTitleDone]}>{ticket.title}</Text>
              <View style={styles.cardFooter}>
                <View style={[styles.priorityPill, getPriorityPillStyle(ticket.priority)]}>
                  <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(ticket.priority) }]} />
                  <Text style={[styles.priorityText, { color: getPriorityColor(ticket.priority) }]}>
                    {ticket.priority.toLowerCase()}
                  </Text>
                </View>
                <Text style={styles.dueDateText}>{ticket.dueDate || '—'}</Text>
              </View>

              <View style={styles.actionRow}>
                {ticket.status === 'TODO' && (
                  <TouchableOpacity
                    style={[styles.moveBtn, { marginLeft: 'auto' }]}
                    onPress={() => updateTicketStatus(ticket.id, 'IN_PROGRESS')}
                  >
                    <Feather name="arrow-right" size={FONT.xs} color={COLORS.accent} />
                    <Text style={styles.moveBtnText}>start</Text>
                  </TouchableOpacity>
                )}
                {ticket.status === 'IN_PROGRESS' && (
                  <View style={{ flexDirection: 'row', gap: SPACE.sm, width: '100%' }}>
                    <TouchableOpacity
                      style={[styles.moveBtn, { flex: 1 }]}
                      onPress={() => updateTicketStatus(ticket.id, 'TODO')}
                    >
                      <Feather name="arrow-left" size={FONT.xs} color={COLORS.textMuted} />
                      <Text style={styles.moveBtnText}>back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.moveBtn, { flex: 1 }]}
                      onPress={() => updateTicketStatus(ticket.id, 'DONE')}
                    >
                      <Feather name="check" size={FONT.xs} color={COLORS.accent} />
                      <Text style={styles.moveBtnText}>done</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {ticket.status === 'DONE' && (
                  <TouchableOpacity
                    style={styles.moveBtn}
                    onPress={() => updateTicketStatus(ticket.id, 'IN_PROGRESS')}
                  >
                    <Feather name="rotate-ccw" size={FONT.xs} color={COLORS.textMuted} />
                    <Text style={styles.moveBtnText}>reopen</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>board</Text>
          <Text style={styles.headerSubtitle}>~/kanban</Text>
        </View>
        <TouchableOpacity
          onPress={handleRefresh}
          style={styles.refreshBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="refresh-cw" size={FONT.md} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>loading...</Text>
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>$ no tasks found</Text>
          <Text style={styles.emptySubtext}>create tasks in chat to begin.</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          scrollEnabled={isMobile}
          snapToInterval={isMobile ? COLUMN_WIDTH + SPACE.md : undefined}
          snapToAlignment={isMobile ? 'start' : undefined}
          decelerationRate={isMobile ? 'fast' : 'normal'}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={styles.boardScroll}
          contentContainerStyle={isMobile
            ? { paddingHorizontal: SPACE.lg, gap: SPACE.md, paddingVertical: SPACE.lg }
            : { paddingHorizontal: SPACE.xl, paddingVertical: SPACE.lg, gap: SPACE.md, flexDirection: 'row' }
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.accent} />}
        >
          {renderColumn('TODO', 'TODO')}
          {renderColumn('IN PROGRESS', 'IN_PROGRESS')}
          {renderColumn('DONE', 'DONE')}
        </ScrollView>
      )}

      <Modal visible={editingTicket !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          >
            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={{ paddingVertical: SPACE.lg, paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xxl }}
              scrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>edit task</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="task title"
                placeholderTextColor={COLORS.textMuted}
                value={editTitle}
                onChangeText={setEditTitle}
                selectionColor={COLORS.accent}
              />

              <Text style={styles.inputLabel}>priority</Text>
              <View style={styles.prioritySelector}>
                {['low', 'medium', 'high'].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.prioritySelectBtn, editPriority === p && { backgroundColor: getPriorityColor(p), borderColor: getPriorityColor(p) }]}
                    onPress={() => setEditPriority(p)}
                  >
                    <Text style={[styles.prioritySelectText, editPriority === p && { color: COLORS.bg, fontWeight: '700' }]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>entity type</Text>
              <View style={styles.entityTypeSelector}>
                {ENTITY_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.entityTypeBtn,
                      editEntityType === type && {
                        borderColor: ENTITY_COLORS[type],
                        backgroundColor: ENTITY_COLORS[type] + '15'
                      }
                    ]}
                    onPress={() => setEditEntityType(type)}
                  >
                    <Text style={[styles.entityTypeText, editEntityType === type && { color: ENTITY_COLORS[type] }]}>
                      {type.toLowerCase().replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>project id (optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="project id"
                placeholderTextColor={COLORS.textMuted}
                value={editProjectId}
                onChangeText={setEditProjectId}
                selectionColor={COLORS.accent}
              />

              <Text style={styles.inputLabel}>due date</Text>
              <TextInput
                style={[styles.modalInput, dateTimeError ? styles.errorInput : undefined]}
                placeholder="DD/MM/YYYY HH:MM or DD/MM/YYYY"
                placeholderTextColor={COLORS.textMuted}
                value={editDueDate}
                onChangeText={(text) => { setEditDueDate(text); setDateTimeError(''); }}
                selectionColor={COLORS.accent}
              />
              {dateTimeError ? (
                <Text style={styles.errorText}>{dateTimeError}</Text>
              ) : (
                <Text style={styles.hintText}>formats: DD/MM/YYYY HH:MM, 09/04/2026 14:30</Text>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeEditModal}>
                  <Text style={styles.cancelText}>cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={deleteTicket}>
                  <Text style={styles.deleteBtnText}>delete</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveEditedTicket}>
                  <Text style={styles.saveBtnText}>save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  headerTitle: { fontSize: FONT.xxl, fontWeight: '500', color: COLORS.textPrimary, fontFamily: FONT_FAMILY.sans },
  headerSubtitle: { fontSize: FONT.md, color: COLORS.textMuted, fontFamily: FONT_FAMILY.mono, marginTop: 2 },
  refreshBtn: {
    width: 26, height: 26, justifyContent: 'center', alignItems: 'center',
    borderRadius: RADIUS.sm, backgroundColor: 'transparent',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.xl },
  loadingText: { color: COLORS.textMuted, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono },
  emptyTitle: { color: COLORS.textMuted, fontSize: FONT.base, fontFamily: FONT_FAMILY.mono, marginBottom: SPACE.sm },
  emptySubtext: { color: COLORS.textGhost, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono, textAlign: 'center' },
  boardScroll: { flex: 1 },

  column: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    minHeight: '100%',
  },
  columnHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.md,
    paddingBottom: SPACE.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  columnHeaderText: {
    fontSize: FONT.sm,
    fontWeight: '500',
    color: COLORS.textMuted,
    letterSpacing: 0.04 * FONT.sm,
    fontFamily: FONT_FAMILY.mono,
  },
  countBadge: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACE.xs,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: { color: COLORS.textGhost, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  cardList: { flex: 1 },

  brutalistCard: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    marginBottom: SPACE.sm,
  },
  brutalistCardDone: { opacity: 0.4 },
  cardTitle: {
    color: COLORS.textPrimary,
    fontWeight: '500',
    fontSize: FONT.md,
    marginBottom: SPACE.sm,
    lineHeight: FONT.md * 1.4,
    fontFamily: FONT_FAMILY.sans,
  },
  cardTitleDone: { color: COLORS.textMuted },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
  },
  priorityDot: { width: 5, height: 5, borderRadius: 3 },
  priorityText: { fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  dueDateText: { color: COLORS.textGhost, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  actionRow: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm, width: '100%' },
  moveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    justifyContent: 'center',
  },
  moveBtnText: { color: COLORS.textMuted, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.lg,
  },
  modalContent: {
    width: '100%', maxWidth: 460,
    backgroundColor: COLORS.bg,
    borderWidth: 1, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.lg,
    maxHeight: '85%',
  },
  modalTitle: {
    color: COLORS.textSecondary, fontSize: FONT.md, fontFamily: FONT_FAMILY.mono,
    fontWeight: '500', marginBottom: SPACE.md,
  },
  modalInput: {
    backgroundColor: COLORS.surface, color: COLORS.textPrimary,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderMid,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    marginBottom: SPACE.md, fontSize: FONT.md, fontFamily: FONT_FAMILY.mono,
  },
  inputLabel: {
    color: COLORS.textMuted, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono,
    marginBottom: SPACE.xs, fontWeight: '500',
  },
  datePickerBtn: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm,
    marginBottom: SPACE.md, flexDirection: 'row', alignItems: 'center',
  },
  datePickerText: { color: COLORS.textPrimary, fontFamily: FONT_FAMILY.mono, fontSize: FONT.md, flex: 1 },
  prioritySelector: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.md },
  prioritySelectBtn: {
    flex: 1, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.borderMid, borderRadius: RADIUS.md,
    paddingVertical: SPACE.sm, alignItems: 'center', justifyContent: 'center',
  },
  prioritySelectText: { color: COLORS.textMuted, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono },
  entityTypeSelector: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.md, flexWrap: 'wrap' },
  entityTypeBtn: {
    flex: 1, minWidth: '22%',
    backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.borderMid,
    borderRadius: RADIUS.md, paddingVertical: SPACE.sm, alignItems: 'center', justifyContent: 'center',
  },
  entityTypeText: { color: COLORS.textMuted, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  cancelText: { color: COLORS.textMuted, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono },
  modalActions: { flexDirection: 'column', width: '100%', gap: SPACE.sm, marginTop: SPACE.lg },
  cancelBtn: {
    width: '100%', backgroundColor: 'transparent',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderMid,
    paddingVertical: SPACE.sm, alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: {
    width: '100%', backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md, paddingVertical: SPACE.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: COLORS.bg, fontWeight: '500', fontSize: FONT.md, fontFamily: FONT_FAMILY.mono },
  deleteBtn: {
    width: '100%', backgroundColor: 'transparent',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.danger,
    paddingVertical: SPACE.sm, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { color: COLORS.danger, fontSize: FONT.md, fontFamily: FONT_FAMILY.mono },
  errorInput: { borderColor: COLORS.danger },
  errorText: { color: COLORS.danger, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono, marginTop: SPACE.xs, marginBottom: SPACE.sm },
  hintText: { color: COLORS.textGhost, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono, marginTop: SPACE.xs, marginBottom: SPACE.sm },
});
