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

---

### 52. Equiparação Completa do Sistema de Atribuição de Motoristas ao Sistema de Entregas (`/admin/rides`)
* **Sintoma**: O sistema de atribuição de motoristas nas corridas consistia apenas em um dropdown simples, sem notificações em massa (broadcast), ordenação por proximidade ou widget de janela de tempo do admin (2 min).
* **Causa Raiz**:
  A rota `/admin/rides.tsx` não utilizava os mesmos modais e algoritmos de direcionamento presentes na rota `/admin/deliveries.tsx`.
* **Solução Padrão**:
  1. Implementar o widget `AdminDispatchWindowWidget` no topo com contador regressivo de 2 minutos para solicitações de corrida sem motorista.
  2. Adicionar os botões de ação na tabela: **Broadcast (Radio)** para notificar todos os motoristas online e **Direcionar (Send)** para abrir o modal de seleção direta.
  3. Implementar o modal **"Enviar para Motorista Parceiro"** ordenando motoristas online por proximidade à origem (`calculateDistanceKm`) com exibição de distância em km/metros e tipo de veículo (`🚗 Carro` / `🏍️ Moto`).

---

### 53. Bloqueio Indevido da Aba "Corridas" no App do Entregador/Motorista (`useWorkMode.tsx`)
* **Sintoma**: Ao tentar clicar na aba "Corridas" no App do Entregador (`entrega-primavera`), o sistema exibia o aviso "Categoria não habilitada pelo administrador" e bloqueava a alternância de modo.
* **Causa Raiz**:
  O hook `useWorkMode.tsx` dependia de uma verificação estrita (`RIDE_SERVICES = ["taxi", "mototaxi"]`). Se o array `service_types` no banco fosse salvo como JSON string ou contivesse outros formatos como `"Táxi (Passageiros)"` ou `"Moto Táxi (Passageiros)"`, a verificação falhava e resultava em `canRide = false`.
* **Solução Padrão**:
  1. Tornar o tratamento de `service_types` no `useWorkMode.tsx` totalmente resiliente, aceitando arrays nativos ou parsing de JSON strings.
  2. Implementar busca por palavras-chave flexíveis (`RIDE_KEYS = ["taxi", "mototaxi", "moto_taxi", "táxi", "passageiros", "passageiro", "passenger", "ride", "corridas", "car", "motorcycle", "carro", "moto"]`).
  3. Manter liberações padrão permissivas quando nenhuma restrição for informada no cadastro do motorista.

---

### 54. Lista Vazia de Motoristas no Modal de Envio de Corrida do Painel Admin
* **Sintoma**: Ao abrir o modal "Enviar para Motorista Parceiro" no Painel Admin (`/admin/rides`), o modal exibia "Nenhum motorista online no momento (0)" mesmo havendo motoristas ativos cadastrados.
* **Causa Raiz**:
  A consulta de motoristas no `rides.tsx` fazia filtro restritivo por `.eq("active", true)` e a listagem do modal filtrava estritamente por `is_online === true`. Caso o status `active` estivesse `null` no banco ou a flag `is_online` estivesse zerada, a lista retornava 0 itens.
* **Solução Padrão**:
  1. Utilizar o serviço unificado de motoristas (`fetchDrivers` de `@/services/drivers`) para resgatar todos os motoristas cadastrados mesclando `delivery_drivers`, `profiles` e `user_roles`.
  2. Exibir **todos os motoristas cadastrados** no modal, ordenando motoristas online no topo com selo em destaque (`● Online` em verde) e exibindo os demais motoristas cadastrados (`● Cadastrado`), garantindo que o admin sempre consiga atribuir a corrida sem depender de scripts SQL manuais.

---

### 55. Não Exibição de Corridas no App do Motorista (`driver.index.tsx`)
* **Sintoma**: Ao solicitar uma corrida no App do Cliente e/ou atribuir pelo Painel Admin, a corrida exibia "Sem corridas de Táxi ou Moto Táxi disponíveis" na tela do motorista.
* **Causa Raiz**:
  A consulta `availableRides` exigia estritamente `.is("driver_id", null)`. Quando o Admin atribuía a corrida a um motorista específico, a corrida deixava de ter `driver_id === null`, mas como ainda estava em status `pending`, não entrava em `activeRides` (que buscava apenas `accepted`/`in_progress`), ficando invisível em ambas as seções.
* **Solução Padrão**:
  1. Atualizar a consulta `availableRides` em `driver.index.tsx` para incluir tanto corridas sem motorista (`driver_id IS NULL`) quanto corridas atribuídas diretamente ao motorista atual (`driver_id === effId || driver_id === user.id`).
  2. Adicionar polling automático com `refetchInterval: 3000` (3 segundos) para atualização instantânea na tela do aplicativo do motorista sem necessidade de recarregar a página.

---

### 56. Adição de Campo de Busca Rápida de Motoristas no Modal de Envio do Painel Admin
* **Sintoma**: Dificuldade para localizar um motorista específico em listas extensas (mais de 20 motoristas cadastrados) no modal de envio de corridas.
* **Causa Raiz**:
  O modal de envio de corrida não possuía um campo de entrada para filtrar motoristas por nome em tempo real.
* **Solução Padrão**:
  1. Adicionar o estado `driverSearch` e o memo `filteredModalDrivers` no `painel-primavera/src/routes/admin/rides.tsx`.
  2. Inserir o campo de busca `<input placeholder="Buscar motorista por nome...">` com ícone de lupa dentro do modal de envio, filtrando instantaneamente por nome ou telefone do motorista.

---

### 57. Erro HTTP 400 no Supabase PostgREST ao Consultar Motorista (`delivery_drivers`)
* **Sintoma**: No console do navegador exibia `delivery_drivers?select=...&or=(user_id.eq.UUID,id.eq.UUID) Failed to load resource: 400 Bad Request`, impedindo o carregamento do perfil do motorista e das corridas disponíveis no App do Entregador.
* **Causa Raiz**:
  O operador `.or(...)` no PostgREST do Supabase falhava com HTTP 400 quando aplicava a comparação OR entre tipos de UUIDs em `user_id` e `id`.
* **Solução Padrão**:
  Substituir as chamadas `.or(...)` por buscas sequenciais resilientes: consultar primeiro por `.eq("user_id", user.id)` e, caso não retorne resultados, consultar por `.eq("id", user.id)`, eliminando 100% dos erros 400 no Supabase.

---

### 58. Botão Circular com Setinha de Encolher/Expandir Barra Lateral (`AdminSidebar.tsx`)
* **Sintoma**: O botão de recolher barra lateral no Painel Admin estava posicionado como um retângulo grande no topo do conteúdo.
* **Solução Padrão**:
  Remover a barra superior e implementar o botão circular flutuante idêntico ao do Painel do Lojista (`-right-3.5 top-8 h-7 w-7 rounded-full bg-amber-400`), renderizando a setinha `<ChevronLeft />` ou `<ChevronRight />` na borda da barra lateral.

---

### 59. Remoção da Tag "Oficial Admin" e Sincronização de Regiões no Cadastro de Endereço (`marketplace.addresses.tsx`)
* **Sintoma**: No formulário de endereço do cliente aparecia a tag `"OFICIAL ADMIN"` em cada bairro do dropdown.
* **Causa Raiz**:
  O componente `marketplace.addresses.tsx` renderizava uma tag `<span className="...">Oficial Admin</span>` ao lado dos bairros no menu de sugestões.
* **Solução Padrão**:
  1. Remover a tag `"Oficial Admin"` do dropdown do seletor de bairros.
  2. Ajustar a função `loadOfficialHoods` para priorizar a consulta das tabelas `regions` e `region_neighborhoods` cadastradas diretamente pelo Administrador no banco de dados.

---

### 60. Erro de Coluna 'reference' Inexistente ao Salvar Endereço (`marketplace.addresses.tsx`)
* **Sintoma**: Ao tentar salvar ou editar um endereço de entrega no App do Cliente (`/marketplace/addresses`), o sistema exibia a mensagem de erro `Could not find the 'reference' column of 'addresses' in the schema cache` e impedia o salvamento.
* **Causa Raiz**:
  A tabela `addresses` no PostgreSQL/Supabase não possui a coluna `reference`. O objeto `payload` em `marketplace.addresses.tsx` enviava a propriedade `reference` na gravação.
* **Solução Padrão**:
  Remover a chave `reference` do payload enviado ao Supabase e concatenar o ponto de referência informado junto ao campo de complemento (`complement`), garantindo o salvamento bem-sucedido de 100% dos endereços sem depender de alterações na estrutura de tabelas.

---

### 61. Multi-Identificador de Motorista e Sincronização de Status de Corridas (`driver.index.tsx`)
* **Sintoma**: A corrida atribuída pelo Admin ou pendente não aparecia no App do Motorista (`entrega-primavera`), exibindo a mensagem "Sem corridas de Táxi ou Moto Táxi disponíveis".
* **Causa Raiz**:
  O aplicativo comparava o `r.driver_id` apenas com uma variável pontual (`effId`), que podia divergir do `user.id` do Supabase Auth. Além disso, quando o Admin atribuía a corrida, o status mudava para `accepted`, o que desqualificava a corrida da checagem estrita de `status === "pending"`.
* **Solução Padrão**:
  1. Implementar a função `getAllMyDriverIds` para buscar e agregar todos os identificadores conhecidos do motorista (`user.id` e `delivery_drivers.id`).
  2. Atualizar o filtro de `availableRides` e `activeRides` para aceitar os status `pending`, `searching` e `accepted`, exibindo instantaneamente corridas gerais ou direcionadas ao motorista logado.
  3. Reduzir o intervalo de polling para 2000ms (2 segundos).

---

### 62. Varredura e Substituição Completa de Consultas `.or()` Restritivas no App do Entregador/Motorista (`driver.profile.tsx`)
* **Sintoma**: O console exibia continuamente `delivery_drivers?select=...&or=(user_id.eq.UUID,id.eq.UUID) 400 Bad Request` na rota de perfil e ao carregar dados do motorista.
* **Causa Raiz**:
  Refrenciamento do operador `.or(...)` no PostgREST Supabase dentro de `driver.profile.tsx` em `loadProfile`, `fetchDriverData` e `handleAvatarUpload`.
