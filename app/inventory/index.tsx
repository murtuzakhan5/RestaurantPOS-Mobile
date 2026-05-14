import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  KeyboardTypeOptions,
  Dimensions,
  Platform,
} from 'react-native';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import inventoryApi, {
  Unit,
  InventoryItem,
  StockTransaction,
} from '../services/inventoryApi';

const { width } = Dimensions.get('window');

type TabType = 'items' | 'lowStock' | 'transactions';
type TransactionTypeFilter = 'all' | 'stockIn' | 'sold' | 'stockOut';
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

interface UnitFormErrors {
  name?: string;
  shortName?: string;
}

interface ItemFormErrors {
  name?: string;
  unitId?: string;
  minimumStock?: string;
  averageCost?: string;
}

interface StockFormErrors {
  inventoryItemId?: string;
  quantity?: string;
}

interface HistoryFormErrors {
  fromDate?: string;
  toDate?: string;
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

export default function InventoryScreen() {
  const [restaurantId, setRestaurantId] = useState<number>(1);

  const [units, setUnits] = useState<Unit[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);

  const [activeTab, setActiveTab] = useState<TabType>('items');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [unitModal, setUnitModal] = useState(false);
  const [itemModal, setItemModal] = useState(false);
  const [stockModal, setStockModal] = useState(false);

  const [unitForm, setUnitForm] = useState({
    name: '',
    shortName: '',
  });

  const [itemForm, setItemForm] = useState({
    name: '',
    unitId: 0,
    minimumStock: '',
    averageCost: '',
  });

  const [stockForm, setStockForm] = useState({
    inventoryItemId: 0,
    quantity: '',
    note: '',
  });

  const [unitErrors, setUnitErrors] = useState<UnitFormErrors>({});
  const [itemErrors, setItemErrors] = useState<ItemFormErrors>({});
  const [stockErrors, setStockErrors] = useState<StockFormErrors>({});
  const [historyErrors, setHistoryErrors] = useState<HistoryFormErrors>({});
  const [appDialog, setAppDialog] = useState<AppDialogState>(emptyDialog);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [historyType, setHistoryType] = useState<TransactionTypeFilter>('all');
  const [selectedHistoryItemId, setSelectedHistoryItemId] = useState<number>(0);

  useEffect(() => {
    init();
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
      return 'Access denied. Inventory permission check karein.';
    }

    if (status === 404) {
      return 'Requested inventory record/API endpoint not found.';
    }

    if (status === 405) {
      return 'This API action is not supported by backend. Backend endpoint/method check karein.';
    }

    if (status >= 500) {
      return 'Server error aa raha hai. Backend/API logs check karein.';
    }

    return fallback;
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/dashboard');
  };

  const init = async () => {
    const id = await getRestaurantId();
    setRestaurantId(id);
    await loadAll(id);
  };

  const getRestaurantId = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');

      if (!userStr) return 1;

      const user = JSON.parse(userStr);

      const id =
        user.restaurantId ||
        user.RestaurantId ||
        user.restaurant?.id ||
        user.Restaurant?.Id ||
        user.restaurant?.restaurantId ||
        user.Restaurant?.RestaurantId ||
        1;

      return Number(id || 1);
    } catch {
      return 1;
    }
  };

  const loadAll = async (id = restaurantId) => {
    try {
      setLoading(true);

      const [unitsRes, itemsRes, lowStockRes, transactionsRes] =
        await Promise.all([
          inventoryApi.getUnits(),
          inventoryApi.getItems(id),
          inventoryApi.getLowStock(id),
          inventoryApi.getTransactions(id),
        ]);

      setUnits(unitsRes || []);
      setItems(itemsRes || []);
      setLowStock(lowStockRes || []);
      setTransactions(transactionsRes || []);
    } catch (error: any) {
      console.log('Inventory load error:', error.response?.data || error.message);

      showDialog({
        type: 'error',
        title: 'Inventory Load Failed',
        message: getApiErrorMessage(error, 'Inventory data load nahi ho saka.'),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
  };

  const resetUnitForm = () => {
    setUnitForm({ name: '', shortName: '' });
    setUnitErrors({});
  };

  const resetItemForm = () => {
    setItemForm({
      name: '',
      unitId: 0,
      minimumStock: '',
      averageCost: '',
    });
    setItemErrors({});
  };

  const resetStockForm = () => {
    setStockForm({
      inventoryItemId: 0,
      quantity: '',
      note: '',
    });
    setStockErrors({});
  };

  const closeUnitModal = () => {
    if (loading) return;
    setUnitModal(false);
    resetUnitForm();
  };

  const closeItemModal = () => {
    if (loading) return;
    setItemModal(false);
    resetItemForm();
  };

  const closeStockModal = () => {
    if (loading) return;
    setStockModal(false);
    resetStockForm();
  };

  const updateUnitField = (key: keyof typeof unitForm, value: string) => {
    setUnitForm(prev => ({ ...prev, [key]: value }));

    if (unitErrors[key]) {
      setUnitErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  const updateItemField = (key: keyof typeof itemForm, value: string | number) => {
    let finalValue = value;

    if (key === 'minimumStock' || key === 'averageCost') {
      finalValue = String(value).replace(/[^0-9.]/g, '');
    }

    setItemForm(prev => ({ ...prev, [key]: finalValue }));

    if (itemErrors[key as keyof ItemFormErrors]) {
      setItemErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  const updateStockField = (key: keyof typeof stockForm, value: string | number) => {
    let finalValue = value;

    if (key === 'quantity') {
      finalValue = String(value).replace(/[^0-9.]/g, '');
    }

    setStockForm(prev => ({ ...prev, [key]: finalValue }));

    if (stockErrors[key as keyof StockFormErrors]) {
      setStockErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  const updateFromDate = (value: string) => {
    setFromDate(value);

    if (historyErrors.fromDate) {
      setHistoryErrors(prev => ({ ...prev, fromDate: undefined }));
    }
  };

  const updateToDate = (value: string) => {
    setToDate(value);

    if (historyErrors.toDate) {
      setHistoryErrors(prev => ({ ...prev, toDate: undefined }));
    }
  };

  const createDefaultUnits = async () => {
    try {
      setLoading(true);

      const defaultUnits = [
        { name: 'Piece', shortName: 'PCS' },
        { name: 'Gram', shortName: 'G' },
        { name: 'Kilogram', shortName: 'KG' },
        { name: 'Milliliter', shortName: 'ML' },
        { name: 'Liter', shortName: 'L' },
      ];

      for (const unit of defaultUnits) {
        await inventoryApi.createUnit(unit);
      }

      showDialog({
        type: 'success',
        title: 'Default Units Created',
        message: 'Default units add ho gaye.',
      });

      await loadAll();
    } catch (error: any) {
      console.log('Default units error:', error.response?.data || error.message);

      showDialog({
        type: 'error',
        title: 'Default Units Failed',
        message: getApiErrorMessage(error, 'Default units add nahi ho sake.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const validateUnitForm = () => {
    const errors: UnitFormErrors = {};

    if (!unitForm.name.trim()) {
      errors.name = 'Unit name is required.';
    } else if (unitForm.name.trim().length < 2) {
      errors.name = 'Unit name must be at least 2 characters.';
    }

    if (!unitForm.shortName.trim()) {
      errors.shortName = 'Short name is required.';
    } else if (unitForm.shortName.trim().length > 10) {
      errors.shortName = 'Short name must be 10 characters or less.';
    }

    setUnitErrors(errors);

    if (Object.keys(errors).length > 0) {
      showDialog({
        type: 'warning',
        title: 'Required Fields',
        message: 'Please correct the highlighted unit fields before saving.',
      });

      return false;
    }

    return true;
  };

  const handleCreateUnit = async () => {
    if (!validateUnitForm()) return;

    try {
      setLoading(true);

      await inventoryApi.createUnit({
        name: unitForm.name.trim(),
        shortName: unitForm.shortName.trim(),
      });

      setUnitModal(false);
      resetUnitForm();

      showDialog({
        type: 'success',
        title: 'Unit Added',
        message: `${unitForm.name.trim()} unit add ho gaya.`,
      });

      await loadAll();
    } catch (error: any) {
      console.log('Create unit error:', error.response?.data || error.message);

      showDialog({
        type: 'error',
        title: 'Unit Save Failed',
        message: getApiErrorMessage(error, 'Unit add nahi ho saka.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const validateItemForm = () => {
    const errors: ItemFormErrors = {};
    const minStock = itemForm.minimumStock.trim();
    const avgCost = itemForm.averageCost.trim();

    if (!itemForm.name.trim()) {
      errors.name = 'Item name is required.';
    } else if (itemForm.name.trim().length < 2) {
      errors.name = 'Item name must be at least 2 characters.';
    }

    if (!itemForm.unitId) {
      errors.unitId = 'Unit is required.';
    }

    if (minStock) {
      const parsed = Number(minStock);

      if (Number.isNaN(parsed) || parsed < 0) {
        errors.minimumStock = 'Minimum stock must be a valid number.';
      }
    }

    if (avgCost) {
      const parsed = Number(avgCost);

      if (Number.isNaN(parsed) || parsed < 0) {
        errors.averageCost = 'Average cost must be a valid number.';
      }
    }

    setItemErrors(errors);

    if (Object.keys(errors).length > 0) {
      showDialog({
        type: 'warning',
        title: 'Required Fields',
        message: 'Please correct the highlighted inventory item fields before saving.',
      });

      return false;
    }

    return true;
  };

  const handleCreateItem = async () => {
    if (!validateItemForm()) return;

    try {
      setLoading(true);

      await inventoryApi.createItem({
        restaurantId,
        name: itemForm.name.trim(),
        unitId: itemForm.unitId,
        minimumStock: Number(itemForm.minimumStock || 0),
        averageCost: Number(itemForm.averageCost || 0),
      });

      setItemModal(false);
      resetItemForm();

      showDialog({
        type: 'success',
        title: 'Item Added',
        message: 'Inventory item add ho gaya.',
      });

      await loadAll();
    } catch (error: any) {
      console.log('Create item error:', error.response?.data || error.message);

      showDialog({
        type: 'error',
        title: 'Item Save Failed',
        message: getApiErrorMessage(error, 'Inventory item add nahi ho saka.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const validateStockForm = () => {
    const errors: StockFormErrors = {};

    if (!stockForm.inventoryItemId) {
      errors.inventoryItemId = 'Inventory item is required.';
    }

    if (!stockForm.quantity.trim()) {
      errors.quantity = 'Quantity is required.';
    } else {
      const qty = Number(stockForm.quantity);

      if (Number.isNaN(qty) || qty <= 0) {
        errors.quantity = 'Please enter a valid quantity.';
      }
    }

    setStockErrors(errors);

    if (Object.keys(errors).length > 0) {
      showDialog({
        type: 'warning',
        title: 'Required Fields',
        message: 'Please correct the highlighted stock fields before saving.',
      });

      return false;
    }

    return true;
  };

  const handleStockIn = async () => {
    if (!validateStockForm()) return;

    try {
      setLoading(true);

      await inventoryApi.stockIn({
        restaurantId,
        inventoryItemId: stockForm.inventoryItemId,
        quantity: Number(stockForm.quantity),
        note: stockForm.note.trim(),
      });

      setStockModal(false);
      resetStockForm();

      showDialog({
        type: 'success',
        title: 'Stock Added',
        message: 'Stock add ho gaya.',
      });

      await loadAll();
    } catch (error: any) {
      console.log('Stock in error:', error.response?.data || error.message);

      showDialog({
        type: 'error',
        title: 'Stock Save Failed',
        message: getApiErrorMessage(error, 'Stock add nahi ho saka.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const performDeleteItem = async (item: InventoryItem) => {
    try {
      setLoading(true);

      await inventoryApi.deleteItem(item.id);

      showDialog({
        type: 'success',
        title: 'Item Deleted',
        message: `${item.name} delete ho gaya.`,
      });

      await loadAll();
    } catch (error: any) {
      console.log('Delete item error:', error.response?.data || error.message);

      showDialog({
        type: 'error',
        title: 'Delete Failed',
        message: getApiErrorMessage(error, 'Item delete nahi ho saka.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = (item: InventoryItem) => {
    showDialog({
      type: 'confirm',
      title: 'Delete Item?',
      message: `${item.name} delete karna hai? Is action se related stock records affect ho sakte hain.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => performDeleteItem(item),
    });
  };

  const getUnitShortName = (item: InventoryItem) => {
    if (!item.unit) return '';

    if (typeof item.unit === 'string') return item.unit;

    return item.unit.shortName || '';
  };

  const formatNumber = (value?: number) => {
    const num = Number(value || 0);
    return Number.isInteger(num) ? `${num}` : num.toFixed(3);
  };

  const getTransactionItemName = (txn: StockTransaction) => {
    return (
      txn.itemName ||
      (txn as any).ItemName ||
      (txn as any).inventoryItemName ||
      (txn as any).InventoryItemName ||
      'Inventory Item'
    );
  };

  const getTransactionItemId = (txn: StockTransaction) => {
    return Number(
      (txn as any).inventoryItemId ||
        (txn as any).InventoryItemId ||
        (txn as any).itemId ||
        (txn as any).ItemId ||
        0
    );
  };

  const getTransactionType = (
    txn: StockTransaction
  ): TransactionTypeFilter => {
    const type = String(txn.type || '').toLowerCase();
    const referenceType = String(txn.referenceType || '').toLowerCase();
    const qty = Number(txn.quantity || 0);

    if (qty > 0) return 'stockIn';

    if (
      type.includes('sale') ||
      type.includes('sold') ||
      referenceType.includes('order') ||
      referenceType.includes('sale')
    ) {
      return 'sold';
    }

    return 'stockOut';
  };

  const isValidDateText = (value: string) => {
    if (!value.trim()) return true;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false;

    const date = new Date(`${value.trim()}T00:00:00`);

    return !Number.isNaN(date.getTime());
  };

  const validateHistoryFilters = () => {
    const errors: HistoryFormErrors = {};

    if (!isValidDateText(fromDate)) {
      errors.fromDate = 'Use YYYY-MM-DD format.';
    }

    if (!isValidDateText(toDate)) {
      errors.toDate = 'Use YYYY-MM-DD format.';
    }

    const start = parseStartDate(fromDate);
    const end = parseEndDate(toDate);

    if (start && end && start > end) {
      errors.toDate = 'To date must be after from date.';
    }

    setHistoryErrors(errors);

    if (Object.keys(errors).length > 0) {
      showDialog({
        type: 'warning',
        title: 'Invalid Date Filter',
        message: 'Please correct date filters before exporting or printing.',
      });

      return false;
    }

    return true;
  };

  const parseStartDate = (value: string) => {
    if (!value.trim() || !isValidDateText(value)) return null;
    return new Date(`${value.trim()}T00:00:00`);
  };

  const parseEndDate = (value: string) => {
    if (!value.trim() || !isValidDateText(value)) return null;
    return new Date(`${value.trim()}T23:59:59`);
  };

  const isTransactionInDateRange = (txn: StockTransaction) => {
    const txnDate = new Date(txn.createdAt);
    const start = parseStartDate(fromDate);
    const end = parseEndDate(toDate);

    if (start && txnDate < start) return false;
    if (end && txnDate > end) return false;

    return true;
  };

  const filteredTransactions = transactions.filter(txn => {
    const txnType = getTransactionType(txn);
    const txnItemId = getTransactionItemId(txn);

    const selectedItemName = items.find(
      x => x.id === selectedHistoryItemId
    )?.name;

    const dateOk = isTransactionInDateRange(txn);
    const typeOk = historyType === 'all' || txnType === historyType;

    const itemOk =
      selectedHistoryItemId === 0 ||
      txnItemId === selectedHistoryItemId ||
      getTransactionItemName(txn) === selectedItemName;

    return dateOk && typeOk && itemOk;
  });

  const historySummary = (() => {
    let stockIn = 0;
    let sold = 0;
    let stockOut = 0;

    filteredTransactions.forEach(txn => {
      const qty = Number(txn.quantity || 0);
      const txnType = getTransactionType(txn);

      if (txnType === 'stockIn') {
        stockIn += qty;
      } else if (txnType === 'sold') {
        sold += Math.abs(qty);
      } else {
        stockOut += Math.abs(qty);
      }
    });

    return {
      stockIn,
      sold,
      stockOut,
      net: stockIn - sold - stockOut,
      count: filteredTransactions.length,
    };
  })();

  const itemWiseSummary = (() => {
    const map: Record<
      string,
      {
        itemName: string;
        stockIn: number;
        sold: number;
        stockOut: number;
        net: number;
        transactions: number;
      }
    > = {};

    filteredTransactions.forEach(txn => {
      const itemName = getTransactionItemName(txn);
      const qty = Number(txn.quantity || 0);
      const txnType = getTransactionType(txn);

      if (!map[itemName]) {
        map[itemName] = {
          itemName,
          stockIn: 0,
          sold: 0,
          stockOut: 0,
          net: 0,
          transactions: 0,
        };
      }

      if (txnType === 'stockIn') {
        map[itemName].stockIn += qty;
      } else if (txnType === 'sold') {
        map[itemName].sold += Math.abs(qty);
      } else {
        map[itemName].stockOut += Math.abs(qty);
      }

      map[itemName].net += qty;
      map[itemName].transactions += 1;
    });

    return Object.values(map);
  })();

  const resetHistoryFilters = () => {
    setFromDate('');
    setToDate('');
    setHistoryType('all');
    setSelectedHistoryItemId(0);
    setHistoryErrors({});
  };

  const exportHistoryToExcel = async () => {
    try {
      if (!validateHistoryFilters()) return;

      if (filteredTransactions.length === 0) {
        showDialog({
          type: 'warning',
          title: 'No Data',
          message: 'Export ke liye koi history data nahi hai.',
        });
        return;
      }

      const transactionRows = filteredTransactions.map(txn => {
        const txnType = getTransactionType(txn);
        const qty = Number(txn.quantity || 0);

        return {
          Date: new Date(txn.createdAt).toLocaleString(),
          Item: getTransactionItemName(txn),
          Type:
            txnType === 'stockIn'
              ? 'Stock In'
              : txnType === 'sold'
              ? 'Sold'
              : 'Stock Out',
          Quantity: qty,
          ReferenceType: txn.referenceType || '',
          ReferenceId: txn.referenceId || '',
          Note: txn.note || '',
        };
      });

      const summaryRows = itemWiseSummary.map(row => ({
        Item: row.itemName,
        StockIn: row.stockIn,
        Sold: row.sold,
        StockOut: row.stockOut,
        NetMovement: row.net,
        Transactions: row.transactions,
      }));

      const wb = XLSX.utils.book_new();

      const ws1 = XLSX.utils.json_to_sheet(transactionRows);
      const ws2 = XLSX.utils.json_to_sheet(summaryRows);

      XLSX.utils.book_append_sheet(wb, ws1, 'Transactions');
      XLSX.utils.book_append_sheet(wb, ws2, 'Item Summary');

      const fileName = `Inventory_Report_${Date.now()}.xlsx`;

      if (Platform.OS === 'web') {
        const excelBuffer = XLSX.write(wb, {
          bookType: 'xlsx',
          type: 'array',
        });

        const blob = new Blob([excelBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = fileName;
        a.click();

        URL.revokeObjectURL(url);

        showDialog({
          type: 'success',
          title: 'Excel Exported',
          message: 'Excel file download ho gayi.',
        });
        return;
      }

      const base64 = XLSX.write(wb, {
        bookType: 'xlsx',
        type: 'base64',
      });

      const fileUri = `${
        FileSystem.cacheDirectory || FileSystem.documentDirectory
      }${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Share Inventory Report',
          UTI: 'com.microsoft.excel.xlsx',
        });
      } else {
        showDialog({
          type: 'success',
          title: 'Excel Saved',
          message: `Excel file saved: ${fileUri}`,
        });
      }
    } catch (error: any) {
      console.log('Excel export error:', error);

      showDialog({
        type: 'error',
        title: 'Excel Export Failed',
        message: error?.message || 'Excel export nahi ho saka.',
      });
    }
  };

  const printInventoryReport = async () => {
    try {
      if (!validateHistoryFilters()) return;

      if (filteredTransactions.length === 0) {
        showDialog({
          type: 'warning',
          title: 'No Data',
          message: 'Report ke liye koi history data nahi hai.',
        });
        return;
      }

      const restaurantName =
        (await AsyncStorage.getItem('restaurant_name')) || 'Restaurant';

      const dateRangeText =
        fromDate || toDate
          ? `${fromDate || 'Start'} to ${toDate || 'Today'}`
          : 'All Dates';

      const summaryHtml = itemWiseSummary
        .map(
          row => `
            <tr>
              <td>${row.itemName}</td>
              <td class="r">${formatNumber(row.stockIn)}</td>
              <td class="r">${formatNumber(row.sold)}</td>
              <td class="r">${formatNumber(row.stockOut)}</td>
              <td class="r">${formatNumber(row.net)}</td>
            </tr>
          `
        )
        .join('');

      const transactionHtml = filteredTransactions
        .map(txn => {
          const txnType = getTransactionType(txn);

          const type =
            txnType === 'stockIn'
              ? 'Stock In'
              : txnType === 'sold'
              ? 'Sold'
              : 'Stock Out';

          return `
            <tr>
              <td>${new Date(txn.createdAt).toLocaleString()}</td>
              <td>${getTransactionItemName(txn)}</td>
              <td>${type}</td>
              <td class="r">${formatNumber(Number(txn.quantity))}</td>
              <td>${txn.note || ''}</td>
            </tr>
          `;
        })
        .join('');

      const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Inventory Movement Report</title>
<style>
  body {
    font-family: Arial, sans-serif;
    padding: 20px;
    color: #111827;
  }

  .header {
    text-align: center;
    border-bottom: 3px solid #1A5F2B;
    padding-bottom: 14px;
    margin-bottom: 18px;
  }

  .brand {
    font-size: 26px;
    font-weight: 900;
    color: #1A5F2B;
  }

  .title {
    font-size: 20px;
    font-weight: 800;
    margin-top: 8px;
  }

  .meta {
    font-size: 12px;
    color: #6B7280;
    margin-top: 6px;
  }

  .cards {
    display: flex;
    gap: 10px;
    margin: 18px 0;
  }

  .card {
    flex: 1;
    border: 1px solid #E5E7EB;
    border-radius: 10px;
    padding: 12px;
    background: #F9FAFB;
  }

  .card-label {
    font-size: 11px;
    color: #6B7280;
  }

  .card-value {
    font-size: 20px;
    font-weight: 900;
    margin-top: 5px;
  }

  .green {
    color: #16A34A;
  }

  .red {
    color: #DC2626;
  }

  .orange {
    color: #F59E0B;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
  }

  th {
    background: #1A5F2B;
    color: white;
    text-align: left;
    padding: 8px;
    font-size: 12px;
  }

  td {
    border-bottom: 1px solid #E5E7EB;
    padding: 8px;
    font-size: 12px;
  }

  .r {
    text-align: right;
  }

  .section-title {
    margin-top: 22px;
    font-size: 16px;
    font-weight: 800;
    color: #111827;
  }

  @media print {
    body {
      padding: 10px;
    }
  }
</style>
</head>

<body>
  <div class="header">
    <div class="brand">${restaurantName}</div>
    <div class="title">Inventory Movement Report</div>
    <div class="meta">Date Range: ${dateRangeText}</div>
    <div class="meta">Generated: ${new Date().toLocaleString()}</div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="card-label">Total Stock In</div>
      <div class="card-value green">${formatNumber(historySummary.stockIn)}</div>
    </div>

    <div class="card">
      <div class="card-label">Total Sold</div>
      <div class="card-value red">${formatNumber(historySummary.sold)}</div>
    </div>

    <div class="card">
      <div class="card-label">Stock Out</div>
      <div class="card-value orange">${formatNumber(historySummary.stockOut)}</div>
    </div>

    <div class="card">
      <div class="card-label">Net Movement</div>
      <div class="card-value">${formatNumber(historySummary.net)}</div>
    </div>
  </div>

  <div class="section-title">Item Wise Summary</div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="r">Stock In</th>
        <th class="r">Sold</th>
        <th class="r">Stock Out</th>
        <th class="r">Net</th>
      </tr>
    </thead>

    <tbody>
      ${summaryHtml}
    </tbody>
  </table>

  <div class="section-title">Transaction Detail</div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Item</th>
        <th>Type</th>
        <th class="r">Qty</th>
        <th>Note</th>
      </tr>
    </thead>

    <tbody>
      ${transactionHtml}
    </tbody>
  </table>

  <script>
    setTimeout(() => window.print(), 500);
  </script>
</body>
</html>
`;

      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');

        if (!printWindow) {
          showDialog({
            type: 'warning',
            title: 'Popup Blocked',
            message: 'Please allow browser popups to print report.',
          });
          return;
        }

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        return;
      }

      await Print.printAsync({ html });
    } catch (error: any) {
      console.log('Print report error:', error);

      showDialog({
        type: 'error',
        title: 'Print Failed',
        message: error?.message || 'Report print nahi ho saka.',
      });
    }
  };

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

  return (
    <>
      <StatusBar style="light" />

      <View style={styles.container}>
        <LinearGradient
          colors={['#0F172A', '#1A5F2B', '#0D3D1C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Inventory</Text>

            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{items.length}</Text>
            </View>
          </View>

          <Text style={styles.headerSubtitle}>Track & manage your stock</Text>
        </LinearGradient>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={[styles.statIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="cube-outline" size={24} color="#1A5F2B" />
            </View>

            <Text style={styles.statNumber}>{items.length}</Text>
            <Text style={styles.statLabel}>Total Items</Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.statIcon, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="warning-outline" size={24} color="#F5A623" />
            </View>

            <Text style={[styles.statNumber, { color: '#F5A623' }]}>
              {lowStock.length}
            </Text>

            <Text style={styles.statLabel}>Low Stock</Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.statIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="scale-outline" size={24} color="#1A5F2B" />
            </View>

            <Text style={styles.statNumber}>{units.length}</Text>
            <Text style={styles.statLabel}>Units</Text>
          </View>
        </View>

        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionBtnPrimary}
            onPress={() => {
              setItemErrors({});
              setItemModal(true);
            }}
          >
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Add Item</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={() => {
              setStockErrors({});
              setStockModal(true);
            }}
          >
            <Ionicons name="arrow-up-circle" size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Add Stock</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={() => {
              setUnitErrors({});
              setUnitModal(true);
            }}
          >
            <Ionicons name="add" size={20} color="#1A5F2B" />
            <Text style={styles.actionBtnOutlineText}>Unit</Text>
          </TouchableOpacity>
        </View>

        {units.length === 0 && (
          <TouchableOpacity
            style={styles.defaultCard}
            onPress={createDefaultUnits}
          >
            <Ionicons name="flash" size={18} color="#F5A623" />
            <Text style={styles.defaultText}>
              Create default units (PCS, KG, L, etc.)
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'items' && styles.tabActive]}
            onPress={() => setActiveTab('items')}
          >
            <Ionicons
              name="grid-outline"
              size={18}
              color={activeTab === 'items' ? '#1A5F2B' : '#94A3B8'}
            />

            <Text
              style={[
                styles.tabText,
                activeTab === 'items' && styles.tabTextActive,
              ]}
            >
              Items
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'lowStock' && styles.tabActive,
            ]}
            onPress={() => setActiveTab('lowStock')}
          >
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={activeTab === 'lowStock' ? '#1A5F2B' : '#94A3B8'}
            />

            <Text
              style={[
                styles.tabText,
                activeTab === 'lowStock' && styles.tabTextActive,
              ]}
            >
              Low Stock
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'transactions' && styles.tabActive,
            ]}
            onPress={() => setActiveTab('transactions')}
          >
            <Ionicons
              name="time-outline"
              size={18}
              color={activeTab === 'transactions' ? '#1A5F2B' : '#94A3B8'}
            />

            <Text
              style={[
                styles.tabText,
                activeTab === 'transactions' && styles.tabTextActive,
              ]}
            >
              History
            </Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#1A5F2B" />
            <Text style={styles.loaderText}>Loading inventory...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#1A5F2B']}
              />
            }
          >
            {activeTab === 'items' && (
              <>
                {items.length === 0 ? (
                  <EmptyState
                    icon="cube-outline"
                    text="No inventory items"
                    action="Add your first item"
                  />
                ) : (
                  items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemCardHeader}>
                        <View style={styles.itemIcon}>
                          <Ionicons name="cube" size={22} color="#1A5F2B" />
                        </View>

                        <View style={styles.itemDetails}>
                          <Text style={styles.itemName}>{item.name}</Text>

                          <View style={styles.itemTags}>
                            <View style={styles.tag}>
                              <Ionicons
                                name="scale"
                                size={10}
                                color="#64748B"
                              />
                              <Text style={styles.tagText}>
                                {getUnitShortName(item) || '-'}
                              </Text>
                            </View>

                            <View style={styles.tag}>
                              <Ionicons
                                name="cash"
                                size={10}
                                color="#64748B"
                              />
                              <Text style={styles.tagText}>
                                ₹{item.averageCost || 0}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleDeleteItem(item)}
                          style={styles.deleteIcon}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={20}
                            color="#EF4444"
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.statsRow}>
                        <View style={styles.statsItem}>
                          <Text style={styles.statsItemLabel}>
                            Current Stock
                          </Text>

                          <Text
                            style={[
                              styles.statsItemValue,
                              item.isLowStock &&
                                styles.statsItemValueWarning,
                            ]}
                          >
                            {formatNumber(item.currentStock)}{' '}
                            {getUnitShortName(item)}
                          </Text>
                        </View>

                        <View style={styles.statsDivider} />

                        <View style={styles.statsItem}>
                          <Text style={styles.statsItemLabel}>Minimum</Text>

                          <Text style={styles.statsItemValue}>
                            {formatNumber(item.minimumStock)}{' '}
                            {getUnitShortName(item)}
                          </Text>
                        </View>
                      </View>

                      {item.isLowStock && (
                        <View style={styles.alertBanner}>
                          <Ionicons
                            name="alert-circle"
                            size={16}
                            color="#DC2626"
                          />
                          <Text style={styles.alertText}>
                            Low stock - please restock soon
                          </Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </>
            )}

            {activeTab === 'lowStock' && (
              <>
                {lowStock.length === 0 ? (
                  <EmptyState
                    icon="checkmark-circle"
                    text="All stocks are healthy"
                    action="Great job!"
                  />
                ) : (
                  lowStock.map(item => (
                    <View key={item.id} style={styles.lowStockCard}>
                      <View style={styles.lowStockCardHeader}>
                        <Ionicons
                          name="alert-triangle"
                          size={28}
                          color="#DC2626"
                        />
                        <Text style={styles.lowStockName}>{item.name}</Text>
                      </View>

                      <View style={styles.lowStockStats}>
                        <View>
                          <Text style={styles.lowStockLabel}>Current</Text>

                          <Text style={styles.lowStockValue}>
                            {formatNumber(item.currentStock)}{' '}
                            {getUnitShortName(item)}
                          </Text>
                        </View>

                        <View>
                          <Text style={styles.lowStockLabel}>Minimum</Text>

                          <Text style={styles.lowStockValue}>
                            {formatNumber(item.minimumStock)}{' '}
                            {getUnitShortName(item)}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.restockButton}
                        onPress={() => {
                          setStockErrors({});
                          setStockModal(true);
                          setStockForm(prev => ({
                            ...prev,
                            inventoryItemId: item.id,
                          }));
                        }}
                      >
                        <Text style={styles.restockButtonText}>
                          Restock Now
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={16}
                          color="#FFF"
                        />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </>
            )}

            {activeTab === 'transactions' && (
              <>
                <View style={styles.reportFilterCard}>
                  <Text style={styles.reportTitle}>
                    Inventory Report Filter
                  </Text>

                  <View style={styles.dateRow}>
                    <View style={styles.dateInputBox}>
                      <Text style={styles.filterLabel}>From Date</Text>

                      <TextInput
                        style={[styles.filterInput, historyErrors.fromDate && styles.filterInputError]}
                        placeholder="2026-05-01"
                        value={fromDate}
                        onChangeText={updateFromDate}
                        placeholderTextColor="#94A3B8"
                      />

                      {!!historyErrors.fromDate && (
                        <Text style={styles.smallErrorText}>{historyErrors.fromDate}</Text>
                      )}
                    </View>

                    <View style={styles.dateInputBox}>
                      <Text style={styles.filterLabel}>To Date</Text>

                      <TextInput
                        style={[styles.filterInput, historyErrors.toDate && styles.filterInputError]}
                        placeholder="2026-05-30"
                        value={toDate}
                        onChangeText={updateToDate}
                        placeholderTextColor="#94A3B8"
                      />

                      {!!historyErrors.toDate && (
                        <Text style={styles.smallErrorText}>{historyErrors.toDate}</Text>
                      )}
                    </View>
                  </View>

                  <Text style={styles.filterLabel}>Type</Text>

                  <View style={styles.filterChipRow}>
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'stockIn', label: 'Stock In' },
                      { key: 'sold', label: 'Sold' },
                      { key: 'stockOut', label: 'Stock Out' },
                    ].map(type => (
                      <TouchableOpacity
                        key={type.key}
                        style={[
                          styles.filterChip,
                          historyType === type.key &&
                            styles.filterChipActive,
                        ]}
                        onPress={() =>
                          setHistoryType(type.key as TransactionTypeFilter)
                        }
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            historyType === type.key &&
                              styles.filterChipTextActive,
                          ]}
                        >
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.filterLabel}>Item</Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.itemFilterScroll}
                  >
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        selectedHistoryItemId === 0 &&
                          styles.filterChipActive,
                      ]}
                      onPress={() => setSelectedHistoryItemId(0)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedHistoryItemId === 0 &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        All Items
                      </Text>
                    </TouchableOpacity>

                    {items.map(item => (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.filterChip,
                          selectedHistoryItemId === item.id &&
                            styles.filterChipActive,
                        ]}
                        onPress={() => setSelectedHistoryItemId(item.id)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            selectedHistoryItemId === item.id &&
                              styles.filterChipTextActive,
                          ]}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={styles.exportRow}>
                    <TouchableOpacity
                      style={styles.resetBtn}
                      onPress={resetHistoryFilters}
                    >
                      <Ionicons
                        name="refresh-outline"
                        size={17}
                        color="#64748B"
                      />
                      <Text style={styles.resetBtnText}>Reset</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.excelBtn}
                      onPress={exportHistoryToExcel}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={17}
                        color="#FFF"
                      />
                      <Text style={styles.exportBtnText}>Excel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.printReportBtn}
                      onPress={printInventoryReport}
                    >
                      <Ionicons
                        name="print-outline"
                        size={17}
                        color="#FFF"
                      />
                      <Text style={styles.exportBtnText}>Print</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.reportSummaryGrid}>
                  <View style={styles.reportSummaryCard}>
                    <Text style={styles.reportSummaryLabel}>Stock In</Text>
                    <Text
                      style={[
                        styles.reportSummaryValue,
                        { color: '#22C55E' },
                      ]}
                    >
                      {formatNumber(historySummary.stockIn)}
                    </Text>
                  </View>

                  <View style={styles.reportSummaryCard}>
                    <Text style={styles.reportSummaryLabel}>Sold</Text>
                    <Text
                      style={[
                        styles.reportSummaryValue,
                        { color: '#EF4444' },
                      ]}
                    >
                      {formatNumber(historySummary.sold)}
                    </Text>
                  </View>

                  <View style={styles.reportSummaryCard}>
                    <Text style={styles.reportSummaryLabel}>Stock Out</Text>
                    <Text
                      style={[
                        styles.reportSummaryValue,
                        { color: '#F59E0B' },
                      ]}
                    >
                      {formatNumber(historySummary.stockOut)}
                    </Text>
                  </View>

                  <View style={styles.reportSummaryCard}>
                    <Text style={styles.reportSummaryLabel}>Net</Text>
                    <Text style={styles.reportSummaryValue}>
                      {formatNumber(historySummary.net)}
                    </Text>
                  </View>
                </View>

                {itemWiseSummary.length > 0 && (
                  <View style={styles.itemWiseBox}>
                    <Text style={styles.itemWiseTitle}>
                      Item Wise Summary
                    </Text>

                    {itemWiseSummary.map(row => (
                      <View key={row.itemName} style={styles.itemWiseRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemWiseName}>
                            {row.itemName}
                          </Text>

                          <Text style={styles.itemWiseMeta}>
                            In: {formatNumber(row.stockIn)} | Sold:{' '}
                            {formatNumber(row.sold)} | Out:{' '}
                            {formatNumber(row.stockOut)}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.itemWiseNet,
                            {
                              color: row.net >= 0 ? '#22C55E' : '#EF4444',
                            },
                          ]}
                        >
                          {row.net > 0 ? '+' : ''}
                          {formatNumber(row.net)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {filteredTransactions.length === 0 ? (
                  <EmptyState
                    icon="time"
                    text="No transactions found"
                    action="Filter change karo ya stock add karo"
                  />
                ) : (
                  filteredTransactions.map(txn => (
                    <View key={txn.id} style={styles.transactionCard}>
                      <View style={styles.transactionHeader}>
                        <View>
                          <Text style={styles.transactionName}>
                            {getTransactionItemName(txn)}
                          </Text>

                          <View style={styles.transactionType}>
                            <View
                              style={[
                                styles.typeIndicator,
                                {
                                  backgroundColor:
                                    getTransactionType(txn) === 'stockIn'
                                      ? '#22C55E'
                                      : '#EF4444',
                                },
                              ]}
                            />

                            <Text style={styles.transactionTypeText}>
                              {getTransactionType(txn) === 'stockIn'
                                ? 'Stock In'
                                : getTransactionType(txn) === 'sold'
                                ? 'Sold'
                                : 'Stock Out'}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.transactionQty,
                            {
                              color:
                                Number(txn.quantity) > 0
                                  ? '#22C55E'
                                  : '#EF4444',
                            },
                          ]}
                        >
                          {Number(txn.quantity) > 0 ? '+' : ''}
                          {formatNumber(txn.quantity)}
                        </Text>
                      </View>

                      {!!txn.note && (
                        <Text style={styles.transactionNote}>
                          📝 {txn.note}
                        </Text>
                      )}

                      <Text style={styles.transactionDate}>
                        {new Date(txn.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  ))
                )}
              </>
            )}

            <View style={{ height: 30 }} />
          </ScrollView>
        )}

        <Modal visible={unitModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Create Unit</Text>

              <Input
                label="Unit Name"
                placeholder="Piece"
                value={unitForm.name}
                error={unitErrors.name}
                onChangeText={text => updateUnitField('name', text)}
              />

              <Input
                label="Short Name"
                placeholder="PCS"
                value={unitForm.shortName}
                error={unitErrors.shortName}
                onChangeText={text => updateUnitField('shortName', text)}
              />

              <ModalActions
                onCancel={closeUnitModal}
                onSave={handleCreateUnit}
                loading={loading}
              />
            </View>
          </View>
        </Modal>

        <Modal visible={itemModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Add New Item</Text>

              <Input
                label="Item Name"
                placeholder="Burger Bun"
                value={itemForm.name}
                error={itemErrors.name}
                onChangeText={text => updateItemField('name', text)}
              />

              <Text style={styles.modalLabel}>Unit</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[
                  styles.unitScroll,
                  itemErrors.unitId && styles.selectionErrorBox,
                ]}
              >
                {units.map(unit => (
                  <TouchableOpacity
                    key={unit.id}
                    style={[
                      styles.unitChip,
                      itemForm.unitId === unit.id && styles.unitChipActive,
                    ]}
                    onPress={() => updateItemField('unitId', unit.id)}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        itemForm.unitId === unit.id &&
                          styles.unitChipTextActive,
                      ]}
                    >
                      {unit.shortName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {!!itemErrors.unitId && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                  <Text style={styles.errorText}>{itemErrors.unitId}</Text>
                </View>
              )}

              <Input
                label="Minimum Stock"
                placeholder="20"
                keyboardType="numeric"
                value={itemForm.minimumStock}
                error={itemErrors.minimumStock}
                onChangeText={text => updateItemField('minimumStock', text)}
              />

              <Input
                label="Average Cost (₹)"
                placeholder="25"
                keyboardType="numeric"
                value={itemForm.averageCost}
                error={itemErrors.averageCost}
                onChangeText={text => updateItemField('averageCost', text)}
              />

              <ModalActions
                onCancel={closeItemModal}
                onSave={handleCreateItem}
                loading={loading}
              />
            </View>
          </View>
        </Modal>

        <Modal visible={stockModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Add Stock</Text>

              <Text style={styles.modalLabel}>Select Item</Text>

              <ScrollView
                style={[
                  styles.itemScroll,
                  stockErrors.inventoryItemId && styles.selectionErrorBox,
                ]}
              >
                {items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.itemSelect,
                      stockForm.inventoryItemId === item.id &&
                        styles.itemSelectActive,
                    ]}
                    onPress={() => updateStockField('inventoryItemId', item.id)}
                  >
                    <Text
                      style={[
                        styles.itemSelectText,
                        stockForm.inventoryItemId === item.id &&
                          styles.itemSelectTextActive,
                      ]}
                    >
                      {item.name} ({getUnitShortName(item) || '-'})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {!!stockErrors.inventoryItemId && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                  <Text style={styles.errorText}>{stockErrors.inventoryItemId}</Text>
                </View>
              )}

              <Input
                label="Quantity"
                placeholder="100"
                keyboardType="numeric"
                value={stockForm.quantity}
                error={stockErrors.quantity}
                onChangeText={text => updateStockField('quantity', text)}
              />

              <Input
                label="Note (Optional)"
                placeholder="Initial stock"
                value={stockForm.note}
                onChangeText={text => updateStockField('note', text)}
              />

              <ModalActions
                onCancel={closeStockModal}
                onSave={handleStockIn}
                loading={loading}
              />
            </View>
          </View>
        </Modal>

        {renderAppDialog()}
      </View>
    </>
  );
}

function Input({
  label,
  error,
  ...props
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.modalLabel}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.modalInput, error && styles.modalInputError]}
        placeholderTextColor="#94A3B8"
      />

      {!!error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

function EmptyState({
  icon,
  text,
  action,
}: {
  icon: string;
  text: string;
  action: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as any} size={48} color="#CBD5E1" />
      </View>

      <Text style={styles.emptyText}>{text}</Text>
      <Text style={styles.emptySubtext}>{action}</Text>
    </View>
  );
}

function ModalActions({
  onCancel,
  onSave,
  loading,
}: {
  onCancel: () => void;
  onSave: () => void;
  loading: boolean;
}) {
  return (
    <View style={styles.modalActions}>
      <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel} disabled={loading}>
        <Text style={styles.modalCancelText}>Cancel</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.modalSaveBtn, loading && { opacity: 0.7 }]}
        onPress={onSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <Text style={styles.modalSaveText}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },

  header: {
    paddingTop: Platform.OS === 'ios' ? 55 : 40,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },

  headerBadge: {
    backgroundColor: '#F5A623',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },

  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },

  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: -20,
    marginBottom: 20,
  },

  statBox: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A5F2B',
  },

  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },

  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  actionBtnPrimary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A5F2B',
    paddingVertical: 12,
    borderRadius: 14,
  },

  actionBtnSecondary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F5A623',
    paddingVertical: 12,
    borderRadius: 14,
  },

  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  actionBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },

  actionBtnOutlineText: {
    color: '#1A5F2B',
    fontWeight: '700',
    fontSize: 14,
  },

  defaultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FEF3C7',
    paddingVertical: 12,
    borderRadius: 14,
  },

  defaultText: {
    color: '#D97706',
    fontWeight: '600',
    fontSize: 13,
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },

  tabActive: {
    backgroundColor: '#E8F5E9',
  },

  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },

  tabTextActive: {
    color: '#1A5F2B',
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loaderText: {
    marginTop: 12,
    color: '#64748B',
  },

  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  itemDetails: {
    flex: 1,
  },

  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },

  itemTags: {
    flexDirection: 'row',
    gap: 8,
  },

  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },

  tagText: {
    fontSize: 10,
    color: '#64748B',
  },

  deleteIcon: {
    padding: 6,
  },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },

  statsItem: {
    flex: 1,
    alignItems: 'center',
  },

  statsDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },

  statsItemLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },

  statsItemValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A5F2B',
  },

  statsItemValueWarning: {
    color: '#DC2626',
  },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 12,
  },

  alertText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },

  lowStockCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  lowStockCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },

  lowStockName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },

  lowStockStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },

  lowStockLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },

  lowStockValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
  },

  restockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A5F2B',
    paddingVertical: 12,
    borderRadius: 14,
  },

  restockButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },

  transactionCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  transactionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },

  transactionType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  typeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  transactionTypeText: {
    fontSize: 11,
    color: '#64748B',
  },

  transactionQty: {
    fontSize: 20,
    fontWeight: '800',
  },

  transactionNote: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
    fontStyle: 'italic',
  },

  transactionDate: {
    fontSize: 11,
    color: '#94A3B8',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },

  emptySubtext: {
    fontSize: 13,
    color: '#94A3B8',
  },

  reportFilterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  reportTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },

  dateRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },

  dateInputBox: {
    flex: 1,
  },

  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },

  filterInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 13,
  },

  filterInputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },

  smallErrorText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },

  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  itemFilterScroll: {
    marginBottom: 12,
  },

  filterChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 30,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  filterChipActive: {
    backgroundColor: '#1A5F2B',
    borderColor: '#1A5F2B',
  },

  filterChipText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },

  filterChipTextActive: {
    color: '#FFFFFF',
  },

  exportRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },

  resetBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  resetBtnText: {
    color: '#64748B',
    fontWeight: '800',
    fontSize: 12,
  },

  excelBtn: {
    flex: 1,
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  printReportBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  exportBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },

  reportSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },

  reportSummaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  reportSummaryLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 5,
  },

  reportSummaryValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },

  itemWiseBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  itemWiseTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
  },

  itemWiseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 10,
  },

  itemWiseName: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '800',
  },

  itemWiseMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },

  itemWiseNet: {
    fontSize: 15,
    fontWeight: '900',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 24,
    width: width - 48,
    maxWidth: 450,
    maxHeight: '85%',
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 20,
  },

  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },

  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 6,
  },

  modalInputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },

  inputGroup: {
    marginBottom: 14,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },

  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  unitScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },

  selectionErrorBox: {
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 4,
  },

  unitChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 30,
    marginRight: 8,
  },

  unitChipActive: {
    backgroundColor: '#1A5F2B',
  },

  unitChipText: {
    color: '#64748B',
    fontWeight: '600',
  },

  unitChipTextActive: {
    color: '#FFF',
  },

  itemScroll: {
    maxHeight: 180,
    marginBottom: 8,
  },

  itemSelect: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  itemSelectActive: {
    backgroundColor: '#1A5F2B',
    borderColor: '#1A5F2B',
  },

  itemSelectText: {
    color: '#374151',
    fontWeight: '600',
  },

  itemSelectTextActive: {
    color: '#FFF',
  },

  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },

  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },

  modalCancelText: {
    color: '#64748B',
    fontWeight: '600',
  },

  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#1A5F2B',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },

  modalSaveText: {
    color: '#FFF',
    fontWeight: '700',
  },

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
