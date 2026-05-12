import AsyncStorage from '@react-native-async-storage/async-storage';

/*
  BillPak USB Printer Service
  Direct USB ESC/POS text printing for Android thermal printers.

  Required:
  npm install react-native-printer-usb

  Note:
  This text-based USB service keeps KOT clean and invoice professional.
  Logo image printing on APK depends on whether your native USB library exposes printImage().
*/

let UsbPrinterModule = null;

const loadUsbPrinterModule = () => {
  if (UsbPrinterModule) return UsbPrinterModule;

  try {
    UsbPrinterModule = require('react-native-printer-usb');
    return UsbPrinterModule;
  } catch (error) {
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
  encoding: 'CP850',
};

export const getPrinterSettings = async () => {
  const saved = await AsyncStorage.getItem(PRINTER_SETTINGS_KEY);

  if (!saved) return defaultPrinterSettings;

  try {
    return {
      ...defaultPrinterSettings,
      ...JSON.parse(saved),
    };
  } catch {
    return defaultPrinterSettings;
  }
};

export const savePrinterSettings = async (settings) => {
  const finalSettings = {
    ...defaultPrinterSettings,
    ...settings,
    enabled: settings?.enabled ?? true,
    type: 'usb_escpos',
  };

  await AsyncStorage.setItem(
    PRINTER_SETTINGS_KEY,
    JSON.stringify(finalSettings)
  );

  return finalSettings;
};

export const clearPrinterSettings = async () => {
  await AsyncStorage.removeItem(PRINTER_SETTINGS_KEY);
};

const getReceiptWidth = (paperWidth = 80) => {
  return Number(paperWidth) === 58 ? 32 : 42;
};

const money = (amount) => {
  return Number(amount || 0).toFixed(2);
};

const safeText = (value = '') => {
  return String(value)
    .replace(/[^\x20-\x7E\n\r]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const separator = (width = 42, char = '-') => {
  return char.repeat(width);
};

const center = (text, width = 42) => {
  const value = safeText(text);

  if (value.length >= width) return value.substring(0, width);

  const spaceCount = Math.max(Math.floor((width - value.length) / 2), 0);

  return `${' '.repeat(spaceCount)}${value}`;
};

const line = (left, right = '', width = 42) => {
  const l = safeText(left);
  const r = safeText(right);

  if (l.length + r.length >= width) {
    return `${l.substring(0, Math.max(width - r.length - 1, 1))} ${r}`;
  }

  const spaceCount = Math.max(width - l.length - r.length, 1);

  return `${l}${' '.repeat(spaceCount)}${r}`;
};

const wrapText = (text, width = 42) => {
  const words = safeText(text).split(' ').filter(Boolean);
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

const centeredWrappedText = (text, width = 42) => {
  return wrapText(text, width)
    .map((lineText) => center(lineText, width))
    .join('\n');
};

export const listUsbPrinters = async () => {
  const { getList } = loadUsbPrinterModule();

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
    encoding: 'CP850',
  });
};

const getWorkingSettings = async () => {
  let settings = await getPrinterSettings();

  if (settings.enabled && settings.productId) {
    return settings;
  }

  settings = await autoConfigureFirstUsbPrinter();

  return settings;
};

const sendTextToUsbPrinter = async (text, options = {}) => {
  const { printText } = loadUsbPrinterModule();
  const settings = await getWorkingSettings();

  if (!settings.productId) {
    throw new Error('USB printer productId missing. Configure printer first.');
  }

  return printText({
    text,
    productId: settings.productId,
    align: options.align || 'left',
    encoding: settings.encoding || 'CP850',
    bold: Boolean(options.bold),
    underline: Boolean(options.underline),
    font: options.font || 'A',
    size: options.size || 1,
    cut: options.cut ?? false,
    beep: options.beep ?? false,
    tailingLine: options.tailingLine ?? true,
  });
};

/*
  KOT intentionally has NO branding/footer.
*/
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
  receipt += `Bill: ${safeText(billNo)}\n`;
  receipt += `Time: ${safeText(now)}\n`;
  receipt += `Cashier: ${safeText(cashierName || 'Cashier')}\n`;
  receipt += `Section: ${safeText(categoryName || 'Kitchen')}\n`;
  receipt += `${separator(width)}\n`;

  items.forEach((item) => {
    const itemName = item?.name || 'Item';
    const qty = Number(item?.quantity || 0);
    receipt += `${line(itemName, `x${qty}`, width)}\n`;
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
}) => {
  const width = getReceiptWidth(paperWidth);
  const now = new Date().toLocaleString('en-PK');

  let receipt = '';

  receipt += `${centeredWrappedText(restaurantName || 'BillPak', width)}\n`;

  if (restaurantAddress) {
    receipt += `${centeredWrappedText(restaurantAddress, width)}\n`;
  }

  receipt += `${separator(width, '=')}\n`;
  receipt += `${center('SALES INVOICE', width)}\n`;
  receipt += `${separator(width, '=')}\n`;

  receipt += `${line('Invoice No', billNo, width)}\n`;
  receipt += `${line('Token No', `#${tokenNo}`, width)}\n`;
  receipt += `${line('Date/Time', now, width)}\n`;
  receipt += `${line('Cashier', cashierName || 'Cashier', width)}\n`;
  receipt += `${line('Payment', 'Cash', width)}\n`;
  receipt += `${line('Order Type', 'Takeaway', width)}\n`;

  receipt += `${separator(width)}\n`;
  receipt += `${line('Item', 'Amount', width)}\n`;
  receipt += `${separator(width)}\n`;

  cart.forEach((item) => {
    const itemName = item?.name || 'Item';
    const qty = Number(item?.quantity || 0);
    const price = Number(item?.price || 0);
    const itemTotal = qty * price;

    const itemLines = wrapText(`${itemName}${item?.isCustom ? ' *' : ''}`, width);
    itemLines.forEach((itemLine) => {
      receipt += `${itemLine}\n`;
    });

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
  receipt += `${center('Powered by AMS Crafters', width)}\n`;
  receipt += `${separator(width)}\n`;
  receipt += '\n\n\n';

  return receipt;
};

export const printKotThenInvoiceDirect = async ({
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

  items.forEach((item) => {
    receipt += `${line(item?.name || 'Item', `x${Number(item?.quantity || 0)}`, width)}\n`;
  });

  receipt += `${separator(width)}\n`;
  receipt += `${center('Kitchen Copy', width)}\n`;
  receipt += '\n\n\n\n\n';

  return receipt;
};

export const buildDineInInvoiceText = ({
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
  paperWidth = 80,
}) => {
  const width = getReceiptWidth(paperWidth);
  const now = new Date().toLocaleString('en-PK');

  let receipt = '';

  receipt += `${centeredWrappedText(restaurantName || 'BillPak', width)}\n`;

  if (restaurantAddress) {
    receipt += `${centeredWrappedText(restaurantAddress, width)}\n`;
  }

  receipt += `${separator(width, '*')}\n`;
  receipt += `${center('DINE-IN INVOICE', width)}\n`;
  receipt += `${separator(width, '*')}\n`;
  receipt += `${center(`TABLE ${tableNumber || ''}`, width)}\n`;
  receipt += `${separator(width, '~')}\n`;
  receipt += `${line('Bill No:', billNo, width)}\n`;
  receipt += `${line('Date:', now, width)}\n`;
  receipt += `${line('Cashier:', cashierName || 'Cashier', width)}\n`;
  receipt += `${line('Payment:', 'Cash', width)}\n`;
  receipt += `${separator(width)}\n`;
  receipt += `${line('ITEM', 'TOTAL', width)}\n`;
  receipt += `${separator(width)}\n`;

  items.forEach((item) => {
    const qty = Number(item?.quantity || 0);
    const price = Number(item?.price || 0);
    const itemTotal = qty * price;
    const itemLines = wrapText(`${item?.name || 'Item'}${item?.isCustom ? ' *' : ''}`, width);
    itemLines.forEach((itemLine) => {
      receipt += `${itemLine}\n`;
    });
    receipt += `${line(`  ${qty} x Rs ${money(price)}`, `Rs ${money(itemTotal)}`, width)}\n`;
  });

  receipt += `${separator(width)}\n`;
  receipt += `${line('Subtotal', `Rs ${money(subtotal)}`, width)}\n`;

  if (Number(discountAmount || 0) > 0) {
    const discountLabel = discountType === 'percentage'
      ? `Discount (${discountValue}%)`
      : 'Discount';
    receipt += `${line(discountLabel, `-Rs ${money(discountAmount)}`, width)}\n`;
  }

  receipt += `${separator(width, '=')}\n`;
  receipt += `${line('TOTAL', `Rs ${money(total)}`, width)}\n`;
  receipt += `${separator(width, '=')}\n`;
  receipt += `\n${center('Thank you for dining with us!', width)}\n`;
  receipt += `${separator(width)}\n`;
  receipt += `${center('Powered by BillPak', width)}\n`;
  receipt += '\n\n\n\n\n';

  return receipt;
};

export const printDineInKotDirect = async ({
  restaurantName,
  billNo,
  tableNumber,
  cashierName,
  items,
}) => {
  const settings = await getWorkingSettings();

  if (!settings.enabled) {
    throw new Error('Direct USB printer is disabled.');
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
}) => {
  const settings = await getWorkingSettings();

  if (!settings.enabled) {
    throw new Error('Direct USB printer is disabled.');
  }

  const invoiceText = buildDineInInvoiceText({
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
    paperWidth: settings.paperWidth || 80,
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

  const testText =
    `${center('BillPak Printer Test', width)}\n` +
    `${separator(width)}\n` +
    `Printer: ${settings.deviceName || 'USB Printer'}\n` +
    `Product ID: ${settings.productId}\n` +
    `Vendor ID: ${settings.vendorId || 'N/A'}\n` +
    `Time: ${new Date().toLocaleString('en-PK')}\n` +
    `${separator(width)}\n` +
    `${center('Test successful', width)}\n` +
    `${separator(width)}\n` +
    `${center('Powered by AMS Crafters', width)}\n\n\n`;

  await sendTextToUsbPrinter(testText, {
    cut: settings.autoCut !== false,
    beep: true,
  });

  return true;
};