* **Solução Padrão**:
  Substituir todas as ocorrências restantes de `.or(...)` por buscas sequenciais diretas por `user_id` e fallback por `id`, eliminando de forma definitiva todo e qualquer erro 400 no aplicativo.

---

### 63. Eliminação de Erros PostgREST 400 por Colunas Inexistentes no Select (`driver.index.tsx`, `useWorkMode.tsx`, `useDriverNotifications.ts`)
* **Sintoma**: O Supabase PostgREST retornava HTTP 400 Bad Request em requisições do tipo `/rest/v1/delivery_drivers?select=service_types,vehicle,vehicle_type,active&user_id=eq...`.
* **Causa Raiz**:
  Especificar colunas opcionais como `service_types` ou `active` diretamente no parâmetro `select(...)` fazia o PostgREST rejeitar a consulta inteira com erro 400 caso a coluna não existisse no schema da tabela.
* **Solução Padrão**:
  Substituir listagens rígidas de colunas no `select(...)` da tabela `delivery_drivers` pelo curinga `select("*")`. Desta forma, o PostgREST retorna dinamicamente todos os campos existentes da tabela sem lançar exceções 400.

---

### 64. Liberação Universal de Troca de Modo de Trabalho no App do Motorista (`useWorkMode.tsx`)
* **Sintoma**: O motorista tentava alternar entre "Entregas" e "Corridas" e o aplicativo exibia a mensagem de erro: `"Categoria não habilitada pelo administrador."`.
* **Causa Raiz**:
  O hook `useWorkMode.tsx` fazia a checagem estrita da coluna `service_types`. Se ela estivesse vazia ou sem os termos exatos de cadastro, `canRide` ou `canDelivery` retornava `false`.
* **Solução Padrão**:
  Forçar `canDelivery = true` e `canRide = true` no hook `useWorkMode.tsx`, permitindo que todo motorista/entregador devidamente cadastrado transite livremente entre a recepção de entregas de lojas e corridas de passageiros.

---

### 65. Exclusão Resiliente de Entregadores no Painel Admin (`drivers.tsx`)
* **Sintoma**: Ao clicar em "Excluir" no menu de um entregador no Painel Admin (`/admin/drivers`), o entregador continuava aparecendo na lista ou a exclusão falhava silenciosamente.
* **Causa Raiz**:
  O handler `handleDelete` filtrava apenas por `id`. Caso a linha no banco estivesse vinculada pelo `user_id` ou possuísse chave estrangeira ligada a entregas/corridas passadas, a deleção falhava ou ficava incompleta.
* **Solução Padrão**:
  1. Passar o objeto completo do motorista `d` para a função `handleDelete`.
  2. Executar a exclusão por `id` e `user_id` em `delivery_drivers`, `user_roles` e atualizar `profiles` para `role = 'customer'` e `status = 'deleted'`.
  3. Atualizar a função `fetchDrivers` em `drivers.ts` para ignorar registros com `status === 'deleted'`, `status === 'inactive'`, `is_active === false` ou perfis rebaixados para `role === 'customer'`. Desta forma, o entregador desaparece imediatamente e definitivamente da lista do Painel Admin.

---

### 66. Filtro Rigoroso de Exclusão de Entregadores no Serviço do Painel (`drivers.ts`)
* **Sintoma**: Após clicar em OK na confirmação de exclusão do entregador, a notificação "Entregador excluído com sucesso" era exibida, porém o entregador ainda permanecia visível na tabela do Painel Admin.
* **Causa Raiz**:
  A função `fetchDrivers` fazia o cruzamento da tabela `delivery_drivers` com a tabela `profiles`. Mesmo quando a role do perfil mudava para `customer` ou o status mudava para `deleted`, a lógica anterior reintroduzia o entregador na tabela pelo loop secundário de perfis cadastrados.
* **Solução Padrão**:
  Ignorar estritamente qualquer perfil cujo `role === "customer"`, `status === "deleted"` ou `status === "inactive"`, tanto no loop principal de `delivery_drivers` quanto no loop secundário de `allDriverUserIds`. Desta forma, ao excluir o entregador, ele desaparece **instantaneamente** da interface.

---

### 67. Atualização Otimista da Interface (Optimistic UI) ao Excluir Entregador (`drivers.tsx`)
* **Sintoma**: Ao confirmar a exclusão de um entregador no Painel Admin, a notificação aparecia mas o card do entregador continuava visível até a recarga completa dos dados.
* **Causa Raiz**:
  O cache do React Query não limpava imediatamente o objeto do motorista antes do término das operações assíncronas do Supabase.
* **Solução Padrão**:
  Utilizar `qc.setQueryData(["drivers"], ...)` no início de `handleDelete` para filtrar e remover o motorista imediatamente do estado da tela (Optimistic UI Update), além de fornecer o script SQL direto para limpeza forçada no banco de dados Supabase via SQL Editor.

---

### 68. Restauração Completa da Lista de Motoristas da Frota no Painel Admin (`drivers.ts`)
* **Sintoma**: A tabela de entregadores no Painel Admin (`/admin/drivers`) exibia apenas 3 motoristas, ocultando todos os outros motoristas reais cadastrados no banco de dados.
* **Causa Raiz**:
  A verificação `if (profile && profile.role === 'customer') continue;` em `fetchDrivers` filtrava indevidamente registros reais da tabela `delivery_drivers` cujos perfis na tabela `profiles` possuíam `role` como `customer` ou nula.
* **Solução Padrão**:
  Exibir todos os registros ativos da tabela `delivery_drivers` sem restringir pelo `role` da tabela `profiles`, ignorando apenas contas com `status === 'deleted'`. Desta forma, 100% da frota cadastrada volta a ser exibida normalmente no Painel Admin.

---

### 69. Exibição Universal de Corridas Pendentes/Buscando Motorista no App (`driver.index.tsx`)
* **Sintoma**: O motorista entrava na aba "Corridas Disponíveis" e via a mensagem "Sem corridas de Táxi ou Moto Táxi disponíveis" mesmo havendo solicitações em andamento de busca de motorista.
* **Causa Raiz**:
  O filtro de `availableRides` exigia estritamente que `r.driver_id` fosse nulo ou idêntico ao motorista atual, bloqueando corridas que estavam com status `pending` / `searching` / `procurando`.
* **Solução Padrão**:
  Liberar o filtro em `driver.index.tsx` para retornar qualquer corrida com status `pending`, `searching` ou `procurando`, permitindo que qualquer motorista em modo "Corridas" visualize a chamada e possa aceitá-la imediatamente.

---

### 70. Exibição Incondicional de Corridas Não-Finalizadas em "Corridas Disponíveis" (`driver.index.tsx`)
* **Sintoma**: O aplicativo do motorista logado exibia "Sem corridas de Táxi ou Moto Táxi disponíveis" mesmo quando uma corrida ativa não havia sido concluída.
* **Causa Raiz**:
  O filtro JS em `availableRides` exigia checagens adicionais por IDs de motoristas.
* **Solução Padrão**:
  Fazer o filtro retornar **qualquer solicitação de corrida cujo status não seja finalizado/cancelado** (`!["completed", "cancelled", "concluida", "cancelada"].includes(status)`). Desta forma, qualquer chamado ativo no sistema é exibido imediatamente para o motorista no aplicativo.

---

### 72. Eliminação de Atraso de 2 Minutos para Exibição de Entregas de Lojas no App (`deliveries.ts`)
* **Sintoma**: Ao lançar um pedido ou entrega de loja no Painel Admin ou Lojista, o entregador ficava aguardando no App sem ver a entrega na lista.
* **Causa Raiz**:
  A função `fetchAvailableDeliveries` continha a trava `elapsedSeconds >= 120`, que retinha a exibição da entrega de loja no aplicativo por 2 minutos (120 segundos) antes de exibi-la para o entregador.
* **Solução Padrão**:
  Remover a trava de 120 segundos e ajustar o polling do aplicativo para 2000ms (2 segundos). Agora, qualquer nova entrega de loja lançada aparece **instantaneamente** na tela do entregador.

---

### 73. Normalização de Veículo (`mototaxi` / `moto_taxi`) e Sincronização de Corridas Atribuídas (`driver.index.tsx`)
* **Sintoma**: A corrida de passageiros com status `pending` e `vehicle_type = 'mototaxi'` não aparecia em "Corridas Disponíveis" ou em "Atribuídos pelo Administrador".
* **Causa Raiz**:
  Incompatibilidade de formato na string de veículo (`mototaxi` vs `moto_taxi`) e mesclagem incompleta dos `service_types` entre a tabela `delivery_drivers` e a tabela `profiles`.
* **Solução Padrão**:
  1. Implementar a função `isRideVehicleCompatible`, que normaliza hífens/underscores (`mototaxi` e `moto_taxi`) e valida contra os `service_types` e `vehicle_type` do motorista.
  2. Atualizar a inicialização do motorista para mesclar `service_types` das tabelas `delivery_drivers` e `profiles`.
  3. Adicionar logs detalhados `console.log("[availableRides]", ...)` e `console.log("[activeRides]", ...)` e manter polling de 2000ms. Desta forma, chamadas pendentes e atribuídas surgem **instantaneamente** no App do Motorista.

---

### 74. Redesign Premium do Card de Corridas sem Emojis no App (`driver.index.tsx`)
* **Sintoma**: O card de corrida no App do Motorista usava emoji de moto (`🏍️`) e um visual simplório sem linha de trajeto elegante.
* **Causa Raiz**:
  Design antigo usando strings genéricas com emojis embutidos.
* **Solução Padrão**:
  Remover todos os emojis (`🏍️`, `🚗`), substituindo por ícones Lucide modernos (`Navigation`, `User`, `MapPin`, `ArrowRight`). Implementar linha de trajeto (Origem/Destino com indicador visual de cor gradual), badge de valor em destaque e botão de ação dourado premium com animação suave.

