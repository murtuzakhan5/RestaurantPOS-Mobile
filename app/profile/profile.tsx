import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import api from '../services/api';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    ownerName: '',
    planName: '',
    expiryDate: '',
    isActive: true,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const formatDate = (value: string) => {
    if (!value) return 'N/A';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'N/A';

    return date.toLocaleDateString();
  };

  const loadProfile = async () => {
    setLoading(true);

    try {
      const response = await api.get('/restaurant/profile');
      const restaurant = response.data?.restaurant || {};

      const loadedProfile = {
        name: restaurant.name || restaurant.Name || '',
        address: restaurant.address || restaurant.Address || '',
        phone: restaurant.phone || restaurant.Phone || '',
        email: restaurant.email || restaurant.Email || '',
        ownerName: restaurant.ownerName || restaurant.OwnerName || '',
        planName: restaurant.planName || restaurant.PlanName || '',
        expiryDate: restaurant.expiryDate || restaurant.ExpiryDate || '',
        isActive: restaurant.isActive ?? restaurant.IsActive ?? true,
      };

      setProfile(loadedProfile);

      await AsyncStorage.setItem('restaurant_name', loadedProfile.name || 'BillPak');
      await AsyncStorage.setItem('restaurant_address', loadedProfile.address || '');
      await AsyncStorage.setItem('restaurant_phone', loadedProfile.phone || '');
      await AsyncStorage.setItem('restaurant_owner_name', loadedProfile.ownerName || '');
      await AsyncStorage.setItem('restaurant_plan_name', loadedProfile.planName || '');
    } catch (error: any) {
      console.log('Profile load error:', error.response?.data || error.message);
      Alert.alert('Error', 'Failed to load restaurant profile');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile.name.trim()) {
      Alert.alert('Error', 'Restaurant name is required');
      return;
    }

    setSaving(true);

    try {
      const response = await api.put('/restaurant/profile', {
        name: profile.name.trim(),
        address: profile.address.trim(),
      });

      await AsyncStorage.setItem('restaurant_name', profile.name.trim());
      await AsyncStorage.setItem('restaurant_address', profile.address.trim());

      Alert.alert(
        'Success',
        response.data?.message || 'Restaurant invoice details updated successfully'
      );
    } catch (error: any) {
      console.log('Profile save error:', error.response?.data || error.message);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to update restaurant profile'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1A5F2B" />
        <Text style={styles.loaderText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />

      <View style={styles.container}>
        <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Restaurant Profile</Text>
            <Text style={styles.headerSubtitle}>Invoice billing details</Text>
          </View>

          <View style={{ width: 40 }} />
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="receipt-outline" size={26} color="#1A5F2B" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Invoice Details</Text>
                <Text style={styles.cardSubtitle}>
                  These details will appear on customer invoices only.
                </Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Restaurant Name *</Text>
              <TextInput
                value={profile.name}
                onChangeText={(text) => setProfile({ ...profile, name: text })}
                style={styles.input}
                placeholder="Restaurant name"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Restaurant Address</Text>
              <TextInput
                value={profile.address}
                onChangeText={(text) => setProfile({ ...profile, address: text })}
                style={[styles.input, styles.textArea]}
                placeholder="Restaurant address"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              onPress={saveProfile}
              disabled={saving}
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            >
              <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.saveGradient}>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                <Text style={styles.saveText}>
                  {saving ? 'Saving...' : 'Save Invoice Details'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Information</Text>
            <Text style={styles.cardSubtitle}>
              These details are read-only and managed by Super Admin.
            </Text>

            <View style={styles.infoBox}>
              <InfoRow label="Owner Name" value={profile.ownerName || 'N/A'} />
              <InfoRow label="Registration Phone" value={profile.phone || 'N/A'} />
              <InfoRow label="Email" value={profile.email || 'N/A'} />
              <InfoRow label="Package" value={profile.planName || 'N/A'} />
              <InfoRow label="Expiry Date" value={formatDate(profile.expiryDate)} />
              <InfoRow
                label="Status"
                value={profile.isActive ? 'Active' : 'Inactive'}
                valueColor={profile.isActive ? '#16A34A' : '#DC2626'}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

function InfoRow({
  label,
  value,
  valueColor = '#0F172A',
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },

  loaderText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },

  backBtn: { padding: 8 },

  headerTitleBox: {
    flex: 1,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  headerSubtitle: {
    color: '#D1FAE5',
    fontSize: 12,
    marginTop: 2,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },

  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },

  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },

  inputGroup: {
    marginBottom: 14,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 7,
  },

  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 14,
  },

  textArea: {
    minHeight: 86,
    textAlignVertical: 'top',
  },

  saveBtn: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },

  saveBtnDisabled: {
    opacity: 0.6,
  },

  saveGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },

  saveText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },

  infoBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    overflow: 'hidden',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  infoLabel: {
    color: '#64748B',
    fontSize: 13,
    flex: 1,
  },

  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
});
