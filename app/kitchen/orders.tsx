import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface KOTItem {
  productId: number;
  name: string;
  quantity: number;
  notes?: string;
}

interface KOT {
  id: string;
  tableNo: string;
  items: KOTItem[];
  status: 'pending' | 'preparing' | 'ready';
  timestamp: Date;
  orderType: 'dinein' | 'takeaway';
}

export default function KitchenOrdersScreen() {
  const [kotList, setKotList] = useState<KOT[]>([]);
  const [filteredKots, setFilteredKots] = useState<KOT[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadKOTs();
    
    // Auto refresh every 10 seconds
    const interval = setInterval(loadKOTs, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterKOTs();
  }, [kotList, selectedFilter]);

  const loadKOTs = async () => {
    try {
      setRefreshing(true);
      
      // Load from AsyncStorage (temporary - replace with API call)
      const allTables = await AsyncStorage.getAllKeys();
      const kotKeys = allTables.filter(key => key.startsWith('kots_'));
      
      let allKOTs: KOT[] = [];
      
      for (const key of kotKeys) {
        const kotStr = await AsyncStorage.getItem(key);
        if (kotStr) {
          const tableKOTs = JSON.parse(kotStr);
          allKOTs = [...allKOTs, ...tableKOTs];
        }
      }
      
      // Sort by timestamp (newest first)
      allKOTs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setKotList(allKOTs);
    } catch (error) {
      console.error('Error loading KOTs:', error);
      Alert.alert('Error', 'Failed to load kitchen orders');
    } finally {
      setRefreshing(false);
    }
  };

  const filterKOTs = () => {
    if (selectedFilter === 'all') {
      setFilteredKots(kotList);
    } else {
      setFilteredKots(kotList.filter(kot => kot.status === selectedFilter));
    }
  };

  const updateKOTStatus = async (kotId: string, newStatus: 'preparing' | 'ready') => {
    try {
      // Find the KOT and update
      const updatedKots = kotList.map(kot => {
        if (kot.id === kotId) {
          return { ...kot, status: newStatus };
        }
        return kot;
      });
      
      setKotList(updatedKots);
      
      // Save back to AsyncStorage (find which table it belongs to)
      const tableKey = `kots_${kotId.split('_')[0]}`; // Assuming KOT ID format includes table info
      const tableKots = updatedKots.filter(kot => kot.tableNo === kotList.find(k => k.id === kotId)?.tableNo);
      
      await AsyncStorage.setItem(tableKey, JSON.stringify(tableKots));
      
      // Optional: API call to update backend
      // await api.patch(`/kitchen/orders/${kotId}`, { status: newStatus });
      
    } catch (error) {
      console.error('Error updating KOT:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#ffa502';
      case 'preparing': return '#4a55a2';
      case 'ready': return '#2ecc71';
      default: return '#999';
    }
  };

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    return `${minutes} mins ago`;
  };

  const KOTCard = ({ kot }: { kot: KOT }) => (
    <View style={[styles.kotCard, { borderLeftColor: getStatusColor(kot.status) }]}>
      <View style={styles.kotHeader}>
        <View style={styles.kotHeaderLeft}>
          <Text style={styles.kotId}>{kot.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(kot.status) }]}>
            <Text style={styles.statusText}>{kot.status.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.kotTime}>{getTimeAgo(kot.timestamp)}</Text>
      </View>

      <View style={styles.tableInfo}>
        <Ionicons 
          name={kot.orderType === 'dinein' ? 'restaurant' : 'bag-handle'} 
          size={16} 
          color="#666" 
        />
        <Text style={styles.tableText}>
          {kot.orderType === 'dinein' ? kot.tableNo : 'Take Away'}
        </Text>
      </View>

      <View style={styles.itemsContainer}>
        {kot.items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <View style={styles.itemDetails}>
              <Text style={styles.itemQuantity}>x{item.quantity}</Text>
              {item.notes && (
                <Text style={styles.itemNotes}>Note: {item.notes}</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.kotFooter}>
        {kot.status === 'pending' && (
          <TouchableOpacity 
            style={[styles.actionBtn, styles.preparingBtn]}
            onPress={() => updateKOTStatus(kot.id, 'preparing')}
          >
            <Ionicons name="time-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Start Preparing</Text>
          </TouchableOpacity>
        )}
        
        {kot.status === 'preparing' && (
          <TouchableOpacity 
            style={[styles.actionBtn, styles.readyBtn]}
            onPress={() => updateKOTStatus(kot.id, 'ready')}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Mark Ready</Text>
          </TouchableOpacity>
        )}
        
        {kot.status === 'ready' && (
          <View style={styles.readyIndicator}>
            <Ionicons name="checkmark-circle" size={20} color="#2ecc71" />
            <Text style={styles.readyText}>Ready to Serve</Text>
          </View>
        )}
      </View>
    </View>
  );

  const FilterButton = ({ title, value, color }: { title: string; value: string; color: string }) => (
    <TouchableOpacity
      style={[styles.filterBtn, selectedFilter === value && { backgroundColor: color }]}
      onPress={() => setSelectedFilter(value)}
    >
      <Text style={[styles.filterBtnText, selectedFilter === value && styles.filterBtnTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const getCountByStatus = (status: string) => {
    if (status === 'all') return kotList.length;
    return kotList.filter(k => k.status === status).length;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kitchen Orders</Text>
        <TouchableOpacity onPress={loadKOTs}>
          <Ionicons name="refresh" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Status Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filtersContainer}
      >
        <FilterButton 
          title={`All (${getCountByStatus('all')})`} 
          value="all" 
          color="#4a55a2" 
        />
        <FilterButton 
          title={`Pending (${getCountByStatus('pending')})`} 
          value="pending" 
          color="#ffa502" 
        />
        <FilterButton 
          title={`Preparing (${getCountByStatus('preparing')})`} 
          value="preparing" 
          color="#4a55a2" 
        />
        <FilterButton 
          title={`Ready (${getCountByStatus('ready')})`} 
          value="ready" 
          color="#2ecc71" 
        />
      </ScrollView>

      {/* KOT List */}
      <FlatList
        data={filteredKots}
        renderItem={({ item }) => <KOTCard kot={item} />}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={loadKOTs}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No kitchen orders</Text>
            <Text style={styles.emptySubText}>New orders will appear here</Text>
          </View>
        }
      />

      {/* Summary Footer */}
      {kotList.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerStat}>
            <Text style={styles.footerStatLabel}>Pending</Text>
            <Text style={[styles.footerStatValue, { color: '#ffa502' }]}>
              {kotList.filter(k => k.status === 'pending').length}
            </Text>
          </View>
          <View style={styles.footerDivider} />
          <View style={styles.footerStat}>
            <Text style={styles.footerStatLabel}>Preparing</Text>
            <Text style={[styles.footerStatValue, { color: '#4a55a2' }]}>
              {kotList.filter(k => k.status === 'preparing').length}
            </Text>
          </View>
          <View style={styles.footerDivider} />
          <View style={styles.footerStat}>
            <Text style={styles.footerStatLabel}>Ready</Text>
            <Text style={[styles.footerStatValue, { color: '#2ecc71' }]}>
              {kotList.filter(k => k.status === 'ready').length}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#f0f0f0',
  },
  filterBtnText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  list: {
    padding: 15,
  },
  kotCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 5,
  },
  kotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  kotHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kotId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  kotTime: {
    fontSize: 11,
    color: '#999',
  },
  tableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  tableText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  itemsContainer: {
    marginBottom: 15,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    flex: 2,
  },
  itemDetails: {
    flex: 1,
    alignItems: 'flex-end',
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4a55a2',
  },
  itemNotes: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
  },
  kotFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  preparingBtn: {
    backgroundColor: '#4a55a2',
  },
  readyBtn: {
    backgroundColor: '#2ecc71',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  readyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },
  readyText: {
    color: '#2ecc71',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
  emptySubText: {
    fontSize: 13,
    color: '#ccc',
    marginTop: 5,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 5,
  },
  footerStat: {
    flex: 1,
    alignItems: 'center',
  },
  footerStatLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  footerStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  footerDivider: {
    width: 1,
    backgroundColor: '#eee',
    marginHorizontal: 10,
  },
});