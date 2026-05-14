import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  Pressable,
  Dimensions,
} from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

interface Product {
  id: number;
  name: string;
  nameUrdu?: string | null;
  price: number;
  categoryId: number;
  categoryName?: string;
  description?: string;
  costPrice?: number;
  isAvailable: boolean;
  image?: string | null;
  canUseUrduProductNames?: boolean;
}

interface Category {
  id: number;
  name: string;
}

interface ProductFormData {
  id: number | null;
  name: string;
  nameUrdu: string;
  price: string;
  categoryId: string;
  description: string;
  costPrice: string;
  isAvailable: boolean;
  imageBase64?: string;
  existingImage?: string | null;
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
  name?: string;
  price?: string;
  categoryId?: string;
  costPrice?: string;
  nameUrdu?: string;
}

const API_BASE_URL = 'https://billpak.runasp.net';

const emptyDialog: AppDialogState = {
  visible: false,
  type: 'info',
  title: '',
  message: '',
  confirmText: 'OK',
  cancelText: 'Cancel',
  onConfirm: null,
};

const emptyFormData: ProductFormData = {
  id: null,
  name: '',
  nameUrdu: '',
  price: '',
  categoryId: '',
  description: '',
  costPrice: '',
  isAvailable: true,
  imageBase64: undefined,
  existingImage: null,
};

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [canUseUrduProductNames, setCanUseUrduProductNames] = useState<boolean>(false);

  const [formData, setFormData] = useState<ProductFormData>(emptyFormData);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [appDialog, setAppDialog] = useState<AppDialogState>(emptyDialog);

  useEffect(() => {
    loadData();
    requestPermissions();
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
      return 'Access denied. Products permission check karein.';
    }

    if (status === 404) {
      return 'Requested product/API endpoint not found.';
    }

    if (status === 405) {
      return 'This API action is not supported by backend. Backend endpoint/method check karein.';
    }

    if (status >= 500) {
      return 'Server error aa raha hai. Backend/API logs check karein.';
    }

    return fallback;
  };

  const requestPermissions = async () => {
    try {
      const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const camera = await ImagePicker.requestCameraPermissionsAsync();

      if (media.status !== 'granted' || camera.status !== 'granted') {
        showDialog({
          type: 'warning',
          title: 'Permissions Required',
          message:
            'Please allow camera and gallery access from device settings to upload product images.',
        });
      }
    } catch (error: any) {
      console.error('Permission request error:', error?.message || error);
      showDialog({
        type: 'error',
        title: 'Permission Error',
        message: 'Camera/gallery permissions request failed. Please try again.',
      });
    }
  };

  const normalizeArray = (responseData: any) => {
    if (Array.isArray(responseData)) return responseData;
    if (Array.isArray(responseData?.data)) return responseData.data;
    return [];
  };

  const getCanUseUrduProductNames = (data: any): boolean => {
    return Boolean(
      data?.features?.canUseUrduProductNames ??
        data?.features?.CanUseUrduProductNames ??
        data?.canUseUrduProductNames ??
        data?.CanUseUrduProductNames ??
        false
    );
  };

  const normalizeProduct = (product: any): Product => ({
    ...product,
    nameUrdu: product?.nameUrdu ?? product?.NameUrdu ?? null,
    canUseUrduProductNames:
      product?.canUseUrduProductNames ?? product?.CanUseUrduProductNames ?? false,
  });

  const loadData = async () => {
    try {
      setLoading(true);

      const [productsRes, categoriesRes, profileRes] = await Promise.all([
        api.get('/restaurant/products'),
        api.get('/restaurant/categories'),
        api.get('/restaurant/profile').catch(() => null),
      ]);

      const productList = normalizeArray(productsRes.data).map(normalizeProduct);
      const categoryList = normalizeArray(categoriesRes.data);
      const productFeatureEnabled = productList.some(
        (product: Product) => product.canUseUrduProductNames
      );
      const profileFeatureEnabled = getCanUseUrduProductNames(profileRes?.data);

      setCanUseUrduProductNames(profileFeatureEnabled || productFeatureEnabled);
      setProducts(productList);
      setCategories(categoryList);
      setSelectedCategory('all');
    } catch (error: any) {
      console.error('Load error:', error.response?.data || error.message);

      const message = getApiErrorMessage(
        error,
        'Failed to load products/categories.'
      );

      showDialog({
        type: 'error',
        title: 'Products Load Failed',
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
    setImageUri(null);
    setFormErrors({});

    setFormData({
      ...emptyFormData,
      categoryId: categories.length > 0 ? categories[0].id.toString() : '',
    });

    setModalVisible(true);
  };

  const openEditModal = (item: Product) => {
    const imageUrl = getImageUrl(item.image);

    setFormErrors({});

    setFormData({
      id: item.id,
      name: item.name || '',
      nameUrdu: item.nameUrdu || '',
      price: item.price?.toString() || '',
      categoryId: item.categoryId?.toString() || '',
      description: item.description || '',
      costPrice: item.costPrice?.toString() || '',
      isAvailable: item.isAvailable,
      imageBase64: undefined,
      existingImage: item.image,
    });

    setImageUri(imageUrl);
    setModalVisible(true);
  };

  const resetForm = () => {
    if (uploading) return;

    setModalVisible(false);
    setImageUri(null);
    setFormData(emptyFormData);
    setFormErrors({});
  };

  const updateFormField = (key: keyof ProductFormData, value: string | boolean) => {
    let finalValue = value;

    if (key === 'price' || key === 'costPrice') {
      finalValue = String(value).replace(/[^0-9.]/g, '');
    }

    setFormData(prev => ({
      ...prev,
      [key]: finalValue,
    }));

    if (formErrors[key as keyof FormErrors]) {
      setFormErrors(prev => ({
        ...prev,
        [key]: undefined,
      }));
    }
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.getMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        const request = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!request.granted) {
          showDialog({
            type: 'warning',
            title: 'Gallery Permission Needed',
            message:
              'Gallery access is required to select product image. Please allow permission from device settings.',
          });
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);

        if (asset.base64) {
          setFormData(prev => ({
            ...prev,
            imageBase64: asset.base64,
          }));
        }
      }
    } catch (error: any) {
      console.error('Image pick error:', error?.message || error);

      showDialog({
        type: 'error',
        title: 'Image Selection Failed',
        message: 'Failed to pick image. Please try again.',
      });
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.getCameraPermissionsAsync();

      if (!permission.granted) {
        const request = await ImagePicker.requestCameraPermissionsAsync();

        if (!request.granted) {
          showDialog({
            type: 'warning',
            title: 'Camera Permission Needed',
            message:
              'Camera access is required to take product photo. Please allow permission from device settings.',
          });
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);

        if (asset.base64) {
          setFormData(prev => ({
            ...prev,
            imageBase64: asset.base64,
          }));
        }
      }
    } catch (error: any) {
      console.error('Camera error:', error?.message || error);

      showDialog({
        type: 'error',
        title: 'Camera Failed',
        message: 'Failed to take photo. Please try again.',
      });
    }
  };

  const validateForm = () => {
    const errors: FormErrors = {};
    const name = formData.name.trim();
    const priceValue = formData.price.trim();
    const categoryIdValue = formData.categoryId.trim();
    const costPriceValue = formData.costPrice.trim();

    const parsedPrice = parseFloat(priceValue);
    const parsedCategoryId = parseInt(categoryIdValue, 10);
    const parsedCostPrice = costPriceValue ? parseFloat(costPriceValue) : 0;

    if (!name) {
      errors.name = 'Product name is required.';
    } else if (name.length < 2) {
      errors.name = 'Product name must be at least 2 characters.';
    } else if (name.length > 80) {
      errors.name = 'Product name must be 80 characters or less.';
    }

    if (!categoryIdValue) {
      errors.categoryId = 'Category is required.';
    } else if (Number.isNaN(parsedCategoryId) || parsedCategoryId <= 0) {
      errors.categoryId = 'Please select a valid category.';
    }

    if (!priceValue) {
      errors.price = 'Selling price is required.';
    } else if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      errors.price = 'Please enter a valid selling price.';
    } else if (parsedPrice > 999999) {
      errors.price = 'Selling price is too high.';
    }

    if (costPriceValue) {
      if (Number.isNaN(parsedCostPrice) || parsedCostPrice < 0) {
        errors.costPrice = 'Please enter a valid cost price.';
      } else if (parsedCostPrice > 999999) {
        errors.costPrice = 'Cost price is too high.';
      }
    }

    if (canUseUrduProductNames && formData.nameUrdu.trim().length > 80) {
      errors.nameUrdu = 'Urdu product name must be 80 characters or less.';
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

    const price = parseFloat(formData.price);
    const categoryId = parseInt(formData.categoryId, 10);
    const costPrice = formData.costPrice ? parseFloat(formData.costPrice) : 0;

    try {
      setUploading(true);

      const productData: any = {
        name: formData.name.trim(),
        price,
        categoryId,
        description: formData.description.trim(),
        costPrice: isNaN(costPrice) ? 0 : costPrice,
        isAvailable: formData.isAvailable,
      };

      if (canUseUrduProductNames) {
        productData.nameUrdu = formData.nameUrdu.trim();
      }

      if (formData.imageBase64) {
        productData.imageBase64 = formData.imageBase64;
      }

      if (formData.id) {
        await api.put(`/restaurant/products/${formData.id}`, productData);

        showDialog({
          type: 'success',
          title: 'Product Updated',
          message: `${productData.name} updated successfully.`,
        });
      } else {
        await api.post('/restaurant/products', productData);

        showDialog({
          type: 'success',
          title: 'Product Added',
          message: `${productData.name} added successfully.`,
        });
      }

      resetForm();
      await loadData();
    } catch (error: any) {
      console.error('Save error:', error.response?.data || error.message);

      const message = getApiErrorMessage(error, 'Failed to save product.');

      showDialog({
        type: 'error',
        title: formData.id ? 'Update Failed' : 'Save Failed',
        message,
      });
    } finally {
      setUploading(false);
    }
  };

  const performDeleteProduct = async (item: Product) => {
    try {
      setDeletingId(item.id);

      const res = await api.delete(`/restaurant/products/${item.id}`);

      setProducts(prev => prev.filter(product => product.id !== item.id));

      showDialog({
        type: 'success',
        title: 'Product Deleted',
        message: res.data?.message || `${item.name} deleted successfully.`,
      });

      await loadData();
    } catch (error: any) {
      console.error('Delete product error:', error.response?.data || error.message);

      const message = getApiErrorMessage(error, 'Failed to delete product.');

      showDialog({
        type: 'error',
        title: 'Delete Failed',
        message,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (item: Product) => {
    const message = `${item.name} delete karna hai? Agar ye product previous orders mein use hua hai to backend isko hide/deactivate karega, hard delete nahi karega.`;

    showDialog({
      type: 'confirm',
      title: 'Delete Product?',
      message,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => performDeleteProduct(item),
    });
  };

  const toggleAvailability = async (item: Product) => {
    try {
      setUpdatingStatusId(item.id);

      const productData: any = {
        name: item.name,
        price: Number(item.price || 0),
        categoryId: Number(item.categoryId),
        description: item.description || '',
        costPrice: Number(item.costPrice || 0),
        isAvailable: !item.isAvailable,
      };

      if (canUseUrduProductNames) {
        productData.nameUrdu = item.nameUrdu || '';
      }

      await api.put(`/restaurant/products/${item.id}`, productData);

      setProducts(prev =>
        prev.map(product =>
          product.id === item.id
            ? { ...product, isAvailable: !item.isAvailable }
            : product
        )
      );

      showDialog({
        type: 'success',
        title: 'Status Updated',
        message: `${item.name} is now ${!item.isAvailable ? 'In Stock' : 'Out of Stock'}.`,
      });
    } catch (error: any) {
      console.error('Availability update error:', error.response?.data || error.message);

      const message = getApiErrorMessage(error, 'Failed to update product status.');

      showDialog({
        type: 'error',
        title: 'Status Update Failed',
        message,
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const getCategoryName = (categoryId: number): string => {
    const category = categories.find(c => Number(c.id) === Number(categoryId));
    return category?.name || 'Unknown';
  };

  const getImageUrl = (imagePath?: string | null): string | null => {
    if (!imagePath) return null;

    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      if (imagePath.includes('localhost')) {
        return imagePath.replace('https://localhost:7246', API_BASE_URL);
      }

      return imagePath;
    }

    if (imagePath.startsWith('/')) {
      return `${API_BASE_URL}${imagePath}`;
    }

    return `${API_BASE_URL}/uploads/${imagePath}`;
  };

  const filteredProducts = products
    .filter(p => selectedCategory === 'all' || Number(p.categoryId) === Number(selectedCategory))
    .filter(p =>
      `${p.name} ${p.nameUrdu || ''}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );

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

  const renderInlineError = (message?: string) => {
    if (!message) return null;

    return (
      <View style={styles.errorRow}>
        <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
        <Text style={styles.errorText}>{message}</Text>
      </View>
    );
  };

  const ProductCard = ({ item }: { item: Product }) => {
    const imageUrl = getImageUrl(item.image);
    const isDeleting = deletingId === item.id;
    const isUpdatingStatus = updatingStatusId === item.id;

    return (
      <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.productCard}>
        <Pressable style={styles.cardContent} onPress={() => openEditModal(item)}>
          <View style={styles.imageSection}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="fast-food-outline" size={28} color="#CBD5E1" />
              </View>
            )}

            {!item.isAvailable && (
              <View style={styles.outOfStockBadge}>
                <Text style={styles.outOfStockText}>Out</Text>
              </View>
            )}
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>

            {canUseUrduProductNames && !!item.nameUrdu && (
              <Text style={styles.productUrduName} numberOfLines={1}>{item.nameUrdu}</Text>
            )}

            <View style={styles.categoryChip}>
              <Ionicons name="folder-outline" size={10} color="#1A5F2B" />
              <Text style={styles.categoryChipText}>
                {item.categoryName || getCategoryName(item.categoryId)}
              </Text>
            </View>

            <Text style={styles.productPrice}>₨ {Number(item.price || 0).toFixed(0)}</Text>
          </View>

          <View style={styles.actionSection}>
            <Pressable
              style={[
                styles.statusBtn,
                item.isAvailable ? styles.statusAvailable : styles.statusUnavailable,
                isUpdatingStatus && { opacity: 0.6 },
              ]}
              onPress={() => toggleAvailability(item)}
              disabled={isUpdatingStatus || isDeleting}
            >
              {isUpdatingStatus ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.statusBtnText}>
                  {item.isAvailable ? 'In Stock' : 'Out'}
                </Text>
              )}
            </Pressable>

            <View style={styles.iconRow}>
              <Pressable
                style={[styles.editBtn, (isDeleting || isUpdatingStatus) && { opacity: 0.5 }]}
                onPress={() => openEditModal(item)}
                disabled={isDeleting || isUpdatingStatus}
              >
                <Ionicons name="create-outline" size={16} color="#1A5F2B" />
              </Pressable>

              <Pressable
                style={[styles.deleteBtn, isDeleting && { opacity: 0.6 }]}
                onPress={() => handleDelete(item)}
                disabled={isDeleting || isUpdatingStatus}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="trash-outline" size={16} color="#FFF" />
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </LinearGradient>
    );
  };

  const CategoryFilter = ({ id, name }: { id: string; name: string }) => (
    <TouchableOpacity
      style={[styles.filterChip, selectedCategory === id && styles.filterChipActive]}
      onPress={() => setSelectedCategory(id)}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterText, selectedCategory === id && styles.filterTextActive]}>
        {name}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1A5F2B" />
          <Text style={styles.loadingText}>Loading products...</Text>
          {renderAppDialog()}
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />

      <View style={styles.container}>
        <LinearGradient colors={['#0F172A', '#1A5F2B', '#0D3D1C']} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Products</Text>

            <TouchableOpacity onPress={openAddModal} style={styles.addBtn}>
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.headerSubtitle}>Manage your menu items</Text>
        </LinearGradient>

        <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{products.length}</Text>
              <Text style={styles.statLabel}>Total Items</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#22C55E' }]}>
                {products.filter(p => p.isAvailable).length}
              </Text>
              <Text style={styles.statLabel}>In Stock</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#F5A623' }]}>
                {categories.length}
              </Text>
              <Text style={styles.statLabel}>Categories</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.searchCard}>
          <Ionicons name="search-outline" size={20} color="#94A3B8" />

          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <TouchableOpacity onPress={loadData}>
            <Ionicons name="refresh-outline" size={20} color="#1A5F2B" />
          </TouchableOpacity>
        </View>

        <View style={styles.categoriesWrapper}>
          {categories.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesContainer}
            >
              <CategoryFilter id="all" name="All" />

              {categories.map(cat => (
                <CategoryFilter key={cat.id} id={cat.id.toString()} name={cat.name} />
              ))}
            </ScrollView>
          ) : (
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.noCategoriesCard}>
              <Ionicons name="folder-open-outline" size={40} color="#F5A623" />
              <Text style={styles.noCategoriesText}>No categories found</Text>

              <TouchableOpacity
                style={styles.addCategoryBtn}
                onPress={() => router.push('/menu/categories')}
              >
                <Text style={styles.addCategoryBtnText}>Add Category</Text>
              </TouchableOpacity>
            </LinearGradient>
          )}
        </View>

        <FlatList
          data={filteredProducts}
          renderItem={({ item }) => <ProductCard item={item} />}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="fast-food-outline" size={60} color="#CBD5E1" />
              <Text style={styles.emptyText}>No products found</Text>
              <Text style={styles.emptySubtext}>Tap + to add your first product</Text>
            </View>
          }
        />

        <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={resetForm}>
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {formData.id ? 'Edit Product' : 'Add New Product'}
                </Text>

                <TouchableOpacity onPress={resetForm} disabled={uploading}>
                  <Ionicons name="close-circle" size={30} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {categories.length > 0 ? (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text style={styles.label}>Product Image</Text>

                  <TouchableOpacity
                    style={styles.imagePickerContainer}
                    onPress={pickImage}
                    disabled={uploading}
                  >
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={styles.selectedImage} />
                    ) : (
                      <View style={styles.imagePickerPlaceholder}>
                        <Ionicons name="cloud-upload-outline" size={40} color="#1A5F2B" />
                        <Text style={styles.imagePickerText}>Tap to select image</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.imageActions}>
                    <TouchableOpacity style={styles.imageActionBtn} onPress={takePhoto} disabled={uploading}>
                      <Ionicons name="camera-outline" size={20} color="#1A5F2B" />
                      <Text style={styles.imageActionText}>Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.imageActionBtn} onPress={pickImage} disabled={uploading}>
                      <Ionicons name="images-outline" size={20} color="#1A5F2B" />
                      <Text style={styles.imageActionText}>Gallery</Text>
                    </TouchableOpacity>

                    {imageUri && (
                      <TouchableOpacity
                        style={[styles.imageActionBtn, styles.removeImageBtn]}
                        disabled={uploading}
                        onPress={() => {
                          setImageUri(null);
                          setFormData(prev => ({
                            ...prev,
                            imageBase64: undefined,
                            existingImage: null,
                          }));
                        }}
                      >
                        <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                        <Text style={[styles.imageActionText, { color: '#EF4444' }]}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.label}>Category *</Text>

                  <View
                    style={[
                      styles.categorySelect,
                      formErrors.categoryId && styles.categorySelectError,
                    ]}
                  >
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryOption,
                          formData.categoryId === cat.id.toString() && styles.categoryOptionActive,
                        ]}
                        disabled={uploading}
                        onPress={() => updateFormField('categoryId', cat.id.toString())}
                      >
                        <Text
                          style={[
                            styles.categoryOptionText,
                            formData.categoryId === cat.id.toString() && styles.categoryOptionTextActive,
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {renderInlineError(formErrors.categoryId)}

                  <Text style={styles.label}>Product Name *</Text>

                  <TextInput
                    style={[styles.input, formErrors.name && styles.inputError]}
                    placeholder="e.g., Zinger Burger"
                    placeholderTextColor="#94A3B8"
                    value={formData.name}
                    onChangeText={(text) => updateFormField('name', text)}
                    editable={!uploading}
                    maxLength={80}
                  />

                  {renderInlineError(formErrors.name)}

                  {canUseUrduProductNames && (
                    <>
                      <Text style={styles.label}>Urdu Product Name - Premium</Text>

                      <TextInput
                        style={[
                          styles.input,
                          styles.urduInput,
                          formErrors.nameUrdu && styles.inputError,
                        ]}
                        placeholder="مثال: زنجر برگر"
                        placeholderTextColor="#94A3B8"
                        value={formData.nameUrdu}
                        onChangeText={(text) => updateFormField('nameUrdu', text)}
                        editable={!uploading}
                        maxLength={80}
                      />

                      {renderInlineError(formErrors.nameUrdu)}
                    </>
                  )}

                  <Text style={styles.label}>Selling Price (₨) *</Text>

                  <TextInput
                    style={[styles.input, formErrors.price && styles.inputError]}
                    placeholder="350"
                    placeholderTextColor="#94A3B8"
                    value={formData.price}
                    onChangeText={(text) => updateFormField('price', text)}
                    keyboardType="numeric"
                    editable={!uploading}
                  />

                  {renderInlineError(formErrors.price)}

                  <Text style={styles.label}>Cost Price (₨) - Optional</Text>

                  <TextInput
                    style={[styles.input, formErrors.costPrice && styles.inputError]}
                    placeholder="250"
                    placeholderTextColor="#94A3B8"
                    value={formData.costPrice}
                    onChangeText={(text) => updateFormField('costPrice', text)}
                    keyboardType="numeric"
                    editable={!uploading}
                  />

                  {renderInlineError(formErrors.costPrice)}

                  <Text style={styles.label}>Description - Optional</Text>

                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Product description..."
                    placeholderTextColor="#94A3B8"
                    value={formData.description}
                    onChangeText={(text) => updateFormField('description', text)}
                    multiline
                    numberOfLines={3}
                    editable={!uploading}
                  />
                </ScrollView>
              ) : (
                <View style={styles.noCategoriesModal}>
                  <Text style={styles.noCategoriesModalText}>
                    Please add categories first before adding products.
                  </Text>

                  <TouchableOpacity
                    style={styles.goToCategoriesBtn}
                    onPress={() => {
                      setModalVisible(false);
                      router.push('/menu/categories');
                    }}
                  >
                    <Text style={styles.goToCategoriesBtnText}>Go to Categories</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={resetForm} disabled={uploading}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                {categories.length > 0 && (
                  <TouchableOpacity
                    style={[styles.saveBtn, uploading && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        {formData.id ? 'Update' : 'Save'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
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
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  loadingText: { marginTop: 12, color: '#64748B' },

  header: { paddingTop: Platform.OS === 'ios' ? 55 : 40, paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5A623', alignItems: 'center', justifyContent: 'center' },
  headerSubtitle: { fontSize: 13, color: '#94A3B8' },

  statsCard: { marginHorizontal: 16, marginTop: -20, marginBottom: 16, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statBox: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: '800', color: '#1A5F2B' },
  statLabel: { fontSize: 12, color: '#64748B', marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: '#E2E8F0' },

  searchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A' },

  categoriesWrapper: { marginBottom: 16 },
  categoriesContainer: { paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 30,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: '#1A5F2B', borderColor: '#1A5F2B' },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  filterTextActive: { color: '#FFFFFF' },

  list: { paddingHorizontal: 16, paddingBottom: 30 },

  productCard: { borderRadius: 16, marginBottom: 12, padding: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 3 },
  cardContent: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  imageSection: { position: 'relative', marginRight: 12 },
  productImage: { width: 60, height: 60, borderRadius: 14, backgroundColor: '#F1F5F9' },
  imagePlaceholder: { width: 60, height: 60, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  outOfStockBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  outOfStockText: { fontSize: 8, fontWeight: '700', color: '#FFF' },
  infoSection: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  productUrduName: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4, textAlign: 'left', writingDirection: 'rtl' },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  categoryChipText: { fontSize: 11, color: '#1A5F2B', fontWeight: '500' },
  productPrice: { fontSize: 18, fontWeight: '800', color: '#F5A623' },
  actionSection: { alignItems: 'flex-end', gap: 8 },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, minWidth: 70, alignItems: 'center' },
  statusAvailable: { backgroundColor: '#22C55E' },
  statusUnavailable: { backgroundColor: '#EF4444' },
  statusBtnText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  iconRow: { flexDirection: 'row', gap: 8 },
  editBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#64748B', marginTop: 12, marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#94A3B8' },

  noCategoriesCard: { marginHorizontal: 16, padding: 20, borderRadius: 16, alignItems: 'center' },
  noCategoriesText: { fontSize: 14, color: '#64748B', marginTop: 8, marginBottom: 12 },
  addCategoryBtn: { backgroundColor: '#1A5F2B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 },
  addCategoryBtnText: { color: '#FFF', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '90%', maxWidth: 450, maxHeight: '85%', borderRadius: 28, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A', marginBottom: 6 },
  inputError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  urduInput: { textAlign: 'right', writingDirection: 'rtl' },
  textArea: { height: 80, textAlignVertical: 'top' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  errorText: { color: '#DC2626', fontSize: 12, fontWeight: '700', flex: 1 },

  categorySelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6, borderWidth: 1, borderColor: 'transparent', borderRadius: 14, padding: 2 },
  categorySelectError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  categoryOption: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F1F5F9', borderRadius: 25 },
  categoryOptionActive: { backgroundColor: '#1A5F2B' },
  categoryOptionText: { color: '#64748B', fontWeight: '600' },
  categoryOptionTextActive: { color: '#FFF' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: { padding: 10 },
  cancelBtnText: { color: '#64748B', fontWeight: '600' },
  saveBtn: { backgroundColor: '#1A5F2B', padding: 10, borderRadius: 14, minWidth: 90, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#FFF', fontWeight: '700' },

  imagePickerContainer: { width: '100%', height: 150, borderWidth: 2, borderColor: '#1A5F2B', borderStyle: 'dashed', borderRadius: 16, marginBottom: 10, overflow: 'hidden', backgroundColor: '#F8FAFC' },
  imagePickerPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  imagePickerText: { color: '#1A5F2B', marginTop: 10, fontSize: 14, fontWeight: '500' },
  selectedImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageActions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  imageActionBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#F1F5F9', borderRadius: 12, gap: 5 },
  removeImageBtn: { backgroundColor: '#FEF2F2' },
  imageActionText: { color: '#1A5F2B', fontSize: 12, fontWeight: '500' },

  noCategoriesModal: { alignItems: 'center', paddingVertical: 20 },
  noCategoriesModalText: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 20 },
  goToCategoriesBtn: { backgroundColor: '#1A5F2B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 },
  goToCategoriesBtnText: { color: '#FFF', fontWeight: '600' },

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
