import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, Download, Loader2, ImagePlus } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/* ----------------------------------------------------------------------------
 * Brand palette (inline so html2canvas captures exact colors in the PDF)
 * -------------------------------------------------------------------------- */
const C = {
  green: '#2D4629',
  greenDark: '#1A2E17',
  greenLight: '#3F5E39',
  gold: '#A98C3D',
  goldSoft: '#E7D6A6',
  cream: '#FAF8F2',
  ink: '#23271F',
  body: '#565C55',
  muted: '#9A998F',
  line: '#E7E2D6',
  white: '#FFFFFF',
};
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/* ---------------------------------- date helpers --------------------------- */
function parseDateOnlyLocal(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr === "string" && dateStr.includes("T")) return new Date(dateStr);
  const parts = String(dateStr).split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}
function parseDateTimeSafe(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return parseDateOnlyLocal(value);
  return new Date(value);
}
const fmt = (d, pattern = 'd MMM yyyy') => {
  const date = parseDateOnlyLocal(d);
  return date ? format(date, pattern, { locale: es }) : '';
};
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/* ------------------------------- service config ---------------------------- */
const MEAL_PLAN_LABELS = { solo_habitacion: 'Solo Habitación', desayuno: 'Desayuno Incluido', all_inclusive: 'All Inclusive' };
const PAYMENT_METHOD_LABELS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', link_pago: 'Link de Pago', tarjeta_cliente: 'Tarjeta del cliente', otro: 'Otro' };
const TYPE_ORDER = ['hotel', 'vuelo', 'tren', 'traslado', 'crucero', 'tour', 'dmc', 'otro'];

/* Builds a compact {title, tag, detail, price} row for any service type */
function buildRow(service) {
  const join = (arr) => arr.filter(Boolean).join('  ·  ');
  const price = service.total_price || 0;
  switch (service.service_type) {
    case 'hotel':
      return {
        title: service.hotel_name || 'Hotel',
        tag: [service.hotel_chain, service.hotel_brand].filter(Boolean).join(' · '),
        detail: join([
          service.room_type,
          service.nights && `${service.nights} noche${service.nights > 1 ? 's' : ''}`,
          service.num_rooms && `${service.num_rooms} hab`,
          service.check_in && service.check_out && `${fmt(service.check_in, 'd MMM')} → ${fmt(service.check_out, 'd MMM yyyy')}`,
          service.meal_plan && (MEAL_PLAN_LABELS[service.meal_plan] || service.meal_plan),
          service.reservation_number && `Res. ${service.reservation_number}`,
        ]), price,
      };
    case 'vuelo':
      return {
        title: `${service.airline || 'Vuelo'}${service.airline_other ? ` (${service.airline_other})` : ''}`,
        tag: service.route || '',
        detail: join([
          service.flight_number && `Vuelo #${service.flight_number}`,
          service.flight_date && fmt(service.flight_date),
          (service.departure_time || service.arrival_time) && `${service.departure_time || '--'} → ${service.arrival_time || '--'}`,
          service.flight_class,
          service.baggage_included && `Equipaje: ${service.baggage_included}`,
          service.passengers && `${service.passengers} pax`,
          service.flight_reservation_number && `Res. ${service.flight_reservation_number}`,
        ]), price,
      };
    case 'traslado':
      return {
        title: `${service.transfer_origin || 'Origen'} → ${service.transfer_destination || 'Destino'}`,
        tag: service.transfer_type ? (service.transfer_type === 'privado' ? 'Privado' : 'Compartido') : '',
        detail: join([
          service.transfer_datetime && format(parseDateTimeSafe(service.transfer_datetime), "d MMM yyyy · HH:mm", { locale: es }),
          service.vehicle,
          service.transfer_passengers && `${service.transfer_passengers} pax`,
        ]), price,
      };
    case 'tren':
      return {
        title: service.train_operator || 'Tren',
        tag: service.train_route || '',
        detail: join([
          service.train_number && `Tren #${service.train_number}`,
          service.train_date && fmt(service.train_date),
          (service.train_departure_time || service.train_arrival_time) && `${service.train_departure_time || '--'} → ${service.train_arrival_time || '--'}`,
          service.train_class,
          service.train_passengers && `${service.train_passengers} pax`,
          service.train_reservation_number && `Res. ${service.train_reservation_number}`,
        ]), price,
      };
    case 'crucero':
      return {
        title: service.cruise_ship || 'Crucero',
        tag: service.cruise_line || '',
        detail: join([
          service.cruise_itinerary,
          service.cruise_departure_port && service.cruise_arrival_port && `${service.cruise_departure_port} → ${service.cruise_arrival_port}`,
          service.cruise_departure_date && service.cruise_arrival_date && `${fmt(service.cruise_departure_date, 'd MMM')} → ${fmt(service.cruise_arrival_date, 'd MMM yyyy')}`,
          service.cruise_nights && `${service.cruise_nights} noches`,
          service.cruise_cabin_type,
          service.cruise_passengers && `${service.cruise_passengers} pax`,
        ]), price,
      };
    case 'tour':
      return {
        title: service.tour_name || 'Experiencia',
        tag: service.tour_city || '',
        detail: join([
          service.tour_date && fmt(service.tour_date),
          service.tour_duration,
          service.tour_people && `${service.tour_people} pax`,
          service.tour_includes,
        ]), price,
      };
    case 'dmc':
      return {
        title: service.dmc_name || 'Servicios en destino',
        tag: service.dmc_destination || '',
        detail: join([
          service.dmc_services,
          service.dmc_date && fmt(service.dmc_date),
          service.dmc_passengers && `${service.dmc_passengers} pax`,
          service.dmc_reservation_number && `Res. ${service.dmc_reservation_number}`,
        ]), price,
      };
    default:
      return {
        title: service.other_name || 'Servicio',
        tag: '',
        detail: join([service.other_description, service.other_date && fmt(service.other_date)]),
        price,
      };
  }
}

