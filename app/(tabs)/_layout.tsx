import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Tabs } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
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

interface LoggedInUser {
  id?: number;
  userId?: number;
  name?: string;
  phone?: string;
  email?: string | null;
  role?: number;
  roleName?: string;
  restaurantId?: number;
  permissions?: string[];
}

export default function TabsLayout() {
  const [logo, setLogo] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>('BillPak');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [user, setUser] = useState<LoggedInUser | null>(null);

  const normalizePermission = (key: string) => {
    const normalized = (key || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');

    if (normalized === 'sale_report') return 'reports';
    if (normalized === 'sales_report') return 'reports';
    if (normalized === 'sales_reports') return 'reports';
    if (normalized === 'report') return 'reports';
    if (normalized === 'dine_in') return 'dinein';
    if (normalized === 'printbill') return 'print_bill';

    return normalized;
  };

  const normalizePermissions = (permissions: any[]) => {
    if (!Array.isArray(permissions)) return [];

    return permissions
      .filter((key) => typeof key === 'string' && key.trim() !== '')
      .map((key) => normalizePermission(key))
      .filter((key, index, array) => array.indexOf(key) === index);
  };

  const loadBranding = async () => {
    try {
      const savedLogo = await AsyncStorage.getItem('restaurant_logo');
      const savedName = await AsyncStorage.getItem('restaurant_name');

      setLogo(savedLogo);
      setRestaurantName(savedName || 'BillPak');
    } catch (error) {
      console.log('Branding load error:', error);
    }
  };

  const loadUser = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');

      if (!userStr) {
        setUser(null);
        return;
      }

      const parsedUser = JSON.parse(userStr);

      let freshPermissions: string[] = [];

      try {
        const savedToken = await AsyncStorage.getItem('token');

        const modulesRes = await api.get('/restaurant/my-modules', {
          headers: savedToken
            ? {
                Authorization: `Bearer ${savedToken}`,
              }
            : undefined,
        });

        const apiPermissions =
          modulesRes.data?.moduleKeys ||
          modulesRes.data?.modules?.map((m: any) => m.key) ||
          [];

        freshPermissions = normalizePermissions(apiPermissions);

        const updatedUser = {
          ...parsedUser,
          role: Number(parsedUser.role || 0),
          permissions: freshPermissions,
        };

        await AsyncStorage.setItem('permissions', JSON.stringify(freshPermissions));
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

        setUser(updatedUser);
      } catch (apiError) {
        console.log('My modules API error:', apiError);

        const permissionsStr = await AsyncStorage.getItem('permissions');
        const parsedPermissions = permissionsStr ? JSON.parse(permissionsStr) : [];

        freshPermissions = normalizePermissions(parsedPermissions);

        setUser({
          ...parsedUser,
          role: Number(parsedUser.role || 0),
          permissions: freshPermissions,
        });
      }
    } catch (error) {
      console.log('User load error:', error);
      setUser(null);
    }
  };

  const loadAll = async () => {
    await Promise.all([loadBranding(), loadUser()]);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  const isOwner = () => {
    return Number(user?.role) === 2;
  };

  const hasPermission = (key: string) => {
    const normalizedKey = normalizePermission(key);
    return Boolean(user?.permissions?.includes(normalizedKey));
  };

  const showAny = (keys: string[]) => {
    return keys.some((key) => hasPermission(key));
  };

  const logout = async () => {
    setSidebarVisible(false);

    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('permissions');
    await AsyncStorage.removeItem('loginPhone');

    router.replace('/(auth)/login');
  };

  const MenuItem = ({ icon, label, onPress, badge }: any) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={() => {
        setSidebarVisible(false);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View style={styles.menuIconContainer}>
        <Ionicons name={icon} size={22} color="#1A5F2B" />
      </View>

      <Text style={styles.menuLabel}>{label}</Text>

      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}

      <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
    </TouchableOpacity>
  );

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: true,

          header: () => (
            <LinearGradient
              colors={['#1A5F2B', '#0D3D1C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.customHeader}
            >
              <TouchableOpacity
                onPress={() => setSidebarVisible(true)}
                style={{ padding: 8 }}
              >
                <Ionicons name="menu-outline" size={26} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={{ alignItems: 'center', flex: 1 }}>
                {logo ? (
                  <View style={styles.headerLogoBox}>
                    <Image
                      source={{ uri: logo }}
                      style={styles.headerLogo}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View style={styles.headerFallbackLogo}>
                    <Text style={styles.headerFallbackText}>
                      {restaurantName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                <Text style={styles.headerRestaurantName} numberOfLines={1}>
                  {restaurantName}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/(tabs)/notifications')}
                style={{ padding: 8 }}
              >
                <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>
          ),

          tabBarStyle: {
            display: 'none',
          },

          tabBarButton: () => null,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>

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
                {logo ? (
                  <Image
                    source={{ uri: logo }}
                    style={styles.sidebarLogoImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.sidebarLogoIcon}>
                    <Text style={styles.sidebarLogoText}>
                      {restaurantName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={styles.sidebarTitle} numberOfLines={1}>
                    {restaurantName}
                  </Text>

                  {user?.name && (
                    <Text style={styles.sidebarUserText} numberOfLines={1}>
                      {user.name} {isOwner() ? '• Owner' : '• Employee'}
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity onPress={() => setSidebarVisible(false)}>
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.sidebarContent} showsVerticalScrollIndicator={false}>
              {showAny(['dashboard']) && (
                <>
                  <Text style={styles.sidebarSection}>MAIN MENU</Text>

                  <MenuItem
                    icon="grid-outline"
                    label="Dashboard"
                    onPress={() => router.push('/(tabs)')}
                  />
                </>
              )}

              {showAny(['takeaway', 'dinein']) && (
                <>
                  <Text style={styles.sidebarSection}>OPERATIONS</Text>

                  {hasPermission('takeaway') && (
                    <MenuItem
                      icon="bag-handle-outline"
                      label="Take Away"
                      onPress={() => router.push('/takeaway')}
                    />
                  )}

                  {hasPermission('dinein') && (
                    <MenuItem
                      icon="restaurant-outline"
                      label="Dine In"
                      onPress={() => router.push('/(tabs)')}
                    />
                  )}
                </>
              )}

              {showAny(['products', 'tables', 'dinein']) && (
                <>
                  <Text style={styles.sidebarSection}>MANAGEMENT</Text>

                  {hasPermission('products') && (
                    <MenuItem
                      icon="grid-outline"
                      label="Categories"
                      onPress={() => router.push('/menu/categories')}
                    />
                  )}

                  {hasPermission('products') && (
                    <MenuItem
                      icon="fast-food-outline"
                      label="Products"
                      onPress={() => router.push('/menu/products')}
                    />
                  )}

                  {(hasPermission('tables') || hasPermission('dinein')) && (
                    <MenuItem
                      icon="restaurant-outline"
                      label="Tables"
                      onPress={() => router.push('/tables')}
                    />
                  )}
                </>
              )}

              {showAny(['staff', 'inventory', 'recipe']) && (
                <>
                  <Text style={styles.sidebarSection}>ADMIN TOOLS</Text>

                  {hasPermission('staff') && (
                    <MenuItem
                      icon="people-outline"
                      label="Employee Access"
                      onPress={() => router.push('/staff')}
                    />
                  )}

                  {hasPermission('inventory') && (
                    <MenuItem
                      icon="cube-outline"
                      label="Inventory"
                      onPress={() => router.push('/inventory')}
                    />
                  )}

                  {hasPermission('recipe') && (
                    <MenuItem
                      icon="git-branch-outline"
                      label="Recipe Setup"
                      onPress={() => router.push('/recipes')}
                    />
                  )}
                </>
              )}

              {showAny(['expenses', 'reports', 'analytics']) && (
                <>
                  <Text style={styles.sidebarSection}>FINANCE</Text>

                  {hasPermission('expenses') && (
                    <MenuItem
                      icon="wallet-outline"
                      label="Expenses"
                      onPress={() => router.push('/expenses/')}
                    />
                  )}

                  {hasPermission('reports') && (
                    <MenuItem
                      icon="bar-chart-outline"
                      label="Sales Report"
                      onPress={() => router.push('/reports/sales')}
                    />
                  )}

                  {hasPermission('analytics') && (
                    <MenuItem
                      icon="analytics-outline"
                      label="Analytics"
                      onPress={() => router.push('/reports/analytics')}
                    />
                  )}
                </>
              )}

              {showAny(['branding', 'settings']) && (
                <>
                  <Text style={styles.sidebarSection}>SETTINGS</Text>

                  {hasPermission('branding') && (
                    <MenuItem
                      icon="color-palette-outline"
                      label="Branding"
                      onPress={() => router.push('/profile/branding')}
                    />
                  )}

                  {hasPermission('settings') && (
                    <MenuItem
                      icon="person-outline"
                      label="Profile"
                      onPress={() => router.push('/profile/profile')}
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
              <Text style={styles.sidebarFooterText}>{restaurantName}</Text>
              <Text style={styles.sidebarFooterSubtext}>Powered by AMS Crafters</Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },

  headerLogoBox: {
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 18,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },

  headerLogo: {
    width: 70,
    height: 70,
    borderRadius: 14,
  },

  headerFallbackLogo: {
    width: 70,
    height: 70,
    backgroundColor: '#F5A623',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },

  headerFallbackText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1A5F2B',
  },

  headerRestaurantName: {
    color: '#F5A623',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 0.8,
    maxWidth: 180,
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
    flex: 1,
  },

  sidebarLogoImage: {
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  sidebarLogoIcon: {
    width: 45,
    height: 45,
    backgroundColor: '#F5A623',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sidebarLogoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A5F2B',
  },

  sidebarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },

  sidebarUserText: {
    fontSize: 11,
    color: '#D1FAE5',
    marginTop: 2,
    fontWeight: '600',
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

  badge: {
    backgroundColor: '#F5A623',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },

  badgeText: {
    color: '#1A5F2B',
    fontSize: 11,
    fontWeight: 'bold',
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
    fontWeight: '700',
    color: '#1A5F2B',
  },

  sidebarFooterSubtext: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  },
});