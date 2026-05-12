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
  Platform,
  Pressable,
  Dimensions,
} from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Category {
  id: number;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: string;
}

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/restaurant/categories');
      const data = response.data?.data || response.data || [];
      console.log('Categories loaded:', data);
      setCategories(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Load categories error:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setSortOrder('');
    setModalVisible(true);
  };

  const openEditModal = (item: Category) => {
    setEditingCategory(item);
    setCategoryName(item.name || '');
    setSortOrder(item.sortOrder !== undefined && item.sortOrder !== null ? String(item.sortOrder) : '');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingCategory(null);
    setCategoryName('');
    setSortOrder('');
  };

  const handleSave = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Error', 'Please enter category name');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: categoryName.trim(),
        sortOrder: sortOrder ? Number(sortOrder) : 0,
      };

      if (editingCategory) {
        await api.put(`/restaurant/categories/${editingCategory.id}`, payload);
        Alert.alert('Success', 'Category updated successfully');
      } else {
        await api.post('/restaurant/categories', payload);
        Alert.alert('Success', 'Category added successfully');
      }

      closeModal();
      await loadCategories();
    } catch (error: any) {
      console.error('Save category error:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const performDeleteCategory = async (item: Category) => {
    try {
      setDeletingId(item.id);
      await api.delete(`/restaurant/categories/${item.id}`);
      Alert.alert('Success', 'Category deleted successfully');
      await loadCategories();
    } catch (error: any) {
      console.error('Delete category error:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (item: Category) => {
    const message = `${item.name} category delete karni hai? Agar is category mein products hain to ye hide/deactivate hogi.`;

    if (Platform.OS === 'web') {
      const confirmed = (globalThis as any).confirm ? (globalThis as any).confirm(message) : true;
      if (confirmed) performDeleteCategory(item);
      return;
    }

    Alert.alert('Delete Category?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => performDeleteCategory(item) },
    ]);
  };

  const CategoryCard = ({ item }: { item: Category }) => {
    const isDeleting = deletingId === item.id;

    return (
      <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.categoryCard}>
        <View style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.iconGradient}>
              <Ionicons name="grid-outline" size={24} color="#FFF" />
            </LinearGradient>
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.categoryName}>{item.name}</Text>
            <View style={styles.sortBadge}>
              <Ionicons name="swap-vertical-outline" size={12} color="#F5A623" />
              <Text style={styles.sortText}>Sort: {item.sortOrder ?? 0}</Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
              <Ionicons name="create-outline" size={18} color="#1A5F2B" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)} disabled={isDeleting}>
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="trash-outline" size={18} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    );
  };

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        {/* Premium Header */}
        <LinearGradient colors={['#0F172A', '#1A5F2B', '#0D3D1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Categories</Text>
            <TouchableOpacity onPress={openAddModal} style={styles.addHeaderBtn}>
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>Manage your menu categories</Text>
        </LinearGradient>

        {/* Stats Card */}
        <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.statsCard}>
          <View style={styles.statsContent}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{categories.length}</Text>
              <Text style={styles.statLabel}>Total Categories</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <TouchableOpacity style={styles.refreshBtn} onPress={loadCategories}>
                <Ionicons name="refresh-outline" size={20} color="#1A5F2B" />
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1A5F2B" />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        ) : (
          <FlatList
            data={categories}
            renderItem={({ item }) => <CategoryCard item={item} />}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={styles.emptyIconBg}>
                  <Ionicons name="folder-open-outline" size={60} color="#CBD5E1" />
                </LinearGradient>
                <Text style={styles.emptyText}>No categories yet</Text>
                <Text style={styles.emptySubtext}>Tap + to add your first category</Text>
              </View>
            }
          />
        )}

        {/* Premium Modal */}
        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingCategory ? 'Edit Category' : 'Create Category'}
                </Text>
                <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Category Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Burgers, Drinks, BBQ"
                placeholderTextColor="#94A3B8"
                value={categoryName}
                onChangeText={setCategoryName}
                autoFocus
              />

              <Text style={styles.inputLabel}>Sort Order</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#94A3B8"
                value={sortOrder}
                onChangeText={setSortOrder}
                keyboardType="numeric"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} disabled={saving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>{editingCategory ? 'Update' : 'Create'}</Text>
                  )}
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
    backgroundColor: '#F1F5F9',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 55 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
  },
  addHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginLeft: 4,
  },
  statsCard: {
    marginHorizontal: 16,
    marginTop: -20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A5F2B',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 25,
  },
  refreshText: {
    color: '#1A5F2B',
    fontWeight: '600',
    fontSize: 13,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  categoryCard: {
    borderRadius: 16,
    marginBottom: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    marginRight: 14,
  },
  iconGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  sortBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: 11,
    color: '#F5A623',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: width - 48,
    maxWidth: 420,
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 15,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#1A5F2B',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});