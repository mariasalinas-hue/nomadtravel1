// Extrae los datos de un servicio de viaje desde una imagen o PDF (confirmación,
// voucher, cotización, factura) usando OpenAI gpt-4o (visión) y los DEVUELVE al
// frontend para autollenar el formulario de servicio. No escribe en la base de
// datos: el agente revisa y guarda manualmente.
//
// Deploy:  supabase functions deploy extractServiceData
// Secreto: supabase secrets set OPENAI_API_KEY=sk-...
import OpenAI from 'npm:openai@4.73.1';

const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT = `Eres un asistente de una agencia de viajes de lujo. Analiza el/los archivo(s)
adjunto(s) (confirmación de reserva, voucher, factura, cotización o itinerario) y extrae los
datos del servicio de viaje para autollenar un formulario.

Devuelve SOLO un JSON válido con esta forma exacta:
{ "service": { ...campos... } }

Reglas:
- "service_type" debe ser uno de: hotel, vuelo, traslado, tour, crucero, tren, dmc, otro.
- Usa SOLO las llaves que correspondan al tipo detectado. Omite las que no apliquen.
- Fechas SIEMPRE en formato YYYY-MM-DD.
- Montos numéricos (sin símbolos ni comas). Si el documento está en otra moneda, pon el monto
  en "local_amount" y el código ISO en "local_currency" (ej. "MXN", "EUR"); deja "total_price"
  vacío para que se convierta. Si ya está en USD, usa "total_price".
- No inventes datos: si un dato no aparece, omite la llave.

Llaves comunes: service_type, total_price, commission, confirmation_number, notes,
local_currency, local_amount.
Por tipo:
- hotel: hotel_name, hotel_chain, check_in, check_out
- vuelo: airline, flight_number, flight_date, passengers
- traslado: transfer_origin, transfer_destination
- tour: tour_name, tour_date
- crucero: cruise_line, cruise_ship, cruise_departure_date, cruise_arrival_date
- tren: train_operator, train_number, train_date
- dmc: dmc_name, dmc_date
- otro: other_name, other_description, other_date

En "notes" resume detalles útiles (nº de noches, tipo de habitación, pasajeros, horarios, etc.).`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { file_urls } = await req.json();

    if (!file_urls || !Array.isArray(file_urls) || file_urls.length === 0) {
      return Response.json({ error: 'file_urls array is required' }, { status: 400, headers: corsHeaders });
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const content: any[] = [{ type: 'text', text: PROMPT }];

    for (const url of file_urls) {
      const isPdf = /\.pdf(\?|$)/i.test(url);
      if (isPdf) {
        // gpt-4o acepta PDFs como bloque "file" con base64
        const res = await fetch(url);
        const buf = new Uint8Array(await res.arrayBuffer());
        let binary = '';
        for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
        const b64 = btoa(binary);
        content.push({
          type: 'file',
          file: { filename: 'documento.pdf', file_data: `data:application/pdf;base64,${b64}` },
        });
      } else {
        content.push({ type: 'image_url', image_url: { url } });
      }
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const data = JSON.parse(completion.choices[0].message.content!);
    const service = data.service || data;

    return Response.json({ success: true, service }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error extracting service data:', error);
    return Response.json(
      { error: 'Failed to extract service data', details: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
});
