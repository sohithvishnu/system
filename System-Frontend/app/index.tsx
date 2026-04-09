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
    Keyboard,
    ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import SignupScreen from './signup';

export default function WelcomeScreen() {
    const { login } = useAuth();
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSignupMode, setIsSignupMode] = useState(false);
    const passwordRef = useRef<TextInput>(null);

    const handleLogin = async () => {
        setError('');
        Keyboard.dismiss();

        if (!name.trim()) {
            setError('Username required');
            return;
        }

        if (!password.trim()) {
            setError('Password required');
            return;
        }

        setLoading(true);
        const result = await login(name, password);
        setLoading(false);

        if (!result.success) {
            setError(result.error || 'Login failed');
            setPassword('');
        }
    };

    if (isSignupMode) {
        return <SignupScreen onSwitchToLogin={() => setIsSignupMode(false)} />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.logoContainer}>
                        <Ionicons name="terminal" size={48} color="#00FF66" />
                        <Text style={styles.title}>SYSTEM</Text>
                        <Text style={styles.subtitle}>ACCESS CONTROL</Text>
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
                                    returnKeyType="go"
                                    onSubmitEditing={handleLogin}
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
                                <Text style={styles.loadingText}>Authenticating...</Text>
                            </View>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[
                                        styles.button,
                                        !name.trim() || !password.trim() ? styles.buttonDisabled : null,
                                    ]}
                                    onPress={handleLogin}
                                    disabled={!name.trim() || !password.trim()}
                                >
                                    <View style={styles.buttonContent}>
                                        <Text style={styles.buttonText}>START SESSION</Text>
                                        <Ionicons name="arrow-forward" size={18} color="#000" />
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.switchButton} onPress={() => setIsSignupMode(true)}>
                                    <Text style={styles.switchButtonText}>New here? Create account</Text>
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
    scrollContent: { flexGrow: 1, paddingHorizontal: 28, paddingVertical: 20, justifyContent: 'space-around' },
    logoContainer: { marginTop: 60, marginBottom: 80 },
    title: { fontSize: 72, fontWeight: '900', color: '#FFF', letterSpacing: -2, marginTop: 16, textTransform: 'uppercase' },
    subtitle: { fontSize: 13, color: '#00FF66', fontWeight: '900', letterSpacing: 2, marginTop: 8, textTransform: 'uppercase' },
    formContainer: { gap: 24, marginBottom: 40 },
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
    passwordField: { position: 'relative' },
    passwordInput: { paddingRight: 50 },
    eyeButton: {
        position: 'absolute',
        right: 16,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
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
    buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
    buttonText: { fontWeight: '900', color: '#000', letterSpacing: 1.5, fontSize: 16, textTransform: 'uppercase' },
    switchButton: { paddingVertical: 20, alignItems: 'flex-start' },
    switchButtonText: { fontWeight: '800', color: '#00FF66', letterSpacing: 1, fontSize: 12, textTransform: 'uppercase' },
});
