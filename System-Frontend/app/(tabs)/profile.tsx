import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, Alert, ScrollView, Modal, ActivityIndicator, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, BOLD_STYLES } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  
  // ALL STATE HOOKS AT THE TOP
  const [userStats, setUserStats] = useState<any>({ totalTasks: 0, completedTasks: 0, activeTasks: 0 });
  const [loading, setLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Use useRef to track abort controller and prevent duplicate calls
  const abortControllerRef = useRef<AbortController | null>(null);

  // ALL OTHER HOOKS BEFORE EARLY RETURN
  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/stats?user_id=${user.id}`, {
        signal: abortControllerRef.current.signal
      });
      const data = await res.json();
      if (data.success) {
        setUserStats(data.stats);
      }
    } catch (e: any) {
      // Ignore abort errors, they're expected when navigation happens
      if (e.name !== 'AbortError') {
        console.log("Stats load failed:", e.message);
      }
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadStats();
      }
      return () => {
        // Cancel request when screen loses focus
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [loadStats, user?.id])
  );

  // EARLY RETURN AFTER ALL HOOKS
  if (!user) return null;

  const handleChangePassword = async () => {
    setPasswordError('');
    
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setPasswordError('All fields required');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('New password must be 6+ characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          old_password: oldPassword,
          new_password: newPassword
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        Alert.alert('SUCCESS', 'PASSWORD CHANGED');
        setShowChangePassword(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (e) {
      setPasswordError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      // Show branded modal on web
      setShowLogoutModal(true);
    } else {
      // Use Alert.alert for native
      Alert.alert('LOGOUT', 'Exit system?', [
        { text: 'CANCEL', onPress: () => {}, style: 'cancel' },
        {
          text: 'CONFIRM',
          onPress: () => {
            console.log('[Profile] Logout initiated...');
            logout().then(() => {
              console.log('[Profile] Logout completed, gatekeeper will redirect');
            }).catch((error: any) => {
              console.error('[Profile] Logout error:', error);
              Alert.alert('ERROR', 'Failed to logout');
            });
          },
          style: 'destructive',
        },
      ]);
    }
  };

  const confirmWebLogout = () => {
    console.log('[Profile] Logout initiated via modal...');
    setShowLogoutModal(false);
    logout().then(() => {
      console.log('[Profile] Logout completed, gatekeeper will redirect');
    }).catch((error: any) => {
      console.error('[Profile] Logout error:', error);
      if (Platform.OS !== 'web') {
        Alert.alert('ERROR', 'Failed to logout');
      } else {
        alert('ERROR: Failed to logout');
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROFILE / MANAGEMENT</Text>
        <Text style={styles.headerSubtitle}>USER_SETTINGS</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* USER INFO SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT / INFORMATION</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>USERNAME</Text>
              <Text style={styles.infoValue}>{user.username.toUpperCase()}</Text>
            </View>
            <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 16, marginTop: 16 }]}>
              <Text style={styles.infoLabel}>USER_ID</Text>
              <Text style={styles.infoValue}>{user.id}</Text>
            </View>
          </View>
        </View>

        {/* STATISTICS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WORKSPACE / STATISTICS</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{userStats.totalTasks || 0}</Text>
              <Text style={styles.statLabel}>TOTAL_TASKS</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{userStats.activeTasks || 0}</Text>
              <Text style={styles.statLabel}>ACTIVE</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{userStats.completedTasks || 0}</Text>
              <Text style={styles.statLabel}>COMPLETED</Text>
            </View>
          </View>
        </View>

        {/* SECURITY SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECURITY / SETTINGS</Text>
          <TouchableOpacity 
            style={styles.settingBtn}
            onPress={() => setShowChangePassword(true)}
          >
            <Ionicons name="lock-closed" size={20} color="#00FF66" />
            <Text style={styles.settingBtnText}>CHANGE_PASSWORD</Text>
            <Ionicons name="chevron-forward" size={20} color="#555" />
          </TouchableOpacity>
        </View>

        {/* LOGOUT SECTION */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.logoutBtn}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={20} color="#FF2C55" />
            <Text style={styles.logoutBtnText}>LOGOUT_SESSION</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CHANGE PASSWORD MODAL */}
      <Modal visible={showChangePassword} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>CHANGE / PASSWORD</Text>
            
            {/* Old Password Input */}
            <View style={styles.passwordInputWrapper}>
              <TextInput
                style={styles.modalInput}
                placeholder="CURRENT_PASSWORD"
                placeholderTextColor="#555"
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry={!showOldPw}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowOldPw(!showOldPw)}
              >
                <Ionicons name={showOldPw ? 'eye' : 'eye-off'} size={20} color="#00FF66" />
              </TouchableOpacity>
            </View>

            {/* New Password Input */}
            <View style={styles.passwordInputWrapper}>
              <TextInput
                style={styles.modalInput}
                placeholder="NEW_PASSWORD (6+ CHARS)"
                placeholderTextColor="#555"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPw}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowNewPw(!showNewPw)}
              >
                <Ionicons name={showNewPw ? 'eye' : 'eye-off'} size={20} color="#00FF66" />
              </TouchableOpacity>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.passwordInputWrapper}>
              <TextInput
                style={styles.modalInput}
                placeholder="CONFIRM_PASSWORD"
                placeholderTextColor="#555"
                value={confirmPassword} 
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPw}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPw(!showConfirmPw)}
              >
                <Ionicons name={showConfirmPw ? 'eye' : 'eye-off'} size={20} color="#00FF66" />
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {passwordError && (
              <Text style={styles.errorText}>{passwordError}</Text>
            )}

            {/* Loading Indicator */}
            {loading && <ActivityIndicator color="#00FF66" style={{ marginVertical: 12 }} />}

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity 
                onPress={() => {
                  setShowChangePassword(false);
                  setPasswordError('');
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmBtn} 
                onPress={handleChangePassword}
                disabled={loading}
              >
                <Text style={styles.confirmBtnText}>CONFIRM</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* LOGOUT CONFIRMATION MODAL (BRANDED FOR WEB) */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalContent}>
            <View style={styles.logoutModalHeader}>
              <Ionicons name="log-out" size={32} color="#FF2C55" />
              <Text style={styles.logoutModalTitle}>EXIT SYSTEM</Text>
            </View>
            
            <Text style={styles.logoutModalMessage}>Are you sure you want to exit the workspace?</Text>
            
            <View style={styles.logoutModalActions}>
              <TouchableOpacity 
                style={styles.logoutCancelBtn}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.logoutCancelText}>CANCEL</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.logoutConfirmBtn}
                onPress={confirmWebLogout}
              >
                <Text style={styles.logoutConfirmText}>CONFIRM LOGOUT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 24, borderBottomWidth: 2, borderColor: '#1a1a1a' },
  headerTitle: { color: '#FFF', fontWeight: '900', fontSize: 28, letterSpacing: 1 },
  headerSubtitle: { color: '#00FF66', fontWeight: '900', fontSize: 12, marginTop: 4, letterSpacing: 2 },
  content: { flex: 1 },
  section: { padding: 24, borderBottomWidth: 1, borderColor: '#1a1a1a' },
  sectionTitle: { color: '#00FF66', fontWeight: '900', fontSize: 13, letterSpacing: 2, marginBottom: 16 },
  
  // INFO CARD
  infoCard: { backgroundColor: '#0A0A0A', borderWidth: 2, borderColor: '#1a1a1a', borderRadius: 8, padding: 16 },
  infoRow: { marginBottom: 16 },
  infoLabel: { color: '#666', fontWeight: '900', fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  infoValue: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },

  // STATS
  statsContainer: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: '#0A0A0A', borderWidth: 2, borderColor: '#00FF66', borderRadius: 8, padding: 16, alignItems: 'center' },
  statValue: { color: '#00FF66', fontWeight: '900', fontSize: 28, marginBottom: 8 },
  statLabel: { color: '#666', fontWeight: '900', fontSize: 10, letterSpacing: 1 },

  // SETTINGS BUTTON
  settingBtn: { backgroundColor: '#0A0A0A', borderWidth: 2, borderColor: '#1a1a1a', borderRadius: 8, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  settingBtnText: { flex: 1, color: '#FFF', fontWeight: '900', fontSize: 14 },

  // LOGOUT BUTTON
  logoutBtn: { backgroundColor: '#0A0A0A', borderWidth: 2, borderColor: '#FF2C55', borderRadius: 8, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoutBtnText: { flex: 1, color: '#FF2C55', fontWeight: '900', fontSize: 14 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '88%', backgroundColor: '#0A0A0A', padding: 24, borderRadius: 8, borderWidth: 2, borderColor: '#1a1a1a' },
  modalTitle: { color: '#00FF66', fontWeight: '900', fontSize: 22, marginBottom: 20, letterSpacing: 1 },
  
  // PASSWORD INPUTS
  passwordInputWrapper: { position: 'relative', marginBottom: 16 },
  modalInput: { backgroundColor: '#000', color: '#FFF', borderRadius: 8, padding: 16, paddingRight: 48, marginBottom: 0, borderWidth: 2, borderColor: '#1a1a1a', fontWeight: '700' },
  eyeIcon: { position: 'absolute', right: 12, top: '50%', transform: [{ translateY: -10 }] },
  
  // ERROR TEXT
  errorText: { color: '#FF2C55', fontWeight: '900', fontSize: 12, marginBottom: 16, paddingHorizontal: 4 },

  // MODAL ACTIONS
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, gap: 12 },
  cancelText: { color: '#666', fontWeight: '900', fontSize: 13, paddingVertical: 12, paddingHorizontal: 20 },
  confirmBtn: { flex: 1, backgroundColor: '#00FF66', borderRadius: 8, paddingVertical: 16, alignItems: 'center' },
  confirmBtnText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  // LOGOUT MODAL (BRANDED)
  logoutModalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.95)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 16
  },
  logoutModalContent: { 
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0A0A0A', 
    borderWidth: 2,
    borderColor: '#FF2C55',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center'
  },
  logoutModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 16
  },
  logoutModalTitle: { 
    color: '#FF2C55', 
    fontWeight: '900', 
    fontSize: 28,
    letterSpacing: 2
  },
  logoutModalMessage: {
    color: '#A0A0A0',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20
  },
  logoutModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 24
  },
  logoutCancelBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center'
  },
  logoutCancelText: {
    color: '#666',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1
  },
  logoutConfirmBtn: {
    flex: 1,
    backgroundColor: '#FF2C55',
    borderWidth: 2,
    borderColor: '#FF2C55',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center'
  },
  logoutConfirmText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1
  }
});
