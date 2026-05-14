import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { ThermalInvoiceCapture } from '../services/printerService';

declare const require: any;

const { width, height } = Dimensions.get('window');
const isMobile = width < 768;
const isTablet = width >= 768 && width < 1024;
const isDesktop = width >= 1024;

// Responsive functions
const getNumColumns = () => {
  if (isDesktop) return 3;
  if (isTablet) return 2;
  return 2;
};

const getFontSize = (size: number) => {
  if (isDesktop) return size + 2;
  if (isTablet) return size + 1;
  return size;
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

interface QuickBillErrors {
  name?: string;
  price?: string;
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

const API_BASE_URL = 'https://billpak.runasp.net';

const getRestaurantLogoFromProfile = (data: any): string => {
  const restaurant = data?.restaurant || data || {};
  const logo =
    restaurant?.logo ||
    restaurant?.logoUrl ||
    restaurant?.logoPath ||
    restaurant?.image ||
    restaurant?.imageUrl ||
    restaurant?.restaurantLogo ||
    restaurant?.Logo ||
    restaurant?.LogoUrl ||
    restaurant?.LogoPath ||
    data?.logo ||
    data?.logoUrl ||
    data?.logoPath ||
    '';

  if (!logo || typeof logo !== 'string') return '';

  const value = logo.trim();

  if (!value) return '';
  if (value.startsWith('data:image')) return value;
  if (value.startsWith('file://')) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.length > 100) return value;
  if (value.startsWith('/')) return `${API_BASE_URL}${value}`;

  return `${API_BASE_URL}/${value}`;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function TakeAwayScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [printing, setPrinting] = useState(false);
  const [canUseUrduProductNames, setCanUseUrduProductNames] = useState(false);
  const [receiptCaptureData, setReceiptCaptureData] = useState<any>(null);
  const invoiceRef = useRef<any>(null);

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
    'General', 'Roti', 'Naan', 'Rice', 'Curry', 'Biryani', 'BBQ', 'Cold Drink',
  ]);

  const [quickBillName, setQuickBillName] = useState('');
  const [quickBillPrice, setQuickBillPrice] = useState('');
  const [quickBillErrors, setQuickBillErrors] = useState<QuickBillErrors>({});
  const [appDialog, setAppDialog] = useState<AppDialogState>(emptyDialog);

  useEffect(() => {
    loadData();
    loadCashierUser();
    loadRestaurantProfileForPrint();
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

    if (status === 400) return 'Invalid data sent. Please check required fields and try again.';
    if (status === 401) return 'Session expired. Please login again.';
    if (status === 403) return 'Access denied. Takeaway permission check karein.';
    if (status === 404) return 'Requested takeaway/API endpoint not found.';
    if (status === 405) return 'This API action is not supported by backend. Backend endpoint/method check karein.';
    if (status >= 500) return 'Server error aa raha hai. Backend/API logs check karein.';

    return fallback;
  };

  const getCanUseUrduProductNames = (data: any): boolean => {
    return Boolean(
      data?.features?.canUseUrduProductNames ??
        data?.features?.CanUseUrduProductNames ??
        data?.canUseUrduProductNames ??
        false
    );
  };

  const normalizeProduct = (product: any): Product => ({
    ...product,
    nameUrdu: product?.nameUrdu ?? product?.NameUrdu ?? null,
    canUseUrduProductNames: product?.canUseUrduProductNames ?? false,
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
      setCanUseUrduProductNames(getCanUseUrduProductNames(response.data));
      const restaurant = response.data?.restaurant || {};
      const restaurantLogo = getRestaurantLogoFromProfile(response.data);
      await AsyncStorage.setItem('restaurant_name', restaurant.name || 'BillPak');
      await AsyncStorage.setItem('restaurant_address', restaurant.address || '');
      await AsyncStorage.setItem('restaurant_phone', restaurant.phone || '');
      await AsyncStorage.setItem('restaurant_logo', restaurantLogo || '');
    } catch (error: any) {
      console.log('Restaurant profile preload error:', error.response?.data || error.message);
    }
  };

  const getRestaurantPrintInfo = async () => {
    let restaurantName = (await AsyncStorage.getItem('restaurant_name')) || '';
    let restaurantAddress = (await AsyncStorage.getItem('restaurant_address')) || '';
    let restaurantLogo = (await AsyncStorage.getItem('restaurant_logo')) || '';

    if (!restaurantName || !restaurantLogo) {
      try {
        const response = await api.get('/restaurant/profile');
        const restaurant = response.data?.restaurant || {};
        setCanUseUrduProductNames(getCanUseUrduProductNames(response.data));
        restaurantName = restaurant?.name || restaurantName || 'BillPak';
        restaurantAddress = restaurant?.address || restaurantAddress || '';
        restaurantLogo = getRestaurantLogoFromProfile(response.data) || restaurantLogo || '';
        await AsyncStorage.setItem('restaurant_name', restaurantName);
        await AsyncStorage.setItem('restaurant_address', restaurantAddress);
        await AsyncStorage.setItem('restaurant_logo', restaurantLogo || '');
      } catch (error: any) {
        console.log('Restaurant print info fallback error:', error.response?.data || error.message);
      }
    }
    return { restaurantName: restaurantName || 'BillPak', restaurantAddress: restaurantAddress || '', restaurantLogo: restaurantLogo || '' };
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
    } catch (error: any) {
      console.error('Load error:', error.response?.data || error.message || error);

      showDialog({
        type: 'error',
        title: 'Menu Load Failed',
        message: getApiErrorMessage(error, 'Failed to load menu.'),
      });
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
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return grouped;
  };

  const updateQuickBillName = (value: string) => {
    setQuickBillName(value);

    if (quickBillErrors.name) {
      setQuickBillErrors(prev => ({ ...prev, name: undefined }));
    }
  };

  const updateQuickBillPrice = (value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, '');
    setQuickBillPrice(numericValue);

    if (quickBillErrors.price) {
      setQuickBillErrors(prev => ({ ...prev, price: undefined }));
    }
  };

  const addQuickBillItemToCart = () => {
    const errors: QuickBillErrors = {};
    const numericPrice = Number(quickBillPrice);
    const finalName = quickBillName.trim() || '-';

    if (!quickBillPrice.trim()) {
      errors.price = 'Price is required.';
    } else if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      errors.price = 'Please enter a valid price.';
    }

    setQuickBillErrors(errors);

    if (Object.keys(errors).length > 0) {
      showDialog({
        type: 'warning',
        title: 'Price Required',
        message: 'Custom bill item add karne ke liye price required hai. Name optional hai.',
      });
      return;
    }

    const customId = Date.now();

    setCart(prev => [
      ...prev,
      {
        productId: customId,
        name: finalName,
        price: numericPrice,
        quantity: 1,
        categoryId: 0,
        categoryName: 'Custom',
        isCustom: true,
      },
    ]);

    setQuickBillName('');
    setQuickBillPrice('');
    setQuickBillErrors({});
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
      return [...prev, {
        productId, name: product.name, nameUrdu: product.nameUrdu || '', price,
        quantity: 1, categoryId, categoryName, isCustom: false,
      }];
    });
  };

  const addQuickItemToCart = () => {
    const numericPrice = Number(quickAddPrice);
    const quantity = parseInt(quickAddQuantity, 10) || 1;
    const itemName = quickAddName.trim() || '-';

    if (!quickAddPrice || Number.isNaN(numericPrice) || numericPrice <= 0) {
      showDialog({
        type: 'warning',
        title: 'Price Required',
        message: 'Please enter a valid price. Item name optional hai.',
      });
      return;
    }

    if (quantity <= 0) {
      showDialog({
        type: 'warning',
        title: 'Invalid Quantity',
        message: 'Please enter valid quantity.',
      });
      return;
    }

    const selectedQuickCategory = quickAddCategory || 'General';
    const customId = Date.now();

    setCart(prev => {
      const existing = prev.find(item => item.isCustom && item.name === itemName && item.price === numericPrice);

      if (existing) {
        return prev.map(item =>
          item.isCustom && item.name === itemName && item.price === numericPrice
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [
        ...prev,
        {
          productId: customId,
          name: itemName,
          price: numericPrice,
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

    showDialog({
      type: 'success',
      title: 'Item Added',
      message: `${itemName} added to cart.`,
    });
  };

  const addRotiByPiece = (pieces: number, pricePerPiece: number = 2) => {
    const customId = Date.now();
    setCart(prev => {
      const existing = prev.find(item => item.isCustom && item.name === 'Roti' && item.price === pricePerPiece);
      if (existing) {
        return prev.map(item =>
          item.isCustom && item.name === 'Roti' && item.price === pricePerPiece
            ? { ...item, quantity: item.quantity + pieces }
            : item
        );
      }
      return [...prev, { productId: customId, name: 'Roti', price: pricePerPiece, quantity: pieces, categoryId: 0, categoryName: 'Roti', isCustom: true }];
    });
    showDialog({
      type: 'success',
      title: 'Roti Added',
      message: `${pieces} Roti(s) added to cart.`,
    });
  };

  const updateQuantity = (productId: number, change: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQuantity = item.quantity + change;
        if (newQuantity <= 0) return null;
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const getSubTotal = () => cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
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
  const getTotal = () => getSubTotal() - getDiscountAmount();
  const getItemCount = () => cart.reduce((sum, item) => sum + Number(item.quantity), 0);

  const applyDiscount = () => {
    if (!discountValue) {
      showDialog({
        type: 'warning',
        title: 'Discount Required',
        message: 'Please enter discount value.',
      });
      return;
    }

    const value = parseFloat(discountValue);

    if (isNaN(value) || value <= 0) {
      showDialog({
        type: 'warning',
        title: 'Invalid Discount',
        message: 'Please enter valid discount amount.',
      });
      return;
    }

    if (discountType === 'percentage' && value > 100) {
      showDialog({
        type: 'warning',
        title: 'Invalid Percentage',
        message: 'Percentage cannot exceed 100%.',
      });
      return;
    }

    setShowDiscountInput(false);

    showDialog({
      type: 'success',
      title: 'Discount Applied',
      message: `${discountType === 'percentage' ? value + '%' : 'Rs. ' + value} discount applied.`,
    });
  };

  const removeDiscount = () => {
    setDiscountType('none');
    setDiscountValue('');
    setShowDiscountInput(false);

    showDialog({
      type: 'info',
      title: 'Discount Removed',
      message: 'Discount has been removed from bill.',
    });
  };

  const saveTakeawaySaleRecord = async (billId: string, tokenNo: number, backendOrderResponse?: any) => {
    const backendOrderId = backendOrderResponse?.id || backendOrderResponse?.orderId || backendOrderResponse?.order?.id || null;
    const saleRecord = {
      id: billId, backendOrderId, orderNumber: backendOrderResponse?.orderNumber || null,
      inventoryDeducted: backendOrderResponse?.inventoryDeducted || false,
      inventoryMessage: backendOrderResponse?.inventoryMessage || '',
      tokenNo, cashierName, cashierId,
      items: cart.map(item => ({
        productId: item.productId, name: item.name, nameUrdu: item.nameUrdu || '',
        price: Number(item.price), quantity: Number(item.quantity),
        categoryId: item.categoryId, categoryName: item.categoryName, isCustom: item.isCustom || false,
      })),
      subtotal: getSubTotal(), tax: 0,
      discount: { type: discountType, value: discountValue, amount: getDiscountAmount() },
      total: getTotal(), timestamp: new Date().toISOString(), type: 'takeaway',
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
      return { skipped: true, inventoryDeducted: false, inventoryMessage: 'Only custom items found. No inventory deduction needed.' };
    }
    const orderPayload = {
      tableId: null, orderType: 2, customerName: '', customerPhone: '',
      taxAmount: 0, discountAmount: getDiscountAmount(),
      items: realProductItems.map(item => ({ productId: Number(item.productId), quantity: Number(item.quantity), price: Number(item.price), notes: '' })),
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
      showDialog({
        type: 'warning',
        title: 'Cart Empty',
        message: 'Please add items to cart first.',
      });
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
        showDialog({
          type: 'warning',
          title: 'Inventory Warning',
          message:
            backendOrderResponse.inventoryMessage ||
            'Order created but inventory deduction failed.',
        });
      }

      const billNo = 'TAKE_' + Date.now();
      const tokenNo = await getNextTokenNo();
      const printCashierName = await getPrintCashierName();
      const { restaurantName, restaurantAddress, restaurantLogo } = await getRestaurantPrintInfo();

      const printPayload: any = {
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

      if (Platform.OS !== 'web') {
        setReceiptCaptureData(printPayload);
        await delay(350);

        if (invoiceRef.current?.capture) {
          printPayload.invoiceImageBase64 = await invoiceRef.current.capture();
        } else {
          console.log('Invoice capture ref not ready. Printer will use text fallback.');
        }
      }

      await printDirectByPlatform(printPayload);
      await saveTakeawaySaleRecord(billNo, tokenNo, backendOrderResponse);

      setCart([]);
      setReceiptCaptureData(null);
      setDiscountType('none');
      setDiscountValue('');

      showDialog({
        type: 'success',
        title: 'Print Completed',
        message: `KOT printed, invoice printed.\nToken #${tokenNo}\nCashier: ${printCashierName}`,
      });
    } catch (error: any) {
      console.error('Order/Print error:', error.response?.data || error.message || error);

      showDialog({
        type: 'error',
        title: 'Print Error',
        message:
          error?.message ||
          getApiErrorMessage(error, 'Direct print failed. Please check printer connection/settings.'),
      });
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
    .filter(p => `${p.name} ${p.nameUrdu || ''}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const ProductCard = ({ item }: { item: Product }) => {
    const imageUrl = getImageUrl(item.image);
    const inCart = cart.find(c => c.productId === Number(item.id) && !c.isCustom);
    return (
      <View style={styles.productCard}>
        <TouchableOpacity style={styles.productImageWrapper} activeOpacity={0.9} onPress={() => addToCart(item)}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#F8F9FA', '#F0F0F0']} style={styles.productImagePlaceholder}>
              <Ionicons name="fast-food-outline" size={40} color="#CBD5E1" />
            </LinearGradient>
          )}
          {inCart && (<View style={styles.productQuantityBadge}><Text style={styles.productQuantityBadgeText}>{inCart.quantity}</Text></View>)}
        </TouchableOpacity>
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { fontSize: getFontSize(15) }]} numberOfLines={1}>{item.name}</Text>
          {canUseUrduProductNames && !!item.nameUrdu && (
            <Text style={[styles.productUrduName, { fontSize: getFontSize(13) }]} numberOfLines={1}>{item.nameUrdu}</Text>
          )}
          <Text style={[styles.productCategory, { fontSize: getFontSize(11) }]} numberOfLines={1}>
            {item.categoryName || getCategoryName(item.categoryId)}
          </Text>
          <View style={styles.productFooter}>
            <Text style={[styles.productPrice, { fontSize: getFontSize(16) }]}>₨ {item.price}</Text>
            {inCart ? (
              <View style={styles.cartControls}>
                <TouchableOpacity style={styles.cartControlBtn} onPress={() => updateQuantity(item.id, -1)}>
                  <Ionicons name="remove" size={14} color="#1A5F2B" />
                </TouchableOpacity>
                <Text style={[styles.cartControlQty, { fontSize: getFontSize(14) }]}>{inCart.quantity}</Text>
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
      <Text style={[styles.categoryText, { fontSize: getFontSize(14) }, selectedCategory === id && styles.categoryTextActive]}>
        {name}
      </Text>
    </TouchableOpacity>
  );

  const CartItemRow = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.cartItemName, { fontSize: getFontSize(14) }]}>{item.name || '-'}</Text>
          {item.isCustom && (<View style={styles.customBadge}><Text style={styles.customBadgeText}>Custom</Text></View>)}
        </View>
        {canUseUrduProductNames && !!item.nameUrdu && (
          <Text style={[styles.cartItemUrduName, { fontSize: getFontSize(13) }]}>{item.nameUrdu}</Text>
        )}
        <Text style={[styles.cartItemPrice, { fontSize: getFontSize(12) }]}>
          {item.categoryName} • ₨ {item.price} x {item.quantity} = ₨ {(item.price * item.quantity).toFixed(2)}
        </Text>
      </View>
      <View style={styles.cartItemActions}>
        <TouchableOpacity onPress={() => updateQuantity(item.productId, -1)}>
          <Ionicons name="remove-circle" size={22} color="#EF4444" />
        </TouchableOpacity>
        <Text style={[styles.cartItemQty, { fontSize: getFontSize(14) }]}>{item.quantity}</Text>
        <TouchableOpacity onPress={() => updateQuantity(item.productId, 1)}>
          <Ionicons name="add-circle" size={22} color="#1A5F2B" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => removeFromCart(item.productId)}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLargePrintButton = () => (
    <TouchableOpacity
      style={[styles.bigPrintBtn, printing && styles.bigPrintBtnDisabled]}
      onPress={handlePrint}
      disabled={printing}
      activeOpacity={0.85}
    >
      <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.bigPrintGradient}>
        {printing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="print-outline" size={20} color="#FFFFFF" />
        )}

        <Text style={[styles.bigPrintText, { fontSize: getFontSize(15) }]}>
          {printing ? 'Printing Order...' : 'Print Bill'}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderQuickBillAddSection = () => (
    <View style={styles.quickBillBox}>
      <Text style={[styles.quickBillTitle, { fontSize: getFontSize(13) }]}>
        Custom Bill Item
      </Text>

      <View style={styles.quickBillInputsRow}>
        <View style={styles.quickBillNameBox}>
          <TextInput
            style={[styles.quickBillInput, quickBillErrors.name && styles.quickBillInputError]}
            placeholder="Name optional"
            placeholderTextColor="#94A3B8"
            value={quickBillName}
            onChangeText={updateQuickBillName}
          />
        </View>

        <View style={styles.quickBillPriceBox}>
          <TextInput
            style={[styles.quickBillInput, quickBillErrors.price && styles.quickBillInputError]}
            placeholder="Price *"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={quickBillPrice}
            onChangeText={updateQuickBillPrice}
          />
        </View>

        <TouchableOpacity style={styles.quickBillAddBtn} onPress={addQuickBillItemToCart}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {!!quickBillErrors.price && (
        <View style={styles.inlineErrorRow}>
          <Ionicons name="alert-circle-outline" size={13} color="#DC2626" />
          <Text style={styles.inlineErrorText}>{quickBillErrors.price}</Text>
        </View>
      )}
    </View>
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

  const renderDiscountSection = () => (
    <View style={styles.discountSection}>
      {!showDiscountInput ? (
        <View style={[styles.discountButtonsRow, { flexDirection: 'row', flexWrap: 'wrap' }]}>
          <TouchableOpacity style={styles.discountBtn} onPress={() => { setDiscountType('percentage'); setShowDiscountInput(true); }}>
            <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.discountBtnGradient}>
              <Ionicons name="pricetag-outline" size={14} color="#FFFFFF" />
              <Text style={[styles.discountBtnText, { fontSize: getFontSize(12) }]}>% Discount</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.discountBtn} onPress={() => { setDiscountType('fixed'); setShowDiscountInput(true); }}>
            <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.discountBtnGradient}>
              <Ionicons name="cash-outline" size={14} color="#FFFFFF" />
              <Text style={[styles.discountBtnText, { fontSize: getFontSize(12) }]}>Fixed Amount</Text>
            </LinearGradient>
          </TouchableOpacity>
          {discountType !== 'none' && (
            <TouchableOpacity style={styles.removeDiscountBtn} onPress={removeDiscount}>
              <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.removeDiscountGradient}>
                <Ionicons name="close-outline" size={14} color="#FFFFFF" />
                <Text style={[styles.removeDiscountBtnText, { fontSize: getFontSize(12) }]}>Remove</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.discountInputContainer}>
          <Text style={[styles.discountInputLabel, { fontSize: getFontSize(12) }]}>
            {discountType === 'percentage' ? 'Enter Discount Percentage (%)' : 'Enter Discount Amount (₨)'}
          </Text>
          <View style={[styles.discountInputRow, { flexDirection: isMobile ? 'column' : 'row', gap: 8 }]}>
            <TextInput style={[styles.discountInput, { width: isMobile ? '100%' : 100 }]} placeholder={discountType === 'percentage' ? 'e.g., 10' : 'e.g., 50'} keyboardType="numeric" value={discountValue} onChangeText={setDiscountValue} autoFocus />
            <TouchableOpacity style={[styles.applyDiscountBtn, { width: isMobile ? '100%' : 70 }]} onPress={applyDiscount}>
              <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.applyDiscountGradient}>
                <Text style={[styles.applyDiscountBtnText, { fontSize: getFontSize(13) }]}>Apply</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelDiscountBtn, { width: isMobile ? '100%' : 70 }]} onPress={() => { setShowDiscountInput(false); setDiscountValue(''); }}>
              <LinearGradient colors={['#94A3B8', '#64748B']} style={styles.cancelDiscountGradient}>
                <Text style={[styles.cancelDiscountBtnText, { fontSize: getFontSize(13) }]}>Cancel</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {discountType !== 'none' && !showDiscountInput && (
        <View style={styles.appliedDiscountInfo}>
          <Ionicons name="pricetag" size={14} color="#1A5F2B" />
          <Text style={[styles.appliedDiscountText, { fontSize: getFontSize(12) }]}>
            {discountType === 'percentage' ? `${discountValue}% discount applied (₨ ${getDiscountAmount().toFixed(2)})` : `Rs. ${discountValue} discount applied`}
          </Text>
        </View>
      )}
    </View>
  );

  const renderQuickAddModal = () => (
    <Modal animationType="slide" transparent visible={quickAddModalVisible} onRequestClose={() => setQuickAddModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.modalGradient}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { fontSize: getFontSize(18) }]}>Quick Add Item</Text>
                <TouchableOpacity onPress={() => setQuickAddModalVisible(false)}><Ionicons name="close" size={26} color="#64748B" /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.modalBody}>
                  <View style={styles.quickOptionsSection}>
                    <Text style={[styles.sectionTitle, { fontSize: getFontSize(15) }]}>🍞 Quick Roti Options</Text>
                    <View style={[styles.quickOptionsGrid, { gap: 8 }]}>
                      {[1, 20, 50, 100].map((pieces) => (
                        <TouchableOpacity key={pieces} style={styles.quickOptionBtn} onPress={() => { addRotiByPiece(pieces, 2); setQuickAddModalVisible(false); }}>
                          <Text style={[styles.quickOptionText, { fontSize: getFontSize(13) }]}>{pieces} Roti (Rs. {pieces * 2})</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.customFormSection}>
                    <Text style={[styles.sectionTitle, { fontSize: getFontSize(15) }]}>📝 Custom Item</Text>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { fontSize: getFontSize(13) }]}>Item Name (Optional)</Text>
                      <TextInput style={styles.modalInput} placeholder="e.g., Special Biryani or leave blank for -" value={quickAddName} onChangeText={setQuickAddName} />
                    </View>
                    <View style={[styles.rowInputs, { gap: 10 }]}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                        <Text style={[styles.inputLabel, { fontSize: getFontSize(13) }]}>Price *</Text>
                        <TextInput style={styles.modalInput} placeholder="Price" keyboardType="numeric" value={quickAddPrice} onChangeText={setQuickAddPrice} />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={[styles.inputLabel, { fontSize: getFontSize(13) }]}>Quantity</Text>
                        <TextInput style={styles.modalInput} placeholder="1" keyboardType="numeric" value={quickAddQuantity} onChangeText={setQuickAddQuantity} />
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { fontSize: getFontSize(13) }]}>Category</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                        {customCategories.map(cat => (
                          <TouchableOpacity key={cat} style={[styles.categoryChip, quickAddCategory === cat && styles.categoryChipActive]} onPress={() => setQuickAddCategory(cat)}>
                            <Text style={[styles.categoryChipText, quickAddCategory === cat && styles.categoryChipTextActive]}>{cat}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.addItemBtn} onPress={addQuickItemToCart}>
                    <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.addItemGradient}>
                      <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
                      <Text style={[styles.addItemBtnText, { fontSize: getFontSize(15) }]}>Add to Cart</Text>
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
          <View style={{ flex: 1 }}>
            <Text style={[styles.cartSidebarTitle, { fontSize: getFontSize(20) }]}>Your Order</Text>
            <Text style={[styles.cartSidebarSubtitle, { fontSize: getFontSize(13) }]}>{getItemCount()} items • Cashier: {cashierName}</Text>
          </View>
          {/* FIXED: Buttons in column on mobile, row on tablet/desktop with proper wrapping */}
          <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
            <TouchableOpacity style={styles.quickAddSidebarBtn} onPress={() => setQuickAddModalVisible(true)}>
              <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.quickAddGradient}>
                <Ionicons name="flash-outline" size={14} color="#FFFFFF" />
                <Text style={[styles.quickAddBtnText, { fontSize: getFontSize(11) }]}>Quick</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.printSidebarBtn, printing && styles.printSidebarBtnDisabled]} onPress={handlePrint} disabled={printing}>
              <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.printSidebarGradient}>
                <Ionicons name="print-outline" size={14} color="#FFFFFF" />
                <Text style={[styles.printSidebarBtnText, { fontSize: getFontSize(11) }]}>{printing ? '...' : 'Print'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        {cart.length === 0 ? (
          <View style={styles.emptyCartSidebar}>
            <Ionicons name="cart-outline" size={60} color="#CBD5E1" />
            <Text style={[styles.emptyCartText, { fontSize: getFontSize(14) }]}>No items selected</Text>
            <Text style={[styles.emptyCartSubtext, { fontSize: getFontSize(12) }]}>Tap on products or use Quick Add</Text>
          </View>
        ) : (
          <>
            <FlatList data={cart} renderItem={({ item }) => <CartItemRow item={item} />} keyExtractor={item => item.productId.toString()} style={styles.cartSidebarList} showsVerticalScrollIndicator={false} />
            <View style={styles.billSummarySidebar}>
              {renderLargePrintButton()}
              {renderQuickBillAddSection()}
              <View style={styles.summaryRowSidebar}>
                <Text style={[styles.summaryLabelSidebar, { fontSize: getFontSize(13) }]}>Subtotal</Text>
                <Text style={[styles.summaryValueSidebar, { fontSize: getFontSize(13) }]}>₨ {getSubTotal().toFixed(2)}</Text>
              </View>
              {renderDiscountSection()}
              <View style={styles.totalRowSidebar}>
                <Text style={[styles.totalLabelSidebar, { fontSize: getFontSize(15) }]}>Total Amount</Text>
                <Text style={[styles.totalAmountSidebar, { fontSize: getFontSize(20) }]}>₨ {getTotal().toFixed(2)}</Text>
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
        <Ionicons name="search-outline" size={18} color="#94A3B8" />
        <TextInput style={[styles.searchInput, { fontSize: getFontSize(14) }]} placeholder="Search your favourite food..." placeholderTextColor="#94A3B8" value={searchQuery} onChangeText={setSearchQuery} />
      </View>
      <View style={styles.categoriesWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
          <CategoryPill id="all" name="All" />
          {categories.map(cat => (<CategoryPill key={cat.id} id={cat.id.toString()} name={cat.name} />))}
        </ScrollView>
      </View>
      <FlatList data={filteredProducts} renderItem={({ item }) => <ProductCard item={item} />} keyExtractor={item => item.id.toString()} numColumns={getNumColumns()} contentContainerStyle={styles.productsGrid} columnWrapperStyle={getNumColumns() > 1 ? styles.productsRow : undefined} showsVerticalScrollIndicator={false} ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="fast-food-outline" size={50} color="#CBD5E1" /><Text style={[styles.emptyText, { fontSize: getFontSize(13) }]}>No items found</Text></View>} />
    </View>
  );

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}><Ionicons name="arrow-back" size={22} color="#FFFFFF" /></TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={[styles.headerTitle, { fontSize: getFontSize(18) }]}>Take Away</Text>
            <Text style={[styles.headerCashier, { fontSize: getFontSize(10) }]}>Cashier: {cashierName}</Text>
          </View>
          {isMobile && (
            <TouchableOpacity style={styles.cartIconWrapper} onPress={() => setQuickAddModalVisible(true)}>
              <Ionicons name="flash-outline" size={22} color="#F5A623" />
              {cart.length > 0 && (<View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{getItemCount()}</Text></View>)}
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
                      <Text style={[styles.cartSheetTitle, { fontSize: getFontSize(16) }]}>Your Order</Text>
                      <Text style={[styles.cartSheetSubtitle, { fontSize: getFontSize(11) }]}>{getItemCount()} items • Cashier: {cashierName}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity style={styles.quickAddSheetBtn} onPress={() => setQuickAddModalVisible(true)}>
                        <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.quickAddGradient}>
                          <Ionicons name="flash-outline" size={12} color="#FFFFFF" />
                          <Text style={[styles.quickAddSheetBtnText, { fontSize: getFontSize(10) }]}>Quick</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.printSheetBtn, printing && styles.printSheetBtnDisabled]} onPress={handlePrint} disabled={printing}>
                        <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.printSheetGradient}>
                          <Ionicons name="print-outline" size={14} color="#FFFFFF" />
                          <Text style={[styles.printSheetBtnText, { fontSize: getFontSize(11) }]}>{printing ? '...' : 'Print'}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <FlatList data={cart} renderItem={({ item }) => <CartItemRow item={item} />} keyExtractor={item => item.productId.toString()} style={styles.cartSheetList} showsVerticalScrollIndicator={false} />
                  <View style={styles.billSummarySheet}>
                    {renderLargePrintButton()}
                    {renderQuickBillAddSection()}
                    <View style={styles.summaryRowSheet}><Text style={[styles.summaryLabelSheet, { fontSize: getFontSize(12) }]}>Subtotal</Text><Text style={[styles.summaryValueSheet, { fontSize: getFontSize(12) }]}>₨ {getSubTotal().toFixed(2)}</Text></View>
                    {renderDiscountSection()}
                    <View style={styles.totalRowSheet}><Text style={[styles.totalLabelSheet, { fontSize: getFontSize(14) }]}>Total Amount</Text><Text style={[styles.totalAmountSheet, { fontSize: getFontSize(18) }]}>₨ {getTotal().toFixed(2)}</Text></View>
                  </View>
                </LinearGradient>
              </View>
            )}
          </>
        )}
      </View>
      {Platform.OS !== 'web' && receiptCaptureData && (
        <ThermalInvoiceCapture
          ref={invoiceRef}
          restaurantName={receiptCaptureData.restaurantName}
          restaurantAddress={receiptCaptureData.restaurantAddress}
          restaurantLogo={receiptCaptureData.restaurantLogo}
          billNo={receiptCaptureData.billNo}
          tokenNo={receiptCaptureData.tokenNo}
          cashierName={receiptCaptureData.cashierName}
          cart={receiptCaptureData.cart}
          subtotal={receiptCaptureData.subtotal}
          discountAmount={receiptCaptureData.discountAmount}
          discountType={receiptCaptureData.discountType}
          discountValue={receiptCaptureData.discountValue}
          total={receiptCaptureData.total}
          paperWidth={80}
          orderType="Takeaway"
        />
      )}
      {renderQuickAddModal()}
      {renderAppDialog()}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20 },
  backBtn: { padding: 8 },
  headerTitleBox: { alignItems: 'center', flex: 1 },
  headerTitle: { fontWeight: 'bold', color: '#FFFFFF' },
  headerCashier: { color: '#D1FAE5', fontWeight: '700', marginTop: 2 },
  cartIconWrapper: { padding: 8, position: 'relative' },
  cartBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#F5A623', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartBadgeText: { color: '#1A5F2B', fontSize: 10, fontWeight: 'bold' },
  desktopLayout: { flex: 1, flexDirection: 'row' },
  mainContent: { flex: 1, backgroundColor: '#F8FAFC' },
  cartSidebar: { flex: 1, backgroundColor: '#FFFFFF', borderLeftWidth: 1, borderLeftColor: '#E2E8F0' },
  cartSidebarContent: { flex: 1, padding: 16 },
  cartSidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  cartSidebarTitle: { fontWeight: 'bold', color: '#0F172A' },
  cartSidebarSubtitle: { color: '#94A3B8', marginTop: 2 },
  quickAddSidebarBtn: { borderRadius: 40, overflow: 'hidden' },
  quickAddGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  quickAddBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
  printSidebarBtn: { borderRadius: 40, overflow: 'hidden' },
  printSidebarBtnDisabled: { opacity: 0.6 },
  printSidebarGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  printSidebarBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
  cartSidebarList: { flex: 1, maxHeight: 300 },
  emptyCartSidebar: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyCartText: { fontWeight: '600', color: '#64748B', marginTop: 10 },
  emptyCartSubtext: { color: '#94A3B8', marginTop: 4 },
  billSummarySidebar: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  summaryRowSidebar: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabelSidebar: { color: '#64748B' },
  summaryValueSidebar: { fontWeight: '600', color: '#0F172A' },
  totalRowSidebar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  totalLabelSidebar: { fontWeight: 'bold', color: '#0F172A' },
  totalAmountSidebar: { fontWeight: 'bold', color: '#F5A623' },
  discountSection: { marginVertical: 8 },
  discountButtonsRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  discountBtn: { flex: 1, borderRadius: 6, overflow: 'hidden' },
  discountBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 4 },
  discountBtnText: { color: '#FFFFFF', fontWeight: '600' },
  removeDiscountBtn: { borderRadius: 6, overflow: 'hidden' },
  removeDiscountGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 10, gap: 3 },
  removeDiscountBtnText: { color: '#FFFFFF', fontWeight: '600' },
  discountInputContainer: { marginBottom: 6 },
  discountInputLabel: { fontWeight: '500', color: '#64748B', marginBottom: 6 },
  discountInputRow: { gap: 6 },
  discountInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  applyDiscountBtn: { borderRadius: 6, overflow: 'hidden' },
  applyDiscountGradient: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  applyDiscountBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
  cancelDiscountBtn: { borderRadius: 6, overflow: 'hidden' },
  cancelDiscountGradient: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  cancelDiscountBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
  appliedDiscountInfo: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDF4', padding: 6, borderRadius: 6, marginTop: 4 },
  appliedDiscountText: { color: '#1A5F2B', fontWeight: '500', flex: 1 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', margin: 12, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, marginLeft: 8, color: '#1E293B' },
  categoriesWrapper: { minHeight: 50, maxHeight: 55, marginBottom: 6 },
  categoriesContainer: { paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' },
  categoryPill: { paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#F1F5F9', borderRadius: 25, marginRight: 10, minWidth: 65, alignItems: 'center', justifyContent: 'center' },
  categoryPillActive: { backgroundColor: '#1A5F2B' },
  categoryText: { fontWeight: '600', color: '#64748B', textAlign: 'center' },
  categoryTextActive: { color: '#FFFFFF' },
  productsGrid: { padding: 10, paddingBottom: isMobile ? 200 : 20 },
  productsRow: { justifyContent: 'space-between', gap: 10 },
  productCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  productImageWrapper: { position: 'relative', backgroundColor: '#F8FAFC' },
  productImage: { width: '100%', height: 120, resizeMode: 'cover' },
  productImagePlaceholder: { width: '100%', height: 120, alignItems: 'center', justifyContent: 'center' },
  productQuantityBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#F5A623', borderRadius: 14, minWidth: 26, height: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2, borderColor: '#FFFFFF' },
  productQuantityBadgeText: { color: '#1A5F2B', fontSize: 11, fontWeight: 'bold' },
  productInfo: { padding: 10 },
  productName: { fontWeight: '700', color: '#0F172A', marginBottom: 3 },
  productUrduName: { fontWeight: '600', color: '#334155', marginBottom: 3, textAlign: 'left', writingDirection: 'rtl' },
  productCategory: { color: '#94A3B8', marginBottom: 8 },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontWeight: 'bold', color: '#1A5F2B' },
  addToCartBtn: { backgroundColor: '#1A5F2B', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cartControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 18, paddingHorizontal: 4, paddingVertical: 2, gap: 4 },
  cartControlBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  cartControlQty: { fontWeight: 'bold', color: '#1A5F2B', minWidth: 18, textAlign: 'center' },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontWeight: '600', color: '#0F172A' },
  cartItemUrduName: { color: '#334155', marginTop: 2, textAlign: 'left', writingDirection: 'rtl' },
  cartItemPrice: { color: '#94A3B8', marginTop: 2 },
  cartItemActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartItemQty: { fontWeight: 'bold', color: '#0F172A', minWidth: 22, textAlign: 'center' },
  customBadge: { backgroundColor: '#F5A623', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10 },
  customBadgeText: { fontSize: 9, fontWeight: 'bold', color: '#FFFFFF' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { color: '#94A3B8', marginTop: 10 },
  cartSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'transparent' },
  cartSheetContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  cartSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cartSheetTitle: { fontWeight: 'bold', color: '#0F172A' },
  cartSheetSubtitle: { color: '#94A3B8', marginTop: 2 },
  quickAddSheetBtn: { borderRadius: 40, overflow: 'hidden' },
  quickAddSheetBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
  printSheetBtn: { borderRadius: 40, overflow: 'hidden' },
  printSheetBtnDisabled: { opacity: 0.6 },
  printSheetGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  printSheetBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
  cartSheetList: { maxHeight: 180 },
  billSummarySheet: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  summaryRowSheet: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabelSheet: { color: '#64748B' },
  summaryValueSheet: { fontWeight: '600', color: '#0F172A' },
  totalRowSheet: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  totalLabelSheet: { fontWeight: 'bold', color: '#0F172A' },
  totalAmountSheet: { fontWeight: 'bold', color: '#F5A623' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: isMobile ? '95%' : '45%', maxWidth: 450, maxHeight: height * 0.8 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden' },
  modalGradient: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontWeight: 'bold', color: '#0F172A' },
  modalScrollContent: { paddingBottom: 20 },
  modalBody: { padding: 14 },
  quickOptionsSection: { marginBottom: 16 },
  sectionTitle: { fontWeight: 'bold', color: '#1A5F2B', marginBottom: 10 },
  quickOptionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickOptionBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  quickOptionText: { color: '#0F172A', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 },
  customFormSection: { marginBottom: 12 },
  inputGroup: { marginBottom: 10 },
  inputLabel: { fontWeight: '600', color: '#64748B', marginBottom: 4 },
  modalInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 8, color: '#0F172A', backgroundColor: '#FFFFFF' },
  rowInputs: { flexDirection: 'row', gap: 8 },
  categoryScroll: { flexDirection: 'row', maxHeight: 40 },
  categoryChip: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, marginRight: 6 },
  categoryChipActive: { backgroundColor: '#1A5F2B' },
  categoryChipText: { fontSize: 11, color: '#64748B' },
  categoryChipTextActive: { color: '#FFFFFF' },
  addItemBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  addItemGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 6 },
  addItemBtnText: { fontWeight: 'bold', color: '#FFFFFF' },
  bigPrintBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 10 },
  bigPrintBtnDisabled: { opacity: 0.6 },
  bigPrintGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  bigPrintText: { color: '#FFFFFF', fontWeight: '900' },
  quickBillBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 10, marginBottom: 10 },
  quickBillTitle: { fontWeight: '800', color: '#1A5F2B', marginBottom: 8 },
  quickBillInputsRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  quickBillNameBox: { flex: 1.25 },
  quickBillPriceBox: { flex: 1 },
  quickBillInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, color: '#0F172A', fontSize: 13 },
  quickBillInputError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  quickBillAddBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1A5F2B', alignItems: 'center', justifyContent: 'center' },
  inlineErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  inlineErrorText: { color: '#DC2626', fontSize: 11, fontWeight: '700', flex: 1 },
  dialogOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  dialogBox: { width: '100%', maxWidth: 380, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 18, elevation: 18 },
  dialogIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  dialogTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 8 },
  dialogMessage: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 21 },
  dialogActions: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 20 },
  dialogCancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  dialogCancelText: { color: '#64748B', fontSize: 14, fontWeight: '800' },
  dialogConfirmBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  dialogConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },

});