import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Modal, useWindowDimensions, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, BOLD_STYLES } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChatScreen() {
  const { user, logout } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  
  // 1. ALL HOOKS MUST BE AT THE TOP
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [editingTask, setEditingTask] = useState<any>(null);
  
  // AbortController for canceling history requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Responsive dimensions
  const isMobile = screenWidth < 768;
  const bubbleMaxWidth = isMobile ? '85%' : '40%';

  // Memoize loadHistory so it can be safely used in hooks
  const loadHistory = useCallback(async () => {
    if (!user) return; // Guard inside the function logic
    
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/history?user_id=${user.id}`, {
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
      }
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
      return () => {
        // Cancel request when screen loses focus
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [loadHistory])
  );

  useEffect(() => { 
    scrollViewRef.current?.scrollToEnd({ animated: true }); 
  }, [messages]);

  // 2. EARLY RETURN GOES HERE (After all hooks)
  if (!user) return null;

  // 3. LOGIC FUNCTIONS
  const saveEditedTask = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingTask, user_id: user.id }),
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
      Alert.alert('Network Error', 'Could not save task. Please try again.');
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || loading) return;
    const userMsg = { id: Date.now().toString(), text: inputText, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      // Retrieve the selected AI model from storage
      const activeModel = await AsyncStorage.getItem('@system_active_model');

      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg.text, 
          user_id: user.id,
          model: activeModel  // Send the selected model
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
      Alert.alert('Network Error', 'Could not send message. Please check your connection.');
    }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>USER / {user.username.toUpperCase()}</Text>
            <Text style={styles.headerHighlight}>WORKSPACE_CORE</Text>
          </View>
      </View>

      <ScrollView ref={scrollViewRef} style={styles.chatScroll} contentContainerStyle={{ paddingHorizontal: isMobile ? '5%' : '10%', paddingVertical: 16 }}>
        {messages.map((msg) => (
          <View key={msg.id} style={[msg.sender === 'user' ? styles.userRow : styles.aiRow, { width: '100%' }]}>
            <View style={[styles.bubble, msg.sender === 'user' ? styles.userBubble : styles.aiBubble, { maxWidth: bubbleMaxWidth }]}>
              <Text style={msg.sender === 'user' ? styles.userText : styles.aiText}>{msg.text}</Text>
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
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>EDIT_TICKET /</Text>
              <TextInput 
                  style={styles.modalInput} 
                  value={editingTask?.title} 
                  onChangeText={(t) => setEditingTask({...editingTask, title: t})}
                  placeholder="TITLE..." placeholderTextColor="#555"
              />
              <TextInput 
                  style={styles.modalInput} 
                  value={editingTask?.dueDate} 
                  onChangeText={(t) => setEditingTask({...editingTask, dueDate: t})}
                  placeholder="DUE_DATE (YYYY-MM-DD)" placeholderTextColor="#555"
              />
              <View style={styles.rowInputs}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>PRIORITY</Text>
                  <View style={styles.selectRow}>
                    {['low', 'medium', 'high'].map((p) => (
                      <TouchableOpacity 
                        key={p}
                        style={[styles.selectBtn, editingTask?.priority === p && styles.selectBtnActive]}
                        onPress={() => setEditingTask({...editingTask, priority: p})}
                      >
                        <Text style={[styles.selectBtnText, editingTask?.priority === p && styles.selectBtnTextActive]}>
                          {p.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>STATUS</Text>
                  <View style={styles.selectRow}>
                    {['TODO', 'IN_PROGRESS', 'DONE'].map((s) => (
                      <TouchableOpacity 
                        key={s}
                        style={[styles.selectBtn, editingTask?.status === s && styles.selectBtnActive]}
                        onPress={() => setEditingTask({...editingTask, status: s})}
                      >
                        <Text style={[styles.selectBtnText, editingTask?.status === s && styles.selectBtnTextActive]}>
                          {s.substring(0, 3).toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.modalActions}>
                  <TouchableOpacity onPress={() => setEditingTask(null)}><Text style={styles.cancelText}>CANCEL</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={saveEditedTask}><Text style={styles.saveBtnText}>SAVE_CHANGES</Text></TouchableOpacity>
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
  logoutBtn: { padding: 8 },
  chatScroll: { flex: 1 },
  userRow: { alignSelf: 'flex-end', marginBottom: 20, alignItems: 'flex-end' },
  aiRow: { alignSelf: 'flex-start', marginBottom: 20, alignItems: 'flex-start' },
  bubble: { padding: 16, borderRadius: 16, borderWidth: 2 },
  userBubble: { backgroundColor: '#00FF66', borderColor: '#00FF66' },
  aiBubble: { backgroundColor: '#111', borderColor: '#333' },
  userText: { color: '#000', fontWeight: '900' },
  aiText: { color: '#FFF', fontWeight: '600' },
  ticketCard: { marginTop: 8, backgroundColor: '#000', borderWidth: 2, borderColor: '#00FF66', borderRadius: 12, padding: 16 },
  ticketHeader: { marginBottom: 8 },
  ticketHeaderText: { color: '#00FF66', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  taskTitle: { color: '#FFF', fontWeight: '900', fontSize: 16, marginBottom: 12 },
  taskFooter: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  taskDate: { color: '#666', fontSize: 10, fontWeight: '900' },
  taskPriority: { color: '#00FF66', fontSize: 10, fontWeight: '900' },
  inputArea: { flexDirection: 'row', paddingVertical: 16, borderTopWidth: 1, borderColor: '#1a1a1a', paddingBottom: 40, backgroundColor: '#000000', gap: 12 },
  input: { flex: 1, backgroundColor: '#0A0A0A', color: '#FFF', borderRadius: 8, paddingHorizontal: 20, height: 56, borderWidth: 2, borderColor: '#1a1a1a', fontWeight: '700' },
  sendBtn: { backgroundColor: '#00FF66', width: 56, height: 56, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#0A0A0A', padding: 24, borderRadius: 8, borderWidth: 2, borderColor: '#1a1a1a' },
  modalTitle: { color: '#00FF66', fontWeight: '900', fontSize: 24, marginBottom: 20 },
  modalInput: { backgroundColor: '#000', color: '#FFF', borderRadius: 8, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#1a1a1a', fontWeight: '700' },
  rowInputs: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  halfInput: { flex: 1 },
  inputLabel: { color: '#00FF66', fontWeight: '900', fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  selectRow: { flexDirection: 'row', gap: 8 },
  selectBtn: { flex: 1, backgroundColor: '#000', borderWidth: 2, borderColor: '#1a1a1a', borderRadius: 6, paddingVertical: 10, alignItems: 'center' },
  selectBtnActive: { borderColor: '#00FF66', backgroundColor: '#00FF66' },
  selectBtnText: { color: '#FFF', fontWeight: '900', fontSize: 10 },
  selectBtnTextActive: { color: '#000' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cancelText: { color: '#666', fontWeight: '900' },
  saveBtn: { backgroundColor: '#00FF66', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  saveBtnText: { color: '#000', fontWeight: '900' }
});