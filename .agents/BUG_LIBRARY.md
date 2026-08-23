# 📚 BIBLIOTECA DE BUGS E CORREÇÕES

Este documento registra os bugs encontrados no sistema, suas causas raízes e as soluções definitivas testadas para consulta contínua do agente AI.

---

### 1. Divergência de Cadastro de Entregadores (`delivery_drivers` vs `profiles` / `user_roles`)
* **Sintoma**: Entregadores reais cadastrados sumiam do Painel Admin, ou apareciam perfis fictícios de teste (`Driver Four`, `Driver Five`).
* **Causa Raiz**: Usuários cadastrados via convite ou auth geram linhas em `profiles` e `user_roles`, mas podem não ter registro imediato na tabela `delivery_drivers`.
  - Se a busca for restrita apenas a `delivery_drivers`, entregadores sem linha nessa tabela somem.
  - Se a busca for genérica por `profiles`/`user_roles`, perfis demo/teste antigos aparecem na frota.
* **Solução Padrão**:
  1. Fazer busca combinada em `delivery_drivers`, `profiles` e `user_roles`.
  2. Filtrar perfis demo fictícios usando a regex `^driver\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)`.
  3. Mapear tanto `user_id` quanto `id` para evitar inconsistência nos dados de perfil.

---

### 2. Ocultação de Entregadores por Filtro de Abas no Frontend (`drivers.tsx`)
* **Sintoma**: Ao trocar de aba no painel (ex: Moto, Carro, Táxi), entregadores reais sumiam da tabela.
* **Causa Raiz**: O filtro de abas em `drivers.tsx` fazia verificação rígida do array `service_types` (`services.length === 0`), impedindo a correspondência quando um veículo era moto mas possuía outro tipo de serviço registrado.
* **Solução Padrão**:
  Flexibilizar as expressões condicionais no filtro para checar `services.includes(...) || d.vehicle_type === ... || !d.vehicle_type`.

---

### 3. Falha de Execução de Comandos Git Encadeados (`&&` no PowerShell)
* **Sintoma**: Erro `O token '&&' não é um separador de instruções válido nesta versão`.
* **Causa Raiz**: O terminal do ambiente (Windows PowerShell) não aceita o operador `&&`.
* **Solução Padrão**:
  Sempre utilizar o caractere de ponto e vírgula `;` para encadear comandos no PowerShell: `git add .; git commit -m "..."; git push`.

---

### 4. Desincronização de Serviços entre Repositórios
* **Sintoma**: Ajuste feito em um app (ex: `painel-primavera`) não refletia nos demais apps (`lojista-primavera-1` e `entrega-primavera`).
* **Causa Raiz**: As funções de serviço como `fetchDrivers()` existem duplicadas em cada repositório da suíte.
* **Solução Padrão**:
  Sempre replicar correções de serviços e modelos em todos os 3 repositórios ativos do workspace (`painel-primavera`, `lojista-primavera-1` e `entrega-primavera`) e executar o `git commit` e `git push` em todos eles.

---

### 5. Nenhuma Loja Encontrada (0 Lojas no Marketplace / App do Cliente)
* **Sintoma**: A página inicial do cliente exibe "0 lojas / Nenhuma loja encontrada" mesmo havendo empresas cadastradas no sistema.
* **Causa Raiz**: 
  1. A propriedade `is_open` na tabela `companies` podia estar `NULL` ou `false` no banco de dados. Ao ativar a opção "Aberto agora" (`openOnly`), a filtragem estrita `s.is_open === true` descartava todas as empresas.
  2. Possível restrição de RLS ou permissões na tabela `companies` impedindo a leitura por usuários anônimos/clientes.
* **Solução Padrão**:
  1. No frontend (`marketplace.index.tsx`), tratar `is_open` nulo/indefinido com fallback permissivo (`s.is_open ?? true`) e ignorar empresas apenas se `is_active === false`.
  2. Fornecer botão de atalho para resetar filtros ("Ver todas as lojas") caso a busca filtrada resulte em zero empresas.
  3. Garantir a liberação de RLS na tabela `companies` via SQL migration (`ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY; GRANT ALL ON public.companies TO authenticated, anon, public;`).

---

### 6. Ausência de Abas Laterais e Navegação por Seções em Configurações
* **Sintoma**: A tela de Configurações (Editor de Perfil) exibe todas as opções em uma lista longa contínua sem menu lateral de abas para alternar entre as seções.
* **Causa Raiz**: O componente `business.settings.tsx` não contava com navegação por abas nem com menu lateral para alternar rapidamente entre seções.
* **Solução Padrão**:
  1. Implementar a barra de navegação de sub-abas horizontal (`Sub-Abas de Navegação de Configurações`) no topo da página.
  2. Adicionar o menu fixo lateral de navegação por abas (`Abas de Configuração`) na coluna lateral para alternar instantaneamente entre Perfil & Negócio, Horários de Funcionamento, Contato & Localização, Taxas de Entrega, Galeria de Fotos e Zona de Perigo.

---

### 7. Erro de Carregamento da Página `/business/settings` em Produção ("This page didn't load")
* **Sintoma**: Ao acessar `https://lojista.mt24horasexpress.com/business/settings`, a página exibe "This page didn't load / Something went wrong on our end".
* **Causa Raiz**: O componente importava a biblioteca `maplibre-gl` de forma estática no topo do arquivo (`import * as maplibregl from "maplibre-gl"`). Durante o render no servidor (SSR do TanStack Start/Cloudflare Workers), a biblioteca tentava acessar objetos de navegador como `window` ou `document`, disparando `ReferenceError` e quebrando o SSR da rota.
* **Solução Padrão**:
  1. Remover a importação estática de `maplibre-gl` no topo do arquivo.
  2. Carregar o `maplibre-gl` dinamicamente com `import("maplibre-gl")` dentro do hook `useEffect` e checar `typeof window !== "undefined"`.

