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
} from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

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
    setStartDate(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
    setEndDate(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
  };

  const setLast7DaysRange = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 6);

    setStartDate(new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0));
    setEndDate(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
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
    const dateAndTypeFiltered = salesData.filter(sale => {
      const saleDate = new Date(sale.timestamp);
      const dateOk = saleDate >= startDate && saleDate <= endDate;
      const typeOk = selectedType === 'all' || sale.type === selectedType;
      return dateOk && typeOk;
    });

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

  const WebDatePicker = ({ value, onChange, label }: any) => (
    <View style={styles.webDatePicker}>
      <Text style={styles.dateLabel}>{label}</Text>
      <input
        type="date"
        value={value.toISOString().split('T')[0]}
        onChange={(e: any) => {
          const date = new Date(e.target.value);

          if (label === 'From') {
            onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
          } else {
            onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59));
          }
        }}
        style={{
          padding: 9,
          borderRadius: 8,
          border: '1px solid #ddd',
          fontSize: 14,
          width: '100%',
        }}
      />
    </View>
  );

  const FilterButton = ({ title, value }: { title: string; value: FilterType }) => (
    <TouchableOpacity
      style={[
        styles.filterBtn,
        selectedType === value && styles.filterBtnActive,
      ]}
      onPress={() => setSelectedType(value)}
    >
      <Text
        style={[
          styles.filterBtnText,
          selectedType === value && styles.filterBtnTextActive,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  const CashierFilterButton = ({ title, value }: { title: string; value: string }) => (
    <TouchableOpacity
      style={[
        styles.cashierFilterBtn,
        selectedCashier === value && styles.cashierFilterBtnActive,
      ]}
      onPress={() => setSelectedCashier(value)}
    >
      <Ionicons
        name="person-outline"
        size={14}
        color={selectedCashier === value ? '#fff' : '#4a55a2'}
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
      <View style={styles.saleCard}>
        <View style={styles.saleTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.saleId}>{item.id}</Text>

            {!!item.orderNumber && (
              <Text style={styles.orderNumberText}>Order: {item.orderNumber}</Text>
            )}

            {backendOrderId ? (
              <Text style={styles.backendText}>Backend ID: {backendOrderId}</Text>
            ) : (
              <Text style={styles.warningText}>Old/local record: no backend id</Text>
            )}

            <Text style={styles.saleDate}>{formatDateTime(item.timestamp)}</Text>
            <Text style={styles.cashierText}>Cashier: {getCashierName(item)}</Text>
          </View>

          <View style={styles.saleActions}>
            <View
              style={[
                styles.typeBadge,
                item.type === 'dinein' ? styles.dineinBadge : styles.takeawayBadge,
              ]}
            >
              <Text style={styles.typeBadgeText}>
                {item.type === 'dinein' ? 'Dine-In' : 'Takeaway'}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.deleteBtn,
                pressed && { opacity: 0.7 },
                isCanceling && { opacity: 0.5 },
              ]}
              disabled={isCanceling}
              onPress={() => deleteSaleRecord(item)}
            >
              {isCanceling ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="trash-outline" size={17} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>

        {item.type === 'dinein' && (
          <Text style={styles.tableText}>Table: {item.tableNumber || '-'}</Text>
        )}

        <View style={styles.saleItemsBox}>
          {item.items.map((food, index) => (
            <View key={index} style={styles.saleItemRow}>
              <Text style={styles.saleItemName}>{food.name}</Text>
              <Text style={styles.saleItemQty}>x{food.quantity}</Text>
              <Text style={styles.saleItemAmount}>
                Rs {(Number(food.price) * Number(food.quantity)).toFixed(0)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.saleTotalRow}>
          <Text style={styles.saleTotalLabel}>Bill Total</Text>
          <Text style={styles.saleTotalValue}>Rs {Number(item.total).toFixed(2)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Sales Report</Text>

        <TouchableOpacity onPress={loadSalesData}>
          <Ionicons name="refresh" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.dateContainer}>
          <Text style={styles.sectionTitle}>Date Range</Text>

          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={setTodayRange}>
              <Text style={styles.quickBtnText}>Today</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickBtn} onPress={setLast7DaysRange}>
              <Text style={styles.quickBtnText}>Last 7 Days</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dateRange}>
            {Platform.OS === 'web' ? (
              <>
                <WebDatePicker value={startDate} onChange={setStartDate} label="From" />
                <WebDatePicker value={endDate} onChange={setEndDate} label="To" />
              </>
            ) : (
              <View style={styles.mobileDateBox}>
                <Text style={styles.mobileDateText}>
                  {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.exportContainer}>
          <TouchableOpacity style={styles.exportBtn} onPress={() => exportCSV()}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.exportBtnText}>Export Selected</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.todayExportBtn} onPress={exportTodayCSV}>
            <Ionicons name="calendar-outline" size={18} color="#4a55a2" />
            <Text style={styles.todayExportText}>Daily Export</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <FilterButton title="All" value="all" />
          <FilterButton title="Dine-In" value="dinein" />
          <FilterButton title="Takeaway" value="takeaway" />
        </View>

        <View style={styles.cashierFilterContainer}>
          <Text style={styles.sectionTitle}>Cashier Filter</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <CashierFilterButton title="All Cashiers" value="all" />

            {cashierSummary.map(cashier => {
              const key = `${cashier.cashierId ?? ''}-${cashier.cashierName}`;

              return (
                <CashierFilterButton
                  key={key}
                  title={cashier.cashierName}
                  value={key}
                />
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Orders</Text>
            <Text style={styles.summaryValue}>{totals.orders}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Gross Sale</Text>
            <Text style={styles.summaryValue}>Rs {totals.subtotal.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Tax / Service</Text>
            <Text style={styles.summaryValue}>Rs {totals.tax.toFixed(2)}</Text>
          </View>

          <View style={[styles.summaryCard, styles.totalCard]}>
            <Text style={styles.summaryLabel}>Net Total</Text>
            <Text style={styles.totalValue}>Rs {totals.total.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.splitContainer}>
          <View style={styles.splitCard}>
            <Text style={styles.splitTitle}>Dine-In Sale</Text>
            <Text style={styles.splitAmount}>Rs {dineInTotals.total.toFixed(2)}</Text>
            <Text style={styles.splitOrders}>{dineInTotals.orders} bills</Text>
          </View>

          <View style={styles.splitCard}>
            <Text style={styles.splitTitle}>Takeaway Sale</Text>
            <Text style={styles.splitAmount}>Rs {takeawayTotals.total.toFixed(2)}</Text>
            <Text style={styles.splitOrders}>{takeawayTotals.orders} bills</Text>
          </View>
        </View>

        <View style={styles.cashierContainer}>
          <Text style={styles.sectionTitle}>Cashier-wise Sales</Text>

          {cashierSummary.length === 0 ? (
            <Text style={styles.emptyText}>No cashier sale found</Text>
          ) : (
            cashierSummary.map(cashier => {
              const cashierKey = `${cashier.cashierId ?? ''}-${cashier.cashierName}`;

              return (
                <View key={cashierKey} style={styles.cashierCard}>
                  <View style={styles.cashierCardTop}>
                    <View style={styles.cashierAvatar}>
                      <Text style={styles.cashierAvatarText}>
                        {cashier.cashierName.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.cashierName}>{cashier.cashierName}</Text>
                      <Text style={styles.cashierOrders}>{cashier.orders} total orders</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.cashierExportBtn}
                      onPress={() => exportCashierCSV(cashierKey, cashier.cashierName)}
                    >
                      <Ionicons name="download-outline" size={16} color="#4a55a2" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cashierStatsRow}>
                    <View style={styles.cashierStatBox}>
                      <Text style={styles.cashierStatLabel}>Total Sale</Text>
                      <Text style={styles.cashierStatValue}>Rs {cashier.totalSale.toFixed(0)}</Text>
                    </View>

                    <View style={styles.cashierStatBox}>
                      <Text style={styles.cashierStatLabel}>Dine-In</Text>
                      <Text style={styles.cashierStatValue}>Rs {cashier.dineinSale.toFixed(0)}</Text>
                      <Text style={styles.cashierStatSub}>{cashier.dineinOrders} bills</Text>
                    </View>

                    <View style={styles.cashierStatBox}>
                      <Text style={styles.cashierStatLabel}>Takeaway</Text>
                      <Text style={styles.cashierStatValue}>Rs {cashier.takeawaySale.toFixed(0)}</Text>
                      <Text style={styles.cashierStatSub}>{cashier.takeawayOrders} bills</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.productsContainer}>
          <Text style={styles.sectionTitle}>Product-wise Sales</Text>

          <View style={styles.tableHeader}>
            <Text style={styles.headerNo}>No.</Text>
            <Text style={styles.headerItem}>Product</Text>
            <Text style={styles.headerQty}>Qty</Text>
            <Text style={styles.headerAmount}>Amount</Text>
          </View>

          {productSummary.length === 0 ? (
            <Text style={styles.emptyText}>No product sale found</Text>
          ) : (
            productSummary.map((item, index) => (
              <View key={item.name} style={styles.productRow}>
                <Text style={styles.rowNo}>{index + 1}</Text>
                <Text style={styles.rowItem}>{item.name}</Text>
                <Text style={styles.rowQty}>{item.quantity}</Text>
                <Text style={styles.rowAmount}>Rs {item.totalAmount.toFixed(0)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.ordersContainer}>
          <Text style={styles.sectionTitle}>Bill-wise Details</Text>

          <FlatList
            data={filteredData}
            renderItem={renderSaleCard}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No bills found in selected range</Text>
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  dateContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginTop: 1,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },

  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },

  quickBtn: {
    backgroundColor: '#e8e8ff',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },

  quickBtnText: {
    color: '#4a55a2',
    fontWeight: '600',
    fontSize: 13,
  },

  dateRange: {
    flexDirection: 'row',
    gap: 10,
  },

  webDatePicker: {
    flex: 1,
  },

  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },

  mobileDateBox: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },

  mobileDateText: {
    color: '#333',
    textAlign: 'center',
  },

  exportContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginTop: 12,
    gap: 10,
  },

  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#4a55a2',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  exportBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },

  todayExportBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4a55a2',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  todayExportText: {
    color: '#4a55a2',
    fontSize: 13,
    fontWeight: 'bold',
  },

  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 12,
    padding: 5,
    gap: 5,
  },

  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },

  filterBtnActive: {
    backgroundColor: '#4a55a2',
  },

  filterBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },

  filterBtnTextActive: {
    color: '#fff',
  },

  cashierFilterContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 12,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },

  cashierFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8e8ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    gap: 5,
    maxWidth: 160,
  },

  cashierFilterBtnActive: {
    backgroundColor: '#4a55a2',
  },

  cashierFilterText: {
    color: '#4a55a2',
    fontSize: 12,
    fontWeight: '700',
  },

  cashierFilterTextActive: {
    color: '#fff',
  },

  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    gap: 10,
  },

  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },

  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },

  summaryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '700',
  },

  totalCard: {
    backgroundColor: '#e8f0fe',
  },

  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4a55a2',
  },

  splitContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    marginTop: 12,
    gap: 10,
  },

  splitCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    elevation: 2,
  },

  splitTitle: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },

  splitAmount: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 6,
  },

  splitOrders: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },

  cashierContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },

  cashierCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },

  cashierCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  cashierAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4a55a2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  cashierAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  cashierName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },

  cashierOrders: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },

  cashierExportBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e8e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cashierStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  cashierStatBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
  },

  cashierStatLabel: {
    fontSize: 11,
    color: '#777',
    marginBottom: 4,
  },

  cashierStatValue: {
    fontSize: 13,
    color: '#2c3e50',
    fontWeight: 'bold',
  },

  cashierStatSub: {
    fontSize: 10,
    color: '#aaa',
    marginTop: 2,
  },

  productsContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },

  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  headerNo: {
    width: 40,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
  },

  headerItem: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
  },

  headerQty: {
    width: 50,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
    textAlign: 'right',
  },

  headerAmount: {
    width: 90,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
    textAlign: 'right',
  },

  productRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  rowNo: {
    width: 40,
    fontSize: 14,
    color: '#666',
  },

  rowItem: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },

  rowQty: {
    width: 50,
    fontSize: 14,
    color: '#4a55a2',
    textAlign: 'right',
    fontWeight: 'bold',
  },

  rowAmount: {
    width: 90,
    fontSize: 14,
    color: '#2c3e50',
    textAlign: 'right',
    fontWeight: '600',
  },

  ordersContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },

  saleCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },

  saleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  saleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  saleId: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },

  orderNumberText: {
    fontSize: 11,
    color: '#333',
    marginTop: 2,
    fontWeight: '600',
  },

  backendText: {
    fontSize: 11,
    color: '#16A34A',
    marginTop: 2,
    fontWeight: '700',
  },

  warningText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 2,
    fontWeight: '700',
  },

  saleDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },

  cashierText: {
    fontSize: 11,
    color: '#4a55a2',
    marginTop: 2,
    fontWeight: '700',
  },

  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  dineinBadge: {
    backgroundColor: '#e8e8ff',
  },

  takeawayBadge: {
    backgroundColor: '#fff3e0',
  },

  typeBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4a55a2',
  },

  deleteBtn: {
    backgroundColor: '#e74c3c',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tableText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },

  saleItemsBox: {
    marginTop: 10,
  },

  saleItemRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },

  saleItemName: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },

  saleItemQty: {
    width: 40,
    textAlign: 'right',
    fontSize: 13,
    color: '#4a55a2',
    fontWeight: 'bold',
  },

  saleItemAmount: {
    width: 80,
    textAlign: 'right',
    fontSize: 13,
    color: '#333',
  },

  saleTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    marginTop: 8,
    paddingTop: 8,
  },

  saleTotalLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },

  saleTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2ecc71',
  },

  emptyText: {
    textAlign: 'center',
    color: '#aaa',
    paddingVertical: 20,
  },
});
