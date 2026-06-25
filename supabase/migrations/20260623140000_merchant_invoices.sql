CREATE TABLE IF NOT EXISTS public.merchant_invoices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    reference_month text NOT NULL,
    deliveries_amount numeric DEFAULT 0,
    subscription_amount numeric DEFAULT 0,
    total_amount numeric DEFAULT 0,
    status text DEFAULT 'pending',
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_invoices ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage merchant invoices"
    ON public.merchant_invoices
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Company owners can read their own invoices
CREATE POLICY "Company owners can view their invoices"
    ON public.merchant_invoices
    FOR SELECT
    USING (
        company_id IN (
            SELECT id FROM public.companies WHERE user_id = auth.uid()
        )
    );
