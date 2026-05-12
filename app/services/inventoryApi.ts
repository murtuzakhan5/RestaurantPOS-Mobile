import api from './api';

export type Unit = {
  id: number;
  name: string;
  shortName: string;
  isActive?: boolean;
};

export type InventoryItem = {
  id: number;
  restaurantId?: number;
  name: string;
  currentStock: number;
  minimumStock: number;
  averageCost?: number;
  unit?: Unit | string | null;
  isLowStock?: boolean;
};

export type StockTransaction = {
  id: number;
  itemName?: string;
  type: string;
  quantity: number;
  referenceType?: string;
  referenceId?: number | null;
  note?: string | null;
  createdAt: string;
};

const unwrap = <T>(response: any): T => {
  return response.data?.data ?? response.data;
};

const normalizeUnit = (raw: any): Unit => ({
  id: Number(raw.id ?? raw.Id ?? 0),
  name: raw.name ?? raw.Name ?? '',
  shortName: raw.shortName ?? raw.ShortName ?? '',
  isActive: raw.isActive ?? raw.IsActive,
});

const normalizeItem = (raw: any): InventoryItem => {
  const rawUnit = raw.unit ?? raw.Unit ?? null;

  let unit: Unit | string | null = null;

  if (typeof rawUnit === 'string') {
    unit = rawUnit;
  } else if (rawUnit) {
    unit = normalizeUnit(rawUnit);
  }

  return {
    id: Number(raw.id ?? raw.Id ?? 0),
    restaurantId: Number(raw.restaurantId ?? raw.RestaurantId ?? 0),
    name: raw.name ?? raw.Name ?? '',
    currentStock: Number(raw.currentStock ?? raw.CurrentStock ?? 0),
    minimumStock: Number(raw.minimumStock ?? raw.MinimumStock ?? 0),
    averageCost: Number(raw.averageCost ?? raw.AverageCost ?? 0),
    unit,
    isLowStock: raw.isLowStock ?? raw.IsLowStock ?? false,
  };
};

const normalizeTransaction = (raw: any): StockTransaction => ({
  id: Number(raw.id ?? raw.Id ?? 0),
  itemName: raw.itemName ?? raw.ItemName ?? '',
  type: raw.type ?? raw.Type ?? '',
  quantity: Number(raw.quantity ?? raw.Quantity ?? 0),
  referenceType: raw.referenceType ?? raw.ReferenceType ?? '',
  referenceId: raw.referenceId ?? raw.ReferenceId ?? null,
  note: raw.note ?? raw.Note ?? '',
  createdAt: raw.createdAt ?? raw.CreatedAt ?? new Date().toISOString(),
});

const inventoryApi = {
  getUnits: async (): Promise<Unit[]> => {
    const res = await api.get('/inventory/units');
    const data = unwrap<any[]>(res);
    return (data || []).map(normalizeUnit);
  },

  createUnit: async (payload: {
    name: string;
    shortName: string;
  }) => {
    const res = await api.post('/inventory/units', payload);
    return res.data;
  },

  getItems: async (restaurantId: number): Promise<InventoryItem[]> => {
    const res = await api.get(`/inventory/items?restaurantId=${restaurantId}`);
    const data = unwrap<any[]>(res);
    return (data || []).map(normalizeItem);
  },

  createItem: async (payload: {
    restaurantId: number;
    name: string;
    unitId: number;
    minimumStock: number;
    averageCost: number;
  }) => {
    const res = await api.post('/inventory/items', payload);
    return res.data;
  },

  updateItem: async (
    id: number,
    payload: {
      name: string;
      unitId: number;
      minimumStock: number;
      averageCost: number;
      isActive: boolean;
    }
  ) => {
    const res = await api.put(`/inventory/items/${id}`, payload);
    return res.data;
  },

  deleteItem: async (id: number) => {
    const res = await api.delete(`/inventory/items/${id}`);
    return res.data;
  },

  stockIn: async (payload: {
    restaurantId: number;
    inventoryItemId: number;
    quantity: number;
    note?: string;
  }) => {
    const res = await api.post('/inventory/stock-in', payload);
    return res.data;
  },

  getLowStock: async (restaurantId: number): Promise<InventoryItem[]> => {
    const res = await api.get(`/inventory/low-stock?restaurantId=${restaurantId}`);
    const data = unwrap<any[]>(res);
    return (data || []).map(normalizeItem);
  },

  getTransactions: async (
    restaurantId: number
  ): Promise<StockTransaction[]> => {
    const res = await api.get(`/inventory/transactions?restaurantId=${restaurantId}`);
    const data = unwrap<any[]>(res);
    return (data || []).map(normalizeTransaction);
  },
};

export default inventoryApi;