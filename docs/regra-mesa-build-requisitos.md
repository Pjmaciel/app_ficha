# Requisito — Regra da mesa: pilar informativo e build livre (nó N)

Decisão do mestre (2026-09-29): o pilar NÃO concede poderes adicionais. Esta regra substitui os nós L e M.

## Regra
- Não multiplicar poderes pelo nível do pilar; não aplicar pacote do pilar; remover `pacotePorNivel`, `valorBasePilar` e toda a lógica de pacote/multiplicação do motor, dos dados e da interface.
- O pilar fica apenas informativo/narrativo: nome "Justiça" e nível (3) exibidos, editáveis, sem efeito nos poderes. Os efeitos narrativos do pilar (Ancestrais, Proteção do Dragão Vermelho) podem continuar como texto informativo no card do pilar.
- nível final do poder = nível informado manualmente (pontos livres). Origem: 'livre' | 'item' | 'manual'.

## Build atual do Alexsander
Poderes ativos (origem livre):
| Poder | Nível | Tipo | Efeito no nível |
|---|---:|---|---|
| Campeão do Combate Divino | 3 | passivo | +210 ataque com Jikar, +210 defesa com Jikar, +60 dano físico (70/70/20 por ponto) |
| Lugan da Batalha | 1 | passivo | +50 ataque, +50 defesa, +20 dano final (por ponto) |
| Proteção Divina | 2 | defesa/recurso | 2 rodadas/dia de imunidade total; +1000 PV; absorve 400 em área (200 por ponto); protege 10 km²; 200 criaturas (2 barras de CD e +15 em ataque, defesa e perícias); +300 contra efeitos mentais divinos; não reduz Tsu real (só a partir do nível 3) |
Item: Portador da Jikar (origem item): +3d×100 em ataque e defesa; +1d no dano; inimigos só 1 ataque contra o portador; mentira, ilusão e invisibilidade não afetam; contra vários inimigos só metade ataca; aliados divinos em 3 km +250 ataque/defesa/dano; não divinos +100; retorna pela vontade do dono.

Todos os demais poderes (Velocidade Divina, Golpe Devastador de Lugan "por enquanto", Lugan Completo, Força das Montanhas Divinas, O Filho de Hagashi, Manipulador de Tsu Real, Fogo Real) ficam com tipo 'removido' (mantidos no histórico, fora dos cálculos, dos usos por dia e da Batalha, com botão para reativar). Golpe Especial: Competência não existe.

## Combate (parcelas vindas dos poderes)
- Campeão do Combate Divino aplica somente a ataques e defesas com a Jikar (ataque arma branca e aparar) e ao dano físico.
- Lugan da Batalha aplica a qualquer ataque e defesa e ao dano final.
- Remover as fontes manuais "Outros" (120/70/120) e quaisquer outras fontes sem origem em poder ou item; o jogador pode adicionar ajustes manuais liberados pelo mestre na aba Combate.
- Jikar: +3 dados extras (×100) em ataque arma branca, aparar, bloquear e esquivar; +1d no dano.
- Oráculos esperados (conferir): Força 262 (47 + 215, sem Força das Montanhas); PV 2904 + 1000 = 3904; ataque arma branca 5d×100 +868 (espada 608 + 260); aparar 5d×100 +884 (608 − 152 + 165 + 3 + 260); bloquear 5d×100 +661 (escudo 608 + 3 + 50); esquivar 5d×100 +260 (reflexos 207 + 3 + 50); ataque luta 2d×100 +458; ataque arma de fogo 2d×100 +458; ataque mágico 2d×100 +551; dano básico 3d×262 +80.

## Aba Batalha (painel principal)
Topo: nome, pilar "Justiça" (informativo), item principal Jikar, rótulo de build "Defesa com Jikar", PV (base 2904 + 1000 da Proteção Divina), "Proteção Divina: 2 / 2 rodadas disponíveis".
Cards: ataque normal com Jikar (rolagem base + 3d×100 da Jikar + bônus fixo +260; dano base + 1d da Jikar + 80, com composição); defesa com Jikar (aparar com +260), bloquear e esquivar com valores finais; card destacado Proteção Divina 2 com usos 2/2 e todos os efeitos listados acima, incluindo "Não reduz Tsu real no nível 2"; card permanente da Jikar com todos os lembretes; usos por dia; lembretes. Mostrar PV atual e máximo, PV base, PV extra, fadiga, rolagem base.

## Validações (alertas no topo do app, função pura validarFicha(f) com testes)
Alertar se: o pilar estiver adicionando poderes ou existir cálculo de pacote; Golpe Especial: Competência estiver ativo; Proteção Divina ativa sem PV extra; Jikar sem +3d×100 em ataque/defesa ou sem +1d no dano; o painel de Batalha não estiver usando os bônus de Campeão do Combate Divino e Lugan da Batalha.

## Migração
Incrementar `revisaoDados`; fichas salvas com pacote/multiplicação são convertidas para a build acima (o aviso "Carregar nova" já existente cobre o navegador do jogador). Remover testes do pacote do pilar e reescrever os oráculos conforme acima.