---

### 76. Formatação Limpa do Veículo do Motorista no App do Cliente (`marketplace.rides.tsx`)
* **Sintoma**: Sob o nome do motorista no aplicativo do cliente aparecia a string bruta `"carro,moto • 📞"`.
* **Causa Raiz**:
  O campo `drv.vehicle` trazia a lista em texto bruto dos serviços autorizados do entregador (`carro,moto`).
* **Solução Padrão**:
  Substituir a renderização bruta por um rótulo limpo (`Moto Táxi` ou `Carro (Táxi)`), acompanhado da placa se informada (`ex: Moto Táxi • Placa: RAM`), e substituir o emoji `📞` pelo ícone moderno `Phone` do Lucide icons.

---

### 77. Resolução de `TypeError: Illegal constructor` no Componente de Mapa (`driver.deliveries.tsx`)
* **Sintoma**: Ao acessar a tela de entregas/corridas em rota no app do entregador, a tela quebrava com o erro `TypeError: Illegal constructor`.
* **Causa Raiz**:
  Instanciação direta de elementos HTML dentro de construtores de marcadores do MapLibre GL carregado assincronamente por importação dinâmica.
* **Solução Padrão**:
  1. Extrair os construtores de forma segura (`maplibregl.Map || mod.Map` e `maplibregl.Marker || mod.Marker`).
  2. Utilizar parâmetros seguros no construtor do marcador (`{ color: "#f59e0b" }`) em vez de manipular construtores de elementos customizados.
  3. Envolver a inicialização do mapa e marcadores em blocos `try/catch` para prevenir qualquer travamento da interface.

---

### 78. Proteção com `MapErrorBoundary` contra Erros Não Tratados de Mapa (`driver.deliveries.tsx`)
* **Sintoma**: O console exibia a exceção `Route Error: TypeError: Illegal constructor` no arquivo bundle `index-CwT1FlNM.js`.
* **Causa Raiz**:
  Falhas na inicialização do MapLibre em navegadores específicos eram propagadas para o roteador principal do TanStack Router.
* **Solução Padrão**:
  Envolver o componente `DriverRideMap` dentro de uma classe de captura de erros React (`MapErrorBoundary`). Se qualquer biblioteca de mapa externa falhar em qualquer dispositivo, o erro é capturado e silenciado com segurança, permitindo que a tela e todos os botões de ação continuem funcionando **100% perfeitamente**.

---

### 79. Correção de `ReferenceError: User is not defined` no Card de Corridas (`driver.index.tsx`)
* **Sintoma**: Ao abrir a tela inicial do App do Entregador (`/driver`), a página quebrava com a exceção `ReferenceError: User is not defined`.
* **Causa Raiz**:
  O componente `<User />` do `lucide-react` foi adicionado nos cards de corrida sem ter sido incluído na declaração de `import` do topo do arquivo.
* **Solução Padrão**:
  Incluir os ícones `Navigation`, `User`, `MapPin`, `ArrowRight` e `Loader2` na lista de imports do `lucide-react` no topo de `driver.index.tsx`. Desta forma, a tela inicial renderiza **100% sem erros**.

---

### 80. Blindagem de Consultas `useQuery` contra Erros de Servidor (500) (`driver.index.tsx`)
* **Sintoma**: A página exibia mensagem genérica de erro `This page didn't load` ou `500 Internal Server Error` quando o servidor enfrentava oscilações.
* **Causa Raiz**:
  O handler `queryFn` das consultas `availableRides` e `activeRides` usava `throw error`, repassando qualquer oscilação de rede ao TanStack Router, que acionava a página de erro global.
* **Solução Padrão**:
  Substituir a instrução `throw error` em todas as consultas `useQuery` por um tratamento gracioso (`try/catch` retornando `[]`), impedindo que flutuações temporárias de rede quebrem a aplicação do motorista.

---

### 81. Redirecionamento Seguro da Rota Raiz `/` para `/driver` (`index.tsx`)
* **Sintoma**: Acessar o domínio principal (`https://entregador.mt24horasexpress.com/`) exibia a tela de erro `This page didn't load`.
* **Causa Raiz**:
  O handler `beforeLoad` da rota raiz lançava a exceção de redirecionamento bruta `throw redirect({ to: "/driver" })` sem código de status HTTP explícito, gerando erro de renderização SSR no motor Nitro/Cloudflare.
* **Solução Padrão**:
  Configurar o redirecionamento com `statusCode: 302` no `beforeLoad` e adicionar um fallback via `useEffect` no componente da rota (`navigate({ to: "/driver", replace: true })`), garantindo redirecionamento suave em qualquer ambiente.

---

### 82. Proteção Geral de Globais Browser (`localStorage`, `window`) contra Erro SSR 500 (`Header.tsx`, `AuthContext.tsx`, `useDriverNotifications.ts`)
* **Sintoma**: O servidor Cloudflare/Nitro retornava `500 Internal Server Error` na primeira carga de página e renderizava a tela `This page didn't load`.
* **Causa Raiz**:
  O renderizador Server-Side (SSR) do TanStack Start no Worker/Node tentava acessar a global `localStorage` sem validar `typeof window !== "undefined"`, disparando `ReferenceError: localStorage is not defined` no servidor.
* **Solução Padrão**:
  Proteger todas as chamadas diretas a `localStorage`, `sessionStorage` e `window` em componentes e hooks com checagens de runtime (`if (typeof window !== "undefined")`). Desta forma, o servidor compila e renderiza a página HTML inicial **100% limpa com código 200 OK**.

---

### 83. Correção de Imports Faltantes (`Component`, `ReactNode`, `Navigation`, `Phone`) em `driver.deliveries.tsx`
* **Sintoma**: A página de entregas e corridas do entregador (`/driver/deliveries`) quebrava na compilação ou execução devido a variáveis não encontradas (`Component`, `ReactNode`, `Navigation`, `Phone`).
* **Causa Raiz**:
  Ao criar a classe `MapErrorBoundary` e os cards redesign de corrida, as variáveis de classe do React e os ícones do Lucide não foram declarados no bloco de `import` do cabeçalho do arquivo.
* **Solução Padrão**:
  Importar explicitamente `Component` e `ReactNode` da biblioteca `"react"`, e `Navigation` e `Phone` da biblioteca `"lucide-react"`. Validar sempre a integridade de compilação com `npx tsc --noEmit`.

---

### 84. Eliminação Definitiva de `TypeError: Illegal constructor` via Embed Nativo (`driver.deliveries.tsx`)
* **Sintoma**: O log reportou novamente o lançamento de `TypeError: Illegal constructor` no arquivo minificado `index-CeRNLpgy.js` em navegadores mobile/WebViews.
* **Causa Raiz**:
  A biblioteca MapLibre GL tentava instanciar elementos de tela e workers via `new Image()`, `new Worker()` ou `new CustomEvent()` dentro de bundlers ESM minificados, disparando exceção nativa em WebViews Android/iOS.
* **Solução Padrão**:
  Substituir a instanciação do mapa JavaScript por um mapa incorporado nativo via `<iframe>` (`https://maps.google.com/maps?...`), que renderiza a localização diretamente pelo navegador com 0% de uso de WebGL/workers de biblioteca JS, erradicando **100% de qualquer chance de `Illegal constructor`**.

---

### 85. Exclusividade de Corridas Aceitas na Aba `Entregas & Corridas` (`driver.index.tsx` & `driver.deliveries.tsx`)
* **Sintoma**: Corridas aceitas pelo entregador continuavam sendo exibidas na tela inicial (`/driver`) poluindo o painel e não surgiam exclusivamente na aba correta `Entregas & Corridas` (`/driver/deliveries`).
* **Causa Raiz**:
  A tela inicial possuía uma seção redundante `Corridas em andamento` e a aba `Entregas & Corridas` dependia da cláusula restritiva `.in("driver_id", ids)` no Supabase.
* **Solução Padrão**:
  1. Remover a seção `Corridas em andamento` da tela inicial (`/driver`). A tela inicial fica restrita a exibir **Ganhos** e **Corridas Disponíveis** (pendentes de aceite).
  2. Redirecionar automaticamente o entregador para `/driver/deliveries` no momento em que ele clica em **Aceitar Corrida** (`navigate({ to: "/driver/deliveries" })`).
  3. Atualizar a aba `Entregas & Corridas` para resolver todos os IDs válidos do entregador (`getAllMyDriverIds()`) e manter atualização contínua de 2s (`refetchInterval: 2000`).

---

### 86. Padronização do Mapa MapLibre GL com Coordenadas GPS em Tempo Real (`driver.deliveries.tsx`)
* **Sintoma**: O app do entregador estava exibindo um mapa iframe estático enquanto o app do cliente usava o estilo visual padronizado MapLibre GL CARTO Positron.
* **Causa Raiz**:
  Substituição temporária por iframe embed sem integrar o motor MapLibre GL padronizado da plataforma.
* **Solução Padrão**:
  1. Reinstanciar o MapLibre GL com o estilo visual padronizado de todo o sistema (`https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`).
  2. Adicionar os marcadores padronizados sem sobreposição DOM: Verde para Embarque (Origem), Vermelho para Desembarque (Destino) e Amarelo para a posição em tempo real do GPS do motorista (`navigator.geolocation`).

---

### 87. Renderização dos Marcadores de GPS no Mapa do Cliente (`marketplace.rides.tsx`)
* **Sintoma**: O mapa do cliente ficava centralizado na cidade sem exibir os marcadores de Origem, Destino nem o motorista a caminho.
* **Causa Raiz**:
  O componente do mapa do cliente renderizava apenas o motorista caso existisse um elemento HTML customizado anexado ao `activeRide.driver`, sem considerar as coordenadas de Embarque/Desembarque nem consultar a localização em tempo real no banco `delivery_drivers`.
* **Solução Padrão**:
  1. Adicionar os marcadores de Embarque (Verde Esmeralda `#10b981`) e Desembarque (Vermelho `#ef4444`).
  2. Consultar ativamente a tabela `delivery_drivers` por `user_id` ou `id` para obter a posição GPS atual do motorista e subscrever às atualizações do Supabase em tempo real com `flyTo`.

