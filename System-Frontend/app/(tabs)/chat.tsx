import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Modal, useWindowDimensions, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, FONT, FONT_FAMILY, SPACE } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import { CHAT_CONFIG, TIME_CONFIG, getTimePeriodDisplay, formatTime } from '../../constants/appConfig';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDateTime, getDateTimeHint } from '../../utils/dateTimeFormatter';

// Generate UUID manually for broader compatibility
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default function ChatScreen() {
  const { user, logout } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  // 1. ALL HOOKS MUST BE AT THE TOP
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [dateTimeError, setDateTimeError] = useState('');

  // Session/Thread state - now holds objects with name and isDaily flag
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [activeSessionName, setActiveSessionName] = useState<string>('DAILY_LOG');
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Thread creation modal state (cross-platform, works on web + native)
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [threadNameInput, setThreadNameInput] = useState('');

  // File system directory modal state
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);

  // Time awareness state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timePeriod, setTimePeriod] = useState(getTimePeriodDisplay());

  // AbortController for canceling history requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Responsive dimensions
  const isMobile = screenWidth < 768;
  const bubbleMaxWidth = isMobile ? '85%' : '40%';

  // Helper: Get today's daily log ID
  const getTodayId = () => {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    return `DAILY_LOG_${dateStr}`;
  };

  // Memoize loadHistory so it can be safely used in hooks
  const loadHistory = useCallback(async (sessionId?: string) => {
    if (!user) return;

    const sessionToLoad = sessionId || activeSessionId;
    if (!sessionToLoad) return;

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/history?user_id=${user.id}&session_id=${sessionToLoad}`, {
        signal: abortControllerRef.current.signal
      });
      const data = await res.json();
      if (data.success) setMessages(data.history);
      else {
        console.error("History load failed:", data.error);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error("History fetch failed:", e.message);
        Alert.alert('SYSTEM_ERR', 'Backend connection severed. Chat history unavailable.');
      }
    }
  }, [user, activeSessionId]);

  // Fetch available sessions for the user
  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoadingSessions(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/sessions?user_id=${user.id}`);
      const data = await res.json();
      if (data.success) {
        // Transform backend sessions to include names and isDaily flag
        let sessions = data.sessions.map((session: any) => {
          const isDaily = session.id.startsWith('DAILY_LOG_');
          return {
            id: session.id,
            name: isDaily ? session.id : session.id.replace(/_/g, ' '),
            isDaily: isDaily
          };
        });

        // Check if today's daily log exists, if not, inject it
        const todayId = getTodayId();
        const todayExists = sessions.some((s: any) => s.id === todayId);
        if (!todayExists) {
          sessions.unshift({
            id: todayId,
            name: todayId,
            isDaily: true
          });
        }

        setAvailableSessions(sessions);

        // Set active session: default to today's daily log if not yet persisted
        let savedSessionId = await AsyncStorage.getItem('@active_session_id');
        if (!savedSessionId) {
          savedSessionId = todayId;
          await AsyncStorage.setItem('@active_session_id', savedSessionId);
        }

        const activeSession = sessions.find((s: any) => s.id === savedSessionId);
        if (activeSession) {
          setActiveSessionId(savedSessionId);
          setActiveSessionName(activeSession.name);
        }
      } else {
        console.error("Sessions load failed:", data.error);
        Alert.alert('SYSTEM_ERR', 'Failed to load session directory.');
      }
    } catch (e: any) {
      console.error("Sessions fetch failed:", e.message);
      Alert.alert('SYSTEM_ERR', 'Backend connection severed. Check your connection.');
    }
    setLoadingSessions(false);
  }, [user, getTodayId]);

  // Initialize session on mount
  useEffect(() => {
    const initializeSession = async () => {
      if (!user) return;
      await loadSessions();
    };
    initializeSession();
  }, [user]);

  // Update time awareness every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now);
      setTimePeriod(getTimePeriodDisplay());
    };

    updateTime();

    const interval = setInterval(updateTime, CHAT_CONFIG.TIME_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Load history when activeSessionId changes
  useEffect(() => {
    if (activeSessionId) {
      loadHistory(activeSessionId);
    }
  }, [activeSessionId]);

  useFocusEffect(
    useCallback(() => {
      if (activeSessionId) {
        loadHistory(activeSessionId);
      }
      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [activeSessionId, loadHistory])
  );

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // 2. EARLY RETURN GOES HERE (After all hooks)
  if (!user) return null;

  // 3. LOGIC FUNCTIONS
  const createNewSession = async () => {
    setThreadNameInput('');
    setShowThreadModal(true);
  };

  const confirmCreateThread = async () => {
    if (!threadNameInput || !threadNameInput.trim()) {
      Alert.alert('ERROR', 'THREAD_NAME_REQUIRED');
      return;
    }

    const formattedName = threadNameInput.trim().toUpperCase().replace(/\s+/g, '_');
    const newSessionId = formattedName;

    const newSession = {
      id: newSessionId,
      name: formattedName,
      isDaily: false
    };
    setAvailableSessions(prev => [...prev, newSession]);

    await AsyncStorage.setItem('@active_session_id', newSessionId);
    setActiveSessionId(newSessionId);
    setActiveSessionName(formattedName);
    setMessages([]);

    setShowThreadModal(false);
    setThreadNameInput('');
  };

  const cancelCreateThread = () => {
    setShowThreadModal(false);
    setThreadNameInput('');
  };

  const switchSession = async (sessionId: string) => {
    const session = availableSessions.find((s: any) => s.id === sessionId);
    if (session) {
      await AsyncStorage.setItem('@active_session_id', sessionId);
      setActiveSessionId(sessionId);
      setActiveSessionName(session.name);
    }
  };

  const deleteSession = async (sessionId: string) => {
    Alert.alert(
      '[ DELETE_ENTITY ]',
      'Remove this session and all messages?',
      [
        {
          text: 'CANCEL',
          onPress: () => {},
          style: 'cancel'
        },
        {
          text: 'DELETE',
          onPress: async () => {
            try {
              const res = await fetch(`${BACKEND_URL}/api/chat/sessions/${sessionId}?user_id=${user?.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
              });
              const data = await res.json();
              if (data.success) {
                setAvailableSessions(availableSessions.filter((s: any) => s.id !== sessionId));
                if (sessionId === activeSessionId) {
                  setActiveSessionId('DAILY_LOG');
                  setActiveSessionName('DAILY_LOG');
                }
                Alert.alert('Success', 'Session deleted');
              } else {
                Alert.alert('Error', data.error || 'Failed to delete session');
              }
            } catch (e: any) {
              console.error("Failed to delete session", e);
              Alert.alert('Network Error', 'Could not delete session. Please try again.');
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  // Format session ID for display (short version like THREAD_A1B2)
  const formatSessionId = (id: string) => {
    if (id.startsWith('DAILY_LOG_')) return id;
    return id.substring(0, 16).toUpperCase();
  };

  const saveEditedTask = async () => {
    if (!editingTask?.dueDate) {
      setDateTimeError('Date/time is required');
      return;
    }
    const formatted = formatDateTime(editingTask.dueDate, true);
    if (!formatted) {
      setDateTimeError('Invalid date/time. Use: DD/MM/YYYY HH:MM');
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingTask,
          dueDate: formatted,
          priority: editingTask.priority?.toUpperCase(),
          user_id: user.id
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingTask(null);
        loadHistory();
      } else {
        Alert.alert('Error', data.error || 'Failed to save task');
      }
    } catch (e: any) {
      console.error("Task save failed", e);
      Alert.alert('SYSTEM_ERR', 'Backend connection severed. Task save failed.');
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || loading || !activeSessionId) return;
    const userMsg = { id: Date.now().toString(), text: inputText, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const activeModel = await AsyncStorage.getItem('@system_active_model');
      const customDirective = await AsyncStorage.getItem('@system_custom_prompt');

      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          user_id: user.id,
          model: activeModel,
          session_id: activeSessionId,
          system_directive: customDirective
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { id: 'ai-'+Date.now(), text: data.reply, sender: 'ai', task: data.task }]);
      } else {
        console.error("Chat response error:", data.error);
        Alert.alert('Error', data.error || 'Failed to process message');
      }
    } catch (e: any) {
      console.error("Chat send failed", e);
      Alert.alert('SYSTEM_ERR', 'Backend connection severed. Message sending failed.');
    }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* STEP 5 — top bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>system / {user.username.toLowerCase()}</Text>
          <Text style={styles.headerSep}>/</Text>
          <Text style={styles.headerHighlight}>{activeSessionName.toLowerCase()}</Text>
          {CHAT_CONFIG.SHOW_TIME_IN_HEADER && (
            <Text style={styles.headerTime}>
              {CHAT_CONFIG.SHOW_TIME_PERIOD ? `${timePeriod.display} · ` : ''}{formatTime(currentTime, 'time')}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.directoryBtn} onPress={() => setShowDirectoryModal(true)}>
            <Text style={styles.directoryBtnText}>dir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* STEP 7 — messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatScroll}
        contentContainerStyle={{ paddingHorizontal: isMobile ? 16 : 32, paddingVertical: 16, paddingBottom: SPACE.xxl }}
      >
        {messages.map((msg) => (
          <View key={msg.id} style={[msg.sender === 'user' ? styles.userRow : styles.aiRow, { width: '100%' }]}>
            <View style={[styles.bubble, msg.sender === 'user' ? styles.userBubble : styles.aiBubble, { maxWidth: bubbleMaxWidth }]}>
              <Text style={msg.sender === 'user' ? styles.userText : styles.aiText}>
                {msg.sender === 'user' ? `> ${msg.text}` : msg.text}
              </Text>
            </View>

            {msg.task && (
              <TouchableOpacity
                style={[styles.ticketCard, { maxWidth: isMobile ? '85%' : 350 }]}
                onPress={() => setEditingTask(msg.task)}
              >
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketHeaderText}>{msg.task.id}</Text>
                </View>
                <Text style={styles.taskTitle}>{msg.task.title}</Text>
                <View style={styles.taskFooter}>
                  <View style={[styles.priorityDot, { backgroundColor:
                    msg.task.priority?.toUpperCase() === 'HIGH'   ? COLORS.danger  :
                    msg.task.priority?.toUpperCase() === 'MEDIUM' ? COLORS.warning : COLORS.accent
                  }]} />
                  <Text style={styles.taskDate}>{msg.task.dueDate || 'no date'}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {loading && (
          <Text style={styles.processingText}>processing...</Text>
        )}
      </ScrollView>

      {/* EDIT MODAL */}
      <Modal visible={!!editingTask} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={100} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={styles.ticketModalContent}>
              <View style={styles.ticketModalHeader}>
                <View style={styles.ticketModalHeaderTitle}>
                  <Feather name="edit-2" size={13} color={COLORS.accent} style={{ marginRight: 8 }} />
                  <Text style={styles.ticketModalTitle}>edit ticket</Text>
                </View>
                <TouchableOpacity onPress={() => setEditingTask(null)}>
                  <Feather name="x" size={13} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.ticketModalScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.ticketModalSection}>
                  <Text style={styles.ticketModalSectionLabel}>/ title</Text>
                  <TextInput
                    style={styles.ticketModalInput}
                    value={editingTask?.title}
                    onChangeText={(t) => setEditingTask({...editingTask, title: t})}
                    placeholder="enter task title..."
                    placeholderTextColor={COLORS.textMuted}
                    maxLength={100}
                  />
                </View>

                <View style={styles.ticketModalSection}>
                  <Text style={styles.ticketModalSectionLabel}>/ due_date</Text>
                  <TextInput
                    style={[styles.ticketModalInput, dateTimeError && styles.errorInput]}
                    placeholder="DD/MM/YYYY HH:MM or DD/MM/YYYY"
                    value={editingTask?.dueDate}
                    onChangeText={(text) => {
                      setEditingTask({...editingTask, dueDate: text});
                      setDateTimeError('');
                    }}
                    placeholderTextColor={COLORS.textMuted}
                  />
                  {dateTimeError ? (
                    <Text style={styles.errorText}>{dateTimeError}</Text>
                  ) : (
                    <Text style={styles.hintText}>formats: DD/MM/YYYY HH:MM, 09/04/2026 14:30</Text>
                  )}
                </View>

                <View style={styles.ticketModalSection}>
                  <Text style={styles.ticketModalSectionLabel}>/ priority</Text>
                  <View style={styles.ticketModalSelectRow}>
                    {['low', 'medium', 'high'].map((p) => {
                      const priorityColors: { [key: string]: string } = {
                        low: COLORS.accent,
                        medium: COLORS.warning,
                        high: COLORS.danger
                      };
                      const isActive = editingTask?.priority === p;
                      const activeColor = priorityColors[p];
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[
                            styles.ticketModalSelectBtn,
                            isActive && { backgroundColor: activeColor, borderColor: activeColor }
                          ]}
                          onPress={() => setEditingTask({...editingTask, priority: p})}
                        >
                          <Text style={[
                            styles.ticketModalSelectBtnText,
                            isActive && { color: COLORS.bg, fontWeight: '700' }
                          ]}>
                            {p}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.ticketModalSection}>
                  <Text style={styles.ticketModalSectionLabel}>/ status</Text>
                  <View style={styles.ticketModalSelectRow}>
                    {['TODO', 'IN_PROGRESS', 'DONE'].map((s) => {
                      const statusColors: { [key: string]: string } = {
                        'TODO':        COLORS.textSecondary,
                        'IN_PROGRESS': COLORS.warning,
                        'DONE':        COLORS.accent
                      };
                      const isActive = editingTask?.status === s;
                      const activeColor = statusColors[s];
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.ticketModalSelectBtn,
                            isActive && { backgroundColor: activeColor, borderColor: activeColor }
                          ]}
                          onPress={() => setEditingTask({...editingTask, status: s})}
                        >
                          <Text style={[
                            styles.ticketModalSelectBtnText,
                            isActive && { color: COLORS.bg, fontWeight: '700' }
                          ]}>
                            {s === 'IN_PROGRESS' ? 'prog' : s.toLowerCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.ticketModalFooter}>
                <TouchableOpacity
                  style={styles.ticketModalCancelBtn}
                  onPress={() => setEditingTask(null)}
                >
                  <Feather name="x-circle" size={13} color={COLORS.textMuted} />
                  <Text style={styles.ticketModalCancelBtnText}>cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ticketModalSaveBtn}
                  onPress={saveEditedTask}
                >
                  <Feather name="check-circle" size={13} color={COLORS.bg} />
                  <Text style={styles.ticketModalSaveBtnText}>save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* STEP 9 — SYS_DIRECTORY MODAL */}
      <Modal visible={showDirectoryModal} transparent animationType="fade">
        <View style={styles.directoryModalOverlay}>
          <View style={styles.directoryModalContent}>
            <View style={styles.directoryHeader}>
              <Text style={styles.directoryTitle}>
                <Text style={{ color: COLORS.accent }}>/</Text>
                {' '}root_system_directory
              </Text>
              <TouchableOpacity onPress={() => setShowDirectoryModal(false)}>
                <Feather name="x" size={FONT.sm} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.directoryScroll} showsVerticalScrollIndicator={false}>
              {/* DAILY JOURNALS */}
              <Text style={styles.directoryLabel}>daily</Text>
              {availableSessions
                .filter(s => s.isDaily)
                .sort((a, b) => b.id.localeCompare(a.id))
                .map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    style={[
                      styles.directoryEntry,
                      session.id === activeSessionId && styles.directoryEntryActive
                    ]}
                    onPress={() => {
                      switchSession(session.id);
                      setShowDirectoryModal(false);
                    }}
                  >
                    <View style={[
                      styles.entryDot,
                      session.id === activeSessionId && styles.entryDotActive
                    ]} />
                    <Text style={[
                      styles.directoryEntryText,
                      session.id === activeSessionId && styles.directoryEntryTextActive
                    ]}>
                      {session.id.replace('DAILY_LOG_', '')}
                    </Text>
                  </TouchableOpacity>
                ))}

              {/* CUSTOM THREADS */}
              <Text style={[styles.directoryLabel, { marginTop: 12 }]}>threads</Text>
              {availableSessions.filter(s => !s.isDaily).length > 0 ? (
                availableSessions
                  .filter(s => !s.isDaily)
                  .map(session => (
                    <View
                      key={session.id}
                      style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 2 }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.directoryEntry,
                          { flex: 1 },
                          session.id === activeSessionId && styles.directoryEntryActive
                        ]}
                        onPress={() => {
                          switchSession(session.id);
                          setShowDirectoryModal(false);
                        }}
                      >
                        <View style={[
                          styles.entryDot,
                          session.id === activeSessionId && styles.entryDotActive
                        ]} />
                        <Text style={[
                          styles.directoryEntryText,
                          session.id === activeSessionId && styles.directoryEntryTextActive
                        ]}>
                          {session.name.toLowerCase()}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteEntryBtn}
                        onPress={() => deleteSession(session.id)}
                      >
                        <Feather name="trash-2" size={11} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  ))
              ) : (
                <Text style={styles.directoryEntryDisabled}>empty</Text>
              )}

              {/* PROJECTS */}
              <Text style={[styles.directoryLabel, { marginTop: 12 }]}>projects</Text>
              <Text style={styles.directoryEntryDisabled}>coming soon</Text>
            </ScrollView>

            <View style={styles.directoryActions}>
              <TouchableOpacity style={styles.directoryNewBtn} onPress={createNewSession}>
                <Text style={styles.directoryNewBtnText}>+ new_thread</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.directoryCloseBtn} onPress={() => setShowDirectoryModal(false)}>
                <Text style={styles.directoryCloseBtnText}>close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* THREAD CREATION MODAL */}
      <Modal visible={showThreadModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={100} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>new_thread /</Text>
              <Text style={styles.modalSubtitle}>thread name:</Text>
              <TextInput
                style={styles.modalInput}
                value={threadNameInput}
                onChangeText={setThreadNameInput}
                placeholder="enter thread name..."
                placeholderTextColor={COLORS.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={confirmCreateThread}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={cancelCreateThread}>
                  <Text style={styles.cancelText}>cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={confirmCreateThread}>
                  <Text style={styles.saveBtnText}>create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* STEP 8 — input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        <View style={[styles.inputArea, { paddingHorizontal: isMobile ? 16 : 32 }]}>
          <View style={styles.inputRow}>
            <Text style={styles.inputPrompt}>›</Text>
            <TextInput
              style={styles.input}
              placeholder="type a message..."
              placeholderTextColor={COLORS.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={sendMessage}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather
                name="arrow-up"
                size={FONT.md}
                color={inputText.length > 0 ? COLORS.accent : COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // ── Step 5: top bar ──────────────────────────────────────────
  header: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    minHeight: 40,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  headerTitle: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
  },
  headerSep: {
    color: COLORS.textGhost,
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
    marginHorizontal: 4,
  },
  headerHighlight: {
    color: COLORS.textSecondary,
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
  },
  headerTime: {
    color: COLORS.textMuted,
    fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  directoryBtn: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    backgroundColor: 'transparent',
  },
  directoryBtnText: {
    color: COLORS.textMuted,
    fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
  },

  // ── Step 7: messages ─────────────────────────────────────────
  chatScroll: { flex: 1 },
  userRow: { alignSelf: 'flex-end', marginBottom: 14, alignItems: 'flex-end' },
  aiRow:   { alignSelf: 'flex-start', marginBottom: 14, alignItems: 'flex-start' },
  bubble: { borderWidth: 0, borderRadius: 0 },
  userBubble: { backgroundColor: 'transparent' },
  aiBubble:   { backgroundColor: 'transparent' },
  userText: {
    color: COLORS.textPrimary,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.sans,
    lineHeight: 19,
  },
  aiText: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.sans,
    lineHeight: 20,
  },
  processingText: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
    marginTop: 14,
    textAlign: 'left',
  },

  // ticket card
  ticketCard: {
    marginTop: 8,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderLeftWidth: 1.5,
    borderLeftColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  ticketHeader: { marginBottom: 4 },
  ticketHeaderText: {
    color: COLORS.textGhost,
    fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
  },
  taskTitle: {
    color: COLORS.textPrimary,
    fontWeight: '500',
    fontSize: FONT.md,
    marginBottom: 6,
    fontFamily: FONT_FAMILY.sans,
  },
  taskFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priorityDot: { width: 5, height: 5, borderRadius: 3 },
  taskDate: {
    color: COLORS.textMuted,
    fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
  },
  taskPriority: {
    color: COLORS.textMuted,
    fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
  },

  // ── Step 8: input bar ────────────────────────────────────────
  inputArea: {
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.lg,
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 6,
  },
  inputPrompt: {
    color: COLORS.accent,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    paddingVertical: 0,
  },
  sendBtn: {
    width: 22,
    height: 22,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  // ── Modals (edit task) ────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: COLORS.bg,
    padding: 18,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
  },
  ticketModalContent: {
    width: '92%',
    maxHeight: '88%',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  ticketModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  ticketModalHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketModalTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
  },
  ticketModalScroll: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  ticketModalSection: { marginBottom: 16 },
  ticketModalSectionLabel: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
    letterSpacing: 0.5,
    marginBottom: 8,
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
  },
  ticketModalInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT.md,
    height: 38,
  },
  errorInput: { borderColor: COLORS.danger },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
    marginTop: 4,
  },
  hintText: {
    color: COLORS.textGhost,
    fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
    marginTop: 4,
  },
  ticketModalInputHint: {
    color: COLORS.textGhost,
    fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
    marginTop: 6,
  },
  ticketModalRowSections: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  ticketModalHalfSection: { flex: 1 },
  ticketModalSelectRow: { flexDirection: 'row', gap: 8 },
  ticketModalSelectBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketModalSelectBtnText: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
  },
  ticketModalDivider: { width: 1, backgroundColor: COLORS.border },
  ticketModalFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  ticketModalCancelBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.md,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  ticketModalCancelBtnText: {
    color: COLORS.textMuted,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
  },
  ticketModalSaveBtn: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  ticketModalSaveBtnText: {
    color: COLORS.bg,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
  },

  // thread create modal
  modalTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
    marginBottom: 12,
  },
  modalSubtitle: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT.md,
  },
  rowInputs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  halfInput: { flex: 1 },
  inputLabel: {
    color: COLORS.textMuted,
    fontSize: FONT.xs,
    fontFamily: FONT_FAMILY.mono,
    marginBottom: 4,
  },
  selectRow: { flexDirection: 'row', gap: 6 },
  selectBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  selectBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentTint },
  selectBtnText:       { color: COLORS.textSecondary, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  selectBtnTextActive: { color: COLORS.accent },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
  },
  saveBtn: {
    backgroundColor: COLORS.accentTint,
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
  },
  saveBtnText: {
    color: COLORS.accent,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
  },

  // ── Step 9: directory modal ───────────────────────────────────
  directoryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  directoryModalContent: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.lg,
  },
  directoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  directoryTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
  },
  directoryScroll: {
    maxHeight: '60%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  directoryLabel: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
    marginBottom: 4,
    marginTop: 4,
  },
  directoryEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    paddingLeft: 18,
    borderRadius: RADIUS.sm,
    gap: 8,
  },
  directoryEntryActive: {
    backgroundColor: COLORS.surfaceAlt,
    borderLeftWidth: 1.5,
    borderLeftColor: COLORS.accent,
  },
  entryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderMid,
  },
  entryDotActive: {
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 2,
  },
  directoryEntryText: {
    color: COLORS.textMuted,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
  },
  directoryEntryTextActive: {
    color: COLORS.textPrimary,
  },
  directoryEntryDisabled: {
    color: COLORS.textGhost,
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
    paddingLeft: 18,
    marginBottom: 2,
  },
  directoryText: {
    color: COLORS.textMuted,
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
    lineHeight: 16,
  },
  deleteEntryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  directoryActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  directoryNewBtn: {
    flex: 1,
    backgroundColor: COLORS.accentTint,
    borderWidth: 1,
    borderColor: 'rgba(0,255,102,0.18)',
    borderRadius: RADIUS.md,
    paddingVertical: 7,
    alignItems: 'center',
  },
  directoryNewBtnText: {
    color: COLORS.accent,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    fontWeight: '500',
  },
  directoryCloseBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.md,
    paddingVertical: 7,
    alignItems: 'center',
  },
  directoryCloseBtnText: {
    color: COLORS.textMuted,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
  },

  // legacy style names kept to avoid unused-variable errors
  threadChipActive:         { backgroundColor: COLORS.accent, borderColor: COLORS.accent, borderWidth: 1 },
  threadChipDaily:          { borderColor: COLORS.danger, borderWidth: 1 },
  threadChipText:           { color: COLORS.textMuted, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  threadChipTextActive:     { color: COLORS.bg },
  modeBtn:                  { paddingVertical: 6, paddingHorizontal: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm },
  modeBtnText:              { color: COLORS.accent, fontSize: FONT.xs, fontFamily: FONT_FAMILY.mono },
  promptSelectorContainer:  { backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  promptOption:             { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'transparent', borderLeftWidth: 1.5, borderLeftColor: COLORS.borderMid, marginBottom: 2 },
  promptOptionActive:       { borderLeftColor: COLORS.accent, backgroundColor: COLORS.accentTint },
  promptOptionText:         { color: COLORS.textMuted, fontSize: FONT.sm, fontFamily: FONT_FAMILY.mono },
  promptOptionTextActive:   { color: COLORS.accent },
  promptOptionDesc:         { color: COLORS.textGhost, fontSize: FONT.xs, marginTop: 2, fontFamily: FONT_FAMILY.mono },
  promptOptionDescActive:   { color: COLORS.accent },
});
