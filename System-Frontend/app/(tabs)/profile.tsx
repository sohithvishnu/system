import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ScrollView, Modal, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONT, FONT_FAMILY, SPACE, RADIUS } from '../../constants/theme';
import { BACKEND_URL } from '../../constants/config';
import { Screen, PageHeader, Section, Card, GhostButton } from '../../components/ui';
import { scale } from '../../utils/responsive';

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
      } else {
        console.error("Stats load failed:", data.error);
        Alert.alert('SYSTEM_ERR', 'Failed to load user statistics.');
      }
    } catch (e: any) {
      // Ignore abort errors, they're expected when navigation happens
      if (e.name !== 'AbortError') {
        console.error("Stats fetch failed:", e.message);
        Alert.alert('SYSTEM_ERR', 'Backend connection severed.');
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
    } catch (e: any) {
      console.error("Password change failed", e);
      setPasswordError('SYSTEM_ERR: Backend connection severed. Could not change password.');
      Alert.alert('SYSTEM_ERR', 'Backend connection failed.');
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
    <Screen>
      <PageHeader title="profile" subtitle={"~/@" + user.username} />

      <ScrollView contentContainerStyle={{ paddingBottom: SPACE.lg }}>
        {/* USER CARD */}
        <View style={styles.userCardContainer}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.userInfoContainer}>
            <Text style={styles.usernameText}>{user.username}</Text>
            <Text style={styles.userIdText} numberOfLines={1}>{user.id}</Text>
          </View>
        </View>

        {/* STATS ROW */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{userStats.totalTasks || 0}</Text>
            <Text style={styles.statLabel}>total</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{userStats.completedTasks || 0}</Text>
            <Text style={styles.statLabel}>done</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{userStats.activeTasks || 0}</Text>
            <Text style={styles.statLabel}>active</Text>
          </Card>
        </View>

        {/* ACCOUNT SECTION */}
        <Section label="account">
          <Card
            style={styles.actionRow}
            onPress={() => setShowChangePassword(true)}
          >
            <Feather name="lock" size={FONT.md} color={COLORS.textSecondary} />
            <Text style={styles.actionLabel}>change password</Text>
            <Feather name="chevron-right" size={FONT.md} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} />
          </Card>
          <Card
            style={[styles.actionRow, styles.dangerRow]}
            onPress={handleLogout}
          >
            <Feather name="log-out" size={FONT.md} color={COLORS.danger} />
            <Text style={[styles.actionLabel, { color: COLORS.danger }]}>log out</Text>
            <Feather name="chevron-right" size={FONT.md} color={COLORS.danger} style={{ marginLeft: 'auto' }} />
          </Card>
        </Section>
      </ScrollView>

      {/* CHANGE PASSWORD MODAL */}
      <Modal visible={showChangePassword} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent} scrollEnabled showsVerticalScrollIndicator={false}>
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
                <Feather name={showOldPw ? 'eye' : 'eye-off'} size={FONT.md} color={COLORS.accent} />
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
                <Feather name={showNewPw ? 'eye' : 'eye-off'} size={FONT.md} color={COLORS.accent} />
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
                <Feather name={showConfirmPw ? 'eye' : 'eye-off'} size={FONT.md} color={COLORS.accent} />
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {passwordError && (
              <Text style={styles.errorText}>{passwordError}</Text>
            )}

            {/* Loading Indicator */}
            {loading && <ActivityIndicator color={COLORS.accent} style={{ marginVertical: SPACE.md }} />}

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
          </ScrollView>
        </View>
      </Modal>

      {/* LOGOUT CONFIRMATION MODAL (BRANDED FOR WEB) */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalContent}>
            <View style={styles.logoutModalHeader}>
              <Feather name="log-out" size={FONT.xl} color={COLORS.danger} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  // USER CARD
  userCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    gap: SPACE.md,
  },
  avatarContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FONT.xl,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  userInfoContainer: {
    flex: 1,
  },
  usernameText: {
    fontSize: FONT.lg,
    fontWeight: '500',
    color: COLORS.textPrimary,
    fontFamily: FONT_FAMILY.sans,
  },
  userIdText: {
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.textGhost,
    marginTop: SPACE.xs,
  },

  // STATS ROW
  statsRow: {
    flexDirection: 'row',
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FONT.xl,
    fontWeight: '600',
    color: COLORS.accent,
    marginBottom: SPACE.xs,
  },
  statLabel: {
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.textSecondary,
  },

  // ACTION ROWS
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    marginBottom: SPACE.md,
  },
  actionLabel: {
    flex: 1,
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
    color: COLORS.textSecondary,
  },
  dangerRow: {
    marginBottom: 0,
  },

  // MODAL
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.95)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    width: '88%', 
    backgroundColor: COLORS.surface, 
    padding: SPACE.lg, 
    borderRadius: RADIUS.md, 
    borderWidth: 1, 
    borderColor: COLORS.borderMid 
  },
  modalTitle: { 
    color: COLORS.accent, 
    fontWeight: '600', 
    fontSize: FONT.lg, 
    marginBottom: SPACE.md, 
    fontFamily: FONT_FAMILY.mono,
  },
  
  // PASSWORD INPUTS
  passwordInputWrapper: { 
    position: 'relative', 
    marginBottom: SPACE.md 
  },
  modalInput: { 
    backgroundColor: COLORS.bg, 
    color: COLORS.textPrimary, 
    borderRadius: RADIUS.sm, 
    padding: SPACE.md, 
    paddingRight: SPACE.lg + SPACE.md, 
    marginBottom: 0, 
    borderWidth: 1, 
    borderColor: COLORS.borderMid, 
    fontWeight: '400', 
    fontFamily: FONT_FAMILY.mono,
    fontSize: FONT.md,
  },
  eyeIcon: { 
    position: 'absolute', 
    right: SPACE.md, 
    top: '50%', 
    transform: [{ translateY: -FONT.md / 2 }] 
  },
  
  // ERROR TEXT
  errorText: { 
    color: COLORS.danger, 
    fontWeight: '600', 
    fontSize: FONT.sm, 
    marginBottom: SPACE.md, 
    paddingHorizontal: SPACE.xs 
  },

  // MODAL ACTIONS
  modalActions: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: SPACE.lg, 
    gap: SPACE.md 
  },
  cancelText: { 
    color: COLORS.textSecondary, 
    fontWeight: '500', 
    fontSize: FONT.md, 
    paddingVertical: SPACE.sm, 
    paddingHorizontal: SPACE.md,
    fontFamily: FONT_FAMILY.mono,
  },
  confirmBtn: { 
    flex: 1, 
    backgroundColor: COLORS.accent, 
    borderRadius: RADIUS.sm, 
    paddingVertical: SPACE.md, 
    alignItems: 'center' 
  },
  confirmBtnText: { 
    color: COLORS.bg, 
    fontWeight: '600', 
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
  },

  // LOGOUT MODAL
  logoutModalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.95)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: SPACE.md
  },
  logoutModalContent: { 
    width: '100%',
    maxWidth: scale(420),
    backgroundColor: COLORS.surface, 
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.md,
    padding: SPACE.lg,
    alignItems: 'center'
  },
  logoutModalHeader: {
    alignItems: 'center',
    marginBottom: SPACE.lg,
    gap: SPACE.md
  },
  logoutModalTitle: { 
    color: COLORS.danger, 
    fontWeight: '600', 
    fontSize: FONT.lg,
    fontFamily: FONT_FAMILY.mono,
  },
  logoutModalMessage: {
    color: COLORS.textSecondary,
    fontWeight: '400',
    fontSize: FONT.md,
    textAlign: 'center',
    marginBottom: SPACE.lg,
    lineHeight: FONT.md * 1.5
  },
  logoutModalActions: {
    flexDirection: 'row',
    gap: SPACE.md,
    width: '100%',
    marginTop: SPACE.lg
  },
  logoutCancelBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderMid,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE.md,
    alignItems: 'center'
  },
  logoutCancelText: {
    color: COLORS.textSecondary,
    fontWeight: '500',
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
  },
  logoutConfirmBtn: {
    flex: 1,
    backgroundColor: COLORS.danger,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE.md,
    alignItems: 'center'
  },
  logoutConfirmText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT.md,
    fontFamily: FONT_FAMILY.mono,
  }
});

