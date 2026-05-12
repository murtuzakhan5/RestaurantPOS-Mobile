import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Platform,
  Alert,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import api from '../services/api';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

interface SaleItem {
  productId?: number;
  name: string;
  quantity: number;
  price: number;
}

interface SaleRecord {
  id: string;
  backendOrderId?: number | null;
  orderNumber?: string | null;
  inventoryDeducted?: boolean;
  tableNumber?: string;
  items: SaleItem[];
  subtotal: number;
  tax?: number;
  total: number;
  timestamp: string;
  type: 'dinein' | 'takeaway';
  cashierName?: string;
  cashierId?: number | null;
}

interface ProductSummary {
  name: string;
  quantity: number;
  totalAmount: number;
}

interface CashierSummary {
  cashierName: string;
  cashierId?: number | null;
  totalSale: number;
  grossSale: number;
  tax: number;
  orders: number;
  dineinSale: number;
  dineinOrders: number;
  takeawaySale: number;
  takeawayOrders: number;
}

type FilterType = 'all' | 'dinein' | 'takeaway';

export default function SalesReportScreen() {
  const today = new Date();

  const [salesData, setSalesData] = useState<SaleRecord[]>([]);
  const [filteredData, setFilteredData] = useState<SaleRecord[]>([]);
  const [productSummary, setProductSummary] = useState<ProductSummary[]>([]);
  const [cashierSummary, setCashierSummary] = useState<CashierSummary[]>([]);
  const [selectedType, setSelectedType] = useState<FilterType>('all');
  const [selectedCashier, setSelectedCashier] = useState<string>('all');
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
  );

  const [endDate, setEndDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
  );

  useEffect(() => {
    loadSalesData();
  }, []);

  useEffect(() => {
    filterData();
  }, [startDate, endDate, salesData, selectedType, selectedCashier]);

  const loadSalesData = async () => {
    try {
      const savedSales = await AsyncStorage.getItem('sales_records');
      const parsed = savedSales ? JSON.parse(savedSales) : [];

      const validSales = Array.isArray(parsed)
        ? parsed.filter((sale: SaleRecord) => !((sale as any).isCancelled))
        : [];

      setSalesData(validSales);
    } catch (error) {
      console.error('Error loading sales:', error);
      setSalesData([]);
    }
  };

  const getCashierName = (sale: SaleRecord) => {
    return sale.cashierName?.trim() || 'Unknown Cashier';
  };

  const getCashierKey = (sale: SaleRecord) => {
    const name = getCashierName(sale);
    const id = sale.cashierId ?? '';
    return `${id}-${name}`;
  };

  const getBackendOrderId = (sale: SaleRecord) => {
    const id =
      sale.backendOrderId ||
      (sale as any).backendId ||
      (sale as any).orderId ||
      null;

    if (!id) return null;

    const numericId = Number(id);

    return Number.isNaN(numericId) || numericId <= 0 ? null : numericId;
  };

  const setTodayRange = () => {
    const now = new Date();
    const newStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const newEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    setStartDate(newStart);
    setEndDate(newEnd);
    console.log('Today range set:', newStart, newEnd);
  };

  const setLast7DaysRange = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    const newStart = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
    const newEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    setStartDate(newStart);
    setEndDate(newEnd);
    console.log('Last 7 days range set:', newStart, newEnd);
  };

  const buildCashierSummary = (records: SaleRecord[]) => {
    const summary: Record<string, CashierSummary> = {};

    records.forEach(sale => {
      const cashierName = getCashierName(sale);
      const key = getCashierKey(sale);
      const total = Number(sale.total || 0);
      const subtotal = Number(sale.subtotal || 0);
      const tax = Number(sale.tax || 0);

      if (!summary[key]) {
        summary[key] = {
          cashierName,
          cashierId: sale.cashierId ?? null,
          totalSale: 0,
          grossSale: 0,
          tax: 0,
          orders: 0,
          dineinSale: 0,
          dineinOrders: 0,
          takeawaySale: 0,
          takeawayOrders: 0,
        };
      }

      summary[key].totalSale += total;
      summary[key].grossSale += subtotal;
      summary[key].tax += tax;
      summary[key].orders += 1;

      if (sale.type === 'dinein') {
        summary[key].dineinSale += total;
        summary[key].dineinOrders += 1;
      }

      if (sale.type === 'takeaway') {
        summary[key].takeawaySale += total;
        summary[key].takeawayOrders += 1;
      }
    });

    return Object.values(summary).sort((a, b) => b.totalSale - a.totalSale);
  };

  const filterData = () => {
    console.log('Filtering data with dates:', startDate, endDate);
    console.log('Total sales data:', salesData.length);

    const dateAndTypeFiltered = salesData.filter(sale => {
      const saleDate = new Date(sale.timestamp);
      const dateOk = saleDate >= startDate && saleDate <= endDate;
      const typeOk = selectedType === 'all' || sale.type === selectedType;
      return dateOk && typeOk;
    });

    console.log('Date and type filtered:', dateAndTypeFiltered.length);

    const cashierWise = buildCashierSummary(dateAndTypeFiltered);
    setCashierSummary(cashierWise);

    const finalFiltered = dateAndTypeFiltered.filter(sale => {
      if (selectedCashier === 'all') return true;
      return getCashierKey(sale) === selectedCashier;
    });

    setFilteredData(finalFiltered);

    const summary: { [key: string]: ProductSummary } = {};

    finalFiltered.forEach(sale => {
      sale.items.forEach(item => {
        const name = item.name;
        const qty = Number(item.quantity);
        const price = Number(item.price);

        if (!summary[name]) {
          summary[name] = {
            name,
            quantity: 0,
            totalAmount: 0,
          };
        }

        summary[name].quantity += qty;
        summary[name].totalAmount += price * qty;
      });
    });

    setProductSummary(
      Object.values(summary).sort((a, b) => b.totalAmount - a.totalAmount)
    );
  };

  const getTotals = (records: SaleRecord[]) => {
    return records.reduce(
      (acc, sale) => ({
        subtotal: acc.subtotal + Number(sale.subtotal || 0),
        tax: acc.tax + Number(sale.tax || 0),
        total: acc.total + Number(sale.total || 0),
        orders: acc.orders + 1,
      }),
      { subtotal: 0, tax: 0, total: 0, orders: 0 }
    );
  };

  const totals = getTotals(filteredData);
  const dineInTotals = getTotals(filteredData.filter(s => s.type === 'dinein'));
  const takeawayTotals = getTotals(filteredData.filter(s => s.type === 'takeaway'));

  const saveCancelledRecord = async (
    sale: SaleRecord,
    backendResponse: any,
    stockReversed: boolean
  ) => {
    try {
      const existing = await AsyncStorage.getItem('cancelled_sales_records');
      const records = existing ? JSON.parse(existing) : [];

      const cancelledRecord = {
        ...sale,
        isCancelled: true,
        cancelledAt: new Date().toISOString(),
        backendCancelResponse: backendResponse || null,
        stockReversed,
      };

      records.push(cancelledRecord);

      await AsyncStorage.setItem(
        'cancelled_sales_records',
        JSON.stringify(records)
      );
    } catch (error) {
      console.log('Cancelled record save error:', error);
    }
  };

  const removeSaleFromLocalReport = async (saleId: string) => {
    const updated = salesData.filter(sale => sale.id !== saleId);
    await AsyncStorage.setItem('sales_records', JSON.stringify(updated));
    setSalesData(updated);
  };

  const performDeleteSaleRecord = async (sale: SaleRecord) => {
    try {
      setCancelingId(sale.id);

      const backendOrderId = getBackendOrderId(sale);
      let backendResponse: any = null;
      let stockReversed = false;

      if (backendOrderId) {
        console.log('Cancelling backend order:', backendOrderId, sale.id);

        const response = await api.post(`/restaurant/orders/${backendOrderId}/cancel`, {
          reason: 'Deleted from sales report because order was created by mistake',
          localSaleId: sale.id,
        });

        backendResponse = response.data;
        stockReversed = Number(response.data?.reversedRows || 0) > 0;

        console.log('Cancel order response:', response.data);
      } else {
        console.log('No backendOrderId found. Local sale delete only:', sale.id);
      }

      await saveCancelledRecord(sale, backendResponse, stockReversed);
      await removeSaleFromLocalReport(sale.id);

      if (backendOrderId) {
        Alert.alert(
          'Order Cancelled',
          backendResponse?.message ||
            'Order deleted from report and inventory reversed successfully.'
        );
      } else {
        Alert.alert(
          'Local Order Deleted',
          'Ye old/local record tha. Ismein backend order id saved nahi thi, isliye stock reverse nahi ho saka. Amount total sale se remove ho gaya.'
        );
      }
    } catch (error: any) {
      console.error('Cancel/delete order error:', error.response?.data || error.message);

      Alert.alert(
        'Error',
        error.response?.data?.message ||
          error.response?.data?.error ||
          'Order cancel/delete nahi ho saka. Stock reverse bhi nahi hua.'
      );
    } finally {
      setCancelingId(null);
    }
  };

  const deleteSaleRecord = (sale: SaleRecord) => {
    const backendOrderId = getBackendOrderId(sale);

    const message = backendOrderId
      ? `Ye order backend se cancel hoga, inventory stock reverse hoga, aur amount total sale se remove ho jayega.\n\nBill: ${sale.id}\nBackend Order ID: ${backendOrderId}\nTotal: Rs ${Number(sale.total || 0).toFixed(2)}`
      : `Is record mein backend order id saved nahi hai. Ye sirf local sales report se delete hoga aur amount total sale se remove ho jayega. Stock reverse nahi ho sakta.\n\nBill: ${sale.id}\nTotal: Rs ${Number(sale.total || 0).toFixed(2)}`;

    if (Platform.OS === 'web') {
      const confirmed = (globalThis as any).confirm
        ? (globalThis as any).confirm(message)
        : true;

      if (confirmed) {
        performDeleteSaleRecord(sale);
      }

      return;
    }

    Alert.alert('Delete / Cancel Order?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: backendOrderId ? 'Cancel Order' : 'Delete Local',
        style: 'destructive',
        onPress: () => performDeleteSaleRecord(sale),
      },
    ]);
  };

  const exportCSV = (recordsToExport = filteredData, namePrefix = 'sales-report') => {
    if (recordsToExport.length === 0) {
      Alert.alert('No Data', 'Selected date range mein koi sale nahi hai');
      return;
    }

    let csv =
      'Bill ID,Backend Order ID,Order Number,Date,Cashier,Type,Table,Product,Qty,Price,Item Total,Bill Subtotal,Tax,Bill Total\n';

    recordsToExport.forEach(sale => {
      sale.items.forEach(item => {
        const row = [
          sale.id,
          getBackendOrderId(sale) || '',
          sale.orderNumber || '',
          new Date(sale.timestamp).toLocaleString('en-PK'),
          getCashierName(sale),
          sale.type === 'dinein' ? 'Dine-In' : 'Takeaway',
          sale.tableNumber || '',
          item.name,
          item.quantity,
          item.price,
          Number(item.price) * Number(item.quantity),
          sale.subtotal || 0,
          sale.tax || 0,
          sale.total || 0,
        ];

        csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
      });
    });

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${namePrefix}-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      Alert.alert(
        'Export Ready',
        'Mobile export ke liye file-system package add karna hoga. Web par CSV direct download hogi.'
      );
    }
  };

  const exportTodayCSV = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const todayRecords = salesData.filter(sale => {
      const saleDate = new Date(sale.timestamp);
      const dateOk = saleDate >= todayStart && saleDate <= todayEnd;
      const typeOk = selectedType === 'all' || sale.type === selectedType;
      const cashierOk = selectedCashier === 'all' || getCashierKey(sale) === selectedCashier;
      return dateOk && typeOk && cashierOk;
    });

    exportCSV(todayRecords, 'daily-sales-report');
  };

  const exportCashierCSV = (cashierKey: string, cashierName: string) => {
    const records = salesData.filter(sale => {
      const saleDate = new Date(sale.timestamp);
      const dateOk = saleDate >= startDate && saleDate <= endDate;
      const typeOk = selectedType === 'all' || sale.type === selectedType;
      const cashierOk = getCashierKey(sale) === cashierKey;
      return dateOk && typeOk && cashierOk;
    });

    exportCSV(records, `cashier-${cashierName.replace(/\s+/g, '-').toLowerCase()}-sales`);
  };

  // FIXED: Date picker with proper state updates
  const handleStartDateChange = (dateString: string) => {
    const date = new Date(dateString);
    const newStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    setStartDate(newStart);
    console.log('Start date changed:', newStart);
  };

  const handleEndDateChange = (dateString: string) => {
    const date = new Date(dateString);
    const newEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    setEndDate(newEnd);
    console.log('End date changed:', newEnd);
  };

  const FilterButton = ({ title, value }: { title: string; value: FilterType }) => (
    <TouchableOpacity
      style={[styles.filterBtn, selectedType === value && styles.filterBtnActive]}
      onPress={() => setSelectedType(value)}
    >
      <Text style={[styles.filterBtnText, selectedType === value && styles.filterBtnTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const CashierFilterButton = ({ title, value }: { title: string; value: string }) => (
    <TouchableOpacity
      style={[styles.cashierFilterBtn, selectedCashier === value && styles.cashierFilterBtnActive]}
      onPress={() => setSelectedCashier(value)}
    >
      <Ionicons
        name="person-outline"
        size={14}
        color={selectedCashier === value ? '#fff' : '#1A5F2B'}
      />
      <Text
        style={[
          styles.cashierFilterText,
          selectedCashier === value && styles.cashierFilterTextActive,
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-PK', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderSaleCard = ({ item }: { item: SaleRecord }) => {
    const backendOrderId = getBackendOrderId(item);
    const isCanceling = cancelingId === item.id;

    return (
      <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.saleCard}>
        <View style={styles.saleCardHeader}>
          <View style={styles.saleInfo}>
            <Text style={styles.saleId}>{item.id.slice(-12)}</Text>
            {!!item.orderNumber && (
              <View style={styles.orderBadge}>
                <Ionicons name="receipt-outline" size={10} color="#F5A623" />
                <Text style={styles.orderNumberText}>Order: {item.orderNumber}</Text>
              </View>
            )}
            {backendOrderId ? (
              <View style={styles.backendBadge}>
                <Ionicons name="cloud-done-outline" size={10} color="#22C55E" />
                <Text style={styles.backendText}>Backend ID: {backendOrderId}</Text>
              </View>
            ) : (
              <View style={styles.warningBadge}>
                <Ionicons name="warning-outline" size={10} color="#EF4444" />
                <Text style={styles.warningText}>Local only</Text>
              </View>
            )}
            <Text style={styles.saleDate}>{formatDateTime(item.timestamp)}</Text>
            <View style={styles.cashierChip}>
              <Ionicons name="person-outline" size={10} color="#1A5F2B" />
              <Text style={styles.cashierText}>{getCashierName(item)}</Text>
            </View>
          </View>

          <View style={styles.saleActions}>
            <View style={[styles.typeChip, item.type === 'dinein' ? styles.dineinChip : styles.takeawayChip]}>
              <Ionicons name={item.type === 'dinein' ? 'restaurant' : 'cart'} size={12} color="#FFF" />
              <Text style={styles.typeChipText}>{item.type === 'dinein' ? 'Dine-In' : 'Takeaway'}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }, isCanceling && { opacity: 0.5 }]}
              disabled={isCanceling}
              onPress={() => deleteSaleRecord(item)}
            >
              {isCanceling ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="trash-outline" size={18} color="#FFF" />
              )}
            </Pressable>
          </View>
        </View>

        {item.type === 'dinein' && (
          <View style={styles.tableRow}>
            <Ionicons name="table-landscape" size={14} color="#F5A623" />
            <Text style={styles.tableText}>Table: {item.tableNumber || '-'}</Text>
          </View>
        )}

        <View style={styles.itemsContainer}>
          {item.items.map((food, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.itemName}>{food.name}</Text>
              <Text style={styles.itemQty}>x{food.quantity}</Text>
              <Text style={styles.itemAmount}>₨ {(Number(food.price) * Number(food.quantity)).toFixed(0)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Bill Total</Text>
          <Text style={styles.totalAmount}>₨ {Number(item.total).toFixed(2)}</Text>
        </View>
      </LinearGradient>
    );
  };

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
            <Text style={styles.headerTitle}>Sales Report</Text>
            <TouchableOpacity onPress={loadSalesData} style={styles.refreshBtn}>
              <Ionicons name="refresh" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>Track your business performance</Text>
        </LinearGradient>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Date Range Card - FIXED */}
          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.dateCard}>
            <Text style={styles.cardTitle}>📅 Date Range</Text>
            <View style={styles.quickButtons}>
              <TouchableOpacity style={styles.quickBtn} onPress={setTodayRange}>
                <Text style={styles.quickBtnText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={setLast7DaysRange}>
                <Text style={styles.quickBtnText}>Last 7 Days</Text>
              </TouchableOpacity>
            </View>
            
            {/* FIXED: Web Date Pickers */}
            {Platform.OS === 'web' ? (
              <View style={styles.webDateRow}>
                <View style={styles.webDatePicker}>
                  <Text style={styles.dateLabel}>From</Text>
                  <input
                    type="date"
                    value={startDate.toISOString().split('T')[0]}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid #E2E8F0',
                      fontSize: 14,
                      backgroundColor: '#F8FAFC',
                      fontFamily: 'inherit',
                    }}
                  />
                </View>
                <View style={styles.webDatePicker}>
                  <Text style={styles.dateLabel}>To</Text>
                  <input
                    type="date"
                    value={endDate.toISOString().split('T')[0]}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid #E2E8F0',
                      fontSize: 14,
                      backgroundColor: '#F8FAFC',
                      fontFamily: 'inherit',
                    }}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.dateRangeBox}>
                <View style={styles.dateBox}>
                  <Ionicons name="calendar-outline" size={16} color="#1A5F2B" />
                  <Text style={styles.dateText}>{startDate.toLocaleDateString()}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color="#94A3B8" />
                <View style={styles.dateBox}>
                  <Ionicons name="calendar-outline" size={16} color="#1A5F2B" />
                  <Text style={styles.dateText}>{endDate.toLocaleDateString()}</Text>
                </View>
              </View>
            )}
          </LinearGradient>

          {/* Export Buttons */}
          <View style={styles.exportRow}>
            <TouchableOpacity style={styles.exportBtnPrimary} onPress={() => exportCSV()}>
              <Ionicons name="download-outline" size={18} color="#FFF" />
              <Text style={styles.exportBtnText}>Export Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtnSecondary} onPress={exportTodayCSV}>
              <Ionicons name="today-outline" size={18} color="#1A5F2B" />
              <Text style={styles.exportBtnSecondaryText}>Daily</Text>
            </TouchableOpacity>
          </View>

          {/* Order Type Filters */}
          <View style={styles.filterRow}>
            <FilterButton title="All Orders" value="all" />
            <FilterButton title="Dine-In" value="dinein" />
            <FilterButton title="Takeaway" value="takeaway" />
          </View>

          {/* Stats Cards */}
          <View style={styles.statsGrid}>
            <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.statCardPrimary}>
              <Ionicons name="receipt-outline" size={22} color="#FFF" opacity={0.8} />
              <Text style={styles.statLabelWhite}>Total Orders</Text>
              <Text style={styles.statValueWhite}>{totals.orders}</Text>
            </LinearGradient>
            <View style={styles.statCard}>
              <Ionicons name="cash-outline" size={22} color="#1A5F2B" />
              <Text style={styles.statLabel}>Gross Sale</Text>
              <Text style={styles.statValue}>₨{totals.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="document-text-outline" size={22} color="#F5A623" />
              <Text style={styles.statLabel}>Tax</Text>
              <Text style={styles.statValue}>₨{totals.tax.toFixed(2)}</Text>
            </View>
            <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.statCardGold}>
              <Ionicons name="wallet-outline" size={22} color="#FFF" />
              <Text style={styles.statLabelWhite}>Net Total</Text>
              <Text style={styles.statValueWhite}>₨{totals.total.toFixed(2)}</Text>
            </LinearGradient>
          </View>

          {/* Split Cards */}
          <View style={styles.splitRow}>
            <View style={styles.splitCard}>
              <View style={[styles.splitIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="restaurant" size={22} color="#1A5F2B" />
              </View>
              <Text style={styles.splitTitle}>Dine-In</Text>
              <Text style={styles.splitAmount}>₨{dineInTotals.total.toFixed(2)}</Text>
              <Text style={styles.splitOrders}>{dineInTotals.orders} bills</Text>
            </View>
            <View style={styles.splitCard}>
              <View style={[styles.splitIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="cart" size={22} color="#F5A623" />
              </View>
              <Text style={styles.splitTitle}>Takeaway</Text>
              <Text style={styles.splitAmount}>₨{takeawayTotals.total.toFixed(2)}</Text>
              <Text style={styles.splitOrders}>{takeawayTotals.orders} bills</Text>
            </View>
          </View>

          {/* Cashier Filter */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>👥 Cashier Filter</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cashierFiltersContainer}>
              <CashierFilterButton title="All Cashiers" value="all" />
              {cashierSummary.map(cashier => {
                const key = `${cashier.cashierId ?? ''}-${cashier.cashierName}`;
                return (
                  <CashierFilterButton key={key} title={cashier.cashierName} value={key} />
                );
              })}
            </ScrollView>
          </View>

          {/* Cashier Performance */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📊 Cashier Performance</Text>
            {cashierSummary.length === 0 ? (
              <Text style={styles.emptyText}>No cashier data</Text>
            ) : (
              cashierSummary.map((cashier, idx) => (
                <View key={idx} style={styles.cashierCard}>
                  <View style={styles.cashierHeader}>
                    <View style={styles.cashierAvatar}>
                      <Text style={styles.cashierAvatarText}>{cashier.cashierName.charAt(0)}</Text>
                    </View>
                    <View style={styles.cashierInfo}>
                      <Text style={styles.cashierName}>{cashier.cashierName}</Text>
                      <Text style={styles.cashierOrders}>{cashier.orders} orders</Text>
                    </View>
                    <Text style={styles.cashierTotal}>₨{cashier.totalSale.toFixed(0)}</Text>
                    <TouchableOpacity
                      style={styles.cashierExportBtn}
                      onPress={() => exportCashierCSV(`${cashier.cashierId ?? ''}-${cashier.cashierName}`, cashier.cashierName)}
                    >
                      <Ionicons name="download-outline" size={16} color="#1A5F2B" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cashierStats}>
                    <View style={styles.cashierStat}>
                      <Text style={styles.cashierStatLabel}>Dine-In</Text>
                      <Text style={styles.cashierStatValue}>₨{cashier.dineinSale.toFixed(0)}</Text>
                      <Text style={styles.cashierStatSub}>{cashier.dineinOrders} bills</Text>
                    </View>
                    <View style={styles.cashierStat}>
                      <Text style={styles.cashierStatLabel}>Takeaway</Text>
                      <Text style={styles.cashierStatValue}>₨{cashier.takeawaySale.toFixed(0)}</Text>
                      <Text style={styles.cashierStatSub}>{cashier.takeawayOrders} bills</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Product Sales */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🍔 Top Selling Products</Text>
            <View style={styles.productHeader}>
              <Text style={styles.productHeaderNo}>#</Text>
              <Text style={styles.productHeaderName}>Product</Text>
              <Text style={styles.productHeaderQty}>Qty</Text>
              <Text style={styles.productHeaderAmount}>Amount</Text>
            </View>
            {productSummary.length === 0 ? (
              <Text style={styles.emptyText}>No product data</Text>
            ) : (
              productSummary.slice(0, 10).map((item, idx) => (
                <View key={idx} style={styles.productRow}>
                  <Text style={styles.productNo}>{idx + 1}</Text>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productQty}>{item.quantity}</Text>
                  <Text style={styles.productAmount}>₨{item.totalAmount.toFixed(0)}</Text>
                </View>
              ))
            )}
          </View>

          {/* Bills Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🧾 Recent Bills</Text>
            {filteredData.length === 0 ? (
              <Text style={styles.emptyText}>No bills found</Text>
            ) : (
              filteredData.map((item, idx) => (
                <View key={idx}>{renderSaleCard({ item })}</View>
              ))
            )}
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { paddingTop: Platform.OS === 'ios' ? 55 : 40, paddingHorizontal: 20, paddingBottom: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerSubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 4, paddingLeft: 8 },
  scroll: { flex: 1 },
  dateCard: { margin: 16, padding: 16, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  quickButtons: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  quickBtn: { backgroundColor: '#E8F5E9', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 25 },
  quickBtnText: { color: '#1A5F2B', fontWeight: '600', fontSize: 13 },
  webDateRow: { flexDirection: 'row', gap: 12 },
  webDatePicker: { flex: 1 },
  dateLabel: { fontSize: 12, color: '#64748B', marginBottom: 4, fontWeight: '500' },
  dateRangeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 14 },
  dateBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  dateText: { fontSize: 13, color: '#0F172A', fontWeight: '500' },
  exportRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  exportBtnPrimary: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1A5F2B', paddingVertical: 12, borderRadius: 14 },
  exportBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  exportBtnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF', paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#1A5F2B' },
  exportBtnSecondaryText: { color: '#1A5F2B', fontWeight: '700', fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  filterBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: '#FFF' },
  filterBtnActive: { backgroundColor: '#1A5F2B' },
  filterBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filterBtnTextActive: { color: '#FFF' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  statCardPrimary: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 16, alignItems: 'center', gap: 6 },
  statCardGold: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 16, alignItems: 'center', gap: 6 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#FFF', padding: 14, borderRadius: 16, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statLabelWhite: { fontSize: 12, color: '#FFF', opacity: 0.9 },
  statValueWhite: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 12, color: '#64748B' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  splitRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 16 },
  splitCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  splitIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  splitTitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  splitAmount: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  splitOrders: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  sectionCard: { backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 14 },
  emptyText: { textAlign: 'center', color: '#94A3B8', paddingVertical: 20 },
  cashierFiltersContainer: { paddingHorizontal: 4, gap: 8 },
  cashierFilterBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 25, marginRight: 8, gap: 6 },
  cashierFilterBtnActive: { backgroundColor: '#1A5F2B' },
  cashierFilterText: { color: '#1A5F2B', fontSize: 12, fontWeight: '600' },
  cashierFilterTextActive: { color: '#FFF' },
  cashierCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginBottom: 12 },
  cashierHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cashierAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A5F2B', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cashierAvatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  cashierInfo: { flex: 1 },
  cashierName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cashierOrders: { fontSize: 11, color: '#64748B', marginTop: 2 },
  cashierTotal: { fontSize: 18, fontWeight: '800', color: '#1A5F2B', marginRight: 12 },
  cashierExportBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  cashierStats: { flexDirection: 'row', gap: 12 },
  cashierStat: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 10, alignItems: 'center' },
  cashierStatLabel: { fontSize: 11, color: '#64748B' },
  cashierStatValue: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 4 },
  cashierStatSub: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  productHeader: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 8 },
  productHeaderNo: { width: 40, fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  productHeaderName: { flex: 1, fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  productHeaderQty: { width: 60, fontSize: 12, fontWeight: '600', color: '#94A3B8', textAlign: 'right' },
  productHeaderAmount: { width: 80, fontSize: 12, fontWeight: '600', color: '#94A3B8', textAlign: 'right' },
  productRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  productNo: { width: 40, fontSize: 14, color: '#64748B' },
  productName: { flex: 1, fontSize: 14, fontWeight: '500', color: '#0F172A' },
  productQty: { width: 60, fontSize: 14, fontWeight: '600', color: '#1A5F2B', textAlign: 'right' },
  productAmount: { width: 80, fontSize: 14, fontWeight: '600', color: '#0F172A', textAlign: 'right' },
  saleCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  saleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  saleInfo: { flex: 1 },
  saleId: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  orderBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  orderNumberText: { fontSize: 11, color: '#F5A623', fontWeight: '500' },
  backendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  backendText: { fontSize: 11, color: '#22C55E', fontWeight: '500' },
  warningBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  warningText: { fontSize: 11, color: '#EF4444', fontWeight: '500' },
  saleDate: { fontSize: 11, color: '#94A3B8', marginBottom: 2 },
  cashierChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cashierText: { fontSize: 11, color: '#1A5F2B', fontWeight: '600' },
  saleActions: { alignItems: 'flex-end', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dineinChip: { backgroundColor: '#1A5F2B' },
  takeawayChip: { backgroundColor: '#F5A623' },
  typeChipText: { fontSize: 11, fontWeight: '600', color: '#FFF' },
  deleteBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  tableText: { fontSize: 12, color: '#F5A623', fontWeight: '500' },
  itemsContainer: { marginBottom: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  itemName: { fontSize: 13, color: '#475569', flex: 1 },
  itemQty: { width: 45, textAlign: 'right', fontSize: 13, color: '#1A5F2B', fontWeight: '600' },
  itemAmount: { width: 70, textAlign: 'right', fontSize: 13, color: '#0F172A', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  totalAmount: { fontSize: 18, fontWeight: '800', color: '#F5A623' },
});