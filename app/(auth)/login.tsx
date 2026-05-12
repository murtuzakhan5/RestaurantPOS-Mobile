import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Modal,
  Linking,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'https://billpak.runasp.net/api';
// const API_URL = 'https://localhost:7246/api';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;
const isDesktop = width >= 1024;

type AlertType = 'success' | 'error' | 'info';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'success' as AlertType,
  });

  const [helpModalVisible, setHelpModalVisible] = useState(false);

  const showCustomAlert = (
    title: string,
    message: string,
    type: AlertType = 'success'
  ) => {
    setCustomAlert({ visible: true, title, message, type });

    setTimeout(() => {
      setCustomAlert(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  const normalizePhone = (value: string) => {
    let formattedPhone = value.trim().replace(/\s/g, '').replace(/-/g, '');

    if (formattedPhone.startsWith('+92')) {
      formattedPhone = `0${formattedPhone.substring(3)}`;
    }

    if (formattedPhone.length === 10) {
      formattedPhone = `0${formattedPhone}`;
    }

    return formattedPhone;
  };

  const getDefaultOwnerPermissions = () => [
    'dashboard',
    'takeaway',
    'dinein',
    'print_bill',
    'products',
    'inventory',
    'recipe',
    'reports',
    'expenses',
    'staff',
    'branding',
    'settings',
  ];

  const saveLoginData = async (data: any, formattedPhone: string) => {
    const permissions =
      data.permissions && Array.isArray(data.permissions)
        ? data.permissions
        : Number(data.role) === 2
        ? getDefaultOwnerPermissions()
        : [];

    const userData = data.user || {
      id: data.userId,
      userId: data.userId,
      name: data.name,
      phone: data.phone || formattedPhone,
      email: data.email || null,
      role: Number(data.role || 0),
      roleName:
        data.roleName ||
        (Number(data.role) === 2
          ? 'Owner'
          : Number(data.role) === 3
          ? 'Cashier'
          : Number(data.role) === 4
          ? 'Manager'
          : Number(data.role) === 5
          ? 'Kitchen'
          : 'User'),
      restaurantId: data.restaurantId,
      permissions,
    };

    await AsyncStorage.setItem('loginPhone', formattedPhone);
    await AsyncStorage.setItem('token', data.token || '');
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    await AsyncStorage.setItem('permissions', JSON.stringify(permissions));
  };

  const handleLogin = async () => {
    if (!phone || phone.trim() === '') {
      showCustomAlert(
        'Phone Number Required',
        'Please enter your phone number to continue.',
        'error'
      );
      return;
    }

    const formattedPhone = normalizePhone(phone);

    if (formattedPhone.length < 11) {
      showCustomAlert(
        'Invalid Phone Number',
        'Please enter a valid mobile number.',
        'error'
      );
      return;
    }

    if (passwordRequired && !password.trim()) {
      showCustomAlert(
        'Password Required',
        'Please enter your staff password.',
        'error'
      );
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        phone: formattedPhone,
      };

      if (passwordRequired || password.trim()) {
        payload.password = password.trim();
      }

      console.log('LOGIN PAYLOAD:', payload);

      const loginResponse = await axios.post(`${API_URL}/auth/login`, payload);

      console.log('LOGIN RESPONSE:', loginResponse.data);

      const data = loginResponse.data;

      if (data.passwordRequired) {
        setPasswordRequired(true);
        setStaffName(data.name || 'Staff User');
        setPassword('');

        showCustomAlert(
          'Staff Account Detected',
          'Please enter your staff password to continue.',
          'info'
        );

        return;
      }

      if (data.success) {
        await saveLoginData(data, formattedPhone);

        showCustomAlert(
          'Login Successful 🎉',
          `Welcome ${data.name || ''}! Redirecting...`,
          'success'
        );

        setTimeout(() => {
          router.replace('/(tabs)');
        }, 900);

        return;
      }

      showCustomAlert(
        'Login Failed',
        data.message || 'Unable to login. Please try again.',
        'error'
      );
    } catch (error: any) {
      console.error('Login error:', error.response?.data || error.message);

      if (!error.response) {
        showCustomAlert(
          'Connection Error',
          'Unable to connect to server. Please check your internet connection and try again.',
          'error'
        );
        return;
      }

      const errorData = error.response?.data;
      const errorMsg =
        typeof errorData === 'string'
          ? errorData
          : errorData?.message || 'An unexpected error occurred.';
      const status = error.response?.status;

      if (
        errorMsg.toString().toLowerCase().includes('not found') ||
        errorMsg.toString().toLowerCase().includes('inactive') ||
        status === 404
      ) {
        showCustomAlert(
          'Account Not Found ❌',
          'This phone number is not registered in our system. Please contact your restaurant administrator.',
          'error'
        );
      } else if (status === 401) {
        showCustomAlert(
          'Invalid Password',
          errorMsg || 'Password incorrect hai. Please try again.',
          'error'
        );
      } else if (status === 400) {
        showCustomAlert(
          'Invalid Request',
          errorMsg || 'Please check your phone number and try again.',
          'error'
        );
      } else {
        showCustomAlert('Login Failed', errorMsg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (text: string) => {
    setPhone(text);
    setPassword('');
    setPasswordRequired(false);
    setStaffName('');
    setShowPassword(false);
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:support@billpak.com');
  };

  const handlePhoneSupport = () => {
    Linking.openURL('tel:+923001234567');
  };

  const getResponsiveStyles = () => {
    if (isDesktop) {
      return {
        cardWidth: 500,
        logoSize: 120,
        brandFont: 42,
      };
    }

    if (isTablet) {
      return {
        cardWidth: 450,
        logoSize: 110,
        brandFont: 38,
      };
    }

    return {
      cardWidth: width - 40,
      logoSize: 96,
      brandFont: 34,
    };
  };

  const responsive = getResponsiveStyles();

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
                <View
                  style={[
                    styles.logoCircle,
                    {
                      width: responsive.logoSize,
                      height: responsive.logoSize,
                      borderRadius: responsive.logoSize / 2.5,
                    },
                  ]}
                >
                  <Image
                    source={require('../../assets/images/billpak-logo.png')}
                    style={[
                      styles.logoImage,
                      {
                        width: responsive.logoSize * 0.75,
                        height: responsive.logoSize * 0.75,
                      },
                    ]}
                    resizeMode="contain"
                  />
                </View>

                <Text
                  style={[
                    styles.brandName,
                    { fontSize: responsive.brandFont },
                  ]}
                >
                  BillPak
                </Text>

                <View style={styles.goldDivider} />
                <Text style={styles.tagline}>
                  Smart Restaurant Billing System
                </Text>
              </View>

              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeText}>
                  {passwordRequired ? 'Staff Login 🔐' : 'Welcome Back! 👋'}
                </Text>
                <Text style={styles.subText}>
                  {passwordRequired
                    ? 'Staff account detected. Enter your password to continue.'
                    : 'Sign in to manage your restaurant billing, KOT, and orders'}
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number</Text>

                <View style={styles.phoneInputWrapper}>
                  <View style={styles.countryCodeContainer}>
                    <Text style={styles.countryCode}>+92</Text>
                  </View>

                  <TextInput
                    style={styles.phoneInput}
                    placeholder="300 1234567"
                    placeholderTextColor="#9CA3AF"
                    value={phone}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    maxLength={13}
                    editable={!loading}
                  />
                </View>

                <Text style={styles.inputHint}>
                  Enter mobile number e.g. 3001234567
                </Text>
              </View>

              {passwordRequired && (
                <View style={styles.passwordContainer}>
                  <View style={styles.staffNotice}>
                    <Ionicons
                      name="person-circle-outline"
                      size={18}
                      color="#1A5F2B"
                    />
                    <Text style={styles.staffNoticeText}>
                      {staffName ? `${staffName}` : 'Staff account detected'}
                    </Text>
                  </View>

                  <Text style={styles.inputLabel}>Staff Password</Text>

                  <View style={styles.passwordInputWrapper}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Enter staff password"
                      placeholderTextColor="#9CA3AF"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                    />

                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(prev => !prev)}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={22}
                        color="#6B7280"
                      />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.changePhoneButton}
                    onPress={() => {
                      setPasswordRequired(false);
                      setPassword('');
                      setStaffName('');
                      setShowPassword(false);
                    }}
                  >
                    <Text style={styles.changePhoneText}>
                      Change phone number
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.signInButton,
                  loading && styles.signInButtonDisabled,
                ]}
                onPress={handleLogin}
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
                    <Text style={styles.signInButtonText}>
                      {passwordRequired ? 'Login as Staff →' : 'Sign In →'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.helpContainer}
                onPress={() => setHelpModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.helpText}>Need help? Contact Support</Text>
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>BillPak</Text>
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

      <Modal
        transparent
        visible={helpModalVisible}
        animationType="slide"
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.helpModalContainer}>
            <View style={styles.helpModalHeader}>
              <Text style={styles.helpModalTitle}>Need Help? 🤝</Text>

              <TouchableOpacity
                onPress={() => setHelpModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.helpModalBody}>
              <Text style={styles.helpModalSubtitle}>
                Having trouble logging in?
              </Text>

              <Text style={styles.helpModalText}>
                Owner can login with registered phone number. Staff users should
                use the phone number and password created by the owner/admin.
              </Text>

              <View style={styles.divider} />

              <Text style={styles.helpModalSubtitle}>Contact Support Team</Text>

              <TouchableOpacity
                style={styles.contactOption}
                onPress={handleEmailSupport}
                activeOpacity={0.7}
              >
                <Text style={styles.contactIcon}>📧</Text>

                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>Email Us</Text>
                  <Text style={styles.contactValue}>support@billpak.com</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contactOption}
                onPress={handlePhoneSupport}
                activeOpacity={0.7}
              >
                <Text style={styles.contactIcon}>📞</Text>

                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>Call Us</Text>
                  <Text style={styles.contactValue}>+92 300 1234567</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.helpModalButton}
              onPress={() => setHelpModalVisible(false)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#F5A623', '#D48A1A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.helpModalGradient}
              >
                <Text style={styles.helpModalButtonText}>Got it</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
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
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    backgroundColor: '#1A5F2B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#1A5F2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoImage: {
    tintColor: '#F5A623',
  },
  brandName: {
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
  welcomeContainer: {
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    fontWeight: '600',
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  countryCodeContainer: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  countryCode: {
    fontSize: 16,
    color: '#1A5F2B',
    fontWeight: '700',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  inputHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    marginLeft: 4,
  },
  passwordContainer: {
    marginBottom: 24,
  },
  staffNotice: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  staffNoticeText: {
    color: '#1A5F2B',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  passwordInputWrapper: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  changePhoneButton: {
    alignSelf: 'center',
    marginTop: 10,
  },
  changePhoneText: {
    color: '#F5A623',
    fontSize: 12,
    fontWeight: '700',
  },
  signInButton: {
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  helpContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  helpText: {
    color: '#F5A623',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 24,
  },
  footerText: {
    color: '#1A5F2B',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  poweredBy: {
    color: '#9CA3AF',
    fontSize: 11,
  },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  alertIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  alertIcon: {
    fontSize: 32,
  },
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
  helpModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    width: width - 48,
    maxWidth: 380,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  helpModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  helpModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A5F2B',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  helpModalBody: {
    padding: 20,
  },
  helpModalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  helpModalText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 16,
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A5F2B',
  },
  helpModalButton: {
    borderRadius: 0,
    overflow: 'hidden',
    marginTop: 8,
  },
  helpModalGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpModalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});