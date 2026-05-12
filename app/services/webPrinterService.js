
const WEB_PRINTER_KEY = 'billpak_web_printer_settings';
const API_URL = 'https://billpak.runasp.net/api';

const defaultWebPrinterSettings = {
  enabled: true,
  printerName: '',
  paperWidth: 80,
  autoCut: true,
};

let qzSecurityReady = false;
let _qz = null;

const getQz = async () => {
  if (_qz) return _qz;
  try {
    _qz = (await import('qz-tray')).default;
    return _qz;
  } catch (e) {
    console.warn('QZ Tray not available:', e.message);
    return null;
  }
};

const setupQzSecurity = () => {
  if (qzSecurityReady) return;

  qz.security.setCertificatePromise((resolve, reject) => {
    fetch(`${API_URL}/Qz/certificate`, { method: 'GET', cache: 'no-store' })
      .then(async (res) => {
        const text = await res.text();
        if (!res.ok) return reject(text || 'QZ certificate request failed');
        resolve(text);
      })
      .catch(reject);
  });

  qz.security.setSignatureAlgorithm('SHA512');

  qz.security.setSignaturePromise((toSign) => {
    return (resolve, reject) => {
      fetch(`${API_URL}/Qz/sign`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: toSign }),
      })
        .then(async (res) => {
          const text = await res.text();
          if (!res.ok) return reject(text || 'QZ signing request failed');
          resolve(text);
        })
        .catch(reject);
    };
  });

  qzSecurityReady = true;
};

export const getWebPrinterSettings = () => {
  const saved = localStorage.getItem(WEB_PRINTER_KEY);
  if (!saved) return defaultWebPrinterSettings;

  try {
    return { ...defaultWebPrinterSettings, ...JSON.parse(saved) };
  } catch {
    return defaultWebPrinterSettings;
  }
};

export const saveWebPrinterSettings = (settings) => {
  const finalSettings = {
    ...defaultWebPrinterSettings,
    ...settings,
    enabled: settings?.enabled ?? true,
  };

  localStorage.setItem(WEB_PRINTER_KEY, JSON.stringify(finalSettings));
  return finalSettings;
};

export const clearWebPrinterSettings = () => {
  localStorage.removeItem(WEB_PRINTER_KEY);
};

const normalizePrinterName = (name = '') => String(name || '').trim();

const isSamePrinterName = (a = '', b = '') => {
  return normalizePrinterName(a).toLowerCase() === normalizePrinterName(b).toLowerCase();
};

const isVirtualPrinter = (printerName = '') => {
  return /pdf|xps|onenote|fax|anydesk|document writer|send to/i.test(printerName);
};

const isThermalLikePrinter = (printerName = '') => {
  return /epson|tm-|t88|t20|thermal|pos|receipt|xprinter|xp-|rongta|rp-|bixolon|srp|star|tsp|citizen|ct-|sunmi|imin|goojprt|zjiang|zy|black copper|bc-|bluetooth|bt|80mm|58mm/i.test(
    printerName
  );
};

const shouldUseFullImageReceiptMode = (printerName = '') => {
  return /black copper|bc-85ac|bc-/i.test(printerName);
};

const findPrinterByName = (printers = [], printerName = '') => {
  if (!printerName) return '';
  return printers.find((printer) => isSamePrinterName(printer, printerName)) || '';
};

const pickBestPrinter = (printers = [], preferredPrinterName = '') => {
  if (!Array.isArray(printers) || !printers.length) return '';

  const realPrinters = printers.filter((printer) => !isVirtualPrinter(printer));
  const usablePrinters = realPrinters.length ? realPrinters : printers;

  if (preferredPrinterName) {
    const preferred = findPrinterByName(usablePrinters, preferredPrinterName);
    if (preferred) return preferred;
  }

  const settings = getWebPrinterSettings();

  if (settings?.printerName) {
    const saved = findPrinterByName(usablePrinters, settings.printerName);
    if (saved) return saved;
  }

  const thermalPrinters = usablePrinters.filter((printer) => isThermalLikePrinter(printer));

  if (thermalPrinters.length) {
    return thermalPrinters[0];
  }

  return usablePrinters[0];
};

