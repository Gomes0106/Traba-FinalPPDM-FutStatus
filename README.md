# Futebol 

Aplicativo Expo com as telas originais de Início, Partidas e Tabela. O visual e os textos foram preservados.

## Executar

1. Instale as dependências com npm install.
2. Copie .env.example para .env e preencha EXPO_PUBLIC_FOOTBALL_DATA_TOKEN com seu token de https://www.football-data.org/.
3. Execute npm start (ou npm run android, npm run ios, npm run web).

O .env é ignorado pelo Git. Tokens EXPO_PUBLIC_ ficam incluídos no aplicativo: use esta configuração apenas para desenvolvimento; para distribuir o app com uma chave privada, faça as consultas por um backend que guarde o token.

## Comportamento

- Início mantém o destaque original do Brasileirão e mostra os dados dessa competição.
- Partidas e Tabela compartilham o campeonato selecionado.
- A navegação usa Expo Router; as rotas ficam em src/app/.
- As consultas antigas são canceladas ao trocar de campeonato ou atualizar.
- O intervalo de datas usa o calendário local e é recalculado ao atualizar ou mudar o dia.
- Sem token, o aplicativo informa como configurar a API, sem inventar partidas.

## Verificações

- npm run lint
- npm run typecheck


## Expo SDK 58

O projeto usa Expo SDK 58. Utilize Node.js 22.13 ou superior na linha 22, 24.3 ou superior na linha 24, ou Node.js 26 ou superior.

Após atualizar, encerre o servidor anterior e execute npm.cmd start -- --clear no PowerShell. No celular, utilize Expo Go compatível com SDK 58; instalações antigas para SDK 54 não abrem este projeto.

A versão web continua usando saída single (SPA). As áreas seguras usam CSS no navegador e react-native-safe-area-context no Android/iOS. O conteúdo e as cores das telas foram preservados.
