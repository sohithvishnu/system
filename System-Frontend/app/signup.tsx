import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Keyboard,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function SignupScreen({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
    const { signup } = useAuth();
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const passwordRef = useRef<TextInput>(null);
    const confirmPasswordRef = useRef<TextInput>(null);

    const handleSignup = async () => {
        setError('');
        Keyboard.dismiss();

        if (!name.trim()) {
            setError('Username required');
            return;
        }

        if (name.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        if (!password.trim()) {
            setError('Password required');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (!confirmPassword.trim()) {
            setError('Please confirm your password');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        const result = await signup(name, password);
        setLoading(false);

        if (!result.success) {
            setError(result.error || 'Sign up failed');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.headerContainer}>
                        <Ionicons name="terminal" size={48} color="#00FF66" />
                        <Text style={styles.title}>CREATE</Text>
                        <Text style={styles.subtitle}>NEW IDENTITY</Text>
                    </View>

                    <View style={styles.formContainer}>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.label}>USERNAME</Text>
                            <TextInput
                                style={[styles.input, name.length > 0 && styles.inputFilled]}
                                placeholder="Enter username..."
                                placeholderTextColor="#555"
                                value={name}
                                onChangeText={setName}
                                editable={!loading}
                                returnKeyType="next"
                                onSubmitEditing={() => passwordRef.current?.focus()}
                            />
                            {name.length > 0 && name.length < 3 && (
                                <Text style={styles.helperText}>Minimum 3 characters</Text>
                            )}
                        </View>

                        <View style={styles.inputWrapper}>
                            <Text style={styles.label}>PASSWORD</Text>
                            <View style={styles.passwordField}>
                                <TextInput
                                    ref={passwordRef}
                                    style={[styles.input, styles.passwordInput, password.length > 0 && styles.inputFilled]}
                                    placeholder="Enter password..."
                                    placeholderTextColor="#555"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    editable={!loading}
                                    returnKeyType="next"
                                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                                />
                                <TouchableOpacity
                                    style={styles.eyeButton}
                                    onPress={() => setShowPassword(!showPassword)}
                                    disabled={loading}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-off' : 'eye'}
                                        size={20}
                                        color="#00FF66"
                                    />
                                </TouchableOpacity>
                            </View>
                            {password.length > 0 && password.length < 6 && (
                                <Text style={styles.helperText}>Minimum 6 characters</Text>
                            )}
                        </View>

                        <View style={styles.inputWrapper}>
                            <Text style={styles.label}>CONFIRM PASSWORD</Text>
                            <View style={styles.passwordField}>
                                <TextInput
                                    ref={confirmPasswordRef}
                                    style={[styles.input, styles.passwordInput, confirmPassword.length > 0 && styles.inputFilled]}
                                    placeholder="Confirm password..."
                                    placeholderTextColor="#555"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showConfirmPassword}
                                    editable={!loading}
                                    returnKeyType="done"
                                    onSubmitEditing={handleSignup}
                                />
                                <TouchableOpacity
                                    style={styles.eyeButton}
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                    disabled={loading}
                                >
                                    <Ionicons
                                        name={showConfirmPassword ? 'eye-off' : 'eye'}
                                        size={20}
                                        color="#00FF66"
                                    />
                                </TouchableOpacity>
                            </View>
                            {password.length > 0 &&
                                confirmPassword.length > 0 &&
                                password === confirmPassword && (
                                    <Text style={styles.successText}>✓ Passwords match</Text>
                                )}
                        </View>

                        {error && (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle" size={18} color="#FF2C55" />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator color="#8B2CFF" size="large" />
                                <Text style={styles.loadingText}>Creating account...</Text>
                            </View>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.button, name.length < 3 || password.length < 6 ? styles.buttonDisabled : null]}
                                    onPress={handleSignup}
                                    disabled={name.length < 3 || password.length < 6}
                                >
                                    <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.switchButton} onPress={onSwitchToLogin}>
                                    <Text style={styles.switchButtonText}>Already have an account?</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingVertical: 20, justifyContent: 'center' },
    headerContainer: { marginBottom: 70, marginTop: 20 },
    title: { fontSize: 72, fontWeight: '900', color: '#FFF', letterSpacing: -2, marginTop: 16, textTransform: 'uppercase' },
    subtitle: { fontSize: 13, color: '#00FF66', fontWeight: '900', letterSpacing: 2, marginTop: 8, textTransform: 'uppercase' },
    formContainer: { gap: 24 },
    inputWrapper: { marginBottom: 16 },
    label: { fontSize: 11, fontWeight: '900', color: '#00FF66', marginBottom: 10, letterSpacing: 2, textTransform: 'uppercase' },
    input: {
        backgroundColor: '#0A0A0A',
        height: 56,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#1a1a1a',
        color: '#FFF',
        paddingHorizontal: 16,
        fontWeight: '800',
        fontSize: 16,
    },
    inputFilled: { borderColor: '#00FF66', backgroundColor: '#0a2a0a' },
    passwordInput: { paddingRight: 50 },
    passwordField: { position: 'relative' },
    eyeButton: {
        position: 'absolute',
        right: 16,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    helperText: { fontSize: 11, color: '#555', marginTop: 4, fontWeight: '700' },
    successText: { fontSize: 11, color: '#00FF66', marginTop: 4, fontWeight: '800' },
    errorContainer: { backgroundColor: '#2a0a0a', padding: 14, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12, borderLeftWidth: 4, borderLeftColor: '#FF2C55' },
    errorText: { color: '#FF2C55', fontWeight: '900', fontSize: 13, flex: 1 },
    loadingContainer: { alignItems: 'flex-start', paddingVertical: 32 },
    loadingText: { color: '#00FF66', fontWeight: '900', marginTop: 16 },
    button: {
        backgroundColor: '#00FF66',
        height: 56,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
        shadowColor: '#00FF66',
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
    },
    buttonDisabled: { backgroundColor: '#333', opacity: 0.5 },
    buttonText: { fontWeight: '900', color: '#000', letterSpacing: 1.5, fontSize: 16, textTransform: 'uppercase' },
    switchButton: { paddingVertical: 20, alignItems: 'flex-start' },
    switchButtonText: { fontWeight: '800', color: '#00FF66', letterSpacing: 1, fontSize: 12, textTransform: 'uppercase' },
});