const getReceiptWidth = (paperWidth = 80) => (Number(paperWidth) === 58 ? 32 : 42);
const getImageWidthPx = (paperWidth = 80) => (Number(paperWidth) === 58 ? 280 : 384);
const money = (amount) => Number(amount || 0).toFixed(2);

const safeText = (value = '') => String(value).replace(/\s+/g, ' ').trim();

const separator = (width = 42, char = '-') => char.repeat(width);
const doubleSeparator = (width = 42) => '='.repeat(width);
const starSeparator = (width = 42) => '*'.repeat(width);

const center = (text, width = 42) => {
  const value = safeText(text);
  if (value.length >= width) return value.substring(0, width);

  const spaces = Math.max(Math.floor((width - value.length) / 2), 0);
  return `${' '.repeat(spaces)}${value}`;
};

const line = (left, right = '', width = 42) => {
  const l = safeText(left);
  const r = safeText(right);

  if (l.length + r.length >= width) {
    return `${l.substring(0, Math.max(width - r.length - 1, 1))} ${r}`;
  }

  return `${l}${' '.repeat(Math.max(width - l.length - r.length, 1))}${r}`;
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

const pushCenteredWrapped = (data, text, width) => {
  wrapText(text, width).forEach((lineText) => {
    data.push(`${center(lineText, width)}\n`);
  });
};

const pushLeftWrapped = (data, text, width) => {
  wrapText(text, width).forEach((lineText) => {
    data.push(`${lineText}\n`);
  });
};

const createUrduTextImageBase64 = async (text, paperWidth = 80) => {
  const value = safeText(text);
  if (!value) return null;

  const canvas = document.createElement('canvas');
  const imageWidth = getImageWidthPx(paperWidth);
  const fontSize = Number(paperWidth) === 58 ? 22 : 26;
  const paddingX = 0;
  const paddingY = 2;
  const lineHeight = fontSize + 6;

  canvas.width = imageWidth;
  canvas.height = lineHeight + paddingY * 2;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#000000';
  ctx.font = `bold ${fontSize}px Arial, "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Noto Naskh Arabic", sans-serif`;
  ctx.direction = 'rtl';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.fillText(value, paddingX, canvas.height / 2);

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1];
};

const pushUrduImage = async (data, text, paperWidth = 80) => {
  const base64 = await createUrduTextImageBase64(text, paperWidth);
  if (!base64) return;

  data.push({
    type: 'pixel',
    format: 'image',
    flavor: 'base64',
    data: base64,
    options: {
      language: 'ESCPOS',
      dotDensity: 'double',
    },
  });

  data.push('\n');
};

const ESC = '\x1B';
const GS = '\x1D';

const initPrinter = () => ESC + '@';
const alignLeft = () => ESC + 'a' + '\x00';
const alignCenter = () => ESC + 'a' + '\x01';
const boldOn = () => ESC + 'E' + '\x01';
const boldOff = () => ESC + 'E' + '\x00';
const normalSize = () => GS + '!' + '\x00';
const doubleSize = () => GS + '!' + '\x11';
const cutPaper = () => GS + 'V' + '\x00';

const isEscCommand = (value = '') => {
  if (typeof value !== 'string') return false;
  return value.includes('\x1B') || value.includes('\x1D');
};

const stripControlChars = (value = '') => {
  return String(value || '').replace(/[\x00-\x1F\x7F]/g, '');
};

const loadBase64Image = (base64) => {
  return new Promise((resolve, reject) => {
    if (!base64) {
      reject(new Error('Image base64 missing'));
      return;
    }

    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64.startsWith('data:image') ? base64 : `data:image/png;base64,${base64}`;
  });
};