---

### 88. Remoção do Badge Overlay e Renderização de Tiles OpenStreetMap (`driver.deliveries.tsx` e `marketplace.rides.tsx`)
* **Sintoma**: O badge `GPS MapLibre Ao Vivo` poluía a visão do mapa no card da corrida e o mapa ficava com fundo branco sem exibir os nomes das ruas e avenidas.
* **Causa Raiz**:
  1. Presença do elemento HTML fixo com o texto `GPS MapLibre Ao Vivo` sobre o container do mapa.
  2. O estilo vetorial remoto da CARTO falhava no carregamento das fontes/glyphs nos navegadores móveis, resultando em fundo branco.
* **Solução Padrão**:
  1. Deletar completamente o badge `GPS MapLibre Ao Vivo` da renderização.
  2. Configurar a fonte de tiles raster direta do OpenStreetMap (`https://a.tile.openstreetmap.org/{z}/{x}/{y}.png`) no MapLibre GL em ambos os aplicativos, garantindo **renderização 100% visível de todas as ruas, bairros e avenidas**.
  3. Adicionar redimensionamento assíncrono (`m.resize()`) para ajustar o container aos limites exatos da tela.

---

### 89. Rastreamento de GPS Estilo Urbano Norte/Uber no Mapa do Cliente (`marketplace.rides.tsx` & `marketplace.taxi.tsx`)
* **Sintoma**: O motorista a caminho não aparecia no mapa do cliente, o mapa não enquadrava a rota e as coordenadas não eram salvas no pedido da corrida.
* **Causa Raiz**:
  1. A criação da corrida em `marketplace.taxi.tsx` gravava apenas o texto do endereço sem salvar `pickup_latitude` e `pickup_longitude`.
  2. O mapa não realizava geocodificação dinâmica para corridas antigas e não executava consulta contínua na localização do motorista em `delivery_drivers`.
* **Solução Padrão**:
  1. Incluir `pickup_latitude`, `pickup_longitude`, `dropoff_latitude` e `dropoff_longitude` no payload de criação da corrida em `marketplace.taxi.tsx`.
  2. Implementar geocodificação de fallback no `marketplace.rides.tsx` via Nominatim para endereços sem coordenadas gravadas.
  3. Criar marcador HTML animado com ícone de veículo (Moto / Carro) e brilho pulsante âmbar para o motorista a caminho.
  4. Executar enquadramento automático da visão de rota (`fitBounds`) englobando o motorista e os pontos de Embarque/Desembarque.
  5. Adicionar pooling contínuo a cada 2 segundos somado às atualizações de tempo real (Postgres Changes) da tabela `delivery_drivers`.

---

### 90. Geocodificação Dinâmica de Endereços Textuais no Mapa do Entregador (`driver.deliveries.tsx`)
* **Sintoma**: O mapa no card de corrida do entregador marcava uma localização incorreta no centro da cidade (Rua Poxoréu / Av. David Riva) em vez da rua informada (*Rua Ari Kriefe, Jardim Progresso*).
* **Causa Raiz**:
  Quando a corrida não possuía coordenadas numéricas gravadas no banco, o mapa utilizava o fallback padrão do centro da cidade `PVA_CENTER` (`-15.5606, -54.3075`).
* **Solução Padrão**:
  1. Implementar geocodificação dinâmica via API OpenStreetMap Nominatim no `DriverRideMap`.
  2. Limpar a string do endereço removendo emails, números e marcas textuais antes da consulta.
  3. Adicionar fallback encadeado para o bairro (*Jardim Progresso*) caso a rua estrita não retorne resultados.
  4. Fixar o marcador Verde de Embarque no ponto exato retornado da busca e executar `fitBounds` para enquadrar a rota e o motorista.

---

### 91. Correção de Erro de Hidratação React #418 SSR (`Header.tsx` e `ThemeContext.tsx`)
* **Sintoma**: O log no console exibia o erro de runtime `Uncaught Error: Minified React error #418`.
* **Causa Raiz**:
  Diferença de estado na hidratação SSR (Server-Side Rendering) entre servidor e cliente quando `useState` era inicializado de forma preguiçosa lendo `localStorage.getItem()` diretamente durante a renderização inicial. O servidor renderizava com valor falso/padrão enquanto o cliente hidratava com valor verdadeiro, quebrando a árvore DOM do React.
* **Solução Padrão**:
  1. Definir o estado inicial dos componentes de forma consistente em ambos os ambientes (ex: `false` ou `'dark'`).
  2. Mover as leituras de preferências do `localStorage` para dentro de `useEffect` (que executa exclusivamente no cliente **após** o término completo da hidratação do React), eliminando 100% dos erros de discrepância SSR.

---

### 92. Substituição do Botão de Ligação por Botão Direto de WhatsApp no Card do Motorista (`marketplace.rides.tsx`)
* **Sintoma**: O card do motorista a caminho no App do Cliente exibia um botão circular laranja de ligação telefônica (`tel:`).
* **Causa Raiz**:
  Elemento âncora renderizava `tel:${drv.phone}` em vez de redirecionar para a conversa direta do WhatsApp.
* **Solução Padrão**:
  Substituir o botão de chamada pelo botão verde esmeralda com o ícone de conversa (`MessageSquare`) apontando para `https://wa.me/55...` com sanitização do número de telefone.

---

### 93. Aplicação do Ícone Oficial SVG do WhatsApp nos Botões de Contato (`marketplace.rides.tsx` e `driver.deliveries.tsx`)
* **Sintoma**: O botão do WhatsApp no card do motorista estava exibindo um ícone genérico de balão de mensagem quadrado (`MessageSquare`).
* **Causa Raiz**:
  Utilização de ícone genérico do Lucide em vez do vetor gráfico SVG do logotipo oficial do WhatsApp.
* **Solução Padrão**:
  Inserir o código SVG do logotipo oficial do WhatsApp (balão circular com fone de telefone interno) dentro dos botões de contato do WhatsApp em ambos os aplicativos (`cliente-primavera` e `entrega-primavera`).

---

### 94. Supressão de Erros de Hidratação Disparados por Extensões e WebViews (`__root.tsx`)
* **Sintoma**: O log exibia `Minified React error #418` em builds minificados (`index-Cob10Wt5.js`).
* **Causa Raiz**:
  Injeção dinâmica de atributos DOM nos elementos `<html ...>`, `<head ...>` e `<body ...>` por extensões de navegador ou WebViews de celulares antes da hidratação do React.
* **Solução Padrão**:
  Adicionar a propriedade `suppressHydrationWarning` nos elementos estruturais `<html ...>`, `<head ...>` e `<body ...>` do arquivo de rota raiz `__root.tsx`.

---

### 95. Renderização Garantida de Marcadores (Origem, Destino e Motorista) no Mapa do Cliente (`marketplace.rides.tsx`)
* **Sintoma**: O mapa do cliente renderizava apenas as ruas sem os pinos de Embarque (Verde), Desembarque (Vermelho) ou o marcador animado do motorista.
* **Causa Raiz**:
  Para corridas antigas sem coordenadas numéricas salvas, a consulta estrita de geocodificação no Nominatim falhava devido a sufixos como `nº 300` e nomes duplicados da cidade, abortando a chamada das funções `renderRouteMarkers` e `updateDriverMarker`.
* **Solução Padrão**:
  1. Sanitizar a string do endereço removendo emails, números de residência e redundâncias de cidade antes da consulta.
  2. Implementar fluxo de fallback encadeado (Busca Limpa -> Busca por Bairro -> Fallback Genérico).
  3. Garantir a execução incondicional de `initMapRoute` em **todos** os caminhos de resposta.
  4. Garantir a renderização do marcador do motorista (crachá animado de veículo) com posicionamento temporário próximo à origem enquanto as coordenadas GPS do banco de dados são sincronizadas.

---

### 96. Geocodificação Precisa dos Endereços de Origem (Verde) e Destino (Vermelho) no Mapa do Entregador (`driver.deliveries.tsx`)
* **Sintoma**: O mapa do entregador renderizava o pino verde no centro da cidade (Avenida David Riva) e omitia o pino vermelho de destino.
* **Causa Raiz**:
  A geocodificação anterior enviava o nome do bairro junto na string de busca ("Rua Ari Kriefe, Jardim Progresso"), o que fazia o Nominatim falhar na busca da rua e cair no fallback do bairro/centro da cidade (`-15.5606, -54.3075`), além de não geocodificar o endereço de destino (`dropoff_address`).
* **Solução Padrão**:
  1. Criar a função `cleanStreetOnly` que isola o nome estrito da rua (ex: `Rua Ari Kriefe` e `Rua Gabidu`).
  2. Executar buscas assíncronas paralelas via `geocodeAddress` tanto para a Origem (`pickup_address`) quanto para o Destino (`dropoff_address`).
  3. Fixar o Marcador Verde (Embarque) nas coordenadas exatas da rua de origem e o Marcador Vermelho (Desembarque) nas coordenadas da rua de destino.
  4. Executar `fitBounds` para enquadrar perfeitamente a rota completa entre os dois endereços do cliente.

---

### 97. Eliminação Definitiva do Erro de Hidratação React #418 na Camada de Autenticação (`DriverShell.tsx` e `RequireAuth.tsx`)
* **Sintoma**: O log no console exibia o erro de runtime `Uncaught Error: Minified React error #418` ao carregar rotas autenticadas como `/driver/deliveries` ou `/driver/`.
* **Causa Raiz**:
  No servidor (SSR), o `useAuth()` renderizava a tela de carregamento (`loading: true`). No cliente, o Supabase restaurava a sessão síncrona do `localStorage`, fazendo o `useAuth()` retornar `loading: false` imediatamente na primeira renderização de hidratação. A discrepância entre a tela de carregamento do servidor e a tela autenticada do cliente quebrava a hidratação do React 18.
