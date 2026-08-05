# Sistema de Créditos do Lojista

O lojista compra créditos com o admin (em reais). Cada solicitação de entrega desconta automaticamente o valor da taxa da região (R$ 8 a R$ 20) do saldo de créditos. Sem saldo, não cria entrega.

## Como funciona

1. **Saldo por loja** — cada empresa tem um saldo em reais. Ex.: R$ 300,00 = 30 entregas de R$ 10 ou qualquer combinação.
2. **Admin adiciona créditos** — somente admin pode creditar. O lojista nunca aumenta o próprio saldo.
3. **Débito automático** — ao criar a solicitação de entrega, o valor da região é debitado na mesma operação. Se o saldo for insuficiente, a entrega não é criada e aparece a mensagem de saldo insuficiente.
4. **Alerta de saldo baixo** — quando o saldo ficar abaixo de R$ 50, aparece um aviso fixo no topo do painel (e no card do Financeiro) pedindo recarga.
5. **Extrato completo** — toda recarga e todo débito ficam registrados com data, valor, saldo resultante e a entrega relacionada.

## O que aparece na tela

**Nova aba "Créditos" na página Financeiro:**
- Card grande com saldo atual, cor de alerta quando abaixo de R$ 50
- Total recarregado no período, total consumido no período, número de entregas pagas com créditos
- Média de custo por entrega e estimativa de quantas entregas ainda cabem no saldo
- Gráfico de consumo diário de créditos
- Extrato paginado: data, tipo (Recarga / Entrega / Estorno), descrição, valor, saldo após
- Botão "Solicitar recarga" que abre um pedido de compra de créditos para o admin analisar

**No layout do painel:**
- Chip com o saldo atual sempre visível no cabeçalho
- Banner de alerta quando saldo < R$ 50

**Na página de nova entrega:**
- Mostra saldo atual e o valor que será debitado ao confirmar
- Bloqueia o envio quando o saldo não cobre a taxa

## Detalhes técnicos

**Banco (migração):**
- `company_credits` — saldo por `company_id` (único), com RLS: lojista lê o próprio, admin lê/gerencia todos.
- `credit_transactions` — ledger imutável: `company_id`, `type` (`topup` | `debit` | `refund` | `adjustment`), `amount`, `balance_after`, `description`, `delivery_id`, `created_by`, `created_at`. RLS: lojista só SELECT dos próprios; INSERT apenas via funções.
- `credit_purchase_requests` — pedidos de recarga do lojista: `company_id`, `amount`, `status` (`pending`/`approved`/`rejected`), `created_at`. Lojista cria e lê os próprios; admin lê/atualiza todos.
- GRANTs explícitos para `authenticated` e `service_role` em todas as tabelas novas.
- `admin_add_credits(_company_id, _amount, _description)` — SECURITY DEFINER, exige role admin, credita e registra no ledger. Também lança entrada em `platform_cash_flow`.
- `create_delivery_with_credits(...)` — SECURITY DEFINER, valida que o usuário é dono da empresa, trava a linha do saldo (`FOR UPDATE`), verifica saldo >= taxa, cria a entrega e debita no mesmo commit; retorna erro `INSUFFICIENT_CREDITS` quando não há saldo.
- Trigger para criar a linha de saldo (zero) quando a empresa é criada; backfill das empresas existentes.
- `EXECUTE` revogado de `anon` em todas as funções novas.

**Frontend:**
- `src/services/credits.ts` — hooks TanStack Query: `useCredits()`, `useCreditTransactions(range)`, `useRequestTopup()`, com realtime em `company_credits` e `credit_transactions` (subscribe em `useEffect` com cleanup).
- `src/routes/business.finance.tsx` — nova aba "Créditos" com os cards, gráfico (Recharts, padrão das outras abas) e extrato; loading, empty e error states.
- `src/components/business/BusinessLayout.tsx` — chip de saldo e banner de alerta abaixo de R$ 50.
- `src/routes/business.delivery-new.tsx` — troca o insert direto em `deliveries` pela chamada de `create_delivery_with_credits`, com toast de saldo insuficiente.

**Fora do escopo deste projeto:** a tela do admin para adicionar créditos fica no painel Admin; aqui entregamos a função de banco `admin_add_credits` que aquele painel vai chamar, além do fluxo de solicitação de recarga.
