import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import staffApi, { StaffUser } from '../services/staffApi';

const MODULES = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { key: 'takeaway', label: 'Takeaway', icon: 'bag-handle-outline' },
  { key: 'dinein', label: 'Dine In Billing', icon: 'restaurant-outline' },
  { key: 'tables', label: 'Tables Add/Edit', icon: 'apps-outline' },
  { key: 'print_bill', label: 'Print Bill', icon: 'print-outline' },
  { key: 'products', label: 'Products', icon: 'fast-food-outline' },
  { key: 'inventory', label: 'Inventory', icon: 'cube-outline' },
  { key: 'recipe', label: 'Recipe Setup', icon: 'git-branch-outline' },
  { key: 'reports', label: 'Reports', icon: 'bar-chart-outline' },
  { key: 'expenses', label: 'Expenses', icon: 'wallet-outline' },
  { key: 'staff', label: 'Employee Access', icon: 'people-outline' },
  { key: 'branding', label: 'Branding', icon: 'image-outline' },
  { key: 'settings', label: 'Settings/Profile', icon: 'settings-outline' },
];

const QUICK_PRESETS = [
  {
    label: 'Counter Billing',
    permissions: ['takeaway', 'dinein', 'print_bill'],
  },
  {
    label: 'Billing + Tables',
    permissions: ['takeaway', 'dinein', 'tables', 'print_bill'],
  },
  {
    label: 'Products + Recipe',
    permissions: ['products', 'recipe'],
  },
  {
    label: 'Inventory Control',
    permissions: ['inventory', 'recipe'],
  },
  {
    label: 'Reports + Expenses',
    permissions: ['reports', 'expenses'],
  },
  {
    label: 'Full Access',
    permissions: [
      'dashboard',
      'takeaway',
      'dinein',
      'tables',
      'print_bill',
      'products',
      'inventory',
      'recipe',
      'reports',
      'expenses',
      'staff',
      'branding',
      'settings',
    ],
  },
];

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  password: '',
  role: 3,
  permissions: ['takeaway', 'dinein', 'print_bill'],
};

