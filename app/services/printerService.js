import AsyncStorage from '@react-native-async-storage/async-storage';

let UsbPrinterModule = null;

const loadUsbPrinterModule = () => {
  if (UsbPrinterModule) return UsbPrinterModule;

  try {
    const imported = require('react-native-printer-usb');
    UsbPrinterModule = imported?.default || imported;
    return UsbPrinterModule;
  } catch {
    throw new Error(
      'USB printer native module not found. Install react-native-printer-usb and rebuild APK with EAS.'
    );
  }
};

const PRINTER_SETTINGS_KEY = 'billpak_printer_settings';
const ONLINE_DELIVERY_PHONE_KEY = 'online_delivery_phone';

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

export const savePrinterSettings = async (settings) => {
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

const getReceiptWidth = (paperWidth = 80) => {
  return Number(paperWidth) === 58 ? 32 : 42;
};

const money = (amount) => Number(amount || 0).toFixed(2);

const safeText = (value = '') => {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
};

const asciiText = (value = '') => {
  return String(value ?? '')
    .replace(/[^\x20-\x7E\n]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
};

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

const centeredWrappedText = (text, width = 42) => {
  return wrapText(text, width).map((lineText) => center(lineText, width)).join('\n');
};

const normalizeBase64Logo = (logo) => {
  if (!logo) return null;
  if (typeof logo !== 'string') return null;
  if (logo.startsWith('data:image')) return logo.split(',')[1] || null;
  if (logo.length > 100) return logo;
  return null;
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
  const { printText } = loadUsbPrinterModule();
  const settings = await getWorkingSettings();

  if (!printText) {
    throw new Error('printText() not found in USB printer module.');
  }

  if (!settings.productId) {
    throw new Error('USB printer productId missing. Configure printer first.');
  }

  return printText({
    text,
    productId: settings.productId,
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

const tryPrintLogo = async (restaurantLogo) => {
  // Stable client-delivery mode:
  // Logo/image printing is intentionally skipped because this USB printer setup
  // prints blank/slow output when image/raster printing is used.
  // Text KOT + text invoice remain fast and reliable.
  return false;
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

const addUrduLine = (receipt, text) => {
  // Raw Urdu text is intentionally disabled in APK text mode because it prints garbage on many ESC/POS printers.
  // Urdu is printed through small captured image lines when nameUrduImageBase64 is available.
  return receipt;
};

const getOnlineDeliveryPhoneForPrint = async () => {
  try {
    const saved =
      (await AsyncStorage.getItem(ONLINE_DELIVERY_PHONE_KEY)) ||
      (await AsyncStorage.getItem('restaurant_online_delivery_phone')) ||
      '';
    return safeText(saved);
  } catch {
    return '';
  }
};

const addOnlineDeliveryFooter = (receipt, width, onlineDeliveryPhone = '') => {
  const phone = safeText(onlineDeliveryPhone);
  if (!phone) return receipt;

  receipt += `${center('ONLINE DELIVERY', width)}\n`;
  receipt += `${center(phone, width)}\n`;
  return receipt;
};

const URDU_IMAGE_START = '__BILLPAK_URDU_IMAGE_START__';
const URDU_IMAGE_END = '__BILLPAK_URDU_IMAGE_END__';

const normalizeBase64Image = (image) => {
  if (!image || typeof image !== 'string') return null;

  const value = image.trim();
  if (!value) return null;

  if (value.startsWith('data:image')) {
    const parts = value.split(',');
    return parts.length > 1 ? parts[1] : null;
  }

  if (value.startsWith('file://') || /^https?:\/\//i.test(value)) {
    return null;
  }

  return value.length > 100 ? value : null;
};

const addUrduImageLine = (receipt, imageBase64) => {
  const cleanImage = normalizeBase64Image(imageBase64);
  if (!cleanImage) return receipt;

  return `${receipt}${URDU_IMAGE_START}${cleanImage}${URDU_IMAGE_END}\n`;
};

const printBase64ImageToUsbPrinter = async (base64Image, options = {}) => {
  const module = loadUsbPrinterModule();
  const settings = await getWorkingSettings();
  const cleanBase64 = normalizeBase64Image(base64Image);

  if (!cleanBase64) return false;

  const imageFn =
    module.printImageBase64 ||
    module.printImage ||
    module.printBitmap ||
    module.printPic ||
    module.printRasterImage;

  if (typeof imageFn !== 'function') {
    console.log('USB printer module image function not found. Urdu image skipped.');
    return false;
  }

  const payload = {
    base64Image: cleanBase64,
    image: cleanBase64,
    data: cleanBase64,
    base64: cleanBase64,
    productId: settings.productId,
    vendorId: settings.vendorId,
    deviceId: settings.deviceId,
    align: options.align || 'center',
    width: options.width || getImageWidthPx(settings.paperWidth || 80),
    cut: false,
    beep: false,
    tailingLine: true,
  };

  try {
    await imageFn(payload);
    return true;
  } catch (err) {
    console.log('USB Urdu image print failed with object payload:', err?.message || err);
  }

  try {
    await imageFn(cleanBase64, settings.productId);
    return true;
  } catch (err) {
    console.log('USB Urdu image print failed with fallback payload:', err?.message || err);
    return false;
  }
};

const splitReceiptByUrduImages = (receiptText = '') => {
  const value = String(receiptText || '');
  const parts = [];
  const regex = new RegExp(`${URDU_IMAGE_START}([\\s\\S]*?)${URDU_IMAGE_END}`, 'g');

  let lastIndex = 0;
  let match = null;

  while ((match = regex.exec(value)) !== null) {
    const before = value.slice(lastIndex, match.index);
    if (before) {
      parts.push({ type: 'text', text: before });
    }

    if (match[1]) {
      parts.push({ type: 'image', base64: match[1] });
    }

    lastIndex = regex.lastIndex;
  }

  const after = value.slice(lastIndex);
  if (after) {
    parts.push({ type: 'text', text: after });
  }

  return parts;
};

const sendReceiptToUsbPrinter = async (receiptText, options = {}) => {
  const parts = splitReceiptByUrduImages(receiptText);

  if (!parts.some(part => part.type === 'image')) {
    return sendTextToUsbPrinter(receiptText, options);
  }

  let printedText = false;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const isLast = index === parts.length - 1;

    if (part.type === 'text') {
      if (!part.text) continue;

      await sendTextToUsbPrinter(part.text, {
        ...options,
        cut: isLast ? options.cut : false,
        beep: isLast ? options.beep : false,
        tailingLine: isLast ? options.tailingLine : false,
      });

      printedText = true;
      continue;
    }

    if (part.type === 'image') {
      // Urdu image failure should not break full bill printing.
      await printBase64ImageToUsbPrinter(part.base64, {
        width: options.urduImageWidth,
        align: 'center',
      });
    }
  }

  const lastPart = parts[parts.length - 1];

  if (lastPart?.type === 'image' || !printedText) {
    await sendTextToUsbPrinter('\n', {
      ...options,
      cut: options.cut,
      beep: options.beep,
      tailingLine: options.tailingLine,
    });
  }

  return true;
};

export const buildKotText = ({
  restaurantName,
  billNo,
  tokenNo,
  cashierName,
  categoryName,
  items,
  paperWidth = 80,
  onlineDeliveryPhone = '',
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
    const itemName = item?.name || 'Item';
    const qty = Number(item?.quantity || 0);

    receipt += `${line(itemName, `x${qty}`, width)}\n`;

    const urduName = getUrduName(item);
    if (item?.nameUrduImageBase64) {
      receipt = addUrduImageLine(receipt, item.nameUrduImageBase64);
    } else if (urduName) {
      receipt = addUrduLine(receipt, urduName);
    }
  });

  receipt += `${separator(width)}\n`;
  receipt += `${centeredWrappedText(`Kitchen Copy - ${categoryName || 'Kitchen'}`, width)}\n`;
  receipt += `${separator(width)}\n`;
  receipt = addOnlineDeliveryFooter(receipt, width, onlineDeliveryPhone);
  receipt += `${center('Powered by AMS Crafters', width)}\n`;
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
  onlineDeliveryPhone = '',
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
    const itemName = item?.name || 'Item';
    const qty = Number(item?.quantity || 0);
    const price = Number(item?.price || 0);
    const itemTotal = qty * price;

    const itemLines = wrapText(`${itemName}${item?.isCustom ? ' *' : ''}`, width);
    itemLines.forEach((itemLine) => {
      receipt += `${itemLine}\n`;
    });

    const urduName = getUrduName(item);
    if (item?.nameUrduImageBase64) {
      receipt = addUrduImageLine(receipt, item.nameUrduImageBase64);
    } else if (urduName) {
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
  receipt = addOnlineDeliveryFooter(receipt, width, onlineDeliveryPhone);
  receipt += `${center('Powered by AMS Crafters', width)}\n`;
  receipt += `${separator(width)}\n`;
  receipt += '\n\n\n';

  return receipt;
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
}) => {
  const settings = await getWorkingSettings();

  if (!settings.enabled) {
    throw new Error('Direct USB printer is disabled.');
  }

  const paperWidth = settings.paperWidth || 80;
  const autoCut = settings.autoCut !== false;
  const onlineDeliveryPhone = await getOnlineDeliveryPhoneForPrint();

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
      onlineDeliveryPhone,
    });

    await sendReceiptToUsbPrinter(kotText, {
      cut: autoCut,
      beep: false,
      tailingLine: true,
    });
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
    onlineDeliveryPhone,
  });

  await sendReceiptToUsbPrinter(invoiceText, {
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
  onlineDeliveryPhone = '',
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
    receipt += `${line(item?.name || 'Item', `x${Number(item?.quantity || 0)}`, width)}\n`;

    const urduName = getUrduName(item);
    if (item?.nameUrduImageBase64) {
      receipt = addUrduImageLine(receipt, item.nameUrduImageBase64);
    } else if (urduName) {
      receipt = addUrduLine(receipt, urduName);
    }
  });

  receipt += `${separator(width)}\n`;
  receipt += `${center('Kitchen Copy', width)}\n`;
  receipt += `${separator(width)}\n`;
  receipt = addOnlineDeliveryFooter(receipt, width, onlineDeliveryPhone);
  receipt += `${center('Powered by AMS Crafters', width)}\n`;
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

  const onlineDeliveryPhone = await getOnlineDeliveryPhoneForPrint();

  const kotText = buildDineInKotText({
    restaurantName,
    billNo,
    tableNumber,
    cashierName,
    items,
    paperWidth: settings.paperWidth || 80,
    onlineDeliveryPhone,
  });

  await sendReceiptToUsbPrinter(kotText, {
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
}) => {
  const settings = await getWorkingSettings();

  if (!settings.enabled) {
    throw new Error('Direct USB printer is disabled.');
  }

  await tryPrintLogo(restaurantLogo);
  const onlineDeliveryPhone = await getOnlineDeliveryPhoneForPrint();

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
    onlineDeliveryPhone,
  });

  await sendReceiptToUsbPrinter(invoiceText, {
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
    `Urdu Test Below:\n` +
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