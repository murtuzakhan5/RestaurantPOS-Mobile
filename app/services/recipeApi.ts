import api from './api';

export type ProductItem = {
  id: number;
  name: string;
  price?: number;
  restaurantId?: number;
};

export type RecipeIngredient = {
  id?: number;
  inventoryItemId: number;
  inventoryItemName?: string;
  quantity: number;
  unit?: {
    id: number;
    name: string;
    shortName: string;
  } | null;
};

export type Recipe = {
  id: number;
  restaurantId: number;
  productId: number;
  name: string;
  items: RecipeIngredient[];
};

const unwrap = <T>(response: any): T => {
  return response.data?.data ?? response.data;
};

const normalizeProduct = (raw: any): ProductItem => ({
  id: Number(raw.id ?? raw.Id ?? 0),
  name: raw.name ?? raw.Name ?? raw.productName ?? raw.ProductName ?? '',
  price: Number(raw.price ?? raw.Price ?? raw.salePrice ?? raw.SalePrice ?? 0),
  restaurantId: Number(raw.restaurantId ?? raw.RestaurantId ?? 0),
});

const normalizeRecipe = (raw: any): Recipe | null => {
  if (!raw) return null;

  const items = raw.items ?? raw.Items ?? [];

  return {
    id: Number(raw.id ?? raw.Id ?? 0),
    restaurantId: Number(raw.restaurantId ?? raw.RestaurantId ?? 0),
    productId: Number(raw.productId ?? raw.ProductId ?? 0),
    name: raw.name ?? raw.Name ?? '',
    items: items.map((x: any) => ({
      id: Number(x.id ?? x.Id ?? 0),
      inventoryItemId: Number(x.inventoryItemId ?? x.InventoryItemId ?? 0),
      inventoryItemName:
        x.inventoryItemName ?? x.InventoryItemName ?? '',
      quantity: Number(x.quantity ?? x.Quantity ?? 0),
      unit: x.unit ?? x.Unit ?? null,
    })),
  };
};

const recipeApi = {
  getProducts: async (restaurantId: number): Promise<ProductItem[]> => {
    const res = await api.get(`/restaurant/products?restaurantId=${restaurantId}`);
    const data = unwrap<any[]>(res);
    return (data || []).map(normalizeProduct);
  },

  getRecipeByProduct: async (
    productId: number,
    restaurantId: number
  ): Promise<Recipe | null> => {
    const res = await api.get(
      `/recipes/product/${productId}?restaurantId=${restaurantId}`
    );

    const data = unwrap<any>(res);
    return normalizeRecipe(data);
  },

  saveRecipe: async (payload: {
    restaurantId: number;
    productId: number;
    name: string;
    items: {
      inventoryItemId: number;
      quantity: number;
    }[];
  }) => {
    const res = await api.post('/recipes', payload);
    return res.data;
  },

  deleteRecipe: async (recipeId: number) => {
    const res = await api.delete(`/recipes/${recipeId}`);
    return res.data;
  },
};

export default recipeApi;