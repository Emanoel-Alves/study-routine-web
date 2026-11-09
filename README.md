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

O cadastro é privado e exige o código de convite configurado na API. Tokens de acesso duram uma hora e ficam somente na memória da página; ao recarregar ou fechar o navegador, será necessário entrar novamente. Não salve tokens em `localStorage` ou no bundle público.

## Conteúdo de estudo

Na página **Conteúdo**, você pode criar e editar disciplinas, arquivá-las e reativá-las, organizar tópicos por disciplina, mudar o estado e a ordem dos tópicos e salvar anotações gerais ou específicas. Materiais aceitam links externos HTTP(S), texto ou ambos. Remoções pedem confirmação e informam que dados associados também serão removidos.

A busca considera disciplinas e tópicos sem diferenciar maiúsculas, minúsculas ou acentos. Os filtros de estado do tópico e tipo de material podem ser combinados e ajustados independentemente. Os dados são persistidos pela API; o site precisa de conexão para carregar e salvar alterações.

O progresso da disciplina é a proporção de tópicos no estado **Estudado** em relação ao total de tópicos. Tópicos em **Revisão pendente** continuam fora da contagem de concluídos até que o estado seja atualizado.

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

Na página **Planejamento**, configure os dias e minutos disponíveis e uma data-alvo opcional. O plano semanal distribui tópicos pendentes, indica o que não coube na capacidade e permite ajustes manuais. Registre sessões de estudo ou revisão para atualizar o progresso; o histórico e os dados permanecem na API.

## PWA e uso offline

A aplicação oferece manifest, ícones e service worker para instalação e abertura do shell estático sem conexão. O cache contém apenas os arquivos públicos versionados da interface; respostas da API, dados de estudo e credenciais não são armazenados offline. Login, leitura e gravação exigem conexão com a API. A primeira abertura precisa de conexão para instalar o shell; use HTTPS ou `localhost` para os recursos PWA. A instalação é oferecida pelo navegador quando disponível.

O layout adapta navegação, formulários e painéis para celular, tablet e desktop. Quando o navegador informa que o dispositivo está offline, a aplicação exibe um aviso de que os dados não podem ser consultados ou alterados.
