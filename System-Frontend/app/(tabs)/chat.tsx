import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Modal, useWindowDimensions, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, BOLD_STYLES } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import { CHAT_CONFIG, TIME_CONFIG, getTimePeriodDisplay, formatTime } from '../../constants/appConfig';
import { Ionicons } from '@expo/vector-icons';
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
      // Load sessions on mount (which also sets default session)
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
    
    // Update immediately on mount
    updateTime();
    
    // Then update every minute
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
        // Cancel request when screen loses focus
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
    // Show modal to get thread name (works on web + native)
    setThreadNameInput('');
    setShowThreadModal(true);
  };

  const confirmCreateThread = async () => {
    if (!threadNameInput || !threadNameInput.trim()) {
      Alert.alert('ERROR', 'THREAD_NAME_REQUIRED');
      return;
    }

    // Format the session ID: uppercase, replace spaces with underscores
    const formattedName = threadNameInput.trim().toUpperCase().replace(/\s+/g, '_');
    const newSessionId = formattedName;

    // BUG FIX: Add to sessions state immediately (BEFORE closing modal)
    const newSession = {
      id: newSessionId,
      name: formattedName,
      isDaily: false
    };
    setAvailableSessions(prev => [...prev, newSession]);

    // Set as active and save to storage
    await AsyncStorage.setItem('@active_session_id', newSessionId);
    setActiveSessionId(newSessionId);
    setActiveSessionName(formattedName);
    setMessages([]);
    
    // Close modal
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
                // Remove from available sessions
                setAvailableSessions(availableSessions.filter((s: any) => s.id !== sessionId));
                // If current session was deleted, switch to daily
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
      // Retrieve the selected AI model from storage
      const activeModel = await AsyncStorage.getItem('@system_active_model');
      
      // Retrieve the custom system directive from settings
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
      <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>System / {user.username.toUpperCase()}</Text>
            <Text style={styles.headerHighlight}>// {activeSessionName.toUpperCase()}</Text>
            {CHAT_CONFIG.SHOW_TIME_IN_HEADER && (
              <Text style={styles.headerTime}>
                {CHAT_CONFIG.SHOW_TIME_PERIOD ? `${timePeriod.display} · ` : ''}{formatTime(currentTime, 'time')}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.directoryBtn} onPress={() => setShowDirectoryModal(true)}>
              <Text style={styles.directoryBtnText}>[ _SYS_DIRECTORY ]</Text>
            </TouchableOpacity>
          </View>
      </View>

      {/* Prompt Mode Selector */}
      <ScrollView ref={scrollViewRef} style={styles.chatScroll} contentContainerStyle={{ paddingHorizontal: isMobile ? '5%' : '10%', paddingVertical: 16 }}>
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
                <View style={styles.ticketHeader}><Text style={styles.ticketHeaderText}>TICKET_ID: {msg.task.id}</Text></View>
                <Text style={styles.taskTitle}>{msg.task.title.toUpperCase()}</Text>
                <View style={styles.taskFooter}>
                   <Text style={styles.taskDate}>{msg.task.dueDate || 'NO_DATE'}</Text>
                   <Text style={styles.taskPriority}>{msg.task.priority.toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {loading && <Text style={{ color: '#00FF66', fontWeight: '900', letterSpacing: 2, fontSize: 12, marginTop: 20, textAlign: 'center' }}>[ PROCESSING... ]</Text>}
      </ScrollView>

      {/* EDIT MODAL */}
      <Modal visible={!!editingTask} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={100} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={styles.ticketModalContent}>
              {/* Header */}
              <View style={styles.ticketModalHeader}>
                <View style={styles.ticketModalHeaderTitle}>
                  <Ionicons name="pencil" size={24} color="#00FF66" style={{ marginRight: 10 }} />
                  <Text style={styles.ticketModalTitle}>EDIT_TICKET</Text>
                </View>
                <TouchableOpacity onPress={() => setEditingTask(null)}>
                  <Ionicons name="close" size={28} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Scrollable Content */}
              <ScrollView style={styles.ticketModalScroll} showsVerticalScrollIndicator={false}>
                {/* Title Section */}
                <View style={styles.ticketModalSection}>
                  <Text style={styles.ticketModalSectionLabel}>/ TITLE</Text>
                  <TextInput 
                      style={styles.ticketModalInput} 
                      value={editingTask?.title} 
                      onChangeText={(t) => setEditingTask({...editingTask, title: t})}
                      placeholder="Enter task title..." 
                      placeholderTextColor="#444"
                      maxLength={100}
                  />
                </View>

                {/* Due Date Section */}
                <View style={styles.ticketModalSection}>
                  <Text style={styles.ticketModalSectionLabel}>/ DUE_DATE</Text>
                  <TextInput 
                    style={[styles.ticketModalInput, dateTimeError && styles.errorInput]}
                    placeholder="DD/MM/YYYY HH:MM or DD/MM/YYYY"
                    value={editingTask?.dueDate}
                    onChangeText={(text) => {
                      setEditingTask({...editingTask, dueDate: text});
                      setDateTimeError('');
                    }}
                    placeholderTextColor="#444"
                  />
                  {dateTimeError ? (
                    <Text style={styles.errorText}>{dateTimeError}</Text>
                  ) : (
                    <Text style={styles.hintText}>Formats: DD/MM/YYYY HH:MM, 09/04/2026 14:30, 09APR2026 2:30 PM</Text>
                  )}
                </View>

                {/* Priority Section */}
                <View style={styles.ticketModalSection}>
                  <Text style={styles.ticketModalSectionLabel}>/ PRIORITY</Text>
                  <View style={styles.ticketModalSelectRow}>
                    {['low', 'medium', 'high'].map((p) => {
                      const priorityColors: { [key: string]: string } = {
                        low: '#00FF66',
                        medium: '#FFD700',
                        high: '#FF2C55'
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
                            isActive && { color: '#000', fontWeight: '900' }
                          ]}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Status Section */}
                <View style={styles.ticketModalSection}>
                  <Text style={styles.ticketModalSectionLabel}>/ STATUS</Text>
                  <View style={styles.ticketModalSelectRow}>
                    {['TODO', 'IN_PROGRESS', 'DONE'].map((s) => {
                      const statusColors: { [key: string]: string } = {
                        'TODO': '#999',
                        'IN_PROGRESS': '#FFD700',
                        'DONE': '#00FF66'
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
                            isActive && { color: '#000', fontWeight: '900' }
                          ]}>
                            {s === 'IN_PROGRESS' ? 'PROG' : (s === 'TODO' ? 'TODO' : (s === 'DONE' ? 'DONE' : s))}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              {/* Footer Actions */}
              <View style={styles.ticketModalFooter}>
                <TouchableOpacity 
                  style={styles.ticketModalCancelBtn}
                  onPress={() => setEditingTask(null)}
                >
                  <Ionicons name="close-circle-outline" size={20} color="#666" />
                  <Text style={styles.ticketModalCancelBtnText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.ticketModalSaveBtn}
                  onPress={saveEditedTask}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
                  <Text style={styles.ticketModalSaveBtnText}>SAVE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* FILE SYSTEM DIRECTORY MODAL */}
      <Modal visible={showDirectoryModal} transparent animationType="fade">
        <View style={styles.directoryModalOverlay}>
          <View style={styles.directoryModalContent}>
            <View style={styles.directoryHeader}>
              <Text style={styles.directoryTitle}>/ ROOT_SYSTEM_DIRECTORY</Text>
              <TouchableOpacity onPress={() => setShowDirectoryModal(false)}>
                <Text style={styles.directoryCloseBtn}>[ X ]</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.directoryScroll} showsVerticalScrollIndicator={false}>
              {/* DAILY JOURNALS SECTION */}
              <Text style={styles.directoryLabel}>[DIRECTORY: DAILY_JOURNALS]</Text>
              {availableSessions
                .filter(s => s.isDaily)
                .sort((a, b) => b.id.localeCompare(a.id))
                .map((session, idx) => (
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
                    <Text style={[
                      styles.directoryEntryText,
                      session.id === activeSessionId && styles.directoryEntryTextActive
                    ]}>
                      {session.id === activeSessionId ? '●' : '○'} {session.id}
                    </Text>
                  </TouchableOpacity>
                ))}

              {/* CUSTOM THREADS SECTION */}
              <Text style={[styles.directoryLabel, { marginTop: 16 }]}>[DIRECTORY: CUSTOM_THREADS]</Text>
              {availableSessions.filter(s => !s.isDaily).length > 0 ? (
                availableSessions
                  .filter(s => !s.isDaily)
                  .map(session => (
                    <View
                      key={session.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginVertical: 4,
                      }}
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
                        <Text style={[
                          styles.directoryEntryText,
                          session.id === activeSessionId && styles.directoryEntryTextActive
                        ]}>
                          {session.id === activeSessionId ? '●' : '○'} {session.name}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          backgroundColor: '#000',
                          borderWidth: 1,
                          borderColor: '#FF2C55',
                          borderRadius: 0,
                          marginLeft: 8,
                        }}
                        onPress={() => deleteSession(session.id)}
                      >
                        <Text style={{ color: '#FF2C55', fontSize: 12, fontWeight: '900' }}>
                          [ DEL ]
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
              ) : (
                <Text style={styles.directoryEntryDisabled}>[ empty ]</Text>
              )}

              {/* PROJECTS SECTION */}
              <Text style={[styles.directoryLabel, { marginTop: 16 }]}>[DIRECTORY: PROJECTS]</Text>
              <Text style={styles.directoryEntryDisabled}>[ coming_soon ]</Text>
            </ScrollView>

            <View style={styles.directoryActions}>
              <TouchableOpacity style={styles.directoryActionBtn} onPress={createNewSession}>
                <Text style={styles.directoryActionText}>[ + NEW_THREAD ]</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.directoryActionBtn} onPress={() => setShowDirectoryModal(false)}>
                <Text style={styles.directoryActionText}>[ CLOSE ]</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* THREAD CREATION MODAL (Cross-platform, works on web + native) */}
      <Modal visible={showThreadModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={100} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>CREATE_NEW_THREAD /</Text>
              <Text style={styles.modalSubtitle}>SYSTEM_THREAD_NAME:</Text>
              <TextInput 
                  style={styles.modalInput} 
                  value={threadNameInput} 
                  onChangeText={setThreadNameInput}
                  placeholder="Enter thread name..." 
                  placeholderTextColor="#555"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={confirmCreateThread}
              />
              <View style={styles.modalActions}>
                  <TouchableOpacity onPress={cancelCreateThread}><Text style={styles.cancelText}>CANCEL</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={confirmCreateThread}><Text style={styles.saveBtnText}>CREATE</Text></TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        <View style={[styles.inputArea, { paddingHorizontal: isMobile ? '5%' : '10%' }]}>
          <TextInput style={styles.input} placeholder="COMMAND..." placeholderTextColor="#555" value={inputText} onChangeText={setInputText} onSubmitEditing={sendMessage} />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}><Ionicons name="send" size={20} color="#000" /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    paddingHorizontal: '5%', 
    paddingVertical: 16,
    borderBottomWidth: 1, 
    borderColor: '#1a1a1a', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start',
    backgroundColor: '#000000',
  },
  headerLeft: { flex: 1 },
  headerTitle: { color: '#FFF', fontWeight: '900', fontSize: 12, letterSpacing: 2 },
  headerHighlight: { color: '#00FF66', fontWeight: '900', fontSize: 24 },
  headerTime: { 
    color: '#888', 
    fontWeight: '600', 
    fontSize: 10, 
    letterSpacing: 0.5, 
    marginTop: 4,
    fontFamily: 'Courier New',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  modeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    justifyContent: 'center',
  },
  modeBtnText: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 1.5,
    fontFamily: 'Courier New',
  },
  promptSelectorContainer: {
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  promptOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    borderLeftWidth: 2,
    borderLeftColor: '#333',
    marginBottom: 4,
  },
  promptOptionActive: {
    borderLeftColor: '#00FF66',
    backgroundColor: 'rgba(0, 255, 102, 0.05)',
  },
  promptOptionText: {
    color: '#888',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: 'Courier New',
  },
  promptOptionTextActive: {
    color: '#00FF66',
  },
  promptOptionDesc: {
    color: '#555',
    fontWeight: '400',
    fontSize: 9,
    marginTop: 2,
    fontFamily: 'Courier New',
  },
  promptOptionDescActive: {
    color: '#00FF66',
    fontWeight: '600',
  },
  directoryBtn: { 
    paddingVertical: 8, 
    paddingHorizontal: 12,
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    justifyContent: 'center',
  },
  directoryBtnText: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: 'Courier New',
  },
  
  // Directory Modal Styles
  directoryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  directoryModalContent: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
  },
  directoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
  },
  directoryTitle: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 2,
    fontFamily: 'Courier New',
  },
  directoryCloseBtn: {
    color: '#666',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
    fontFamily: 'Courier New',
  },
  directoryScroll: {
    maxHeight: '60%',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  directoryLabel: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.5,
    fontFamily: 'Courier New',
    marginBottom: 8,
    marginTop: 8,
  },
  directoryEntry: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    borderLeftWidth: 2,
    borderLeftColor: '#1a1a1a',
    marginBottom: 4,
  },
  directoryEntryActive: {
    borderLeftColor: '#00FF66',
    backgroundColor: 'rgba(0, 255, 102, 0.05)',
  },
  directoryEntryText: {
    color: '#AAA',
    fontWeight: '600',
    fontSize: 11,
    fontFamily: 'Courier New',
    letterSpacing: 0.5,
  },
  directoryEntryTextActive: {
    color: '#00FF66',
    fontWeight: '900',
  },
  directoryEntryDisabled: {
    color: '#555',
    fontWeight: '600',
    fontSize: 11,
    fontFamily: 'Courier New',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  directoryText: {
    color: '#00FF66',
    fontWeight: '600',
    fontSize: 11,
    fontFamily: 'Courier New',
    lineHeight: 16,
    letterSpacing: 0.3,
  },
  directoryActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 2,
    borderTopColor: '#1a1a1a',
  },
  directoryActionBtn: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    paddingVertical: 10,
    alignItems: 'center',
  },
  directoryActionText: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: 'Courier New',
  },
  threadChipActive: {
    backgroundColor: '#00FF66',
    borderColor: '#00FF66',
    borderWidth: 2,
  },
  threadChipDaily: {
    borderColor: '#FF2C55',
    borderWidth: 1,
  },
  threadChipText: {
    color: '#666666',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
    fontFamily: 'Courier New',
  },
  threadChipTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  chatScroll: { flex: 1 },
  userRow: { alignSelf: 'flex-end', marginBottom: 20, alignItems: 'flex-end' },
  aiRow: { alignSelf: 'flex-start', marginBottom: 20, alignItems: 'flex-start' },
  // NEW: Terminal-style bubbles (unified Brutalist design)
  bubble: { padding: 14, borderWidth: 0, borderRadius: 0 },
  userBubble: { backgroundColor: 'transparent', borderColor: 'transparent' },
  aiBubble: { backgroundColor: '#0A0A0A', borderColor: '#1a1a1a', borderWidth: 2, borderRadius: 0 },
  userText: { color: '#00FF66', fontWeight: '900', fontSize: 13, fontFamily: 'Courier New', letterSpacing: 0.5 },
  aiText: { color: '#FFF', fontWeight: '600', fontSize: 13, fontFamily: 'Courier New', lineHeight: 18 },
  ticketCard: { marginTop: 8, backgroundColor: '#0A0A0A', borderWidth: 2, borderColor: '#1a1a1a', borderRadius: 0, padding: 16 },
  ticketHeader: { marginBottom: 8 },
  ticketHeaderText: { color: '#00FF66', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  taskTitle: { color: '#FFF', fontWeight: '900', fontSize: 16, marginBottom: 12 },
  taskFooter: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  taskDate: { color: '#666', fontSize: 10, fontWeight: '900' },
  taskPriority: { color: '#00FF66', fontSize: 10, fontWeight: '900' },
  inputArea: { flexDirection: 'row', paddingVertical: 16, borderTopWidth: 2, borderColor: '#1a1a1a', paddingBottom: 40, backgroundColor: '#000000', gap: 16 },
  input: { flex: 1, backgroundColor: '#0A0A0A', color: '#FFF', borderRadius: 0, paddingHorizontal: 16, height: 64, borderWidth: 2, borderColor: '#1a1a1a', fontWeight: '700', fontFamily: 'Courier New' },
  sendBtn: { backgroundColor: '#00FF66', width: 64, height: 64, borderRadius: 0, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.98)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#0A0A0A', padding: 24, borderRadius: 0, borderWidth: 2, borderColor: '#1a1a1a' },
  
  // Enhanced Ticket Modal Styles
  ticketModalContent: { 
    width: '92%', 
    maxHeight: '88%',
    backgroundColor: '#0A0A0A', 
    borderWidth: 2, 
    borderColor: '#1a1a1a',
    borderRadius: 0,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  ticketModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#000',
  },
  ticketModalHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketModalTitle: { 
    color: '#00FF66', 
    fontWeight: '900', 
    fontSize: 22, 
    fontFamily: 'Courier New', 
    letterSpacing: 2 
  },
  ticketModalScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  ticketModalSection: {
    marginBottom: 20,
  },
  ticketModalSectionLabel: {
    color: '#00FF66',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.5,
    marginBottom: 12,
    fontFamily: 'Courier New',
  },
  ticketModalInput: {
    backgroundColor: '#000',
    color: '#FFF',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: 'Courier New',
    fontWeight: '600',
    fontSize: 13,
    height: 48,
  },
  errorInput: {
    borderColor: '#FF2C55',
  },
  errorText: {
    color: '#FF2C55',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 6,
    fontFamily: 'Courier New',
  },
  hintText: {
    color: '#666',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
    fontFamily: 'Courier New',
  },
  ticketModalInputHint: {
    color: '#555',
    fontWeight: '600',
    fontSize: 10,
    fontFamily: 'Courier New',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  ticketModalRowSections: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  ticketModalHalfSection: {
    flex: 1,
  },
  ticketModalSelectRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ticketModalSelectBtn: {
    flex: 1,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 0,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
  },
  ticketModalSelectBtnText: {
    color: '#999',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'Courier New',
    letterSpacing: 0.5,
  },
  ticketModalDivider: {
    width: 1,
    backgroundColor: '#1a1a1a',
  },
  ticketModalFooter: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: 2,
    borderTopColor: '#1a1a1a',
    backgroundColor: '#000',
  },
  ticketModalCancelBtn: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 56,
  },
  ticketModalCancelBtnText: {
    color: '#666',
    fontWeight: '900',
    fontSize: 13,
    fontFamily: 'Courier New',
    letterSpacing: 1,
  },
  ticketModalSaveBtn: {
    flex: 1,
    backgroundColor: '#00FF66',
    borderWidth: 2,
    borderColor: '#00FF66',
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 56,
  },
  ticketModalSaveBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
    fontFamily: 'Courier New',
    letterSpacing: 1,
  },

  modalTitle: { color: '#00FF66', fontWeight: '900', fontSize: 24, marginBottom: 20, fontFamily: 'Courier New', letterSpacing: 2 },
  modalSubtitle: { color: '#999', fontWeight: '900', fontSize: 11, letterSpacing: 1, marginBottom: 8, fontFamily: 'Courier New' },
  modalInput: { backgroundColor: '#000', color: '#FFF', borderRadius: 0, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#1a1a1a', fontWeight: '700', fontFamily: 'Courier New' },
  rowInputs: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  halfInput: { flex: 1 },
  inputLabel: { color: '#00FF66', fontWeight: '900', fontSize: 11, letterSpacing: 1, marginBottom: 8, fontFamily: 'Courier New' },
  selectRow: { flexDirection: 'row', gap: 8 },
  selectBtn: { flex: 1, backgroundColor: '#000', borderWidth: 2, borderColor: '#1a1a1a', borderRadius: 0, paddingVertical: 10, alignItems: 'center' },
  selectBtnActive: { borderColor: '#00FF66', backgroundColor: '#00FF66' },
  selectBtnText: { color: '#FFF', fontWeight: '900', fontSize: 10 },
  selectBtnTextActive: { color: '#000' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cancelText: { color: '#666', fontWeight: '900' },
  saveBtn: { backgroundColor: '#00FF66', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 0 },
  saveBtnText: { color: '#000', fontWeight: '900' }
});