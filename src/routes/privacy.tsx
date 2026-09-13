import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, ArrowLeft, Store, Smartphone, UserCheck, Lock } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Política de Privacidade — MT 24 Horas Express Lojista" }] }),
  component: BusinessPrivacyPage,
});

function BusinessPrivacyPage() {
  const navigate = useNavigate();
  
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 pb-20">
      <div className="flex items-start sm:items-center gap-3 bg-card p-6 rounded-3xl border border-border/40 shadow-sm relative">
        <button 
          onClick={() => navigate({ to: '/business' })}
          className="absolute top-4 right-4 sm:static sm:mr-2 p-2 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="pr-10 sm:pr-0">
          <h1 className="font-display text-2xl font-black">Política de Privacidade</h1>
          <p className="text-xs text-muted-foreground mt-0.5">MT 24 Horas Express — Painel do Lojista e Estabelecimentos</p>
        </div>
      </div>
      
      <div className="bg-card p-6 sm:p-8 rounded-3xl border border-border/40 shadow-sm space-y-6 text-sm text-foreground/90 leading-relaxed">
        <section className="space-y-2">
          <div className="flex items-center gap-2 font-bold text-foreground text-base">
            <Store className="w-4 h-4 text-primary" />
            <h2>1. Dados Cadastrais do Estabelecimento</h2>
          </div>
          <p>
            O aplicativo <strong>MT 24 Horas Express Lojista</strong> coleta e armazena dados comerciais como: Razão Social, Nome Fantasia, CNPJ/CPF, endereço comercial de coleta, telefone de contato e catálogo de produtos. Esses dados são utilizados para gerenciar seu perfil comercial e permitir o despacho de pedidos e entregas.
          </p>
        </section>
        
        <section className="space-y-2">
          <div className="flex items-center gap-2 font-bold text-foreground text-base">
            <Smartphone className="w-4 h-4 text-primary" />
            <h2>2. Dados dos Pedidos e Clientes Finais</h2>
          </div>
          <p>
            Ao criar entregas e despachar pedidos, os dados do destinatário (nome, telefone e endereço de entrega) são processados exclusivamente para a execução logística da entrega e compartilhados temporariamente com o entregador responsável para que este possa localizar o endereço e realizar o transporte.
          </p>
        </section>
        
        <section className="space-y-2">
          <div className="flex items-center gap-2 font-bold text-foreground text-base">
            <UserCheck className="w-4 h-4 text-primary" />
            <h2>3. Notificações e Identificadores de Dispositivo</h2>
          </div>
          <p>
            Utilizamos o token de notificações push (FCM) e identificadores de dispositivo com o único propósito de alertar sobre novos pedidos recebidos, status de corridas e atualizações financeiras do seu estabelecimento.
          </p>
        </section>
        
        <section className="space-y-2">
          <div className="flex items-center gap-2 font-bold text-foreground text-base">
            <Lock className="w-4 h-4 text-primary" />
            <h2>4. Segurança e Não Compartilhamento</h2>
          </div>
          <p>
            Suas informações fiscais, bancárias e dados de faturamento são armazenados sob criptografia de ponta e nunca são comercializados com terceiros. Você pode solicitar a correção ou exclusão dos seus dados a qualquer momento entrando em contato com o suporte oficial do MT 24 Horas Express.
          </p>
        </section>
      </div>
    </div>
  );
}