---

### 8. Erro de Carregamento em Produção por Arquivos `.bak` em `src/routes` e Directivas `"use client"`
* **Sintoma**: Ao acessar `https://www.mt24horasexpress.com/marketplace/rides`, a página exibe "This page didn't load / Something went wrong on our end".
* **Causa Raiz**:
  1. Presença de arquivo de backup `marketplace.rides.tsx.bak` dentro do diretório `src/routes`, gerando conflitos no gerador de rotas do TanStack Router.
  2. Uso de diretivas `"use client";` estáticas no topo do arquivo de rota e imports estáticos de bibliotecas de mapa como `maplibre-gl` em componentes renderizados via SSR no Cloudflare.
* **Solução Padrão**:
  1. Remover quaisquer arquivos com extensão `.bak` do diretório `src/routes/`.
  2. Remover a diretiva `"use client";` de topo das rotas do TanStack Router.
  3. Garantir que todas as páginas e componentes contendo `maplibre-gl` utilizem imports dinâmicos (`import("maplibre-gl")`) condicionados ao ambiente cliente (`typeof window !== "undefined"` ou estado `mounted`).

---

### 9. Erro de SSR "This page didn't load" causado por Acesso Direto ao `localStorage`
* **Sintoma**: Ao acessar páginas como `/marketplace/profile`, `/marketplace/checkout`, `/marketplace/addresses` ou `/business/map`, o Cloudflare exibe a tela de erro "This page didn't load / Something went wrong on our end".
* **Causa Raiz**: O React/TanStack Start executa o render inicial no servidor (SSR). O acesso direto a `localStorage.getItem(...)` ou `localStorage.setItem(...)` no escopo inicial do componente ou do `useState` dispara `ReferenceError: localStorage is not defined`, abortando a renderização no servidor.
* **Solução Padrão**:
  Sempre envolver o acesso a `localStorage` com a verificação `typeof window !== "undefined"`:
  ```tsx
  const [theme, setTheme] = useState(() => (typeof window !== "undefined" ? localStorage.getItem('theme') || 'light' : 'light'));
  ```

---

### 10. Redirecionamento Precoce durante SSR disparando Erro no TanStack Router em `/marketplace/rides`
* **Sintoma**: Ao acessar `https://www.mt24horasexpress.com/marketplace/rides`, a página exibe erro "This page didn't load / Something went wrong on our end".
* **Causa Raiz**: O componente `RidesPage` chamava `navigate({ to: "/login" })` diretamente dentro do `useEffect` se `!user` estivesse verdadeiro no render inicial. Durante o SSR no Cloudflare, o estado do usuário começa nulo (`null`), forçando um erro de redirecionamento prematuro no servidor.
* **Solução Padrão**: Envolver a rota com a guarda `<RequireAuth>`, que trata adequadamente o estado de carregamento (`loading`) antes de redirecionar o cliente de forma segura no navegador.

---

### 11. Erro de Renderização "Minified React error #310" em Rotas com Trava de Montagem Cliente (`if (!mounted)`)
* **Sintoma**: Ao acessar páginas como `/marketplace/rides`, `/marketplace/taxi` ou `/marketplace/errands`, a aplicação falha com "This page didn't load / Minified React error #310".
* **Causa Raiz**: O componente continha uma instrução de retorno condicional `if (!mounted) return <Skeleton />` posicionada no meio do componente, ANTES de outras chamadas de `useEffect`, `useState` ou `useRef`. No primeiro render (SSR/Mount), a trava retornava precocemente e pulava os hooks inferiores. No render seguinte (quando `mounted` tornava-se `true`), os hooks inferiores eram executados, alterando a quantidade de hooks chamados entre renders e violando as Regras de Hooks do React ("Rendered more hooks than during the previous render").
* **Solução Padrão**:
  Declarar 100% dos hooks (`useState`, `useRef`, `useEffect`) incondicionalmente no topo da função do componente, posicionando o retorno condicional de montagem cliente `if (!mounted) return <Skeleton />` APÓS a declaração de todos os hooks.

---

### 12. Erro de Construtor ES6 "Class constructor Ua cannot be invoked without 'new'" ao carregar MapLibre via CDN Script
* **Sintoma**: Ao carregar páginas com mapa (como `/marketplace/rides`, `/marketplace/taxi`), o app falha com "This page didn't load / Class constructor Ua cannot be invoked without 'new'".
* **Causa Raiz**: O componente injetava um script global via `<script src="https://unpkg.com/maplibre-gl...">`. Em ambientes empacotados com Vite em modo de produção (ES modules), chamar `new MapLibre.Map(...)` ou `new MapLibre.Marker(...)` a partir da variável injetada no escopo global `window.maplibregl` fazia a classe ser invocada através de um wrapper transpilado sem o operador `new` nativo do ES6.
* **Solução Padrão**:
  Substituir a injeção manual de tags `<script>` CDN pela importação dinâmica de ES module nativa do bundler:
  1. Importar o CSS estaticamente: `import "maplibre-gl/dist/maplibre-gl.css";`
  2. Carregar o módulo dinamicamente dentro do `useEffect`:
     ```tsx
     useEffect(() => {

---

### 13. Erro 400 em Consulta Supabase por Sintaxe Inválida de `id.in.(...)` dentro de String `.or(...)`
* **Sintoma**: A página `/marketplace/rides` exibia "Você ainda não solicitou nenhuma corrida." mesmo após solicitar corrida e salvar o ID no dispositivo.
* **Causa Raiz**: O uso da string `.or("user_id.eq.XXX,id.in.(AAA,BBB)")` no Supabase JS. O manipulador PostgREST não suporta parênteses aninhados da cláusula `in.(...)` dentro de uma expressão lógica `.or()`, disparando um erro HTTP 400 (Bad Request) que abortava a execução da consulta e limpava o resultado.
* **Solução Padrão**:
  Executar consultas independentes e limpas em paralelo via `Promise.all([queryUser, querySavedIds, queryEmail])` e mesclar/deduplicar os resultados por `id` no frontend:
  ```tsx























