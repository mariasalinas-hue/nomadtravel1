// "Pregúntale a tu CRM": recibe una pregunta en lenguaje natural + un resumen
// (contexto JSON) de los datos del agente, y responde en español usando SOLO esos
// datos. No escribe en la base de datos; solo lee el contexto que le manda el front.
//
// Deploy:  supabase functions deploy askCrm
// Secreto: supabase secrets set OPENAI_API_KEY=sk-...   (la misma llave que ya usas)
import OpenAI from 'npm:openai@4.73.1';

const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `Eres el asistente de datos del CRM "Nomad Travel", una agencia de viajes de lujo.
Respondes SIEMPRE en español, de forma breve, clara y directa.

Usa ÚNICAMENTE la información del CONTEXTO (un JSON con los datos del agente) para responder.
Si la respuesta no está en los datos, dilo con honestidad ("No tengo ese dato en tu información").
Nunca inventes cifras.

Glosario de los datos:
- "ventas" o "vendido" = campo total_usd de cada viaje.
- "comisión" = campo comision_usd.
- "fecha de venta" (cuándo se vendió) = campo vendido.
- "fecha de viaje" (cuándo viajan) = campos viaje_inicio / viaje_fin.
- "cotizaciones" = la lista de cotizaciones (aún no vendidas), con su etapa.
- Los montos están en dólares (USD).

Reglas de respuesta:
- Cuando des cifras de dinero, redondéalas y usa formato con signo $ y comas (ej. $12,500).
- Si la pregunta es sobre un periodo (un mes, un año), filtra por la fecha correcta (venta vs viaje) según lo que pregunten; si es ambiguo, aclara cuál usaste.
- Si listas viajes o clientes, usa viñetas y máximo lo relevante.
- No muestres el JSON crudo; responde en lenguaje natural.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { question, context } = await req.json();

    if (!question || typeof question !== 'string') {
      return Response.json({ error: 'question is required' }, { status: 400, headers: corsHeaders });
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `CONTEXTO (datos del agente):\n${JSON.stringify(context ?? {})}\n\nPREGUNTA:\n${question}`,
        },
      ],
      temperature: 0.2,
    });

    const answer = completion.choices[0]?.message?.content?.trim() || 'No pude generar una respuesta.';

    return Response.json({ success: true, answer }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error in askCrm:', error);
    return Response.json(
      { error: 'Failed to answer', details: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
});