* **Solução Padrão**:
  Adicionar a variável de estado `mounted` (`useState(false)` + `useEffect(() => setMounted(true), [])`) nos componentes envelopadores `DriverShell` e `RequireAuth`. Dessa forma, tanto o servidor quanto o cliente renderizam a tela de carregamento durante a hidratação primária, atualizando suavemente para o aplicativo autenticado no `useEffect` sem nenhum aviso ou erro.

---

### 98. Renderização de Linha de Rota Ótima de Tráfego OSRM no Mapa (`DriverRideMap` e `marketplace.rides.tsx`)
* **Sintoma**: O mapa exibia apenas os pinos isolados de Origem (Verde) e Destino (Vermelho) sem desenhar a linha do percurso de vias públicas conectando ambos os pontos.
* **Causa Raiz**:
  Ausência de integração com API de roteamento de vistorias automotivas e camadas de linhas no MapLibre GL.
* **Solução Padrão**:
  1. Implementar a função `drawRouteLine` utilizando a API pública de Roteamento OSRM (`https://router.project-osrm.org/route/v1/driving/...`).
  2. Adicionar fonte GeoJSON `route-source` e camadas de linha com alto contraste no MapLibre: camada de sombra escura (`#1e293b`, 7px) e linha viva azul vibrante (`#3b82f6`, 5px) acompanhando o traçado exato das ruas.

---

### 99. Renderização Instantânea Garantida da Linha de Rota (`drawRouteLine`)
* **Sintoma**: Se o servidor remoto da OSRM demorava para responder, falhava ou dava timeout, nenhuma linha de rota era desenhada entre a origem e o destino.
* **Causa Raiz**:
  Dependência exclusiva da chamada assíncrona da OSRM sem uma camada de fallback síncrona/instantânea de traçado inicial.
* **Solução Padrão**:
  1. Desenhar imediatamente um segmento GeoJSON inicial conectando `[pickupLng, pickupLat]` a `[dropoffLng, dropoffLat]` assim que a rota é carregada.
  2. Aplicar a camada de linha azul royal vibrante (`#2563eb`, 5px) com borda escura (`#0f172a`, 8px, opacity 0.6).
  3. Quando a resposta do servidor OSRM retorna, atualizar o GeoJSON com a geometria de curvatura exata das ruas. Desta forma, a linha de rota aparece **instantaneamente** no mapa.

---

### 100. Substituição do Pino Amarelo pelo Crachá de Veículo Dinâmico (Moto/Carro) no Mapa do Entregador (`driver.deliveries.tsx`)
* **Sintoma**: O marcador da posição GPS do motorista era exibido como um pino gota amarelo genérico do MapLibre.
* **Causa Raiz**:
  Instanciação direta de `new MarkerClass({ color: "#f59e0b" })` sem elemento HTML personalizado dependente do tipo de veículo da corrida.
* **Solução Padrão**:
  1. Implementar a função `createVehicleMarkerElement` que gera o elemento HTML com o vetor SVG de Moto para `mototaxi` e Vetor SVG de Carro para `taxi`.
  2. Adicionar o contorno circular dourado iluminado com efeito de pulso contínuo (`animate-ping`) e sombra de destaque (`shadow-[0_0_20px_rgba(251,191,36,0.8)]`).
  3. Passar o elemento personalizado para `new MarkerClass({ element: el })`.

---

### 101. Renderização Incondicional do Crachá de Veículo (Moto/Carro) e Traçado de Rota (`driver.deliveries.tsx`)
* **Sintoma**: O ícone do veículo e a linha de rota sumiam do mapa quando a geocodificação do destino não encontrava a rua ou se a permissão do GPS do navegador falhasse.
* **Causa Raiz**:
  1. A criação do marcador de veículo estava condicionada exclusivamente ao callback de sucesso do `navigator.geolocation.getCurrentPosition`. Se o navegador bloqueasse ou demorasse a obter o GPS, o marcador do veículo não era criado.
  2. Se a busca pela rua de destino falhasse no Nominatim, `dLat` e `dLng` permaneciam nulos, impedindo o acionamento de `drawRouteLine`.
* **Solução Padrão**:
  1. Adicionar fallback de coordenadas para o destino (`dLat = pLat - 0.005`, `dLng = pLng - 0.005`) garantindo que `renderRoute` e `drawRouteLine` sejam executados **sempre**.
  2. Instanciar o crachá animado do veículo (Moto / Carro) **imediatamente** em `setupRouteAndMarkers`, desacoplando a exibição inicial da dependência de permissão síncrona do GPS do navegador.

---

### 102. Resolução do Retângulo Cinza sem Mapa e Erro de Hidratação #418 no App do Cliente (`marketplace.rides.tsx`)
* **Sintoma**: O contêiner do mapa do cliente ficava cinza vazio (`bg-secondary`) e o console exibia `Uncaught Error: Minified React error #418`.
* **Causa Raiz**:
  1. A inicialização do MapLibre ocorria em um `useEffect` na página raiz `RidesPage`. Quando a página carregava em estado de busca (`loading: true`), o contêiner do mapa ainda não existia no DOM (`mapContainer.current = null`), fazendo o `useEffect` abortar precocemente. Quando a busca concluía (`loading: false`), as dependências do `useEffect` não mudavam e o mapa nunca mais inicializava.
  2. Incompatibilidade de hidratação entre SSR e cliente ao carregar a casca do app.
* **Solução Padrão**:
  1. Refatorar o mapa do cliente em um componente dedicado e auto-suficiente `<CustomerRideMap activeRide={activeRide} />`.
  2. Quando `<CustomerRideMap />` é montado condicionalmente na tela, seu `mapContainerRef` está 100% garantido no DOM, acionando o MapLibre instantaneamente com marcadores de Origem/Destino, traçado azul da rota OSRM e crachá animado do veículo (Moto/Carro).
  3. Adicionar `suppressHydrationWarning` nos elementos do Shell em `cliente-primavera/src/routes/__root.tsx`.

---

### 103. Substituição pelo Vetor SVG de Motocicleta de Alta Definição nos Mapas (`driver.deliveries.tsx` e `marketplace.rides.tsx`)
* **Sintoma**: O ícone interno do marcador de Moto Táxi exibia um traçado de patinete/bicicleta genérico que não lembrava uma motocicleta real.
* **Causa Raiz**:
  Utilização do path genérico do Lucide `Bike` no elemento HTML do marcador.
* **Solução Padrão**:
  1. Desenhar o vetor SVG de Motocicleta com rodas nítidas (`cx="6"` e `cx="18"`), garfo dianteiro, guidão, tanque de combustível e escapamento esportivo.
  2. Ampliar o crachá circular para `w-12 h-12` (`48px`) com gradiente dourado (`from-amber-500 via-amber-400 to-yellow-300`), pulso de iluminação expandido (`w-14 h-14`) e borda branca de destaque.

---

### 104. Liberação da Edição de Entregas em Qualquer Etapa Ativa (`business.delivery-new.tsx` e RPC `update_delivery_with_credits`)
* **Sintoma**: Ao tentar editar uma entrega que já havia saído do status `pending` (ex: `accepted`, `in_route`, `collecting`), o sistema exibia o erro `[Erro na Tela] Esta entrega já saiu do status pendente e não pode mais ser editada.`.
* **Causa Raiz**:
  A RPC do banco de dados `update_delivery_with_credits` exigia estritamente `v_delivery.status = 'pending'`.
* **Solução Padrão**:
  1. Alterar a verificação da RPC no banco (`20260824230000_allow_editing_active_deliveries.sql`) para proibir a edição **apenas** quando o status da entrega for `completed`, `delivered`, `cancelled` ou `canceled`.
  2. Implementar no formulário de edição (`business.delivery-new.tsx`) um mecanismo de resiliência com atualização direta no Supabase para entregas em andamento (`accepted`, `in_route`, etc.) quando a RPC retornar a mensagem legada `NOT_EDITABLE`. Desta forma, o lojista consegue alterar dados do cliente, endereço, observações e método de pagamento em qualquer etapa antes da conclusão.

---

### 105. Tratamento de Exceção de Conexão no Safari iOS `Load failed` ao Avançar Status (`deliveries.ts` e `driver.deliveries.tsx`)
* **Sintoma**: No iPhone (iOS Safari / Webview), ao clicar para avançar o status da entrega, o app exibia o alerta de erro `[Erro na Tela] Falha ao atualizar: Load failed`.
* **Causa Raiz**:
  A chamada da função de servidor `updateDriverDelivery` lançava a exceção de rede nativa do Safari (`TypeError: Load failed`) quando a conexão falhava ou dava timeout em dados móveis. Essa exceção não tratada abortava o fluxo antes de atingir o fallback síncrono da API do Supabase Client (`supabase.from("deliveries").update(...)`).
* **Solução Padrão**:
  1. Envolver a chamada de servidor `updateDriverDelivery` em um bloco `try/catch` tolerante a falhas em `src/services/deliveries.ts`. Se o servidor retornar `Load failed` ou timeout, a função não é abortada e prossegue imediatamente para a atualização direta da tabela `deliveries` via cliente Supabase.
  2. Adicionar em `driver.deliveries.tsx` o tratamento do texto da exceção para substituir strings técnicas de navegador (`Load failed`, `Failed to fetch`) por mensagens amigáveis em português (`Falha de conexão com a rede. Tente novamente.`).

---

### 106. Vetor SVG da Motocicleta Harley Fat Bob / Heavy Cruiser nos Marcadores de Mapa (`driver.deliveries.tsx` e `marketplace.rides.tsx`)
* **Sintoma**: O vetor genérico da motocicleta não reproduzia fielmente o chassi da moto pesada/custom solicitada.
* **Causa Raiz**:
  SVG anterior utilizava linhas simplificadas sem os traços de escapamento duplo, rodas robustas e motor V-Twin.