const parseReceiptRowsForImageMode = (data = []) => {
  const rows = [];
  let align = 'left';
  let bold = false;
  let double = false;
  let shouldCut = false;

  for (const part of data || []) {
    if (typeof part !== 'string') {
      rows.push({
        type: 'image',
        image: part,
        align,
      });
      continue;
    }

    if (part === initPrinter()) continue;

    if (part === cutPaper()) {
      shouldCut = true;
      continue;
    }

    if (part === alignLeft()) {
      align = 'left';
      continue;
    }

    if (part === alignCenter()) {
      align = 'center';
      continue;
    }

    if (part === boldOn()) {
      bold = true;
      continue;
    }

    if (part === boldOff()) {
      bold = false;
      continue;
    }

    if (part === doubleSize()) {
      double = true;
      continue;
    }

    if (part === normalSize()) {
      double = false;
      continue;
    }

    if (isEscCommand(part)) continue;

    const splitLines = String(part).split('\n');

    splitLines.forEach((textLine, index) => {
      const cleaned = stripControlChars(textLine);

      if (!cleaned.trim()) {
        if (index < splitLines.length - 1) {
          rows.push({ type: 'space', height: 7 });
        }
        return;
      }

      rows.push({
        type: 'text',
        text: cleaned,
        align,
        bold,
        double,
      });
    });
  }

  return { rows, shouldCut };
};

const getCanvasTextConfig = (paperWidth = 80, row = {}) => {
  const is58 = Number(paperWidth) === 58;

  if (row.double) {
    return {
      fontSize: is58 ? 24 : 30,
      lineHeight: is58 ? 34 : 40,
      fontWeight: 'bold',
    };
  }

  return {
    fontSize: is58 ? 15 : 18,
    lineHeight: is58 ? 22 : 25,
    fontWeight: row.bold ? 'bold' : 'normal',
  };
};

