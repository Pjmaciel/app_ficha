# Ficha Kitai

Aplicativo web (PWA, somente front-end) para a ficha do Alexsander Somar III, substituindo a planilha.

## Modelo e regras

O modelo (versão 2), o motor de regras e as decisões de importação estão em `docs/contrato-modelo-v2.md` e `docs/contrato-modelo.md`. Os dados iniciais em `src/data/alexsander.json` vêm da planilha correta (`test/fixtures/alexsander-somar-iii.xlsx`, nível 41); o importador de `.xlsx` reproduz esse JSON exatamente. Fichas salvas na versão 1 são migradas automaticamente para a versão 2 (`migrarFicha`). O rolador de dados foi removido do escopo.

## Aba Batalha

É a primeira aba e abre por padrão: reúne, em uma tela só, o card "Minha rodada" (PV com dano e cura rápidos, fadiga, rolagem base, arma, usos por dia com botão Usar e Descansar), os ataques (normal, Golpe Devastador com pressão e usos, ações de Tsu real e outras), as defesas, as absorções e proteções, o guia "Quando for atacado" e os lembretes. Os valores vêm de `resumoBatalha` no motor. As ações, as reações e os lembretes são editados na aba Poderes, na seção "Textos da batalha"; cada poder tem a marca "Mostrar na aba Batalha" (padrão ligado para defensivos e itens). Nessa aba o painel de sessão do topo fica oculto, porque o card "Minha rodada" faz o mesmo papel. Detalhes em `docs/batalha-requisitos.md` e `docs/contrato-modelo.md`.

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
