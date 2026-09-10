import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabaseAPI } from '@/api/supabaseClient';

// Deriva un nombre presentable a partir del correo: frida.guzman@x -> "Frida Guzman"
const nameFromEmail = (email) =>
  (email.split('@')[0] || '')
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

// Auto-alta de agentes: cuando alguien inicia sesión (Clerk) y NO tiene ficha
// en la tabla de usuarios del CRM, se la crea automáticamente. Así ningún
// agente vuelve a quedar "fantasma" (con login y viajes pero sin perfil).
// Funciona con la anon key porque la tabla users tiene RLS deshabilitado.
export function useEnsureAgentProfile() {
  const { isLoaded, isSignedIn, user } = useUser();
  const done = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || done.current) return;
    const email = user.primaryEmailAddress?.emailAddress?.toLowerCase().trim();
    if (!email) return;
    done.current = true; // intentar una sola vez por sesión

    (async () => {
      try {
        const existing = await supabaseAPI.entities.User.filter({ email });
        if (existing && existing.length > 0) return; // ya tiene ficha, nada que hacer

        const full_name =
          user.fullName ||
          [user.firstName, user.lastName].filter(Boolean).join(' ') ||
          nameFromEmail(email);

        await supabaseAPI.entities.User.create({
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
          email,
          full_name,
          role: 'user',
          is_active: true,
          metadata: { agent_commission_rate: 50, auto_provisioned: true },
        });
      } catch (e) {
        // Silencioso: si otra pestaña la creó primero (correo único) u otro
        // error, NO romper el login. El admin siempre puede darla de alta a mano.
        if (!/duplicate|unique|23505/i.test(e?.message || '')) {
          console.warn('No se pudo auto-crear la ficha de agente:', e?.message);
        }
      }
    })();
  }, [isLoaded, isSignedIn, user]);
}