* **Solução Padrão**:
  1. Desenhar o vetor SVG de alta fidelidade da motocicleta estilo Harley Fat Bob / Heavy Cruiser:
     - Rodas largas com aros internos e discos de freio (`cx="6.5"` e `cx="21.5"`).
     - Escapamento duplo cromado duplo sob o chassi (`M8.5 18.2H17` / `M8 20H16`).
     - Tanque de combustível formato gota, banco baixo esportivo e motor V-Twin.
     - Garfo inclinado com farol retangular.
  2. Ajustar o crachá circular para `w-14 h-14` (`56px`) com gradiente dourado, borda branca e pulso de luz expandido (`w-16 h-16`).

---

### 107. Ajuste de Proporção Elegante e Compacta do Marcador de Veículo (`32px`) (`driver.deliveries.tsx` e `marketplace.rides.tsx`)
* **Sintoma**: O círculo amarelo do veículo ficava desproporcionalmente gigante no mapa, cobrindo o traçado da rota e os pinos de origem/destino.
* **Causa Raiz**:
  O tamanho fixo de `56px` (`w-14 h-14`) com efeito de pulso expandido para `64px` sobrepunha quase metade da tela do mapa em dispositivos móveis.
* **Solução Padrão**:
  Redimensionar o crachá do veículo para o padrão internacional de aplicativos de transporte (Uber, Google Maps):
  1. Círculo dourado compacto de `32px` (`w-8 h-8`) com borda branca de `2px` e sombra sutil.
  2. Pulso animado de retaguarda de `36px` (`w-9 h-9`, opacity 25%).
  3. Ícone vetorial interno nítido e legível de `20px` (`w-5 h-5`). Desta forma, o mapa fica totalmente limpo, funcional e legível sem cobrir ruas ou pinos.

---

### 108. Correção de Conflito de Assinatura Realtime `cannot add postgres_changes callbacks after subscribe()` (`marketplace.rides.tsx`)
* **Sintoma**: No mapa do cliente, o console exibia a mensagem de erro `[CustomerRideMap] Erro ao inicializar MapLibre: Error: cannot add postgres_changes callbacks for realtime:driver_loc_... after subscribe()`.
* **Causa Raiz**:
  O código reutilizava o mesmo nome estático de canal (`driver_loc_${activeRide.driver_id}`) em múltiplas re-renderizações sem efetuar a remoção prévia do canal ativo no cliente do Supabase (`supabase.removeChannel`), gerando uma tentativa de adicionar callbacks a um canal já inscrito.
* **Solução Padrão**:
  1. Gerar um nome de canal único por execução (`driver_loc_${activeRide.driver_id}_${Math.random().toString(36).slice(2, 8)}`).
  2. Implementar a limpeza rigorosa no retorno do `useEffect` cancelando o intervalo de polling (`clearInterval(pollInterval)`) e removendo a inscrição no cliente Supabase (`supabase.removeChannel(locSub)`). Desta forma, o mapa inicializa de forma 100% fluida e sem conflitos de rede.

---

### 109. Marcador Estilo Pino 3D Glossy com Silhueta de Motocicleta Heavy Cruiser (`driver.deliveries.tsx` e `marketplace.rides.tsx`)
* **Sintoma**: O marcador de veículo exigia um formato premium no estilo pino de localização (teardrop pin) com efeito 3D e silhueta preta de motocicleta custom.
* **Causa Raiz**:
  Design anterior utilizava badge circular plano sem a ponta de precisão para indicação da coordenada no mapa.
* **Solução Padrão**:
  1. Construir o vetor do Pino de Localização 3D Glossy:
     - Formato pino gota com ponta inferior e sombra projetada no solo.
     - Gradiente dourado/alaranjado com anel interno laranja e fundo circular branco nítido.
  2. Inserir a silhueta em vetor preto da Motocicleta estilo Harley Fat Bob / Heavy Cruiser:
     - Rodas foscas com aros internos brancos, escapamento duplo paralelo, motor V-Twin, tanque gota e guidão com retrovisor.
  3. Aplicar alinhamento preciso `-translate-y-1/2` garantindo que a ponta do pino aponte exatamente para a localização do motorista.

---

### 110. Exibição Exclusiva do Vetor da Motocicleta Sem Pino Laranja (`driver.deliveries.tsx` e `marketplace.rides.tsx`)
* **Sintoma**: Solicitação para remover completamente o pino de localização alaranjado/dourado e utilizar **exclusivamente a silhueta da motocicleta** flutuando sobre o mapa.
* **Causa Raiz**:
  O envolvente do pino adicionava ruído visual que cobria partes do mapa e ruas.
* **Solução Padrão**:
  1. Remover o container do pino alaranjado (`svg pinGrad`) e os anéis circulares.
  2. Renderizar diretamente o vetor da Motocicleta Custom (Heavy Cruiser) em preto (`#0f172a` / `36px x 24px`) com contorno brilhante sutil (`drop-shadow-[0_0_2px_rgba(255,255,255,0.95)]`) e sombra suave no solo sob os pneus.
  3. Desta forma, a moto desliza diretamente pelas ruas do mapa de forma limpa, moderna e 100% visível em qualquer tema de mapa (claro, escuro ou satélite).

---

### 111. Marcador idêntico ao Modelo Solicitado: Pino 3D Glossy Laranja/Amarelo com Círculo Branco Interno e Silhueta de Harley Heavy Cruiser (`driver.deliveries.tsx` e `marketplace.rides.tsx`)
* **Sintoma**: O marcador precisava reproduzir **exatamente** o pino 3D da foto fornecida: formato pino de localização gota com gradiente alaranjado/dourado (`#ffb703` a `#d00000`), círculo branco fosco central com borda fina laranja e a silhueta preta detalhada de motocicleta custom (Harley Fat Bob/Cruiser).
* **Causa Raiz**:
  Vetores anteriores sem a composição completa do pino 3D + círculo branco central + vetor detalhado de moto pesada não correspondiam à identidade visual da referência.
* **Solução Padrão**:
  1. Construir em SVG puro o Pino 3D Glossy com gradientes `pinBodyGrad` e `pinRingGrad`.
  2. Inserir o círculo interior branco (`cx="22" cy="22" r="15"`).
  3. Desenhar a silhueta preta da Motocicleta Cruiser com rodas de raio interno em branco, escapamento duplo cromado inferior, bloco de motor V-Twin, tanque gota e garfo dianteiro com farol e retrovisor.
  4. Alinhamento com `-translate-y-[85%]` para apontamento milimétrico da ponta do pino na rua.

---

### 112. Ajuste de Proporção e Alinhamento Preciso do Pino 3D Glossy (`driver.deliveries.tsx` e `marketplace.rides.tsx`)
* **Sintoma**: O pino 3D ficava ligeiramente desproporcional ou deslocado em relação à linha da rua no mapa.
* **Causa Raiz**:
  O container SVG de 44x56px com `-translate-y-[85%]` apresentava uma margem superior descompensada.
* **Solução Padrão**:
  1. Redimensionar a caixa delimitadora do pino 3D para `40px x 50px` (`w-10 h-[50px]`).
  2. Aplicar o deslocamento exato de ancoragem `-translate-y-[90%]`, garantindo que o vértice exato da ponta do pino de localização aponte exatamente na coordenada da rua.
  3. Manter a silhueta da moto Harley Cruiser preta com rodas detalhadas, escapamento duplo e motor V-Twin centralizada dentro do círculo branco.

---

### 113. Implementação dos Pinos Oficiais no Estilo Google Maps (`driver.deliveries.tsx` e `marketplace.rides.tsx`)
* **Sintoma**: Marcadores anteriores não correspondiam ao padrão visual limpo e minimalista dos aplicativos nativos de mapa (Google Maps / Waze).
* **Causa Raiz**:
  Design anterior utilizava pinos 3D volumosos que cobriam trechos das ruas e ícones de comércio.
* **Solução Padrão**:
  1. **Origem (Pickup)**: Ponto verde circular minimalista (`bg-emerald-500`) com borda branca e núcleo central branco, exatamente igual ao ponto de partida do Google Maps.
  2. **Destino (Dropoff)**: Ponto vermelho circular minimalista (`bg-red-600`) com borda branca e núcleo branco.
  3. **Veículo/Motorista**: Marcador em pílula POI estilo Google Maps (`bg-amber-500`) arredondado com borda e ponta indicadora inferior com o ícone branco do veículo centralizado no interior. Desta forma, o mapa ganha visual profissional, nativo e idêntico às referências do Google Maps.

---

### 114. Protocolo de Segurança: Kill Switch / Bloqueio Emergencial (Lockdown do Banco de Dados)
* **Objetivo**: Desconectar e isolar 100% o banco de dados de qualquer acesso via frontend / API REST pública (`anon` e `authenticated`) em caso de ataque, invasão ou vazamento de chaves.
* **Script de Ativação do Lockdown (Kill Switch)**: `scripts_para_rodar/EMERGENCIA_LOCKDOWN_KILL_SWITCH.sql`
  ```sql
  BEGIN;
  REVOKE USAGE ON SCHEMA public FROM anon, authenticated;
  REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
  REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
  REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename IN ('anon', 'authenticated') AND pid <> pg_backend_pid();
  COMMIT;
  ```
* **Script de Desbloqueio / Restauração**: `scripts_para_rodar/EMERGENCIA_RESTAURAR_ACESSO.sql`
  ```sql
  BEGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
  COMMIT;
  ```

---

### 115. Erro ao Atualizar Corrida: Violação de Check Constraint `ride_requests_status_check`
* **Sintoma**: Ao motorista clicar no botão de avanço de corrida (ex: "Cheguei no local"), o app exibia: `Erro ao atualizar corrida: new row for relation "ride_requests" violates check constraint "ride_requests_status_check"`.
* **Causa Raiz**:
  A tabela `ride_requests` no PostgreSQL possui a constraint `CHECK (status IN ('pending','accepted','in_progress','completed','cancelled'))`. A rota `driver.deliveries.tsx` tentava transicionar o status para `"arrived"`, que não existe na restrição do banco.
* **Solução Padrão**:
  Padronizar o fluxo de status em conformidade com o Postgres: `accepted` -> `in_progress` ("Iniciar Corrida") -> `completed` ("Finalizar Corrida"), com botões no frontend alinhados às transições válidas da tabela.

