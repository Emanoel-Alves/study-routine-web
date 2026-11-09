# Study Routine Web

Aplicação web responsiva do Study Routine, feita com Vue 3, TypeScript e Vite.

## Requisitos

- Node.js 24 ou superior
- npm
- API Study Routine em execução

## Desenvolvimento local

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

O Vite inicia em `http://localhost:5173`. Configure `VITE_API_URL` no `.env` para apontar à API. O valor local padrão é `http://localhost:3000`.

## Autenticação

O cadastro é privado e exige o código de convite configurado na API. Tokens de acesso duram uma hora e ficam somente na memória da página. A API mantém a sessão por até 30 dias em um cookie `HttpOnly`, `Secure` em produção, e emite um novo token de acesso ao recarregar; nenhum token ou dado pessoal de autenticação é salvo em `localStorage`. O navegador precisa aceitar cookies entre sites para manter a sessão no GitHub Pages e no Render.

## Conteúdo de estudo

Na página **Conteúdo**, você pode criar e editar disciplinas, arquivá-las e reativá-las, organizar tópicos por disciplina, mudar o estado e a ordem dos tópicos e salvar anotações gerais ou específicas. Adicione materiais à disciplina ou diretamente ao tópico selecionado; links e referências associados aparecem junto ao tópico e na lista de materiais da disciplina. Materiais aceitam links externos HTTP(S), texto ou ambos. Remoções pedem confirmação e informam que dados associados também serão removidos.

A busca considera disciplinas e tópicos sem diferenciar maiúsculas, minúsculas ou acentos. Os filtros de estado do tópico e tipo de material podem ser combinados e ajustados independentemente. Os dados são persistidos pela API; o site precisa de conexão para carregar e salvar alterações.

O progresso da disciplina é a proporção de tópicos no estado **Estudado** em relação ao total de tópicos. Tópicos em **Revisão pendente** continuam fora da contagem de concluídos até que o estado seja atualizado.

## Banco de questões

Em **Questões**, adicione uma questão autorizada ou um resumo próprio, vincule-a a um tópico e registre alternativas, gabarito, explicação, banca, concurso, cargo, ano, número e link da fonte. Ao resolver, marque uma alternativa e confira a resposta; o gabarito e a explicação cadastrada aparecem depois da correção. A tesourinha elimina/restaura alternativas durante a tentativa. Questões anuladas ou desatualizadas ficam identificadas e fora da lista padrão de prática. Links do QConcursos e de outras fontes são guardados como referências e abertos no site original; a aplicação não importa nem copia o conteúdo dessas plataformas.

## Verificações

```powershell
npm run lint
npm run format:check
npm test
npm run build
npm run preview
```

## Publicação

O workflow `.github/workflows/deploy-pages.yml` publica automaticamente a branch `main` no GitHub Pages depois de executar lint, formatação, testes e build. Usa navegação por hash para que atualização e links diretos funcionem no Pages.

1. Crie o repositório GitHub `study-routine-web` e envie a branch `main`.
2. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
3. Em **Settings → Secrets and variables → Actions → Variables**, adicione `VITE_API_URL` com a URL HTTPS pública do serviço Render, sem `/` no final (por exemplo, `https://study-routine-api.onrender.com`).
4. Execute o workflow **Deploy to GitHub Pages** em **Actions** ou envie um novo commit para `main`.
5. O endereço será `https://<usuario>.github.io/study-routine-web/`.

O site do Pages é público, mesmo quando o código-fonte estiver em um repositório privado. Em contas GitHub Free, a publicação do Pages requer um repositório público. Não coloque segredos no frontend: `VITE_API_URL` é uma variável pública incorporada ao bundle.

## Planejamento

Na página **Planejamento**, configure os dias e minutos disponíveis e uma data-alvo opcional. O plano semanal distribui tópicos pendentes, indica o que não coube na capacidade e permite ajustes manuais. O cronômetro pode ser iniciado, pausado, retomado e finalizado; a sessão só é enviada à API ao finalizar e conserva os segundos medidos. O resumo soma o tempo real sem arredondar cada sessão curta para um minuto; sessões manuais continuam registradas em minutos. Se o envio falhar, o cronômetro fica pausado para tentar novamente.

A visão geral apresenta um resumo do plano da semana atual, o progresso geral e as revisões pendentes. O MVP usa planejamento semanal (não uma grade mensal); a semana completa e seus ajustes ficam na página **Planejamento**.

## PWA e uso offline

A aplicação oferece manifest, ícones e service worker para instalação e abertura do shell estático sem conexão. O cache contém apenas os arquivos públicos versionados da interface; respostas da API, dados de estudo e credenciais não são armazenados offline. Login, leitura e gravação exigem conexão com a API. A primeira abertura precisa de conexão para instalar o shell; use HTTPS ou `localhost` para os recursos PWA. A instalação é oferecida pelo navegador quando disponível.

O layout adapta navegação, formulários e painéis para celular, tablet e desktop. Quando o navegador informa que o dispositivo está offline, a aplicação exibe um aviso de que os dados não podem ser consultados ou alterados.

## Validação de publicação e rollback

Após cada publicação, confirme:

1. A página inicial e o acesso direto a `https://emanoel-alves.github.io/study-routine-web/#/login` respondem por HTTPS.
2. O manifest e os ícones carregam em `/study-routine-web/manifest.webmanifest`, `/study-routine-web/icon-192.png` e `/study-routine-web/icon-512.png`.
3. A API responde em `GET /api/health`; preflight CORS para `PATCH` deve autorizar apenas a origem configurada do Pages.
4. Com uma conta de teste autorizada, entre, crie disciplina e tópico, configure a disponibilidade, consulte o planejamento, recarregue e confira a persistência. Remova os dados de teste ao final.
5. Se o navegador suportar instalação, verifique a opção de instalar. Depois de carregar o aplicativo ao menos uma vez, teste que o shell abre offline e que a interface deixa claro que login, leitura e gravação precisam de conexão. O cache não deve conter respostas da API nem dados pessoais.

Sem uma conta de teste autorizada, não tente contornar o convite nem use dados pessoais. Login e gravação em produção devem ser verificados pelo responsável pela conta.

Para reverter uma publicação, crie um commit `git revert <commit>` e envie-o a `main`; o pipeline valida e publica novamente. Evite editar artefatos diretamente no GitHub Pages ou reescrever o histórico. O serviço de API pode demorar a responder depois de períodos sem uso, conforme os limites do plano Render; o banco, custos e retenção de backup são administrados separadamente no MongoDB Atlas.
