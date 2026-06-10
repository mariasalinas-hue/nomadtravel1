import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

export default function AgentInvoiceGenerator({ open, onClose, services, soldTrips: _soldTrips, currentUser }) {
  const [profileData, setProfileData] = useState({
    full_name: '',
    business_name: '',
    address: '',
    email: '',
    phone: '',
    rfc: '',
    bank_name: '',
    account_holder: '',
    clabe: ''
  });
  const [invoiceData, setInvoiceData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    travel_reference: '',
    description: 'Commission payment for trip referenced above per agreed split.'
  });
  const [autoInvoiceNumber, setAutoInvoiceNumber] = useState('');
  const [profileMeta, setProfileMeta] = useState({ id: null, nextNumber: 1 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open && currentUser) {
      fetchUserProfile();
    }
  }, [open, currentUser]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      if (!currentUser?.email) {
        setLoading(false);
        return;
      }
      // Fetch full profile from users table using Clerk email
      const { data: profile } = await supabase.from('users').select('*').eq('email', currentUser.email).single();
      const fullUser = profile || currentUser;

      setProfileData({
        full_name: fullUser.full_name || '',
        business_name: fullUser.business_name || '',
        address: fullUser.address || '',
        email: fullUser.email || '',
        phone: fullUser.phone || '',
        rfc: fullUser.rfc || '',
        bank_name: fullUser.bank_name || '',
        account_holder: fullUser.account_holder || fullUser.full_name || '',
        clabe: fullUser.clabe || ''
      });

      // Generate auto invoice number
      const year = new Date().getFullYear();
      const nextNumber = (fullUser.last_invoice_number || 0) + 1;
      const autoNumber = `INV-${year}-${String(nextNumber).padStart(3, '0')}`;
      setAutoInvoiceNumber(autoNumber);
      setProfileMeta({ id: profile?.id || null, nextNumber });
      setInvoiceData(prev => ({ ...prev, invoice_number: autoNumber }));
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    const newErrors = {};
    if (!invoiceData.invoice_number.trim()) newErrors.invoice_number = true;
    if (!invoiceData.due_date) newErrors.due_date = true;
    if (!invoiceData.travel_reference.trim()) newErrors.travel_reference = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Por favor completa los campos marcados en rojo');
      return;
    }

    setErrors({});
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let yPos = 20;

      // Colors
      const brandGreen = [46, 68, 42];
      const lightGreen = [234, 244, 232];
      const darkText = [33, 33, 33];
      const grayText = [120, 120, 120];
      const borderGray = [200, 200, 200];
      const zebraGray = [248, 248, 248];

      // ── Header bar ──
      doc.setFillColor(...brandGreen);
      doc.rect(0, 0, pageWidth, 36, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont(undefined, 'bold');
      doc.text('INVOICE', margin, 24);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`#${invoiceData.invoice_number}`, pageWidth - margin, 16, { align: 'right' });
      doc.text(`Date: ${invoiceData.invoice_date}`, pageWidth - margin, 23, { align: 'right' });
      doc.text(`Due: ${invoiceData.due_date}`, pageWidth - margin, 30, { align: 'right' });
      yPos = 48;

      // ── From / To side by side ──
      doc.setTextColor(...darkText);
      const colWidth = (contentWidth - 10) / 2;

      // FROM
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...grayText);
      doc.text('FROM', margin, yPos);
      yPos += 5;
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...darkText);
      doc.text(profileData.full_name || 'Agent Name', margin, yPos);
      yPos += 5;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...grayText);
      if (profileData.business_name) {
        doc.text(profileData.business_name, margin, yPos);
        yPos += 4;
      }
      if (profileData.address) {
        const addrLines = doc.splitTextToSize(profileData.address, colWidth);
        doc.text(addrLines, margin, yPos);
        yPos += addrLines.length * 4;
      }
      if (profileData.email) {
        doc.text(profileData.email, margin, yPos);
        yPos += 4;
      }
      if (profileData.phone) {
        doc.text(`Tel: ${profileData.phone}`, margin, yPos);
        yPos += 4;
      }
      if (profileData.rfc) {
        doc.text(`RFC: ${profileData.rfc}`, margin, yPos);
        yPos += 4;
      }

      // TO (right column, reset yPos to same start)
      const toStartY = 48;
      const rightCol = margin + colWidth + 10;
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...grayText);
      doc.text('BILL TO', rightCol, toStartY);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...darkText);
      doc.text('Nomad Travel LLC', rightCol, toStartY + 5);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...grayText);
      doc.text('3702 San Efrain Street', rightCol, toStartY + 10);
      doc.text('Mission, TX 78572, USA', rightCol, toStartY + 14);
      doc.text('info@nomadtravel.mx', rightCol, toStartY + 18);
      doc.text('Tax ID: 99-0692205', rightCol, toStartY + 22);

      // Ensure yPos accounts for both columns
      yPos = Math.max(yPos, toStartY + 28) + 6;

      // ── Travel Reference & Description ──
      if (invoiceData.travel_reference) {
        doc.setFillColor(...lightGreen);
        doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, 'F');
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...brandGreen);
        doc.text(`Travel Reference: ${invoiceData.travel_reference}`, margin + 4, yPos + 7.5);
        yPos += 16;
      }

      if (invoiceData.description) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...grayText);
        const descLines = doc.splitTextToSize(invoiceData.description, contentWidth);
        doc.text(descLines, margin, yPos);
        yPos += descLines.length * 4 + 4;
      }

      // ── Divider line ──
      doc.setDrawColor(...borderGray);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 6;

      // ── Commission Breakdown Table ──
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...darkText);
      doc.text('Commission Breakdown', margin, yPos);
      yPos += 8;

      // Table column positions
      const col1X = margin;        // Item name
      const col2X = 110;           // Commission
      const col3X = 145;           // Split %
      const col4X = pageWidth - margin; // Amount (right-aligned)
      const rowHeight = 8;

      const pageHeight = doc.internal.pageSize.getHeight();

      const drawTableHeader = () => {
        doc.setFillColor(...brandGreen);
        doc.roundedRect(margin, yPos, contentWidth, rowHeight, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text('ITEM / TRIP COMPONENT', col1X + 3, yPos + 5.5);
        doc.text('COMMISSION', col2X, yPos + 5.5);
        doc.text('SPLIT', col3X, yPos + 5.5);
        doc.text('AMOUNT OWED', col4X - 3, yPos + 5.5, { align: 'right' });
        yPos += rowHeight;
      };

      // Si el contenido no cabe, pasar a una página nueva (y repetir el header de tabla si aplica)
      const ensureSpace = (needed, withTableHeader = false) => {
        if (yPos + needed > pageHeight - 25) {
          doc.addPage();
          yPos = 20;
          if (withTableHeader) drawTableHeader();
        }
      };

      drawTableHeader();

      // Table Rows
      let totalOwed = 0;

      services.forEach((service, index) => {
        ensureSpace(rowHeight, true);
        const serviceName = getServiceName(service);
        const amountReceived = service.commission || 0;
        const agentSplit = 50;
        const amountOwed = amountReceived * 0.5;
        totalOwed += amountOwed;

        // Zebra striping
        if (index % 2 === 0) {
          doc.setFillColor(...zebraGray);
          doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
        }

        // Bottom border for each row
        doc.setDrawColor(...borderGray);
        doc.setLineWidth(0.1);
        doc.line(margin, yPos + rowHeight, pageWidth - margin, yPos + rowHeight);

        doc.setTextColor(...darkText);
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');

        // Truncate service name to fit column
        const maxNameWidth = col2X - col1X - 6;
        let displayName = serviceName;
        while (doc.getTextWidth(displayName) > maxNameWidth && displayName.length > 3) {
          displayName = displayName.slice(0, -4) + '...';
        }

        doc.text(displayName, col1X + 3, yPos + 5.5);
        doc.text(`$${amountReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, col2X, yPos + 5.5);
        doc.text(`${agentSplit}%`, col3X, yPos + 5.5);
        doc.setFont(undefined, 'bold');
        doc.text(`$${amountOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, col4X - 3, yPos + 5.5, { align: 'right' });
        yPos += rowHeight;
      });

      // ── Total Row ──
      yPos += 2;
      ensureSpace(14);
      doc.setFillColor(...brandGreen);
      doc.roundedRect(margin, yPos, contentWidth, 10, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('TOTAL COMMISSION OWED', col1X + 3, yPos + 7);
      doc.setFontSize(12);
      doc.text(`$${totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, col4X - 3, yPos + 7, { align: 'right' });
      yPos += 18;

      // ── Payment Instructions ──
      ensureSpace(40);
      doc.setDrawColor(...borderGray);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 6;

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...darkText);
      doc.text('Payment Instructions', margin, yPos);
      yPos += 7;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(...grayText);

      const paymentFields = [
        ['Bank', profileData.bank_name],
        ['Account Holder', profileData.account_holder],
        ['CLABE', profileData.clabe]
      ].filter(([, val]) => val);

      paymentFields.forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...darkText);
        doc.text(`${label}:`, margin, yPos);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...grayText);
        doc.text(value, margin + 32, yPos);
        yPos += 5;
      });

      // ── Footer ──
      const footerY = doc.internal.pageSize.getHeight() - 12;
      doc.setDrawColor(...borderGray);
      doc.setLineWidth(0.2);
      doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
      doc.setFontSize(7);
      doc.setTextColor(...grayText);
      doc.text('Thank you for your business.', margin, footerY);
      doc.text(`Generated on ${new Date().toLocaleDateString('en-US')}`, pageWidth - margin, footerY, { align: 'right' });

      // Save PDF
      doc.save(`Invoice_${invoiceData.invoice_number}_${profileData.full_name.replace(/\s+/g, '_')}.pdf`);

      // Persistir el consecutivo para que la próxima sugerencia avance
      if (profileMeta.id && invoiceData.invoice_number === autoInvoiceNumber) {
        await supabase.from('users')
          .update({ last_invoice_number: profileMeta.nextNumber })
          .eq('id', profileMeta.id);
      }

      toast.success('Factura generada exitosamente');
      onClose();
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar la factura');
    } finally {
      setGenerating(false);
    }
  };

  const getServiceName = (service) => {
    switch (service.service_type) {
      case 'hotel': return service.hotel_name || 'Hotel';
      case 'vuelo': return `${service.airline || 'Vuelo'} ${service.route || ''}`.trim();
      case 'traslado': return `Traslado ${service.transfer_origin || ''} → ${service.transfer_destination || ''}`;
      case 'tour': return service.tour_name || 'Tour';
      case 'crucero': return `${service.cruise_ship || 'Crucero'}${service.cruise_itinerary ? ` - ${service.cruise_itinerary}` : ''}`;
      case 'tren': return `${service.train_operator || 'Tren'} ${service.train_route || ''}`.trim();
      case 'dmc': return service.dmc_name || 'DMC';
      default: return service.other_name || 'Servicio';
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Cargando...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2E442A' }} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generar Factura de Comisiones
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            Se generará una factura por <strong>{services.length} servicio(s)</strong> con un total de comisión del <strong>50%</strong>.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número de factura <span className="text-red-500">*</span></Label>
              <Input
                value={invoiceData.invoice_number}
                onChange={(e) => {
                  setInvoiceData({ ...invoiceData, invoice_number: e.target.value });
                  if (errors.invoice_number && e.target.value.trim()) setErrors(prev => ({ ...prev, invoice_number: false }));
                }}
                placeholder="Ej: INV-2025-001"
                className={errors.invoice_number ? 'border-red-500 ring-1 ring-red-500' : ''}
              />
              {errors.invoice_number && <p className="text-xs text-red-500">Este campo es obligatorio</p>}
              {!errors.invoice_number && autoInvoiceNumber && (
                <p className="text-xs text-stone-500">Sugerido: {autoInvoiceNumber}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Fecha de factura</Label>
              <Input
                type="date"
                value={invoiceData.invoice_date}
                onChange={(e) => setInvoiceData({ ...invoiceData, invoice_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fecha de vencimiento <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              value={invoiceData.due_date}
              onChange={(e) => {
                setInvoiceData({ ...invoiceData, due_date: e.target.value });
                if (errors.due_date && e.target.value) setErrors(prev => ({ ...prev, due_date: false }));
              }}
              className={errors.due_date ? 'border-red-500 ring-1 ring-red-500' : ''}
            />
            {errors.due_date && <p className="text-xs text-red-500">Este campo es obligatorio</p>}
          </div>

          <div className="space-y-2">
            <Label>Referencia del viaje / Nombre del cliente <span className="text-red-500">*</span></Label>
            <Input
              value={invoiceData.travel_reference}
              onChange={(e) => {
                setInvoiceData({ ...invoiceData, travel_reference: e.target.value });
                if (errors.travel_reference && e.target.value.trim()) setErrors(prev => ({ ...prev, travel_reference: false }));
              }}
              placeholder="Ej: Japan Trip – Gonzalez Family"
              className={errors.travel_reference ? 'border-red-500 ring-1 ring-red-500' : ''}
            />
            {errors.travel_reference && <p className="text-xs text-red-500">Este campo es obligatorio</p>}
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={invoiceData.description}
              onChange={(e) => setInvoiceData({ ...invoiceData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Servicios a facturar:</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {services.map((service, index) => {
                const serviceName = getServiceName(service);
                const amountOwed = (service.commission || 0) * 0.5;

                return (
                  <div key={index} className="flex justify-between items-center bg-stone-50 p-2 rounded text-sm">
                    <span className="flex-1">{serviceName}</span>
                    <span className="text-stone-500 mx-4">50%</span>
                    <span className="font-semibold" style={{ color: '#2E442A' }}>
                      ${amountOwed.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center bg-stone-800 text-white p-3 rounded mt-2">
              <span className="font-semibold">Total a facturar:</span>
              <span className="text-lg font-bold">
                ${(services.reduce((sum, s) => sum + ((s.commission || 0) * 0.5), 0)).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={generatePDF}
              disabled={generating}
              className="text-white"
              style={{ backgroundColor: '#2E442A' }}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Generando...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Generar PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
