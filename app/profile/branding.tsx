// PROFESSIONAL POS SETTINGS SCREEN
// FINAL VERSION WITH PROFESSIONAL ERROR HANDLING

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import api from '../services/api';

import {
  listWebPrinters,
  selectWebPrinter,
  getWebPrinterSettings,
  testWebPrinter,
} from '../services/webPrinterService';

const LOGO_KEY = 'restaurant_logo';
const ONLINE_DELIVERY_PHONE_KEY = 'online_delivery_phone';

const getWebLocalStorageValue = (key: string) => {
  try {
    if (Platform.OS !== 'web') return '';
    const storage = (globalThis as any)?.localStorage;
    return storage?.getItem?.(key) || '';
  } catch {
    return '';
  }
};

const setWebLocalStorageValue = (key: string, value: string) => {
  try {
    if (Platform.OS !== 'web') return;
    const storage = (globalThis as any)?.localStorage;
    storage?.setItem?.(key, value || '');
  } catch {
    // ignore web localStorage errors
  }
};

const showApiError = (
  error: any,
  fallback = 'Something went wrong'
) => {
  console.log('FULL ERROR =>', error);

  let message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback;

  if (
    message?.includes('Network Error') ||
    message?.includes('ERR_NETWORK')
  ) {
    message =
      'Server se connection nahi ho saka. Internet ya backend check karo.';
  }

  if (error?.response?.status === 401) {
    message = 'Session expired. Dobara login karein.';
  }

  if (error?.response?.status === 403) {
    message = 'Aap ko is action ki permission nahi hai.';
  }

  if (error?.response?.status === 404) {
    message = 'Requested API / resource nahi mili.';
  }

  if (error?.response?.status >= 500) {
    message = 'Server error aya hai. Backend check karo.';
  }

  Alert.alert('Error', message);
};

