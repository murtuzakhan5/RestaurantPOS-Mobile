import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';

let UsbPrinterModule = null;

const loadUsbPrinterModule = () => {
  if (UsbPrinterModule) return UsbPrinterModule;

  try {
    const imported = require('react-native-printer-usb');
    UsbPrinterModule = imported?.default || imported;
    return UsbPrinterModule;
  } catch (err) {
    console.log('USB printer module load failed:', err);
    throw new Error(
      'USB printer native module not found. Install react-native-printer-usb and rebuild APK with EAS.'
    );
  }
};

const PRINTER_SETTINGS_KEY = 'billpak_printer_settings';

const defaultPrinterSettings = {
  enabled: false,
  type: 'usb_escpos',
  productId: null,
  vendorId: null,
  deviceId: null,
  deviceName: '',
  manufacturerName: '',
  paperWidth: 80,
  autoCut: true,
  encoding: 'UTF-8',
};

export const getPrinterSettings = async () => {
  const saved = await AsyncStorage.getItem(PRINTER_SETTINGS_KEY);
  if (!saved) return defaultPrinterSettings;

  try {
    return { ...defaultPrinterSettings, ...JSON.parse(saved) };
  } catch {
    return defaultPrinterSettings;
  }
};

export const savePrinterSettings = async (settings = {}) => {
  const finalSettings = {
    ...defaultPrinterSettings,
    ...settings,
    enabled: settings?.enabled ?? true,
    type: 'usb_escpos',
  };

  await AsyncStorage.setItem(PRINTER_SETTINGS_KEY, JSON.stringify(finalSettings));
  return finalSettings;
};

export const clearPrinterSettings = async () => {
  await AsyncStorage.removeItem(PRINTER_SETTINGS_KEY);
};

const getReceiptWidth = (paperWidth = 80) => (Number(paperWidth) === 58 ? 32 : 42);
const getImageWidthPx = (paperWidth = 80) => (Number(paperWidth) === 58 ? 280 : 384);

const money = (amount) => Number(amount || 0).toFixed(2);

