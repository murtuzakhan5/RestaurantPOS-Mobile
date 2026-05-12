import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert, StyleSheet, ActivityIndicator,
  Dimensions, Platform, Image, Modal,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import api from '../services/api';

const { width } = Dimensions.get('window');
const isMobile = width < 768;
const isTablet = width >= 768 && width < 1024;
const isDesktop = width >= 1024;

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  image?: string | null;
  categoryId?: number;
  categoryName?: string;
}

interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
  isCustom?: boolean;
}

const API_BASE_URL = 'https://billpak.runasp.net';

function printViaIframe(html: string): void {
  if (typeof document === 'undefined') return;
  const old = document.getElementById('silent-print-frame');
  if (old) old.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'silent-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);
  const frameWindow = iframe.contentWindow;
  const doc = frameWindow?.document;
  if (!frameWindow || !doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch (error) {
      console.log('KOT print iframe error:', error);
    }
    setTimeout(() => {
      const frame = document.getElementById('silent-print-frame');
      if (frame) frame.remove();
    }, 2500);
  }, 500);
}

async function doPrint(html: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    printViaIframe(html);
  } else {
    const { printAsync } = require('expo-print');
    await printAsync({ html });
  }
}

export default function DineInOrderScreen() {
  const { tableId, tableNumber } = useLocalSearchParams<{
    tableId: string;
    tableNumber: string;
  }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [existingOrders, setExistingOrders] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [cashierName, setCashierName] = useState('Cashier');
  const [cashierId, setCashierId] = useState<number | null>(null);

  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');

  const kotPrintLockRef = useRef(false);

  useEffect(() => {
    loadAll();
    loadCashierUser();
  }, [tableId]);

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

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadCategories(), loadProducts(), loadExistingOrders()]);
    setLoading(false);
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/restaurant/categories');
      setCategories(response.data || []);
    } catch (err) {
      console.error('Categories error:', err);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await api.get('/restaurant/products');
      setProducts(response.data || []);
    } catch (err) {
      console.error('Products error:', err);
      Alert.alert('Error', 'Products load nahi ho sake');
    }
  };

  const loadExistingOrders = async () => {
    try {
      const saved = await AsyncStorage.getItem(`kots_${tableId}`);
      if (!saved) {
        setExistingOrders([]);
        return;
      }
      const kots = JSON.parse(saved);
      const merged: CartItem[] = [];
      kots.forEach((kot: any) => {
        if (!kot.items) return;
        kot.items.forEach((item: CartItem) => {
          const productId = Number(item.productId);
          const price = Number(item.price);
          const quantity = Number(item.quantity);
          const isCustom = Boolean(item.isCustom) || productId <= 0;
          const exist = merged.find(i =>
            isCustom
              ? i.isCustom && i.name === item.name && Number(i.price) === price
              : Number(i.productId) === productId
          );
          if (exist) {
            exist.quantity += quantity;
          } else {
            merged.push({
              productId,
              name: item.name,
              price,
              quantity,
              image: item.image,
              isCustom,
            });
          }
        });
      });
      setExistingOrders(merged);
    } catch (err) {
      console.error('Existing orders error:', err);
      setExistingOrders([]);
    }
  };

  const getImageUrl = (imagePath?: string | null): string | null => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    return `${API_BASE_URL}${imagePath}`;
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const productId = Number(product.id);
      const price = Number(product.price);
      const exist = prev.find(c => c.productId === productId);
      if (exist) {
        return prev.map(c =>
          c.productId === productId ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { productId, name: product.name, price, quantity: 1, image: product.image, isCustom: false }];
    });
  };

  const updateQuantity = (productId: number, change: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const newQuantity = item.quantity + change;
          if (newQuantity <= 0) return null;
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const addCustomItemToCart = () => {
    const name = customName.trim();
    const price = Number(customPrice);
    const quantity = Number(customQuantity || 1);
    if (!name) {
      Alert.alert('Error', 'Custom item name required hai');
      return;
    }
    if (Number.isNaN(price) || price <= 0) {
      Alert.alert('Error', 'Valid price enter karo');
      return;
    }
    if (Number.isNaN(quantity) || quantity <= 0) {
      Alert.alert('Error', 'Valid quantity enter karo');
      return;
    }
    const customId = -Date.now();
    setCart(prev => {
      const existing = prev.find(item => item.isCustom && item.name === name && Number(item.price) === price);
      if (existing) {
        return prev.map(item =>
          item.isCustom && item.name === name && Number(item.price) === price
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { productId: customId, name, price, quantity, image: null, isCustom: true }];
    });
    setCustomName('');
    setCustomPrice('');
    setCustomQuantity('1');
    setCustomModalVisible(false);
  };


  const getRestaurantPrintInfo = async () => {
    const restaurantName = (await AsyncStorage.getItem('restaurant_name')) || 'BillPak';

    return {
      restaurantName: restaurantName || 'BillPak',
    };
  };

  const printDineInKotByPlatform = async (printPayload: any) => {
    if (Platform.OS === 'web') {
      const { printDineInKotWeb } = require('../services/webPrinterService');
      await printDineInKotWeb(printPayload);
      return true;
    }

    const { printDineInKotDirect } = require('../services/printerService');
    await printDineInKotDirect(printPayload);
    return true;
  };

  const printKOT = async () => {
    if (kotPrintLockRef.current || printing) return;
    if (cart.length === 0) {
      Alert.alert('Cart Empty', 'Please add items to cart first');
      return;
    }
    kotPrintLockRef.current = true;
    setPrinting(true);
    try {
      await loadCashierUser();
      const kotId = 'KOT_' + Date.now();
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString('en-PK');
      const printCashierName = await getPrintCashierName();
      const safeCart = cart.map(item => ({
        productId: Number(item.productId),
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        isCustom: Boolean(item.isCustom),
      }));
      const { restaurantName } = await getRestaurantPrintInfo();

      await printDineInKotByPlatform({
        restaurantName,
        billNo: kotId,
        tableNumber: String(tableNumber),
        cashierName: printCashierName,
        items: safeCart,
      });

      const key = `kots_${tableId}`;
      const prev = await AsyncStorage.getItem(key);
      const kots = prev ? JSON.parse(prev) : [];
      kots.push({
        id: kotId,
        tableId: String(tableId),
        tableNo: `Table ${tableNumber}`,
        tableNumber: String(tableNumber),
        items: safeCart,
        status: 'pending',
        orderType: 'dinein',
        timestamp: now.toISOString(),
        cashierName: printCashierName,
        cashierId,
      });
      await AsyncStorage.setItem(key, JSON.stringify(kots));
      await AsyncStorage.setItem(`table_${tableId}_status`, 'reserved');
      try {
        await api.put(`/restaurant/tables/${tableId}`, { status: 1 });
      } catch (apiErr) {
        console.warn('API table update failed, local saved:', apiErr);
      }
      setCart([]);
      await loadExistingOrders();
      Alert.alert('✅ Success', `KOT printed! Table ${tableNumber} is now reserved`);
    } catch (err: any) {
      console.error('KOT error:', err);
      Alert.alert('Error', err.message || 'Failed to print KOT');
    } finally {
      setTimeout(() => {
        kotPrintLockRef.current = false;
        setPrinting(false);
      }, 1800);
    }
  };

  const filteredProducts = products
    .filter(p => selectedCategory === 'all' || Number(p.categoryId) === Number(selectedCategory))
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const cartTotal = cart.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
  const cartItemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

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

  const ProductCard = ({ item }: { item: Product }) => {
    const imageUrl = getImageUrl(item.image);
    const inCart = cart.find(c => c.productId === Number(item.id));
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
          {inCart && (
            <View style={styles.productQuantityBadge}>
              <Text style={styles.productQuantityBadgeText}>{inCart.quantity}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productCategory} numberOfLines={1}>{item.categoryName || 'Food Item'}</Text>
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
                <TouchableOpacity style={styles.deleteBtn} onPress={() => removeFromCart(item.id)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
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

  const renderCustomItemModal = () => (
    <Modal visible={customModalVisible} transparent animationType="slide" onRequestClose={() => setCustomModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.customModalBox}>
          <View style={styles.customModalHeader}>
            <Text style={styles.customModalTitle}>Add Custom Item</Text>
            <TouchableOpacity onPress={() => setCustomModalVisible(false)}>
              <Ionicons name="close-circle" size={28} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          <Text style={styles.inputLabel}>Item Name</Text>
          <TextInput style={styles.input} placeholder="e.g., Extra Raita" placeholderTextColor="#94A3B8" value={customName} onChangeText={setCustomName} />
          <Text style={styles.inputLabel}>Price (₨)</Text>
          <TextInput style={styles.input} placeholder="100" placeholderTextColor="#94A3B8" keyboardType="numeric" value={customPrice} onChangeText={setCustomPrice} />
          <Text style={styles.inputLabel}>Quantity</Text>
          <TextInput style={styles.input} placeholder="1" placeholderTextColor="#94A3B8" keyboardType="numeric" value={customQuantity} onChangeText={setCustomQuantity} />
          <TouchableOpacity style={styles.addCustomBtn} onPress={addCustomItemToCart} activeOpacity={0.8}>
            <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.addCustomGradient}>
              <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" />
              <Text style={styles.addCustomText}>Add to Order</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F5A623" />
        <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading menu...</Text>
      </View>
    );
  }

  // DESKTOP/TABLET: 3-COLUMN LAYOUT
  if (!isMobile) {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.container}>
          {/* Header */}
          <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Table {tableNumber}</Text>
              <Text style={styles.headerSubtitle}>Dine In • Cashier: {cashierName}</Text>
            </View>
            <TouchableOpacity style={styles.customHeaderBtn} onPress={() => setCustomModalVisible(true)}>
              <Ionicons name="add-circle-outline" size={24} color="#F5A623" />
            </TouchableOpacity>
          </LinearGradient>

          {/* 3-COLUMN LAYOUT */}
          <View style={styles.threeColumnLayout}>
            {/* LEFT COLUMN - Previous Orders (25%) */}
            <View style={styles.leftColumn}>
              <LinearGradient colors={['#FEF3C7', '#FFFBEB']} style={styles.leftColumnHeader}>
                <Ionicons name="time-outline" size={18} color="#D97706" />
                <Text style={styles.leftColumnTitle}>Previous Orders</Text>
                <Text style={styles.leftColumnBadge}>{existingOrders.length} items</Text>
              </LinearGradient>
              <ScrollView style={styles.leftColumnContent} showsVerticalScrollIndicator={false}>
                {existingOrders.length === 0 ? (
                  <View style={styles.emptyLeftColumn}>
                    <Ionicons name="receipt-outline" size={40} color="#FDE68A" />
                    <Text style={styles.emptyLeftText}>No previous orders</Text>
                  </View>
                ) : (
                  existingOrders.map((item, idx) => (
                    <View key={idx} style={styles.previousOrderItem}>
                      <Text style={styles.previousOrderName} numberOfLines={2}>{item.name}{item.isCustom ? ' (C)' : ''}</Text>
                      <View style={styles.previousOrderDetails}>
                        <Text style={styles.previousOrderQty}>×{item.quantity}</Text>
                        <Text style={styles.previousOrderPrice}>₨{item.price * item.quantity}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>

            {/* CENTER COLUMN - Products (50%) */}
            <View style={styles.centerColumn}>
              <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={20} color="#94A3B8" />
                <TextInput style={styles.searchInput} placeholder="Search food..." placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll} contentContainerStyle={styles.categoriesContainer}>
                <CategoryPill id="all" name="All" />
                {categories.map(cat => (<CategoryPill key={cat.id} id={cat.id.toString()} name={cat.name} />))}
              </ScrollView>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.productsScroll}>
                <View style={styles.productsGrid}>
                  {filteredProducts.length === 0 ? (
                    <View style={styles.emptyCenter}>
                      <Ionicons name="fast-food-outline" size={50} color="#CBD5E1" />
                      <Text style={styles.emptyText}>No items found</Text>
                    </View>
                  ) : (
                    filteredProducts.map((item) => <ProductCard key={item.id} item={item} />)
                  )}
                </View>
              </ScrollView>
            </View>

            {/* RIGHT COLUMN - Current Order (25%) */}
            <View style={styles.rightColumn}>
              <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.rightColumnHeader}>
                <Ionicons name="cart-outline" size={18} color="#FFF" />
                <Text style={styles.rightColumnTitle}>Current Order</Text>
                <Text style={styles.rightColumnBadge}>{cartItemCount} items</Text>
              </LinearGradient>
              <ScrollView style={styles.rightColumnContent} showsVerticalScrollIndicator={false}>
                {cart.length === 0 ? (
                  <View style={styles.emptyRightColumn}>
                    <Ionicons name="cart-outline" size={50} color="#CBD5E1" />
                    <Text style={styles.emptyRightText}>Cart is empty</Text>
                    <Text style={styles.emptyRightSubtext}>Tap on products to add</Text>
                  </View>
                ) : (
                  cart.map((item, idx) => (
                    <View key={idx} style={styles.currentOrderItem}>
                      <View style={styles.currentOrderInfo}>
                        <Text style={styles.currentOrderName} numberOfLines={1}>{item.name}{item.isCustom ? ' (C)' : ''}</Text>
                        <Text style={styles.currentOrderPrice}>₨{item.price} × {item.quantity}</Text>
                      </View>
                      <View style={styles.currentOrderActions}>
                        <TouchableOpacity onPress={() => updateQuantity(item.productId, -1)}>
                          <Ionicons name="remove-circle" size={22} color="#EF4444" />
                        </TouchableOpacity>
                        <Text style={styles.currentOrderQty}>{item.quantity}</Text>
                        <TouchableOpacity onPress={() => updateQuantity(item.productId, 1)}>
                          <Ionicons name="add-circle" size={22} color="#F5A623" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeFromCart(item.productId)}>
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
              {cart.length > 0 && (
                <View style={styles.rightColumnFooter}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Amount</Text>
                    <Text style={styles.totalAmount}>₨{cartTotal}</Text>
                  </View>
                  <TouchableOpacity style={styles.printKotFooterBtn} onPress={printKOT} disabled={printing || kotPrintLockRef.current}>
                    <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.printKotFooterGradient}>
                      <Ionicons name="print-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.printKotFooterText}>{printing ? 'Printing...' : 'Print KOT'}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
        {renderCustomItemModal()}
      </>
    );
  }

  // MOBILE LAYOUT
  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Table {tableNumber}</Text>
            <Text style={styles.headerSubtitle}>Dine In • Cashier: {cashierName}</Text>
          </View>
          <TouchableOpacity style={styles.customHeaderBtn} onPress={() => setCustomModalVisible(true)}>
            <Ionicons name="add-circle-outline" size={24} color="#F5A623" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.mobileLayout}>
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#94A3B8" />
            <TextInput style={styles.searchInput} placeholder="Search food..." placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll} contentContainerStyle={styles.categoriesContainer}>
            <CategoryPill id="all" name="All" />
            {categories.map(cat => (<CategoryPill key={cat.id} id={cat.id.toString()} name={cat.name} />))}
          </ScrollView>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.productsScroll}>
            <View style={styles.productsGrid}>
              {filteredProducts.map((item) => <ProductCard key={item.id} item={item} />)}
            </View>
          </ScrollView>

          {cart.length > 0 && (
            <View style={styles.mobileCartSheet}>
              <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.mobileCartContent}>
                <Text style={styles.mobileCartTitle}>Current Order ({cartItemCount} items)</Text>
                {cart.map((item, idx) => (
                  <View key={idx} style={styles.mobileCartItem}>
                    <Text style={styles.mobileCartName}>{item.name}{item.isCustom ? ' (C)' : ''}</Text>
                    <View style={styles.mobileCartActions}>
                      <TouchableOpacity onPress={() => updateQuantity(item.productId, -1)}><Ionicons name="remove-circle" size={22} color="#EF4444" /></TouchableOpacity>
                      <Text style={styles.mobileCartQty}>{item.quantity}</Text>
                      <TouchableOpacity onPress={() => updateQuantity(item.productId, 1)}><Ionicons name="add-circle" size={22} color="#1A5F2B" /></TouchableOpacity>
                      <TouchableOpacity onPress={() => removeFromCart(item.productId)}><Ionicons name="trash-outline" size={20} color="#EF4444" /></TouchableOpacity>
                    </View>
                  </View>
                ))}
                <View style={styles.mobileTotalRow}>
                  <Text style={styles.mobileTotalLabel}>Total</Text>
                  <Text style={styles.mobileTotalAmount}>₨{cartTotal}</Text>
                </View>
                <TouchableOpacity style={styles.mobilePrintBtn} onPress={printKOT} disabled={printing || kotPrintLockRef.current}>
                  <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.mobilePrintGradient}>
                    <Ionicons name="print-outline" size={18} color="#FFF" />
                    <Text style={styles.mobilePrintText}>{printing ? 'Printing...' : 'Print KOT'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}
        </View>
      </View>
      {renderCustomItemModal()}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20 },
  backBtn: { padding: 8 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 12, color: '#F5A623', marginTop: 2 },
  customHeaderBtn: { padding: 8, backgroundColor: 'rgba(245,166,35,0.2)', borderRadius: 25 },

  // 3-COLUMN LAYOUT
  threeColumnLayout: { flex: 1, flexDirection: 'row' },
  
  // LEFT COLUMN (25%) - Previous Orders
  leftColumn: { width: '25%', backgroundColor: '#FFFBEB', borderRightWidth: 1, borderRightColor: '#FDE68A' },
  leftColumnHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  leftColumnTitle: { fontSize: 14, fontWeight: 'bold', color: '#D97706', flex: 1 },
  leftColumnBadge: { fontSize: 11, fontWeight: '600', color: '#D97706', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  leftColumnContent: { flex: 1, padding: 10 },
  previousOrderItem: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#FDE68A' },
  previousOrderName: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  previousOrderDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previousOrderQty: { fontSize: 11, color: '#D97706', fontWeight: '500' },
  previousOrderPrice: { fontSize: 12, fontWeight: 'bold', color: '#DC2626' },
  emptyLeftColumn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },
  emptyLeftText: { fontSize: 12, color: '#FDE68A', marginTop: 8 },

  // CENTER COLUMN (50%) - Products
  centerColumn: { width: '50%', backgroundColor: '#F8FAFC', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', margin: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#1E293B' },
  categoriesScroll: { maxHeight: 50 },
  categoriesContainer: { paddingHorizontal: 12, gap: 8, flexDirection: 'row', alignItems: 'center' },
  categoryPill: { paddingHorizontal: 18, paddingVertical: 7, backgroundColor: '#F1F5F9', borderRadius: 25, borderWidth: 1, borderColor: '#E2E8F0' },
  categoryPillActive: { backgroundColor: '#1A5F2B', borderColor: '#1A5F2B' },
  categoryText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  categoryTextActive: { color: '#FFFFFF' },
  productsScroll: { flex: 1 },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 10 },
  productCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  productImageWrapper: { position: 'relative' },
  productImage: { width: '100%', height: 120, resizeMode: 'cover' },
  productImagePlaceholder: { width: '100%', height: 120, alignItems: 'center', justifyContent: 'center' },
  productQuantityBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#F5A623', borderRadius: 14, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 1.5, borderColor: '#FFF' },
  productQuantityBadgeText: { color: '#1A5F2B', fontSize: 11, fontWeight: 'bold' },
  productInfo: { padding: 10 },
  productName: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  productCategory: { fontSize: 10, color: '#94A3B8', marginBottom: 6 },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontSize: 14, fontWeight: 'bold', color: '#1A5F2B' },
  addToCartBtn: { backgroundColor: '#1A5F2B', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cartControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 18, paddingHorizontal: 5, paddingVertical: 3, gap: 4 },
  cartControlBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  cartControlQty: { fontSize: 12, fontWeight: 'bold', color: '#1A5F2B', minWidth: 18, textAlign: 'center' },
  deleteBtn: { marginLeft: 2, padding: 2 },
  emptyCenter: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13, color: '#94A3B8', marginTop: 8 },

  // RIGHT COLUMN (25%) - Current Order
  rightColumn: { width: '25%', backgroundColor: '#FFFFFF' },
  rightColumnHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  rightColumnTitle: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF', flex: 1 },
  rightColumnBadge: { fontSize: 11, fontWeight: '600', color: '#1A5F2B', backgroundColor: '#F5A623', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  rightColumnContent: { flex: 1, padding: 10 },
  currentOrderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  currentOrderInfo: { flex: 1 },
  currentOrderName: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  currentOrderPrice: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  currentOrderActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currentOrderQty: { fontSize: 13, fontWeight: 'bold', color: '#0F172A', minWidth: 20, textAlign: 'center' },
  emptyRightColumn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyRightText: { fontSize: 13, color: '#94A3B8', marginTop: 10 },
  emptyRightSubtext: { fontSize: 11, color: '#CBD5E1', marginTop: 4 },
  rightColumnFooter: { padding: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel: { fontSize: 14, fontWeight: 'bold', color: '#0F172A' },
  totalAmount: { fontSize: 18, fontWeight: 'bold', color: '#F5A623' },
  printKotFooterBtn: { borderRadius: 40, overflow: 'hidden' },
  printKotFooterGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  printKotFooterText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },

  // MOBILE LAYOUT
  mobileLayout: { flex: 1, backgroundColor: '#F8FAFC' },
  mobileCartSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'transparent' },
  mobileCartContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 15 },
  mobileCartTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', marginBottom: 12 },
  mobileCartItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  mobileCartName: { fontSize: 13, fontWeight: '500', color: '#0F172A', flex: 1 },
  mobileCartActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mobileCartQty: { fontSize: 13, fontWeight: 'bold', minWidth: 20, textAlign: 'center' },
  mobileTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  mobileTotalLabel: { fontSize: 15, fontWeight: 'bold', color: '#0F172A' },
  mobileTotalAmount: { fontSize: 18, fontWeight: 'bold', color: '#F5A623' },
  mobilePrintBtn: { borderRadius: 40, overflow: 'hidden', marginTop: 12 },
  mobilePrintGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  mobilePrintText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  customModalBox: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 20 },
  customModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  customModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#FFFFFF' },
  addCustomBtn: { borderRadius: 40, overflow: 'hidden', marginTop: 16 },
  addCustomGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  addCustomText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
});