---

### 36. Mapa em Branco (Retângulo Vazio) no Aplicativo do Entregador (`driver.deliveries.tsx`)
* **Sintoma**: O mapa de acompanhamento da corrida no aplicativo do entregador renderizava apenas como uma caixa branca.
* **Causa Raiz**: Ausência de importação do arquivo CSS do MapLibre (`import "maplibre-gl/dist/maplibre-gl.css"`) e bloqueio/falha de carregamento de estilos de vetor externos.
* **Solução Padrão**:
  Adicionar a importação do CSS no topo do arquivo e substituir a URL de estilo vetorial por uma definição de camada raster do OpenStreetMap direta:
  ```json
  style: {
    version: 8,
    sources: {
      "osm-tiles": {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
      },
    },
    layers: [{ id: "osm-layer", type: "raster", source: "osm-tiles" }],
   ```

---

### 14. Ganhos do Entregador Sempre R$ 0,00 — Erro Postgres 42703 (Coluna Inexistente)
* **Sintoma**: Na tela Início e Perfil Financeiro do app do entregador, os ganhos exibiam R$ 0,00 mesmo com entregas concluídas no banco. O console do navegador mostrava `DELIVERIES: null` e `DELIVERIES ERROR: {code: '42703', message: 'column deliveries.delivery_fee does not exist'}` (e também `delivered_at`).
* **Causa Raiz**: A função `fetchEarnings` em `deliveries.ts` e a consulta financeira em `driver.profile.tsx` referenciavam colunas `delivery_fee` e `delivered_at` no `.select()`, que **não existem** na tabela `deliveries` do Postgres. O PostgREST rejeitava a query inteira com HTTP 400, retornando `null` em vez dos dados.
* **Solução Padrão**:
  1. Usar apenas colunas que existem no banco: `.select("value, commission, completed_at, created_at")`.
  2. Remover fallbacks de data para colunas inexistentes (`r.delivered_at`).
  3. Calcular a taxa do entregador usando `Number(r.value || 0)` diretamente.
  4. **Regra**: Antes de referenciar uma coluna no `.select()`, confirmar que ela existe na tabela do Supabase.

---

### 15. Desincronização de Nomes, Bairros e Preços das Regiões do Admin no Painel Lojista e App do Entregador
* **Sintoma**: O Admin editava nomes, valores e adicionava bairros nas regiões (`/admin/regions`), mas no painel do lojista (ao criar entrega) e no app do entregador continuavam aparecendo os nomes antigos e valores estáticos (`Região 1 (R$ 8,00)`, `CENTRO - PVA 1 / JD RIVA 1/2/3/4 (R$ 10,00)`).
* **Causa Raiz**:
  1. O componente `RegionZoneSelector.tsx` no painel do lojista continha um array constante estático (`DELIVERY_ZONES`) e nunca consultava as tabelas `regions` e `region_neighborhoods` do Supabase.
  2. Passava `regionId: "none"` fixo ao selecionar a região, impedindo que a entrega fosse associada à região real no banco.
  3. As consultas do app do entregador não incluíam a relação `regions(id, name, price)`.
* **Solução Padrão**:
  1. Refatorar `RegionZoneSelector.tsx` para carregar `regions` e `region_neighborhoods` dinamicamente do Supabase, ordenadas por `sort_order` e `price`, com suporte a canais Realtime para sincronização instantânea com as edições do Admin.
  2. Associar o `region_id` real da região selecionada à tabela `deliveries`.
  3. Incluir `regions(id, name, price)` nas consultas de entregas do app do entregador e exibir as tags de Região e Bairro no `DeliveryCard.tsx`.

---

### 16. Robô do Telegram Não Reportando Erros de Tela e Falha 401 Unauthorized
* **Sintoma**: Erros exibidos na tela dos usuários (toasts, falhas de sistema, exceções não tratadas) não eram enviados para o canal/grupo do Telegram pelo bot.
* **Causa Raiz**:
  1. A Edge Function `telegram-logger` exigia autenticação de usuário obrigatória (`Bearer` token com usuário logado válido), retornando `401 Unauthorized` e abortando o envio quando erros ocorriam com visitantes, usuários na tela de login, clientes deslogados ou quando a sessão expirava.
  2. Os erros visuais exibidos via `toast.error(...)` (da biblioteca `sonner`) não estavam integrados ao serviço de telemetria `logger.ts`.
  3. Os apps `entrega-primavera` e `cliente-primavera` não chamavam `initializeGlobalErrorHandlers` em seus componentes raiz.
* **Solução Padrão**:
  1. Atualizar a Edge Function `telegram-logger` para aceitar erros tanto autenticados quanto anônimos/públicos, usando formatação HTML segura (`parse_mode: "HTML"`) para evitar falhas de Markdown no Telegram.
  2. Implementar interceptador automático de `toast.error(...)` e cache de deduplicação (15s) no `logger.ts` com fallback direto para a API do Telegram (`https://api.telegram.org/bot.../sendMessage`) caso a Edge function falhe.
  3. Inicializar `initializeGlobalErrorHandlers` no `__root.tsx` de todos os 4 repositórios da suíte (`painel-primavera`, `lojista-primavera-1`, `entrega-primavera`, `cliente-primavera`).

---

