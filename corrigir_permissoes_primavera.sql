-- 1. Habilitar RLS na tabela (caso ainda não esteja)
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;

-- 2. Política para Entregadores VEREM as corridas disponíveis
-- Um entregador pode ver a corrida se ela estiver pendente e sem motorista
CREATE POLICY "Entregadores podem ver corridas pendentes" 
ON public.ride_requests 
FOR SELECT 
USING ( status = 'pending' AND driver_id IS NULL );

-- 3. Política para Entregadores VEREM as próprias corridas (em andamento/concluídas)
CREATE POLICY "Entregadores podem ver suas próprias corridas" 
ON public.ride_requests 
FOR SELECT 
USING ( auth.uid() = driver_id );

-- 4. Política para Entregadores ACEITAREM/ATUALIZAREM corridas
CREATE POLICY "Entregadores podem atualizar corridas" 
ON public.ride_requests 
FOR UPDATE 
USING ( auth.uid() = driver_id OR status = 'pending' );

-- 5. (Opcional) Garantir que os clientes continuem podendo ler e criar suas próprias corridas
CREATE POLICY "Clientes podem ver as próprias corridas" 
ON public.ride_requests 
FOR SELECT 
USING ( auth.uid() = user_id );

CREATE POLICY "Clientes podem criar corridas" 
ON public.ride_requests 
FOR INSERT 
WITH CHECK ( auth.uid() = user_id OR user_id IS NULL );