export default function ProfessionalPOSSettingsScreen() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [logo, setLogo] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    name: '',
    address: '',
    phone: '',
    onlineDeliveryPhone: '',
    email: '',
    ownerName: '',
    planName: '',
    expiryDate: '',
    isActive: true,
  });

  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [paperWidth, setPaperWidth] = useState<58 | 80>(80);
  const [autoCut, setAutoCut] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.all([
      loadProfile(),
      loadLogo(),
      loadPrinterSettings(),
    ]);
  };

  const loadProfile = async () => {
    try {
      const response = await api.get('/restaurant/profile');

      const restaurant = response.data?.restaurant || {};
      const savedOnlineDeliveryPhone =
        getWebLocalStorageValue(ONLINE_DELIVERY_PHONE_KEY) ||
        getWebLocalStorageValue('restaurant_online_delivery_phone') ||
        getWebLocalStorageValue('billpak_online_delivery_phone') ||
        (await AsyncStorage.getItem(ONLINE_DELIVERY_PHONE_KEY)) ||
        (await AsyncStorage.getItem('restaurant_online_delivery_phone')) ||
        '';

      setProfile({
        name: restaurant.name || '',
        address: restaurant.address || '',
        phone: restaurant.phone || '',
        onlineDeliveryPhone: savedOnlineDeliveryPhone || restaurant.onlineDeliveryPhone || '',
        email: restaurant.email || '',
        ownerName: restaurant.ownerName || '',
        planName: restaurant.planName || '',
        expiryDate: restaurant.expiryDate || '',
        isActive: restaurant.isActive ?? true,
      });
    } catch (error: any) {
      showApiError(error, 'Profile load failed');
    }
  };

  const saveProfile = async () => {
    if (!profile.name.trim()) {
      Alert.alert('Error', 'Restaurant name required');
      return;
    }

    try {
      setSaving(true);

      await api.put('/restaurant/profile', {
        name: profile.name,
        address: profile.address,
      });

      await AsyncStorage.setItem(
        'restaurant_name',
        profile.name
      );

      await AsyncStorage.setItem(
        'restaurant_address',
        profile.address
      );

      await AsyncStorage.setItem(
        ONLINE_DELIVERY_PHONE_KEY,
        profile.onlineDeliveryPhone || ''
      );

      await AsyncStorage.setItem(
        'restaurant_online_delivery_phone',
        profile.onlineDeliveryPhone || ''
      );

      setWebLocalStorageValue(
        ONLINE_DELIVERY_PHONE_KEY,
        profile.onlineDeliveryPhone || ''
      );

      setWebLocalStorageValue(
        'restaurant_online_delivery_phone',
        profile.onlineDeliveryPhone || ''
      );

      setWebLocalStorageValue(
        'billpak_online_delivery_phone',
        profile.onlineDeliveryPhone || ''
      );

      Alert.alert(
        'Success',
        'Invoice details updated successfully'
      );
    } catch (error: any) {
      showApiError(error, 'Profile update failed');
    } finally {
      setSaving(false);
    }
  };

  const loadLogo = async () => {
    try {
      const savedLogo = await AsyncStorage.getItem(LOGO_KEY);
      setLogo(savedLogo);
    } catch (error: any) {
      showApiError(error, 'Logo load failed');
    }
  };

  const pickLogo = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Gallery permission allow karo'
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
          allowsEditing: true,
          base64: Platform.OS === 'web',
        });

      if (result.canceled) return;

      const asset = result.assets[0];

      let finalUri = asset.uri;

      if (Platform.OS === 'web' && asset.base64) {
        finalUri = `data:image/png;base64,${asset.base64}`;
      }

      await AsyncStorage.setItem(LOGO_KEY, finalUri);

      setLogo(finalUri);

      Alert.alert(
        'Success',
        'Restaurant logo updated successfully'
      );
    } catch (error: any) {
      showApiError(error, 'Logo upload failed');
    }
  };

  const removeLogo = async () => {
    try {
      await AsyncStorage.removeItem(LOGO_KEY);

      setLogo(null);

      Alert.alert(
        'Success',
        'Logo removed successfully'
      );
    } catch (error: any) {
      showApiError(error, 'Logo remove failed');
    }
  };

  const loadPrinterSettings = async () => {
    try {
      if (Platform.OS !== 'web') return;

      const settings = getWebPrinterSettings();

      setSelectedPrinter(
        settings?.printerName || ''
      );

      setPaperWidth(
        Number(settings?.paperWidth) === 58
          ? 58
          : 80
      );

      setAutoCut(settings?.autoCut !== false);
    } catch (error: any) {
      showApiError(
        error,
        'Printer settings load failed'
      );
    }
  };

  const loadPrinters = async () => {
    try {
      setLoading(true);

      const found = await listWebPrinters();

      setPrinters(found);

      if (!found.length) {
        Alert.alert(
          'No Printer Found',
          'Koi printer detect nahi hua.'
        );
      }
    } catch (error: any) {
      showApiError(error, 'Printers load failed');
    } finally {
      setLoading(false);
    }
  };

  const savePrinter = async () => {
    try {
      if (!selectedPrinter) {
        Alert.alert(
          'Error',
          'Please select printer first'
        );
        return;
      }

      await selectWebPrinter({
        printerName: selectedPrinter,
        paperWidth,
        autoCut,
      });

      Alert.alert(
        'Success',
        'Printer settings saved successfully'
      );
    } catch (error: any) {
      showApiError(error, 'Printer save failed');
    }
  };

  const runTestPrint = async () => {
    try {
      if (!selectedPrinter) {
        Alert.alert(
          'Error',
          'Please select printer first'
        );
        return;
      }

      await testWebPrinter({
        printerName: selectedPrinter,
      });

      Alert.alert(
        'Success',
        'Test print sent successfully'
      );
    } catch (error: any) {
      showApiError(error, 'Test print failed');
    }
  };

  return (
    <>
      <StatusBar style="light" />

      <View style={styles.container}>
        <LinearGradient
          colors={['#1A5F2B', '#0D3D1C']}
          style={styles.header}
        >
          <TouchableOpacity
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="#FFF"
            />
          </TouchableOpacity>

          <View>
            <Text style={styles.headerTitle}>
              POS Settings
            </Text>

            <Text style={styles.headerSub}>
              Branding, Invoice & Printer Settings
            </Text>
          </View>

          <View style={{ width: 24 }} />
        </LinearGradient>

        <ScrollView style={styles.content}>
          {/* LOGO */}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Restaurant Logo
            </Text>

            <View style={styles.logoBox}>
              {logo ? (
                <Image
                  source={{ uri: logo }}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons
                  name="image-outline"
                  size={60}
                  color="#CBD5E1"
                />
              )}
            </View>

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={pickLogo}
              >
                <Text style={styles.btnText}>
                  Upload Logo
                </Text>
              </TouchableOpacity>

              {logo && (
                <TouchableOpacity
                  style={styles.dangerBtn}
                  onPress={removeLogo}
                >
                  <Text style={styles.btnText}>
                    Remove
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* INVOICE DETAILS */}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Invoice Details
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Restaurant Name"
              value={profile.name}
              onChangeText={(t) =>
                setProfile({
                  ...profile,
                  name: t,
                })
              }
            />

            <TextInput
              style={[
                styles.input,
                { height: 90 },
              ]}
              multiline
              placeholder="Restaurant Address"
              value={profile.address}
              onChangeText={(t) =>
                setProfile({
                  ...profile,
                  address: t,
                })
              }
            />

            <Text style={styles.inputLabel}>
              Online Delivery Number
            </Text>

            <TextInput
              style={styles.input}
              placeholder="e.g. 0300-1234567"
              keyboardType="phone-pad"
              value={profile.onlineDeliveryPhone}
              onChangeText={(t) =>
                setProfile({
                  ...profile,
                  onlineDeliveryPhone: t,
                })
              }
            />

            <Text style={styles.helperText}>
              Ye number sales invoice par “For Online Delivery” ke neeche print hoga. KOT par print nahi hoga.
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>
                  Save Invoice Details
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ACCOUNT INFO */}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Account Information
            </Text>

            <Info
              label="Owner"
              value={profile.ownerName}
            />

            <Info
              label="Phone"
              value={profile.phone}
            />

            <Info
              label="Email"
              value={profile.email}
            />

            <Info
              label="Package"
              value={profile.planName}
            />

            <Info
              label="Status"
              value={
                profile.isActive
                  ? 'Active'
                  : 'Inactive'
              }
            />
          </View>

          {/* PRINTER */}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Printer Settings
            </Text>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={loadPrinters}
            >
              {loading ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.secondaryText}>
                  Load Printers
                </Text>
              )}
            </TouchableOpacity>

            {printers.map((printer) => (
              <TouchableOpacity
                key={printer}
                style={[
                  styles.printerItem,
                  selectedPrinter === printer &&
                    styles.selectedPrinter,
                ]}
                onPress={() =>
                  setSelectedPrinter(printer)
                }
              >
                <Text>{printer}</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.row}>
              <TouchableOpacity
                style={[
                  styles.paperBtn,
                  paperWidth === 58 &&
                    styles.paperBtnActive,
                ]}
                onPress={() =>
                  setPaperWidth(58)
                }
              >
                <Text>58mm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paperBtn,
                  paperWidth === 80 &&
                    styles.paperBtnActive,
                ]}
                onPress={() =>
                  setPaperWidth(80)
                }
              >
                <Text>80mm</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() =>
                setAutoCut(!autoCut)
              }
            >
              <Text style={styles.secondaryText}>
                Auto Cut:{' '}
                {autoCut ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={savePrinter}
              >
                <Text style={styles.btnText}>
                  Save Printer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={runTestPrint}
              >
                <Text style={styles.secondaryText}>
                  Test Print
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* PREVIEW */}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Invoice Preview
            </Text>

            {logo && (
              <Image
                source={{ uri: logo }}
                style={styles.previewLogo}
                resizeMode="contain"
              />
            )}

            <Text style={styles.previewName}>
              {profile.name || 'Restaurant'}
            </Text>

            <Text style={styles.previewText}>
              {profile.address}
            </Text>

            <Text style={styles.previewText}>
              {profile.phone}
            </Text>

            {!!profile.onlineDeliveryPhone && (
              <>
                <Text style={styles.previewDeliveryTitle}>
                  For Online Delivery
                </Text>

                <Text style={styles.previewDeliveryPhone}>
                  {profile.onlineDeliveryPhone}
                </Text>
              </>
            )}

            <Text style={styles.previewText}>
              Printer:{' '}
              {selectedPrinter ||
                'Not Selected'}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value || 'N/A'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  header: {
    paddingTop: 55,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },

  headerSub: {
    color: '#D1FAE5',
    fontSize: 12,
  },

  content: {
    flex: 1,
    padding: 16,
  },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
    color: '#0F172A',
  },

  logoBox: {
    height: 160,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  logo: {
    width: 120,
    height: 120,
  },

  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },

  primaryBtn: {
    flex: 1,
    backgroundColor: '#1A5F2B',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },

  secondaryBtn: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },

  dangerBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },

  btnText: {
    color: '#FFF',
    fontWeight: '700',
  },

  secondaryText: {
    color: '#0F172A',
    fontWeight: '700',
  },

  inputLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '800',
    marginBottom: 6,
  },

  helperText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: -6,
    marginBottom: 14,
    lineHeight: 18,
  },

  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  infoLabel: {
    color: '#64748B',
  },

  infoValue: {
    fontWeight: '700',
    color: '#0F172A',
  },

  printerItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    marginBottom: 10,
  },

  selectedPrinter: {
    borderColor: '#1A5F2B',
    backgroundColor: '#DCFCE7',
  },

  paperBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    alignItems: 'center',
  },

  paperBtnActive: {
    backgroundColor: '#BBF7D0',
  },

  previewLogo: {
    width: 90,
    height: 90,
    alignSelf: 'center',
    marginBottom: 12,
  },

  previewName: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#1A5F2B',
  },

  previewText: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 4,
  },

  previewDeliveryTitle: {
    textAlign: 'center',
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
  },

  previewDeliveryPhone: {
    textAlign: 'center',
    color: '#1A5F2B',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3,
  },
});