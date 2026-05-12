import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

interface KOTItem {
  name: string;
  quantity: number;
  notes?: string;
}

export default function KOTInvoiceScreen() {
  const params = useLocalSearchParams();
  const kotData = params.data ? JSON.parse(params.data as string) : null;

  if (!kotData) {
    return (
      <View style={styles.container}>
        <Text>No KOT data found</Text>
      </View>
    );
  }

  const generateKOTHTML = () => {
    const date = new Date();
    const formattedDate = `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
    const formattedTime = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    // Daily token - resets at midnight
    const getDailyToken = () => {
      const today = new Date().toDateString();
      // In production, get from server or local storage
      return Math.floor(Math.random() * 100) + 1;
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>KOT Invoice</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            width: 72mm;
            margin: 0 auto;
            padding: 5px;
            background: #fff;
            font-size: 12px;
          }
          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 5px;
            margin-bottom: 10px;
          }
          .header h1 {
            font-size: 16px;
            margin: 0;
          }
          .header p {
            margin: 2px 0;
            font-size: 10px;
          }
          .kot-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-weight: bold;
          }
          .table-info {
            background: #f0f0f0;
            padding: 5px;
            text-align: center;
            margin-bottom: 10px;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
          }
          th {
            text-align: left;
            border-bottom: 1px dashed #000;
            padding: 5px 0;
          }
          td {
            padding: 3px 0;
          }
          .item-name {
            width: 60%;
          }
          .item-qty {
            width: 20%;
            text-align: center;
          }
          .item-notes {
            font-size: 10px;
            color: #666;
            font-style: italic;
          }
          .footer {
            margin-top: 15px;
            border-top: 1px dashed #000;
            padding-top: 5px;
            text-align: center;
            font-size: 10px;
          }
          .token {
            font-size: 20px;
            font-weight: bold;
            text-align: center;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ASANBILLING</h1>
          <p>Kitchen Order Ticket</p>
        </div>

        <div class="kot-info">
          <span>KOT #: ${kotData.kotId}</span>
          <span>${formattedDate} ${formattedTime}</span>
        </div>

        <div class="token">
          Token #: ${getDailyToken()}
        </div>

        <div class="table-info">
          ${kotData.tableNo} | ${kotData.orderType === 'dinein' ? 'Dine In' : 'Take Away'}
        </div>

        <table>
          <thead>
            <tr>
              <th class="item-name">Item</th>
              <th class="item-qty">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${kotData.items.map((item: KOTItem) => `
              <tr>
                <td class="item-name">${item.name}</td>
                <td class="item-qty">${item.quantity}</td>
              </tr>
              ${item.notes ? `
                <tr>
                  <td colspan="2" class="item-notes">Note: ${item.notes}</td>
                </tr>
              ` : ''}
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Thank you</p>
          <p>Developed by AMS Crafters</p>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    try {
      const html = generateKOTHTML();
      
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        }
      }
    } catch (error) {
      console.error('Print error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>KOT Preview</Text>
        <TouchableOpacity onPress={handlePrint}>
          <Ionicons name="print-outline" size={24} color="#4a55a2" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Kitchen Order Ticket</Text>
          <Text style={styles.kotId}>KOT: {kotData.kotId}</Text>
          <Text style={styles.tableNo}>{kotData.tableNo}</Text>
          {kotData.items.map((item: KOTItem, index: number) => (
            <View key={index} style={styles.previewItem}>
              <Text style={styles.previewItemName}>{item.name}</Text>
              <Text style={styles.previewItemQty}>x{item.quantity}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    elevation: 2,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  kotId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  tableNo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4a55a2',
    marginBottom: 15,
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  previewItemName: {
    fontSize: 14,
    color: '#333',
  },
  previewItemQty: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4a55a2',
  },
});