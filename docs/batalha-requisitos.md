# Requisito UX — Aba "Batalha" (nó H do Raio 3)

Origem: pedido do jogador em 2026-09-26. Fonte numérica: planilha correta (nível 41, Proteção Divina 1 com +500 PV, ataque arma branca 1078, aparar 1094, bloquear 941, esquivar 540). Onde a anotação do jogador citava Proteção Divina 2 / +1000 / 1028, prevalece a planilha; todos os campos continuam editáveis.

Objetivo: durante a luta o jogador não consulta a ficha, ele lê ações prontas em uma única tela, sem alternar entre Atributos, Combate, Poderes e Tsu.

## Conteúdo da aba Batalha (primeira aba, aberta por padrão)
1. Card "Minha rodada" (fixo no topo da aba): PV atual/total, fadiga, rolagem base Nd×100, arma principal, usos restantes dos poderes com usosPorDia (Proteção Divina, Golpe Devastador etc.), Velocidade Divina nível.
2. Ataques: um card por ação com o cálculo pronto e botão de uso quando houver limite por dia:
   - Ataque normal com a arma: "5d×100 +1078" e dano "3d×322 +120 + fiéis" (fiéis calculados pelo campo).
   - Golpe Devastador: "8d×100 +1078", dano "5d×322 +120 + fiéis", pressão (8 km² por ponto = 24 km²), usos restantes, botão Usar.
   - Ações de Tsu real e outras ações livres, editáveis: lista `acoes` na ficha com nome, rolagem em texto e notas (semente: "Terra Real: 1d×48 direto no PV"; "Fogo Real: 400 de dano por rodada em 2 km²; contra divinos ataques diretos +200").
3. Defesas: Aparar, Bloquear, Esquivar com dados e total ("5d×100 +1094", "5d×100 +941", "2d×100 +540").
4. Absorções e proteções: cards gerados dos poderes de tipo `defensivo` e `item` mais os passivos marcados como "mostrar na batalha" (Proteção Divina, Lugan Completo, Portador da Jikar), com a descrição do poder.
5. "Quando for atacado": guia de reação fixo, editável como lista de lembretes, semente:
   - Ataque físico/mágico normal: Aparar ou Bloquear (valores ao lado).
   - Dano absurdo/divino: Proteção Divina, imune 1 rodada por dia.
   - Efeito mental divino: somar bônus de Lugan Completo (+200) e Proteção Divina (+150).
   - Ilusão, mentira ou invisibilidade: a Jikar nega.
   - Área contra aliados/cenário: Proteção Divina absorve 200; Filho de Hagashi protege os fiéis.
6. Lembretes: lista editável `lembretes` na ficha, semente: Jikar +3d×100 em ataque e defesa; Jikar +1d no dano; inimigos só fazem 1 ataque contra você; contra grupo só metade ataca; ilusão, mentira e invisibilidade não funcionam; Proteção Divina 1 rodada por dia de imunidade; Golpe Devastador 3 pontos; Terra Real 1d×48 direto no PV.
7. Usos por dia: somente poderes com usosPorDia ou custoFadiga e tipo diferente de removido; botão Usar decrementa e botão Descansar restaura.

## Modelo
- `Ficha.acoes: { id; nome; rolagem: string; notas: string }[]` e `Ficha.lembretes: string[]` e `Ficha.reacoes: { situacao: string; resposta: string }[]`, todos editáveis na aba Poderes ou em uma seção "Textos da batalha".
- `Poder.mostrarNaBatalha?: boolean` (padrão true para defensivo e item).
- Golpe Devastador: `usosPorDia` = nível (3) no poder correspondente; o card do golpe usa esse contador.
