import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, Hotel, Plane, Car, Compass, Package, Ship, Train, Briefcase, Download, Loader2, ImagePlus } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/* ----------------------------------------------------------------------------
 * Brand palette (inline so html2canvas captures exact colors in the PDF)
 * -------------------------------------------------------------------------- */
const C = {
  green: '#2D4629',
  greenDark: '#1A2E17',
  greenLight: '#3F5E39',
  gold: '#C9A84C',
  goldSoft: '#E7D6A6',
  cream: '#FAF8F3',
  ink: '#1F2421',
  body: '#565C55',
  muted: '#9A998F',
  line: '#ECE8DD',
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

/* ------------------------------- service config ---------------------------- */
const SERVICE_ICONS = { hotel: Hotel, vuelo: Plane, traslado: Car, tren: Train, crucero: Ship, tour: Compass, dmc: Briefcase, otro: Package };
const SERVICE_LABELS = { hotel: 'Hospedaje', vuelo: 'Vuelos', traslado: 'Traslados', tren: 'Trenes', crucero: 'Cruceros', tour: 'Experiencias', dmc: 'Servicios en Destino', otro: 'Otros Servicios' };
const MEAL_PLAN_LABELS = { solo_habitacion: 'Solo Habitación', desayuno: 'Desayuno Incluido', all_inclusive: 'All Inclusive' };
const PAYMENT_METHOD_LABELS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', link_pago: 'Link de Pago', tarjeta_cliente: 'Tarjeta', otro: 'Otro' };
const TYPE_ORDER = ['hotel', 'vuelo', 'tren', 'traslado', 'crucero', 'tour', 'dmc', 'otro'];

/* Normalized {title, subtitle, details[]} view for any service type */
function buildServiceView(service) {
  switch (service.service_type) {
    case 'hotel':
      return {
        title: service.hotel_name || 'Hotel',
        subtitle: [service.hotel_chain, service.hotel_brand].filter(Boolean).join(' · '),
        details: [
          service.room_type && ['Habitación', service.room_type],
          service.check_in && service.check_out && ['Estancia', `${fmt(service.check_in, 'd MMM')} – ${fmt(service.check_out, 'd MMM yyyy')}`],
          service.nights && ['Noches', String(service.nights)],
          service.num_rooms && ['Habitaciones', String(service.num_rooms)],
          service.meal_plan && ['Plan', MEAL_PLAN_LABELS[service.meal_plan] || service.meal_plan],
          service.reservation_number && ['Reservación', service.reservation_number],
        ].filter(Boolean),
      };
    case 'vuelo':
      return {
        title: `${service.airline || 'Vuelo'}${service.airline_other ? ` (${service.airline_other})` : ''}`,
        subtitle: service.route || '',
        details: [
          service.flight_number && ['Vuelo', `#${service.flight_number}`],
          service.flight_date && ['Fecha', fmt(service.flight_date)],
          (service.departure_time || service.arrival_time) && ['Horario', `${service.departure_time || '--'} → ${service.arrival_time || '--'}`],
          service.flight_class && ['Clase', service.flight_class],
          service.baggage_included && ['Equipaje', service.baggage_included],
          service.passengers && ['Pasajeros', String(service.passengers)],
          service.flight_reservation_number && ['Reservación', service.flight_reservation_number],
        ].filter(Boolean),
      };
    case 'traslado':
      return {
        title: `${service.transfer_origin || 'Origen'} → ${service.transfer_destination || 'Destino'}`,
        subtitle: '',
        details: [
          service.transfer_type && ['Tipo', service.transfer_type === 'privado' ? 'Privado' : 'Compartido'],
          service.transfer_datetime && ['Fecha / Hora', format(parseDateTimeSafe(service.transfer_datetime), "d MMM yyyy · HH:mm", { locale: es })],
          service.vehicle && ['Vehículo', service.vehicle],
          service.transfer_passengers && ['Pasajeros', String(service.transfer_passengers)],
        ].filter(Boolean),
      };
    case 'tren':
      return {
        title: service.train_operator || 'Tren',
        subtitle: service.train_route || '',
        details: [
          service.train_number && ['Tren', `#${service.train_number}`],
          service.train_date && ['Fecha', fmt(service.train_date)],
          (service.train_departure_time || service.train_arrival_time) && ['Horario', `${service.train_departure_time || '--'} → ${service.train_arrival_time || '--'}`],
          service.train_class && ['Clase', service.train_class],
          service.train_passengers && ['Pasajeros', String(service.train_passengers)],
          service.train_reservation_number && ['Reservación', service.train_reservation_number],
        ].filter(Boolean),
      };
    case 'crucero':
      return {
        title: service.cruise_ship || 'Crucero',
        subtitle: service.cruise_line || '',
        details: [
          service.cruise_itinerary && ['Itinerario', service.cruise_itinerary],
          service.cruise_departure_port && ['Salida', service.cruise_departure_port],
          service.cruise_arrival_port && ['Llegada', service.cruise_arrival_port],
          service.cruise_departure_date && service.cruise_arrival_date && ['Fechas', `${fmt(service.cruise_departure_date, 'd MMM')} – ${fmt(service.cruise_arrival_date, 'd MMM yyyy')}`],
          service.cruise_nights && ['Noches', String(service.cruise_nights)],
          service.cruise_cabin_type && ['Cabina', service.cruise_cabin_type],
          service.cruise_passengers && ['Pasajeros', String(service.cruise_passengers)],
          service.cruise_reservation_number && ['Reservación', service.cruise_reservation_number],
        ].filter(Boolean),
      };
    case 'tour':
      return {
        title: service.tour_name || 'Experiencia',
        subtitle: service.tour_city || '',
        details: [
          service.tour_date && ['Fecha', fmt(service.tour_date)],
          service.tour_duration && ['Duración', service.tour_duration],
          service.tour_people && ['Personas', String(service.tour_people)],
          service.tour_includes && ['Incluye', service.tour_includes],
          service.tour_reservation_number && ['Reservación', service.tour_reservation_number],
        ].filter(Boolean),
      };
    case 'dmc':
      return {
        title: service.dmc_name || 'Servicios en destino',
        subtitle: service.dmc_destination || '',
        details: [
          service.dmc_services && ['Servicios', service.dmc_services],
          service.dmc_date && ['Fecha', fmt(service.dmc_date)],
          service.dmc_passengers && ['Pasajeros', String(service.dmc_passengers)],
          service.dmc_reservation_number && ['Reservación', service.dmc_reservation_number],
        ].filter(Boolean),
      };
    default:
      return {
        title: service.other_name || 'Servicio',
        subtitle: '',
        details: [
          service.other_description && ['Descripción', service.other_description],
          service.other_date && ['Fecha', fmt(service.other_date)],
        ].filter(Boolean),
      };
  }
}

/* Concise "what's included" highlights derived from the actual services */
function buildIncludeHighlights(servicesByType) {
  const out = [];
  if (servicesByType.hotel?.length) {
    const nights = servicesByType.hotel.reduce((s, h) => s + (Number(h.nights) || 0), 0);
    const names = servicesByType.hotel.map(h => h.hotel_name).filter(Boolean);
    out.push(`Hospedaje${nights ? ` · ${nights} noche${nights > 1 ? 's' : ''}` : ''}${names.length ? ` en ${names.join(', ')}` : ''}`);
  }
  if (servicesByType.vuelo?.length) out.push(`${servicesByType.vuelo.length} vuelo${servicesByType.vuelo.length > 1 ? 's' : ''} según itinerario`);
  if (servicesByType.tren?.length) out.push(`${servicesByType.tren.length} trayecto${servicesByType.tren.length > 1 ? 's' : ''} en tren`);
  if (servicesByType.traslado?.length) out.push(`Traslados ${servicesByType.traslado.some(t => t.transfer_type === 'privado') ? 'privados' : ''}`.trim());
  if (servicesByType.crucero?.length) out.push('Crucero con cabina y servicios a bordo indicados');
  if (servicesByType.tour?.length) {
    const names = servicesByType.tour.map(t => t.tour_name).filter(Boolean);
    out.push(`Experiencias${names.length ? `: ${names.join(', ')}` : ' seleccionadas'}`);
  }
  if (servicesByType.dmc?.length) out.push('Servicios y asistencia en destino (DMC)');
  if (servicesByType.otro?.length) servicesByType.otro.forEach(o => o.other_name && out.push(o.other_name));
  out.push('Asesoría y coordinación personalizada de su asesor Nomad');
  return out;
}

const EXCLUSIONS = [
  'Gastos personales (minibar, lavandería, llamadas, consumos extra).',
  'Propinas a guías, choferes y personal, salvo que se indique.',
  'Seguro de viaje y asistencia médica, salvo especificación.',
  'Pasaporte, visas, vacunas y trámites migratorios.',
  'Comidas, bebidas y excursiones no señaladas en el itinerario.',
  'Cualquier servicio no descrito en este documento.',
];

const TERMS = [
  ['Reservaciones y pagos', 'La reservación se confirma con el depósito acordado. El saldo deberá liquidarse en las fechas del plan de pagos. La falta de pago puede ocasionar la cancelación de servicios y la pérdida de depósitos no reembolsables.'],
  ['Tarifas y tipo de cambio', 'Las tarifas se expresan en USD y pueden variar hasta su pago total, conforme a disponibilidad y políticas de cada proveedor. Los pagos en otra moneda se calculan al tipo de cambio vigente del día.'],
  ['Cancelaciones y cambios', 'Toda cancelación o modificación está sujeta a las políticas de hoteles, aerolíneas y proveedores, que pueden incluir cargos o penalidades. Recomendamos contratar un seguro de cancelación.'],
  ['Documentación del viajero', 'Es responsabilidad del viajero contar con pasaporte vigente, visas y requisitos sanitarios del destino. La agencia no se hace responsable por negación de abordaje o entrada por documentación incompleta.'],
  ['Responsabilidad', 'Nomad Travel Society actúa como intermediario entre el cliente y los prestadores de servicios, por lo que no asume responsabilidad por eventos de fuerza mayor ajenos a su control.'],
];

export default function InvoiceView({ open, onClose, soldTrip, services = [], clientPayments = [] }) {
  const [generating, setGenerating] = useState(false);
  const [heroImage, setHeroImage] = useState(soldTrip?.cover_image || null);
  const fileInputRef = useRef(null);

  if (!soldTrip) return null;

  const totalPaid = clientPayments.reduce((sum, p) => sum + (p.amount_usd_fixed || p.amount || 0), 0);
  const total = services.reduce((sum, s) => sum + (s.total_price || 0), 0);
  const balance = total - totalPaid;

  const servicesByType = services.reduce((acc, s) => {
    (acc[s.service_type] = acc[s.service_type] || []).push(s);
    return acc;
  }, {});
  // Robust ordering: known types first, then any unexpected type so nothing is ever dropped
  const orderedTypes = [
    ...TYPE_ORDER.filter(t => servicesByType[t]?.length),
    ...Object.keys(servicesByType).filter(t => !TYPE_ORDER.includes(t)),
  ];

  const tripNights = (soldTrip.start_date && soldTrip.end_date)
    ? differenceInCalendarDays(parseDateOnlyLocal(soldTrip.end_date), parseDateOnlyLocal(soldTrip.start_date))
    : null;
  const ref = `NTS-${String(soldTrip.id || '').slice(0, 6).toUpperCase() || format(new Date(), 'yyMMdd')}`;
  const includeHighlights = buildIncludeHighlights(servicesByType);

  const statLine = [
    `${fmt(soldTrip.start_date, 'd MMM')}${soldTrip.end_date ? ` – ${fmt(soldTrip.end_date, 'd MMM yyyy')}` : ''}`,
    tripNights ? `${tripNights} noche${tripNights > 1 ? 's' : ''}` : null,
    `${soldTrip.travelers || 1} viajero${(soldTrip.travelers || 1) > 1 ? 's' : ''}`,
    `${services.length} servicio${services.length > 1 ? 's' : ''}`,
  ].filter(Boolean);

  const handlePrint = () => window.print();

  const handlePickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setHeroImage(ev.target.result); // data URL → safe for html2canvas
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
        const canvas = await html2canvas(block, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL("image/png");
        const imgW = pageW;
        const imgH = (canvas.height * imgW) / canvas.width;

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
      pdf.save(`Itinerario_Nomad_${(soldTrip.client_name || 'Cliente').replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("Error generando PDF:", err);
    } finally {
      setGenerating(false);
    }
  };

  /* -------------------------------- sub-renderers ------------------------------- */
  const SectionTitle = ({ children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <span style={{ width: 20, height: 1, background: C.gold }} />
      <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.green }}>{children}</span>
    </div>
  );

  const renderServiceRow = (service, idx) => {
    const Icon = SERVICE_ICONS[service.service_type] || Package;
    const { title, subtitle, details } = buildServiceView(service);
    return (
      <div key={idx} style={{ display: 'flex', gap: 14, padding: '15px 0', borderBottom: `1px solid ${C.line}` }}>
        <Icon style={{ width: 17, height: 17, color: C.gold, flexShrink: 0, marginTop: 3 }} strokeWidth={1.5} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
            <p style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: C.ink, margin: 0 }}>{title}</p>
            <p style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: C.green, margin: 0, whiteSpace: 'nowrap' }}>
              ${(service.total_price || 0).toLocaleString()} <span style={{ fontSize: 9, fontWeight: 500, color: C.muted }}>USD</span>
            </p>
          </div>
          {subtitle && <p style={{ fontFamily: SANS, fontSize: 11, color: C.gold, margin: '2px 0 0', fontWeight: 500 }}>{subtitle}</p>}
          {details.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 20px', marginTop: 8 }}>
              {details.map(([label, value], i) => (
                <p key={i} style={{ fontFamily: SANS, fontSize: 10.5, color: C.body, margin: 0, lineHeight: 1.5 }}>
                  <span style={{ color: C.muted }}>{label}: </span>{value}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const pad = { padding: '0 48px' };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <DialogTitle className="text-base font-bold" style={{ color: C.green, fontFamily: SERIF }}>
            Itinerario de Viaje
          </DialogTitle>
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

          {/* —————————————————————— HEADER —————————————————————— */}
          <div className="pdf-block">
            <div style={{
              position: 'relative',
              minHeight: heroImage ? 220 : 'auto',
              backgroundColor: C.green,
              backgroundImage: heroImage
                ? `linear-gradient(180deg, rgba(26,46,23,0.30) 0%, rgba(26,46,23,0.55) 55%, rgba(26,46,23,0.92) 100%), url(${heroImage})`
                : `linear-gradient(135deg, ${C.green} 0%, ${C.greenDark} 100%)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: heroImage ? '40px 48px 26px' : '30px 48px 26px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, border: `1.5px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 600, color: C.gold }}>N</span>
                  </div>
                  <div>
                    <h2 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: C.white, margin: 0, lineHeight: 1.1 }}>Nomad Travel Society</h2>
                    <p style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.24em', color: C.goldSoft, margin: '5px 0 0', textTransform: 'uppercase' }}>Luxury Travel</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.white, margin: 0 }}>{ref}</p>
                  <p style={{ fontFamily: SANS, fontSize: 10, color: C.goldSoft, margin: '3px 0 0' }}>{format(new Date(), 'd MMMM yyyy', { locale: es })}</p>
                </div>
              </div>
              <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 2.5, background: `linear-gradient(90deg, ${C.gold}, ${C.goldSoft})` }} />
            </div>

            {/* Client / trip intro */}
            <div style={{ padding: '34px 48px 8px' }}>
              <p style={{ fontFamily: SANS, fontSize: 9.5, letterSpacing: '0.22em', color: C.gold, margin: 0, textTransform: 'uppercase', fontWeight: 600 }}>Preparado para</p>
              <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, color: C.ink, margin: '8px 0 2px', lineHeight: 1.05 }}>{soldTrip.client_name}</h1>
              <p style={{ fontFamily: SERIF, fontSize: 16, fontStyle: 'italic', color: C.greenLight, margin: 0 }}>
                {soldTrip.destination}{soldTrip.trip_name ? ` — ${soldTrip.trip_name}` : ''}
              </p>
              <p style={{ fontFamily: SANS, fontSize: 11.5, color: C.muted, margin: '16px 0 0', letterSpacing: '0.02em' }}>
                {statLine.join('   ·   ')}
              </p>
            </div>
          </div>

          {/* —————————————————————— SERVICES (one block per type) —————————————————————— */}
          {orderedTypes.map((type) => (
            <div className="pdf-block" key={type}>
              <div style={{ ...pad, paddingTop: 30 }}>
                <SectionTitle>{SERVICE_LABELS[type] || 'Servicios'}</SectionTitle>
                <div>{servicesByType[type].map((s, i) => renderServiceRow(s, i))}</div>
              </div>
            </div>
          ))}

          {/* —————————————————————— INCLUDES / EXCLUDES —————————————————————— */}
          <div className="pdf-block">
            <div style={{ ...pad, paddingTop: 34 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 36 }}>
                <div>
                  <SectionTitle>Su experiencia incluye</SectionTitle>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {includeHighlights.map((item, i) => (
                      <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, fontFamily: SANS, fontSize: 11.5, color: C.body, lineHeight: 1.45 }}>
                        <span style={{ color: C.gold, fontWeight: 700, flexShrink: 0 }}>✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ borderLeft: `1px solid ${C.line}`, paddingLeft: 32 }}>
                  <p style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.18em', color: C.muted, textTransform: 'uppercase', margin: '2px 0 16px' }}>No incluye</p>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {EXCLUSIONS.map((item, i) => (
                      <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 9, fontFamily: SANS, fontSize: 10.5, color: C.body, lineHeight: 1.4 }}>
                        <span style={{ color: C.muted, flexShrink: 0 }}>—</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* —————————————————————— INVESTMENT SUMMARY —————————————————————— */}
          <div className="pdf-block">
            <div style={{ ...pad, paddingTop: 36 }}>
              <SectionTitle>Resumen de inversión</SectionTitle>

              {clientPayments.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 22 }}>
                  <thead>
                    <tr>
                      {['Fecha', 'Método', 'Monto'].map((h, i) => (
                        <th key={i} style={{ textAlign: i === 2 ? 'right' : 'left', padding: '0 0 8px', fontFamily: SANS, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: C.muted, textTransform: 'uppercase', borderBottom: `1px solid ${C.line}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...clientPayments].sort((a, b) => parseDateOnlyLocal(a.date) - parseDateOnlyLocal(b.date)).map((p, i) => {
                      const currency = p.currency || 'USD';
                      const amountOriginal = p.amount_original || p.amount || 0;
                      const amountUSD = p.amount_usd_fixed || p.amount || 0;
                      return (
                        <tr key={i}>
                          <td style={{ padding: '9px 0', fontFamily: SANS, fontSize: 11, color: C.body, borderBottom: `1px solid ${C.line}` }}>{fmt(p.date)}</td>
                          <td style={{ padding: '9px 0', fontFamily: SANS, fontSize: 11, color: C.body, borderBottom: `1px solid ${C.line}` }}>
                            {PAYMENT_METHOD_LABELS[p.method] || p.method}
                            {currency !== 'USD' && <span style={{ color: C.muted, fontSize: 9.5 }}> · {amountOriginal.toLocaleString()} {currency}{p.fx_rate ? ` @ ${Number(p.fx_rate).toFixed(2)}` : ''}</span>}
                          </td>
                          <td style={{ padding: '9px 0', textAlign: 'right', fontFamily: SANS, fontSize: 11, fontWeight: 600, color: C.greenLight, borderBottom: `1px solid ${C.line}` }}>${amountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: 300 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 12, color: C.body, padding: '7px 0' }}>
                    <span>Total del viaje</span><span style={{ fontWeight: 600 }}>${total.toLocaleString()} USD</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 12, color: C.body, padding: '7px 0', borderBottom: `1px solid ${C.line}` }}>
                    <span>Pagado a la fecha</span><span style={{ fontWeight: 600, color: C.greenLight }}>${totalPaid.toLocaleString()} USD</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12 }}>
                    <span style={{ fontFamily: SANS, fontSize: 10.5, letterSpacing: '0.12em', color: C.muted, textTransform: 'uppercase' }}>Saldo pendiente</span>
                    <span style={{ fontFamily: SERIF, fontSize: 23, fontWeight: 700, color: C.green }}>${balance.toLocaleString()} <span style={{ fontSize: 11 }}>USD</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* —————————————————————— TERMS & FOOTER —————————————————————— */}
          <div className="pdf-block">
            <div style={{ ...pad, paddingTop: 38 }}>
              <SectionTitle>Términos y condiciones</SectionTitle>
              {TERMS.map(([heading, text], i) => (
                <div key={i} style={{ marginBottom: 11 }}>
                  <p style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: C.green, margin: '0 0 2px' }}>{i + 1}. {heading}</p>
                  <p style={{ fontFamily: SANS, fontSize: 9.5, color: C.body, lineHeight: 1.5, margin: 0, textAlign: 'justify' }}>{text}</p>
                </div>
              ))}
              <p style={{ fontFamily: SANS, fontSize: 9, color: C.muted, fontStyle: 'italic', margin: '8px 0 0' }}>
                La confirmación del pago implica la aceptación de los presentes términos y condiciones.
              </p>
            </div>

            <div style={{ marginTop: 36, padding: '26px 48px', borderTop: `1px solid ${C.line}`, textAlign: 'center' }}>
              <span style={{ display: 'inline-block', width: 30, height: 2, background: C.gold, marginBottom: 14 }} />
              <p style={{ fontFamily: SERIF, fontSize: 15, fontStyle: 'italic', color: C.green, margin: 0 }}>Gracias por viajar con nosotros</p>
              <p style={{ fontFamily: SANS, fontSize: 9.5, letterSpacing: '0.16em', color: C.muted, margin: '10px 0 0', textTransform: 'uppercase' }}>
                Nomad Travel Society · San Pedro Garza García, N.L.
              </p>
              <p style={{ fontFamily: SANS, fontSize: 9.5, color: C.muted, margin: '4px 0 0' }}>contacto@nomadtravelsociety.com</p>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