const buildFullReceiptImageBase64 = async (data = [], paperWidth = 80) => {
  const { rows } = parseReceiptRowsForImageMode(data);
  const canvasWidth = getImageWidthPx(paperWidth);
  const paddingX = 8;
  const paddingTop = 8;
  const paddingBottom = 8;

  const preparedRows = [];

  for (const row of rows) {
    if (row.type === 'space') {
      preparedRows.push(row);
      continue;
    }

    if (row.type === 'image') {
      const imageData = row.image?.data;
      if (!imageData) continue;

      try {
        const img = await loadBase64Image(imageData);

        let drawWidth = Number(row.image?.options?.width || 0);
        let drawHeight = Number(row.image?.options?.height || 0);

        if (!drawWidth || !drawHeight) {
          drawWidth = Math.min(img.width, canvasWidth - paddingX * 2);
          drawHeight = Math.round((img.height / img.width) * drawWidth);
        }

        drawWidth = Math.min(drawWidth, canvasWidth - paddingX * 2);

        preparedRows.push({
          ...row,
          loadedImage: img,
          drawWidth,
          drawHeight,
          height: drawHeight + 2,
        });
      } catch {
        continue;
      }

      continue;
    }

    if (row.type === 'text') {
      const textConfig = getCanvasTextConfig(paperWidth, row);

      preparedRows.push({
        ...row,
        ...textConfig,
        height: textConfig.lineHeight,
      });
    }
  }

  const totalHeight =
    paddingTop +
    preparedRows.reduce((sum, row) => sum + Number(row.height || 0), 0) +
    paddingBottom;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = Math.max(totalHeight, 1);

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = paddingTop;

  for (const row of preparedRows) {
    if (row.type === 'space') {
      y += row.height;
      continue;
    }

    if (row.type === 'image' && row.loadedImage) {
      let x = paddingX;

      if (row.align === 'center') {
        x = Math.round((canvas.width - row.drawWidth) / 2);
      } else if (row.align === 'right') {
        x = canvas.width - paddingX - row.drawWidth;
      }

      ctx.drawImage(row.loadedImage, x, y, row.drawWidth, row.drawHeight);
      y += row.height;
      continue;
    }

    if (row.type === 'text') {
      ctx.fillStyle = '#000000';
      ctx.font = `${row.fontWeight} ${row.fontSize}px "Courier New", monospace`;
      ctx.textBaseline = 'middle';

      const text = row.align === 'center' ? safeText(row.text) : String(row.text || '');

      if (row.align === 'center') {
        ctx.textAlign = 'center';
        ctx.fillText(text, canvas.width / 2, y + row.lineHeight / 2);
      } else if (row.align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(text, canvas.width - paddingX, y + row.lineHeight / 2);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(text, paddingX, y + row.lineHeight / 2);
      }

      y += row.height;
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1];
};

const convertReceiptForPrinter = async (data, printerName, paperWidth = 80) => {
  if (!shouldUseFullImageReceiptMode(printerName)) return data;

  const { shouldCut } = parseReceiptRowsForImageMode(data);
  const base64 = await buildFullReceiptImageBase64(data, paperWidth);

  const finalData = [
    initPrinter(),
    alignCenter(),
    {
      type: 'pixel',
      format: 'image',
      flavor: 'base64',
      data: base64,
      options: {
        language: 'ESCPOS',
        dotDensity: 'double',
        width: getImageWidthPx(paperWidth),
      },
    },
    '\n',
    '\n',
  ];

  if (shouldCut) finalData.push(cutPaper());

  return finalData;
};

const addBottomMargin = (data) => {
  for (let i = 0; i < 5; i++) data.push('\n');
  return data;
};

const pushLogoIfBase64 = (data, restaurantLogo) => {
  if (!restaurantLogo) return;

  let base64Logo = null;

  if (restaurantLogo.startsWith('data:image')) {
    const parts = restaurantLogo.split(',');
    base64Logo = parts.length > 1 ? parts[1] : null;
  } else if (restaurantLogo.length > 100 && !restaurantLogo.startsWith('file://')) {
    base64Logo = restaurantLogo;
  }

  if (!base64Logo) return;

  data.push(alignCenter());
  data.push({
    type: 'pixel',
    format: 'image',
    flavor: 'base64',
    data: base64Logo,
    options: {
      language: 'ESCPOS',
      dotDensity: 'single',
      width: 160,
      height: 80,
    },
  });
  data.push('\n');
};

const buildKotCommands = async ({
  restaurantName,
  billNo,
  tokenNo,
  cashierName,
  categoryName,
  items,
  paperWidth = 80,
  autoCut = true,
}) => {
  const width = getReceiptWidth(paperWidth);
  const now = new Date().toLocaleString('en-PK');
  const data = [];

  data.push(initPrinter());
  data.push(alignCenter());
  data.push(boldOn());
  pushCenteredWrapped(data, restaurantName || 'BillPak', width);
  data.push('TAKEAWAY KOT\n');
  pushCenteredWrapped(data, String(categoryName || 'Kitchen').toUpperCase(), width);
  data.push(boldOff());

  data.push(`${separator(width, '=')}\n`);
  data.push(doubleSize());
  data.push(`TOKEN #${tokenNo}\n`);
  data.push(normalSize());
  data.push(`${separator(width, '=')}\n`);

  data.push(alignLeft());
  data.push(line('Bill No', billNo, width) + '\n');
  data.push(line('Time', now, width) + '\n');
  data.push(line('Cashier', cashierName || 'Cashier', width) + '\n');
  data.push(line('Section', categoryName || 'Kitchen', width) + '\n');
  data.push(`${separator(width)}\n`);

  for (const item of items || []) {
    data.push(boldOn());
    data.push(line(item?.name || 'Item', `x${Number(item?.quantity || 0)}`, width) + '\n');
    data.push(boldOff());

    if (item?.nameUrdu) {
      await pushUrduImage(data, item.nameUrdu, paperWidth);
    }
  }

  data.push(`${separator(width)}\n`);
  data.push(alignCenter());
  pushCenteredWrapped(data, `Kitchen Copy - ${categoryName || 'Kitchen'}`, width);

  addBottomMargin(data);
  if (autoCut) data.push(cutPaper());

  return data;
};

const buildInvoiceCommands = async ({
  restaurantName,
  restaurantAddress,
  restaurantLogo,
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
  autoCut = true,
}) => {
  const width = getReceiptWidth(paperWidth);
  const now = new Date().toLocaleString('en-PK');
  const data = [];

  data.push(initPrinter());
  data.push(alignCenter());

  pushLogoIfBase64(data, restaurantLogo);

  data.push(alignCenter());
  data.push(boldOn());
  data.push(doubleSize());
  data.push(`${safeText(restaurantName || 'BillPak')}\n`);
  data.push(normalSize());
  data.push(boldOff());

  if (restaurantAddress) {
    pushCenteredWrapped(data, restaurantAddress, width);
  }

  data.push(`${starSeparator(width)}\n`);
  data.push(boldOn());
  data.push(`${center('TAKEAWAY INVOICE', width)}\n`);
  data.push(boldOff());
  data.push(`${starSeparator(width)}\n`);

  data.push(boldOn());
  data.push(doubleSize());
  data.push(`${center(`TOKEN #${tokenNo}`, width)}\n`);
  data.push(normalSize());
  data.push(boldOff());
  data.push(`${separator(width, '~')}\n`);

  data.push(alignLeft());
  data.push(line('Bill No:', billNo, width) + '\n');
  data.push(line('Date:', now, width) + '\n');
  data.push(line('Cashier:', cashierName || 'Cashier', width) + '\n');
  data.push(line('Payment:', 'Cash', width) + '\n');
  data.push(`${separator(width)}\n`);

  data.push(boldOn());
  data.push(line('ITEM', 'TOTAL', width) + '\n');
  data.push(boldOff());
  data.push(`${separator(width)}\n`);

  for (const item of cart || []) {
    const qty = Number(item?.quantity || 0);
    const price = Number(item?.price || 0);
    const itemTotal = qty * price;
    const itemName = `${item?.name || 'Item'}${item?.isCustom ? ' *' : ''}`;

    pushLeftWrapped(data, itemName, width);

    if (item?.nameUrdu) {
      await pushUrduImage(data, item.nameUrdu, paperWidth);
    }

    data.push(line(`  ${qty} x Rs.${money(price)}`, `Rs.${money(itemTotal)}`, width) + '\n');
  }

  data.push(`${separator(width)}\n`);
  data.push(line('Subtotal', `Rs.${money(subtotal)}`, width) + '\n');

  if (Number(discountAmount || 0) > 0) {
    const discountLabel =
      discountType === 'percentage'
        ? `Discount (${discountValue}%)`
        : 'Discount';

    data.push(line(discountLabel, `-Rs.${money(discountAmount)}`, width) + '\n');
  }

  data.push(`${doubleSeparator(width)}\n`);
  data.push(boldOn());
  data.push(doubleSize());
  data.push(line('TOTAL', `Rs.${money(total)}`, width) + '\n');
  data.push(normalSize());
  data.push(boldOff());
  data.push(`${doubleSeparator(width)}\n`);

  data.push(alignCenter());
  data.push(`\n${center('Thank you for ordering!', width)}\n`);
  data.push(separator(width) + '\n');
  data.push(`${center('Powered by BillPak', width)}\n`);

  addBottomMargin(data);
  if (autoCut) data.push(cutPaper());

  return data;
};

export const connectQzTray = async () => {
  setupQzSecurity();

  if (qz.websocket.isActive()) return true;

  try {
    // await qz.websocket.connect({ retries: 3, delay: 1 });
    const qz = await getQz();
    if (!qz) { console.warn('QZ not available'); return; }
    await qz.websocket.connect();
    return true;
  } catch {
    throw new Error('QZ Tray connect nahi ho raha');
  }
};

export const listWebPrinters = async () => {
  await connectQzTray();
  const printers = await qz.printers.find();
  return Array.isArray(printers) ? printers : [];
};

export const selectWebPrinter = async ({ printerName, paperWidth = 80, autoCut = true } = {}) => {
  await connectQzTray();

  const printers = await listWebPrinters();
  const selectedPrinter = findPrinterByName(printers, printerName);

  if (!selectedPrinter) {
    throw new Error(`Selected printer QZ list mein nahi mila: ${printerName || 'Unknown printer'}`);
  }

  saveWebPrinterSettings({
    enabled: true,
    printerName: selectedPrinter,
    paperWidth,
    autoCut,
  });

  console.log('QZ Saved selected printer:', selectedPrinter);

  return selectedPrinter;
};

export const autoSelectWebPrinter = async () => {
  const printers = await listWebPrinters();

  if (!printers.length) {
    throw new Error('No printer found on this computer.');
  }

  const selectedPrinter = pickBestPrinter(printers, '');

  const settings = getWebPrinterSettings();

  saveWebPrinterSettings({
    ...settings,
    enabled: true,
    printerName: selectedPrinter,
    paperWidth: settings.paperWidth || 80,
    autoCut: settings.autoCut !== false,
  });

  console.log('QZ Auto selected printer:', selectedPrinter);

  return selectedPrinter;
};

const getPrinterName = async (preferredPrinterName = '') => {
  const printers = await listWebPrinters();

  if (!printers.length) {
    throw new Error('No printer found on this computer.');
  }

  const settings = getWebPrinterSettings();

  console.log('QZ Available printers:', printers);
  console.log('QZ Preferred printer:', preferredPrinterName);
  console.log('QZ Saved printer:', settings.printerName);

  const selectedPrinter = pickBestPrinter(printers, preferredPrinterName);

  if (!selectedPrinter) {
    throw new Error('Printer select nahi ho saka.');
  }

  saveWebPrinterSettings({
    ...settings,
    enabled: true,
    printerName: selectedPrinter,
    paperWidth: settings.paperWidth || 80,
    autoCut: settings.autoCut !== false,
  });

  console.log('QZ Selected printer:', selectedPrinter);

  return selectedPrinter;
};

const createPrinterConfig = (printerName) => {
  return qz.configs.create(printerName, {
    encoding: 'UTF-8',
    forceRaw: false,
    colorType: 'grayscale',
    interpolation: 'nearest-neighbor',
    copies: 1,
    density: 203,
    margins: 0,
  });
};

export const printKotThenInvoiceWeb = async ({
  restaurantName,
  restaurantAddress,
  restaurantLogo,
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
  printerName,
}) => {
  await connectQzTray();

  const settings = getWebPrinterSettings();
  const selectedPrinterName = await getPrinterName(printerName);
  const config = createPrinterConfig(selectedPrinterName);

  const paperWidth = settings.paperWidth || 80;
  const autoCut = settings.autoCut !== false;

  const groups = Object.entries(groupedCart || {});

  if (!groups.length) {
    throw new Error('No KOT items found for printing.');
  }

  for (const [categoryName, items] of groups) {
    const kotData = await buildKotCommands({
      restaurantName,
      billNo,
      tokenNo,
      cashierName,
      categoryName,
      items,
      paperWidth,
      autoCut,
    });

    const printableKotData = await convertReceiptForPrinter(
      kotData,
      selectedPrinterName,
      paperWidth
    );

    await qz.print(config, printableKotData);
  }

  const invoiceData = await buildInvoiceCommands({
    restaurantName,
    restaurantAddress,
    restaurantLogo,
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
    autoCut,
  });

  const printableInvoiceData = await convertReceiptForPrinter(
    invoiceData,
    selectedPrinterName,
    paperWidth
  );

  await qz.print(config, printableInvoiceData);
  return true;
};

// ========== DINE-IN DIRECT PRINTING ==========

const buildDineInKotCommands = async ({
  restaurantName,
  billNo,
  tableNumber,
  cashierName,
  items,
  paperWidth = 80,
  autoCut = true,
}) => {
  const width = getReceiptWidth(paperWidth);
  const now = new Date().toLocaleString('en-PK');
  const data = [];

  data.push(initPrinter());
  data.push(alignCenter());
  data.push(boldOn());
  pushCenteredWrapped(data, restaurantName || 'BillPak', width);
  data.push('DINE-IN KOT\n');
  data.push(boldOff());

  data.push(`${separator(width, '=')}\n`);
  data.push(doubleSize());
  data.push(`${center(`TABLE ${tableNumber || ''}`, Math.floor(width / 2))}\n`);
  data.push(normalSize());
  data.push(`${separator(width, '=')}\n`);

  data.push(alignLeft());
  data.push(line('KOT No', billNo, width) + '\n');
  data.push(line('Time', now, width) + '\n');
  data.push(line('Cashier', cashierName || 'Cashier', width) + '\n');
  data.push(`${separator(width)}\n`);

  for (const item of items || []) {
    data.push(boldOn());
    data.push(line(item?.name || 'Item', `x${Number(item?.quantity || 0)}`, width) + '\n');
    data.push(boldOff());

    if (item?.nameUrdu) {
      await pushUrduImage(data, item.nameUrdu, paperWidth);
    }
  }

  data.push(`${separator(width)}\n`);
  data.push(alignCenter());
  data.push('Kitchen Copy\n');

  addBottomMargin(data);
  if (autoCut) data.push(cutPaper());

  return data;
};

const buildDineInInvoiceCommands = async ({
  restaurantName,
  restaurantAddress,
  restaurantLogo,
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
  autoCut = true,
}) => {
  const width = getReceiptWidth(paperWidth);
  const now = new Date().toLocaleString('en-PK');
  const data = [];

  data.push(initPrinter());
  data.push(alignCenter());

  pushLogoIfBase64(data, restaurantLogo);

  data.push(boldOn());
  data.push(doubleSize());
  data.push(`${safeText(restaurantName || 'BillPak')}\n`);
  data.push(normalSize());
  data.push(boldOff());

  if (restaurantAddress) {
    pushCenteredWrapped(data, restaurantAddress, width);
  }

  data.push(`${starSeparator(width)}\n`);
  data.push(boldOn());
  data.push(`${center('DINE-IN INVOICE', width)}\n`);
  data.push(boldOff());
  data.push(`${starSeparator(width)}\n`);

  data.push(boldOn());
  data.push(doubleSize());
  data.push(`${center(`TABLE ${tableNumber || ''}`, Math.floor(width / 2))}\n`);
  data.push(normalSize());
  data.push(boldOff());
  data.push(`${separator(width, '~')}\n`);

  data.push(alignLeft());
  data.push(line('Bill No:', billNo, width) + '\n');
  data.push(line('Date:', now, width) + '\n');
  data.push(line('Cashier:', cashierName || 'Cashier', width) + '\n');
  data.push(line('Payment:', 'Cash', width) + '\n');
  data.push(`${separator(width)}\n`);

  data.push(boldOn());
  data.push(line('ITEM', 'TOTAL', width) + '\n');
  data.push(boldOff());
  data.push(`${separator(width)}\n`);

  for (const item of items || []) {
    const qty = Number(item?.quantity || 0);
    const price = Number(item?.price || 0);
    const itemTotal = qty * price;
    const itemName = `${item?.name || 'Item'}${item?.isCustom ? ' *' : ''}`;

    pushLeftWrapped(data, itemName, width);

    if (item?.nameUrdu) {
      await pushUrduImage(data, item.nameUrdu, paperWidth);
    }

    data.push(line(`  ${qty} x Rs.${money(price)}`, `Rs.${money(itemTotal)}`, width) + '\n');
  }

  data.push(`${separator(width)}\n`);
  data.push(line('Subtotal', `Rs.${money(subtotal)}`, width) + '\n');

  if (Number(discountAmount || 0) > 0) {
    const discountLabel =
      discountType === 'percentage'
        ? `Discount (${discountValue}%)`
        : 'Discount';

    data.push(line(discountLabel, `-Rs.${money(discountAmount)}`, width) + '\n');
  }

  data.push(`${doubleSeparator(width)}\n`);
  data.push(boldOn());
  data.push(doubleSize());
  data.push(line('TOTAL', `Rs.${money(total)}`, width) + '\n');
  data.push(normalSize());
  data.push(boldOff());
  data.push(`${doubleSeparator(width)}\n`);

  data.push(alignCenter());
  data.push(`\n${center('Thank you for dining with us!', width)}\n`);
  data.push(separator(width) + '\n');
  data.push(`${center('Powered by BillPak', width)}\n`);

  addBottomMargin(data);
  if (autoCut) data.push(cutPaper());

  return data;
};

export const printDineInKotWeb = async ({
  restaurantName,
  billNo,
  tableNumber,
  cashierName,
  items,
  printerName,
}) => {
  await connectQzTray();

  const settings = getWebPrinterSettings();
  const selectedPrinterName = await getPrinterName(printerName);
  const config = createPrinterConfig(selectedPrinterName);

  const data = await buildDineInKotCommands({
    restaurantName,
    billNo,
    tableNumber,
    cashierName,
    items,
    paperWidth: settings.paperWidth || 80,
    autoCut: settings.autoCut !== false,
  });

  const printableData = await convertReceiptForPrinter(
    data,
    selectedPrinterName,
    settings.paperWidth || 80
  );

  await qz.print(config, printableData);
  return true;
};

export const printDineInInvoiceWeb = async ({
  restaurantName,
  restaurantAddress,
  restaurantLogo,
  billNo,
  tableNumber,
  cashierName,
  items,
  subtotal,
  discountAmount,
  discountType,
  discountValue,
  total,
  printerName,
}) => {
  await connectQzTray();

  const settings = getWebPrinterSettings();
  const selectedPrinterName = await getPrinterName(printerName);
  const config = createPrinterConfig(selectedPrinterName);

  const data = await buildDineInInvoiceCommands({
    restaurantName,
    restaurantAddress,
    restaurantLogo,
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
    autoCut: settings.autoCut !== false,
  });

  const printableData = await convertReceiptForPrinter(
    data,
    selectedPrinterName,
    settings.paperWidth || 80
  );

  await qz.print(config, printableData);
  return true;
};

export const testWebPrinter = async ({ printerName } = {}) => {
  await connectQzTray();

  const settings = getWebPrinterSettings();
  const selectedPrinterName = await getPrinterName(printerName);
  const config = createPrinterConfig(selectedPrinterName);
  const width = getReceiptWidth(settings.paperWidth || 80);

  const data = [
    initPrinter(),
    alignCenter(),
    boldOn(),
    'BillPak Printer Test\n',
    boldOff(),
    separator(width) + '\n',
    `Printer: ${selectedPrinterName}\n`,
    `Time: ${new Date().toLocaleString('en-PK')}\n`,
    separator(width) + '\n',
  ];

  await pushUrduImage(data, 'اردو ٹیسٹ', settings.paperWidth || 80);

  data.push(
    separator(width) + '\n',
    'Powered by BillPak\n',
    ...Array(10).fill('\n'),
    settings.autoCut !== false ? cutPaper() : ''
  );

  const printableData = await convertReceiptForPrinter(
    data,
    selectedPrinterName,
    settings.paperWidth || 80
  );

  await qz.print(config, printableData);
  return true;
};