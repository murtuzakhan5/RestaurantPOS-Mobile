import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
  Dimensions, ActivityIndicator,
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
  name: string;
  quantity: number;
  price: number;
}

interface SaleRecord {
  id: string;
  tableNumber?: string;
  items: SaleItem[];
  subtotal: number;
  tax?: number;
  total: number;
  timestamp: string;
  type: 'dinein' | 'takeaway';
  cashierName?: string;
  cashierId?: number | string | null;
}

interface ProductSummary {
  name: string;
  quantity: number;
  totalAmount: number;
}

interface CashierSummary {
  cashierKey: string;
  cashierName: string;
  cashierId?: number | string | null;
  orders: number;
  dineinOrders: number;
  takeawayOrders: number;
  total: number;
  dineinTotal: number;
  takeawayTotal: number;
  itemsSold: number;
  averageBill: number;
}

interface ExpenseRecord {
  id?: number | string;
  category?: string;
  amount: number;
  description?: string;
  expenseDate?: string;
  timestamp?: string;
  createdAt?: string;
}

interface ExpenseCategorySummary {
  category: string;
  amount: number;
  count: number;
}

export default function AnalyticsScreen() {
  const today = new Date();

  const [salesData, setSalesData] = useState<SaleRecord[]>([]);
  const [filteredData, setFilteredData] = useState<SaleRecord[]>([]);
  const [productSummary, setProductSummary] = useState<ProductSummary[]>([]);
  const [expenseData, setExpenseData] = useState<ExpenseRecord[]>([]);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [selectedCashierKey, setSelectedCashierKey] = useState<string>('all');

  const [startDate, setStartDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
  );

  const [endDate, setEndDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
  );

  useEffect(() => {
    loadAnalyticsData();
  }, [startDate, endDate]);

  useEffect(() => {
    filterAnalytics();
  }, [salesData, startDate, endDate, selectedCashierKey]);

  const loadAnalyticsData = async () => {
    await Promise.all([loadSalesData(), loadExpensesData()]);
  };

  const loadSalesData = async () => {
    try {
      const response = await api.get('/restaurant/orders/sales-report', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });

      const records = Array.isArray(response.data) ? response.data : [];
      setSalesData(records);
    } catch (error: any) {
      console.error(
        'Analytics sales API load error:',
        error.response?.data || error.message
      );
      setSalesData([]);
    }
  };

  const normalizeExpenseArray = (data: any): ExpenseRecord[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const getExpenseDate = (expense: ExpenseRecord) => {
    return new Date(
      expense.expenseDate ||
        expense.timestamp ||
        expense.createdAt ||
        new Date().toISOString()
    );
  };

  const loadLocalExpensesData = async () => {
    const possibleKeys = ['expense_records', 'expenses_records', 'expenses'];

    for (const key of possibleKeys) {
      const saved = await AsyncStorage.getItem(key);

      if (!saved) continue;

      const parsed = JSON.parse(saved);
      const records = normalizeExpenseArray(parsed).filter(expense => {
        const expenseDate = getExpenseDate(expense);
        return expenseDate >= startDate && expenseDate <= endDate;
      });

      if (records.length > 0) {
        return records;
      }
    }

    return [];
  };

  const loadExpensesData = async () => {
    try {
      setExpenseLoading(true);

      const response = await api.get('/restaurant/expenses', {
        params: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
        },
      });

      setExpenseData(normalizeExpenseArray(response.data));
    } catch (error: any) {
      console.log('Expense API load error, trying local expenses:', error.response?.data || error.message);

      try {
        const localExpenses = await loadLocalExpensesData();
        setExpenseData(localExpenses);
      } catch (localError) {
        console.log('Local expense load error:', localError);
        setExpenseData([]);
      }
    } finally {
      setExpenseLoading(false);
    }
  };

  const formatRs = (value: number) => `₨ ${Number(value || 0).toFixed(2)}`;

  const getCashierName = (sale: SaleRecord) => {
    return sale.cashierName?.trim() || 'Unknown Cashier';
  };

  const getCashierKey = (sale: SaleRecord) => {
    if (sale.cashierId !== undefined && sale.cashierId !== null && String(sale.cashierId).trim() !== '') {
      return `id_${String(sale.cashierId)}`;
    }

    return `name_${getCashierName(sale).toLowerCase().replace(/\s+/g, '_')}`;
  };

  const getDateFilteredData = () => {
    return salesData.filter(sale => {
      const saleDate = new Date(sale.timestamp);
      return saleDate >= startDate && saleDate <= endDate;
    });
  };

  const buildCashierSummary = (records: SaleRecord[]) => {
    const map: { [key: string]: CashierSummary } = {};

    records.forEach(sale => {
      const key = getCashierKey(sale);
      const name = getCashierName(sale);
      const total = Number(sale.total || 0);
      const itemsSold = (sale.items || []).reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      );

      if (!map[key]) {
        map[key] = {
          cashierKey: key,
          cashierName: name,
          cashierId: sale.cashierId,
          orders: 0,
          dineinOrders: 0,
          takeawayOrders: 0,
          total: 0,
          dineinTotal: 0,
          takeawayTotal: 0,
          itemsSold: 0,
          averageBill: 0,
        };
      }

      map[key].orders += 1;
      map[key].total += total;
      map[key].itemsSold += itemsSold;

      if (sale.type === 'dinein') {
        map[key].dineinOrders += 1;
        map[key].dineinTotal += total;
      } else {
        map[key].takeawayOrders += 1;
        map[key].takeawayTotal += total;
      }
    });

    return Object.values(map)
      .map(item => ({
        ...item,
        averageBill: item.orders > 0 ? item.total / item.orders : 0,
      }))
      .sort((a, b) => b.total - a.total);
  };

  const filterAnalytics = () => {
    const dateFiltered = getDateFilteredData();

    const filtered = dateFiltered.filter(sale => {
      if (selectedCashierKey === 'all') return true;
      return getCashierKey(sale) === selectedCashierKey;
    });

    setFilteredData(filtered);

    const summary: { [key: string]: ProductSummary } = {};

    filtered.forEach(sale => {
      sale.items.forEach(item => {
        const name = item.name;
        const qty = Number(item.quantity);
        const price = Number(item.price);

        if (!summary[name]) {
          summary[name] = { name, quantity: 0, totalAmount: 0 };
        }

        summary[name].quantity += qty;
        summary[name].totalAmount += price * qty;
      });
    });

    setProductSummary(
      Object.values(summary).sort((a, b) => b.totalAmount - a.totalAmount)
    );
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

  const setThisMonthRange = () => {
    const now = new Date();
    setStartDate(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
    setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));
  };

  const totals = filteredData.reduce(
    (acc, sale) => ({
      subtotal: acc.subtotal + Number(sale.subtotal || 0),
      tax: acc.tax + Number(sale.tax || 0),
      total: acc.total + Number(sale.total || 0),
      orders: acc.orders + 1,
    }),
    { subtotal: 0, tax: 0, total: 0, orders: 0 }
  );

  const dateFilteredData = getDateFilteredData();

  const businessTotals = dateFilteredData.reduce(
    (acc, sale) => ({
      subtotal: acc.subtotal + Number(sale.subtotal || 0),
      tax: acc.tax + Number(sale.tax || 0),
      total: acc.total + Number(sale.total || 0),
      orders: acc.orders + 1,
    }),
    { subtotal: 0, tax: 0, total: 0, orders: 0 }
  );

  const totalExpenses = expenseData.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const profitSalesBase = businessTotals.subtotal || businessTotals.total;
  const netProfit = profitSalesBase - totalExpenses;
  const profitMargin = profitSalesBase > 0 ? (netProfit / profitSalesBase) * 100 : 0;

  const expenseCategorySummary: ExpenseCategorySummary[] = Object.values(
    expenseData.reduce((acc: Record<string, ExpenseCategorySummary>, expense) => {
      const category = expense.category?.trim() || 'Other';
      const amount = Number(expense.amount || 0);

      if (!acc[category]) {
        acc[category] = { category, amount: 0, count: 0 };
      }

      acc[category].amount += amount;
      acc[category].count += 1;

      return acc;
    }, {})
  ).sort((a, b) => b.amount - a.amount);

  const topExpenseCategory = expenseCategorySummary.length > 0 ? expenseCategorySummary[0] : null;

  const cashierSummary = buildCashierSummary(dateFilteredData);
  const selectedCashierSummary = cashierSummary.find(x => x.cashierKey === selectedCashierKey);
  const topCashier = cashierSummary.length > 0 ? cashierSummary[0] : null;

  const dineInSales = filteredData.filter(s => s.type === 'dinein');
  const takeawaySales = filteredData.filter(s => s.type === 'takeaway');

  const dineInTotal = dineInSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const takeawayTotal = takeawaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);

  const totalItemsSold = productSummary.reduce((sum, p) => sum + p.quantity, 0);
  const averageBill = totals.orders > 0 ? totals.total / totals.orders : 0;

  const bestSeller = productSummary.length > 0
    ? [...productSummary].sort((a, b) => b.quantity - a.quantity)[0]
    : null;

  const topRevenueProduct = productSummary.length > 0
    ? [...productSummary].sort((a, b) => b.totalAmount - a.totalAmount)[0]
    : null;

  const dineInPercent = totals.total > 0 ? (dineInTotal / totals.total) * 100 : 0;
  const takeawayPercent = totals.total > 0 ? (takeawayTotal / totals.total) * 100 : 0;

  const getPeakHour = () => {
    const hourMap: { [key: string]: number } = {};

    filteredData.forEach(sale => {
      const hour = new Date(sale.timestamp).getHours();
      const label = `${hour}:00 - ${hour + 1}:00`;
      hourMap[label] = (hourMap[label] || 0) + Number(sale.total || 0);
    });

    const entries = Object.entries(hourMap);
    if (entries.length === 0) return 'No Data';

    return entries.sort((a, b) => b[1] - a[1])[0][0];
  };

  const getDailySalesGraph = () => {
    const map: { [key: string]: number } = {};

    filteredData.forEach(sale => {
      const date = new Date(sale.timestamp);
      const label = `${date.getDate()}/${date.getMonth() + 1}`;
      map[label] = (map[label] || 0) + Number(sale.total || 0);
    });

    return Object.entries(map).map(([label, value]) => ({ label, value }));
  };

  const getHourlySalesGraph = () => {
    const map: { [key: string]: number } = {};

    filteredData.forEach(sale => {
      const hour = new Date(sale.timestamp).getHours();
      const label = `${hour}:00`;
      map[label] = (map[label] || 0) + Number(sale.total || 0);
    });

    return Object.entries(map).map(([label, value]) => ({ label, value }));
  };

  const dailyGraph = getDailySalesGraph();
  const hourlyGraph = getHourlySalesGraph();

  const maxDaily = Math.max(...dailyGraph.map(i => i.value), 1);
  const maxHourly = Math.max(...hourlyGraph.map(i => i.value), 1);
  const maxProduct = Math.max(...productSummary.map(i => i.totalAmount), 1);
  const maxCashier = Math.max(...cashierSummary.map(i => i.total), 1);

  const WebDatePicker = ({ value, onChange, label }: any) => (
    <View style={styles.webDatePicker}>
      <Text style={styles.dateLabel}>{label}</Text>
      <input
        type="date"
        value={value.toISOString().split('T')[0]}
        onChange={(e) => {
          const date = new Date(e.target.value);

          if (label === 'From') {
            onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
          } else {
            onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59));
          }
        }}
        style={{
          padding: 10,
          borderRadius: 10,
          border: '1px solid #E2E8F0',
          fontSize: 14,
          width: '100%',
          backgroundColor: '#F8FAFC',
          fontFamily: 'inherit',
        }}
      />
    </View>
  );

  const QuickButton = ({ title, onPress }: any) => (
    <TouchableOpacity style={styles.quickBtn} onPress={onPress}>
      <Text style={styles.quickBtnText}>{title}</Text>
    </TouchableOpacity>
  );

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
            <Text style={styles.headerTitle}>Analytics</Text>
            <TouchableOpacity onPress={loadAnalyticsData} style={styles.refreshBtn}>
              <Ionicons name="refresh" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSubtitle}>Business performance insights</Text>
        </LinearGradient>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Hero Profit Card */}
          <LinearGradient
            colors={netProfit >= 0 ? ['#1A5F2B', '#0D3D1C'] : ['#DC2626', '#991B1B']}
            style={styles.heroCard}
          >
            <Text style={styles.heroLabel}>Net Profit</Text>
            <Text style={styles.heroAmount}>{formatRs(netProfit)}</Text>
            <Text style={styles.heroSub}>
              Sales {formatRs(profitSalesBase)} - Expenses {formatRs(totalExpenses)} • {businessTotals.orders} orders
            </Text>
            <View style={styles.heroBadge}>
              <Ionicons name={netProfit >= 0 ? 'trending-up' : 'trending-down'} size={14} color="#FFF" />
              <Text style={styles.heroBadgeText}>{profitMargin.toFixed(1)}% margin</Text>
            </View>
          </LinearGradient>

          {/* Date Range Card */}
          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.dateCard}>
            <Text style={styles.cardTitle}>📅 Date Range</Text>
            <View style={styles.quickRow}>
              <QuickButton title="Today" onPress={setTodayRange} />
              <QuickButton title="Last 7 Days" onPress={setLast7DaysRange} />
              <QuickButton title="This Month" onPress={setThisMonthRange} />
            </View>

            {Platform.OS === 'web' ? (
              <View style={styles.webDateRow}>
                <WebDatePicker value={startDate} onChange={setStartDate} label="From" />
                <WebDatePicker value={endDate} onChange={setEndDate} label="To" />
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

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="receipt-outline" size={22} color="#1A5F2B" />
              </View>
              <Text style={styles.statValue}>{totals.orders}</Text>
              <Text style={styles.statLabel}>Total Orders</Text>
            </LinearGradient>

            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="cash-outline" size={22} color="#1A5F2B" />
              </View>
              <Text style={styles.statValue}>₨{averageBill.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Average Bill</Text>
            </LinearGradient>

            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="wallet-outline" size={22} color="#1A5F2B" />
              </View>
              <Text style={styles.statValue}>{formatRs(totalExpenses)}</Text>
              <Text style={styles.statLabel}>Total Expenses</Text>
            </LinearGradient>

            <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="person-outline" size={22} color="#1A5F2B" />
              </View>
              <Text style={styles.statValue}>{topCashier?.cashierName || 'N/A'}</Text>
              <Text style={styles.statLabel}>Top Cashier</Text>
            </LinearGradient>
          </View>

          {/* Cashier Filter */}
          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>👥 Cashier Filter</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cashierFiltersContainer}>
              <TouchableOpacity
                style={[styles.filterChip, selectedCashierKey === 'all' && styles.filterChipActive]}
                onPress={() => setSelectedCashierKey('all')}
              >
                <Text style={[styles.filterChipText, selectedCashierKey === 'all' && styles.filterChipTextActive]}>All Cashiers</Text>
              </TouchableOpacity>
              {cashierSummary.map(cashier => (
                <TouchableOpacity
                  key={cashier.cashierKey}
                  style={[styles.filterChip, selectedCashierKey === cashier.cashierKey && styles.filterChipActive]}
                  onPress={() => setSelectedCashierKey(cashier.cashierKey)}
                >
                  <Text style={[styles.filterChipText, selectedCashierKey === cashier.cashierKey && styles.filterChipTextActive]}>
                    {cashier.cashierName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </LinearGradient>

          {/* Cashier Performance */}
          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📊 Cashier Performance</Text>
            {cashierSummary.length === 0 ? (
              <Text style={styles.emptyText}>No cashier data</Text>
            ) : (
              cashierSummary.map((cashier, idx) => {
                const width = Math.max((cashier.total / maxCashier) * 100, 4);
                return (
                  <View key={idx} style={styles.cashierCard}>
                    <View style={styles.cashierHeader}>
                      <View style={styles.cashierAvatar}>
                        <Text style={styles.cashierAvatarText}>{cashier.cashierName.charAt(0)}</Text>
                      </View>
                      <View style={styles.cashierInfo}>
                        <Text style={styles.cashierName}>{cashier.cashierName}</Text>
                        <Text style={styles.cashierOrders}>{cashier.orders} orders • {cashier.itemsSold} items</Text>
                      </View>
                      <Text style={styles.cashierTotal}>₨{cashier.total.toFixed(0)}</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${width}%` }]} />
                    </View>
                    <View style={styles.cashierStats}>
                      <View style={styles.cashierStat}>
                        <Text style={styles.cashierStatLabel}>Dine-In</Text>
                        <Text style={styles.cashierStatValue}>₨{cashier.dineinTotal.toFixed(0)}</Text>
                        <Text style={styles.cashierStatSub}>{cashier.dineinOrders} orders</Text>
                      </View>
                      <View style={styles.cashierStat}>
                        <Text style={styles.cashierStatLabel}>Takeaway</Text>
                        <Text style={styles.cashierStatValue}>₨{cashier.takeawayTotal.toFixed(0)}</Text>
                        <Text style={styles.cashierStatSub}>{cashier.takeawayOrders} orders</Text>
                      </View>
                      <View style={styles.cashierStat}>
                        <Text style={styles.cashierStatLabel}>Avg Bill</Text>
                        <Text style={styles.cashierStatValue}>₨{cashier.averageBill.toFixed(0)}</Text>
                        <Text style={styles.cashierStatSub}>per order</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </LinearGradient>

          {/* Expense Breakdown */}
          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>💰 Expense Breakdown</Text>
            {expenseCategorySummary.length === 0 ? (
              <Text style={styles.emptyText}>No expenses found</Text>
            ) : (
              expenseCategorySummary.slice(0, 5).map(item => {
                const width = Math.max((item.amount / totalExpenses) * 100, 4);
                return (
                  <View key={item.category} style={styles.expenseRow}>
                    <View style={styles.expenseHeader}>
                      <Text style={styles.expenseCategory}>{item.category}</Text>
                      <Text style={styles.expenseAmount}>{formatRs(item.amount)}</Text>
                    </View>
                    <View style={styles.expenseProgress}>
                      <View style={[styles.expenseFill, { width: `${width}%` }]} />
                    </View>
                    <Text style={styles.expenseCount}>{item.count} entries</Text>
                  </View>
                );
              })
            )}
          </LinearGradient>

          {/* Top Products */}
          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🍔 Top Selling Products</Text>
            {productSummary.length === 0 ? (
              <Text style={styles.emptyText}>No product data</Text>
            ) : (
              productSummary.slice(0, 5).map((item, idx) => {
                const width = Math.max((item.totalAmount / maxProduct) * 100, 4);
                return (
                  <View key={idx} style={styles.productRowCard}>
                    <View style={styles.productRank}>
                      <Text style={styles.productRankText}>{idx + 1}</Text>
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{item.name}</Text>
                      <Text style={styles.productQty}>{item.quantity} sold</Text>
                      <View style={styles.productProgress}>
                        <View style={[styles.productFill, { width: `${width}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.productAmount}>₨{item.totalAmount.toFixed(0)}</Text>
                  </View>
                );
              })
            )}
          </LinearGradient>

          {/* Dine-In vs Takeaway */}
          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📊 Dine-In vs Takeaway</Text>
            <View style={styles.splitRow}>
              <View style={styles.splitBox}>
                <Ionicons name="restaurant" size={24} color="#1A5F2B" />
                <Text style={styles.splitAmount}>₨{dineInTotal.toFixed(2)}</Text>
                <Text style={styles.splitLabel}>Dine-In</Text>
                <Text style={styles.splitSub}>{dineInSales.length} orders</Text>
              </View>
              <View style={styles.splitBox}>
                <Ionicons name="cart" size={24} color="#F5A623" />
                <Text style={styles.splitAmount}>₨{takeawayTotal.toFixed(2)}</Text>
                <Text style={styles.splitLabel}>Takeaway</Text>
                <Text style={styles.splitSub}>{takeawaySales.length} orders</Text>
              </View>
            </View>
            <View style={styles.doubleProgress}>
              <View style={[styles.dineProgress, { flex: dineInPercent || 0.01 }]} />
              <View style={[styles.takeProgress, { flex: takeawayPercent || 0.01 }]} />
            </View>
            <View style={styles.percentRow}>
              <Text style={styles.percentText}>Dine-In {dineInPercent.toFixed(0)}%</Text>
              <Text style={styles.percentText}>Takeaway {takeawayPercent.toFixed(0)}%</Text>
            </View>
          </LinearGradient>

          {/* Daily Sales Graph - Simplified */}
          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📈 Daily Sales Trend</Text>
            {dailyGraph.length === 0 ? (
              <Text style={styles.emptyText}>No data</Text>
            ) : (
              <View style={styles.simpleGraph}>
                {dailyGraph.slice(-7).map((item, idx) => (
                  <View key={idx} style={styles.graphBarItem}>
                    <View style={[styles.graphBar, { height: Math.max((item.value / maxDaily) * 60, 4) }]} />
                    <Text style={styles.graphLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </LinearGradient>
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
  headerSubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 4 },
  scroll: { flex: 1 },
  heroCard: { margin: 16, padding: 20, borderRadius: 24, position: 'relative' },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  heroAmount: { fontSize: 36, fontWeight: '800', color: '#FFF', marginTop: 8 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginTop: 12 },
  heroBadgeText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  dateCard: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  quickBtn: { backgroundColor: '#E8F5E9', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 25 },
  quickBtnText: { color: '#1A5F2B', fontWeight: '600', fontSize: 13 },
  webDateRow: { flexDirection: 'row', gap: 12 },
  webDatePicker: { flex: 1 },
  dateLabel: { fontSize: 12, color: '#64748B', marginBottom: 4, fontWeight: '500' },
  dateRangeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 14 },
  dateBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  dateText: { fontSize: 13, color: '#0F172A', fontWeight: '500' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  sectionCard: { marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 14 },
  emptyText: { textAlign: 'center', color: '#94A3B8', paddingVertical: 20 },
  cashierFiltersContainer: { paddingHorizontal: 4, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F1F5F9', borderRadius: 25, borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#1A5F2B', borderColor: '#1A5F2B' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  filterChipTextActive: { color: '#FFF' },
  cashierCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginBottom: 12 },
  cashierHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cashierAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A5F2B', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cashierAvatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  cashierInfo: { flex: 1 },
  cashierName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cashierOrders: { fontSize: 11, color: '#64748B', marginTop: 2 },
  cashierTotal: { fontSize: 18, fontWeight: '800', color: '#1A5F2B' },
  progressBar: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', backgroundColor: '#1A5F2B', borderRadius: 3 },
  cashierStats: { flexDirection: 'row', gap: 8 },
  cashierStat: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 8, alignItems: 'center' },
  cashierStatLabel: { fontSize: 10, color: '#64748B' },
  cashierStatValue: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  cashierStatSub: { fontSize: 9, color: '#94A3B8', marginTop: 1 },
  expenseRow: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 10 },
  expenseHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  expenseCategory: { fontSize: 13, fontWeight: '700', color: '#334155' },
  expenseAmount: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  expenseProgress: { height: 6, backgroundColor: '#FEE2E2', borderRadius: 3, overflow: 'hidden' },
  expenseFill: { height: '100%', backgroundColor: '#DC2626', borderRadius: 3 },
  expenseCount: { fontSize: 10, color: '#94A3B8', marginTop: 5 },
  productRowCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  productRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  productRankText: { fontSize: 14, fontWeight: '700', color: '#1A5F2B' },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  productQty: { fontSize: 11, color: '#64748B', marginBottom: 6 },
  productProgress: { height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden' },
  productFill: { height: '100%', backgroundColor: '#F5A623', borderRadius: 2 },
  productAmount: { fontSize: 15, fontWeight: '800', color: '#F5A623' },
  splitRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  splitBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, alignItems: 'center', gap: 6 },
  splitAmount: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  splitLabel: { fontSize: 13, color: '#64748B' },
  splitSub: { fontSize: 11, color: '#94A3B8' },
  doubleProgress: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  dineProgress: { backgroundColor: '#1A5F2B' },
  takeProgress: { backgroundColor: '#F5A623' },
  percentRow: { flexDirection: 'row', justifyContent: 'space-between' },
  percentText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  simpleGraph: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 100, marginTop: 10 },
  graphBarItem: { alignItems: 'center', width: 40 },
  graphBar: { width: 30, backgroundColor: '#1A5F2B', borderRadius: 6, marginBottom: 6 },
  graphLabel: { fontSize: 10, color: '#64748B' },
});