/* Bank accounts — kept in sync with PaymentInfoModal */
const BANK_ACCOUNTS = [
  { title: 'PESOS MEXICANOS — BBVA', lines: ['Nomad Trotamundos SA. de CV.', 'Cuenta: 0123468666', 'CLABE: 012580001234686668'] },
  { title: 'DÓLARES — BANCO BASE', lines: ['Nomad Trotamundos SA. de CV.', 'SPID: 4558045987360214', 'CLABE: 145580459873602014'] },
  { title: 'DÓLARES — DENTRO DE USA', lines: ['Nomad Travel LLC', 'Account: 822001064274', 'Routing: 026073150', 'SWIFT: CMFGUS33', 'Bank: Community Federal Savings Bank', 'Woodhaven, NY 11421, USA'] },
];

const TERMS = [
  ['Reservaciones y Pagos', 'Para confirmar su reservación se requiere un anticipo mínimo del 50% del total del viaje. El saldo restante deberá liquidarse con un mínimo de 30 días naturales antes de la fecha de inicio. En reservaciones con menos de 30 días de anticipación, el pago total será requerido al confirmar.'],
  ['Política de Cancelación', 'Más de 60 días: reembolso del 80%. Entre 30 y 60 días: 50%. Entre 15 y 29 días: 25%. Menos de 15 días o no presentación: sin reembolso. Se aplicarán cargos adicionales según políticas de cada proveedor.'],
  ['Modificaciones', 'Cualquier cambio estará sujeto a disponibilidad y puede generar cargos adicionales. Las modificaciones deben solicitarse por escrito con mínimo 72 horas de anticipación.'],
  ['Documentación de Viaje', 'El cliente es responsable de contar con documentación vigente (pasaporte, visas, permisos). Nomad Travel Society no se hace responsable por negativas de ingreso por documentación incorrecta.'],
  ['Seguros de Viaje', 'Se recomienda contratar un seguro de viaje que cubra cancelaciones, emergencias médicas, pérdida de equipaje y retrasos. Podemos asistir en la contratación a solicitud del cliente.'],
  ['Responsabilidad', 'Nomad Travel Society actúa como intermediario. No somos responsables por cancelaciones, retrasos o situaciones fuera de nuestro control causadas por terceros, condiciones climáticas o fuerza mayor.'],
  ['Precios y Divisas', 'Precios en USD salvo indicación contraria. Sujetos a disponibilidad hasta confirmar con anticipo. Pagos en MXN al tipo de cambio vigente al momento del pago.'],
  ['Privacidad', 'La información personal se usará exclusivamente para gestión de reservaciones y no será compartida sin consentimiento, salvo cuando sea necesario para los servicios contratados.'],
];

const CONTACT = 'hola@nomadtravelsociety.com  ·  +52 (81) 0000-0000  ·  www.nomadtravelsociety.com';

/* A client payment that was auto-generated from a supplier payment (paid with the client's card) */
const isSupplierDerived = (p) => (p.notes || '').includes('Generado automáticamente por pago a proveedor');

