import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://trxjzszcgoxaujfobrdk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyeGp6c3pjZ294YXVqZm9icmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMTEzMjEsImV4cCI6MjA5MzY4NzMyMX0.X35CXqXwCK1QS6ZtgnsUiAloMghPyX636C8pu9JIOzw";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createUser() {
  console.log("Tentando criar usuário via API do Supabase...");
  const { data, error } = await supabase.auth.signUp({
    email: 'acaiprimaveradelivery01@gmail.com',
    password: '79507950THY@z',
  });

  if (error) {
    console.error("Erro ao criar usuário:", error.message);
  } else {
    console.log("Usuário criado com sucesso!");
    console.log("ID do Usuário:", data.user?.id);
  }
}

createUser();