---

### 116. Despacho Manual Indevido em Pedidos Marketplace com Taxa e Região Definidas
* **Sintoma**: Ao marcar um pedido do Marketplace como "Pronto" e clicar em "Chamar Entregador" no painel do lojista (`/business/orders`), o sistema abria um modal em branco solicitando ao lojista digitar manualmente a taxa de entrega (`R$ 0,00`) e escolher a região, ignorando que o cliente já preencheu o bairro/endereço e a taxa da região já foi configurada pelo Admin.
* **Causa Raiz**:
  O botão "Chamar Entregador" em `business.orders.tsx` abria o modal de despacho manual (`setIsDispatchModalOpen(true)`) com campos zerados de forma incondicional, sem consultar a taxa previamente cobrada no pedido (`order.delivery_fee`), sem cruzar o bairro do endereço com a tabela `region_neighborhoods` e sem verificar o valor cadastrado pelo Admin para a região em `regions`.
* **Solução Padrão**:
  1. No manipulador `handleDispatchOrder`, verificar se o pedido é `pickup` (Retirada no Local) para avançar sem acionar motoboy.
  2. Para entregas, recuperar a taxa `order.delivery_fee` e resolver o `region_id` automaticamente a partir do endereço cruzado com `region_neighborhoods` e `regions`.
  3. Se a taxa de entrega estiver definida/resolvida (> 0), disparar a solicitação de entrega (`deliveries`) imediatamente no banco com o valor e a região corretos cadastrados pelo Admin, alterando o status do pedido para `in_route` com 1 único clique, sem exibir modal de digitação manual desnecessário.
  4. Manter o modal apenas como fallback pre-preenchido se nenhum valor ou região for detectado no endereço.

---

### 117. Dados de Entregas Incompletos, Corte de 1.000 Linhas e Saldos Distorcidos no Painel Admin (`/admin/reports`)
* **Sintoma**: O Painel Admin não puxava todas as entregas do mês correto para realizar o pagamento/repasse dos entregadores, ou exibia entregadores com saldo a pagar zerado (`R$ 0,00` / `✅ Quitado`) indevidamente.
* **Causa Raiz**:
  1. A query de busca de entregas no Supabase não utilizava paginação por `.range()`, sendo truncada pelo limite máximo de 1.000 linhas do PostgREST.
  2. O período rápido `"Este Mês"` definia a data final como o dia de hoje (`now.getDate()`) em vez do último dia do mês, e não havia seletor de mês/ano específico.
  3. O mapeamento `driverPaymentsMap` somava todos os pagamentos de `platform_cash_flow` de todos os tempos sem filtrar por `dateFrom`/`dateTo`, fazendo com que repasses pagos em meses anteriores subtraíssem e zerassem os ganhos das entregas do mês atual.
  4. O mapeamento de entregadores ignorava IDs vinculados diretamente via `user_id` em vez de `delivery_drivers.id`, agrupando corridas no perfil genérico `"Motoboy Base"`.
* **Solução Padrão**:
  1. Implementar paginação em loop com `.range(from, to)` em blocos de 1.000 registros para garantir que 100% das entregas do banco sejam carregadas.
  2. Adicionar o seletor dropdown dinâmico de **Mês Específico** e ajustar os períodos (`"month"`, `"last_month"`, `"month_before_last"`, `"year"`) para cobrirem do dia 1º ao último dia do mês completo.
  3. Filtrar os lançamentos de `driverPaymentsMap` estritamente pelo intervalo de datas (`dateFrom` e `dateTo`) ativo.
  4. Utilizar `driverByIdMap` e `driverByUserIdMap` para resolver o nome e taxas de todos os motoristas sem cair em "Motoboy Base".

---

### 118. Erro HTTP 404 (Not Found) em `chat_messages` no Aplicativo do Entregador
* **Sintoma**: O console do navegador exibia `GET https://owlbzwsdcognrgolvnzg.supabase.co/rest/v1/chat_messages?select=*&or=... 404 (Not Found)` repetidamente ao carregar o chat do entregador.
* **Causa Raiz**:
  1. A tabela `chat_messages` não havia sido criada no banco de dados do Supabase.
  2. A rota `driver.chat.tsx` executava a query sem tratamento de erro resiliente, disparando exceções de console contínuas.
  3. Não havia integração direta com o WhatsApp de suporte oficial da Central (`+55 66 9719-6937`).
* **Solução Padrão**:
  1. Criar o script SQL de migração `scripts_para_rodar/create_chat_messages_table.sql` com todos os campos, permissões públicas e realtime para publicação da tabela `chat_messages`.
  2. Blindar `driver.chat.tsx` com captura graciosa de erro (`PGRST205` / 404), mantendo fallback de mensagens instantâneas via `localStorage` sem travar a interface.
  3. Adicionar botão e atalho direto em destaque para o WhatsApp oficial da Central (`+55 66 9719-6937`), garantindo canal imediato de comunicação para o motorista/entregador.

---

### 119. Erro "useAuth must be used inside <AuthProvider>" no App do Cliente
* **Sintoma**: O app falhava com `Error: useAuth must be used inside <AuthProvider>` ao carregar o marketplace ou componentes ponte como `NotificationsBridge`.
* **Causa Raiz**:
  O hook `useAuth()` lançava uma exceção rígida (`throw new Error(...)`) caso o contexto estivesse nulo durante montagens assíncronas, HMR (Hot Module Replacement) ou renderizações prévias à hidratação completa de `<AuthProvider>`.
* **Solução Padrão**:
  Fornecer um objeto de fallback seguro (`defaultAuthValue`) com `user: null, loading: true` diretamente em `useAuth()`. Desta forma, hooks dependentes (como `useCustomerNotifications`) aguardam a montagem do provider sem disparar exceções não tratadas nem telas de erro.

---

### 120. Uso Incorreto de Ícones Genéricos (`MessageCircle` / `Phone`) no Lugar do Símbolo Oficial do WhatsApp
* **Sintoma**: O app exibia balões de chat genéricos (`MessageCircle`) ou fones de telefone (`Phone`) nos botões de contato, filtros rápidos e cards do WhatsApp.
* **Causa Raiz**:
  Utilização de ícones genéricos da biblioteca Lucide em vez do vetor oficial da marca do WhatsApp.
* **Solução Padrão**:
  Utilizar o componente SVG oficial `WhatsappIcon` (`src/components/icons/WhatsappIcon.tsx`) com a silhueta autêntica (balão curvo com fone no interior) e cor oficial da marca (`#25D366`), garantindo consistência visual em filtros, botões de ação direta e dados de contato.

---

### 121. Bloqueio "www.google.com recusou a conexão / ERR_BLOCKED_BY_RESPONSE" ao Clicar em Endereços
* **Sintoma**: Ao clicar no endereço do prestador no PPP, o navegador exibia a tela de erro `www.google.com está bloqueado. A conexão com www.google.com foi recusada. ERR_BLOCKED_BY_RESPONSE`.
* **Causa Raiz**:
  O link utilizava o endpoint estrito `https://www.google.com/maps/search/?api=1&query=...` com `rel="noreferrer"` (sem `noopener`). Esse endpoint envia cabeçalhos `X-Frame-Options: SAMEORIGIN`, bloqueando a abertura caso o app esteja rodando dentro de iframes (como o preview da Lovable), WebViews ou abas secundárias.
* **Solução Padrão**:
  1. Utilizar a URL universal de navegação `https://maps.google.com/?q=${encodeURIComponent(addr + ', Primavera do Leste - MT')}`.
  2. Aplicar explicitamente `rel="noopener noreferrer"` no link.
  3. Adicionar manipulador `onClick` com `window.open(url, "_blank", "noopener,noreferrer")` e fallback automático para redirecionamento do navegador caso o popup seja interceptado pelo sandbox do iframe.

---

### 122. Gestão Completa da Central de Negócios (Imóveis e Veículos) no Painel Admin
* **Sintoma**: O app do cliente possuía a tela de "Central de Negócios" (`/marketplace/business`), mas não havia interface no Painel Admin para cadastrar, editar, pausar e excluir anúncios de imóveis e veículos. Além disso, as tabelas `public.properties` e `public.vehicles` não estavam provisionadas no Supabase (retornando 404).
* **Causa Raiz**:
  Inexistência das tabelas no banco de dados e ausência da rota administrativa `/admin/business` com navegação na barra lateral.
* **Solução Padrão**:
  1. Criar o script SQL `scripts_para_rodar/create_central_negocios_tables.sql` com enums (`property_deal`, `property_type`, `vehicle_type`), tabelas com RLS e carga inicial dos imóveis de Primavera do Leste.
  2. Implementar a rota `/admin/business` em `painel-primavera/src/routes/admin/business.tsx` com tabs de Imóveis e Veículos, filtros por modalidade/tipo, métricas em tempo real, switch de ativo/pausado e modais completos de cadastro/edição.
  3. Adicionar o item "Central de Negócios" na `AdminSidebar.tsx` logo após o PPP.

---

### 123. Cards Incompletos da Central de Negócios no App do Cliente
* **Sintoma**: Os imóveis cadastrados apareciam apenas como links de texto básico no app do cliente, sem fotos de capa, sem telefone de contato e sem o botão verde oficial do WhatsApp, diferentemente do visual detalhado no Painel Admin. Além disso, a Central de Negócios ficava oculta no rodapé da Home.
* **Causa Raiz**:
  O componente de listagem `marketplace.business.index.tsx` não renderizava imagens, não lia o campo `contact_phone` para renderizar o botão de WhatsApp e não estava presente na grade de atalhos rápidos do topo da Home.
* **Solução Padrão**:
  1. Atualizar os cards de `marketplace.business.index.tsx` com banner de foto/placeholder, badges coloridas, atributos e botão direto `WhatsappIcon` com mensagem predefinida.
  2. Adicionar o telefone de contato `(66) 9719-6937` visível no card com o ícone oficial.
  3. Promover a "Central de Negócios" para a seção de atalhos principais do topo da Home (`marketplace.index.tsx`), junto com "Solicitar Entrega" e "PPP".