### 17. Erro HTTP 400 Bad Request ao Buscar Pedidos Ativos no Marketplace (`order_status` Inválido)
* **Sintoma**: Ao carregar o marketplace do cliente, requisições para `rest/v1/orders?select=id&user_id=eq...&status=in.(pending,accepted,preparing,ready,out_for_delivery)` falhavam com HTTP 400 (Bad Request).
* **Causa Raiz**: A coluna `orders.status` no Postgres é do tipo ENUM `order_status` com os valores válidos: `pending`, `preparing`, `ready`, `in_route`, `delivered`, `cancelled`. As strings `'accepted'` e `'out_for_delivery'` não existem no enum Postgres, fazendo o banco rejeitar o filtro `status.in.(...)` com erro 400.
* **Solução Padrão**:
  1. Utilizar apenas valores válidos do enum do Postgres no filtro de pedidos ativos: `.in("status", ["pending", "preparing", "ready", "in_route"])`.
  2. Mapear `"in_route"` nas rotas de listagem e detalhes do pedido (`marketplace.orders.tsx` e `marketplace.orders.$orderId.tsx`).

---

### 23. Bloqueio de Lojas no Marketplace por RLS Policy Restritiva na Tabela `companies`
* **Sintoma**: As lojas sumiam do Marketplace do Cliente (`cliente.mt24horasexpress.com`) com retorno de lista vazia (`0 lojas / Nenhuma loja encontrada`).
* **Causa Raiz**: A tabela `companies` no Supabase estava com Row Level Security (RLS) habilitada sem conceder `SELECT` ao role `anon` (usuários não autenticados que navegam no marketplace).
* **Solução Padrão**:
  Garantir concessão de leitura pública para usuários anônimos e autenticados no Supabase:
  ```sql
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  GRANT SELECT ON public.companies TO anon, authenticated;

  ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "companies_public_read" ON public.companies;
  CREATE POLICY "companies_public_read"
  ON public.companies
  FOR SELECT
  TO anon, authenticated
  USING (is_active IS DISTINCT FROM false);
  ```

---

### 24. Falha ao Atualizar Status de Entregas no App do Entregador ("Falha ao atualizar")
* **Sintoma**: Ao clicar em *"Cheguei na loja"*, *"Coletado, indo entregar"* ou *"Concluir entrega"*, o app exibia o toast de erro *"Falha ao atualizar"*.
* **Causa Raiz**:
  1. A procedure RPC `update_delivery_status_safe` possui parâmetros nomeados `p_delivery_id` e `p_status` em algumas versões da migration e `_delivery_id` e `_status` em outras.
  2. Atualizações diretas via REST no Supabase falhavam por divergência de nomes de colunas de timestamp (`completed_at` vs `delivered_at`) ou pelo retorno restrito por políticas RLS na cláusula `.select()`.
* **Solução Padrão**:
  1. Implementar chamada RPC dual-signature (`p_delivery_id` / `p_status` e fallback para `_delivery_id` / `_status`).
  2. Implementar fallback REST com as 4 combinações de schema (`status` + `completed_at`, `status` + `delivered_at`, status textual direto e update sem retorno `.select()`).

---

### 25. "LocalNotifications plugin is not implemented on android" no App do Entregador
* **Sintoma**: Logs de erro de `Unhandled Rejection` acusando ausência do plugin `LocalNotifications` no Android.
* **Causa Raiz**: Chamadas a `LocalNotifications.cancel(...)` e `LocalNotifications.addListener(...)` eram executadas sem a verificação `Capacitor.isPluginAvailable("LocalNotifications")`.
* **Solução Padrão**:
  Envolver todas as chamadas de notificações locais em blocos condicionais com `Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")` e `try/catch`.

---

### 26. Minified React Error #520 e Incompatibilidade de Hidratação de Tema na Tela de Login
* **Sintoma**: Erro #520 no React ao renderizar o botão `ThemeToggle` ou acessar a tela `/login`.
* **Causa Raiz**: O `ThemeProvider` iniciava com estado fixo `"light"` durante o render do servidor e alterava para `"dark"` de forma assíncrona após a montagem do `useEffect`, quebrando a hidratação do React.
* **Solução Padrão**:
  Inicializar o estado do `useState` de forma síncrona com `typeof window !== "undefined"` e leitura imediata do `localStorage` / `matchMedia`.

---

### 28. Tabelas de Preços Personalizadas por Loja Não Aplicadas ao Criar Entrega
* **Sintoma**: O Admin vinculava uma loja (ex: `AÇAI PRIMAVERA`, `Prime Farma`, `Drogaria Nacional 2`) a uma Tabela de Preços Personalizada em `/admin/pricing`, mas ao criar entregas no painel da loja continuavam aparecendo os valores padrão de cada região.
* **Causa Raiz**:
  1. O componente `RegionZoneSelector.tsx` não consultava `pricing_table_id` da empresa e não buscava as regras personalizadas na tabela `pricing_rules` do Supabase.
  2. Políticas de RLS restritivas na tabela `pricing_rules` e `pricing_tables` bloqueavam a leitura dos dados por usuários autenticados da loja.
  3. No `RegionPickerGrid.tsx`, a filtragem de regras buscava campos incorretos (`r.region_id` e `r.price` em vez de `r.origin_region_id` e `r.base_value`).
* **Solução Padrão**:
  1. Atualizar o `RegionZoneSelector.tsx` para buscar a `pricing_table_id` da empresa e carregar os preços personalizados de `pricing_rules`.
  2. Corrigir os campos de filtragem em `RegionPickerGrid.tsx` (`r.origin_region_id === region.id` e `r.base_value`).
  3. Aplicar migration SQL com política RLS permissiva para leitura de `pricing_tables` e `pricing_rules` (`CREATE POLICY "pricing_rules_public_read" ON public.pricing_rules FOR SELECT TO anon, authenticated, public USING (true);`).
---

