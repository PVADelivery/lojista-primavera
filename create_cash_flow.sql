-- Cria a tabela company_cash_flow para lançamentos manuais do lojista
CREATE TABLE IF NOT EXISTS public.company_cash_flow (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Configura as políticas de RLS (Row Level Security)
ALTER TABLE public.company_cash_flow ENABLE ROW LEVEL SECURITY;

-- Política de Leitura: Usuários da empresa ou admins podem ler
CREATE POLICY "Users can view their company cash flows"
    ON public.company_cash_flow
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = company_cash_flow.company_id
            AND c.user_id = auth.uid()
        )
        OR public.has_role('admin'::public.app_role, auth.uid())
    );

-- Política de Inserção: Usuários podem inserir para sua empresa
CREATE POLICY "Users can insert cash flows for their company"
    ON public.company_cash_flow
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = company_cash_flow.company_id
            AND c.user_id = auth.uid()
        )
        OR public.has_role('admin'::public.app_role, auth.uid())
    );

-- Política de Exclusão: Usuários podem excluir de sua empresa
CREATE POLICY "Users can delete cash flows of their company"
    ON public.company_cash_flow
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = company_cash_flow.company_id
            AND c.user_id = auth.uid()
        )
        OR public.has_role('admin'::public.app_role, auth.uid())
    );

-- Política de Atualização: Usuários podem atualizar de sua empresa
CREATE POLICY "Users can update cash flows of their company"
    ON public.company_cash_flow
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = company_cash_flow.company_id
            AND c.user_id = auth.uid()
        )
        OR public.has_role('admin'::public.app_role, auth.uid())
    );
