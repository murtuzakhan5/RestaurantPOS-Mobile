import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
  KeyboardTypeOptions,
} from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import recipeApi, { ProductItem, RecipeIngredient } from '../services/recipeApi';
import inventoryApi, { InventoryItem } from '../services/inventoryApi';
import { router } from 'expo-router';

export default function RecipeSetupScreen() {
  const [restaurantId, setRestaurantId] = useState<number>(1);

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [recipeId, setRecipeId] = useState<number | null>(null);

  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);

  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<number>(0);
  const [quantity, setQuantity] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const id = await getRestaurantId();
    setRestaurantId(id);
    await loadBaseData(id);
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
        user.Restaurant?.RestaurantId;

      return Number(id || 1);
    } catch {
      return 1;
    }
  };

  const loadBaseData = async (id = restaurantId) => {
    try {
      setLoading(true);

      const [productsRes, inventoryRes] = await Promise.all([
        recipeApi.getProducts(id),
        inventoryApi.getItems(id),
      ]);

      setProducts(productsRes || []);
      setInventoryItems(inventoryRes || []);
    } catch (error: any) {
      console.log('Recipe load error:', error.response?.data || error.message);
      Alert.alert('Error', 'Products ya inventory load nahi ho saki.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBaseData();
  };

  const handleSelectProduct = async (product: ProductItem) => {
    try {
      setSelectedProduct(product);
      setIngredients([]);
      setRecipeId(null);
      setSelectedInventoryItemId(0);
      setQuantity('');
      setLoading(true);

      const existingRecipe = await recipeApi.getRecipeByProduct(
        product.id,
        restaurantId
      );

      if (existingRecipe) {
        setRecipeId(existingRecipe.id);
        setIngredients(existingRecipe.items || []);
      }
    } catch (error: any) {
      console.log('Get recipe error:', error.response?.data || error.message);
      Alert.alert('Error', 'Recipe load nahi ho saki.');
    } finally {
      setLoading(false);
    }
  };

  const getInventoryItemName = (id: number) => {
    const item = inventoryItems.find(x => x.id === id);
    return item?.name || 'Inventory Item';
  };

  const getInventoryItemUnit = (id: number) => {
    const item = inventoryItems.find(x => x.id === id);

    if (!item?.unit) return '';

    if (typeof item.unit === 'string') return item.unit;

    return item.unit.shortName || '';
  };

  const handleAddIngredient = () => {
    if (!selectedProduct) {
      Alert.alert('Required', 'Pehle product select karo.');
      return;
    }

    if (!selectedInventoryItemId) {
      Alert.alert('Required', 'Inventory item select karo.');
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      Alert.alert('Required', 'Valid quantity enter karo.');
      return;
    }

    const alreadyAdded = ingredients.some(
      x => x.inventoryItemId === selectedInventoryItemId
    );

    if (alreadyAdded) {
      Alert.alert('Already Added', 'Ye ingredient already recipe mein added hai.');
      return;
    }

    const newIngredient: RecipeIngredient = {
      inventoryItemId: selectedInventoryItemId,
      inventoryItemName: getInventoryItemName(selectedInventoryItemId),
      quantity: Number(quantity),
      unit: null,
    };

    setIngredients(prev => [...prev, newIngredient]);
    setSelectedInventoryItemId(0);
    setQuantity('');
  };

  const handleRemoveIngredient = (inventoryItemId: number) => {
    setIngredients(prev =>
      prev.filter(x => x.inventoryItemId !== inventoryItemId)
    );
  };

  const handleSaveRecipe = async () => {
    if (!selectedProduct) {
      Alert.alert('Required', 'Pehle product select karo.');
      return;
    }

    if (ingredients.length === 0) {
      Alert.alert('Required', 'Kam se kam 1 ingredient add karo.');
      return;
    }

    try {
      setSaving(true);

      await recipeApi.saveRecipe({
        restaurantId,
        productId: selectedProduct.id,
        name: `${selectedProduct.name} Recipe`,
        items: ingredients.map(x => ({
          inventoryItemId: x.inventoryItemId,
          quantity: x.quantity,
        })),
      });

      Alert.alert('Success', 'Recipe save ho gayi.');

      const updatedRecipe = await recipeApi.getRecipeByProduct(
        selectedProduct.id,
        restaurantId
      );

      if (updatedRecipe) {
        setRecipeId(updatedRecipe.id);
        setIngredients(updatedRecipe.items || []);
      }
    } catch (error: any) {
      console.log('Save recipe error:', error.response?.data || error.message);
      Alert.alert('Error', 'Recipe save nahi ho saki.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecipe = () => {
    if (!recipeId) {
      Alert.alert('No Recipe', 'Is product ki saved recipe nahi hai.');
      return;
    }

    Alert.alert('Delete Recipe', 'Is recipe ko delete karna hai?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            await recipeApi.deleteRecipe(recipeId);
            setRecipeId(null);
            setIngredients([]);
            Alert.alert('Success', 'Recipe delete ho gayi.');
          } catch (error: any) {
            console.log('Delete recipe error:', error.response?.data || error.message);
            Alert.alert('Error', 'Recipe delete nahi ho saki.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const formatQty = (value: number) => {
    const num = Number(value || 0);
    return Number.isInteger(num) ? `${num}` : num.toFixed(3);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View>
          <Text style={styles.title}>Recipe Setup</Text>
          <Text style={styles.subtitle}>Product ko inventory se map karo</Text>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#1A5F2B" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Text style={styles.sectionTitle}>1. Select Product</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.horizontalList}
          >
            {products.map(product => (
              <TouchableOpacity
                key={product.id}
                style={[
                  styles.productChip,
                  selectedProduct?.id === product.id && styles.productChipActive,
                ]}
                onPress={() => handleSelectProduct(product)}
              >
                <Text
                  style={[
                    styles.productChipText,
                    selectedProduct?.id === product.id &&
                      styles.productChipTextActive,
                  ]}
                >
                  {product.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {products.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Product list empty hai. Pehle product page par products add karo.
              </Text>
            </View>
          )}

          {selectedProduct && (
            <>
              <View style={styles.selectedCard}>
                <Text style={styles.selectedLabel}>Selected Product</Text>
                <Text style={styles.selectedName}>{selectedProduct.name}</Text>
                <Text style={styles.selectedSub}>
                  {recipeId ? 'Saved recipe found' : 'New recipe'}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>2. Add Ingredients</Text>

              <Text style={styles.inputLabel}>Select Inventory Item</Text>

              <ScrollView style={styles.inventoryList}>
                {inventoryItems.map(item => {
                  const active = selectedInventoryItemId === item.id;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.inventoryOption,
                        active && styles.inventoryOptionActive,
                      ]}
                      onPress={() => setSelectedInventoryItemId(item.id)}
                    >
                      <Text
                        style={[
                          styles.inventoryText,
                          active && styles.inventoryTextActive,
                        ]}
                      >
                        {item.name} ({getInventoryItemUnit(item.id) || '-'})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {inventoryItems.length === 0 && (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    Inventory empty hai. Pehle inventory items add karo.
                  </Text>
                </View>
              )}

              <Input
                label="Quantity for 1 product"
                placeholder="Example: 1, 20, 150"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />

              <TouchableOpacity
                style={styles.addIngredientButton}
                onPress={handleAddIngredient}
              >
                <Text style={styles.addIngredientText}>+ Add Ingredient</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>3. Current Recipe</Text>

              {ingredients.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    Abhi koi ingredient add nahi hua.
                  </Text>
                </View>
              ) : (
                ingredients.map((ingredient, index) => (
                  <View
                    key={`${ingredient.inventoryItemId}-${index}`}
                    style={styles.ingredientCard}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ingredientName}>
                        {ingredient.inventoryItemName ||
                          getInventoryItemName(ingredient.inventoryItemId)}
                      </Text>

                      <Text style={styles.ingredientQty}>
                        Qty: {formatQty(ingredient.quantity)}{' '}
                        {getInventoryItemUnit(ingredient.inventoryItemId)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() =>
                        handleRemoveIngredient(ingredient.inventoryItemId)
                      }
                    >
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveRecipe}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save Recipe</Text>
                )}
              </TouchableOpacity>

              {recipeId && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDeleteRecipe}
                  disabled={saving}
                >
                  <Text style={styles.deleteText}>Delete Recipe</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
}

function Input({
  label,
  ...props
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: KeyboardTypeOptions;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#1A5F2B',
    paddingTop: 55,
    paddingBottom: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subtitle: {
    color: '#D1FAE5',
    marginTop: 3,
    fontSize: 13,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 12,
    marginTop: 8,
  },
  horizontalList: {
    marginBottom: 14,
  },
  productChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 50,
    marginRight: 10,
  },
  productChipActive: {
    backgroundColor: '#1A5F2B',
    borderColor: '#1A5F2B',
  },
  productChipText: {
    color: '#374151',
    fontWeight: '800',
  },
  productChipTextActive: {
    color: '#FFFFFF',
  },
  selectedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#F5A623',
  },
  selectedLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedName: {
    color: '#1A5F2B',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  selectedSub: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 3,
  },
  inputLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '700',
    marginBottom: 7,
  },
  inventoryList: {
    maxHeight: 180,
    marginBottom: 12,
  },
  inventoryOption: {
    backgroundColor: '#FFFFFF',
    padding: 13,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inventoryOptionActive: {
    backgroundColor: '#1A5F2B',
    borderColor: '#1A5F2B',
  },
  inventoryText: {
    color: '#374151',
    fontWeight: '700',
  },
  inventoryTextActive: {
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#111827',
    fontSize: 15,
  },
  addIngredientButton: {
    backgroundColor: '#F5A623',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  addIngredientText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  ingredientCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  ingredientQty: {
    marginTop: 4,
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 13,
  },
  removeText: {
    color: '#DC2626',
    fontWeight: '900',
    fontSize: 12,
  },
  saveButton: {
    backgroundColor: '#1A5F2B',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  deleteText: {
    color: '#DC2626',
    fontWeight: '900',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    marginBottom: 14,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontWeight: '700',
    textAlign: 'center',
  },
});