### 29. Ausência do Botão/Modal de Criação de Entregas em Lote no Painel Lojista
* **Sintoma**: O lojista não visualizava o botão "Criar entregas em lote" na tela de Nova Solicitação de Entrega (`/business/delivery-new`), sendo forçado a cadastrar uma entrega de cada vez.
* **Causa Raiz**: O componente `BatchDeliveryModal.tsx` e a chamada à RPC PostgreSQL `batch_create_delivery_requests` não estavam integrados à rota do painel do lojista.
* **Solução Padrão**:
  1. Criar a RPC PostgreSQL `batch_create_delivery_requests` que valida a empresa, calcula o valor total do lote, checa o saldo de créditos e executa a inserção atômica de cada entrega individual em `deliveries` juntamente com seu débito sequencial em `credit_transactions`.
  2. Implementar o componente `BatchDeliveryModal.tsx` com formulários independentes para cada entrega (iniciando em 3 por padrão, com suporte a adicionar/remover), seletor de regiões com cálculo automático de taxa por item e resumo financeiro do lote.
---

### 30. Erro de Execução em Produção `ReferenceError: BatchDeliveryModal is not defined`
* **Sintoma**: Ao acessar a página `/business/delivery-new` no painel do lojista, a tela exibia "This page didn't load / ReferenceError: BatchDeliveryModal is not defined".
* **Causa Raiz**: O componente `<BatchDeliveryModal />` foi inserido no corpo JSX da rota `business.delivery-new.tsx` sem incluir a declaração `import { BatchDeliveryModal } from "@/components/business/BatchDeliveryModal";` no topo do arquivo.
---

### 31. Erro Supabase Realtime `cannot add postgres_changes callbacks after subscribe()`
* **Sintoma**: Ao abrir o modal de entregas em lote com múltiplos seletores de região na mesma tela, a aplicação quebrava com "This page didn't load / Error: cannot add `postgres_changes` callbacks for realtime:realtime-regions-selector after `subscribe()`".
* **Causa Raiz**: O componente `RegionZoneSelector.tsx` utilizava um nome estático fixo para o canal Supabase (`"realtime-regions-selector"`). Quando múltiplos componentes eram renderizados na mesma página (ou no remounting do React), chamadas subsequentes a `supabase.channel("realtime-regions-selector")` retornavam a mesma instância de canal já inscrita, fazendo o método `.on(...)` falhar por ser invocado após o `.subscribe()`.
* **Solução Padrão**:
---

### 32. Migração de Entregas em Lote de Modal para Formulário Direto na Tela com Contador de Entregas
* **Sintoma**: O lojista solicitou a remoção do modal popup de entregas em lote, exigindo que a criação de múltiplas entregas ocorra diretamente na tela principal (`/business/delivery-new`) no modelo Rápido (somente Nome, Telefone e Região) utilizando um contador de entregas.
* **Causa Raiz**: O uso de modal separado poluia a navegação e tornava a criação de entregas em lote menos ágil do que um contador direto na página principal.
* **Solução Padrão**:
  1. Remover o `BatchDeliveryModal` e integrar o estado `batchCount` diretamente em `business.delivery-new.tsx`.
  2. Adicionar o componente **Contador de Entregas** (`[-] N entregas [+]` com atalhos `1`, `3`, `5`, `10`, `15`) no topo da tela no modo Entregas Rápidas.
  3. Quando `batchCount > 1`, renderizar os formulários simplificados por entrega (Nome do Cliente, WhatsApp/Telefone e `RegionZoneSelector`).
---

### 33. Ocultamento de Regiões com Seta Retrátil (Accordion) e Expansão ao Clicar na Região
* **Sintoma**: As 15 regiões do seletor ficavam todas visíveis e abertas por padrão, deixando a tela de cadastro de entrega excessivamente longa.
* **Causa Raiz**: O componente `RegionZoneSelector.tsx` renderizava o grid completo das 15 regiões sem um botão retrátil de agrupamento.
* **Solução Padrão**:
  1. Adicionar o estado `isListOpen` (fechado por padrão ou com resumo) e o botão retrátil `📍 Clique na seta para escolher a Região [Ver Regiões ⬇️ / Ocultar Regiões ⬆️]`.
  2. Ao clicar na seta, a lista com as 15 regiões expande com animação.
---

### 34. Busca e Autocomplete de Clientes Cadastrados em Entregas Individuais e em Lote
* **Sintoma**: Ao digitar o Nome do Cliente ou Telefone durante o cadastro de entregas em lote, o sistema não exibia as sugestões de clientes salvos no banco de dados para preenchimento automático.
* **Causa Raiz**: Os campos de input dos itens em lote não acionavam a busca consolidada `customerQuery` nem renderizavam o dropdown flutuante de sugestões `customerSuggestions`.
* **Solução Padrão**:
  1. Conectar os manipuladores `onChange` e `onFocus` de cada item em lote para atualizar `customerQuery`, `activeBatchSearchIdx` e exibir `showSuggestions`.
---

### 35. Erro no Banco de Dados `column "price" of relation "deliveries" does not exist`
* **Sintoma**: Ao submeter a criação de entregas em lote, o Supabase retornava o erro `column "price" of relation "deliveries" does not exist`.
* **Causa Raiz**: O comando `INSERT INTO public.deliveries (...)` na função PostgreSQL `batch_create_delivery_requests` incluía explicitamente a coluna `price`, que não existe na estrutura da tabela `deliveries` (o campo correto é `value`).
* **Solução Padrão**:
---