const safeText = (value = '') =>
  String(value ?? '')
    .replace(/\r/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .trim();

const asciiText = (value = '') =>
  String(value ?? '')
    .replace(/[^\x20-\x7E\n]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .trim();

const separator = (width = 42, char = '-') => char.repeat(width);

const center = (text, width = 42) => {
  const value = asciiText(text);
  if (value.length >= width) return value.substring(0, width);
  const spaceCount = Math.max(Math.floor((width - value.length) / 2), 0);
  return `${' '.repeat(spaceCount)}${value}`;
};

const line = (left, right = '', width = 42) => {
  const l = asciiText(left);
  const r = asciiText(right);

  if (l.length + r.length >= width) {
    return `${l.substring(0, Math.max(width - r.length - 1, 1))} ${r}`;
  }

  return `${l}${' '.repeat(Math.max(width - l.length - r.length, 1))}${r}`;
};

const wrapText = (text, width = 42) => {
  const words = asciiText(text).split(' ').filter(Boolean);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }

    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

const centeredWrappedText = (text, width = 42) =>
  wrapText(text, width).map((lineText) => center(lineText, width)).join('\n');

const normalizeBase64Image = (image) => {
  if (!image) return null;
  if (typeof image !== 'string') return null;

  const value = image.trim();
  if (!value) return null;

  if (value.startsWith('data:image')) {
    const parts = value.split(',');
    return parts.length > 1 ? parts[1] : null;
  }

  if (value.startsWith('file://')) {
    console.log('Logo/image is file path. Convert to base64 before printing:', value);
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    console.log('Logo/image is URL. Convert to base64 before printing:', value);
    return null;
  }

  if (value.length > 100) return value;

  return null;
};

const normalizeLogoUri = (logo) => {
  if (!logo || typeof logo !== 'string') return null;

  const value = logo.trim();

  if (value.startsWith('data:image')) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('file://')) return value;
  if (value.length > 100) return `data:image/png;base64,${value}`;

  return null;
};

const getUrduName = (item = {}) =>
  safeText(
    item?.nameUrdu ||
      item?.urduName ||
      item?.name_urdu ||
      item?.productNameUrdu ||
      item?.product_name_urdu ||
      item?.product?.nameUrdu ||
      item?.product?.urduName ||
      item?.product?.name_urdu ||
      ''
  );

const getItemName = (item = {}) =>
  safeText(item?.name || item?.productName || item?.product?.name || 'Item');

const getQty = (item = {}) => Number(item?.quantity || item?.qty || 0);
const getPrice = (item = {}) => Number(item?.price || item?.salePrice || item?.rate || 0);

const addUrduLine = (receipt, text) => {
  const value = safeText(text);
  if (!value) return receipt;
  return `${receipt}${value}\n`;
};

export const listUsbPrinters = async () => {
  const module = loadUsbPrinterModule();
  const getList = module.getList || module.listPrinters || module.getPrinters;

  if (typeof getList !== 'function') {
    throw new Error('USB printer module does not expose getList/listPrinters/getPrinters.');
  }

  const devices = await Promise.resolve(getList());
  return Array.isArray(devices) ? devices : [];
};

export const autoConfigureFirstUsbPrinter = async () => {
  const devices = await listUsbPrinters();

  if (!devices.length) {
    throw new Error('No USB printer found. Connect printer with OTG/USB and try again.');
  }

  const printer = devices[0];

  return savePrinterSettings({
    enabled: true,
    type: 'usb_escpos',
    productId: printer.productId,
    vendorId: printer.vendorId,
    deviceId: printer.deviceId,
    deviceName: printer.deviceName || printer.productName || '',
    manufacturerName: printer.manufacturerName || '',
    paperWidth: 80,
    autoCut: true,
    encoding: 'UTF-8',
  });
};

const getWorkingSettings = async () => {
  let settings = await getPrinterSettings();

  if (settings.enabled && settings.productId) return settings;

  settings = await autoConfigureFirstUsbPrinter();
  return settings;
};

const sendTextToUsbPrinter = async (text, options = {}) => {
  const module = loadUsbPrinterModule();
  const printText = module.printText || module.printRawText || module.print;

  const settings = await getWorkingSettings();

  if (typeof printText !== 'function') {
    throw new Error('printText()/printRawText()/print() not found in USB printer module.');
  }

  if (!settings.productId) {
    throw new Error('USB printer productId missing. Configure printer first.');
  }

  return printText({
    text,
    productId: settings.productId,
    vendorId: settings.vendorId,
    deviceId: settings.deviceId,
    align: options.align || 'left',
    encoding: options.encoding || settings.encoding || 'UTF-8',
    bold: Boolean(options.bold),
    underline: Boolean(options.underline),
    font: options.font || 'A',
    size: options.size || 1,
    cut: options.cut ?? false,
    beep: options.beep ?? false,
    tailingLine: options.tailingLine ?? true,
  });
};

export const printBase64ImageToUsbPrinter = async (base64Image, options = {}) => {
  const module = loadUsbPrinterModule();
  const settings = await getWorkingSettings();

  const cleanBase64 = normalizeBase64Image(base64Image);

  if (!cleanBase64) {
    throw new Error('Image base64 missing/invalid. Pass raw base64 or data:image/png;base64,...');
  }

  const imageFn =
    module.printImageBase64 ||
    module.printImage ||
    module.printBitmap ||
    module.printPic ||
    module.printRasterImage;

  console.log('USB printer module keys:', Object.keys(module || {}));
  console.log('USB image function found:', typeof imageFn === 'function');

  if (typeof imageFn !== 'function') {
    throw new Error(
      'This USB printer module does not expose image printing. Need printImageBase64/printImage/printBitmap support.'
    );
  }

  const payload = {
    image: cleanBase64,
    data: cleanBase64,
    base64: cleanBase64,
    productId: settings.productId,
    vendorId: settings.vendorId,
    deviceId: settings.deviceId,
    width: options.width || getImageWidthPx(settings.paperWidth),
    height: options.height,
    align: options.align || 'center',
    cut: options.cut ?? false,
    beep: options.beep ?? false,
    tailingLine: options.tailingLine ?? true,
  };

  try {
    return await imageFn(payload);
  } catch (err) {
    console.log('USB image print failed with object payload:', err);

    try {
      return await imageFn(cleanBase64, settings.productId);
    } catch (err2) {
      console.log('USB image print failed with fallback payload:', err2);
      throw err2;
    }
  }
};

const tryPrintLogo = async (restaurantLogo) => {
  const base64Logo = normalizeBase64Image(restaurantLogo);

  console.log('Restaurant logo received:', Boolean(restaurantLogo));
  console.log('Restaurant logo valid base64:', Boolean(base64Logo));

  if (!base64Logo) return false;

  try {
    await printBase64ImageToUsbPrinter(base64Logo, {
      width: 160,
      align: 'center',
      cut: false,
      beep: false,
      tailingLine: true,
    });

    await sendTextToUsbPrinter('\n', { cut: false, beep: false });
    return true;
  } catch (err) {
    console.log('Logo print failed:', err);
    return false;
  }
};

export const buildKotText = ({
  restaurantName,
  billNo,
  tokenNo,
  cashierName,
  categoryName,
  items,
  paperWidth = 80,
}) => {
  const width = getReceiptWidth(paperWidth);
  const now = new Date().toLocaleString('en-PK');

  let receipt = '';

  receipt += `${centeredWrappedText(restaurantName || 'BillPak', width)}\n`;
  receipt += `${center('TAKEAWAY KOT', width)}\n`;
  receipt += `${centeredWrappedText(String(categoryName || 'Kitchen').toUpperCase(), width)}\n`;
  receipt += `${separator(width, '=')}\n`;
  receipt += `${center(`TOKEN #${tokenNo}`, width)}\n`;
  receipt += `${separator(width, '=')}\n`;
  receipt += `Bill: ${asciiText(billNo)}\n`;
  receipt += `Time: ${asciiText(now)}\n`;
  receipt += `Cashier: ${asciiText(cashierName || 'Cashier')}\n`;
  receipt += `Section: ${asciiText(categoryName || 'Kitchen')}\n`;
  receipt += `${separator(width)}\n`;

  (items || []).forEach((item) => {
    const itemName = getItemName(item);
    const qty = getQty(item);
    const urduName = getUrduName(item);

    receipt += `${line(itemName, `x${qty}`, width)}\n`;

    if (urduName) {
      receipt = addUrduLine(receipt, urduName);
    }
  });

  receipt += `${separator(width)}\n`;
  receipt += `${centeredWrappedText(`Kitchen Copy - ${categoryName || 'Kitchen'}`, width)}\n`;
  receipt += '\n\n\n';

  return receipt;
};

export const buildInvoiceText = ({
  restaurantName,
  restaurantAddress,
  billNo,
  tokenNo,
  cashierName,
  cart,
  subtotal,
  discountAmount,
  discountType,
  discountValue,
  total,
  paperWidth = 80,
  orderType = 'Takeaway',
}) => {
  const width = getReceiptWidth(paperWidth);
  const now = new Date().toLocaleString('en-PK');

  let receipt = '';

  receipt += `${centeredWrappedText(restaurantName || 'BillPak', width)}\n`;

  if (restaurantAddress) {
    receipt += `${centeredWrappedText(restaurantAddress, width)}\n`;
  }

  receipt += `${separator(width, '=')}\n`;
  receipt += `${center(orderType === 'Dine-In' ? 'DINE-IN INVOICE' : 'SALES INVOICE', width)}\n`;
  receipt += `${separator(width, '=')}\n`;

  receipt += `${line('Invoice No', billNo, width)}\n`;

  if (orderType === 'Dine-In') {
    receipt += `${line('Table No', tokenNo, width)}\n`;
  } else {
    receipt += `${line('Token No', `#${tokenNo}`, width)}\n`;
  }

  receipt += `${line('Date/Time', now, width)}\n`;
  receipt += `${line('Cashier', cashierName || 'Cashier', width)}\n`;
  receipt += `${line('Payment', 'Cash', width)}\n`;
  receipt += `${line('Order Type', orderType, width)}\n`;

  receipt += `${separator(width)}\n`;
  receipt += `${line('Item', 'Amount', width)}\n`;
  receipt += `${separator(width)}\n`;

  (cart || []).forEach((item) => {
    const itemName = getItemName(item);
    const qty = getQty(item);
    const price = getPrice(item);
    const itemTotal = qty * price;
    const urduName = getUrduName(item);

    const itemLines = wrapText(`${itemName}${item?.isCustom ? ' *' : ''}`, width);
    itemLines.forEach((itemLine) => {
      receipt += `${itemLine}\n`;
    });

    if (urduName) {
      receipt = addUrduLine(receipt, urduName);
    }

    receipt += `${line(`${qty} x Rs ${money(price)}`, `Rs ${money(itemTotal)}`, width)}\n`;
  });

  receipt += `${separator(width)}\n`;
  receipt += `${line('Sub Total', `Rs ${money(subtotal)}`, width)}\n`;

  if (Number(discountAmount || 0) > 0) {
    const discountLabel =
      discountType === 'percentage'
        ? `Discount (${discountValue}%)`
        : 'Discount';

    receipt += `${line(discountLabel, `-Rs ${money(discountAmount)}`, width)}\n`;
  }

  receipt += `${separator(width, '=')}\n`;
  receipt += `${line('TOTAL', `Rs ${money(total)}`, width)}\n`;
  receipt += `${separator(width, '=')}\n`;

  receipt += '\n';
  receipt += `${separator(width)}\n`;
  receipt += `${center('Thank you!', width)}\n`;
  receipt += `${center('Powered by AMS Crafters', width)}\n`;
  receipt += `${separator(width)}\n`;
  receipt += '\n\n\n';

  return receipt;
};

export const printImageReceiptDirect = async ({
  receiptImageBase64,
  cut = true,
  beep = true,
  width,
}) => {
  await printBase64ImageToUsbPrinter(receiptImageBase64, {
    width,
    align: 'center',
    cut: false,
    beep: false,
    tailingLine: true,
  });

  await sendTextToUsbPrinter('\n\n\n', {
    cut,
    beep,
    tailingLine: true,
  });

  return true;
};

export const printKotThenInvoiceDirect = async ({
  restaurantLogo,
  restaurantName,
  restaurantAddress,
  billNo,
  tokenNo,
  cashierName,
  groupedCart,
  cart,
  subtotal,
  discountAmount,
  discountType,
  discountValue,
  total,
  invoiceImageBase64,
  kotImageBase64ByCategory,
}) => {
  const settings = await getWorkingSettings();

  if (!settings.enabled) {
    throw new Error('Direct USB printer is disabled.');
  }

  const paperWidth = settings.paperWidth || 80;
  const autoCut = settings.autoCut !== false;

  const groups = Object.entries(groupedCart || {});

  if (!groups.length) {
    throw new Error('No KOT items found for printing.');
  }

  for (const [categoryName, items] of groups) {
    const kotImage = kotImageBase64ByCategory?.[categoryName];

    if (kotImage) {
      await printImageReceiptDirect({
        receiptImageBase64: kotImage,
        cut: autoCut,
        beep: false,
        width: getImageWidthPx(paperWidth),
      });
      continue;
    }

    const kotText = buildKotText({
      restaurantName,
      billNo,
      tokenNo,
      cashierName,
      categoryName,
      items,
      paperWidth,
    });

    await sendTextToUsbPrinter(kotText, {
      cut: autoCut,
      beep: false,
      tailingLine: true,
    });
  }

  if (invoiceImageBase64) {
    await printImageReceiptDirect({
      receiptImageBase64: invoiceImageBase64,
      cut: autoCut,
      beep: true,
      width: getImageWidthPx(paperWidth),
    });
    return true;
  }

  await tryPrintLogo(restaurantLogo);

  const invoiceText = buildInvoiceText({
    restaurantName,
    restaurantAddress,
    billNo,
    tokenNo,
    cashierName,
    cart,
    subtotal,
    discountAmount,
    discountType,
    discountValue,
    total,
    paperWidth,
    orderType: 'Takeaway',
  });

  await sendTextToUsbPrinter(invoiceText, {
    cut: autoCut,
    beep: true,
    tailingLine: true,
  });

  return true;
};

export const buildDineInKotText = ({
  restaurantName,
  billNo,
  tableNumber,
  cashierName,
  items,
  paperWidth = 80,
}) => {
  const width = getReceiptWidth(paperWidth);
  const now = new Date().toLocaleString('en-PK');

  let receipt = '';

  receipt += `${centeredWrappedText(restaurantName || 'BillPak', width)}\n`;
  receipt += `${center('DINE-IN KOT', width)}\n`;
  receipt += `${separator(width, '=')}\n`;
  receipt += `${center(`TABLE ${tableNumber || ''}`, width)}\n`;
  receipt += `${separator(width, '=')}\n`;
  receipt += `${line('KOT No', billNo, width)}\n`;
  receipt += `${line('Time', now, width)}\n`;
  receipt += `${line('Cashier', cashierName || 'Cashier', width)}\n`;
  receipt += `${separator(width)}\n`;

  (items || []).forEach((item) => {
    const itemName = getItemName(item);
    const qty = getQty(item);
    const urduName = getUrduName(item);

    receipt += `${line(itemName, `x${qty}`, width)}\n`;

    if (urduName) {
      receipt = addUrduLine(receipt, urduName);
    }
  });

  receipt += `${separator(width)}\n`;
  receipt += `${center('Kitchen Copy', width)}\n`;
  receipt += '\n\n\n\n\n';

  return receipt;
};

export const printDineInKotDirect = async ({
  restaurantName,
  billNo,
  tableNumber,
  cashierName,
  items,
  kotImageBase64,
}) => {
  const settings = await getWorkingSettings();

  if (!settings.enabled) {
    throw new Error('Direct USB printer is disabled.');
  }

  if (kotImageBase64) {
    return printImageReceiptDirect({
      receiptImageBase64: kotImageBase64,
      cut: settings.autoCut !== false,
      beep: false,
      width: getImageWidthPx(settings.paperWidth || 80),
    });
  }

  const kotText = buildDineInKotText({
    restaurantName,
    billNo,
    tableNumber,
    cashierName,
    items,
    paperWidth: settings.paperWidth || 80,
  });

  await sendTextToUsbPrinter(kotText, {
    cut: settings.autoCut !== false,
    beep: false,
    tailingLine: true,
  });

  return true;
};

export const printDineInInvoiceDirect = async ({
  restaurantLogo,
  restaurantName,
  restaurantAddress,
  billNo,
  tableNumber,
  cashierName,
  items,
  subtotal,
  discountAmount,
  discountType,
  discountValue,
  total,
  invoiceImageBase64,
}) => {
  const settings = await getWorkingSettings();

  if (!settings.enabled) {
    throw new Error('Direct USB printer is disabled.');
  }

  if (invoiceImageBase64) {
    return printImageReceiptDirect({
      receiptImageBase64: invoiceImageBase64,
      cut: settings.autoCut !== false,
      beep: true,
      width: getImageWidthPx(settings.paperWidth || 80),
    });
  }

  await tryPrintLogo(restaurantLogo);

  const invoiceText = buildInvoiceText({
    restaurantName,
    restaurantAddress,
    billNo,
    tokenNo: tableNumber || '',
    cashierName,
    cart: items,
    subtotal,
    discountAmount,
    discountType,
    discountValue,
    total,
    paperWidth: settings.paperWidth || 80,
    orderType: 'Dine-In',
  });

  await sendTextToUsbPrinter(invoiceText, {
    cut: settings.autoCut !== false,
    beep: true,
    tailingLine: true,
  });

  return true;
};

export const testUsbPrinter = async () => {
  const settings = await getWorkingSettings();
  const width = getReceiptWidth(settings.paperWidth);

  console.log('USB test settings:', settings);

  const testText =
    `${center('BillPak Printer Test', width)}\n` +
    `${separator(width)}\n` +
    `Printer: ${settings.deviceName || 'USB Printer'}\n` +
    `Product ID: ${settings.productId}\n` +
    `Vendor ID: ${settings.vendorId || 'N/A'}\n` +
    `Time: ${new Date().toLocaleString('en-PK')}\n` +
    `${separator(width)}\n` +
    `Urdu Raw Text Test Below:\n` +
    `اردو ٹیسٹ\n` +
    `${separator(width)}\n` +
    `${center('Test successful', width)}\n` +
    `${separator(width)}\n` +
    `${center('Powered by AMS Crafters', width)}\n\n\n`;

  await sendTextToUsbPrinter(testText, {
    cut: settings.autoCut !== false,
    beep: true,
    encoding: 'UTF-8',
  });

  return true;
};

export const __debugUsbPrinterModule = () => {
  const module = loadUsbPrinterModule();
  console.log('USB printer module keys:', Object.keys(module || {}));
  return Object.keys(module || {});
};

/* ============================================================
   HIDDEN RECEIPT CAPTURE COMPONENTS
   Use these in your print screen to create image receipt.
   This is required for reliable Urdu/logo printing.
============================================================ */

const Row = ({ left, right, bold = false, large = false }) => (
  <View style={styles.row}>
    <Text
      style={[
        styles.text,
        bold && styles.bold,
        large && styles.largeText,
        { flex: 1, textAlign: 'left' },
      ]}
    >
      {safeText(left)}
    </Text>
    <Text style={[styles.text, bold && styles.bold, large && styles.largeText, styles.rightText]}>
      {safeText(right)}
    </Text>
  </View>
);

const Separator = ({ strong = false }) => (
  <View style={[styles.separatorLine, strong && styles.strongSeparatorLine]} />
);

const UrduText = ({ children }) => {
  const value = safeText(children);
  if (!value) return null;

  return <Text style={styles.urduText}>{value}</Text>;
};

const ReceiptShell = forwardRef(({ paperWidth = 80, children }, ref) => {
  const width = getImageWidthPx(paperWidth);

  return (
    <View pointerEvents="none" style={styles.hiddenWrapper}>
      <ViewShot
        ref={ref}
        options={{ format: 'png', quality: 1, result: 'base64' }}
        style={[styles.captureArea, { width }]}
      >
        <View collapsable={false} style={[styles.paper, { width }]}>
          {children}
        </View>
      </ViewShot>
    </View>
  );
});

export const ThermalInvoiceCapture = forwardRef(
  (
    {
      restaurantName,
      restaurantAddress,
      restaurantLogo,
      billNo,
      tokenNo,
      tableNumber,
      cashierName,
      cart,
      items,
      subtotal,
      discountAmount,
      discountType,
      discountValue,
      total,
      paperWidth = 80,
      orderType = 'Takeaway',
    },
    ref
  ) => {
    const logoUri = normalizeLogoUri(restaurantLogo);
    const list = Array.isArray(cart) ? cart : Array.isArray(items) ? items : [];
    const isDineIn = orderType === 'Dine-In';
    const now = new Date().toLocaleString('en-PK');

    return (
      <ReceiptShell ref={ref} paperWidth={paperWidth}>
        {!!logoUri && <Image source={{ uri: logoUri }} resizeMode="contain" style={styles.logo} />}

        <Text style={styles.restaurantName}>{safeText(restaurantName || 'BillPak')}</Text>

        {!!restaurantAddress && <Text style={styles.address}>{safeText(restaurantAddress)}</Text>}

        <Separator strong />

        <Text style={styles.heading}>{isDineIn ? 'DINE-IN INVOICE' : 'TAKEAWAY INVOICE'}</Text>

        <Separator strong />

        <Text style={styles.tokenText}>
          {isDineIn ? `TABLE ${tableNumber || tokenNo || ''}` : `TOKEN #${tokenNo}`}
        </Text>

        <Separator />

        <Row left="Bill No:" right={billNo} />
        <Row left="Date:" right={now} />
        <Row left="Cashier:" right={cashierName || 'Cashier'} />
        <Row left="Payment:" right="Cash" />

        <Separator />

        <Row left="ITEM" right="TOTAL" bold />

        <Separator />

        {list.map((item, index) => {
          const qty = getQty(item);
          const price = getPrice(item);
          const itemTotal = qty * price;
          const urduName = getUrduName(item);

          return (
            <View key={`${getItemName(item)}-${index}`} style={styles.itemBlock}>
              <Text style={styles.itemName}>
                {getItemName(item)}
                {item?.isCustom ? ' *' : ''}
              </Text>

              <UrduText>{urduName}</UrduText>

              <Row left={`  ${qty} x Rs.${money(price)}`} right={`Rs.${money(itemTotal)}`} />
            </View>
          );
        })}

        <Separator />

        <Row left="Subtotal" right={`Rs.${money(subtotal)}`} />

        {Number(discountAmount || 0) > 0 && (
          <Row
            left={discountType === 'percentage' ? `Discount (${discountValue}%)` : 'Discount'}
            right={`-Rs.${money(discountAmount)}`}
          />
        )}

        <Separator strong />

        <Row left="TOTAL" right={`Rs.${money(total)}`} bold large />

        <Separator strong />

        <Text style={styles.thankYou}>
          {isDineIn ? 'Thank you for dining with us!' : 'Thank you for ordering!'}
        </Text>

        <Text style={styles.powered}>Powered by BillPak</Text>

        <View style={styles.bottomGap} />
      </ReceiptShell>
    );
  }
);

export const ThermalKotCapture = forwardRef(
  (
    {
      restaurantName,
      billNo,
      tokenNo,
      tableNumber,
      cashierName,
      categoryName,
      items = [],
      paperWidth = 80,
      orderType = 'Takeaway',
    },
    ref
  ) => {
    const isDineIn = orderType === 'Dine-In';
    const title = isDineIn ? 'DINE-IN KOT' : 'TAKEAWAY KOT';
    const mainToken = isDineIn ? `TABLE ${tableNumber || ''}` : `TOKEN #${tokenNo}`;
    const now = new Date().toLocaleString('en-PK');

    return (
      <ReceiptShell ref={ref} paperWidth={paperWidth}>
        <Text style={styles.restaurantName}>{safeText(restaurantName || 'BillPak')}</Text>
        <Text style={styles.heading}>{title}</Text>

        {!!categoryName && (
          <Text style={styles.centerText}>{String(categoryName).toUpperCase()}</Text>
        )}

        <Separator strong />
        <Text style={styles.tokenText}>{mainToken}</Text>
        <Separator strong />

        <Row left="Bill No" right={billNo} />
        <Row left="Time" right={now} />
        <Row left="Cashier" right={cashierName || 'Cashier'} />
        {!!categoryName && <Row left="Section" right={categoryName} />}

        <Separator />

        {items.map((item, index) => {
          const urduName = getUrduName(item);

          return (
            <View key={`${getItemName(item)}-${index}`} style={styles.itemBlock}>
              <Row left={getItemName(item)} right={`x${getQty(item)}`} bold />
              <UrduText>{urduName}</UrduText>
            </View>
          );
        })}

        <Separator />
        <Text style={styles.centerText}>Kitchen Copy{categoryName ? ` - ${categoryName}` : ''}</Text>
        <View style={styles.bottomGap} />
      </ReceiptShell>
    );
  }
);

export const captureThermalReceiptBase64 = async (receiptRef) => {
  if (!receiptRef?.current?.capture) {
    throw new Error('Receipt ref is missing. Attach ref to ThermalInvoiceCapture/ThermalKotCapture.');
  }

  return receiptRef.current.capture();
};

const styles = StyleSheet.create({
  hiddenWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0.01,
    zIndex: -9999,
  },
  captureArea: {
    backgroundColor: '#FFFFFF',
  },
  paper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  logo: {
    alignSelf: 'center',
    width: 150,
    height: 75,
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#000000',
    textAlign: 'center',
  },
  address: {
    fontSize: 16,
    lineHeight: 21,
    color: '#000000',
    textAlign: 'center',
    marginTop: 2,
  },
  heading: {
    fontSize: 19,
    lineHeight: 25,
    color: '#000000',
    fontWeight: '800',
    textAlign: 'center',
  },
  tokenText: {
    fontSize: 28,
    lineHeight: 36,
    color: '#000000',
    fontWeight: '900',
    textAlign: 'center',
  },
  centerText: {
    fontSize: 17,
    lineHeight: 23,
    color: '#000000',
    textAlign: 'center',
    fontWeight: '700',
  },
  text: {
    fontSize: 17,
    lineHeight: 24,
    color: '#000000',
  },
  rightText: {
    minWidth: 90,
    textAlign: 'right',
  },
  bold: {
    fontWeight: '800',
  },
  largeText: {
    fontSize: 23,
    lineHeight: 30,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  separatorLine: {
    height: 1,
    backgroundColor: '#000000',
    marginVertical: 5,
  },
  strongSeparatorLine: {
    height: 2,
  },
  itemBlock: {
    marginBottom: 3,
  },
  itemName: {
    fontSize: 17,
    lineHeight: 24,
    color: '#000000',
    fontWeight: '700',
    textAlign: 'left',
  },
  urduText: {
    fontSize: 24,
    lineHeight: 34,
    color: '#000000',
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
    marginVertical: 1,
  },
  thankYou: {
    fontSize: 18,
    lineHeight: 24,
    color: '#000000',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  powered: {
    fontSize: 15,
    lineHeight: 21,
    color: '#000000',
    textAlign: 'center',
  },
  bottomGap: {
    height: 45,
  },
});