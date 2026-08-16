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

### 27. Subdomínio Inexistente `app.mt24horasexpress.com` no Marketplace do Cliente
* **Sintoma**: "Não foi possível encontrar o endereço IP do servidor de app.mt24horasexpress.com".
* **Causa Raiz**: O código do app do cliente (`cliente-primavera`) redirecionava para o subdomínio `app.mt24horasexpress.com`, que não possui entrada DNS configurada no servidor.
* **Solução Padrão**:
  Corrigir o redirecionamento em `src/routes/__root.tsx` para apontar para o domínio oficial ativo **`https://www.mt24horasexpress.com`**.