### 36. Agrupamento de Entregas em Lote com Card Único de Aceite no App do Entregador
* **Sintoma**: Múltiplas entregas enviadas em lote pelo lojista ficavam soltas na lista do entregador, podendo ser aceitas por entregadores diferentes.
* **Causa Raiz**: Não havia um identificador único de lote (`batch_id`) vinculando as entregas criadas simultaneamente nem um componente visual agregador no App do Entregador.
* **Solução Padrão**:
  1. Adicionar coluna `batch_id UUID` na tabela `deliveries` e atualizar a RPC `batch_create_delivery_requests` para atribuir o mesmo `batch_id` para todas as entregas criadas juntas.
  2. Implementar a RPC `accept_delivery_batch(p_batch_id, p_driver_id)` para transicionar todas as entregas do lote juntas para `accepted`.
  3. Criar o componente `BatchDeliveryCard.tsx` no App do Entregador (`entrega-primavera`), exibindo o badge em destaque (`📦 LOTE COM N ENTREGAS`), soma dos valores, destinos numerados e o botão de aceite único.

---

### 37. Disparo Imediato de Notificações e Sons ao Criar Entrega Bypassando a Janela Admin de 2 Minutos
* **Sintoma**: Ao cadastrar uma entrega no painel do lojista, os entregadores recebiam notificação push, toque de ronco de motor e alerta visual na mesma hora, porém a entrega só aparecia na lista para aceitar 2 minutos depois.
* **Causa Raiz**:
  1. A função `notifyNewDelivery` no hook `useDriverNotifications.ts` do app do entregador (`entrega-primavera`) disparava áudio e notificações sem verificar se a entrega estava no período de carência de 2 minutos do Admin (`getElapsedSeconds(created_at) < 120`).
  2. As Edge Functions `send-push` e `notify-driver` disparavam mensagens push FCM aos entregadores imediatamente no evento `INSERT` de entregas pendentes sem `driver_id`.
  3. O trigger PostgreSQL `trigger_send_push_on_delivery` bloqueava eventos `UPDATE` quando o Admin atribuía um entregador diretamente.
* **Solução Padrão**:
  1. No hook `useDriverNotifications.ts`, verificar `getElapsedSeconds(created_at) < 120` para entregas pendentes e sem `driver_id`, ignorando notificações e sons até a entrega completar 2 minutos ou ser transmitida/atribuída.
  2. Nas Edge Functions `send-push` e `notify-driver`, adicionar validação de carência de 120 segundos para ignorar push FCM geral em entregas com menos de 2 minutos.
  3. Atualizar o trigger SQL `trigger_send_push_on_delivery` para permitir disparo de push em eventos `UPDATE` quando `driver_id` for preenchido pelo Admin ou status for alterado para `broadcasted`.

---

### 38. Lentidão Excessiva e Gargalo de CPU/Rede no Aplicativo do Entregador (`entrega-primavera`)
* **Sintoma**: O aplicativo do entregador apresentava extrema lentidão, travamentos e requisições excessivas em segundo plano.
* **Causa Raiz**:
  1. A função `pollDeliveries` no hook `useDriverNotifications.ts` rodava a cada **3 segundos** e efetuava uma consulta Supabase individual extra (`N+1 queries`) para CADA entrega na lista via `.eq("id", rawDelivery.id).single()`, bombardeando a API com dezenas de requisições por minuto.
  2. Múltiplos seletores de interval (`checkTimer` a 5s em `NewDeliveryPopupModal`, `refetchInterval` a 5s em `driver.index.tsx` e `pollDeliveries` a 3s) rodavam concorrentemente disputando recursos e travando a thread principal.
  3. O `triggerOffer` em `NewDeliveryPopupModal.tsx` fazia 2 requisições adicionais incondicionais à tabela `companies` em todo alerta de entrega.
* **Solução Padrão**:
  1. Eliminar a consulta `N+1` em `useDriverNotifications.ts`, reaproveitando os dados já carregados pelo payload/realtime (`rawDelivery.companies`).
  2. Ajustar os intervalos de polling para valores leves (10s a 15s) e confiar na sincronização em tempo real nativa do Supabase Realtime (`deliveries-home`).
  3. Reutilizar o nome e endereço da empresa já inclusos no objeto da entrega no `NewDeliveryPopupModal.tsx`, evitando chamadas desnecessárias à API.

---

### 39. Entregas Ocultas no App do Entregador por Erro de Parsing de Timezone em `getElapsedSeconds`
* **Sintoma**: Entregas criadas recentemente ficavam invisíveis no app do entregador ("Sem entregas no momento"), mesmo após transcorridos os 2 minutos do Admin.
* **Causa Raiz**:
  A função `getElapsedSeconds` em `time.ts` manipulava strings ISO (`str.replace(" ", "T") + "Z"`) concatenando `"Z"` incondicionalmente. Em datas ISO retornadas do Supabase contendo `+00:00`, a concatenação gerava datas inválidas (`NaN`) ou distorções de 4 horas no futuro. O cálculo de tempo decorrido resultava em valores negativos/inválidos, fazendo o filtro `elapsedSeconds >= 120` rejeitar as entregas disponíveis.
* **Solução Padrão**:
  Refatorar `getElapsedSeconds` para tentar o parse nativo direto via `new Date(str).getTime()` e fallback com substituição limpa de espaço. Se `elapsedMs < 0` por pequenas variações de relógio, retornar `0`, e se for `NaN`, retornar `999999` para garantir que a entrega seja exibida normalmente.

---

### 40. Entregas Pendentes Não Listadas por Divergência de Formato de `driver_id` ou Falha de Join PostgREST
* **Sintoma**: Entregas em aberto criadas no painel do lojista (ex: "Jose teste banco") não apareciam em "Entregas disponíveis" do app do entregador mesmo após decorridos os 2 minutos.
* **Causa Raiz**:
  1. O filtro `.is("driver_id", null)` na consulta PostgREST exigia `driver_id` estritamente nulo. Se a entrega fosse gravada com `driver_id` vazio `""` ou `"none"`, a cláusula de busca excluía o registro.
  2. A cláusula `.select("*, companies(...), regions(...)")` descartava entregas caso houvesse falha de permissão RLS ou junção de tabela em `regions` ou `companies`.
