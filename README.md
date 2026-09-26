# Ficha Kitai

Aplicativo web (PWA, somente front-end) para a ficha do Alexsander Somar III, substituindo a planilha.

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
