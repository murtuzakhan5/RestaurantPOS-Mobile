import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useEffect, useState } from 'react';
import * as Print from 'expo-print';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

interface Expense {
  id?: number;
  category: string;
  amount: number;
  description: string;
  expenseDate: string;
}

type RangeType = 'daily' | 'monthly' | 'yearly' | 'custom';

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filtered, setFiltered] = useState<Expense[]>([]);

  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const [rangeType, setRangeType] = useState<RangeType>('daily');
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const today = new Date();

  const [startDate, setStartDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
  );

  const [endDate, setEndDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
  );

  useEffect(() => {
    loadExpenses();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [expenses, startDate, endDate]);

  const loadExpenses = async () => {
    try {
      const res = await api.get('/Restaurant/expenses');
      setExpenses(res.data || []);
    } catch (error) {
      console.log('Load expenses error:', error);
    }
  };

  const setDaily = () => {
    setRangeType('daily');
    const now = new Date();
    setStartDate(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
    setEndDate(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
  };

  const setMonthly = () => {
    setRangeType('monthly');
    const now = new Date();
    setStartDate(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
    setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));
  };

  const setYearly = () => {
    setRangeType('yearly');
    const now = new Date();
    setStartDate(new Date(now.getFullYear(), 0, 1, 0, 0, 0));
    setEndDate(new Date(now.getFullYear(), 11, 31, 23, 59, 59));
  };

  const applyFilter = () => {
    const data = expenses.filter(exp => {
      const d = new Date(exp.expenseDate);
      return d >= startDate && d <= endDate;
    });
    setFiltered(data);
  };

  const addExpense = async () => {
    if (!category.trim() || !amount.trim()) {
      Alert.alert('Error', 'Category and amount are required');
      return;
    }

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Error', 'Please enter valid amount');
      return;
    }

    setLoading(true);

    try {
      const payload: Expense = {
        category: category.trim(),
        amount: numericAmount,
        description: description.trim(),
        expenseDate: new Date().toISOString(),
      };

      await api.post('/Restaurant/expenses', payload);
      setExpenses(prev => [{ ...payload, id: Date.now() }, ...prev]);
      setCategory('');
      setAmount('');
      setDescription('');
      Alert.alert('Success', 'Expense added successfully');
    } catch (error) {
      console.log('Add expense error:', error);
      Alert.alert('Error', 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  const deleteExpense = (id?: number) => {
    if (!id) return;
    Alert.alert('Delete Expense', 'This expense will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setExpenses(prev => prev.filter(e => e.id !== id)),
      },
    ]);
  };

  const totalExpense = filtered.reduce((sum, item) => sum + Number(item.amount), 0);
  const avgExpense = filtered.length ? totalExpense / filtered.length : 0;
  const biggestExpense = filtered.length
    ? [...filtered].sort((a, b) => Number(b.amount) - Number(a.amount))[0]
    : null;

  const categorySummary = filtered.reduce((acc: any, item) => {
    if (!acc[item.category]) {
      acc[item.category] = { category: item.category, amount: 0, count: 0 };
    }
    acc[item.category].amount += Number(item.amount);
    acc[item.category].count += 1;
    return acc;
  }, {});

  const categoryData = Object.values(categorySummary).sort((a: any, b: any) => b.amount - a.amount) as any[];

  const formatMoney = (value: number) => `₨ ${Number(value || 0).toFixed(2)}`;

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRangeLabel = () => {
    if (rangeType === 'daily') return 'Daily Expense Report';
    if (rangeType === 'monthly') return 'Monthly Expense Report';
    if (rangeType === 'yearly') return 'Yearly Expense Report';
    return 'Custom Expense Report';
  };

  const escapeHtml = (text: any) => {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const buildExpensePrintHTML = () => {
    const printTime = new Date().toLocaleString('en-PK');
    const rangeText = `${formatDate(startDate)} to ${formatDate(endDate)}`;

    const categoryRows = categoryData.length
      ? categoryData.map((item: any, index) => {
          const percent = totalExpense > 0 ? (item.amount / totalExpense) * 100 : 0;
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(item.category)}</td>
              <td class="right">${item.count}</td>
              <td class="right">${formatMoney(item.amount)}</td>
              <td class="right">${percent.toFixed(0)}%</td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="5" class="center muted">No category data found</td></tr>`;

    const expenseRows = filtered.length
      ? filtered.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${formatDate(item.expenseDate)}</td>
            <td>${escapeHtml(item.category)}</td>
            <td>${escapeHtml(item.description || '-')}</td>
            <td class="right">${formatMoney(Number(item.amount))}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="5" class="center muted">No expense records found</td></tr>`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${getRangeLabel()}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111827;
    background: #ffffff;
    padding: 18px;
  }
  .receipt {
    max-width: 760px;
    margin: 0 auto;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    overflow: hidden;
  }
  .header {
    background: #1A5F2B;
    color: #fff;
    padding: 20px;
    text-align: center;
  }
  .brand {
    font-size: 24px;
    font-weight: 900;
    letter-spacing: 1px;
    color: #F5A623;
  }
  .title {
    font-size: 18px;
    font-weight: 800;
    margin-top: 8px;
  }
  .sub {
    font-size: 12px;
    opacity: 0.9;
    margin-top: 5px;
  }
  .section {
    padding: 16px 18px;
    border-bottom: 1px solid #e5e7eb;
  }
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px 18px;
    font-size: 13px;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px dashed #e5e7eb;
    padding-bottom: 5px;
  }
  .label { color: #6b7280; }
  .value { font-weight: 700; color: #1A5F2B; }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .card {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 12px;
    background: #f9fafb;
  }
  .card-title {
    font-size: 11px;
    color: #6b7280;
    margin-bottom: 6px;
  }
  .card-value {
    font-size: 16px;
    font-weight: 900;
    color: #1A5F2B;
  }
  h3 {
    margin: 0 0 10px;
    font-size: 15px;
    color: #111827;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th {
    background: #f3f4f6;
    color: #374151;
    text-align: left;
    padding: 8px;
    border: 1px solid #e5e7eb;
  }
  td {
    padding: 8px;
    border: 1px solid #e5e7eb;
    vertical-align: top;
  }
  .right { text-align: right; }
  .center { text-align: center; }
  .muted { color: #9ca3af; }
  .total-box {
    margin-top: 10px;
    border: 2px solid #F5A623;
    border-radius: 12px;
    padding: 12px;
    display: flex;
    justify-content: space-between;
    font-size: 18px;
    font-weight: 900;
    color: #1A5F2B;
    background: #FFFBEB;
  }
  .footer {
    text-align: center;
    padding: 14px;
    font-size: 11px;
    color: #6b7280;
  }
  .print-btn {
    display: block;
    margin: 18px auto;
    padding: 12px 18px;
    background: #1A5F2B;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-weight: 800;
    cursor: pointer;
  }
  @media print {
    body { padding: 0; }
    .receipt { border: none; border-radius: 0; }
    .print-btn { display: none; }
    @page { margin: 8mm; }
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="brand">BillPak</div>
      <div class="title">${getRangeLabel()}</div>
      <div class="sub">Restaurant Expense Summary</div>
    </div>

    <div class="section">
      <div class="info-grid">
        <div class="info-row"><span class="label">Period</span><span class="value">${escapeHtml(rangeType.toUpperCase())}</span></div>
        <div class="info-row"><span class="label">Printed At</span><span class="value">${escapeHtml(printTime)}</span></div>
        <div class="info-row"><span class="label">From</span><span class="value">${escapeHtml(formatDate(startDate))}</span></div>
        <div class="info-row"><span class="label">To</span><span class="value">${escapeHtml(formatDate(endDate))}</span></div>
      </div>
    </div>

    <div class="section">
      <div class="summary-grid">
        <div class="card"><div class="card-title">Total Expense</div><div class="card-value">${formatMoney(totalExpense)}</div></div>
        <div class="card"><div class="card-title">Entries</div><div class="card-value">${filtered.length}</div></div>
        <div class="card"><div class="card-title">Average</div><div class="card-value">${formatMoney(avgExpense)}</div></div>
        <div class="card"><div class="card-title">Largest</div><div class="card-value">${formatMoney(biggestExpense ? Number(biggestExpense.amount) : 0)}</div></div>
      </div>
      <div class="total-box"><span>Total Expense</span><span>${formatMoney(totalExpense)}</span></div>
    </div>

    <div class="section">
      <h3>Category-wise Expenses</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>Category</th>
            <th class="right">Entries</th>
            <th class="right">Amount</th>
            <th class="right">%</th>
          </tr>
        </thead>
        <tbody>${categoryRows}</tbody>
      </table>
    </div>

    <div class="section">
      <h3>Expense Records</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>${expenseRows}</tbody>
      </table>
    </div>

    <div class="footer">Powered by AMS Crafters • BillPak Expense Report</div>
  </div>

  <button class="print-btn" onclick="window.print()">Print Report</button>
  <script>setTimeout(function(){ window.print(); }, 500);</script>
</body>
</html>`;
  };

  const printExpenseReport = async () => {
    if (filtered.length === 0) {
      Alert.alert('No Expenses', 'Selected period mein koi expense record nahi hai');
      return;
    }

    try {
      setPrinting(true);
      const html = buildExpensePrintHTML();

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const printWindow = window.open('', '_blank');

        if (!printWindow) {
          Alert.alert('Popup Blocked', 'Please allow popups for printing.');
          return;
        }

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      } else {
        await Print.printAsync({ html });
      }
    } catch (error: any) {
      console.log('Print expense report error:', error);
      Alert.alert('Error', error?.message || 'Expense report print nahi hua');
    } finally {
      setPrinting(false);
    }
  };

  const RangeButton = ({ title, type, onPress }: any) => (
    <TouchableOpacity
      style={[styles.rangeBtn, rangeType === type && styles.rangeBtnActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={rangeType === type ? ['#1A5F2B', '#0D3D1C'] : ['#F3F4F6', '#F3F4F6']}
        style={styles.rangeGradient}
      >
        <Text style={[styles.rangeText, rangeType === type && styles.rangeTextActive]}>
          {title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const WebDatePicker = ({ value, onChange, label }: any) => (
    <View style={styles.webDatePicker}>
      <Text style={styles.dateLabel}>{label}</Text>
      <input
        type="date"
        value={value.toISOString().split('T')[0]}
        onChange={(e) => {
          const date = new Date(e.target.value);
          setRangeType('custom');
          if (label === 'From') {
            onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
          } else {
            onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59));
          }
        }}
        style={{
          padding: 12,
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          fontSize: 14,
          width: '100%',
          backgroundColor: '#F9FAFB',
        }}
      />
    </View>
  );

  const renderExpense = ({ item }: { item: Expense }) => (
    <View style={styles.expenseCard}>
      <View style={styles.expenseIcon}>
        <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.expenseIconCircle}>
          <Ionicons name="cash-outline" size={20} color="#F5A623" />
        </LinearGradient>
      </View>
      <View style={styles.expenseInfo}>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        <Text style={styles.expenseDesc}>{item.description || 'No description'}</Text>
        <Text style={styles.expenseDate}>
          {new Date(item.expenseDate).toLocaleString('en-PK')}
        </Text>
      </View>
      <View style={styles.expenseRight}>
        <Text style={styles.expenseAmount}>₨ {Number(item.amount).toFixed(2)}</Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteExpense(item.id)}>
          <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <StatusBar style="light" />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1A5F2B', '#0D3D1C']} style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerTitle}>Expense Management</Text>
              <Text style={styles.headerSubtitle}>Track your restaurant expenses</Text>
            </View>

            <TouchableOpacity
              style={[styles.headerPrintBtn, printing && { opacity: 0.6 }]}
              onPress={printExpenseReport}
              disabled={printing}
            >
              {printing ? (
                <ActivityIndicator size="small" color="#1A5F2B" />
              ) : (
                <Ionicons name="print-outline" size={22} color="#1A5F2B" />
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="add-circle-outline" size={20} color="#1A5F2B" /> Add New Expense
          </Text>
          
          <TextInput
            placeholder="Category (e.g., Rent, Food, Salary)"
            placeholderTextColor="#94A3B8"
            value={category}
            onChangeText={setCategory}
            style={styles.input}
          />

          <TextInput
            placeholder="Amount"
            placeholderTextColor="#94A3B8"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            style={styles.input}
          />

          <TextInput
            placeholder="Description (optional)"
            placeholderTextColor="#94A3B8"
            value={description}
            onChangeText={setDescription}
            style={[styles.input, { height: 80 }]}
            multiline
          />

          <TouchableOpacity
            style={[styles.addBtn, loading && { opacity: 0.6 }]}
            onPress={addExpense}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#F5A623', '#D48A1A']} style={styles.addGradient}>
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.addBtnText}>{loading ? 'Saving...' : 'Add Expense'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.filterCard}>
          <View style={styles.filterHeaderRow}>
            <Text style={styles.sectionTitleNoMargin}>
              <Ionicons name="calendar-outline" size={18} color="#1A5F2B" /> Expense Period
            </Text>

            <TouchableOpacity
              style={[styles.printReportBtn, printing && { opacity: 0.6 }]}
              onPress={printExpenseReport}
              disabled={printing}
            >
              <Ionicons name="print-outline" size={17} color="#FFFFFF" />
              <Text style={styles.printReportText}>{printing ? 'Printing...' : 'Print Report'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rangeRow}>
            <RangeButton title="Daily" type="daily" onPress={setDaily} />
            <RangeButton title="Monthly" type="monthly" onPress={setMonthly} />
            <RangeButton title="Yearly" type="yearly" onPress={setYearly} />
          </View>

          {Platform.OS === 'web' && (
            <View style={styles.dateRow}>
              <WebDatePicker value={startDate} onChange={setStartDate} label="From" />
              <WebDatePicker value={endDate} onChange={setEndDate} label="To" />
            </View>
          )}
        </View>

        <View style={styles.summaryGrid}>
          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Expense</Text>
            <Text style={styles.summaryValue}>₨ {totalExpense.toFixed(2)}</Text>
          </LinearGradient>

          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Entries</Text>
            <Text style={styles.summaryValue}>{filtered.length}</Text>
          </LinearGradient>

          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Average</Text>
            <Text style={styles.summaryValue}>₨ {avgExpense.toFixed(2)}</Text>
          </LinearGradient>

          <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Largest</Text>
            <Text style={styles.summaryValue}>₨ {biggestExpense ? Number(biggestExpense.amount).toFixed(2) : '0'}</Text>
          </LinearGradient>
        </View>

        <View style={styles.categoryCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="pie-chart-outline" size={18} color="#1A5F2B" /> Category-wise Expenses
          </Text>

          {categoryData.length === 0 ? (
            <Text style={styles.emptyText}>No expenses found</Text>
          ) : (
            categoryData.map((item: any, index) => {
              const percent = totalExpense > 0 ? (item.amount / totalExpense) * 100 : 0;
              return (
                <View key={item.category} style={styles.categoryRow}>
                  <View style={styles.categoryTop}>
                    <Text style={styles.categoryName}>
                      {index + 1}. {item.category}
                    </Text>
                    <Text style={styles.categoryAmount}>₨ {item.amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <LinearGradient
                      colors={['#1A5F2B', '#F5A623']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${percent}%` }]}
                    />
                  </View>
                  <Text style={styles.categoryMeta}>{item.count} entries • {percent.toFixed(0)}%</Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="list-outline" size={18} color="#1A5F2B" /> Expense Records
          </Text>

          <FlatList
            data={filtered}
            renderItem={renderExpense}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No expenses found</Text>}
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#D1D5DB',
    marginTop: 4,
  },
  headerPrintBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    margin: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 14,
    gap: 6,
  },
  sectionTitleNoMargin: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  addBtn: {
    borderRadius: 50,
    overflow: 'hidden',
    marginTop: 6,
  },
  addGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  printReportBtn: {
    backgroundColor: '#1A5F2B',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  printReportText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rangeBtn: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
  },
  rangeGradient: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  rangeText: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#6B7280',
  },
  rangeTextActive: {
    color: '#FFFFFF',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  webDatePicker: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 5,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A5F2B',
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryRow: {
    marginBottom: 16,
  },
  categoryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  categoryName: {
    color: '#1F2937',
    fontWeight: '600',
    fontSize: 14,
  },
  categoryAmount: {
    color: '#F5A623',
    fontWeight: 'bold',
    fontSize: 14,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 20,
  },
  categoryMeta: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  expenseIcon: {
    marginRight: 12,
  },
  expenseIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseCategory: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  expenseDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  expenseDate: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  deleteBtn: {
    backgroundColor: '#EF4444',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    paddingVertical: 20,
  },
});
