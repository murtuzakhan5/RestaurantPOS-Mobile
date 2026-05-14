import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
  KeyboardTypeOptions,
} from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import recipeApi, { ProductItem, RecipeIngredient } from '../services/recipeApi';
import inventoryApi, { InventoryItem } from '../services/inventoryApi';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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

interface FormErrors {
  selectedProduct?: string;
  selectedInventoryItemId?: string;
  quantity?: string;
  ingredients?: string;
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

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [appDialog, setAppDialog] = useState<AppDialogState>(emptyDialog);

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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/dashboard');
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
      return 'Access denied. Recipe Setup permission check karein.';
    }

    if (status === 404) {
      return 'Requested recipe/API endpoint not found.';
    }

    if (status === 405) {
      return 'This API action is not supported by backend. Backend endpoint/method check karein.';
    }

    if (status >= 500) {
      return 'Server error aa raha hai. Backend/API logs check karein.';
    }

    return fallback;
  };

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

      showDialog({
        type: 'error',
        title: 'Recipe Data Load Failed',
        message: getApiErrorMessage(error, 'Products ya inventory load nahi ho saki.'),
      });
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
      setFormErrors({});
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

      showDialog({
        type: 'error',
        title: 'Recipe Load Failed',
        message: getApiErrorMessage(error, 'Recipe load nahi ho saki.'),
      });
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

  const updateSelectedInventoryItem = (id: number) => {
    setSelectedInventoryItemId(id);

    if (formErrors.selectedInventoryItemId) {
      setFormErrors(prev => ({
        ...prev,
        selectedInventoryItemId: undefined,
      }));
    }
  };

  const updateQuantity = (value: string) => {
    setQuantity(value.replace(/[^0-9.]/g, ''));

    if (formErrors.quantity) {
      setFormErrors(prev => ({
        ...prev,
        quantity: undefined,
      }));
    }
  };

  const validateIngredientForm = () => {
    const errors: FormErrors = {};
    const parsedQuantity = Number(quantity);

    if (!selectedProduct) {
      errors.selectedProduct = 'Please select a product first.';
    }

    if (!selectedInventoryItemId) {
      errors.selectedInventoryItemId = 'Inventory item is required.';
    }

    if (!quantity.trim()) {
      errors.quantity = 'Quantity is required.';
    } else if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      errors.quantity = 'Please enter a valid quantity.';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      showDialog({
        type: 'warning',
        title: 'Required Fields',
        message: 'Please correct the highlighted fields before adding ingredient.',
      });

      return false;
    }

    return true;
  };

  const handleAddIngredient = () => {
    if (!validateIngredientForm()) return;

    const alreadyAdded = ingredients.some(
      x => x.inventoryItemId === selectedInventoryItemId
    );

    if (alreadyAdded) {
      showDialog({
        type: 'warning',
        title: 'Already Added',
        message: 'Ye ingredient already recipe mein added hai.',
      });
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
    setFormErrors({});
  };

  const handleRemoveIngredient = (inventoryItemId: number) => {
    setIngredients(prev =>
      prev.filter(x => x.inventoryItemId !== inventoryItemId)
    );
  };

  const validateRecipeSave = () => {
    const errors: FormErrors = {};

    if (!selectedProduct) {
      errors.selectedProduct = 'Please select a product first.';
    }

    if (ingredients.length === 0) {
      errors.ingredients = 'At least 1 ingredient is required.';
    }

    setFormErrors(prev => ({
      ...prev,
      ...errors,
    }));

    if (Object.keys(errors).length > 0) {
      showDialog({
        type: 'warning',
        title: 'Recipe Incomplete',
        message: 'Please select product and add at least 1 ingredient before saving.',
      });

      return false;
    }

    return true;
  };

  const handleSaveRecipe = async () => {
    if (!validateRecipeSave()) return;

    try {
      setSaving(true);

      await recipeApi.saveRecipe({
        restaurantId,
        productId: selectedProduct!.id,
        name: `${selectedProduct!.name} Recipe`,
        items: ingredients.map(x => ({
          inventoryItemId: x.inventoryItemId,
          quantity: x.quantity,
        })),
      });

      showDialog({
        type: 'success',
        title: 'Recipe Saved',
        message: `${selectedProduct!.name} recipe save ho gayi.`,
      });

      const updatedRecipe = await recipeApi.getRecipeByProduct(
        selectedProduct!.id,
        restaurantId
      );

      if (updatedRecipe) {
        setRecipeId(updatedRecipe.id);
        setIngredients(updatedRecipe.items || []);
      }
    } catch (error: any) {
      console.log('Save recipe error:', error.response?.data || error.message);

      showDialog({
        type: 'error',
        title: 'Recipe Save Failed',
        message: getApiErrorMessage(error, 'Recipe save nahi ho saki.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const performDeleteRecipe = async () => {
    if (!recipeId) return;

    try {
      setSaving(true);

      await recipeApi.deleteRecipe(recipeId);
      setRecipeId(null);
      setIngredients([]);

      showDialog({
        type: 'success',
        title: 'Recipe Deleted',
        message: 'Recipe delete ho gayi.',
      });
    } catch (error: any) {
      console.log('Delete recipe error:', error.response?.data || error.message);

      showDialog({
        type: 'error',
        title: 'Recipe Delete Failed',
        message: getApiErrorMessage(error, 'Recipe delete nahi ho saki.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecipe = () => {
    if (!recipeId) {
      showDialog({
        type: 'warning',
        title: 'No Recipe',
        message: 'Is product ki saved recipe nahi hai.',
      });
      return;
    }

    showDialog({
      type: 'confirm',
      title: 'Delete Recipe?',
      message: 'Is recipe ko delete karna hai?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: performDeleteRecipe,
    });
  };

  const formatQty = (value: number) => {
    const num = Number(value || 0);
    return Number.isInteger(num) ? `${num}` : num.toFixed(3);
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
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

          {!!formErrors.selectedProduct && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{formErrors.selectedProduct}</Text>
            </View>
          )}

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

              <ScrollView
                style={[
                  styles.inventoryList,
                  formErrors.selectedInventoryItemId && styles.selectionErrorBox,
                ]}
              >
                {inventoryItems.map(item => {
                  const active = selectedInventoryItemId === item.id;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.inventoryOption,
                        active && styles.inventoryOptionActive,
                      ]}
                      onPress={() => updateSelectedInventoryItem(item.id)}
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

              {!!formErrors.selectedInventoryItemId && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                  <Text style={styles.errorText}>{formErrors.selectedInventoryItemId}</Text>
                </View>
              )}

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
                error={formErrors.quantity}
                onChangeText={updateQuantity}
              />

              <TouchableOpacity
                style={styles.addIngredientButton}
                onPress={handleAddIngredient}
              >
                <Text style={styles.addIngredientText}>+ Add Ingredient</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>3. Current Recipe</Text>

              {!!formErrors.ingredients && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#DC2626" />
                  <Text style={styles.errorText}>{formErrors.ingredients}</Text>
                </View>
              )}

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
                style={[styles.saveButton, saving && { opacity: 0.7 }]}
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
                  style={[styles.deleteButton, saving && { opacity: 0.7 }]}
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

      {renderAppDialog()}
    </View>
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
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, error && styles.inputError]}
        placeholderTextColor="#9CA3AF"
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
    marginBottom: 8,
  },
  selectionErrorBox: {
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 4,
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
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
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
