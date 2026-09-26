# Ficha Kitai

Aplicativo web (PWA, somente front-end) para a ficha do Alexsander Somar III, substituindo a planilha.

## Modelo e regras

O modelo (versão 2), o motor de regras e as decisões de importação estão em `docs/contrato-modelo-v2.md` e `docs/contrato-modelo.md`. Os dados iniciais em `src/data/alexsander.json` vêm da planilha correta (`test/fixtures/alexsander-somar-iii.xlsx`, nível 41); o importador de `.xlsx` reproduz esse JSON exatamente. Fichas salvas na versão 1 são migradas automaticamente para a versão 2 (`migrarFicha`). O rolador de dados foi removido do escopo.

## Poderes com escala por nível

Cada poder pode ter uma `escala` (`EscalaPoder`): bônus por nível de ataque e defesa (por chave de combate), dano fixo, atributo, PV, usos por dia, fiéis e dados do golpe. O motor multiplica cada coeficiente pelo nível do poder e soma o resultado às fontes manuais; subir o nível na aba Poderes recalcula combate, dano, Força, PV e usos. As parcelas derivadas aparecem, sem edição, com o nome do poder e "nível N" nas abas Combate, Atributos e Identidade, e na composição de cada valor (origem, nível e coeficiente); as fontes manuais (como "Outros") continuam editáveis. As escalas dos poderes conhecidos vêm do livro (`src/model/escalas-padrao.ts`); onde a planilha diverge, a migração guarda uma fonte manual "Ajuste do mestre (poder)" para manter os totais. Fichas salvas antes da escala são migradas ao carregar, sem mudar nenhum total. Detalhes em `docs/poderes-escala-requisitos.md` e `docs/contrato-modelo.md`.

## Efeitos, patamares, pilar e textos vivos

Além das parcelas de combate, cada poder pode ter `efeitos` (valor = fixo + por ponto × ⌊nível ÷ a cada⌋: alcance, absorção, criaturas protegidas, anti-mental etc.) e `patamares` (ex.: Proteção Divina no nível 3 passa a reduzir a Tsu real). Os textos da aba Batalha (reações, lembretes, ações) e as descrições usam marcadores como `{poder.protecao_divina.raio_km2}`, `{poder.golpe_devastador.nivel}` e `{soma:lugan_completo.anti_mental+protecao_divina.anti_mental}`, resolvidos na hora de exibir: ao subir um poder, tudo o que o cita muda junto, e a edição mostra o texto cru e uma prévia resolvida. O card de absorção de cada poder é gerado dos efeitos no nível atual, com os patamares atingidos e o próximo. Um poder pode exigir um pilar mínimo (`requerPilar`), com alerta quando o pilar atual for menor. A Proteção Divina está no nível 2 (a planilha traz 1), com PV total 3904.

## Pilar com escala

O pilar lugânico (`Ficha.pilar`: nome, nível de 1 a 5, pacote de poderes por nível, efeitos e textos) sobe e desce na aba Identidade, exibido como "Justiça 3". Subir concede de novo o pacote do livro (Lugan Completo 2, Proteção Divina 1, Campeão do Combate Divino 2, O Filho de Hagashi 4, Lugan da Batalha 1, Força das Montanhas Divinas 1, Golpe Devastador 1, Manipulador de Tsu Real 1, Fogo Real 2) e todas as escalas recalculam; descer o retira, sem deixar nenhum poder abaixo de 0. O nível de cada poder é derivado: pontos próprios (editáveis) + pontos do pilar, mostrados na aba Poderes como "próprios N + pilar M = total". A ficha atual é Justiça 3 com nível aplicado 3, então nenhum valor mudou; do 3 para o 4, por exemplo, a Proteção Divina vai a 3 (PV 4404, 3 usos, passa a reduzir a Tsu real) e o Filho de Hagashi a 8 (64.000 fiéis). A aba Batalha traz o card "Pilar da Justiça nível N" com Jikar, Ancestrais, Proteção do Dragão Vermelho (teste calculado, "2400 + 1d×400" no nível 3) e os redutores de −400 e −2 por 5 h, com marcadores vivos `{pilar.nivel}` e `{pilar.<efeito>}`. A revisão dos dados embutidos é 5. Detalhes em `docs/pilar-requisitos.md` e `docs/contrato-modelo.md`.

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
