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

## Escopo atual

O frontend inclui login e cadastro restrito por convite, protegendo a visão geral. Conteúdo de estudo ainda será implementado nas próximas etapas.