* **Solução Padrão**:
  Flexibilizar `fetchAvailableDeliveries` para carregar `deliveries` sem obrigatoriedade de joins e filtrar em memória se `driver_id` está ausente, vazio (`""`), `"none"` ou nulo, incluindo fallbacks de busca e suporte a múltiplos status equivalentes a em aberto (`pending`, `broadcasted`, `pending_assignment`, `open`, `created`, `em_aberto`).

---

### 41. Contador da Barra de Navegação Inferior Desatualizado para a Aba "Corridas"
* **Sintoma**: O selo/contador (badge) na barra de navegação inferior não exibia a quantidade de corridas ativas na aba "Corridas", mantendo o contador zerado mesmo com uma corrida recém-solicitada.
* **Causa Raiz**:
  A consulta em `MarketplaceLayout.tsx` filtrava exclusivamente por `user_id = user.id` via Supabase. Caso o cliente criasse uma corrida sem estar logado ou se os IDs fossem gravados localmente em `localStorage` (`pva_my_ride_ids` / `pva_local_rides`), a contagem ignorava os registros ativos.
* **Solução Padrão**:
  Atualizar o cálculo do contador em `MarketplaceLayout.tsx` para combinar consultas por `user_id` e IDs armazenados em `localStorage`, além de registrar um ouvinte de evento `pva_ride_updated` para atualização instantânea em tempo real do badge.

---

### 42. Duplicidade de Cards de Corridas e Exibição de R$ 0,00 na Tela de Corridas
* **Sintoma**: A tela "Suas Corridas" (`marketplace.rides.tsx`) exibia múltiplos cards repetidos da mesma corrida ativa e o valor da corrida ficava fixo em `R$ 0,00`.
* **Causa Raiz**:
  1. A listagem "Corridas Ativas" na parte inferior não filtrava o ID da corrida ativa em destaque (`activeRide.id`), renderizando a mesma corrida no topo (Hero Card com mapa) e repetida abaixo.
  2. O formulário de solicitação de corrida (`marketplace.taxi.tsx`) não incluía o campo `price` no payload enviado para o banco, resultando em `price = null` / `0` na tabela `ride_requests`.
* **Solução Padrão**:
  1. Incluir `price` calculado no payload de inserção de `marketplace.taxi.tsx` e adicionar fallbacks de valor (`price || estimated_value || value || (taxi ? 15.0 : 10.0)`).
  2. Excluir a corrida em destaque (`activeRide.id`) da lista inferior de corridas ativas em `marketplace.rides.tsx`, exibindo um único card limpo em destaque.

---

### 43. Multiplicidade de Cards de Corridas por `localStorage` e Valor Padrão Fixo
* **Sintoma**: O app apresentava múltiplos cards ativos repetidos da mesma corrida e os valores não refletiam o preço real baseado na distância percorrida.
* **Causa Raiz**:
  1. O código de `marketplace.rides.tsx` reinjetava corridas salvas em `localStorage` (`pva_local_rides`), gerando corridas fantasma duplicadas.
  2. A submissão do formulário (`marketplace.taxi.tsx`) não calculava a distância dinâmica caso `distance` estivesse zerado na hora da solicitação.
* **Solução Padrão**:
  1. Remover a reinjeção de `pva_local_rides` no `marketplace.rides.tsx` e limitar a exibição estritamente ao card único em destaque da corrida ativa atual.
  2. Calcular dinamicamente `calculateDistance` e o preço final (`baseFee + dist * kmRate`) no exato momento da submissão em `marketplace.taxi.tsx`.

---

### 44. Minified React Error #418 por Leitura de `localStorage` na Inicialização de `useState`
* **Sintoma**: Erro não capturado `Minified React error #418` no console durante a renderização das rotas do cliente.
* **Causa Raiz**:
  Componentes como `marketplace.addresses.tsx`, `marketplace.checkout.tsx` e `marketplace.profile.tsx` utilizavam inicialização lazy `useState(() => localStorage.getItem(...))` com checagem `typeof window !== "undefined"`. Durante a pré-renderização estática o valor inicial era `""` e na hidratação client-side o valor lia o `localStorage`, gerando uma divergência de hidratação no React.
* **Solução Padrão**:
  Inicializar o estado de forma determinística (`""` ou `'light'`) e mover a leitura do `localStorage` para dentro do hook `useEffect` após a montagem do componente no navegador.

---

### 45. Ocultação de Corrida Ativa Recém-Criada por Ausência de Fallback de Sessão
* **Sintoma**: Ao solicitar uma corrida, a aba "Corridas" exibia "Nenhuma corrida em andamento" para passageiros não autenticados ou quando ocorria pequenos atrasos na resposta do Supabase.
* **Causa Raiz**:
  A remoção total da leitura do `localStorage` fazia com que corridas solicitadas por passageiros visitantes (com `user_id = null`) não fossem associadas se a busca por `savedIds` sofresse restrição ou atraso RLS.
* **Solução Padrão**:
  Restabelecer um fallback seguro em `fetchRides` que busca a corrida recém-criada no `localStorage` (`pva_local_rides`), filtrando estritamente por corridas com status ativo (`pending`, `accepted`, `in_progress`) ou recentes (<24h), garantindo exibição instantânea do card com o mapa.

---

### 46. Supressão de Erro de Hidratação React #418 em Elementos Raiz da Aplicação (`__root.tsx`)
* **Sintoma**: Exibição de `Uncaught Error: Minified React error #418` no console devido a discrepâncias em atributos da tag `<html>` ou `<body>` causadas por extensões de navegador ou troca de tema dinâmico.
* **Causa Raiz**:
  O componente `RootShell` em `__root.tsx` não continha o atributo `suppressHydrationWarning` nas tags `<html>` e `<body>`. Atributos inseridos por extensões ou pela classe de tema dark/light inserida dinamicamente desincronizavam o DOM do servidor/cliente.