export default function InvoiceView({ open, onClose, soldTrip, services = [], clientPayments = [] }) {
  const [generating, setGenerating] = useState(false);
  const [heroImage, setHeroImage] = useState(soldTrip?.cover_image || null);
  const fileInputRef = useRef(null);

  if (!soldTrip) return null;

  // "Sin pagos a proveedores": exclude client payments auto-generated from supplier card payments
  const visiblePayments = clientPayments.filter(p => !isSupplierDerived(p));
  const totalPaid = visiblePayments.reduce((sum, p) => sum + (p.amount_usd_fixed || p.amount || 0), 0);
  const total = services.reduce((sum, s) => sum + (s.total_price || 0), 0);
  const balance = total - totalPaid;

  const servicesByType = services.reduce((acc, s) => {
    (acc[s.service_type] = acc[s.service_type] || []).push(s);
    return acc;
  }, {});
  const orderedServices = [
    ...TYPE_ORDER.flatMap(t => servicesByType[t] || []),
    ...Object.keys(servicesByType).filter(t => !TYPE_ORDER.includes(t)).flatMap(t => servicesByType[t]),
  ];

  const tripNights = (soldTrip.start_date && soldTrip.end_date)
    ? differenceInCalendarDays(parseDateOnlyLocal(soldTrip.end_date), parseDateOnlyLocal(soldTrip.start_date))
    : null;
  const invNo = soldTrip.invoice_number || (soldTrip.id ? String(soldTrip.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() : format(new Date(), 'yyMMdd'));
  const ref = `INV-${invNo}`;

  const handlePrint = () => window.print();
  const handlePickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setHeroImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById("invoice-content");
    if (!element) return;
    setGenerating(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const blocks = Array.from(element.querySelectorAll('.pdf-block'));
      let cursorY = 0;

      for (const block of blocks) {
        const forceBreak = block.dataset.pageBreak === 'before';
        const canvas = await html2canvas(block, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL("image/png");
        const imgW = pageW;
        const imgH = (canvas.height * imgW) / canvas.width;

        if (forceBreak && cursorY > 0) { pdf.addPage(); cursorY = 0; }

        if (imgH <= pageH) {
          if (cursorY + imgH > pageH + 0.5) { pdf.addPage(); cursorY = 0; }
          pdf.addImage(imgData, "PNG", 0, cursorY, imgW, imgH);
          cursorY += imgH;
        } else {
          if (cursorY > 0) { pdf.addPage(); cursorY = 0; }
          let position = 0;
          let heightLeft = imgH;
          pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
          heightLeft -= pageH;
          while (heightLeft > 0) {
            pdf.addPage();
            position -= pageH;
            pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
            heightLeft -= pageH;
          }
          cursorY = pageH;
        }
      }
      pdf.save(`Invoice_Nomad_${(soldTrip.client_name || 'Cliente').replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Error generando PDF:", err);
    } finally {
      setGenerating(false);
    }
  };

  /* -------------------------------- shared bits ------------------------------- */
  const pad = '0 44px';

  const SectionLabel = ({ children }) => (
    <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.gold, margin: 0 }}>{children}</p>
  );

  // Repeated header used on pages 2 & 3
  const PageHeader = ({ rightLabel }) => (
    <div style={{ padding: '24px 44px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 14, borderBottom: `2px solid ${C.green}` }}>
        <span style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: C.green }}>Nomad Travel Society</span>
        <span style={{ fontFamily: SANS, fontSize: 10.5, letterSpacing: '0.12em', color: C.muted, textTransform: 'uppercase' }}>{rightLabel}</span>
      </div>
    </div>
  );

  const FooterBand = () => (
    <div style={{ marginTop: 28, background: C.green, padding: '15px 44px', textAlign: 'center' }}>
      <span style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.04em', color: C.goldSoft }}>{CONTACT}</span>
    </div>
  );

  const cell = { fontFamily: SANS, fontSize: 11, color: C.body, padding: '11px 12px', borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' };
  const headCell = { fontFamily: SANS, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.white, padding: '10px 12px', textAlign: 'left' };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <DialogTitle className="text-base font-bold" style={{ color: C.green, fontFamily: SERIF }}>Invoice</DialogTitle>
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="rounded-xl">
              <ImagePlus className="w-4 h-4 mr-2" /> {heroImage ? 'Cambiar foto' : 'Foto de portada'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={generating} className="rounded-xl">
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {generating ? 'Generando…' : 'PDF'}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl">
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
          </div>
        </DialogHeader>

        {/* ============================ INVOICE DOCUMENT ============================ */}
        <div id="invoice-content" style={{ background: C.white, fontFamily: SANS, color: C.body }}>

          {/* ============================== PAGE 1 ============================== */}
          {/* Header: logo lockup + cover photo with "Invoice" */}
          <div className="pdf-block">
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, minHeight: 150 }}>
              {/* Logo lockup */}
              <div style={{ flex: '1 1 52%', background: C.cream, display: 'flex', alignItems: 'center', padding: '0 36px', borderRight: `1px solid ${C.line}` }}>
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, color: C.green, lineHeight: 1 }}>Nomad</div>
                  <div style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '0.34em', color: C.gold, marginTop: 6, textTransform: 'uppercase' }}>Travel Society</div>
                </div>
              </div>
              {/* Cover photo / title */}
              <div style={{
                flex: '1 1 48%', position: 'relative', minHeight: 150,
                backgroundColor: C.green,
                backgroundImage: heroImage
                  ? `linear-gradient(180deg, rgba(26,46,23,0.30) 0%, rgba(26,46,23,0.78) 100%), url(${heroImage})`
                  : `linear-gradient(135deg, ${C.greenLight} 0%, ${C.greenDark} 100%)`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end',
                padding: '0 36px',
              }}>
                <div style={{ fontFamily: SERIF, fontSize: 42, fontWeight: 600, color: C.white, lineHeight: 1.1 }}>Invoice</div>
                <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', color: C.goldSoft, marginTop: 4 }}>{ref}</div>
                <div style={{ fontFamily: SANS, fontSize: 10.5, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{format(new Date(), 'd MMMM yyyy', { locale: es })}</div>
              </div>
            </div>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${C.gold}, ${C.goldSoft})` }} />

            {/* Bill-to + meta */}
            <div style={{ padding: '26px 44px 0', display: 'flex', justifyContent: 'space-between', gap: 24 }}>
              <div>
                <SectionLabel>Invoice para</SectionLabel>
                <p style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: C.ink, margin: '7px 0 2px', lineHeight: 1.15 }}>{soldTrip.client_name}</p>
                <p style={{ fontFamily: SANS, fontSize: 12, color: C.body, margin: 0 }}>{soldTrip.destination}{soldTrip.trip_name ? ` — ${soldTrip.trip_name}` : ''}</p>
                <p style={{ fontFamily: SANS, fontSize: 11.5, color: C.muted, margin: '3px 0 0' }}>
                  {fmt(soldTrip.start_date)}{soldTrip.end_date ? ` → ${fmt(soldTrip.end_date)}` : ''}{tripNights ? `  ·  ${tripNights} noche${tripNights > 1 ? 's' : ''}` : ''}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <SectionLabel>Fecha de emisión</SectionLabel>
                <p style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: C.ink, margin: '7px 0 12px' }}>{format(new Date(), 'd MMM yyyy', { locale: es })}</p>
                <SectionLabel>Viajeros</SectionLabel>
                <p style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: C.ink, margin: '7px 0 0' }}>{soldTrip.travelers || 1}</p>
              </div>
            </div>
          </div>

          {/* Services table + totals */}
          <div className="pdf-block">
            <div style={{ padding: pad, paddingTop: 22 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: C.green }}>
                    <th style={{ ...headCell, width: '38%' }}>Servicio / Descripción</th>
                    <th style={{ ...headCell, width: '47%' }}>Detalle</th>
                    <th style={{ ...headCell, width: '15%', textAlign: 'right' }}>Precio (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedServices.map((s, i) => {
                    const row = buildRow(s);
                    return (
                      <tr key={i}>
                        <td style={cell}>
                          <span style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 600, color: C.ink }}>{row.title}</span>
                          {row.tag && <span style={{ display: 'block', fontFamily: SANS, fontSize: 10, color: C.gold, marginTop: 2 }}>{row.tag}</span>}
                        </td>
                        <td style={{ ...cell, color: C.body, fontSize: 10.5, lineHeight: 1.5 }}>{row.detail || '—'}</td>
                        <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: C.green, whiteSpace: 'nowrap' }}>{money(row.price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <div style={{ width: 280 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 12, color: C.body, padding: '6px 0' }}>
                    <span>Subtotal</span><span style={{ fontWeight: 600 }}>{money(total)} USD</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 12, color: C.body, padding: '6px 0', borderBottom: `1px solid ${C.line}` }}>
                    <span>Pagado</span><span style={{ fontWeight: 600, color: C.greenLight }}>− {money(totalPaid)} USD</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.green, borderRadius: 8, padding: '12px 16px', marginTop: 12 }}>
                    <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: C.goldSoft, textTransform: 'uppercase' }}>Saldo Pendiente</span>
                    <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, color: C.white, lineHeight: 1.4 }}>{money(balance)} USD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment history + acceptance footer */}
          <div className="pdf-block">
            <div style={{ padding: pad, paddingTop: 26 }}>
              {visiblePayments.length > 0 && (
                <>
                  <SectionLabel>Historial de pagos</SectionLabel>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ background: C.green }}>
                        <th style={{ ...headCell, width: '46%' }}>Descripción</th>
                        <th style={{ ...headCell, width: '18%' }}>Fecha</th>
                        <th style={{ ...headCell, width: '20%' }}>Método</th>
                        <th style={{ ...headCell, width: '16%', textAlign: 'right' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...visiblePayments].sort((a, b) => parseDateOnlyLocal(a.date) - parseDateOnlyLocal(b.date)).map((p, i) => {
                        const currency = p.currency || 'USD';
                        const amountUSD = p.amount_usd_fixed || p.amount || 0;
                        const amountOriginal = p.amount_original || p.amount || 0;
                        return (
                          <tr key={i}>
                            <td style={{ ...cell, fontSize: 10.5 }}>{p.notes || 'Pago recibido'}</td>
                            <td style={cell}>{fmt(p.date)}</td>
                            <td style={cell}>{PAYMENT_METHOD_LABELS[p.method] || p.method}</td>
                            <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: C.greenLight, whiteSpace: 'nowrap' }}>
                              {money(amountUSD)} USD
                              {currency !== 'USD' && <span style={{ display: 'block', fontFamily: SANS, fontSize: 8.5, color: C.muted, fontWeight: 500 }}>{amountOriginal.toLocaleString()} {currency}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}

              <p style={{ fontFamily: SANS, fontSize: 10.5, color: C.muted, textAlign: 'center', margin: '22px 0 0', fontStyle: 'italic' }}>
                Consulta los datos para realizar tu pago y los Términos y Condiciones en las páginas siguientes.
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 26, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
                <span style={{ fontFamily: SANS, fontSize: 10, color: C.muted }}>Agencia de viajes · Nomad Travel Society</span>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 180, borderBottom: `1px solid ${C.ink}`, marginBottom: 6 }} />
                  <span style={{ fontFamily: SANS, fontSize: 9.5, color: C.muted, letterSpacing: '0.05em' }}>Aceptado por el cliente</span>
                </div>
              </div>
            </div>
          </div>

          {/* ============================== PAGE 2: payment info ============================== */}
          <div className="pdf-block" data-page-break="before">
            <PageHeader rightLabel={ref} />
            <div style={{ padding: '24px 44px 0' }}>
              <p style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: C.ink, margin: '0 0 16px' }}>Datos para realizar tu pago</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                {BANK_ACCOUNTS.map((acc, i) => (
                  <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px', background: C.cream }}>
                    <p style={{ fontFamily: SANS, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', color: C.green, margin: '0 0 10px' }}>{acc.title}</p>
                    {acc.lines.map((l, j) => (
                      <p key={j} style={{ fontFamily: SANS, fontSize: 10.5, color: j === 0 ? C.ink : C.body, fontWeight: j === 0 ? 600 : 400, margin: '0 0 4px', lineHeight: 1.45, wordBreak: 'break-word' }}>{l}</p>
                    ))}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px 18px', background: C.white }}>
                <p style={{ fontFamily: SANS, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', color: C.green, margin: '0 0 6px' }}>PAGO CON TARJETA DE CRÉDITO</p>
                <p style={{ fontFamily: SANS, fontSize: 10.5, color: C.body, margin: 0, lineHeight: 1.5 }}>
                  Se cobra en USD al tipo de cambio de tu banco ese día. Los pagos con tarjeta tienen un cargo adicional del 4% sobre el total.
                </p>
              </div>
            </div>
            <FooterBand />
          </div>

          {/* ============================== PAGE 3: terms ============================== */}
          <div className="pdf-block" data-page-break="before">
            <PageHeader rightLabel="Términos y Condiciones" />
            <div style={{ padding: '24px 44px 0' }}>
              <p style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: C.ink, margin: '0 0 16px' }}>Términos y Condiciones</p>
              {TERMS.map(([heading, text], i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <p style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: C.green, margin: '0 0 3px' }}>{i + 1}. {heading}</p>
                  <p style={{ fontFamily: SANS, fontSize: 10, color: C.body, lineHeight: 1.55, margin: 0, textAlign: 'justify' }}>{text}</p>
                </div>
              ))}
              <p style={{ fontFamily: SANS, fontSize: 9.5, color: C.muted, fontStyle: 'italic', textAlign: 'center', margin: '16px 0 0', paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
                Al realizar el pago del anticipo o total, el cliente acepta íntegramente estos términos y condiciones.
              </p>
            </div>
            <FooterBand />
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
