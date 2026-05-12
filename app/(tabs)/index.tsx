import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import api from '../services/api';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

interface User {
  id?: number;
  userId?: number;
  name?: string;
  phone?: string;
  role?: number;
  roleName?: string;
  permissions?: string[];
}

interface Table {
  id: number;
  tableNumber: string;
  capacity: number;
  status: number;
}

export default function DashboardScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'takeaway' | 'dinein'>('takeaway');
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableActionVisible, setTableActionVisible] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();

      if (selectedTab === 'dinein') {
        loadTables();
      }
    }, [selectedTab])
  );

  useEffect(() => {
    if (selectedTab === 'dinein') {
      loadTables();
    }
  }, [selectedTab, user]);

  const loadUser = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const permissionsStr = await AsyncStorage.getItem('permissions');

      if (!userStr) {
        setUser(null);
        return;
      }

      const parsedUser = JSON.parse(userStr);
      const parsedPermissions = permissionsStr ? JSON.parse(permissionsStr) : [];

      const finalUser: User = {
        ...parsedUser,
        permissions: parsedUser.permissions || parsedPermissions || [],
      };

      setUser(finalUser);

      const isOwnerUser = Number(finalUser.role) === 2;

      const canTakeaway =
        isOwnerUser || finalUser.permissions?.includes('takeaway');

      const canDinein =
        isOwnerUser || finalUser.permissions?.includes('dinein');

      if (!canTakeaway && canDinein) {
        setSelectedTab('dinein');
      }

      if (canTakeaway && selectedTab !== 'dinein') {
        setSelectedTab('takeaway');
      }
    } catch (error) {
      console.log('Load user error:', error);
      setUser(null);
    }
  };

  const isOwner = () => {
    return Number(user?.role) === 2;
  };

  const hasPermission = (permission: string) => {
    if (isOwner()) return true;
    return Boolean(user?.permissions?.includes(permission));
  };

  const canTakeaway = hasPermission('takeaway');
  const canDinein = hasPermission('dinein');
  const canTables = hasPermission('tables');

  const loadTables = async () => {
    if (!canDinein) return;

    try {
      setLoading(true);

      const response = await api.get('/restaurant/tables');
      const apiTables: Table[] = response.data || [];

      const updatedTables = await Promise.all(
        apiTables.map(async table => {
          const localStatus = await AsyncStorage.getItem(
            `table_${table.id}_status`
          );

          if (localStatus === 'reserved') return { ...table, status: 1 };
          if (localStatus === 'available') return { ...table, status: 0 };

          return table;
        })
      );

      setTables(updatedTables);
    } catch (error: any) {
      console.error('Tables load error:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const openOrderScreen = (table: Table) => {
    setTableActionVisible(false);
    setSelectedTable(null);

    router.push({
      pathname: '/dinein/order',
      params: {
        tableId: String(table.id),
        tableNumber: String(table.tableNumber),
      },
    });
  };

  const openBillScreen = (table: Table) => {
    setTableActionVisible(false);
    setSelectedTable(null);

    router.push({
      pathname: '/dinein/bill',
      params: {
        tableId: String(table.id),
        tableNumber: String(table.tableNumber),
      },
    });
  };

  const handleTablePress = (table: Table) => {
    if (!canDinein) return;

    const isReserved = Number(table.status) === 1;

    if (!isReserved) {
      openOrderScreen(table);
      return;
    }

    setSelectedTable(table);
    setTableActionVisible(true);
  };

  const TableCard = ({ item }: { item: Table }) => {
    const isOccupied = Number(item.status) === 1;

    return (
      <TouchableOpacity
        style={[styles.tableCard, isOccupied && styles.tableOccupied]}
        onPress={() => handleTablePress(item)}
        activeOpacity={0.75}
      >
        <LinearGradient
          colors={isOccupied ? ['#DC2626', '#B91C1C'] : ['#1A5F2B', '#0D3D1C']}
          style={styles.tableIconCircle}
        >
          <Ionicons
            name={isOccupied ? 'people' : 'restaurant'}
            size={30}
            color="#FFFFFF"
          />
        </LinearGradient>

        <Text style={styles.tableNumber}>Table {item.tableNumber}</Text>
        <Text style={styles.tableCapacity}>👥 {item.capacity} Persons</Text>

        <View
          style={[
            styles.statusBadge,
            isOccupied ? styles.badgeOccupied : styles.badgeAvailable,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isOccupied ? styles.statusTextOccupied : styles.statusTextAvailable,
            ]}
          >
            {isOccupied ? '● Occupied' : '● Available'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const OrderTypeButton = ({ type, icon, tabKey }: any) => {
    const allowed = tabKey === 'takeaway' ? canTakeaway : canDinein;

    if (!allowed) return null;

    return (
      <TouchableOpacity
        style={[
          styles.orderTypeBtn,
          selectedTab === tabKey && styles.orderTypeActive,
        ]}
        onPress={() => setSelectedTab(tabKey)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={
            selectedTab === tabKey
              ? ['#1A5F2B10', '#1A5F2B10']
              : ['transparent', 'transparent']
          }
          style={styles.orderTypeGradient}
        >
          <Ionicons
            name={icon}
            size={24}
            color={selectedTab === tabKey ? '#F5A623' : '#9CA3AF'}
          />

          <Text
            style={[
              styles.orderTypeText,
              selectedTab === tabKey && styles.orderTypeTextActive,
            ]}
          >
            {type}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const MenuItem = ({ icon, label, onPress }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIconContainer}>
        <Ionicons name={icon} size={22} color="#1A5F2B" />
      </View>

      <Text style={styles.menuLabel}>{label}</Text>

      <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
    </TouchableOpacity>
  );

  const logout = async () => {
    setSidebarVisible(false);
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('permissions');
    await AsyncStorage.removeItem('loginPhone');
    router.replace('/(auth)/login');
  };

  if (user && !canTakeaway && !canDinein) {
    return (
      <>
        <StatusBar style="dark" />

        <View style={styles.accessDeniedContainer}>
          <View style={styles.accessDeniedIcon}>
            <Ionicons name="lock-closed-outline" size={58} color="#EF4444" />
          </View>

          <Text style={styles.accessDeniedTitle}>No Module Access</Text>

          <Text style={styles.accessDeniedText}>
            Is employee ko Takeaway ya Dine In ka access nahi mila. Owner/admin
            se module permission enable karwao.
          </Text>

          <TouchableOpacity style={styles.accessLogoutBtn} onPress={logout}>
            <Text style={styles.accessLogoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />

      <View style={styles.container}>
        <View style={styles.orderTypeContainer}>
          <OrderTypeButton
            type="Take Away"
            icon="bag-handle-outline"
            tabKey="takeaway"
          />

          <OrderTypeButton
            type="Dine In"
            icon="restaurant-outline"
            tabKey="dinein"
          />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {selectedTab === 'takeaway' && canTakeaway ? (
            <TouchableOpacity
              style={styles.takeawayCard}
              onPress={() => router.push('/takeaway')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#1A5F2B', '#0D3D1C']}
                style={styles.takeawayIconCircle}
              >
                <Ionicons name="bag-handle" size={40} color="#F5A623" />
              </LinearGradient>

              <Text style={styles.takeawayTitle}>New Take Away Order</Text>
              <Text style={styles.takeawaySubtitle}>Tap to start new order</Text>

              <View style={styles.takeawayBadge}>
                <Text style={styles.takeawayBadgeText}>Quick Billing →</Text>
              </View>
            </TouchableOpacity>
          ) : selectedTab === 'dinein' && canDinein ? (
            <>
              <View style={styles.tablesHeader}>
                <Text style={styles.tablesTitle}>🪑 Tables ({tables.length})</Text>

                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={loadTables}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={20} color="#F5A623" />
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </View>

              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#F5A623" />
                  <Text style={styles.loadingText}>Loading tables...</Text>
                </View>
              ) : tables.length === 0 ? (
                <View style={styles.noTablesContainer}>
                  <LinearGradient
                    colors={['#F3F4F6', '#E5E7EB']}
                    style={styles.noTablesIconCircle}
                  >
                    <Ionicons
                      name="restaurant-outline"
                      size={50}
                      color="#9CA3AF"
                    />
                  </LinearGradient>

                  <Text style={styles.noTablesText}>No tables found</Text>

                  <Text style={styles.noTablesSubtext}>
                    Add tables to start dine-in service
                  </Text>

                  {canTables && (
                    <TouchableOpacity
                      style={styles.addTableBtn}
                      onPress={() => router.push('/tables')}
                    >
                      <LinearGradient
                        colors={['#F5A623', '#D48A1A']}
                        style={styles.addTableGradient}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={20}
                          color="#FFFFFF"
                        />
                        <Text style={styles.addTableBtnText}>Add Table</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.tablesGrid}>
                  {tables.map(table => (
                    <TableCard key={table.id} item={table} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.noTablesContainer}>
              <Ionicons name="lock-closed-outline" size={52} color="#EF4444" />

              <Text style={styles.noTablesText}>Access Denied</Text>

              <Text style={styles.noTablesSubtext}>
                Is module ka access is employee ko nahi mila.
              </Text>
            </View>
          )}
        </ScrollView>

        <Modal
          visible={tableActionVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTableActionVisible(false)}
        >
          <View style={styles.actionOverlay}>
            <View style={styles.actionBox}>
              <View style={styles.actionHeader}>
                <Text style={styles.actionTitle}>
                  Table {selectedTable?.tableNumber}
                </Text>

                <TouchableOpacity onPress={() => setTableActionVisible(false)}>
                  <Ionicons name="close-circle" size={28} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.actionSubtitle}>What would you like to do?</Text>

              <TouchableOpacity
                style={styles.addKotBtn}
                onPress={() => selectedTable && openOrderScreen(selectedTable)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#1A5F2B', '#0D3D1C']}
                  style={styles.actionBtnGradient}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={22}
                    color="#FFFFFF"
                  />

                  <Text style={styles.actionBtnText}>Add New KOT</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.totalBillBtn}
                onPress={() => selectedTable && openBillScreen(selectedTable)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#F5A623', '#D48A1A']}
                  style={styles.actionBtnGradient}
                >
                  <Ionicons name="receipt-outline" size={22} color="#FFFFFF" />

                  <Text style={styles.actionBtnText}>View Total Bill</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setTableActionVisible(false);
                  setSelectedTable(null);
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={sidebarVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setSidebarVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.sidebar}>
              <LinearGradient
                colors={['#1A5F2B', '#0D3D1C']}
                style={styles.sidebarHeader}
              >
                <View style={styles.sidebarLogo}>
                  <View style={styles.sidebarLogoIcon}>
                    <Text style={styles.sidebarLogoText}>B</Text>
                  </View>

                  <View>
                    <Text style={styles.sidebarTitle}>BillPak</Text>

                    {user?.name && (
                      <Text style={styles.sidebarUserText}>{user.name}</Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity onPress={() => setSidebarVisible(false)}>
                  <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>

              <ScrollView
                style={styles.sidebarContent}
                showsVerticalScrollIndicator={false}
              >
                {(hasPermission('products') || hasPermission('tables')) && (
                  <>
                    <Text style={styles.sidebarSection}>MANAGEMENT</Text>

                    {hasPermission('products') && (
                      <MenuItem
                        icon="grid-outline"
                        label="Categories"
                        onPress={() => {
                          setSidebarVisible(false);
                          router.push('/menu/categories');
                        }}
                      />
                    )}

                    {hasPermission('products') && (
                      <MenuItem
                        icon="fast-food-outline"
                        label="Products"
                        onPress={() => {
                          setSidebarVisible(false);
                          router.push('/menu/products');
                        }}
                      />
                    )}

                    {hasPermission('tables') && (
                      <MenuItem
                        icon="restaurant-outline"
                        label="Tables"
                        onPress={() => {
                          setSidebarVisible(false);
                          router.push('/tables');
                        }}
                      />
                    )}
                  </>
                )}

                {(canTakeaway || canDinein) && (
                  <>
                    <Text style={styles.sidebarSection}>OPERATIONS</Text>

                    {canTakeaway && (
                      <MenuItem
                        icon="bag-handle-outline"
                        label="Take Away"
                        onPress={() => {
                          setSidebarVisible(false);
                          router.push('/takeaway');
                        }}
                      />
                    )}

                    {canDinein && (
                      <MenuItem
                        icon="restaurant-outline"
                        label="Dine In"
                        onPress={() => {
                          setSidebarVisible(false);
                          setSelectedTab('dinein');
                        }}
                      />
                    )}
                  </>
                )}

                {(hasPermission('staff') ||
                  hasPermission('inventory') ||
                  hasPermission('recipe')) && (
                  <>
                    <Text style={styles.sidebarSection}>ADMIN TOOLS</Text>

                    {hasPermission('staff') && (
                      <MenuItem
                        icon="people-outline"
                        label="Employee Access"
                        onPress={() => {
                          setSidebarVisible(false);
                          router.push('/staff');
                        }}
                      />
                    )}

                    {hasPermission('inventory') && (
                      <MenuItem
                        icon="cube-outline"
                        label="Inventory"
                        onPress={() => {
                          setSidebarVisible(false);
                          router.push('/inventory');
                        }}
                      />
                    )}

                    {hasPermission('recipe') && (
                      <MenuItem
                        icon="restaurant-outline"
                        label="Recipe Setup"
                        onPress={() => {
                          setSidebarVisible(false);
                          router.push('/recipes');
                        }}
                      />
                    )}
                  </>
                )}

                {(hasPermission('expenses') || hasPermission('reports')) && (
                  <>
                    <Text style={styles.sidebarSection}>FINANCE</Text>

                    {hasPermission('expenses') && (
                      <MenuItem
                        icon="wallet-outline"
                        label="Expenses"
                        onPress={() => {
                          setSidebarVisible(false);
                          router.push('/expenses');
                        }}
                      />
                    )}

                    {hasPermission('reports') && (
                      <MenuItem
                        icon="bar-chart-outline"
                        label="Sales Report"
                        onPress={() => {
                          setSidebarVisible(false);
                          router.push('/reports/sales');
                        }}
                      />
                    )}

                    {hasPermission('reports') && (
                      <MenuItem
                        icon="analytics-outline"
                        label="Analytics"
                        onPress={() => {
                          setSidebarVisible(false);
                          router.push('/reports/analytics');
                        }}
                      />
                    )}
                  </>
                )}

                <View style={styles.divider} />

                <MenuItem
                  icon="log-out-outline"
                  label="Logout"
                  onPress={logout}
                />
              </ScrollView>

              <View style={styles.sidebarFooter}>
                <Text style={styles.sidebarFooterText}>BillPak v1.0</Text>
                <Text style={styles.sidebarFooterSubtext}>
                  Powered by AMS Crafters
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  orderTypeContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },

  orderTypeBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },

  orderTypeActive: {},

  orderTypeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },

  orderTypeText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '600',
  },

  orderTypeTextActive: {
    color: '#F5A623',
    fontWeight: '700',
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  takeawayCard: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    marginVertical: 20,
  },

  takeawayIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  takeawayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },

  takeawaySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },

  takeawayBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  takeawayBadgeText: {
    color: '#F5A623',
    fontWeight: '600',
    fontSize: 12,
  },

  tablesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },

  tablesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },

  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  refreshText: {
    color: '#F5A623',
    fontSize: 13,
    fontWeight: '600',
  },

  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },

  tableCard: {
    width: isTablet ? '32%' : '48%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  tableOccupied: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },

  tableIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  tableNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },

  tableCapacity: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  badgeAvailable: {
    backgroundColor: '#D1FAE5',
  },

  badgeOccupied: {
    backgroundColor: '#FEE2E2',
  },

  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  statusTextAvailable: {
    color: '#059669',
  },

  statusTextOccupied: {
    color: '#DC2626',
  },

  loadingBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    marginTop: 20,
  },

  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },

  noTablesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginTop: 20,
  },

  noTablesIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  noTablesText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },

  noTablesSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  addTableBtn: {
    borderRadius: 50,
    overflow: 'hidden',
  },

  addTableGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },

  addTableBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  actionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  actionBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },

  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  actionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },

  actionSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginHorizontal: 20,
    marginBottom: 20,
    marginTop: 4,
  },

  addKotBtn: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },

  totalBillBtn: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },

  actionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },

  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  cancelBtn: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },

  cancelText: {
    color: '#9CA3AF',
    fontWeight: '600',
    fontSize: 15,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: isTablet ? '60%' : '80%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },

  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },

  sidebarLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  sidebarLogoIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#F5A623',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sidebarLogoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A5F2B',
  },

  sidebarTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  sidebarUserText: {
    fontSize: 11,
    color: '#D1FAE5',
    fontWeight: '700',
    marginTop: 2,
  },

  sidebarContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  sidebarSection: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 20,
    marginBottom: 12,
    marginLeft: 12,
    letterSpacing: 1,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
    marginBottom: 4,
  },

  menuIconContainer: {
    width: 36,
    height: 36,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },

  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 16,
  },

  sidebarFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    alignItems: 'center',
  },

  sidebarFooterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A5F2B',
  },

  sidebarFooterSubtext: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  },

  accessDeniedContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  accessDeniedIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F2937',
  },

  accessDeniedText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 22,
  },

  accessLogoutBtn: {
    backgroundColor: '#1A5F2B',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 30,
  },

  accessLogoutText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});