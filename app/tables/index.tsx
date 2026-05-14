import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

interface Table {
  id: number;
  tableNumber: string;
  capacity: number;
  status: number;
}

type DialogType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface AppDialogState {
  visible: boolean;
  type: DialogType;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  onConfirm?: (() => void | Promise<void>) | null;
}

interface FormErrors {
  tableNumber?: string;
  capacity?: string;
}

const emptyDialog: AppDialogState = {
  visible: false,
  type: 'info',
  title: '',
  message: '',
  confirmText: 'OK',
  cancelText: 'Cancel',
  onConfirm: null,
};

export default function TablesScreen() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);

  const [tableNumber, setTableNumber] = useState<string>('');
  const [capacity, setCapacity] = useState<string>('4');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [appDialog, setAppDialog] = useState<AppDialogState>(emptyDialog);

  useEffect(() => {
    loadTables();
  }, []);

  const showDialog = ({
    type = 'info',
    title,
    message,
    confirmText = 'OK',
    cancelText = 'Cancel',
    onConfirm = null,
  }: {
    type?: DialogType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: (() => void | Promise<void>) | null;
  }) => {
    setAppDialog({
      visible: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm,
    });
  };

  const closeDialog = () => {
    setAppDialog(emptyDialog);
  };

  const handleDialogConfirm = async () => {
    const action = appDialog.onConfirm;
    closeDialog();

    if (action) {
      await action();
    }
  };

  const getApiErrorMessage = (error: any, fallback: string) => {
    if (!error?.response) {
      if (error?.message?.toLowerCase?.().includes('network')) {
        return 'Network issue aa raha hai. Internet connection ya server availability check karein.';
      }

      return error?.message || fallback;
    }

    const status = error.response?.status;
    const serverMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.response?.data?.title ||
      '';

    if (serverMessage) return serverMessage;

    if (status === 400) {
      return 'Invalid data sent. Please check required fields and try again.';
    }

    if (status === 401) {
      return 'Session expired. Please login again.';
    }

    if (status === 403) {
      return 'Access denied. Tables permission check karein.';
    }

    if (status === 404) {
      return 'Requested table/API endpoint not found.';
    }

    if (status === 405) {
      return 'This API action is not supported by backend. Backend endpoint/method check karein.';
    }

    if (status >= 500) {
      return 'Server error aa raha hai. Backend/API logs check karein.';
    }

    return fallback;
  };

  const normalizeArray = (data: any) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const loadTables = async () => {
    try {
      setLoading(true);

      const response = await api.get('/restaurant/tables');
      const tableList = normalizeArray(response.data);

      setTables(tableList);
    } catch (error: any) {
      console.error('Load tables error:', error.response?.data || error.message);

      const message = getApiErrorMessage(error, 'Failed to load tables.');

      showDialog({
        type: 'error',
        title: 'Tables Load Failed',
        message,
        confirmText: error?.response?.status === 401 ? 'Login Again' : 'OK',
        onConfirm:
          error?.response?.status === 401
            ? () => router.replace('/(auth)/login')
            : null,
      });
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingTable(null);
    setTableNumber('');
    setCapacity('4');
    setFormErrors({});
    setModalVisible(true);
  };

  const openEditModal = (item: Table) => {
    setEditingTable(item);
    setTableNumber(String(item.tableNumber || ''));
    setCapacity(String(item.capacity || 4));
    setFormErrors({});
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalVisible(false);
    setEditingTable(null);
    setTableNumber('');
    setCapacity('4');
    setFormErrors({});
  };

  const updateTableNumber = (value: string) => {
    setTableNumber(value);

    if (formErrors.tableNumber) {
      setFormErrors(prev => ({ ...prev, tableNumber: undefined }));
    }
  };

  const updateCapacity = (value: string) => {
    setCapacity(value.replace(/[^0-9]/g, ''));

    if (formErrors.capacity) {
      setFormErrors(prev => ({ ...prev, capacity: undefined }));
    }
  };

  const validateForm = () => {
    const errors: FormErrors = {};
    const finalTableNumber = tableNumber.trim();
    const finalCapacity = capacity.trim();
    const parsedCapacity = parseInt(finalCapacity, 10);

    if (!finalTableNumber) {
      errors.tableNumber = 'Table number is required.';
    } else if (finalTableNumber.length > 10) {
      errors.tableNumber = 'Table number must be 10 characters or less.';
    }

    if (!finalCapacity) {
      errors.capacity = 'Capacity is required.';
    } else if (Number.isNaN(parsedCapacity) || parsedCapacity <= 0) {
      errors.capacity = 'Please enter a valid capacity.';
    } else if (parsedCapacity > 99) {
      errors.capacity = 'Capacity cannot be greater than 99.';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      showDialog({
        type: 'warning',
        title: 'Required Fields',
        message: 'Please correct the highlighted fields before saving.',
      });

      return false;
    }

    return true;
  };

  const handleSaveTable = async () => {
    if (!validateForm()) return;

    const parsedCapacity = parseInt(capacity.trim(), 10);

    try {
      setSaving(true);

      const tableData = {
        tableNumber: tableNumber.trim(),
        capacity: parsedCapacity,
        status: editingTable?.status ?? 0,
      };

      if (editingTable) {
        await api.put(`/restaurant/tables/${editingTable.id}`, tableData);

        showDialog({
          type: 'success',
          title: 'Table Updated',
          message: `Table ${tableData.tableNumber} updated successfully.`,
        });
      } else {
        await api.post('/restaurant/tables', tableData);

        showDialog({
          type: 'success',
          title: 'Table Added',
          message: `Table ${tableData.tableNumber} added successfully.`,
        });
      }

      closeModal();
      await loadTables();
    } catch (error: any) {
      console.error('Save table error:', error.response?.data || error.message);

      const fallback = editingTable ? 'Failed to update table.' : 'Failed to add table.';
      const message = getApiErrorMessage(error, fallback);

      showDialog({
        type: 'error',
        title: editingTable ? 'Update Failed' : 'Add Failed',
        message,
      });
    } finally {
      setSaving(false);
    }
  };

  const performDeleteTable = async (item: Table) => {
    try {
      setDeletingId(item.id);

      const response = await api.delete(`/restaurant/tables/${item.id}`);

      setTables(prev => prev.filter(t => t.id !== item.id));

      showDialog({
        type: 'success',
        title: 'Table Deleted',
        message: response.data?.message || `Table ${item.tableNumber} deleted successfully.`,
      });

      await loadTables();
    } catch (error: any) {
      console.error('Delete table error:', error.response?.data || error.message);

      let message = getApiErrorMessage(error, 'Failed to delete table.');

      if (error.response?.status === 405 || error.response?.status === 404) {
        message =
          'Delete API backend mein missing hai. RestaurantController mein DELETE /tables/{id} endpoint add karein.';
      }

      showDialog({
        type: 'error',
        title: 'Delete Failed',
        message,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteTable = (item: Table) => {
    const isOccupied = item.status === 1;

    const message = isOccupied
      ? `Table ${item.tableNumber} abhi occupied hai. Delete karne se dine-in flow disturb ho sakta hai. Phir bhi delete karni hai?`
      : `Table ${item.tableNumber} delete karni hai?`;

    showDialog({
      type: 'confirm',
      title: 'Delete Table?',
      message,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => performDeleteTable(item),
    });
  };

  const openTableOrder = (item: Table) => {
    const isOccupied = item.status === 1;

    if (isOccupied) {
      showDialog({
        type: 'warning',
        title: 'Table Occupied',
        message: 'This table is currently occupied. Please choose an available table.',
      });
      return;
    }

    router.push({
      pathname: '/orders/new',
      params: {
        tableId: item.id.toString(),
        tableNumber: item.tableNumber,
        type: 'dinein',
      },
    });
  };

  const getDialogIcon = () => {
    if (appDialog.type === 'success') return 'checkmark-circle';
    if (appDialog.type === 'error') return 'alert-circle';
    if (appDialog.type === 'warning') return 'warning';
    if (appDialog.type === 'confirm') return 'help-circle';
    return 'information-circle';
  };

  const getDialogColor = () => {
    if (appDialog.type === 'success') return '#16A34A';
    if (appDialog.type === 'error') return '#DC2626';
    if (appDialog.type === 'warning') return '#F59E0B';
    if (appDialog.type === 'confirm') return '#F59E0B';
    return '#1A5F2B';
  };

  const renderAppDialog = () => {
    const isConfirm = appDialog.type === 'confirm';
    const color = getDialogColor();

    return (
      <Modal visible={appDialog.visible} transparent animationType="fade" onRequestClose={closeDialog}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogBox}>
            <View style={[styles.dialogIconWrap, { backgroundColor: `${color}1A` }]}>
              <Ionicons name={getDialogIcon() as any} size={42} color={color} />
            </View>

            <Text style={styles.dialogTitle}>{appDialog.title}</Text>
            <Text style={styles.dialogMessage}>{appDialog.message}</Text>

            <View style={styles.dialogActions}>
              {isConfirm && (
                <TouchableOpacity style={styles.dialogCancelBtn} onPress={closeDialog}>
                  <Text style={styles.dialogCancelText}>{appDialog.cancelText || 'Cancel'}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.dialogConfirmBtn,
                  { backgroundColor: isConfirm ? '#DC2626' : color },
                ]}
                onPress={handleDialogConfirm}
              >
                <Text style={styles.dialogConfirmText}>{appDialog.confirmText || 'OK'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const TableCard = ({ item }: { item: Table }) => {
    const isOccupied = item.status === 1;
    const isDeleting = deletingId === item.id;

    return (
      <View style={[styles.tableCard, isOccupied && styles.tableCardOccupied]}>
        <Pressable onPress={() => openTableOrder(item)} style={styles.tableMainArea}>
          <LinearGradient
            colors={isOccupied ? ['#DC2626', '#B91C1C'] : ['#1A5F2B', '#0D3D1C']}
            style={styles.tableIconCircle}
          >
            <Ionicons
              name={isOccupied ? 'people' : 'restaurant'}
              size={30}
              color="#FFFFFF"
            />
          </LinearGradient>

          <Text style={styles.tableNumber}>Table {item.tableNumber}</Text>
          <Text style={styles.tableCapacity}>👥 Capacity: {item.capacity} persons</Text>

          <View
            style={[
              styles.statusBadge,
              isOccupied ? styles.badgeOccupied : styles.badgeAvailable,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isOccupied ? styles.statusTextOccupied : styles.statusTextAvailable,
              ]}
            >
              {isOccupied ? '● Occupied' : '● Available'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.cardActions}>
          <Pressable
            style={({ pressed }) => [
              styles.editTableBtn,
              pressed && { opacity: 0.6 },
              isDeleting && { opacity: 0.5 },
            ]}
            disabled={isDeleting}
            onPress={() => openEditModal(item)}
          >
            <Ionicons name="create-outline" size={17} color="#1A5F2B" />
            <Text style={styles.editTableText}>Edit</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.deleteTableBtn,
              pressed && { opacity: 0.6 },
              isDeleting && { opacity: 0.5 },
            ]}
            disabled={isDeleting}
            onPress={() => handleDeleteTable(item)}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={17} color="#FFFFFF" />
                <Text style={styles.deleteTableText}>Delete</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F5A623" />
          <Text style={styles.loadingText}>Loading tables...</Text>
          {renderAppDialog()}
        </View>
      </>
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

          <Text style={styles.headerTitle}>Tables</Text>

          <TouchableOpacity onPress={openAddModal} style={styles.addBtn}>
            <Ionicons name="add-circle" size={28} color="#F5A623" />
          </TouchableOpacity>
        </LinearGradient>

        {tables.length === 0 ? (
          <View style={styles.emptyContainer}>
            <LinearGradient colors={['#F3F4F6', '#E5E7EB']} style={styles.emptyIconCircle}>
              <Ionicons name="restaurant-outline" size={60} color="#9CA3AF" />
            </LinearGradient>

            <Text style={styles.emptyText}>No tables added yet</Text>
            <Text style={styles.emptySubtext}>Add tables to start dine-in service</Text>

            <TouchableOpacity style={styles.emptyAddButton} onPress={openAddModal}>
              <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.emptyAddGradient}>
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.emptyAddButtonText}>Add Your First Table</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={tables}
            renderItem={({ item }) => <TableCard item={item} />}
            keyExtractor={(item) => item.id.toString()}
            numColumns={isTablet ? 3 : 2}
            contentContainerStyle={styles.list}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
          />
        )}

        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingTable ? 'Edit Table' : 'Add New Table'}
                </Text>

                <TouchableOpacity onPress={closeModal} disabled={saving}>
                  <Ionicons name="close-circle" size={28} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Table Number *</Text>

              <TextInput
                style={[styles.input, formErrors.tableNumber && styles.inputError]}
                placeholder="e.g., 5"
                placeholderTextColor="#94A3B8"
                value={tableNumber}
                onChangeText={updateTableNumber}
                keyboardType="default"
                maxLength={10}
                editable={!saving}
              />

              {!!formErrors.tableNumber && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                  <Text style={styles.errorText}>{formErrors.tableNumber}</Text>
                </View>
              )}

              <Text style={styles.label}>Capacity *</Text>

              <TextInput
                style={[styles.input, formErrors.capacity && styles.inputError]}
                placeholder="4"
                placeholderTextColor="#94A3B8"
                value={capacity}
                onChangeText={updateCapacity}
                keyboardType="numeric"
                maxLength={2}
                editable={!saving}
              />

              {!!formErrors.capacity && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                  <Text style={styles.errorText}>{formErrors.capacity}</Text>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={closeModal}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSaveTable}
                  disabled={saving}
                >
                  <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.saveGradient}>
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {editingTable ? 'Update Table' : 'Add Table'}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </Modal>

        {renderAppDialog()}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },

  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 14,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },

  backBtn: {
    padding: 8,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  addBtn: {
    padding: 8,
  },

  list: {
    padding: 12,
    paddingBottom: 20,
  },

  row: {
    justifyContent: 'space-between',
    gap: 12,
  },

  tableCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  tableCardOccupied: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },

  tableMainArea: {
    alignItems: 'center',
    width: '100%',
  },

  tableIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  tableNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },

  tableCapacity: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 10,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },

  badgeAvailable: {
    backgroundColor: '#D1FAE5',
  },

  badgeOccupied: {
    backgroundColor: '#FEE2E2',
  },

  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  statusTextAvailable: {
    color: '#059669',
  },

  statusTextOccupied: {
    color: '#DC2626',
  },

  cardActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },

  editTableBtn: {
    flex: 1,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editTableText: {
    color: '#1A5F2B',
    fontSize: 12,
    fontWeight: '800',
  },

  deleteTableBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteTableText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },

  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 24,
    textAlign: 'center',
  },

  emptyAddButton: {
    borderRadius: 50,
    overflow: 'hidden',
  },

  emptyAddGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },

  emptyAddButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },

  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    marginBottom: 6,
  },

  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },

  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
  },

  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },

  cancelBtnText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },

  saveBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  saveGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 120,
    alignItems: 'center',
  },

  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },

  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  dialogBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 18,
  },

  dialogIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  dialogTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },

  dialogMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
  },

  dialogActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 20,
  },

  dialogCancelBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },

  dialogCancelText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '800',
  },

  dialogConfirmBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dialogConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
