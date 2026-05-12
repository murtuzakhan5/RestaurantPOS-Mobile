import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useModules } from '../context/ModuleContext';

// change api
// const API_URL = 'https://localhost:7246/api';
const API_URL = 'https://billpak.runasp.net/api';
const { width } = Dimensions.get('window');
const isTablet = width >= 768;
const isDesktop = width >= 1024;

export default function VerifyOTPScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { loadModules } = useModules();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'info',
  });

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(timer - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const getResponsiveStyles = () => {
    if (isDesktop) return { cardWidth: 500, otpInputSize: 65, otpInputFont: 28 };
    if (isTablet) return { cardWidth: 450, otpInputSize: 55, otpInputFont: 24 };
    return { cardWidth: width - 40, otpInputSize: 50, otpInputFont: 22 };
  };

  const responsive = getResponsiveStyles();

  const showCustomAlert = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' = 'success'
  ) => {
    setCustomAlert({ visible: true, title, message, type });
    setTimeout(() => {
      setCustomAlert(prev => ({ ...prev, visible: false }));
    }, type === 'success' ? 2500 : 3000);
  };

  const handleOtpChange = (text: string, index: number) => {
    if (text && !/^\d+$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (text && index === 5 && newOtp.every(digit => digit !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode?: string) => {
    const code = otpCode || otp.join('');

    if (code.length < 6) {
      showCustomAlert('Incomplete OTP', 'Please enter all 6 digits', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/verify`, {
        phone,
        code,
      });

      if (response.data.success) {
        if (response.data.token) {
          await AsyncStorage.setItem('token', response.data.token);
        }

        if (response.data.user) {
          await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        } else {
          await AsyncStorage.setItem('user', JSON.stringify({ phone }));
        }

        await loadModules();

        showCustomAlert(
          'Welcome Back! 🎉',
          'Login successful! Redirecting...',
          'success'
        );

        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1200);
      } else {
        showCustomAlert(
          'Verification Failed',
          response.data.message || 'Invalid OTP. Please try again.',
          'error'
        );
      }
    } catch (error: any) {
      console.error('Verify error:', error.response?.data || error.message);

      const errorMessage =
        error.response?.data?.message ||
        error.response?.data ||
        'Invalid OTP. Please try again.';

      showCustomAlert('Verification Failed', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (timer > 0) return;

    setResending(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, { phone });

      if (response.data.success) {
        setTimer(60);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();

        showCustomAlert(
          'OTP Resent! 📨',
          'A new verification code has been sent to your phone.',
          'success'
        );
      } else {
        showCustomAlert(
          'Failed',
          response.data.message || 'Could not resend OTP',
          'error'
        );
      }
    } catch (error: any) {
      console.error('Resend error:', error.response?.data || error.message);
      showCustomAlert('Error', 'Failed to resend OTP. Please try again.', 'error');
    } finally {
      setResending(false);
    }
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    if (!phoneNumber) return '';
    const clean = phoneNumber.replace(/^0+/, '');
    if (clean.length === 10) {
      return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
    }
    return clean;
  };

  const getAlertColors = () => {
    switch (customAlert.type) {
      case 'success':
        return { bg: '#1A5F2B', border: '#F5A623', icon: '✅' };
      case 'error':
        return { bg: '#DC2626', border: '#FCA5A5', icon: '❌' };
      case 'info':
        return { bg: '#3B82F6', border: '#93C5FD', icon: 'ℹ️' };
      default:
        return { bg: '#1A5F2B', border: '#F5A623', icon: '✅' };
    }
  };

  const alertColors = getAlertColors();

  return (
    <>
      <LinearGradient
        colors={['#1A5F2B', '#0D3D1C', '#1A5F2B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <StatusBar style="light" />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.card, { width: responsive.cardWidth }]}>
              <View style={styles.logoContainer}>
                <View style={styles.logoIcon}>
                  <Text style={styles.logoEmoji}>🔐</Text>
                </View>

                <Text style={styles.brandName}>BillPak</Text>
                <View style={styles.goldDivider} />
                <Text style={styles.tagline}>Secure Verification</Text>
              </View>

              <View style={styles.otpContainer}>
                <Text style={styles.title}>Enter OTP</Text>

                <Text style={styles.subtitle}>
                  We've sent a verification code to
                </Text>

                <Text style={styles.phoneNumber}>
                  +92 {formatPhoneNumber(phone as string)}
                </Text>

                <View style={styles.otpInputContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      style={[
                        styles.otpInput,
                        {
                          width: responsive.otpInputSize,
                          height: responsive.otpInputSize,
                          fontSize: responsive.otpInputFont,
                        },
                        digit && styles.otpInputFilled,
                      ]}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={1}
                      editable={!loading}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
                  onPress={() => handleVerify()}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      loading
                        ? ['#D4A843', '#B88A2A']
                        : ['#F5A623', '#D48A1A']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.verifyButtonText}>Verify →</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.resendContainer}>
                  <Text style={styles.resendText}>Didn't receive code? </Text>

                  <TouchableOpacity
                    onPress={handleResendOTP}
                    disabled={timer > 0 || resending}
                    activeOpacity={0.7}
                  >
                    {resending ? (
                      <ActivityIndicator size="small" color="#F5A623" />
                    ) : (
                      <Text
                        style={[
                          styles.resendLink,
                          timer > 0 && styles.resendDisabled,
                        ]}
                      >
                        {timer > 0 ? `Resend in ${timer}s` : 'Resend Code'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Secure & Encrypted</Text>
                <Text style={styles.poweredBy}>Powered by AMS Crafters</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      <Modal
        transparent
        visible={customAlert.visible}
        animationType="fade"
        onRequestClose={() =>
          setCustomAlert(prev => ({ ...prev, visible: false }))
        }
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.alertContainer,
              { borderTopColor: alertColors.border },
            ]}
          >
            <View
              style={[
                styles.alertIconCircle,
                { backgroundColor: alertColors.bg + '15' },
              ]}
            >
              <Text style={styles.alertIcon}>{alertColors.icon}</Text>
            </View>

            <Text style={styles.alertTitle}>{customAlert.title}</Text>
            <Text style={styles.alertMessage}>{customAlert.message}</Text>

            <TouchableOpacity
              style={[styles.alertButton, { backgroundColor: alertColors.bg }]}
              onPress={() =>
                setCustomAlert(prev => ({ ...prev, visible: false }))
              }
              activeOpacity={0.8}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingVertical: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#1A5F2B',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#1A5F2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoEmoji: { fontSize: 40 },
  brandName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1A5F2B',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  goldDivider: {
    width: 50,
    height: 3,
    backgroundColor: '#F5A623',
    borderRadius: 2,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  otpContainer: { marginBottom: 32 },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  phoneNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A5F2B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 32,
  },
  otpInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 40,
    flexWrap: 'wrap',
  },
  otpInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
  },
  otpInputFilled: {
    borderColor: '#F5A623',
    borderWidth: 2,
    backgroundColor: '#FFFBEB',
  },
  verifyButton: {
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 4,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonDisabled: { opacity: 0.7 },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  resendText: { color: '#6B7280', fontSize: 14 },
  resendLink: {
    color: '#F5A623',
    fontSize: 14,
    fontWeight: '700',
  },
  resendDisabled: { color: '#D1D5DB' },
  footer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 24,
  },
  footerText: {
    color: '#1A5F2B',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  poweredBy: { color: '#9CA3AF', fontSize: 11 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: width - 48,
    maxWidth: 340,
    alignItems: 'center',
    borderTopWidth: 4,
  },
  alertIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  alertIcon: { fontSize: 32 },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  alertButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 50,
    minWidth: 100,
    alignItems: 'center',
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});