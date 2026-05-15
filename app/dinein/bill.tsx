import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import api from '../services/api';

const { width } = Dimensions.get('window');
const isWide = width >= 768;

type DiscountType = 'none' | 'percentage' | 'fixed';

interface BillItem {
  productId: number;
  name: string;
  nameUrdu?: string | null;
  nameUrduImageBase64?: string | null;
  price: number;
  quantity: number;
  isCustom?: boolean;
}

export default function TableBillScreen() {
  const { tableId, tableNumber } = useLocalSearchParams<{
    tableId: string;
    tableNumber: string;
  }>();

  const [items, setItems] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [cashierName, setCashierName] = useState('Cashier');
  const [cashierId, setCashierId] = useState<number | null>(null);

  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [showDiscountInput, setShowDiscountInput] = useState(false);

  // ✅ HARD PRINT LOCK: prevents double tap / repeated print / duplicate backend order
  const printLockRef = useRef(false);

  useEffect(() => {
    loadBill();
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

  const loadBill = async () => {
    try {
      setLoading(true);

      const saved = await AsyncStorage.getItem(`kots_${tableId}`);

      if (!saved) {
        setItems([]);
        return;
      }

      const kots = JSON.parse(saved);
      const merged: BillItem[] = [];

      kots.forEach((kot: any) => {
        if (!kot.items) return;

        kot.items.forEach((item: BillItem) => {
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
              nameUrdu: (item as any).nameUrdu || null,
              nameUrduImageBase64: (item as any).nameUrduImageBase64 || null,
              price,
              quantity,
              isCustom,
            });
          }
        });
      });

      setItems(merged);
    } catch (err) {
      console.error('Bill load error:', err);
      Alert.alert('Error', 'Bill load nahi ho saki');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.quantity),
    0
  );

  const getDiscountAmount = () => {
    if (discountType === 'none') return 0;

    const value = Number(discountValue || 0);

    if (Number.isNaN(value) || value <= 0) return 0;

    if (discountType === 'percentage') {
      return Math.min((subtotal * value) / 100, subtotal);
    }

    return Math.min(value, subtotal);
  };

  const discountAmount = getDiscountAmount();
  const tax = 0;
  const total = Math.max(subtotal - discountAmount, 0);

  const adjustQuantity = (idx: number, change: number) => {
    setItems(prev => {
      const updated = [...prev];

      updated[idx] = {
        ...updated[idx],
        quantity: updated[idx].quantity + change,
      };

      if (updated[idx].quantity <= 0) {
        updated.splice(idx, 1);
      }

      return updated;
    });
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const applyDiscount = () => {
    const value = Number(discountValue || 0);

    if (discountType === 'none') {
      Alert.alert('Error', 'Please select discount type');
      return;
    }

    if (Number.isNaN(value) || value <= 0) {
      Alert.alert('Error', 'Please enter valid discount value');
      return;
    }

    if (discountType === 'percentage' && value > 100) {
      Alert.alert('Error', 'Percentage cannot exceed 100%');
      return;
    }

    setShowDiscountInput(false);

    Alert.alert(
      'Success',
      discountType === 'percentage'
        ? `${value}% discount applied`
        : `Rs. ${value} discount applied`
    );
  };

  const removeDiscount = () => {
    setDiscountType('none');
    setDiscountValue('');
    setShowDiscountInput(false);
  };

  const createBackendOrderForInventory = async () => {
    const realItems = items.filter(
      item => Number(item.productId) > 0 && item.isCustom !== true
    );

    if (realItems.length === 0) {
      console.log('No real product items found. Backend order skipped.');

      return {
        skipped: true,
        inventoryDeducted: false,
        inventoryMessage: 'Only custom items found. No inventory deduction needed.',
      };
    }

    const orderPayload = {
      tableId: Number(tableId),
      orderType: 1,
      customerName: '',
      customerPhone: '',
      taxAmount: 0,
      discountAmount,
      items: realItems.map(item => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
        price: Number(item.price),
        notes: '',
      })),
    };

    console.log('DINE-IN ORDER PAYLOAD:', JSON.stringify(orderPayload, null, 2));

    const response = await api.post('/restaurant/orders', orderPayload);

    console.log('DINE-IN ORDER RESPONSE:', JSON.stringify(response.data, null, 2));

    return response.data;
  };

  const buildBillHTML = async (billId: string) => {
    const timeStr = new Date().toLocaleString('en-PK');
    const uploadedLogo = await AsyncStorage.getItem('restaurant_logo');
    const restaurantName =
      (await AsyncStorage.getItem('restaurant_name')) || 'BillPak';
    const printCashierName = await getPrintCashierName();

    const logoHTML = uploadedLogo
      ? `<img src="${uploadedLogo}" class="brand-logo" />`
      : `<div class="brand-text">${restaurantName}</div>`;

    const discountHTML =
      discountAmount > 0
        ? `
      <div class="total-row discount"><span>Discount ${
        discountType === 'percentage' ? `(${discountValue}%)` : ''
      }</span><span>-₨${discountAmount.toFixed(2)}</span></div>
    `
        : '';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Final Bill - Table ${tableNumber}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', Arial, sans-serif;
  background: #eef2f3;
  padding: 20px;
}
.bill {
  max-width: 400px;
  margin: 0 auto;
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}
.header {
  text-align: center;
  padding: 24px 20px 20px;
  background: linear-gradient(135deg, #1A5F2B 0%, #0D3D1C 100%);
  color: #fff;
}
.brand-logo {
  width: 70px;
  height: 70px;
  border-radius: 16px;
  background: #fff;
  padding: 8px;
  margin-bottom: 12px;
  object-fit: contain;
}
.brand-text {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 2px;
  margin-bottom: 4px;
  color: #F5A623;
}
.sub { font-size: 11px; opacity: 0.8; letter-spacing: 1px; }
.title {
  text-align: center;
  font-weight: 800;
  font-size: 18px;
  color: #1A5F2B;
  margin: 16px 0;
}
.info {
  padding: 0 20px;
  font-size: 13px;
  line-height: 1.8;
  margin-bottom: 16px;
}
.info-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px dashed #e5e7eb;
}
.info-label { color: #6b7280; }
.info-value { font-weight: 600; color: #1A5F2B; }
table { width: 100%; border-collapse: collapse; margin: 16px 0; }
th { font-size: 12px; text-align: left; background: #F9FAFB; padding: 10px 12px; color: #6b7280; }
td { font-size: 13px; padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
.r { text-align: right; }
.totals { padding: 16px 20px; background: #F9FAFB; margin-top: 8px; }
.total-row { display: flex; justify-content: space-between; padding: 6px 0; }
.discount { color: #EF4444; font-weight: 700; }
.grand {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 2px solid #F5A623;
  font-size: 20px;
  font-weight: 800;
  color: #1A5F2B;
}
.footer {
  text-align: center;
  padding: 20px;
  background: #1A5F2B;
  color: #fff;
  font-size: 11px;
}
.powered { margin-top: 6px; font-weight: 700; color: #F5A623; }
.print-btn {
  display: block;
  width: calc(100% - 40px);
  max-width: 360px;
  margin: 20px auto;
  padding: 14px;
  background: linear-gradient(135deg, #F5A623, #D48A1A);
  color: #fff;
  border: none;
  border-radius: 50px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
}
@media print {
  body { background: #fff; padding: 0; }
  .bill { box-shadow: none; border-radius: 0; }
  .print-btn { display: none; }
  @page { margin: 0; }
}
</style>
</head>
<body>
  <div class="bill">
    <div class="header">
      ${logoHTML}
      <div class="sub">RESTAURANT BILLING SYSTEM</div>
    </div>

    <div class="title">🧾 FINAL BILL 🧾</div>

    <div class="info">
      <div class="info-row"><span class="info-label">Table Number</span><span class="info-value">${tableNumber}</span></div>
      <div class="info-row"><span class="info-label">Bill ID</span><span class="info-value">${billId}</span></div>
      <div class="info-row"><span class="info-label">Date & Time</span><span class="info-value">${timeStr}</span></div>
      <div class="info-row"><span class="info-label">Cashier</span><span class="info-value">${printCashierName}</span></div>
      <div class="info-row"><span class="info-label">Payment Mode</span><span class="info-value">Cash</span></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="r">Qty</th>
          <th class="r">Rate</th>
          <th class="r">Amount</th>
        </tr>
      </thead>

      <tbody>
        ${items
          .map(
            i => `
          <tr>
            <td>${i.name}</td>
            <td class="r">${i.quantity}</td>
            <td class="r">₨${Number(i.price).toFixed(0)}</td>
            <td class="r">₨${(Number(i.price) * Number(i.quantity)).toFixed(0)}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row"><span>Subtotal</span><strong>₨${subtotal.toFixed(2)}</strong></div>
      ${discountHTML}
      <div class="total-row grand"><span>TOTAL AMOUNT</span><span>₨${total.toFixed(2)}</span></div>
    </div>

    <div class="footer">
      Served by: <strong>${printCashierName}</strong><br/>
      Thank you for dining with us! 🎉<br/>
      <div class="powered">Powered by BillPak</div>
    </div>
  </div>

</body>
</html>`;
  };

  const saveSaleAndClearTable = async (billId: string, backendOrderResponse?: any) => {
    const printCashierName = await getPrintCashierName();

    const backendOrderId =
      backendOrderResponse?.id ||
      backendOrderResponse?.orderId ||
      backendOrderResponse?.data?.id ||
      null;

    const rec = {
      id: billId,
      backendOrderId,
      orderNumber:
        backendOrderResponse?.orderNumber ||
        backendOrderResponse?.data?.orderNumber ||
        null,
      inventoryDeducted:
        backendOrderResponse?.inventoryDeducted ||
        backendOrderResponse?.data?.inventoryDeducted ||
        false,
      inventoryMessage:
        backendOrderResponse?.inventoryMessage ||
        backendOrderResponse?.data?.inventoryMessage ||
        '',
      inventoryDebug:
        backendOrderResponse?.inventoryDebug ||
        backendOrderResponse?.data?.inventoryDebug ||
        null,
      tableId: String(tableId),
      tableNumber: String(tableNumber),
      items: items.map(item => ({
        productId: Number(item.productId),
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        isCustom: Boolean(item.isCustom),
      })),
      subtotal: Number(subtotal || 0),
      tax: 0,
      discount: {
        type: discountType,
        value: discountValue,
        amount: discountAmount,
      },
      total: Number(total || 0),
      type: 'dinein',
      cashierName: printCashierName,
      cashierId,
      timestamp: new Date().toISOString(),
    };

    console.log('DINE-IN SALE RECORD SAVED:', JSON.stringify(rec, null, 2));

    const ex = await AsyncStorage.getItem('sales_records');
    const arr = ex ? JSON.parse(ex) : [];

    arr.push(rec);

    await AsyncStorage.setItem('sales_records', JSON.stringify(arr));
    await AsyncStorage.removeItem(`kots_${tableId}`);
    await AsyncStorage.setItem(`table_${tableId}_status`, 'available');

    try {
      await api.put(`/restaurant/tables/${tableId}`, { status: 0 });
    } catch (e) {
      console.warn('API table update failed, local cleared:', e);
    }
  };


  const getRestaurantPrintInfo = async () => {
    const restaurantName = (await AsyncStorage.getItem('restaurant_name')) || 'BillPak';
    const restaurantAddress = (await AsyncStorage.getItem('restaurant_address')) || '';
    const restaurantLogo = (await AsyncStorage.getItem('restaurant_logo')) || '';

    return {
      restaurantName: restaurantName || 'BillPak',
      restaurantAddress: restaurantAddress || '',
      restaurantLogo: restaurantLogo || '',
    };
  };

  const printDineInInvoiceByPlatform = async (printPayload: any) => {
    if (Platform.OS === 'web') {
      const { printDineInInvoiceWeb } = require('../services/webPrinterService');
      await printDineInInvoiceWeb(printPayload);
      return true;
    }

    const { printDineInInvoiceDirect } = require('../services/printerService');
    await printDineInInvoiceDirect(printPayload);
    return true;
  };

  const handlePrintFinalBill = async () => {
    // ✅ Prevent double click / repeated print / duplicate order creation
    if (printLockRef.current || printing) {
      console.log('Print already running, duplicate blocked');
      Alert.alert('Printing', 'Final bill print already in progress. Please wait.');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Error', 'Bill mein koi item nahi');
      return;
    }

    printLockRef.current = true;
    setPrinting(true);
    try {
      const backendOrderResponse = await createBackendOrderForInventory();

      console.log(
        'DINE-IN INVENTORY RESULT:',
        JSON.stringify(backendOrderResponse, null, 2)
      );

      if (
        backendOrderResponse &&
        backendOrderResponse.skipped !== true &&
        backendOrderResponse.inventoryDeducted === false
      ) {
        Alert.alert(
          'Inventory Warning',
          backendOrderResponse.inventoryMessage ||
            'Bill complete hua, lekin inventory deduction failed.'
        );
      }

      const billId = 'BILL_' + Date.now();
      const printCashierName = await getPrintCashierName();
      const {
        restaurantName,
        restaurantAddress,
        restaurantLogo,
      } = await getRestaurantPrintInfo();

      await printDineInInvoiceByPlatform({
        restaurantName,
        restaurantAddress,
        restaurantLogo,
        billNo: billId,
        tableNumber: String(tableNumber),
        cashierName: printCashierName,
        items,
        subtotal,
        discountAmount,
        discountType,
        discountValue,
        total,
      });

      await saveSaleAndClearTable(billId, backendOrderResponse);

      setDiscountType('none');
      setDiscountValue('');

      Alert.alert(
        'Success',
        backendOrderResponse?.inventoryMessage || 'Final bill completed.'
      );

      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Final bill/order error:', err.response?.data || err.message);

      Alert.alert(
        'Error',
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Final bill complete nahi hua. Inventory minus nahi hui.'
      );
    } finally {
      // ✅ unlock after a short delay so accidental rapid taps cannot fire again
      setTimeout(() => {
        printLockRef.current = false;
        setPrinting(false);
      }, 1800);
    }
  };

  const DiscountSection = () => (
    <View style={styles.discountSection}>
      <Text style={styles.panelSectionTitle}>Discount</Text>

      {!showDiscountInput ? (
        <View style={styles.discountButtonsColumn}>
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
                <Text style={styles.removeDiscountBtnText}>Remove Discount</Text>
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

          <TextInput
            style={styles.discountInput}
            placeholder={discountType === 'percentage' ? 'e.g., 10' : 'e.g., 50'}
            keyboardType="numeric"
            value={discountValue}
            onChangeText={setDiscountValue}
            autoFocus
          />

          <View style={styles.discountInputActions}>
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
              ? `${discountValue}% discount applied (₨ ${discountAmount.toFixed(2)})`
              : `Rs. ${discountValue} discount applied`}
          </Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F5A623" />
        <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading bill...</Text>
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

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Table {tableNumber}</Text>
            <Text style={styles.headerSubtitle}>Final Bill • Cashier: {cashierName}</Text>
          </View>

          <View style={styles.headerRight} />
        </LinearGradient>

        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        ) : (
          <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentScrollInner}>
            <View style={[styles.billLayout, !isWide && styles.billLayoutMobile]}>
              <View style={styles.leftPanel}>
                <View style={styles.billInfoCard}>
                  <Text style={styles.panelSectionTitle}>Bill Details</Text>
                  <View style={styles.infoLine}>
                    <Text style={styles.infoLabel}>Table</Text>
                    <Text style={styles.infoValue}>Table {tableNumber}</Text>
                  </View>
                  <View style={styles.infoLine}>
                    <Text style={styles.infoLabel}>Cashier</Text>
                    <Text style={styles.infoValue}>{cashierName}</Text>
                  </View>
                  <View style={styles.infoLine}>
                    <Text style={styles.infoLabel}>Items</Text>
                    <Text style={styles.infoValue}>{items.reduce((s, i) => s + Number(i.quantity), 0)}</Text>
                  </View>
                </View>

                <View style={styles.itemsContainer}>
                  <View style={styles.itemsHeader}>
                    <Text style={styles.itemsHeaderText}>Item</Text>
                    <Text style={styles.itemsHeaderQty}>Qty</Text>
                    <Text style={styles.itemsHeaderAmount}>Amount</Text>
                    <View style={{ width: 40 }} />
                  </View>

                  {items.map((item, idx) => (
                    <View key={`${item.productId}-${idx}`} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemPrice}>₨ {item.price} / unit</Text>
                      </View>

                      <View style={styles.itemQtyControl}>
                        <TouchableOpacity onPress={() => adjustQuantity(idx, -1)}>
                          <Ionicons name="remove-circle" size={24} color="#EF4444" />
                        </TouchableOpacity>

                        <Text style={styles.itemQtyNum}>{item.quantity}</Text>

                        <TouchableOpacity onPress={() => adjustQuantity(idx, 1)}>
                          <Ionicons name="add-circle" size={24} color="#1A5F2B" />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.itemAmount}>
                        ₨ {(Number(item.price) * Number(item.quantity)).toFixed(2)}
                      </Text>

                      <TouchableOpacity onPress={() => removeItem(idx)} style={styles.itemDelete}>
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.rightPanel}>
                <Text style={styles.panelSectionTitle}>Bill Summary</Text>

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>₨ {subtotal.toFixed(2)}</Text>
                </View>

                <DiscountSection />

                {discountAmount > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: '#EF4444' }]}>Discount</Text>
                    <Text style={[styles.totalValue, { color: '#EF4444' }]}>- ₨ {discountAmount.toFixed(2)}</Text>
                  </View>
                )}

                <LinearGradient colors={['#FEF3C7', '#FFFBEB']} style={styles.grandTotalRow}>
                  <Text style={styles.grandTotalLabel}>Total Amount</Text>
                  <Text style={styles.grandTotalValue}>₨ {total.toFixed(2)}</Text>
                </LinearGradient>

                <TouchableOpacity
                  style={[styles.printBtn, printing && styles.printBtnDisabled]}
                  onPress={handlePrintFinalBill}
                  disabled={printing || printLockRef.current}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.printGradient}>
                    <Ionicons name="print-outline" size={22} color="#FFFFFF" />
                    <Text style={styles.printBtnText}>
                      {printing ? 'Printing...' : 'View / Print Final Bill'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Direct final-bill print is handled by the main button. Confirmation modal removed. */}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backBtn: {
    padding: 8,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#F5A623',
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 12,
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollInner: {
    padding: 16,
    paddingBottom: 30,
  },
  billLayout: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  billLayoutMobile: {
    flexDirection: 'column',
  },
  leftPanel: {
    flex: 2,
    gap: 14,
    width: '100%',
  },
  rightPanel: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  billInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  panelSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  infoLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 8,
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  infoValue: {
    color: '#1A5F2B',
    fontSize: 13,
    fontWeight: '800',
  },
  itemsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  itemsHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  itemsHeaderText: {
    flex: 2,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  itemsHeaderQty: {
    width: 90,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  itemsHeaderAmount: {
    width: 90,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'right',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemInfo: {
    flex: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemPrice: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  itemQtyControl: {
    width: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  itemQtyNum: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F2937',
    minWidth: 24,
    textAlign: 'center',
  },
  itemAmount: {
    width: 90,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'right',
  },
  itemDelete: {
    width: 40,
    alignItems: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  grandTotalRow: {
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D97706',
  },
  grandTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F5A623',
    marginTop: 5,
  },
  discountSection: {
    marginVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 12,
  },
  discountButtonsColumn: {
    gap: 10,
  },
  discountBtn: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  discountBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 6,
  },
  discountBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  removeDiscountBtn: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  removeDiscountGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 6,
  },
  removeDiscountBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  discountInputContainer: {
    gap: 8,
  },
  discountInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  discountInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#111827',
  },
  discountInputActions: {
    flexDirection: 'row',
    gap: 10,
  },
  applyDiscountBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  applyDiscountGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  applyDiscountBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  cancelDiscountBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cancelDiscountGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
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
    padding: 9,
    borderRadius: 10,
    marginTop: 10,
  },
  appliedDiscountText: {
    fontSize: 12,
    color: '#1A5F2B',
    fontWeight: '600',
    flex: 1,
  },
  printBtn: {
    marginTop: 16,
    borderRadius: 50,
    overflow: 'hidden',
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  printBtnDisabled: {
    opacity: 0.6,
  },
  printGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  printBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  confirmIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#FEF3C7',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
  },
  confirmSmallAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 2,
  },
  confirmDiscount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
    marginTop: 2,
  },
  confirmAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F5A623',
    marginTop: 4,
  },
  confirmSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  confirmPrintBtn: {
    borderRadius: 50,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 12,
  },
  confirmPrintBtnDisabled: {
    opacity: 0.6,
  },
  confirmPrintGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  confirmPrintText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  cancelText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});
