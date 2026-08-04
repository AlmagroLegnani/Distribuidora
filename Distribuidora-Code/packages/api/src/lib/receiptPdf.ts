import PDFDocument from 'pdfkit';
import { IvaType } from '@stockapp/db';
import { IVA_LABELS, ivaAmountFromFinalPrice } from './iva';

export interface ReceiptItem {
  quantity: number;
  unitPrice: number;
  subtotal: number;
  ivaType: IvaType;
  product: { name: string; code: string | null };
}

export interface ReceiptOrder {
  id: string;
  total: number;
  notes: string | null;
  createdAt: Date;
  client: {
    rut: string | null;
    cedula: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  distributor: { name: string; phone: string | null; email: string };
  items: ReceiptItem[];
}

/**
 * Muestra solo los primeros 4 dígitos del RUT/Cédula y enmascara el resto
 * (ej. "50912345" → "5091****") — este comprobante se manda por email, y
 * TuStockApp no debería exponer el documento completo del cliente en un PDF
 * que circula por correo.
 */
function maskDocument(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return digits.slice(0, 4) + '*'.repeat(digits.length - 4);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
  }).format(amount);
}

const IVA_SHORT_LABELS: Record<IvaType, string> = {
  BASICA: '22%',
  MINIMA: '10%',
};

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 in points
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
// Ancho repartido entre 5 columnas (antes eran 4 — se agregó "IVA").
const COL = { product: MARGIN, qty: 300, iva: 345, price: 400, subtotal: 470 };

/**
 * Builds a printable order receipt as a PDF buffer. This is an internal
 * summary document for the distributor/client — it is NOT a legally valid
 * electronic tax invoice (CFE/DGI). Real e-invoicing requires the
 * distributor to be registered as an electronic issuer with DGI and to
 * integrate with a certified CFE provider, which is out of scope here.
 */
export function buildOrderReceiptPdf(order: ReceiptOrder): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const shortId = order.id.slice(-8).toUpperCase();

    // Header — distributor info
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e3a5f').text(order.distributor.name);
    doc.font('Helvetica').fontSize(9).fillColor('#555');
    if (order.distributor.phone) doc.text(`Tel: ${order.distributor.phone}`);
    doc.text(order.distributor.email);
    doc.moveDown(1);

    // Title + disclaimer
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(14).text(`Comprobante de Pedido #${shortId}`);
    doc.font('Helvetica').fontSize(8).fillColor('#888');
    doc.text(
      'Documento interno a modo de remito/comprobante de pedido. No constituye una factura fiscal electrónica (CFE). Los precios ya incluyen el IVA correspondiente a cada producto.'
    );
    doc.fillColor('#000').fontSize(10);
    doc.moveDown(0.5);
    doc.text(`Fecha: ${order.createdAt.toLocaleString('es-UY')}`);
    doc.moveDown(0.8);

    // Client info
    doc.font('Helvetica-Bold').fontSize(11).text('Cliente');
    doc.font('Helvetica').fontSize(10);
    if (order.client.rut) doc.text(`RUT: ${maskDocument(order.client.rut)}`);
    if (order.client.cedula) doc.text(`Cédula: ${maskDocument(order.client.cedula)}`);
    if (order.client.name) doc.text(`Razón Social: ${order.client.name}`);
    if (order.client.phone) doc.text(`Teléfono: ${order.client.phone}`);
    if (order.client.email) doc.text(`Email: ${order.client.email}`);
    doc.moveDown(1);

    // Table header
    let y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Producto', COL.product, y, { width: COL.qty - COL.product - 10 });
    doc.text('Cant.', COL.qty, y, { width: COL.iva - COL.qty - 5 });
    doc.text('IVA', COL.iva, y, { width: COL.price - COL.iva - 5 });
    doc.text('Precio', COL.price, y, { width: COL.subtotal - COL.price - 5 });
    doc.text('Subtotal', COL.subtotal, y, { width: CONTENT_RIGHT - COL.subtotal, align: 'right' });
    y += 14;
    doc.moveTo(MARGIN, y).lineTo(CONTENT_RIGHT, y).strokeColor('#cccccc').stroke();
    y += 8;

    // Acumuladores para el desglose de IVA por tasa (se arma mientras se
    // dibuja cada fila, así se recorre `order.items` una sola vez).
    const subtotalByIva: Record<IvaType, number> = { BASICA: 0, MINIMA: 0 };

    doc.font('Helvetica').fontSize(9);
    for (const item of order.items) {
      if (y > 760) {
        doc.addPage();
        y = MARGIN;
      }
      subtotalByIva[item.ivaType] += item.subtotal;

      const name = item.product.code ? `${item.product.name} (${item.product.code})` : item.product.name;
      const rowHeight = doc.heightOfString(name, { width: COL.qty - COL.product - 10 });
      doc.text(name, COL.product, y, { width: COL.qty - COL.product - 10 });
      doc.text(String(item.quantity), COL.qty, y, { width: COL.iva - COL.qty - 5 });
      doc.text(IVA_SHORT_LABELS[item.ivaType], COL.iva, y, { width: COL.price - COL.iva - 5 });
      doc.text(formatCurrency(item.unitPrice), COL.price, y, { width: COL.subtotal - COL.price - 5 });
      doc.text(formatCurrency(item.subtotal), COL.subtotal, y, {
        width: CONTENT_RIGHT - COL.subtotal,
        align: 'right',
      });
      y += Math.max(rowHeight, 14) + 6;
    }

    doc.moveTo(MARGIN, y).lineTo(CONTENT_RIGHT, y).strokeColor('#cccccc').stroke();
    y += 10;
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(`TOTAL: ${formatCurrency(order.total)}`, MARGIN, y, { width: CONTENT_RIGHT - MARGIN, align: 'right' });
    y = doc.y + 6;

    // Discriminación de IVA — solo se muestran las tasas que efectivamente
    // aparecen en el pedido. El IVA se calcula "hacia atrás" porque el
    // precio de cada producto ya es el precio final (IVA incluido).
    const ivaTypesUsed = (Object.keys(subtotalByIva) as IvaType[]).filter((t) => subtotalByIva[t] > 0);
    if (ivaTypesUsed.length > 0) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text('Discriminación de IVA (incluido en el precio)', MARGIN, y);
      y = doc.y + 2;
      doc.font('Helvetica').fontSize(9).fillColor('#555');
      for (const ivaType of ivaTypesUsed) {
        const subtotal = subtotalByIva[ivaType];
        const ivaAmount = ivaAmountFromFinalPrice(subtotal, ivaType);
        doc.text(
          `${IVA_LABELS[ivaType]} — gravado: ${formatCurrency(subtotal)} · IVA contenido: ${formatCurrency(ivaAmount)}`,
          MARGIN,
          y
        );
        y = doc.y + 2;
      }
      doc.fillColor('#000');
    }

    if (order.notes) {
      doc.moveDown(2);
      doc.font('Helvetica-Bold').fontSize(9).text('Notas:');
      doc.font('Helvetica').fontSize(9).text(order.notes);
    }

    doc.end();
  });
}