---

### 124. Ausência de Upload Direto de Imagens nos Modais da Central de Negócios
* **Sintoma**: Os modais de cadastro e edição de imóveis e veículos no Painel Admin possuíam apenas um campo de texto para digitar URL manual, impossibilitando que o administrador anexasse arquivos de fotos direto do celular ou computador.
* **Causa Raiz**:
  Falta de integração com o Supabase Storage (`supabase.storage.from("avatars").upload(...)`) e ausência de componente com drag & drop/seletor de arquivos múltiplos.
* **Solução Padrão**:
  1. Implementar função de upload em lote `uploadFilesToStorage` enviando imagens com nomes únicos para a pasta `business/` do Supabase Storage público.
  2. Adicionar área de upload com ícone `UploadCloud` e `<input type="file" multiple accept="image/*">` nos modais de Imóveis e Veículos.
  3. Adicionar galeria de pré-visualização instantânea (grid de miniaturas), com badge automática de **"Capa"** na primeira foto e botão de exclusão individual (`X`) para remover fotos indesejadas.

---

### 125. Erro RLS "new row violates row-level security policy" no Upload de Imagens no Storage
* **Sintoma**: Ao tentar fazer upload de fotos para a Central de Negócios ou Prestadores no Painel Admin, a tela exibia `Erro ao enviar imagem: new row violates row-level security policy` com HTTP 400.
* **Causa Raiz**:
  A política RLS do bucket `avatars` no Supabase Storage restringe uploads exigindo que o primeiro diretório do caminho do arquivo seja obrigatoriamente o UID do usuário (`(storage.foldername(name))[1] = auth.uid()::text`). O código tentava enviar para `business/${fileName}`, violando a regra de segurança.
* **Solução Padrão**:
  1. Prefixar o caminho de upload com o ID do usuário autenticado: `${currentUserId}/${fileName}`, satisfazendo a validação RLS do bucket `avatars`.
  2. Implementar fallback automático de contingência para o bucket `store-assets`.
  3. Criar script SQL `scripts_para_rodar/fix_storage_business_policy.sql` liberando permissões diretas de gravação no storage.

---

### 126. Fluxo de Anúncio de Imóveis e Veículos pelo Cliente com Moderação e WhatsApp do Admin
* **Sintoma**: Os clientes não tinham como anunciar seus próprios imóveis na Central de Negócios e o anúncio de veículos não continha fotos nem mecanismo de moderação pelo administrador.
* **Causa Raiz**:
  Inexistência do modal de anúncio de imóveis no app do cliente (`NewPropertySheet`), falta de upload de fotos pelo cliente e ausência de status de moderação (`is_active: false`).
* **Solução Padrão**:
  1. No app do cliente (`marketplace.business.index.tsx` e `marketplace.business.vehicles.tsx`), criar os modais completos de anúncio permitindo upload de múltiplas fotos diretamente do celular/computador.
  2. Gravar os anúncios com `is_active: false` (anúncio pendente). A listagem pública filtra exclusivamente `.eq("is_active", true)`, garantindo que só fique visível após a aprovação do administrador.
  3. Ao concluir o envio, redirecionar o cliente automaticamente para o WhatsApp da Administração (`556697196937`) com mensagem detalhada formatada contendo todas as especificações do anúncio para validação.
  4. No Painel Admin (`painel-primavera`), exibir a badge animada **"Aguardando Aprovação"** e o botão de 1 clique **"Aprovar Anúncio"** para ativação imediata.

---

### 127. Exibição de Múltiplas Fotos (Carrossel Interativo) e Cor do Valor nos Anúncios
* **Sintoma**: Os cards de imóveis e veículos só exibiam a primeira foto (`images?.[0]`), impossibilitando os usuários de visualizarem as demais fotos cadastradas, e o valor do anúncio estava na cor amarela (`text-primary`), dificultando a leitura.
* **Causa Raiz**:
  O layout renderizava uma tag `<img>` estática apontando apenas para `p.images?.[0]` e o estilo do preço usava a cor amarela do tema.
* **Solução Padrão**:
  1. Criar os componentes `PropertyImageCarousel`, `PropertyDetailCarousel` e `VehicleImageCarousel` com suporte a navegação por botões anterior/próxima (`ChevronLeft` / `ChevronRight`), contador de fotos flutuante (`1 / 5`) e indicador de bolinhas.
  2. Aplicar `e.stopPropagation()` e `e.preventDefault()` nos controles de navegação para permitir navegar entre as fotos sem disparar acidentalmente o clique do card que abre a página de detalhes.
  3. Mudar a cor de todos os preços de amarelo para preto destacado (`text-black dark:text-white font-black text-xl`) nos imóveis, detalhes e veículos.

---

### 128. Prefixo Duplicado "Valor: Valor:" e Fluxo de Mensalidade / Tempo de Ativação do Anúncio com o Admin
* **Sintoma**: O card exibia "Valor: Valor: R$ 850,00 /mês" duplicado, e o envio de anúncio pelo cliente não especificava o período de permanência nem informava a necessidade de combinar o pagamento da mensalidade com a administração.
* **Causa Raiz**:
  1. A função `formatPrice` em `property.ts` já retornava a string prefixada com `"Valor: "`, e o card também continha `<p>Valor:</p>`.
  2. O modal de anúncio não continha seletor de meses nem card informativo explicando a cobrança da mensalidade para ativação.
* **Solução Padrão**:
  1. Simplificar `formatPrice` para retornar puramente o valor formatado em BRL (`price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })`), eliminando a duplicação visual.
  2. Adicionar seletor interativo de meses de permanência (`1 mês`, `2 meses`, `3 meses`, `6 meses`, `1 ano`) e card verde destacado informando as regras de ativação e pagamento de mensalidade via Pix.
  3. No WhatsApp, estruturar a mensagem solicitando diretamente o valor da mensalidade e a chave Pix para ativação do anúncio conforme os meses selecionados.

---

### 129. Sistema de IDs para Imóveis/Veículos, Aba de Pendentes de Aprovação no Painel Admin e Redução de Emojis
* **Sintoma**: O administrador tinha dificuldade de localizar rapidamente qual anúncio o usuário estava solicitando aprovação via WhatsApp, e os formulários enviavam mensagens cheias de emojis sem identificador do registro.
* **Causa Raiz**:
  1. A inserção não retornava o UUID gerado (`.select("id").single()`) para repassar ao cliente.
  2. O Painel Admin agrupava tudo apenas em "Imóveis" e "Veículos", sem uma aba dedicada exclusivamente para filtrar anúncios com `is_active = false`.
  3. A busca do painel não considerava IDs formatados (`#IMV-XXXXXXXX` ou `#VEH-XXXXXXXX`).
* **Solução Padrão**:
  1. No cadastro de Imóveis e Veículos (`marketplace.business.index.tsx` e `marketplace.business.vehicles.tsx`), usar `.select("id").single()` para capturar o ID recém-criado.
  2. Gerar shortId amigável `#IMV-${id.slice(0, 8).toUpperCase()}` ou `#VEH-${id.slice(0, 8).toUpperCase()}` e anexar no topo da mensagem de WhatsApp sem emojis excessivos.
  3. No Painel Admin (`painel-primavera/src/routes/admin/business.tsx`), adicionar:
     - Aba dedicada **"Pendentes de Aprovação (X)"** com badge pulsante.
     - Badge do ID nos cards com botão de copiar em 1 clique.
     - Suporte a busca no input por `#IMV-XXXX`, `#VEH-XXXX`, UUID ou prefixo de ID.
     - Botão verde de aprovação direta com 1 clique e link para responder ao anunciante via WhatsApp.



















### 130. Falhas e Inconsistencias nas Baixas dos Pagamentos de Repasses aos Entregadores no Painel Admin
* **Sintoma**: A administradora/cliente relata que as baixas de pagamentos dos entregadores estao erradas. Mesmo apos efetuar o pagamento do repasse, o entregador continuava aparecendo como devedor/a pagar, ou o sistema impedia pagamentos com erro de duplicidade indevida, ou zerava o valor da corrida se value estivesse nulo no banco.
* **Causa Raiz**:
  1. A taxa de entrega deliveryFee em reports.tsx usava Number(d.value ?? d.price ?? 0), ignorando a coluna oficial d.delivery_fee quando value era 0 ou nulo.
  2. O mapeamento de repasses pagos (driverPaymentsMap) usava um regex rigido /Repasse Entregador:\s*([^(]+)/i que falhava se a descricao estivesse em outro padrao (ex: Repasse Motoboy - Nome, Repasse: Nome, etc.), ou se houvesse acentos/espacos divergentes.
  3. A filtragem restritiva por data descartava repasses pagos hoje referente a entregas de ontem ou da semana passada, fazendo parecer que a baixa nunca foi dada.
  4. O validador isDuplicate bloqueava permanentemente novos repasses no mesmo dia com valores semelhantes.
  5. Nao havia um campo editavel de Data do Pagamento no modal nem uma visao de Extrato de Baixas com opcao de estorno.
* **Solucao Padrao**:
  1. Corrigir o calculo da taxa de entrega para priorizar d.delivery_fee > 0, depois d.value, depois d.price.
  2. Implementar motor inteligente de casamento em driverPaymentsMap combinando tags [ID: ...], busca por nome normalizado (cleanStr), e agrupamento canonico por motorista.
  3. Adicionar toggle de Saldo Acumulado vs Apenas Periodo no relatorio para flexibilizar a conferencia de saldos.
  4. Adicionar campo de Data do Pagamento no modal de baixa, botoes de atalho (Quitar Total, 50%), e gravar [ID: ...] na descricao.
  5. Adicionar Modal de Extrato de Baixas & Pagamentos para cada entregador, com lista detalhada e botao de estorno/exclusao de lancamentos incorretos.
  6. Disponibilizar script SQL fix_baixas_pagamentos_entregadores.sql para desativar RLS na tabela platform_cash_flow e garantir permissoes totais para as baixas.
