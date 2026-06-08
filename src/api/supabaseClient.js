import { createClient } from '@supabase/supabase-js';

// Obtener las variables de entorno de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validar que las variables de entorno estén configuradas
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Faltan las variables de entorno de Supabase');
  console.error('Por favor configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env');
}

// Crear el cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Helper functions para interactuar con las tablas de manera similar a base44

export const createSupabaseAPI = () => {
  // Función helper genérica para crear métodos CRUD para cualquier tabla
  const createEntityMethods = (tableName, options = {}) => ({
    // Listar todos los registros (excluye eliminados)
    list: async (orderBy = null) => {
      let query = supabase.from(tableName).select('*');

      // Solo aplicar filtro is_deleted si la tabla lo soporta
      if (options.hasIsDeleted !== false) {
        query = query.eq('is_deleted', false);
      }

      // Ordenamiento personalizado o por defecto
      if (orderBy) {
        // Si orderBy empieza con '-', ordenar descendente
        const isDescending = orderBy.startsWith('-');
        const field = isDescending ? orderBy.substring(1) : orderBy;
        query = query.order(field, { ascending: !isDescending });
      } else if (options.hasCreatedDate !== false) {
        // Solo ordenar por created_date si la tabla tiene esa columna y no se especificó otro orden
        query = query.order('created_date', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error listing ${tableName}:`, error.message || error);
        console.error('Full error details:', error);
        throw error;
      }
      return data || [];
    },

    // Filtrar registros (excluye eliminados por defecto)
    filter: async (filters = {}) => {
      let query = supabase.from(tableName).select('*');

      // Excluir eliminados por defecto solo si la tabla soporta is_deleted
      if (options.hasIsDeleted !== false && !filters.hasOwnProperty('is_deleted')) {
        query = query.eq('is_deleted', false);
      }

      // Aplicar cada filtro
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      // Solo ordenar por created_date si la tabla lo soporta
      if (options.hasCreatedDate !== false) {
        query = query.order('created_date', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error filtering ${tableName}:`, error);
        throw error;
      }
      return data || [];
    },

    // Obtener un registro por ID
    get: async (id) => {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error(`Error getting ${tableName}:`, error);
        throw error;
      }
      return data;
    },

    // Crear un nuevo registro
    create: async (newData) => {
      const { data, error } = await supabase
        .from(tableName)
        .insert([newData])
        .select()
        .single();

      if (error) {
        console.error(`❌ Error creating ${tableName}:`, error);
        console.error('📋 Full error object:', JSON.stringify(error, null, 2));
        console.error('💬 Error message:', error.message);
        console.error('📝 Error details:', error.details);
        console.error('💡 Error hint:', error.hint);
        console.error('🔢 Error code:', error.code);
        console.error('📦 Data sent:', JSON.stringify(newData, null, 2));
        console.error('📌 Keys sent:', Object.keys(newData));
        throw error;
      }
      return data;
    },

    // Crear múltiples registros
    bulkCreate: async (dataArray) => {
      const { data, error } = await supabase
        .from(tableName)
        .insert(dataArray)
        .select();

      if (error) {
        console.error(`❌ Error bulk creating ${tableName}:`, error);
        console.error('📦 Data sent:', JSON.stringify(dataArray, null, 2));
        throw error;
      }
      return data;
    },

    // Actualizar un registro existente
    update: async (id, updates) => {
      const { data, error } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`Error updating ${tableName}:`, error);
        throw error;
      }
      return data;
    },

    // Eliminar un registro (soft delete - marca como eliminado, o hard delete si no soporta is_deleted)
    delete: async (id) => {
      // Si la tabla no soporta is_deleted, hacer hard delete
      if (options.hasIsDeleted === false) {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('id', id);

        if (error) {
          console.error(`Error deleting ${tableName}:`, error);
          throw error;
        }
        return { success: true };
      }

      // Soft delete (marca como eliminado)
      const { data, error } = await supabase
        .from(tableName)
        .update({
          is_deleted: true
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`Error deleting ${tableName}:`, error);
        throw error;
      }
      return data;
    },

    // Eliminar permanentemente (hard delete - solo usar cuando sea necesario)
    hardDelete: async (id) => {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`Error hard deleting ${tableName}:`, error);
        throw error;
      }
      return { success: true };
    }
  });

  return {
    // Autenticación
    auth: {
      signUp: async (email, password, metadata = {}) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: metadata
          }
        });
        if (error) throw error;
        return data;
      },

      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        return data;
      },

      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },

      getCurrentUser: async () => {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
      },

      getSession: async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session;
      },

      onAuthStateChange: (callback) => {
        return supabase.auth.onAuthStateChange(callback);
      }
    },

    // Storage - Manejo de archivos
    storage: {
      uploadFile: async (file, bucket = 'documents', path = null) => {
        try {
          // Generar un nombre único para el archivo
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = path ? `${path}/${fileName}` : fileName;

          // Subir el archivo al bucket
          const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (error) {
            console.error('Error uploading file:', error);
            throw error;
          }

          // Obtener la URL pública del archivo
          const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(data.path);

          return {
            file_url: publicUrlData.publicUrl,
            file_path: data.path,
            file_name: file.name
          };
        } catch (error) {
          console.error('Error in uploadFile:', error);
          throw error;
        }
      },

      deleteFile: async (filePath, bucket = 'documents') => {
        const { error } = await supabase.storage
          .from(bucket)
          .remove([filePath]);

        if (error) {
          console.error('Error deleting file:', error);
          throw error;
        }
        return { success: true };
      },

      getPublicUrl: (filePath, bucket = 'documents') => {
        const { data } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);
        return data.publicUrl;
      }
    },

    // Entidades del CRM - crear métodos para cada tabla
    entities: {
      User: createEntityMethods('users', { hasIsDeleted: false, hasCreatedDate: false }),
      Client: createEntityMethods('clients'),
      Trip: createEntityMethods('trips'),
      SoldTrip: createEntityMethods('sold_trips'),
      Task: createEntityMethods('tasks', { hasIsDeleted: false }),
      TripService: createEntityMethods('trip_services', { hasIsDeleted: false }),
      ClientPayment: createEntityMethods('client_payments', { hasIsDeleted: false }),
      ClientPaymentPlan: createEntityMethods('client_payment_plan'), // SÍ tiene is_deleted
      SupplierPayment: createEntityMethods('supplier_payments', { hasIsDeleted: false }),
      GroupMember: createEntityMethods('group_members', { hasIsDeleted: false }),
      Supplier: createEntityMethods('suppliers'),
      SupplierContact: createEntityMethods('supplier_contacts'),
      SupplierDocument: createEntityMethods('supplier_documents'),
      Reminder: createEntityMethods('reminders'),
      Credential: createEntityMethods('credentials'),
      PersonalCredential: createEntityMethods('personal_credentials'),
      Review: createEntityMethods('reviews'),
      Attendance: createEntityMethods('attendance'),
      FamTrip: createEntityMethods('fam_trips'),
      IndustryFair: {
        ...createEntityMethods('industry_fairs'),
        // Override list to ensure JSON fields are properly handled
        list: async (orderBy = null) => {
          let query = supabase.from('industry_fairs').select('*');
          query = query.eq('is_deleted', false);

          if (orderBy) {
            const isDescending = orderBy.startsWith('-');
            const field = isDescending ? orderBy.substring(1) : orderBy;
            query = query.order(field, { ascending: !isDescending });
          } else {
            query = query.order('created_date', { ascending: false });
          }

          const { data, error } = await query;

          if (error) {
            console.error(`Error listing industry_fairs:`, error);
            throw error;
          }

          // Ensure JSON fields are properly parsed
          return (data || []).map(fair => ({
            ...fair,
            includes: typeof fair.includes === 'string' ? JSON.parse(fair.includes) : (fair.includes || {}),
            assigned_agents: typeof fair.assigned_agents === 'string' ? JSON.parse(fair.assigned_agents) : (fair.assigned_agents || [])
          }));
        },
        // Override get to ensure JSON fields are properly handled
        get: async (id) => {
          const { data, error } = await supabase
            .from('industry_fairs')
            .select('*')
            .eq('id', id)
            .single();

          if (error) {
            console.error(`Error getting industry_fairs:`, error);
            throw error;
          }

          // Ensure JSON fields are properly parsed
          return {
            ...data,
            includes: typeof data.includes === 'string' ? JSON.parse(data.includes) : (data.includes || {}),
            assigned_agents: typeof data.assigned_agents === 'string' ? JSON.parse(data.assigned_agents) : (data.assigned_agents || [])
          };
        }
      },
      Commission: createEntityMethods('commissions'),
      TravelDocument: createEntityMethods('travel_documents'),
      LearningMaterial: createEntityMethods('learning_materials'),
      TripNote: createEntityMethods('trip_notes'),
      TripDocumentFile: createEntityMethods('trip_document_files'),
      TripReminder: createEntityMethods('trip_reminders'),
      ErrorReport: createEntityMethods('error_reports', { hasIsDeleted: false }),
      SharedTripForm: createEntityMethods('shared_trip_forms', { hasIsDeleted: false }),
      ServiceDropdownOption: createEntityMethods('service_dropdown_options', { hasIsDeleted: false, hasCreatedDate: false })
    }
  };
};

// Exportar la API
export const supabaseAPI = createSupabaseAPI();

// Re-export del cliente para uso directo cuando sea necesario
export default supabase;
