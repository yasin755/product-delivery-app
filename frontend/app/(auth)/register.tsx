import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing, radii } from '../../src/theme';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), phone.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity testID="register-back-btn" onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={colors.textMain} />
            </TouchableOpacity>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join us for fresh deliveries</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} />
              <TextInput testID="register-name-input" style={styles.input} placeholder="Enter your name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
            </View>

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
              <TextInput testID="register-email-input" style={styles.input} placeholder="Enter your email" placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>

            <Text style={styles.label}>Phone</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={20} color={colors.textMuted} />
              <TextInput testID="register-phone-input" style={styles.input} placeholder="Enter phone number" placeholderTextColor={colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
              <TextInput testID="register-password-input" style={styles.input} placeholder="Create a password" placeholderTextColor={colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry />
            </View>

            <TouchableOpacity testID="register-submit-btn" style={styles.primaryBtn} onPress={handleRegister} disabled={loading} activeOpacity={0.7}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
            </TouchableOpacity>

            <TouchableOpacity testID="goto-login-btn" onPress={() => router.back()} style={styles.linkBtn} activeOpacity={0.7}>
              <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
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
  header: { marginTop: spacing.lg, marginBottom: spacing.xl },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.textMain, letterSpacing: -0.5, marginTop: spacing.sm },
  subtitle: { fontSize: 16, color: colors.textMuted, marginTop: spacing.xs },
  form: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textMain, marginBottom: spacing.sm, marginTop: spacing.md },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radii.md, paddingHorizontal: spacing.md, height: 52, gap: spacing.sm },
  input: { flex: 1, fontSize: 16, color: colors.textMain },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkBtn: { alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.md },
  linkText: { fontSize: 14, color: colors.textMuted },
  linkBold: { color: colors.primary, fontWeight: '600' },
});
