import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
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

const API_BASE_URL = 'https://billpak.runasp.net';

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

  const [formData, setFormData] = useState<ProductFormData>({
    id: null,
    name: '',
    nameUrdu: '',
    price: '',
    categoryId: '',
    description: '',
    costPrice: '',
    isAvailable: true,
    existingImage: null,
  });

  useEffect(() => {
    loadData();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const camera = await ImagePicker.requestCameraPermissionsAsync();

    if (media.status !== 'granted' || camera.status !== 'granted') {
      Alert.alert('Permissions Required', 'Please allow camera and gallery access.');
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
      const productFeatureEnabled = productList.some((product: Product) => product.canUseUrduProductNames);
      const profileFeatureEnabled = getCanUseUrduProductNames(profileRes?.data);

      setCanUseUrduProductNames(profileFeatureEnabled || productFeatureEnabled);
      setProducts(productList);
      setCategories(categoryList);
      setSelectedCategory('all');

      console.log('Products loaded:', productList.length);
      console.log('Categories loaded:', categoryList.length);
    } catch (error: any) {
      console.error('Load error:', error.response?.data || error.message);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to load products/categories'
      );
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setImageUri(null);

    setFormData({
      id: null,
      name: '',
      nameUrdu: '',
      price: '',
      categoryId: categories.length > 0 ? categories[0].id.toString() : '',
      description: '',
      costPrice: '',
      isAvailable: true,
      imageBase64: undefined,
      existingImage: null,
    });

    setModalVisible(true);
  };

  const openEditModal = (item: Product) => {
    const imageUrl = getImageUrl(item.image);

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
    setModalVisible(false);
    setImageUri(null);

    setFormData({
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
    });
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);

        if (asset.base64) {
          setFormData(prev => ({
            ...prev,
            imageBase64: asset.base64,
          }));
        }
      }
    } catch (error) {
      console.error('Image pick error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);

        if (asset.base64) {
          setFormData(prev => ({
            ...prev,
            imageBase64: asset.base64,
          }));
        }
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.price.trim() || !formData.categoryId) {
      Alert.alert('Error', 'Please fill product name, price and category');
      return;
    }

    const price = parseFloat(formData.price);
    const categoryId = parseInt(formData.categoryId, 10);
    const costPrice = formData.costPrice ? parseFloat(formData.costPrice) : 0;

    if (isNaN(price) || price <= 0) {
      Alert.alert('Error', 'Please enter valid selling price');
      return;
    }

    if (isNaN(categoryId) || categoryId <= 0) {
      Alert.alert('Error', 'Please select valid category');
      return;
    }

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
        const res = await api.put(`/restaurant/products/${formData.id}`, productData);
        console.log('Product update response:', res.data);
        Alert.alert('Success', 'Product updated successfully');
      } else {
        const res = await api.post('/restaurant/products', productData);
        console.log('Product create response:', res.data);
        Alert.alert('Success', 'Product added successfully');
      }

      resetForm();
      await loadData();
    } catch (error: any) {
      console.error('Save error:', error.response?.data || error.message);

      Alert.alert(
        'Error',
        'Failed to save product: ' + (error.response?.data?.message || error.message)
      );
    } finally {
      setUploading(false);
    }
  };

  const performDeleteProduct = async (item: Product) => {
    try {
      setDeletingId(item.id);

      console.log('Deleting product:', item.id, item.name);

      const res = await api.delete(`/restaurant/products/${item.id}`);

      console.log('Product delete response:', res.data);

      setProducts(prev => prev.filter(product => product.id !== item.id));

      Alert.alert(
        'Success',
        res.data?.message || 'Product deleted successfully'
      );

      await loadData();
    } catch (error: any) {
      console.error('Delete product error:', error.response?.data || error.message);

      Alert.alert(
        'Error',
        'Failed to delete: ' + (error.response?.data?.message || error.message)
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (item: Product) => {
    const message = `${item.name} delete karna hai? Agar ye product previous orders mein use hua hai to backend isko hide/deactivate karega, hard delete nahi karega.`;

    if (Platform.OS === 'web') {
      const confirmed = (globalThis as any).confirm
        ? (globalThis as any).confirm(message)
        : true;

      if (confirmed) {
        performDeleteProduct(item);
      }

      return;
    }

    Alert.alert('Delete Product?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => performDeleteProduct(item),
      },
    ]);
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

      const res = await api.put(`/restaurant/products/${item.id}`, productData);

      console.log('Availability update response:', res.data);

      setProducts(prev =>
        prev.map(product =>
          product.id === item.id
            ? { ...product, isAvailable: !item.isAvailable }
            : product
        )
      );
    } catch (error: any) {
      console.error('Availability update error:', error.response?.data || error.message);

      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to update status'
      );
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
              <Text style={styles.categoryChipText}>{item.categoryName || getCategoryName(item.categoryId)}</Text>
            </View>
            <Text style={styles.productPrice}>₨ {Number(item.price || 0).toFixed(0)}</Text>
          </View>

          <View style={styles.actionSection}>
            <Pressable
              style={[styles.statusBtn, item.isAvailable ? styles.statusAvailable : styles.statusUnavailable]}
              onPress={() => toggleAvailability(item)}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.statusBtnText}>{item.isAvailable ? 'In Stock' : 'Out'}</Text>
              )}
            </Pressable>

            <View style={styles.iconRow}>
              <Pressable style={styles.editBtn} onPress={() => openEditModal(item)}>
                <Ionicons name="create-outline" size={16} color="#1A5F2B" />
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)} disabled={isDeleting}>
                {isDeleting ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="trash-outline" size={16} color="#FFF" />}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </LinearGradient>
    );
  };

  // FIXED CATEGORY FILTER - Proper centering
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1A5F2B" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        {/* Premium Header */}
        <LinearGradient colors={['#0F172A', '#1A5F2B', '#0D3D1C']} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Products</Text>
            <TouchableOpacity onPress={openAddModal} style={styles.addBtn}>
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>Manage your menu items</Text>
        </LinearGradient>

        {/* Stats Cards */}
        <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{products.length}</Text>
              <Text style={styles.statLabel}>Total Items</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#22C55E' }]}>{products.filter(p => p.isAvailable).length}</Text>
              <Text style={styles.statLabel}>In Stock</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#F5A623' }]}>{categories.length}</Text>
              <Text style={styles.statLabel}>Categories</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Search Bar */}
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

        {/* Categories - FIXED BUTTONS */}
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
              <TouchableOpacity style={styles.addCategoryBtn} onPress={() => router.push('/menu/categories')}>
                <Text style={styles.addCategoryBtnText}>Add Category</Text>
              </TouchableOpacity>
            </LinearGradient>
          )}
        </View>

        {/* Products List */}
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

        {/* Modal */}
        <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={resetForm}>
          <View style={styles.modalOverlay}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {formData.id ? 'Edit Product' : 'Add New Product'}
                </Text>
                <TouchableOpacity onPress={resetForm}>
                  <Ionicons name="close-circle" size={30} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {categories.length > 0 ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.label}>Product Image</Text>
                  <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
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
                    <TouchableOpacity style={styles.imageActionBtn} onPress={takePhoto}>
                      <Ionicons name="camera-outline" size={20} color="#1A5F2B" />
                      <Text style={styles.imageActionText}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageActionBtn} onPress={pickImage}>
                      <Ionicons name="images-outline" size={20} color="#1A5F2B" />
                      <Text style={styles.imageActionText}>Gallery</Text>
                    </TouchableOpacity>
                    {imageUri && (
                      <TouchableOpacity
                        style={[styles.imageActionBtn, styles.removeImageBtn]}
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
                  <View style={styles.categorySelect}>
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryOption,
                          formData.categoryId === cat.id.toString() && styles.categoryOptionActive,
                        ]}
                        onPress={() =>
                          setFormData(prev => ({ ...prev, categoryId: cat.id.toString() }))
                        }
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

                  <Text style={styles.label}>Product Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Zinger Burger"
                    placeholderTextColor="#94A3B8"
                    value={formData.name}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                  />

                  {canUseUrduProductNames && (
                    <>
                      <Text style={styles.label}>Urdu Product Name - Premium</Text>
                      <TextInput
                        style={[styles.input, styles.urduInput]}
                        placeholder="مثال: زنجر برگر"
                        placeholderTextColor="#94A3B8"
                        value={formData.nameUrdu}
                        onChangeText={(text) => setFormData(prev => ({ ...prev, nameUrdu: text }))}
                      />
                    </>
                  )}

                  <Text style={styles.label}>Selling Price (₨) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="350"
                    placeholderTextColor="#94A3B8"
                    value={formData.price}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
                    keyboardType="numeric"
                  />

                  <Text style={styles.label}>Cost Price (₨) - Optional</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="250"
                    placeholderTextColor="#94A3B8"
                    value={formData.costPrice}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, costPrice: text }))}
                    keyboardType="numeric"
                  />

                  <Text style={styles.label}>Description - Optional</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Product description..."
                    placeholderTextColor="#94A3B8"
                    value={formData.description}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                    multiline
                    numberOfLines={3}
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
                <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748B' },
  
  // Header Styles
  header: { paddingTop: Platform.OS === 'ios' ? 55 : 40, paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5A623', alignItems: 'center', justifyContent: 'center' },
  headerSubtitle: { fontSize: 13, color: '#94A3B8' },
  
  // Stats Card
  statsCard: { marginHorizontal: 16, marginTop: -20, marginBottom: 16, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statBox: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: '800', color: '#1A5F2B' },
  statLabel: { fontSize: 12, color: '#64748B', marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: '#E2E8F0' },
  
  // Search
  searchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A' },
  
  // FIXED CATEGORIES - Properly centered
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
  
  // List
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  
  // Product Card
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
  
  // Empty State
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#64748B', marginTop: 12, marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#94A3B8' },
  
  // No Categories
  noCategoriesCard: { marginHorizontal: 16, padding: 20, borderRadius: 16, alignItems: 'center' },
  noCategoriesText: { fontSize: 14, color: '#64748B', marginTop: 8, marginBottom: 12 },
  addCategoryBtn: { backgroundColor: '#1A5F2B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 },
  addCategoryBtnText: { color: '#FFF', fontWeight: '600' },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '90%', maxWidth: 450, maxHeight: '85%', borderRadius: 28, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A', marginBottom: 12 },
  urduInput: { textAlign: 'right', writingDirection: 'rtl' },
  textArea: { height: 80, textAlignVertical: 'top' },
  categorySelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
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
  
  // Image Picker
  imagePickerContainer: { width: '100%', height: 150, borderWidth: 2, borderColor: '#1A5F2B', borderStyle: 'dashed', borderRadius: 16, marginBottom: 10, overflow: 'hidden', backgroundColor: '#F8FAFC' },
  imagePickerPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  imagePickerText: { color: '#1A5F2B', marginTop: 10, fontSize: 14, fontWeight: '500' },
  selectedImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageActions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  imageActionBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#F1F5F9', borderRadius: 12, gap: 5 },
  removeImageBtn: { backgroundColor: '#FEF2F2' },
  imageActionText: { color: '#1A5F2B', fontSize: 12, fontWeight: '500' },
  
  // No Categories Modal
  noCategoriesModal: { alignItems: 'center', paddingVertical: 20 },
  noCategoriesModalText: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 20 },
  goToCategoriesBtn: { backgroundColor: '#1A5F2B', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 },
  goToCategoriesBtnText: { color: '#FFF', fontWeight: '600' },
});