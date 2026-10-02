# Requisito — Evolução por nível divino conforme o livro (nó O)

Decisão do jogador (2026-10-02): "usa o que está no livro". Fonte: MAIS GLÓRIA E MAIS PODER, p. 31 (tabela de XP soberana e divina, até o nível 40) e p. 74 a 77 (atributos, perícias, rolagem, PV e dano divinos).

## Regras do livro
- Rolagem divina: 1d×100 no nível 31, +1 dado a cada 10 níveis divinos (41 → 2d, 51 → 3d). Já implementado em dadosPorNivel.
- Por nível divino: +10 em 4 atributos à escolha do jogador; diferença entre maior e menor atributo não pode passar de 120 sem bônus (já existe diferencaAtributos).
- Nível par: +4 em todas as perícias (graduação). Nível ímpar: +1 ponto de poder (registrar como "pontos de poder disponíveis" para o jogador gastar na aba Poderes).
- PV = Fortitude × 12 (já implementado), recuperado por completo em uma hora (lembrete).
- XP: a tabela do livro (até o nível 40) é ACUMULADA; o custo de cada nível é a diferença: 32→33 20, 33→34 20, 34→35 20, 35→36 30, 36→37 30, 37→38 40, 38→39 50, 39→40 50. Acima do 40 o livro não define: usar 50 por nível (último degrau da tabela), editável e rotulado "extrapolação da tabela do livro, confirme com o mestre". O jogador confirma que subia com 20 e 30 de XP.
- "Nível lugânico" (planilha) não existe no livro: manter como campo informativo.

## Modelo
- `Ficha.regras.xpProximoNivel: number` (50) e `Ficha.regras.incrementoXpPorNivel: number` (0, editável; a tabela sobe de 10 em 10 a cada dois níveis, mas acima do 40 não há dado), ambos editáveis.
- `Ficha.pontosDePoderDisponiveis: number` (0).
- `Ficha.xp.atual` é o XP acumulado para o próximo nível; `xp.total` o histórico.
- Substituir a regra atual de subirNivel ("+4 em todos os bônus por nível") pela do livro: `subirNivel(f, { atributos: [4 ids distintos] })` aplica +10 em cada um dos 4 atributos escolhidos (no campo bonusNivel), +4 em todas as perícias se o novo nível for par, +1 em pontosDePoderDisponiveis se for ímpar, incrementa nivel, desconta xpProximoNivel do xp.atual (sem ficar negativo) e soma incrementoXpPorNivel em xpProximoNivel. Manter uma opção "regra da planilha (+4 em todos)" selecionável em regras, padrão livro.
- bonusNivelEsperado/alertaBonusNivel: desativar o alerta quando a regra do livro estiver ativa (os atributos deixam de subir uniformemente), ou recalcular a expectativa com base no histórico; o mais simples é só alertar na regra da planilha.

## Interface (aba Identidade, seção "Níveis e experiência")
- Barra "XP: 62 / 50 para o nível 42 (extrapolação; confirme com o mestre)", com campos editáveis de custo e incremento.
- Botão "Subir de nível" habilitado quando xp.atual ≥ xpProximoNivel (com confirmação para forçar quando não atingir): abre a escolha de 4 atributos (checkboxes, exatamente 4), mostra a prévia dos ganhos (+10 nos 4, +4 em perícias se par, +1 ponto de poder se ímpar) e aplica.
- Mostrar "Pontos de poder disponíveis: N" na aba Poderes e na Identidade; ao aumentar o nível de um poder livre, oferecer descontar 1 ponto disponível (sem bloquear).
- Lembrete na Batalha: "PV se recupera por completo em 1 hora".

## Testes
- subirNivel na regra do livro a partir da ficha embutida (nível 41, XP 62 ≥ 50, habilitado): nível 42, +10 em quatro atributos escolhidos, +4 em todas as perícias (par), pontos de poder inalterados; nível 43 em seguida: perícias inalteradas e +1 ponto de poder; xp.atual 62 → 12 após subir para 42; xpProximoNivel permanece 50 com incremento 0; xp.atual nunca negativo; erro se não forem 4 atributos distintos.
- Regra da planilha continua testada (+4 em todos).
- PV e combate recalculam com os atributos novos.
