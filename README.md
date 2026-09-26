# Ficha Kitai

Aplicativo web (PWA, somente front-end) para a ficha do Alexsander Somar III, substituindo a planilha.

## Modelo e regras

O modelo (versão 2), o motor de regras e as decisões de importação estão em `docs/contrato-modelo-v2.md` e `docs/contrato-modelo.md`. Os dados iniciais em `src/data/alexsander.json` vêm da planilha correta (`test/fixtures/alexsander-somar-iii.xlsx`, nível 41); o importador de `.xlsx` reproduz esse JSON exatamente. Fichas salvas na versão 1 são migradas automaticamente para a versão 2 (`migrarFicha`). O rolador de dados foi removido do escopo.

## Rodar

```sh
npm install
npm run dev
```

## Testar

```sh
npm test
```

## Construir e publicar

```sh
npm run build
```

A publicação é automática: a cada envio para a branch `main`, o fluxo `.github/workflows/deploy.yml` executa os testes, gera `dist` e publica no GitHub Pages (habilite Pages com a fonte "GitHub Actions" nas configurações do repositório). Para outro caminho de publicação, defina `VITE_BASE` (padrão `/app_ficha/`), por exemplo `VITE_BASE=/ npm run build`.
