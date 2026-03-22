import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing, radii } from '../../src/theme';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login Failed', e.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="bag-handle" size={40} color={colors.primary} />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue shopping</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
              <TextInput
                testID="login-email-input"
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
              <TextInput
                testID="login-password-input"
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} testID="toggle-password-btn">
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity testID="login-submit-btn" style={styles.primaryBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.7}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>Demo Accounts</Text>
              <TouchableOpacity testID="demo-user-btn" style={styles.demoBtn} onPress={() => { setEmail('user@test.com'); setPassword('user123'); }} activeOpacity={0.7}>
                <Ionicons name="person-outline" size={18} color={colors.primary} />
                <Text style={styles.demoBtnText}>User: user@test.com / user123</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="demo-admin-btn" style={styles.demoBtn} onPress={() => { setEmail('admin@delivery.com'); setPassword('admin123'); }} activeOpacity={0.7}>
                <Ionicons name="shield-outline" size={18} color={colors.secondary} />
                <Text style={styles.demoBtnText}>Admin: admin@delivery.com / admin123</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity testID="goto-register-btn" onPress={() => router.push('/(auth)/register')} style={styles.linkBtn} activeOpacity={0.7}>
              <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Sign Up</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xl },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: 28, fontWeight: '700', color: colors.textMain, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: colors.textMuted, marginTop: spacing.xs },
  form: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textMain, marginBottom: spacing.sm, marginTop: spacing.md },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radii.md, paddingHorizontal: spacing.md, height: 52, gap: spacing.sm },
  input: { flex: 1, fontSize: 16, color: colors.textMain },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { paddingHorizontal: spacing.md, color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  demoBox: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.md },
  demoTitle: { fontSize: 14, fontWeight: '600', color: colors.textMain, marginBottom: spacing.sm },
  demoBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  demoBtnText: { fontSize: 13, color: colors.textMuted },
  linkBtn: { alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.md },
  linkText: { fontSize: 14, color: colors.textMuted },
  linkBold: { color: colors.primary, fontWeight: '600' },
});