export default function StaffManagementScreen() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showInactive, setShowInactive] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);

  const [form, setForm] = useState(emptyForm);

  const activeStaff = useMemo(
    () => staff.filter(item => item.isActive),
    [staff]
  );

  const inactiveStaff = useMemo(
    () => staff.filter(item => !item.isActive),
    [staff]
  );

  const visibleStaff = showInactive ? staff : activeStaff;

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      setLoading(true);

      const data = await staffApi.getStaff();

      setStaff(data || []);
    } catch (error: any) {
      console.log('Load staff error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        Alert.alert('Unauthorized', 'Please login again.');
        router.replace('/(auth)/login');
        return;
      }

      if (error.response?.status === 403) {
        Alert.alert(
          'Access Denied',
          error.response?.data?.message ||
            'You do not have access to Employee Access.'
        );
        return;
      }

      Alert.alert('Error', 'Employee data load nahi ho saka.');
    } finally {
      setLoading(false);
    }
  };

  const normalizePhone = (value: string) => {
    let phone = value.trim().replace(/\s/g, '').replace(/-/g, '');

    if (phone.startsWith('+92')) {
      phone = `0${phone.substring(3)}`;
    }

    if (phone.length === 10) {
      phone = `0${phone}`;
    }

    return phone;
  };

  const openAddModal = () => {
    setEditingStaff(null);
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEditModal = (item: StaffUser) => {
    setEditingStaff(item);

    setForm({
      name: item.name || '',
      phone: item.phone || '',
      email: item.email || '',
      password: '',
      role: 3,
      permissions:
        item.permissions && item.permissions.length > 0
          ? item.permissions
          : ['takeaway', 'dinein', 'print_bill'],
    });

    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingStaff(null);
    setForm(emptyForm);
  };

  const togglePermission = (key: string) => {
    setForm(prev => {
      const exists = prev.permissions.includes(key);

      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter(x => x !== key)
          : [...prev.permissions, key],
      };
    });
  };

  const applyPreset = (permissions: string[]) => {
    setForm(prev => ({
      ...prev,
      permissions,
    }));
  };

  const selectAllModules = () => {
    setForm(prev => ({
      ...prev,
      permissions: MODULES.map(x => x.key),
    }));
  };

  const clearAllModules = () => {
    setForm(prev => ({
      ...prev,
      permissions: [],
    }));
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      Alert.alert('Required', 'Employee name required hai.');
      return false;
    }

    if (!form.phone.trim()) {
      Alert.alert('Required', 'Phone number required hai.');
      return false;
    }

    const finalPhone = normalizePhone(form.phone);

    if (finalPhone.length < 11) {
      Alert.alert('Invalid Phone', 'Valid phone number enter karo.');
      return false;
    }

    if (!editingStaff && !form.password.trim()) {
      Alert.alert('Required', 'Password required hai.');
      return false;
    }

    if (!editingStaff && form.password.trim().length < 4) {
      Alert.alert('Weak Password', 'Password kam az kam 4 characters ka rakho.');
      return false;
    }

    if (form.permissions.length === 0) {
      Alert.alert('Required', 'Kam az kam 1 module select karo.');
      return false;
    }

    return true;
  };

  const saveStaff = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const finalPhone = normalizePhone(form.phone);

      if (editingStaff) {
        const res = await staffApi.updateStaff(editingStaff.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password.trim() || undefined,
          role: 3,
          permissions: form.permissions,
        });

        console.log('Update employee response:', res);

        setStaff(prev =>
          prev.map(item =>
            item.id === editingStaff.id
              ? {
                  ...item,
                  name: form.name.trim(),
                  email: form.email.trim(),
                  role: 3,
                  permissions: form.permissions,
                }
              : item
          )
        );

        Alert.alert(
          'Success',
          'Employee updated successfully. Agar ye employee login hai to logout/login dobara kare.'
        );
      } else {
        const res = await staffApi.createStaff({
          name: form.name.trim(),
          phone: finalPhone,
          email: form.email.trim(),
          password: form.password.trim(),
          role: 3,
          permissions: form.permissions,
        });

        console.log('Create employee response:', res);

        await loadStaff();

        Alert.alert('Success', 'Employee created successfully.');
      }

      closeModal();
    } catch (error: any) {
      console.log('Save staff error:', error.response?.data || error.message);

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Employee save nahi ho saka.';

      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const confirmAction = (
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => void
  ) => {
    if (Platform.OS === 'web') {
      const confirmed = (globalThis as any).confirm
        ? (globalThis as any).confirm(`${title}\n\n${message}`)
        : true;

      if (confirmed) {
        onConfirm();
      }

      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: confirmText,
        style: 'destructive',
        onPress: onConfirm,
      },
    ]);
  };

  const performStatusUpdate = async (item: StaffUser, newStatus: boolean) => {
    try {
      setLoading(true);

      console.log('Updating employee status:', item.id, newStatus);

      const res = await staffApi.updateStaffStatus(item.id, newStatus);

      console.log('Status update response:', res);

      setStaff(prev =>
        prev.map(x => (x.id === item.id ? { ...x, isActive: newStatus } : x))
      );

      Alert.alert(
        'Success',
        newStatus
          ? 'Employee activated successfully.'
          : 'Employee deactivated successfully.'
      );
    } catch (error: any) {
      console.log(
        'Status update error:',
        error.response?.data || error.message
      );

      Alert.alert(
        'Error',
        error.response?.data?.message || 'Status update nahi hua.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleStaffStatus = (item: StaffUser) => {
    const newStatus = !item.isActive;

    confirmAction(
      item.isActive ? 'Deactivate Employee' : 'Activate Employee',
      `${item.name} ko ${item.isActive ? 'deactivate' : 'activate'} karna hai?`,
      item.isActive ? 'Deactivate' : 'Activate',
      () => performStatusUpdate(item, newStatus)
    );
  };

  const performDeleteStaff = async (item: StaffUser) => {
    try {
      setLoading(true);

      console.log('Deleting employee id:', item.id);

      const res = await staffApi.deleteStaff(item.id);

      console.log('Delete staff response:', res);

      setStaff(prev =>
        prev.map(x => (x.id === item.id ? { ...x, isActive: false } : x))
      );

      Alert.alert('Success', 'Employee deleted/deactivated successfully.');
    } catch (error: any) {
      console.log('Delete staff error:', error.response?.data || error.message);

      Alert.alert(
        'Error',
        error.response?.data?.message || 'Employee deactivate nahi hua.'
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteStaff = (item: StaffUser) => {
    console.log('Delete button clicked:', item.id, item.name);

    confirmAction(
      'Delete Employee',
      `${item.name} ko delete/deactivate karna hai? Ye user login nahi kar sakega.`,
      'Delete',
      () => performDeleteStaff(item)
    );
  };

  const getPermissionLabel = (key: string) => {
    return MODULES.find(x => x.key === key)?.label || key;
  };

  return (
    <>
      <StatusBar style="light" />

      <View style={styles.container}>
        <LinearGradient
          colors={['#1A5F2B', '#0D3D1C']}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Employee Access</Text>
            <Text style={styles.headerSubtitle}>
              Kisi bhi employee ko koi bhi module access do
            </Text>
          </View>

          <TouchableOpacity onPress={openAddModal} style={styles.headerAddBtn}>
            <Ionicons name="add" size={24} color="#1A5F2B" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{staff.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, { color: '#22C55E' }]}>
              {activeStaff.length}
            </Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNumber, { color: '#EF4444' }]}>
              {inactiveStaff.length}
            </Text>
            <Text style={styles.summaryLabel}>Inactive</Text>
          </View>
        </View>

        <View style={styles.actionBox}>
          <TouchableOpacity style={styles.addStaffBtn} onPress={openAddModal}>
            <LinearGradient
              colors={['#F5A623', '#D48A1A']}
              style={styles.addStaffGradient}
            >
              <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
              <Text style={styles.addStaffText}>Add Employee</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshBtn} onPress={loadStaff}>
            <Ionicons name="refresh-outline" size={19} color="#1A5F2B" />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              !showInactive && styles.filterChipActive,
            ]}
            onPress={() => setShowInactive(false)}
          >
            <Text
              style={[
                styles.filterChipText,
                !showInactive && styles.filterChipTextActive,
              ]}
            >
              Active Only
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              showInactive && styles.filterChipActive,
            ]}
            onPress={() => setShowInactive(true)}
          >
            <Text
              style={[
                styles.filterChipText,
                showInactive && styles.filterChipTextActive,
              ]}
            >
              Show Inactive
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1A5F2B" />
            <Text style={styles.loadingText}>Loading employees...</Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {visibleStaff.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="people-outline" size={64} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No employee found</Text>
                <Text style={styles.emptyText}>
                  Add employee and assign module permissions.
                </Text>
              </View>
            ) : (
              visibleStaff.map(item => (
                <View
                  key={item.id}
                  style={[
                    styles.staffCard,
                    !item.isActive && styles.inactiveStaffCard,
                  ]}
                >
                  <View style={styles.staffTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {item.name?.charAt(0)?.toUpperCase() || 'E'}
                      </Text>
                    </View>

                    <View style={styles.staffInfo}>
                      <Text style={styles.staffName}>{item.name}</Text>
                      <Text style={styles.staffPhone}>{item.phone}</Text>

                      {!!item.email && (
                        <Text style={styles.staffEmail}>{item.email}</Text>
                      )}
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        item.isActive
                          ? styles.statusActive
                          : styles.statusInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          item.isActive
                            ? styles.statusTextActive
                            : styles.statusTextInactive,
                        ]}
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.roleRow}>
                    <View style={styles.roleBadge}>
                      <Ionicons name="person-outline" size={14} color="#1A5F2B" />
                      <Text style={styles.roleText}>Employee</Text>
                    </View>
                  </View>

                  <View style={styles.permissionWrap}>
                    {(item.permissions || []).map(permission => (
                      <View key={permission} style={styles.permissionChip}>
                        <Text style={styles.permissionText}>
                          {getPermissionLabel(permission)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.cardActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.editBtn,
                        pressed && { opacity: 0.6 },
                      ]}
                      onPress={() => openEditModal(item)}
                    >
                      <Ionicons name="create-outline" size={17} color="#1A5F2B" />
                      <Text style={styles.editText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.statusBtn,
                        pressed && { opacity: 0.6 },
                      ]}
                      onPress={() => toggleStaffStatus(item)}
                    >
                      <Ionicons
                        name={item.isActive ? 'pause-outline' : 'play-outline'}
                        size={17}
                        color={item.isActive ? '#F59E0B' : '#22C55E'}
                      />
                      <Text
                        style={[
                          styles.statusActionText,
                          { color: item.isActive ? '#F59E0B' : '#22C55E' },
                        ]}
                      >
                        {item.isActive ? 'Deactivate' : 'Activate'}
                      </Text>
                    </Pressable>

                    {item.isActive && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.deleteBtn,
                          pressed && { opacity: 0.6 },
                        ]}
                        onPress={() => {
                          console.log('Pressed delete UI:', item.id);
                          deleteStaff(item);
                        }}
                      >
                        <Ionicons name="trash-outline" size={17} color="#EF4444" />
                        <Text style={styles.deleteText}>Delete</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingStaff ? 'Edit Employee' : 'Add Employee'}
                </Text>

                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close-circle" size={30} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Input
                  label="Employee Name"
                  placeholder="Ali Counter"
                  value={form.name}
                  onChangeText={text => setForm({ ...form, name: text })}
                />

                <Input
                  label="Phone Number"
                  placeholder="03001234567"
                  value={form.phone}
                  keyboardType="phone-pad"
                  editable={!editingStaff}
                  onChangeText={text => setForm({ ...form, phone: text })}
                />

                <Input
                  label="Email Optional"
                  placeholder="employee@gmail.com"
                  value={form.email}
                  keyboardType="email-address"
                  onChangeText={text => setForm({ ...form, email: text })}
                />

                <Input
                  label={editingStaff ? 'New Password Optional' : 'Password'}
                  placeholder={
                    editingStaff ? 'Leave empty to keep old password' : '123456'
                  }
                  value={form.password}
                  secureTextEntry
                  onChangeText={text => setForm({ ...form, password: text })}
                />

                <Text style={styles.fieldLabel}>Quick Permission Presets</Text>

                <View style={styles.presetGrid}>
                  {QUICK_PRESETS.map(preset => (
                    <TouchableOpacity
                      key={preset.label}
                      style={styles.presetChip}
                      onPress={() => applyPreset(preset.permissions)}
                    >
                      <Text style={styles.presetChipText}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.permissionHeaderRow}>
                  <Text style={styles.fieldLabel}>Module Permissions</Text>

                  <View style={styles.permissionHeaderActions}>
                    <TouchableOpacity onPress={selectAllModules}>
                      <Text style={styles.smallActionText}>Select All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={clearAllModules}>
                      <Text style={[styles.smallActionText, { color: '#EF4444' }]}>
                        Clear
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.moduleGrid}>
                  {MODULES.map(module => {
                    const selected = form.permissions.includes(module.key);

                    return (
                      <TouchableOpacity
                        key={module.key}
                        style={[
                          styles.moduleChip,
                          selected && styles.moduleChipActive,
                        ]}
                        onPress={() => togglePermission(module.key)}
                      >
                        <Ionicons
                          name={module.icon as any}
                          size={17}
                          color={selected ? '#FFFFFF' : '#64748B'}
                        />

                        <Text
                          style={[
                            styles.moduleChipText,
                            selected && styles.moduleChipTextActive,
                          ]}
                        >
                          {module.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={saveStaff}
                  disabled={saving}
                >
                  <LinearGradient
                    colors={['#1A5F2B', '#0D3D1C']}
                    style={styles.saveGradient}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                        <Text style={styles.saveText}>
                          {editingStaff ? 'Update Employee' : 'Create Employee'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelModalBtn} onPress={closeModal}>
                  <Text style={styles.cancelModalText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

function Input({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  editable = true,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: any;
  secureTextEntry?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  header: {
    paddingTop: Platform.OS === 'ios' ? 55 : 42,
    paddingHorizontal: 18,
    paddingBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerCenter: {
    flex: 1,
    paddingHorizontal: 14,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  headerSubtitle: {
    fontSize: 12,
    color: '#D1FAE5',
    marginTop: 2,
  },

  headerAddBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: -14,
    marginBottom: 14,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },

  summaryNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A5F2B',
  },

  summaryLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '600',
  },

  actionBox: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  addStaffBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },

  addStaffGradient: {
    paddingVertical: 13,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addStaffText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  refreshBtn: {
    backgroundColor: '#E8F5E9',
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  refreshText: {
    color: '#1A5F2B',
    fontWeight: '800',
    fontSize: 13,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 14,
  },

  filterChip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
  },

  filterChipActive: {
    backgroundColor: '#1A5F2B',
    borderColor: '#1A5F2B',
  },

  filterChipText: {
    color: '#64748B',
    fontWeight: '800',
    fontSize: 12,
  },

  filterChipTextActive: {
    color: '#FFFFFF',
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: '#64748B',
  },

  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 35,
    alignItems: 'center',
    marginTop: 20,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 12,
  },

  emptyText: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },

  staffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },

  inactiveStaffCard: {
    opacity: 0.7,
    backgroundColor: '#F8FAFC',
  },

  staffTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#1A5F2B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#F5A623',
    fontSize: 22,
    fontWeight: '900',
  },

  staffInfo: {
    flex: 1,
  },

  staffName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },

  staffPhone: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  staffEmail: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusActive: {
    backgroundColor: '#DCFCE7',
  },

  statusInactive: {
    backgroundColor: '#FEE2E2',
  },

  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },

  statusTextActive: {
    color: '#16A34A',
  },

  statusTextInactive: {
    color: '#EF4444',
  },

  roleRow: {
    flexDirection: 'row',
    marginTop: 12,
  },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },

  roleText: {
    fontSize: 12,
    color: '#1A5F2B',
    fontWeight: '800',
  },

  permissionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },

  permissionChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },

  permissionText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },

  cardActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 14,
    paddingTop: 12,
  },

  editBtn: {
    flex: 1,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },

  editText: {
    color: '#1A5F2B',
    fontWeight: '800',
    fontSize: 12,
  },

  statusBtn: {
    flex: 1,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },

  statusActionText: {
    fontWeight: '800',
    fontSize: 12,
  },

  deleteBtn: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    zIndex: 10,
    elevation: 5,
  },

  deleteText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  modalBox: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '92%',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },

  inputGroup: {
    marginBottom: 13,
  },

  fieldLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '800',
    marginBottom: 7,
  },

  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#0F172A',
    fontSize: 15,
  },

  inputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8',
  },

  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },

  presetChip: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 30,
  },

  presetChipText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '800',
  },

  permissionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },

  permissionHeaderActions: {
    flexDirection: 'row',
    gap: 12,
  },

  smallActionText: {
    color: '#1A5F2B',
    fontSize: 12,
    fontWeight: '900',
  },

  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },

  moduleChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  moduleChipActive: {
    backgroundColor: '#1A5F2B',
    borderColor: '#1A5F2B',
  },

  moduleChipText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },

  moduleChipTextActive: {
    color: '#FFFFFF',
  },

  saveBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 6,
  },

  saveGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  cancelModalBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },

  cancelModalText: {
    color: '#94A3B8',
    fontWeight: '800',
  },
});