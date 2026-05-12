import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
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

export default function TablesScreen() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);

  const [tableNumber, setTableNumber] = useState<string>('');
  const [capacity, setCapacity] = useState<string>('4');

  useEffect(() => {
    loadTables();
  }, []);

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

      console.log('Tables loaded:', tableList);

      setTables(tableList);
    } catch (error: any) {
      console.error('Load tables error:', error.response?.data || error.message);

      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to load tables'
      );
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingTable(null);
    setTableNumber('');
    setCapacity('4');
    setModalVisible(true);
  };

  const openEditModal = (item: Table) => {
    setEditingTable(item);
    setTableNumber(String(item.tableNumber || ''));
    setCapacity(String(item.capacity || 4));
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingTable(null);
    setTableNumber('');
    setCapacity('4');
  };

  const handleSaveTable = async () => {
    if (!tableNumber.trim()) {
      Alert.alert('Error', 'Please enter table number');
      return;
    }

    const parsedCapacity = parseInt(capacity, 10);

    if (Number.isNaN(parsedCapacity) || parsedCapacity <= 0) {
      Alert.alert('Error', 'Please enter valid capacity');
      return;
    }

    try {
      setSaving(true);

      const tableData = {
        tableNumber: tableNumber.trim(),
        capacity: parsedCapacity,
        status: editingTable?.status ?? 0,
      };

      if (editingTable) {
        console.log('Updating table:', editingTable.id, tableData);

        const response = await api.put(
          `/restaurant/tables/${editingTable.id}`,
          tableData
        );

        console.log('Table updated:', response.data);

        Alert.alert('Success', 'Table updated successfully');
      } else {
        console.log('Adding table:', tableData);

        const response = await api.post('/restaurant/tables', tableData);

        console.log('Table added:', response.data);

        Alert.alert('Success', 'Table added successfully');
      }

      closeModal();
      await loadTables();
    } catch (error: any) {
      console.error('Save table error:', error.response?.data || error.message);

      let errorMessage = editingTable
        ? 'Failed to update table'
        : 'Failed to add table';

      if (error.response?.status === 405) {
        errorMessage = 'API not supported. Backend mein update endpoint check karo.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied. Tables permission check karo.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const performDeleteTable = async (item: Table) => {
    try {
      setDeletingId(item.id);

      console.log('Deleting table:', item.id, item.tableNumber);

      const response = await api.delete(`/restaurant/tables/${item.id}`);

      console.log('Table deleted:', response.data);

      setTables(prev => prev.filter(t => t.id !== item.id));

      Alert.alert(
        'Success',
        response.data?.message || 'Table deleted successfully'
      );

      await loadTables();
    } catch (error: any) {
      console.error('Delete table error:', error.response?.data || error.message);

      let errorMessage = 'Failed to delete table';

      if (error.response?.status === 405 || error.response?.status === 404) {
        errorMessage = 'Delete API backend mein missing hai. RestaurantController mein DELETE /tables/{id} endpoint add karo.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied. Tables permission check karo.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteTable = (item: Table) => {
    const isOccupied = item.status === 1;

    const message = isOccupied
      ? `Table ${item.tableNumber} abhi occupied hai. Delete karne se dine-in flow disturb ho sakta hai. Phir bhi delete karni hai?`
      : `Table ${item.tableNumber} delete karni hai?`;

    if (Platform.OS === 'web') {
      const confirmed = (globalThis as any).confirm
        ? (globalThis as any).confirm(message)
        : true;

      if (confirmed) {
        performDeleteTable(item);
      }

      return;
    }

    Alert.alert('Delete Table?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => performDeleteTable(item),
      },
    ]);
  };

  const openTableOrder = (item: Table) => {
    const isOccupied = item.status === 1;

    if (isOccupied) {
      Alert.alert('Table Occupied', 'This table is currently occupied');
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
            ]}
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#F5A623" />
        <Text style={styles.loadingText}>Loading tables...</Text>
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
                style={styles.input}
                placeholder="e.g., 5"
                placeholderTextColor="#94A3B8"
                value={tableNumber}
                onChangeText={setTableNumber}
                keyboardType="default"
                maxLength={10}
              />

              <Text style={styles.label}>Capacity *</Text>

              <TextInput
                style={styles.input}
                placeholder="4"
                placeholderTextColor="#94A3B8"
                value={capacity}
                onChangeText={setCapacity}
                keyboardType="numeric"
                maxLength={2}
              />

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
    marginBottom: 16,
  },

  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
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
});