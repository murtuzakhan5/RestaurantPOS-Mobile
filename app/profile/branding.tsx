import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';

// IMPORTANT:
// Is path ko apne project ke hisaab se adjust karna.
// Ye wahi file honi chahiye jisme listWebPrinters, selectWebPrinter,
// getWebPrinterSettings aur testWebPrinter export ho rahe hain.
import {
  listWebPrinters,
  selectWebPrinter,
  getWebPrinterSettings,
  testWebPrinter,
} from '../services/webPrinterService';

const LOGO_KEY = 'restaurant_logo';
const LOGO_FILE_NAME = 'restaurant_logo.png';

export default function BrandingScreen() {
  const [logo, setLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');

  const [printerLoading, setPrinterLoading] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [paperWidth, setPaperWidth] = useState<58 | 80>(80);
  const [autoCut, setAutoCut] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await loadLogo();
    await loadRestaurantInfo();
    await loadPrinterSettings();
  };

  const loadLogo = async () => {
    try {
      const savedLogo = await AsyncStorage.getItem(LOGO_KEY);
      setLogo(savedLogo || null);
    } catch (error) {
      console.log('Load logo error:', error);
      setLogo(null);
    }
  };

  const loadRestaurantInfo = async () => {
    try {
      const [name, address, phone, owner] = await Promise.all([
        AsyncStorage.getItem('restaurant_name'),
        AsyncStorage.getItem('restaurant_address'),
        AsyncStorage.getItem('restaurant_phone'),
        AsyncStorage.getItem('restaurant_owner_name'),
      ]);

      setRestaurantName(name || '');
      setRestaurantAddress(address || '');
      setRestaurantPhone(phone || '');
      setOwnerName(owner || '');
    } catch (error) {
      console.log('Load restaurant info error:', error);
    }
  };

  const loadPrinterSettings = async () => {
    if (Platform.OS !== 'web') return;

    try {
      const settings = getWebPrinterSettings();

      setSelectedPrinter(settings?.printerName || '');
      setPaperWidth(Number(settings?.paperWidth) === 58 ? 58 : 80);
      setAutoCut(settings?.autoCut !== false);
    } catch (error) {
      console.log('Load printer settings error:', error);
    }
  };

  const loadPrinters = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Printer Settings', 'Direct QZ printing sirf web version par available hai.');
      return;
    }

    setPrinterLoading(true);

    try {
      const foundPrinters = await listWebPrinters();
      setPrinters(foundPrinters);

      const settings = getWebPrinterSettings();
      const savedPrinter = settings?.printerName || '';

      if (savedPrinter && foundPrinters.includes(savedPrinter)) {
        setSelectedPrinter(savedPrinter);
      } else if (!selectedPrinter && foundPrinters.length) {
        setSelectedPrinter(foundPrinters[0]);
      }

      if (!foundPrinters.length) {
        Alert.alert('No Printer Found', 'Koi printer detect nahi hua. Printer install karke QZ Tray restart karo.');
      }
    } catch (error: any) {
      console.log('Load printers error:', error);
      Alert.alert('Printer Error', error?.message || 'Printers load nahi ho sake.');
    } finally {
      setPrinterLoading(false);
    }
  };

  const savePrinterSettings = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Printer Settings', 'Direct QZ printing sirf web version par available hai.');
      return;
    }

    if (!selectedPrinter) {
      Alert.alert('Error', 'Please select printer first');
      return;
    }

    setPrinterLoading(true);

    try {
      const saved = await selectWebPrinter({
        printerName: selectedPrinter,
        paperWidth,
        autoCut,
      });

      setSelectedPrinter(saved);
      Alert.alert('Success', `Printer saved: ${saved}`);
    } catch (error: any) {
      console.log('Save printer error:', error);
      Alert.alert('Printer Error', error?.message || 'Printer save nahi ho saka.');
    } finally {
      setPrinterLoading(false);
    }
  };

  const runTestPrint = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Printer Test', 'Direct QZ printing sirf web version par available hai.');
      return;
    }

    if (!selectedPrinter) {
      Alert.alert('Error', 'Please select printer first');
      return;
    }

    setPrinterLoading(true);

    try {
      await selectWebPrinter({
        printerName: selectedPrinter,
        paperWidth,
        autoCut,
      });

      await testWebPrinter({
        printerName: selectedPrinter,
      });

      Alert.alert('Success', 'Test print sent successfully');
    } catch (error: any) {
      console.log('Test print error:', error);
      Alert.alert('Printer Error', error?.message || 'Test print nahi ho saka.');
    } finally {
      setPrinterLoading(false);
    }
  };

  const saveRestaurantInfo = async () => {
    if (!restaurantName.trim()) {
      Alert.alert('Error', 'Please enter restaurant name');
      return;
    }

    setLoading(true);

    try {
      await Promise.all([
        AsyncStorage.setItem('restaurant_name', restaurantName.trim()),
        AsyncStorage.setItem('restaurant_address', restaurantAddress.trim()),
        AsyncStorage.setItem('restaurant_phone', restaurantPhone.trim()),
        AsyncStorage.setItem('restaurant_owner_name', ownerName.trim()),
      ]);

      Alert.alert('Success', 'Restaurant information saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save information');
    } finally {
      setLoading(false);
    }
  };

  const ensureBrandingDirectory = async () => {
    const brandingDir = `${FileSystem.documentDirectory}branding/`;
    const dirInfo = await FileSystem.getInfoAsync(brandingDir);

    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(brandingDir, { intermediates: true });
    }

    return brandingDir;
  };

  const pickLogo = async () => {
    try {
      setLoading(true);

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission Required', 'Gallery permission allow karo');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: true,
        aspect: [16, 9],
        base64: Platform.OS === 'web',
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      let finalLogoUri = asset.uri;

      if (Platform.OS === 'web' && asset.base64) {
        finalLogoUri = `data:image/png;base64,${asset.base64}`;
      } else if (Platform.OS !== 'web') {
        const brandingDir = await ensureBrandingDirectory();
        const permanentLogoPath = `${brandingDir}${LOGO_FILE_NAME}`;
        const oldFile = await FileSystem.getInfoAsync(permanentLogoPath);

        if (oldFile.exists) {
          await FileSystem.deleteAsync(permanentLogoPath, { idempotent: true });
        }

        await FileSystem.copyAsync({ from: asset.uri, to: permanentLogoPath });
        finalLogoUri = permanentLogoPath;
      }

      await AsyncStorage.setItem(LOGO_KEY, finalLogoUri);
      setLogo(finalLogoUri);

      Alert.alert('Success', 'Logo updated successfully!');
    } catch (error: any) {
      console.log('Pick logo error:', error);
      Alert.alert('Error', error?.message || 'Logo save nahi ho saka');
    } finally {
      setLoading(false);
    }
  };

  const removeLogo = async () => {
    try {
      setLoading(true);

      const savedLogo = await AsyncStorage.getItem(LOGO_KEY);

      if (savedLogo && Platform.OS !== 'web') {
        const fileInfo = await FileSystem.getInfoAsync(savedLogo);

        if (fileInfo.exists) {
          await FileSystem.deleteAsync(savedLogo, { idempotent: true });
        }
      }

      await AsyncStorage.removeItem(LOGO_KEY);
      setLogo(null);

      Alert.alert('Removed', 'Logo removed successfully');
    } catch (error) {
      Alert.alert('Error', 'Logo remove nahi ho saka');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />

      <View style={styles.container}>
        <LinearGradient colors={['#0F172A', '#1A5F2B', '#0D3D1C']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Branding</Text>

          <View style={{ width: 40 }} />
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Restaurant Logo</Text>
            <Text style={styles.sectionSubtitle}>Logo invoice par top center mein print hoga</Text>

            <View style={styles.logoBox}>
              {logo ? (
                <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" />
              ) : (
                <View style={styles.emptyLogo}>
                  <Ionicons name="image-outline" size={55} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No logo uploaded</Text>
                </View>
              )}
            </View>

            <View style={styles.logoButtons}>
              <TouchableOpacity
                style={[styles.uploadBtn, loading && styles.disabledBtn]}
                onPress={pickLogo}
                disabled={loading}
              >
                <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.btnGradient}>
                  <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
                  <Text style={styles.btnText}>{logo ? 'Change Logo' : 'Upload Logo'}</Text>
                </LinearGradient>
              </TouchableOpacity>

              {logo && (
                <TouchableOpacity
                  style={[styles.removeBtn, loading && styles.disabledBtn]}
                  onPress={removeLogo}
                  disabled={loading}
                >
                  <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.btnGradient}>
                    <Ionicons name="trash-outline" size={20} color="#FFF" />
                    <Text style={styles.btnText}>Remove</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Restaurant Information</Text>
            <Text style={styles.sectionSubtitle}>Yeh details invoice par print hongi</Text>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Restaurant Name *</Text>
                <TextInput
                  style={styles.infoInput}
                  placeholder="e.g., BillPak Restaurant"
                  placeholderTextColor="#94A3B8"
                  value={restaurantName}
                  onChangeText={setRestaurantName}
                />
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <TextInput
                  style={styles.infoInput}
                  placeholder="Full restaurant address"
                  placeholderTextColor="#94A3B8"
                  value={restaurantAddress}
                  onChangeText={setRestaurantAddress}
                  multiline
                />
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <TextInput
                  style={styles.infoInput}
                  placeholder="e.g., 0300 1234567"
                  placeholderTextColor="#94A3B8"
                  value={restaurantPhone}
                  onChangeText={setRestaurantPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Owner Name</Text>
                <TextInput
                  style={styles.infoInput}
                  placeholder="Owner/Manager name"
                  placeholderTextColor="#94A3B8"
                  value={ownerName}
                  onChangeText={setOwnerName}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.disabledBtn]}
              onPress={saveRestaurantInfo}
              disabled={loading}
            >
              <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.btnGradient}>
                <Ionicons name="save-outline" size={20} color="#FFF" />
                <Text style={styles.btnText}>Save Information</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Printer Settings</Text>
            <Text style={styles.sectionSubtitle}>
              Client aik dafa printer select karega, phir single click par invoice/KOT print hoga
            </Text>

            {Platform.OS !== 'web' ? (
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={22} color="#B45309" />
                <Text style={styles.warningText}>
                  Direct QZ printing sirf web version par available hai.
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.refreshPrinterBtn, printerLoading && styles.disabledBtn]}
                  onPress={loadPrinters}
                  disabled={printerLoading}
                >
                  <Ionicons name="refresh-outline" size={18} color="#1A5F2B" />
                  <Text style={styles.refreshPrinterText}>
                    {printerLoading ? 'Loading Printers...' : 'Load / Refresh Printers'}
                  </Text>
                </TouchableOpacity>

                {printerLoading && (
                  <View style={styles.printerLoader}>
                    <ActivityIndicator size="small" color="#1A5F2B" />
                    <Text style={styles.printerLoaderText}>QZ printers load ho rahe hain...</Text>
                  </View>
                )}

                <View style={styles.printerCard}>
                  <Text style={styles.infoLabel}>Selected Printer</Text>

                  {selectedPrinter ? (
                    <View style={styles.selectedPrinterBox}>
                      <Ionicons name="print-outline" size={20} color="#1A5F2B" />
                      <Text style={styles.selectedPrinterText}>{selectedPrinter}</Text>
                    </View>
                  ) : (
                    <View style={styles.selectedPrinterBox}>
                      <Ionicons name="print-outline" size={20} color="#94A3B8" />
                      <Text style={styles.noPrinterText}>No printer selected</Text>
                    </View>
                  )}

                  <Text style={styles.printerHint}>
                    Agar printer list empty ho to pehle QZ Tray open karo, printer install karo, phir refresh dabao.
                  </Text>

                  {printers.length > 0 && (
                    <View style={styles.printerList}>
                      {printers.map((printer) => {
                        const isSelected = printer === selectedPrinter;

                        return (
                          <TouchableOpacity
                            key={printer}
                            style={[
                              styles.printerOption,
                              isSelected && styles.printerOptionSelected,
                            ]}
                            onPress={() => setSelectedPrinter(printer)}
                            disabled={printerLoading}
                          >
                            <Ionicons
                              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                              size={20}
                              color={isSelected ? '#1A5F2B' : '#94A3B8'}
                            />
                            <Text
                              style={[
                                styles.printerOptionText,
                                isSelected && styles.printerOptionTextSelected,
                              ]}
                            >
                              {printer}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={styles.paperCard}>
                  <Text style={styles.infoLabel}>Paper Width</Text>

                  <View style={styles.paperOptions}>
                    <TouchableOpacity
                      style={[styles.paperOption, paperWidth === 58 && styles.paperOptionSelected]}
                      onPress={() => setPaperWidth(58)}
                    >
                      <Text
                        style={[
                          styles.paperOptionText,
                          paperWidth === 58 && styles.paperOptionTextSelected,
                        ]}
                      >
                        58mm
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.paperOption, paperWidth === 80 && styles.paperOptionSelected]}
                      onPress={() => setPaperWidth(80)}
                    >
                      <Text
                        style={[
                          styles.paperOptionText,
                          paperWidth === 80 && styles.paperOptionTextSelected,
                        ]}
                      >
                        80mm
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.autoCutRow}
                  onPress={() => setAutoCut((value) => !value)}
                >
                  <View>
                    <Text style={styles.autoCutTitle}>Auto Cut</Text>
                    <Text style={styles.autoCutSubtitle}>Printer support karta ho to receipt cut hogi</Text>
                  </View>

                  <View style={[styles.switchBox, autoCut && styles.switchBoxOn]}>
                    <View style={[styles.switchDot, autoCut && styles.switchDotOn]} />
                  </View>
                </TouchableOpacity>

                <View style={styles.printerButtons}>
                  <TouchableOpacity
                    style={[styles.savePrinterBtn, printerLoading && styles.disabledBtn]}
                    onPress={savePrinterSettings}
                    disabled={printerLoading}
                  >
                    <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.btnGradient}>
                      <Ionicons name="save-outline" size={20} color="#FFF" />
                      <Text style={styles.btnText}>Save Printer</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.testPrinterBtn, printerLoading && styles.disabledBtn]}
                    onPress={runTestPrint}
                    disabled={printerLoading}
                  >
                    <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.btnGradient}>
                      <Ionicons name="print-outline" size={20} color="#FFF" />
                      <Text style={styles.btnText}>Test Print</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invoice Preview</Text>

            <View style={styles.previewCard}>
              {logo && <Image source={{ uri: logo }} style={styles.previewLogo} resizeMode="contain" />}
              <Text style={styles.previewName}>{restaurantName || 'BillPak'}</Text>
              {restaurantAddress && <Text style={styles.previewAddress}>{restaurantAddress}</Text>}
              {restaurantPhone && <Text style={styles.previewPhone}>📞 {restaurantPhone}</Text>}
              {selectedPrinter && (
                <Text style={styles.previewPrinter}>Printer: {selectedPrinter}</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },

  header: {
    paddingTop: Platform.OS === 'ios' ? 55 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 25,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },

  content: {
    flex: 1,
    padding: 16,
  },

  section: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
  },

  logoBox: {
    width: 140,
    height: 140,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    alignSelf: 'center',
  },

  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },

  emptyLogo: {
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 8,
  },

  logoButtons: {
    flexDirection: 'row',
    gap: 12,
  },

  uploadBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },

  removeBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },

  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },

  btnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },

  disabledBtn: {
    opacity: 0.6,
  },

  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },

  infoRow: {
    marginBottom: 12,
  },

  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },

  infoInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFF',
  },

  saveBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  warningBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  warningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    fontWeight: '600',
  },

  refreshPrinterBtn: {
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },

  refreshPrinterText: {
    color: '#1A5F2B',
    fontWeight: '800',
    fontSize: 14,
  },

  printerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  printerLoaderText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },

  printerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },

  selectedPrinterBox: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  selectedPrinterText: {
    flex: 1,
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },

  noPrinterText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },

  printerHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
  },

  printerList: {
    marginTop: 12,
    gap: 8,
  },

  printerOption: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  printerOptionSelected: {
    borderColor: '#1A5F2B',
    backgroundColor: '#F0FDF4',
  },

  printerOptionText: {
    flex: 1,
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },

  printerOptionTextSelected: {
    color: '#1A5F2B',
    fontWeight: '800',
  },

  paperCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },

  paperOptions: {
    flexDirection: 'row',
    gap: 10,
  },

  paperOption: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },

  paperOptionSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#1A5F2B',
  },

  paperOptionText: {
    color: '#64748B',
    fontWeight: '800',
  },

  paperOptionTextSelected: {
    color: '#1A5F2B',
  },

  autoCutRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  autoCutTitle: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
  },

  autoCutSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },

  switchBox: {
    width: 48,
    height: 28,
    borderRadius: 20,
    backgroundColor: '#CBD5E1',
    padding: 3,
    justifyContent: 'center',
  },

  switchBoxOn: {
    backgroundColor: '#1A5F2B',
  },

  switchDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
  },

  switchDotOn: {
    alignSelf: 'flex-end',
  },

  printerButtons: {
    flexDirection: 'row',
    gap: 12,
  },

  savePrinterBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },

  testPrinterBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },

  previewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },

  previewLogo: {
    width: 80,
    height: 80,
    marginBottom: 8,
  },

  previewName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A5F2B',
    textAlign: 'center',
  },

  previewAddress: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },

  previewPhone: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },

  previewPrinter: {
    fontSize: 10,
    color: '#1A5F2B',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '700',
  },
});