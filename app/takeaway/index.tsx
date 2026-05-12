import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import api from '../services/api';

declare const require: any;

const { width, height } = Dimensions.get('window');
const isMobile = width < 768;
const isTablet = width >= 768 && width < 1024;
const isDesktop = width >= 1024;

const getNumColumns = () => {
  if (isDesktop) return 3;
  if (isTablet) return 2;
  return 2;
};

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  nameUrdu?: string | null;
  price: number;
  categoryId: number;
  categoryName?: string;
  image?: string | null;
  canUseUrduProductNames?: boolean;
}

interface CartItem {
  productId: number;
  name: string;
  nameUrdu?: string | null;
  price: number;
  quantity: number;
  categoryId: number;
  categoryName: string;
  isCustom?: boolean;
}

const API_BASE_URL = 'https://billpak.runasp.net';

export default function TakeAwayScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [printing, setPrinting] = useState(false);
  const [canUseUrduProductNames, setCanUseUrduProductNames] = useState(false);

  const [cashierName, setCashierName] = useState('Cashier');
  const [cashierId, setCashierId] = useState<number | null>(null);

  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [showDiscountInput, setShowDiscountInput] = useState(false);

  const [quickAddModalVisible, setQuickAddModalVisible] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPrice, setQuickAddPrice] = useState('');
  const [quickAddQuantity, setQuickAddQuantity] = useState('1');
  const [quickAddCategory, setQuickAddCategory] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([
    'General',
    'Roti',
    'Naan',
    'Rice',
    'Curry',
    'Biryani',
    'BBQ',
    'Cold Drink',
  ]);

  useEffect(() => {
    loadData();
    loadCashierUser();
    loadRestaurantProfileForPrint();

    const subscription = Dimensions.addEventListener('change', () => {});

    return () => subscription?.remove();
  }, []);

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

  const loadCashierUser = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');

      if (!userStr) {
        setCashierName('Cashier');
        setCashierId(null);
        return;
      }

      const user = JSON.parse(userStr);

      setCashierName(user?.name || 'Cashier');
      setCashierId(user?.id || user?.userId || null);
    } catch (error) {
      console.log('Load cashier error:', error);
      setCashierName('Cashier');
      setCashierId(null);
    }
  };

  const getPrintCashierName = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const loggedUser = userStr ? JSON.parse(userStr) : null;

      return loggedUser?.name || cashierName || 'Cashier';
    } catch {
      return cashierName || 'Cashier';
    }
  };

  const loadRestaurantProfileForPrint = async () => {
    try {
      const response = await api.get('/restaurant/profile');
      const restaurant = response.data?.restaurant || {};
      setCanUseUrduProductNames(getCanUseUrduProductNames(response.data));

      const restaurantName =
        restaurant.name ||
        restaurant.Name ||
        restaurant.restaurantName ||
        restaurant.RestaurantName ||
        'BillPak';

      const restaurantAddress =
        restaurant.address ||
        restaurant.Address ||
        '';

      const restaurantPhone =
        restaurant.phone ||
        restaurant.Phone ||
        '';

      await AsyncStorage.setItem('restaurant_name', restaurantName || 'BillPak');
      await AsyncStorage.setItem('restaurant_address', restaurantAddress || '');
      await AsyncStorage.setItem('restaurant_phone', restaurantPhone || '');
    } catch (error: any) {
      console.log('Restaurant profile preload error:', error.response?.data || error.message);
    }
  };

  const getRestaurantPrintInfo = async () => {
    let restaurantName = (await AsyncStorage.getItem('restaurant_name')) || '';
    let restaurantAddress = (await AsyncStorage.getItem('restaurant_address')) || '';
    const restaurantLogo = (await AsyncStorage.getItem('restaurant_logo')) || '';

    if (!restaurantName) {
      try {
        const response = await api.get('/restaurant/profile');
        const restaurant = response.data?.restaurant || {};
        setCanUseUrduProductNames(getCanUseUrduProductNames(response.data));

        restaurantName =
          restaurant.name ||
          restaurant.Name ||
          restaurant.restaurantName ||
          restaurant.RestaurantName ||
          'BillPak';

        restaurantAddress =
          restaurant.address ||
          restaurant.Address ||
          '';

        await AsyncStorage.setItem('restaurant_name', restaurantName || 'BillPak');
        await AsyncStorage.setItem('restaurant_address', restaurantAddress || '');
      } catch (error: any) {
        console.log('Restaurant print info fallback error:', error.response?.data || error.message);
      }
    }

    return {
      restaurantName: restaurantName || 'BillPak',
      restaurantAddress: restaurantAddress || '',
      restaurantLogo: restaurantLogo || '',
    };
  };

  const loadData = async () => {
    try {
      const [categoriesRes, productsRes, profileRes] = await Promise.all([
        api.get('/restaurant/categories'),
        api.get('/restaurant/products'),
        api.get('/restaurant/profile').catch(() => null),
      ]);

      const normalizedProducts = (productsRes.data || []).map(normalizeProduct);
      const productFeatureEnabled = normalizedProducts.some((product: Product) => product.canUseUrduProductNames);
      const profileFeatureEnabled = getCanUseUrduProductNames(profileRes?.data);

      setCanUseUrduProductNames(profileFeatureEnabled || productFeatureEnabled);
      setCategories(categoriesRes.data || []);
      setProducts(normalizedProducts);
      setSelectedCategory('all');
    } catch (error) {
      console.error('Load error:', error);
      Alert.alert('Error', 'Failed to load menu');
    }
  };

  const getCategoryName = (categoryId: number) => {
    const category = categories.find(c => Number(c.id) === Number(categoryId));
    return category?.name || 'General Kitchen';
  };

  const groupCartByCategory = () => {
    const grouped: Record<string, CartItem[]> = {};

    cart.forEach(item => {
      const key = item.categoryName || 'General Kitchen';

      if (!grouped[key]) {
        grouped[key] = [];
      }

      grouped[key].push(item);
    });

    return grouped;
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const productId = Number(product.id);
      const price = Number(product.price);
      const categoryId = Number(product.categoryId);
      const categoryName = product.categoryName || getCategoryName(categoryId);

      const existing = prev.find(item => item.productId === productId && !item.isCustom);

      if (existing) {
        return prev.map(item =>
          item.productId === productId && !item.isCustom
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...prev,
        {
          productId,
          name: product.name,
          nameUrdu: product.nameUrdu || '',
          price,
          quantity: 1,
          categoryId,
          categoryName,
          isCustom: false,
        },
      ];
    });
  };

  const addQuickItemToCart = () => {
    if (!quickAddName.trim()) {
      Alert.alert('Error', 'Please enter item name');
      return;
    }

    if (!quickAddPrice || isNaN(Number(quickAddPrice)) || Number(quickAddPrice) <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    const quantity = parseInt(quickAddQuantity) || 1;

    if (quantity <= 0) {
      Alert.alert('Error', 'Please enter valid quantity');
      return;
    }

    const selectedQuickCategory = quickAddCategory || 'General';
    const itemName = quickAddName.trim();
    const itemPrice = Number(quickAddPrice);
    const customId = Date.now();

    setCart(prev => {
      const existing = prev.find(
        item => item.isCustom && item.name === itemName && item.price === itemPrice
      );

      if (existing) {
        return prev.map(item =>
          item.isCustom && item.name === itemName && item.price === itemPrice
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [
        ...prev,
        {
          productId: customId,
          name: itemName,
          price: itemPrice,
          quantity,
          categoryId: 0,
          categoryName: selectedQuickCategory,
          isCustom: true,
        },
      ];
    });

    setQuickAddName('');
    setQuickAddPrice('');
    setQuickAddQuantity('1');
    setQuickAddCategory('');
    setQuickAddModalVisible(false);

    Alert.alert('Success', `${itemName} added to cart!`);
  };

  const addRotiByPiece = (pieces: number, pricePerPiece: number = 2) => {
    const customId = Date.now();

    setCart(prev => {
      const existing = prev.find(
        item => item.isCustom && item.name === 'Roti' && item.price === pricePerPiece
      );

      if (existing) {
        return prev.map(item =>
          item.isCustom && item.name === 'Roti' && item.price === pricePerPiece
            ? { ...item, quantity: item.quantity + pieces }
            : item
        );
      }

      return [
        ...prev,
        {
          productId: customId,
          name: 'Roti',
          price: pricePerPiece,
          quantity: pieces,
          categoryId: 0,
          categoryName: 'Roti',
          isCustom: true,
        },
      ];
    });

    Alert.alert('Success', `${pieces} Roti(s) added to cart!`);
  };

  const updateQuantity = (productId: number, change: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.productId === productId) {
            const newQuantity = item.quantity + change;
            if (newQuantity <= 0) return null;
            return { ...item, quantity: newQuantity };
          }

          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const getSubTotal = () => {
    return cart.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );
  };

  const getDiscountAmount = () => {
    const subtotal = getSubTotal();

    if (discountType === 'none') return 0;

    if (discountType === 'percentage') {
      const percent = parseFloat(discountValue) || 0;
      return (subtotal * percent) / 100;
    }

    if (discountType === 'fixed') {
      const fixed = parseFloat(discountValue) || 0;
      return Math.min(fixed, subtotal);
    }

    return 0;
  };

  const getTotal = () => {
    return getSubTotal() - getDiscountAmount();
  };

  const getItemCount = () => {
    return cart.reduce((sum, item) => sum + Number(item.quantity), 0);
  };

  const applyDiscount = () => {
    if (!discountValue) {
      Alert.alert('Error', 'Please enter discount value');
      return;
    }

    const value = parseFloat(discountValue);

    if (isNaN(value) || value <= 0) {
      Alert.alert('Error', 'Please enter valid discount amount');
      return;
    }

    if (discountType === 'percentage' && value > 100) {
      Alert.alert('Error', 'Percentage cannot exceed 100%');
      return;
    }

    setShowDiscountInput(false);
    Alert.alert(
      'Success',
      `${discountType === 'percentage' ? value + '%' : 'Rs. ' + value} discount applied!`
    );
  };

  const removeDiscount = () => {
    setDiscountType('none');
    setDiscountValue('');
    setShowDiscountInput(false);
    Alert.alert('Discount Removed', 'Discount has been removed from bill');
  };

  const saveTakeawaySaleRecord = async (
    billId: string,
    tokenNo: number,
    backendOrderResponse?: any
  ) => {
    const backendOrderId =
      backendOrderResponse?.id ||
      backendOrderResponse?.orderId ||
      backendOrderResponse?.order?.id ||
      null;

    const saleRecord = {
      id: billId,
      backendOrderId,
      orderNumber:
        backendOrderResponse?.orderNumber ||
        backendOrderResponse?.order?.orderNumber ||
        null,
      inventoryDeducted:
        backendOrderResponse?.inventoryDeducted ||
        backendOrderResponse?.InventoryDeducted ||
        false,
      inventoryMessage:
        backendOrderResponse?.inventoryMessage ||
        backendOrderResponse?.InventoryMessage ||
        '',
      tokenNo,
      cashierName,
      cashierId,
      items: cart.map(item => ({
        productId: item.productId,
        name: item.name,
        nameUrdu: item.nameUrdu || '',
        price: Number(item.price),
        quantity: Number(item.quantity),
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        isCustom: item.isCustom || false,
      })),
      subtotal: getSubTotal(),
      tax: 0,
      discount: {
        type: discountType,
        value: discountValue,
        amount: getDiscountAmount(),
      },
      total: getTotal(),
      timestamp: new Date().toISOString(),
      type: 'takeaway',
    };

    const existing = await AsyncStorage.getItem('sales_records');
    const records = existing ? JSON.parse(existing) : [];

    records.push(saleRecord);

    await AsyncStorage.setItem('sales_records', JSON.stringify(records));
  };

  const getTodayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  const getNextTokenNo = async () => {
    const todayKey = getTodayKey();
    const savedDate = await AsyncStorage.getItem('takeaway_token_date');
    const savedToken = await AsyncStorage.getItem('takeaway_token_no');

    if (savedDate !== todayKey) {
      await AsyncStorage.setItem('takeaway_token_date', todayKey);
      await AsyncStorage.setItem('takeaway_token_no', '1');
      return 1;
    }

    const nextToken = savedToken ? Number(savedToken) + 1 : 1;
    await AsyncStorage.setItem('takeaway_token_no', String(nextToken));

    return nextToken;
  };

  const createBackendOrderForInventory = async () => {
    const realProductItems = cart.filter(item => !item.isCustom);

    if (realProductItems.length === 0) {
      return {
        skipped: true,
        inventoryDeducted: false,
        inventoryMessage: 'Only custom items found. No inventory deduction needed.',
      };
    }

    const orderPayload = {
      tableId: null,
      orderType: 2,
      customerName: '',
      customerPhone: '',
      taxAmount: 0,
      discountAmount: getDiscountAmount(),
      items: realProductItems.map(item => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        price: Number(item.price),
        notes: '',
      })),
    };

    const response = await api.post('/restaurant/orders', orderPayload);

    return response.data;
  };

  const printDirectByPlatform = async (printPayload: any) => {
    if (Platform.OS === 'web') {
      const { printKotThenInvoiceWeb } = require('../services/webPrinterService');
      await printKotThenInvoiceWeb(printPayload);
      return true;
    }

    const { printKotThenInvoiceDirect } = require('../services/printerService');
    await printKotThenInvoiceDirect(printPayload);
    return true;
  };

  const handlePrint = async () => {
    if (cart.length === 0) {
      Alert.alert('Cart Empty', 'Please add items to cart first');
      return;
    }

    setPrinting(true);

    try {
      await loadCashierUser();
      await loadRestaurantProfileForPrint();

      const backendOrderResponse = await createBackendOrderForInventory();

      if (
        backendOrderResponse &&
        backendOrderResponse.skipped !== true &&
        backendOrderResponse.inventoryDeducted === false
      ) {
        Alert.alert(
          'Inventory Warning',
          backendOrderResponse.inventoryMessage ||
            'Order created but inventory deduction failed.'
        );
      }

      const billNo = 'TAKE_' + Date.now();
      const tokenNo = await getNextTokenNo();
      const printCashierName = await getPrintCashierName();

      const {
        restaurantName,
        restaurantAddress,
        restaurantLogo,
      } = await getRestaurantPrintInfo();

      const printPayload = {
        restaurantName,
        restaurantAddress,
        restaurantLogo,
        billNo,
        tokenNo,
        cashierName: printCashierName,
        canUseUrduProductNames,
        groupedCart: groupCartByCategory(),
        cart,
        subtotal: getSubTotal(),
        discountAmount: getDiscountAmount(),
        discountType,
        discountValue,
        total: getTotal(),
      };

      await printDirectByPlatform(printPayload);

      await saveTakeawaySaleRecord(billNo, tokenNo, backendOrderResponse);

      setCart([]);
      setDiscountType('none');
      setDiscountValue('');

      const inventoryMessage =
        backendOrderResponse?.inventoryMessage ||
        backendOrderResponse?.InventoryMessage ||
        'Order completed.';

      Alert.alert(
        'Success',
        `KOT printed, cut done, invoice printed, cut done.\nToken #${tokenNo}\nCashier: ${printCashierName}\n${inventoryMessage}`
      );
    } catch (error: any) {
      console.error('Order/Print error:', error.response?.data || error.message || error);

      Alert.alert(
        'Print Error',
        error?.message ||
          error.response?.data?.message ||
          error.response?.data?.error ||
          'Direct print failed. Please check printer connection/settings.'
      );
    } finally {
      setPrinting(false);
    }
  };

  const getImageUrl = (imagePath?: string | null): string | null => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    return `${API_BASE_URL}${imagePath}`;
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
    const inCart = cart.find(c => c.productId === Number(item.id) && !c.isCustom);

    return (
      <View style={styles.productCard}>
        <TouchableOpacity
          style={styles.productImageWrapper}
          activeOpacity={0.9}
          onPress={() => addToCart(item)}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#F8F9FA', '#F0F0F0']} style={styles.productImagePlaceholder}>
              <Ionicons name="fast-food-outline" size={40} color="#CBD5E1" />
            </LinearGradient>
          )}

          {inCart && (
            <View style={styles.productQuantityBadge}>
              <Text style={styles.productQuantityBadgeText}>{inCart.quantity}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name}
          </Text>

          {canUseUrduProductNames && !!item.nameUrdu && (
            <Text style={styles.productUrduName} numberOfLines={1}>
              {item.nameUrdu}
            </Text>
          )}

          <Text style={styles.productCategory} numberOfLines={1}>
            {item.categoryName || getCategoryName(item.categoryId)}
          </Text>

          <View style={styles.productFooter}>
            <Text style={styles.productPrice}>₨ {item.price}</Text>

            {inCart ? (
              <View style={styles.cartControls}>
                <TouchableOpacity style={styles.cartControlBtn} onPress={() => updateQuantity(item.id, -1)}>
                  <Ionicons name="remove" size={14} color="#1A5F2B" />
                </TouchableOpacity>

                <Text style={styles.cartControlQty}>{inCart.quantity}</Text>

                <TouchableOpacity style={styles.cartControlBtn} onPress={() => updateQuantity(item.id, 1)}>
                  <Ionicons name="add" size={14} color="#1A5F2B" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addToCartBtn} onPress={() => addToCart(item)}>
                <Ionicons name="add" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const CategoryPill = ({ id, name }: { id: string; name: string }) => (
    <TouchableOpacity
      style={[styles.categoryPill, selectedCategory === id && styles.categoryPillActive]}
      onPress={() => setSelectedCategory(id)}
      activeOpacity={0.8}
    >
      <Text style={[styles.categoryText, selectedCategory === id && styles.categoryTextActive]}>
        {name}
      </Text>
    </TouchableOpacity>
  );

  const CartItemRow = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.cartItemName}>{item.name}</Text>

          {item.isCustom && (
            <View style={styles.customBadge}>
              <Text style={styles.customBadgeText}>Custom</Text>
            </View>
          )}
        </View>

        {canUseUrduProductNames && !!item.nameUrdu && (
          <Text style={styles.cartItemUrduName}>{item.nameUrdu}</Text>
        )}

        <Text style={styles.cartItemPrice}>
          {item.categoryName} • ₨ {item.price} x {item.quantity} = ₨{' '}
          {(item.price * item.quantity).toFixed(2)}
        </Text>
      </View>

      <View style={styles.cartItemActions}>
        <TouchableOpacity onPress={() => updateQuantity(item.productId, -1)}>
          <Ionicons name="remove-circle" size={24} color="#EF4444" />
        </TouchableOpacity>

        <Text style={styles.cartItemQty}>{item.quantity}</Text>

        <TouchableOpacity onPress={() => updateQuantity(item.productId, 1)}>
          <Ionicons name="add-circle" size={24} color="#1A5F2B" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => removeFromCart(item.productId)}>
          <Ionicons name="trash-outline" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDiscountSection = () => (
    <View style={styles.discountSection}>
      {!showDiscountInput ? (
        <View style={styles.discountButtonsRow}>
          <TouchableOpacity
            style={styles.discountBtn}
            onPress={() => {
              setDiscountType('percentage');
              setShowDiscountInput(true);
            }}
          >
            <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.discountBtnGradient}>
              <Ionicons name="pricetag-outline" size={16} color="#FFFFFF" />
              <Text style={styles.discountBtnText}>% Discount</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.discountBtn}
            onPress={() => {
              setDiscountType('fixed');
              setShowDiscountInput(true);
            }}
          >
            <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.discountBtnGradient}>
              <Ionicons name="cash-outline" size={16} color="#FFFFFF" />
              <Text style={styles.discountBtnText}>Fixed Amount</Text>
            </LinearGradient>
          </TouchableOpacity>

          {discountType !== 'none' && (
            <TouchableOpacity style={styles.removeDiscountBtn} onPress={removeDiscount}>
              <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.removeDiscountGradient}>
                <Ionicons name="close-outline" size={16} color="#FFFFFF" />
                <Text style={styles.removeDiscountBtnText}>Remove</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.discountInputContainer}>
          <Text style={styles.discountInputLabel}>
            {discountType === 'percentage'
              ? 'Enter Discount Percentage (%)'
              : 'Enter Discount Amount (₨)'}
          </Text>

          <View style={styles.discountInputRow}>
            <TextInput
              style={styles.discountInput}
              placeholder={discountType === 'percentage' ? 'e.g., 10' : 'e.g., 50'}
              keyboardType="numeric"
              value={discountValue}
              onChangeText={setDiscountValue}
              autoFocus
              blurOnSubmit={false}
            />

            <TouchableOpacity style={styles.applyDiscountBtn} onPress={applyDiscount}>
              <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.applyDiscountGradient}>
                <Text style={styles.applyDiscountBtnText}>Apply</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelDiscountBtn}
              onPress={() => {
                setShowDiscountInput(false);
                setDiscountValue('');
              }}
            >
              <LinearGradient colors={['#94A3B8', '#64748B']} style={styles.cancelDiscountGradient}>
                <Text style={styles.cancelDiscountBtnText}>Cancel</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {discountType !== 'none' && !showDiscountInput && (
        <View style={styles.appliedDiscountInfo}>
          <Ionicons name="pricetag" size={14} color="#1A5F2B" />
          <Text style={styles.appliedDiscountText}>
            {discountType === 'percentage'
              ? `${discountValue}% discount applied (₨ ${getDiscountAmount().toFixed(2)})`
              : `Rs. ${discountValue} discount applied`}
          </Text>
        </View>
      )}
    </View>
  );

  const renderQuickAddModal = () => (
    <Modal
      animationType="slide"
      transparent
      visible={quickAddModalVisible}
      onRequestClose={() => setQuickAddModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.modalGradient}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Quick Add Item</Text>

                <TouchableOpacity onPress={() => setQuickAddModalVisible(false)}>
                  <Ionicons name="close" size={28} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.modalBody}>
                  <View style={styles.quickOptionsSection}>
                    <Text style={styles.sectionTitle}>🍞 Quick Roti Options</Text>

                    <View style={styles.quickOptionsGrid}>
                      {[1, 20, 50, 100].map((pieces) => (
                        <TouchableOpacity
                          key={pieces}
                          style={styles.quickOptionBtn}
                          onPress={() => {
                            addRotiByPiece(pieces, 2);
                            setQuickAddModalVisible(false);
                          }}
                        >
                          <Text style={styles.quickOptionText}>
                            {pieces} Roti (Rs. {pieces * 2})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.customFormSection}>
                    <Text style={styles.sectionTitle}>📝 Custom Item</Text>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Item Name *</Text>
                      <TextInput
                        style={styles.modalInput}
                        placeholder="e.g., Special Biryani"
                        value={quickAddName}
                        onChangeText={setQuickAddName}
                        blurOnSubmit={false}
                        autoCorrect={false}
                        autoCapitalize="none"
                      />
                    </View>

                    <View style={styles.rowInputs}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.inputLabel}>Price *</Text>
                        <TextInput
                          style={styles.modalInput}
                          placeholder="Price"
                          keyboardType="numeric"
                          value={quickAddPrice}
                          onChangeText={setQuickAddPrice}
                          blurOnSubmit={false}
                        />
                      </View>

                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.inputLabel}>Quantity</Text>
                        <TextInput
                          style={styles.modalInput}
                          placeholder="1"
                          keyboardType="numeric"
                          value={quickAddQuantity}
                          onChangeText={setQuickAddQuantity}
                          blurOnSubmit={false}
                        />
                      </View>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Category</Text>

                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                        {customCategories.map(cat => (
                          <TouchableOpacity
                            key={cat}
                            style={[
                              styles.categoryChip,
                              quickAddCategory === cat && styles.categoryChipActive,
                            ]}
                            onPress={() => setQuickAddCategory(cat)}
                          >
                            <Text
                              style={[
                                styles.categoryChipText,
                                quickAddCategory === cat && styles.categoryChipTextActive,
                              ]}
                            >
                              {cat}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.addItemBtn} onPress={addQuickItemToCart}>
                    <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.addItemGradient}>
                      <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
                      <Text style={styles.addItemBtnText}>Add to Cart</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  const renderCartSidebar = () => (
    <View style={styles.cartSidebar}>
      <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.cartSidebarContent}>
        <View style={styles.cartSidebarHeader}>
          <View>
            <Text style={styles.cartSidebarTitle}>Your Order</Text>
            <Text style={styles.cartSidebarSubtitle}>
              {getItemCount()} items • Cashier: {cashierName}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.quickAddSidebarBtn} onPress={() => setQuickAddModalVisible(true)}>
              <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.quickAddGradient}>
                <Ionicons name="flash-outline" size={16} color="#FFFFFF" />
                <Text style={styles.quickAddBtnText}>Quick</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.printSidebarBtn, printing && styles.printSidebarBtnDisabled]}
              onPress={handlePrint}
              disabled={printing}
            >
              <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.printSidebarGradient}>
                <Ionicons name="print-outline" size={16} color="#FFFFFF" />
                <Text style={styles.printSidebarBtnText}>{printing ? '...' : 'Print'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {cart.length === 0 ? (
          <View style={styles.emptyCartSidebar}>
            <Ionicons name="cart-outline" size={80} color="#CBD5E1" />
            <Text style={styles.emptyCartText}>No items selected</Text>
            <Text style={styles.emptyCartSubtext}>Tap on products or use Quick Add</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={cart}
              renderItem={({ item }) => <CartItemRow item={item} />}
              keyExtractor={item => item.productId.toString()}
              style={styles.cartSidebarList}
              showsVerticalScrollIndicator={false}
            />

            <View style={styles.billSummarySidebar}>
              <View style={styles.summaryRowSidebar}>
                <Text style={styles.summaryLabelSidebar}>Subtotal</Text>
                <Text style={styles.summaryValueSidebar}>₨ {getSubTotal().toFixed(2)}</Text>
              </View>

              {renderDiscountSection()}

              <View style={styles.totalRowSidebar}>
                <Text style={styles.totalLabelSidebar}>Total Amount</Text>
                <Text style={styles.totalAmountSidebar}>₨ {getTotal().toFixed(2)}</Text>
              </View>
            </View>
          </>
        )}
      </LinearGradient>
    </View>
  );

  const renderMainContent = () => (
    <View style={styles.mainContent}>
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your favourite food..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          blurOnSubmit={false}
          autoCorrect={false}
        />
      </View>

      <View style={styles.categoriesWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
          <CategoryPill id="all" name="All" />

          {categories.map(cat => (
            <CategoryPill key={cat.id} id={cat.id.toString()} name={cat.name} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredProducts}
        renderItem={({ item }) => <ProductCard item={item} />}
        keyExtractor={item => item.id.toString()}
        numColumns={getNumColumns()}
        contentContainerStyle={styles.productsGrid}
        columnWrapperStyle={getNumColumns() > 1 ? styles.productsRow : undefined}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="fast-food-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        }
      />
    </View>
  );

  return (
    <>
      <StatusBar style="light" />

      <View style={styles.container}>
        <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Take Away</Text>
            <Text style={styles.headerCashier}>Cashier: {cashierName}</Text>
          </View>

          {isMobile && (
            <TouchableOpacity style={styles.cartIconWrapper} onPress={() => setQuickAddModalVisible(true)}>
              <Ionicons name="flash-outline" size={24} color="#F5A623" />

              {cart.length > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{getItemCount()}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {!isMobile && <View style={{ width: 40 }} />}
        </LinearGradient>

        {!isMobile ? (
          <View style={styles.desktopLayout}>
            {renderMainContent()}
            {renderCartSidebar()}
          </View>
        ) : (
          <>
            {renderMainContent()}

            {cart.length > 0 && (
              <View style={styles.cartSheet}>
                <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.cartSheetContent}>
                  <View style={styles.cartSheetHeader}>
                    <View>
                      <Text style={styles.cartSheetTitle}>Your Order</Text>
                      <Text style={styles.cartSheetSubtitle}>
                        {getItemCount()} items • Cashier: {cashierName}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={styles.quickAddSheetBtn} onPress={() => setQuickAddModalVisible(true)}>
                        <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.quickAddGradient}>
                          <Ionicons name="flash-outline" size={14} color="#FFFFFF" />
                          <Text style={styles.quickAddSheetBtnText}>Quick</Text>
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.printSheetBtn, printing && styles.printSheetBtnDisabled]}
                        onPress={handlePrint}
                        disabled={printing}
                      >
                        <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.printSheetGradient}>
                          <Ionicons name="print-outline" size={16} color="#FFFFFF" />
                          <Text style={styles.printSheetBtnText}>{printing ? '...' : 'Print'}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <FlatList
                    data={cart}
                    renderItem={({ item }) => <CartItemRow item={item} />}
                    keyExtractor={item => item.productId.toString()}
                    style={styles.cartSheetList}
                    showsVerticalScrollIndicator={false}
                  />

                  <View style={styles.billSummarySheet}>
                    <View style={styles.summaryRowSheet}>
                      <Text style={styles.summaryLabelSheet}>Subtotal</Text>
                      <Text style={styles.summaryValueSheet}>₨ {getSubTotal().toFixed(2)}</Text>
                    </View>

                    {renderDiscountSection()}

                    <View style={styles.totalRowSheet}>
                      <Text style={styles.totalLabelSheet}>Total Amount</Text>
                      <Text style={styles.totalAmountSheet}>₨ {getTotal().toFixed(2)}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            )}
          </>
        )}
      </View>

      {renderQuickAddModal()}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },

  backBtn: { padding: 8 },

  headerTitleBox: {
    alignItems: 'center',
    flex: 1,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  headerCashier: {
    color: '#D1FAE5',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  cartIconWrapper: { padding: 8, position: 'relative' },

  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#F5A623',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  cartBadgeText: {
    color: '#1A5F2B',
    fontSize: 10,
    fontWeight: 'bold',
  },

  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
  },

  mainContent: {
    flex: 2,
    backgroundColor: '#F8FAFC',
  },

  cartSidebar: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },

  cartSidebarContent: {
    flex: 1,
    padding: 20,
  },

  cartSidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  cartSidebarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },

  cartSidebarSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },

  quickAddSidebarBtn: {
    borderRadius: 40,
    overflow: 'hidden',
  },

  quickAddGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },

  quickAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  printSidebarBtn: {
    borderRadius: 40,
    overflow: 'hidden',
  },

  printSidebarBtnDisabled: {
    opacity: 0.6,
  },

  printSidebarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },

  printSidebarBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  cartSidebarList: {
    flex: 1,
  },

  emptyCartSidebar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  emptyCartText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },

  emptyCartSubtext: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },

  billSummarySidebar: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  summaryRowSidebar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },

  summaryLabelSidebar: {
    fontSize: 14,
    color: '#64748B',
  },

  summaryValueSidebar: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },

  totalRowSidebar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },

  totalLabelSidebar: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },

  totalAmountSidebar: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F5A623',
  },

  discountSection: {
    marginVertical: 10,
  },

  discountButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },

  discountBtn: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },

  discountBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },

  discountBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  removeDiscountBtn: {
    borderRadius: 8,
    overflow: 'hidden',
  },

  removeDiscountGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },

  removeDiscountBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  discountInputContainer: {
    marginBottom: 8,
  },

  discountInputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 8,
  },

  discountInputRow: {
    flexDirection: 'row',
    gap: 10,
  },

  discountInput: {
    flex: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },

  applyDiscountBtn: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },

  applyDiscountGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  applyDiscountBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },

  cancelDiscountBtn: {
    borderRadius: 8,
    overflow: 'hidden',
  },

  cancelDiscountGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  cancelDiscountBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },

  appliedDiscountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },

  appliedDiscountText: {
    fontSize: 12,
    color: '#1A5F2B',
    fontWeight: '500',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#1E293B',
  },

  categoriesWrapper: {
    minHeight: 55,
    maxHeight: 65,
    marginBottom: 8,
  },

  categoriesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },

  categoryPill: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 30,
    marginRight: 12,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },

  categoryPillActive: {
    backgroundColor: '#1A5F2B',
  },

  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },

  categoryTextActive: {
    color: '#FFFFFF',
  },

  productsGrid: {
    padding: 12,
    paddingBottom: isMobile ? 220 : 20,
  },

  productsRow: {
    justifyContent: 'space-between',
    gap: 12,
  },

  productCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },

  productImageWrapper: {
    position: 'relative',
    backgroundColor: '#F8FAFC',
  },

  productImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },

  productImagePlaceholder: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },

  productQuantityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F5A623',
    borderRadius: 16,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  productQuantityBadgeText: {
    color: '#1A5F2B',
    fontSize: 12,
    fontWeight: 'bold',
  },

  productInfo: {
    padding: 12,
  },

  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },

  productUrduName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
    textAlign: 'left',
    writingDirection: 'rtl',
  },

  productCategory: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 10,
  },

  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A5F2B',
  },

  addToCartBtn: {
    backgroundColor: '#1A5F2B',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cartControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 6,
  },

  cartControlBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cartControlQty: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A5F2B',
    minWidth: 20,
    textAlign: 'center',
  },

  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  cartItemInfo: {
    flex: 1,
  },

  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },

  cartItemUrduName: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
    textAlign: 'left',
    writingDirection: 'rtl',
  },

  cartItemPrice: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },

  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  cartItemQty: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    minWidth: 24,
    textAlign: 'center',
  },

  customBadge: {
    backgroundColor: '#F5A623',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },

  customBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },

  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 12,
  },

  cartSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },

  cartSheetContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  cartSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  cartSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },

  cartSheetSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },

  quickAddSheetBtn: {
    borderRadius: 40,
    overflow: 'hidden',
  },

  quickAddSheetBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },

  printSheetBtn: {
    borderRadius: 40,
    overflow: 'hidden',
  },

  printSheetBtnDisabled: {
    opacity: 0.6,
  },

  printSheetGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },

  printSheetBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  cartSheetList: {
    maxHeight: 200,
  },

  billSummarySheet: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  summaryRowSheet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },

  summaryLabelSheet: {
    fontSize: 13,
    color: '#64748B',
  },

  summaryValueSheet: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },

  totalRowSheet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },

  totalLabelSheet: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },

  totalAmountSheet: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F5A623',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContainer: {
    width: isMobile ? '95%' : '50%',
    maxWidth: 500,
    maxHeight: height * 0.8,
  },

  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },

  modalGradient: {
    flex: 1,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },

  modalScrollContent: {
    paddingBottom: 20,
  },

  modalBody: {
    padding: 16,
  },

  quickOptionsSection: {
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A5F2B',
    marginBottom: 12,
  },

  quickOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  quickOptionBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  quickOptionText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },

  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },

  customFormSection: {
    marginBottom: 16,
  },

  inputGroup: {
    marginBottom: 14,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },

  modalInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },

  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },

  categoryScroll: {
    flexDirection: 'row',
    maxHeight: 45,
  },

  categoryChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    marginRight: 8,
  },

  categoryChipActive: {
    backgroundColor: '#1A5F2B',
  },

  categoryChipText: {
    fontSize: 12,
    color: '#64748B',
  },

  categoryChipTextActive: {
    color: '#FFFFFF',
  },

  addItemBtn: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },

  addItemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 8,
  },

  addItemBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});