* **Solução Padrão**:
  Adicionar `suppressHydrationWarning` nas tags `<html lang="pt-BR" suppressHydrationWarning>` e `<body suppressHydrationWarning>` no `RootShell` de `__root.tsx`.

---

### 47. Erro de Sintaxe PostgREST no Contador de Badges e Equiparação do Painel de Corridas ao Painel de Entregas
* **Sintoma**: O badge de corridas na barra inferior sumia e os valores de corridas em andamento não batiam com os valores calculados no Painel Admin.
* **Causa Raiz**:
  1. A sintaxe de `.or()` no `MarketplaceLayout.tsx` continha aspas duplas inválidas na interpolação de UUIDs em `id.in.()`, gerando erro no PostgREST.
  2. O Painel Admin de Corridas (`painel-primavera/src/routes/admin/rides.tsx`) era simplificado e carecia de controles avançados de filtro, busca, modais de detalhes e reatribuição direta de motoristas equivalentes ao painel de entregas.
* **Solução Padrão**:
  1. Corrigir a consulta do badge em `MarketplaceLayout.tsx` utilizando `Math.max` entre contagem do banco e contagem da sessão local.
  2. Atualizar o `marketplace.rides.tsx` para calcular dinamicamente a tarifa exata (`base + dist * rate`) caso `price` seja `0`.
  3. Reformular completamente `painel-primavera/src/routes/admin/rides.tsx` com barra de métricas, filtros por status/veículo, busca inteligente, seletor de alteração rápida de status, modal de detalhes com mapa e modal de atribuição de motorista parceiro.

---

### 48. Reaparecimento de Corrida Cancelada por Falha na Ordem de Execução em `handleCancelRide`
* **Sintoma**: Ao clicar em "Cancelar Corrida", o card da corrida cancelada continuava aparecendo na tela como "Procurando Motorista".
* **Causa Raiz**:
  A função `handleCancelRide` efetuava a chamada ao Supabase antes de atualizar o estado do React e o `localStorage`. Caso a requisição ao Supabase gerasse exceção ou demorasse, a execução do código era interrompida antes de atualizar `activeRide` para `null` e modificar o registro em `pva_local_rides`.
* **Solução Padrão**:
  1. Atualizar o estado do React (`setActiveRide(null)`, `setRides`) e o `localStorage` (`pva_local_rides` e `pva_my_ride_ids`) **imediatamente no momento do clique**, antes de qualquer chamada remota.
  2. Disparar o evento `pva_ride_updated` para zerar instantaneamente o badge da barra inferior.
  3. Executar o update no Supabase em bloco `try/catch` resiliente sem bloquear a interface do usuário.

---

### 49. Botão para Ocultar/Expandir Barra Lateral no Painel Admin Desktop
* **Sintoma**: A barra lateral esquerda (`AdminSidebar`) do Painel Admin ocupava espaço fixo de 256px (`w-64`) no desktop, reduzindo a largura útil das tabelas e mapas operacionais.
* **Causa Raiz**:
  O layout `AdminLayout.tsx` possuía apenas suporte a drawer mobile, sem um mecanismo para ocultar/recolher a barra lateral em telas desktop de alta resolução.
* **Solução Padrão**:
  1. Adicionar o botão de alternância `<Button onClick={toggleSidebar}>` ("Ocultar Barra Lateral" / "Expandir Menu") com o ícone `<PanelLeftClose>` no topo do `AdminLayout.tsx`.
  2. Implementar a transição suave de largura em `AdminSidebar.tsx` (recolhendo para `w-16` com exibição de ícones/tooltips) e ajustando a margem do conteúdo principal (`md:ml-16` / `md:ml-64`).
  3. Salvar a preferência do usuário no `localStorage` (`admin_sidebar_collapsed`).

---

### 50. Otimização de Densidade e Eliminação de Espaços em Branco no Painel de Corridas
* **Sintoma**: A tela de Gestão de Corridas (`painel-primavera/src/routes/admin/rides.tsx`) possuía grandes espaçamentos verticais, cards com paddings excessivos e colunas com textos longos que exigiam rolagem horizontal.
* **Causa Raiz**:
  O layout utilizava containers com `p-6`, cards de métricas em grid de alta margem e tabelas sem limitação de largura truncada (`max-w-[180px] truncate`).
* **Solução Padrão**:
  1. Redesenhar a barra de métricas em chips compactos inline em uma única linha no topo.
  2. Unificar a barra de busca e os seletores de filtro em uma barra única compacta (`p-2 px-3 rounded-xl`).
  3. Aplicar estilização de alta densidade na tabela (`py-2 px-3`), truncando endereços de origem e destino com atribuição do atributo `title` para leitura completa ao passar o ponteiro do mouse.

---

### 51. Desalinhamento do Endereço de Destino no Card de Acompanhamento de Corrida (`marketplace.rides.tsx`)
* **Sintoma**: No card da corrida ativa, o endereço de Destino era posicionado à esquerda do círculo vermelho em telas médias/grandes, desalinhado do endereço de Origem.
* **Causa Raiz**:
  O componente utilizava um layout de grid com `md:odd:flex-row-reverse` que invertia a posição dos elementos pares (`even`), jogando o segundo ponto da rota (Destino) para a esquerda da linha vertical.
* **Solução Padrão**:
  Substituir o layout alternado por um *route stepper* com borda vertical pontilhada à esquerda (`border-l-2 border-dashed border-border`), posicionando **Origem** (círculo verde) e **Destino** (círculo vermelho) perfeitamente alinhados à direita de seus respectivos marcadores.







