import { useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { X, Download, Loader2, ArrowRightLeft, AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/dateUtils';

const money = (n) => `$${Math.round(n || 0).toLocaleString()}`;

const METHOD_LABELS = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta',
  link_pago: 'Link de pago', tarjeta_cliente: 'Tarjeta del cliente', otro: 'Otro',
};
const methodLabel = (m) => METHOD_LABELS[m] || m || '—';

// Colores de marca (inline para que html2canvas los capture fiel en el PDF)
const GREEN = '#2E442A';
const GOLD = '#C9A84C';

const typeColor = (raw) => (raw === 'neto' ? '#059669' : raw === 'bruto' ? '#ea580c' : '#d97706');

/**
 * Reporte de auditoría de comisiones de un viaje. Muestra el desglose completo
 * (comisiones, pagos del cliente, pagos a proveedores, saldo) y el veredicto del
 * traspaso, para detectar dónde está el descuadre. Se puede editar el tipo y el
 * canal de cada comisión desde aquí, y descargar en PDF para el agente.
 *
 * data = { trip, agentName, fin, verdict, netPending, services[], clientPayments[], supplierPayments[] }
 */
export default function TripAuditReport({ open, data, channelOptions = [], onUpdateService, onClose }) {
  const [generating, setGenerating] = useState(false);
  const [printing, setPrinting] = useState(false);
  if (!open || !data) return null;

  const { trip, agentName, fin, verdict, netPending = 0, services = [], clientPayments = [], supplierPayments = [] } = data;
  const cuadra = verdict.type !== 'revisar';
  const hasNet = fin.net > 0;
  const sinTipoCount = services.filter(s => s.paymentTypeRaw === 'sin').length;

  const totalPrice = trip?.total_price || 0;
  const totalPaidClient = trip?.total_paid_by_client || 0;
  const owedByClient = totalPrice - totalPaidClient;

  const clientName = trip?.client_name || 'Cliente';
  const fileName = `Auditoria_${clientName.replace(/\s+/g, '_')}.pdf`;

  const handleDownloadPDF = async () => {
    setPrinting(true);
    // esperar a que el DOM cambie los selectores por texto plano
    await new Promise(r => setTimeout(r, 60));
    const element = document.getElementById('trip-audit-report');
    if (!element) { setPrinting(false); return; }
    setGenerating(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const blocks = Array.from(element.querySelectorAll('.pdf-block'));
      let cursorY = 0;
      for (const block of blocks) {
        const canvas = await html2canvas(block, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const imgW = pageW;
        const imgH = (canvas.height * imgW) / canvas.width;
        if (imgH <= pageH) {
          if (cursorY + imgH > pageH + 0.5) { pdf.addPage(); cursorY = 0; }
          pdf.addImage(imgData, 'PNG', 0, cursorY, imgW, imgH);
          cursorY += imgH;
        } else {
          if (cursorY > 0) { pdf.addPage(); cursorY = 0; }
          let position = 0;
          let heightLeft = imgH;
          pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
          heightLeft -= pageH;
          while (heightLeft > 0) {
            pdf.addPage();
            position -= pageH;
            pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
            heightLeft -= pageH;
          }
          cursorY = pageH;
        }
      }
      pdf.save(fileName);
    } catch (err) {
      console.error('Error generando PDF de auditoría:', err);
    } finally {
      setGenerating(false);
      setPrinting(false);
    }
  };

  const cell = { padding: '6px 8px', fontSize: '11px', borderBottom: '1px solid #eee' };
  const th = { ...cell, fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', borderBottom: '1px solid #e5e7eb', textAlign: 'left' };
  const box = { flex: '1 1 150px', border: '1px solid #eee', borderRadius: '10px', padding: '10px 12px' };
  const boxLabel = { fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af' };
  const boxValue = { fontSize: '16px', fontWeight: 700, marginTop: '2px' };
  const selectStyle = (raw) => ({
    fontSize: '11px', fontWeight: 700, color: typeColor(raw), border: '1px solid #e5e7eb',
    borderRadius: '6px', padding: '2px 4px', background: '#fff', cursor: 'pointer',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior (no entra al PDF) */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <p className="text-sm font-bold text-stone-700">Reporte de auditoría · {clientName}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleDownloadPDF} disabled={generating} className="rounded-lg text-white" style={{ backgroundColor: GREEN }}>
              {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
              Descargar PDF
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100" title="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Aviso de comisiones sin tipo (no entra al PDF) */}
        {sinTipoCount > 0 && !printing && (
          <div className="mx-5 mt-3 rounded-lg px-3 py-2 text-xs flex items-center gap-2" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Hay <strong>{sinTipoCount}</strong> comisión{sinTipoCount !== 1 ? 'es' : ''} <strong>sin tipo</strong>. Corrige el tipo (Neto/Bruto) abajo para que el traspaso cuadre bien.
          </div>
        )}

        {/* Contenido del reporte (esto es lo que se captura al PDF) */}
        <div id="trip-audit-report" style={{ color: '#1c1c1e' }}>
          {/* Bloque 1: encabezado + veredicto + resumen */}
          <div className="pdf-block" style={{ padding: '24px 28px', background: '#fff' }}>
            {/* Encabezado */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${GREEN}`, paddingBottom: '12px' }}>
              <div>
                <p style={{ fontSize: '20px', fontWeight: 800, color: GREEN, letterSpacing: '0.02em' }}>NOMAD TRAVEL</p>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Reporte de auditoría de comisiones</p>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: '#6b7280' }}>
                <p><strong style={{ color: '#1c1c1e' }}>{clientName}</strong></p>
                {trip?.destination && <p>{trip.destination}</p>}
                <p>Agente: {agentName}</p>
                {(trip?.start_date || trip?.end_date) && (
                  <p>{trip?.start_date ? formatDate(trip.start_date, 'd MMM yyyy') : ''}{trip?.end_date ? ` – ${formatDate(trip.end_date, 'd MMM yyyy')}` : ''}</p>
                )}
              </div>
            </div>

            {/* Veredicto del traspaso */}
            {hasNet && netPending > 0 && (
              <div style={{
                marginTop: '16px', borderRadius: '10px', padding: '12px 14px',
                background: cuadra ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${cuadra ? '#a7f3d0' : '#fecaca'}`,
              }}>
                <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: cuadra ? '#059669' : '#dc2626' }}>
                  Comisiones netas · traspaso Operaciones → Revenue
                </p>
                <p style={{ fontSize: '14px', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', color: cuadra ? '#047857' : '#b91c1c' }}>
                  {cuadra
                    ? <><ArrowRightLeft size={16} /> Cuadra — pasar {money(netPending)} de Operaciones a Revenue</>
                    : <><AlertTriangle size={16} /> No cuadra — saldo {money(fin.saldo)} vs netas {money(fin.net)}, faltan {money(verdict.shortfall)}</>}
                </p>
              </div>
            )}
            {hasNet && netPending <= 0 && (
              <div style={{ marginTop: '16px', borderRadius: '10px', padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={16} /> Las comisiones netas ya están en Revenue — no hay nada pendiente de traspasar.
                </p>
              </div>
            )}

            {/* Resumen financiero */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
              <div style={box}>
                <p style={boxLabel}>Comisión bruta</p>
                <p style={{ ...boxValue, color: '#ea580c' }}>{money(fin.gross)}</p>
              </div>
              <div style={box}>
                <p style={boxLabel}>Comisión neta</p>
                <p style={{ ...boxValue, color: '#047857' }}>{money(fin.net)}</p>
              </div>
              <div style={box}>
                <p style={boxLabel}>Saldo en cuenta</p>
                <p style={{ ...boxValue, color: fin.saldo < 0 ? '#dc2626' : '#1c1c1e' }}>{money(fin.saldo)}</p>
                <p style={{ fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}>Cliente pagó {money(fin.clientIn)} − Nomad pagó {money(fin.nomadOut)}</p>
              </div>
            </div>

            {/* Estado de cuenta del cliente */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              <div style={box}>
                <p style={boxLabel}>Precio total del viaje</p>
                <p style={boxValue}>{money(totalPrice)}</p>
              </div>
              <div style={box}>
                <p style={boxLabel}>Cliente pagó</p>
                <p style={boxValue}>{money(totalPaidClient)}</p>
              </div>
              <div style={box}>
                <p style={boxLabel}>Por cobrar al cliente</p>
                <p style={{ ...boxValue, color: owedByClient > 0 ? '#dc2626' : '#047857' }}>{money(owedByClient)}</p>
              </div>
            </div>

            {/* Posible causa del descuadre */}
            {hasNet && !cuadra && (
              <div style={{ marginTop: '16px', borderRadius: '10px', padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', marginBottom: '4px' }}>¿Qué revisar? El saldo no alcanza para cubrir las comisiones netas (faltan {money(verdict.shortfall)}):</p>
                <ul style={{ fontSize: '11px', color: '#92400e', paddingLeft: '16px', lineHeight: 1.6 }}>
                  <li>¿El cliente pagó todo? {owedByClient > 0 ? `Aún debe ${money(owedByClient)}.` : 'Ya pagó el total del viaje.'}</li>
                  <li>¿Las comisiones netas están bien capturadas (monto y tipo neto/bruto)?</li>
                  <li>¿Falta registrar algún pago del cliente, o hay un pago a proveedor de más?</li>
                </ul>
              </div>
            )}
          </div>

          {/* Bloque 2: servicios y comisiones (tipo y canal editables) */}
          <div className="pdf-block" style={{ padding: '8px 28px 20px', background: '#fff' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: GREEN, margin: '8px 0' }}>Servicios y comisiones</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Servicio</th>
                  <th style={th}>Tipo</th>
                  <th style={th}>Canal</th>
                  <th style={{ ...th, textAlign: 'right' }}>Comisión</th>
                  <th style={{ ...th, textAlign: 'right' }}>Agente</th>
                  <th style={{ ...th, textAlign: 'right' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {services.map(s => (
                  <tr key={s.id} style={s.paymentTypeRaw === 'sin' && !printing ? { background: '#fffbeb' } : undefined}>
                    <td style={cell}>{s.name}</td>
                    <td style={cell}>
                      {printing ? (
                        <span style={{ fontWeight: 700, color: typeColor(s.paymentTypeRaw) }}>{s.type}</span>
                      ) : (
                        <select
                          value={s.paymentTypeRaw}
                          onChange={(e) => onUpdateService?.(s.id, { payment_type: e.target.value === 'sin' ? null : e.target.value })}
                          style={selectStyle(s.paymentTypeRaw)}
                        >
                          <option value="neto">Neto</option>
                          <option value="bruto">Bruto</option>
                          <option value="sin">Sin tipo</option>
                        </select>
                      )}
                    </td>
                    <td style={cell}>
                      {printing ? (
                        <span style={{ color: '#6b7280' }}>{(channelOptions.find(o => o.value === s.channelRaw)?.label) || s.channelRaw || '—'}</span>
                      ) : (
                        <select
                          value={s.channelRaw || ''}
                          onChange={(e) => onUpdateService?.(s.id, { reserved_by: e.target.value || null })}
                          style={{ fontSize: '11px', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '2px 4px', background: '#fff', cursor: 'pointer', maxWidth: '130px' }}
                        >
                          <option value="">—</option>
                          {channelOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          {s.channelRaw && !channelOptions.some(o => o.value === s.channelRaw) && (
                            <option value={s.channelRaw}>{s.channelRaw}</option>
                          )}
                        </select>
                      )}
                    </td>
                    <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>{money(s.commission)}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{money(s.agentShare)}</td>
                    <td style={{ ...cell, textAlign: 'right', color: '#6b7280' }}>{s.stageLabel}</td>
                  </tr>
                ))}
                {services.length === 0 && (
                  <tr><td style={{ ...cell, color: '#9ca3af' }} colSpan={6}>Sin comisiones registradas</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ ...cell, fontWeight: 700 }} colSpan={3}>Total</td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{money(services.reduce((a, s) => a + s.commission, 0))}</td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{money(services.reduce((a, s) => a + s.agentShare, 0))}</td>
                  <td style={cell}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bloque 3: pagos del cliente y a proveedores */}
          <div className="pdf-block" style={{ padding: '8px 28px 24px', background: '#fff' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: GREEN, margin: '8px 0' }}>Pagos del cliente (entran a Operaciones)</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Método</th>
                  <th style={{ ...th, textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {clientPayments.map((p, i) => (
                  <tr key={i}>
                    <td style={cell}>{p.date ? formatDate(p.date, 'd MMM yyyy') : '—'}</td>
                    <td style={cell}>{methodLabel(p.method)}{p.excluded && <span style={{ color: '#9ca3af' }}> · no entra a Operaciones</span>}</td>
                    <td style={{ ...cell, textAlign: 'right', fontWeight: 600, color: p.excluded ? '#9ca3af' : '#1c1c1e' }}>{money(p.amount)}</td>
                  </tr>
                ))}
                {clientPayments.length === 0 && (
                  <tr><td style={{ ...cell, color: '#9ca3af' }} colSpan={3}>Sin pagos registrados</td></tr>
                )}
              </tbody>
            </table>

            <p style={{ fontSize: '12px', fontWeight: 700, color: GREEN, margin: '16px 0 8px' }}>Pagos a proveedores (salen de Operaciones)</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Concepto</th>
                  <th style={th}>Método</th>
                  <th style={{ ...th, textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {supplierPayments.map((p, i) => (
                  <tr key={i}>
                    <td style={cell}>{p.date ? formatDate(p.date, 'd MMM yyyy') : '—'}</td>
                    <td style={cell}>{p.label || '—'}</td>
                    <td style={cell}>{methodLabel(p.method)}{p.excluded && <span style={{ color: '#9ca3af' }}> · tarjeta del cliente</span>}</td>
                    <td style={{ ...cell, textAlign: 'right', fontWeight: 600, color: p.excluded ? '#9ca3af' : '#1c1c1e' }}>{money(p.amount)}</td>
                  </tr>
                ))}
                {supplierPayments.length === 0 && (
                  <tr><td style={{ ...cell, color: '#9ca3af' }} colSpan={4}>Sin pagos registrados</td></tr>
                )}
              </tbody>
            </table>

            <p style={{ fontSize: '9px', color: '#9ca3af', marginTop: '16px', borderTop: `1px solid ${GOLD}33`, paddingTop: '8px' }}>
              Generado por Nomad Travel · {formatDate(new Date(), 'd MMM yyyy')}. El saldo en cuenta excluye lo pagado con tarjeta del cliente (no pasa por la cuenta de Nomad).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
