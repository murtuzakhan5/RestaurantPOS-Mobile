import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
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
  categoryName?: string;
  sortOrder?: string;
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

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [appDialog, setAppDialog] = useState<AppDialogState>(emptyDialog);

  useEffect(() => {
    loadCategories();
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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/dashboard');
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
      return 'Access denied. Categories permission check karein.';
    }

    if (status === 404) {
      return 'Requested category/API endpoint not found.';
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

  const loadCategories = async () => {
    try {
      setLoading(true);

      const response = await api.get('/restaurant/categories');
      const data = normalizeArray(response.data);

      setCategories(data);
    } catch (error: any) {
      console.error('Load categories error:', error.response?.data || error.message);

      const message = getApiErrorMessage(error, 'Failed to load categories.');

      showDialog({
        type: 'error',
        title: 'Categories Load Failed',
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
    setEditingCategory(null);
    setCategoryName('');
    setSortOrder('');
    setFormErrors({});
    setModalVisible(true);
  };

  const openEditModal = (item: Category) => {
    setEditingCategory(item);
    setCategoryName(item.name || '');
    setSortOrder(
      item.sortOrder !== undefined && item.sortOrder !== null
        ? String(item.sortOrder)
        : ''
    );
    setFormErrors({});
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalVisible(false);
    setEditingCategory(null);
    setCategoryName('');
    setSortOrder('');
    setFormErrors({});
  };

  const updateCategoryName = (value: string) => {
    setCategoryName(value);

    if (formErrors.categoryName) {
      setFormErrors(prev => ({ ...prev, categoryName: undefined }));
    }
  };

  const updateSortOrder = (value: string) => {
    const numericOnly = value.replace(/[^0-9]/g, '');
    setSortOrder(numericOnly);

    if (formErrors.sortOrder) {
      setFormErrors(prev => ({ ...prev, sortOrder: undefined }));
    }
  };

  const validateForm = () => {
    const errors: FormErrors = {};
    const finalName = categoryName.trim();
    const finalSortOrder = sortOrder.trim();

    if (!finalName) {
      errors.categoryName = 'Category name is required.';
    } else if (finalName.length < 2) {
      errors.categoryName = 'Category name must be at least 2 characters.';
    } else if (finalName.length > 50) {
      errors.categoryName = 'Category name must be 50 characters or less.';
    }

    if (finalSortOrder) {
      const parsedSortOrder = Number(finalSortOrder);

      if (Number.isNaN(parsedSortOrder) || parsedSortOrder < 0) {
        errors.sortOrder = 'Sort order must be a valid positive number.';
      } else if (parsedSortOrder > 999) {
        errors.sortOrder = 'Sort order cannot be greater than 999.';
      }
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

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = {
        name: categoryName.trim(),
        sortOrder: sortOrder.trim() ? Number(sortOrder.trim()) : 0,
      };

      if (editingCategory) {
        await api.put(`/restaurant/categories/${editingCategory.id}`, payload);

        showDialog({
          type: 'success',
          title: 'Category Updated',
          message: `${payload.name} updated successfully.`,
        });
      } else {
        await api.post('/restaurant/categories', payload);

        showDialog({
          type: 'success',
          title: 'Category Created',
          message: `${payload.name} created successfully.`,
        });
      }

      closeModal();
      await loadCategories();
    } catch (error: any) {
      console.error('Save category error:', error.response?.data || error.message);

      const message = getApiErrorMessage(error, 'Failed to save category.');

      showDialog({
        type: 'error',
        title: editingCategory ? 'Update Failed' : 'Create Failed',
        message,
      });
    } finally {
      setSaving(false);
    }
  };

  const performDeleteCategory = async (item: Category) => {
    try {
      setDeletingId(item.id);

      await api.delete(`/restaurant/categories/${item.id}`);

      showDialog({
        type: 'success',
        title: 'Category Deleted',
        message: `${item.name} deleted successfully.`,
      });

      await loadCategories();
    } catch (error: any) {
      console.error('Delete category error:', error.response?.data || error.message);

      const message = getApiErrorMessage(error, 'Failed to delete category.');

      showDialog({
        type: 'error',
        title: 'Delete Failed',
        message,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (item: Category) => {
    const message = `${item.name} category delete karni hai? Agar is category mein products hain to ye hide/deactivate ho sakti hai.`;

    showDialog({
      type: 'confirm',
      title: 'Delete Category?',
      message,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => performDeleteCategory(item),
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
            <TouchableOpacity
              style={[styles.editBtn, isDeleting && { opacity: 0.5 }]}
              onPress={() => openEditModal(item)}
              disabled={isDeleting}
            >
              <Ionicons name="create-outline" size={18} color="#1A5F2B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteBtn, isDeleting && { opacity: 0.6 }]}
              onPress={() => handleDelete(item)}
              disabled={isDeleting}
            >
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
        <LinearGradient
          colors={['#0F172A', '#1A5F2B', '#0D3D1C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Categories</Text>

            <TouchableOpacity onPress={openAddModal} style={styles.addHeaderBtn}>
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.headerSubtitle}>Manage your menu categories</Text>
        </LinearGradient>

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

                <TouchableOpacity style={styles.emptyCreateBtn} onPress={openAddModal}>
                  <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.emptyCreateGradient}>
                    <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.emptyCreateText}>Create Category</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            }
          />
        )}

        <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingCategory ? 'Edit Category' : 'Create Category'}
                </Text>

                <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn} disabled={saving}>
                  <Ionicons name="close" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Category Name *</Text>

              <TextInput
                style={[styles.input, formErrors.categoryName && styles.inputError]}
                placeholder="e.g., Burgers, Drinks, BBQ"
                placeholderTextColor="#94A3B8"
                value={categoryName}
                onChangeText={updateCategoryName}
                autoFocus
                editable={!saving}
                maxLength={50}
              />

              {!!formErrors.categoryName && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                  <Text style={styles.errorText}>{formErrors.categoryName}</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>Sort Order</Text>

              <TextInput
                style={[styles.input, formErrors.sortOrder && styles.inputError]}
                placeholder="0"
                placeholderTextColor="#94A3B8"
                value={sortOrder}
                onChangeText={updateSortOrder}
                keyboardType="numeric"
                editable={!saving}
                maxLength={3}
              />

              {!!formErrors.sortOrder && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                  <Text style={styles.errorText}>{formErrors.sortOrder}</Text>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} disabled={saving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
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

        {renderAppDialog()}
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
    paddingHorizontal: 20,
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
    textAlign: 'center',
  },

  emptyCreateBtn: {
    marginTop: 18,
    borderRadius: 28,
    overflow: 'hidden',
  },

  emptyCreateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 7,
  },

  emptyCreateText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
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
    gap: 12,
    marginTop: 12,
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
