# Requisito — Poderes do Pilar × nível + pontos livres (nó M)

Decisão do jogador (2026-09-29), com base no livro MAIS GLÓRIA E MAIS PODER, p. 102, pilar da Justiça: "um senhor da justiça recebe alguns poderes quando assume os salões da justiça, e cada vez que o pilar sobe em um nível, estes poderes são concedidos novamente e estes são adicionais, o Lugan continua ganhando pontos de poder com sua evolução pessoal."

## Regra (substitui pontosProprios/nivelAplicado do nó L)
nível final do poder = (valorBasePilar × nível do pilar) + pontosLivres

- Poderes do pilar: valorBasePilar vem do pacote do pilar; multiplica pelo nível do pilar (1 a 5).
- Pontos livres: evolução, bônus, realocação ou recompensa; somam por fora e NÃO multiplicam.
- Remover `nivelAplicado`; `Poder.pontosProprios` vira `pontosLivres` (migração: pontosLivres = valor do seed abaixo, não o nível antigo).

## Estrutura por poder
nome, valorBasePilar, pontosLivres, nivel (derivado = total calculado), origem: 'pilar' | 'livre' | 'item' | 'manual', tipo: 'passivo' | 'ativo' | 'defesa' | 'item' | 'recurso' (migrar 'defensivo' → 'defesa'; 'removido' continua existindo como estado).

## Semente (pilar Justiça 3)
| Poder | Base pilar | Livres | Total |
|---|---:|---:|---:|
| Lugan Completo | 2 | 0 | 6 |
| Proteção Divina | 1 | 1 | 4 |
| Campeão do Combate Divino | 2 | 0 | 6 |
| O Filho de Hagashi | 4 | 0 | 12 |
| Lugan da Batalha | 1 | 2 | 5 |
| Força das Montanhas Divinas | 1 | 0 | 3 |
| Golpe Devastador de Lugan | 1 | 0 | 3 |
| Manipulação de Tsu Real | 1 | 0 | 3 |
| Fogo Real | 2 | 0 | 6 |
| Velocidade Divina (origem livre) | 0 | 2 | 2 |
| Portador da Jikar (origem item) | — | — | — |

## Ajustes de coeficiente
- Remover as fontes manuais "Ajuste do mestre" criadas para bater os níveis antigos da planilha (Campeão −70/−70/−20, Lugan Completo +30/+30/+10 e similares): com os níveis corretos, vale o coeficiente do livro por ponto. Manter a fonte manual "Outros" (120/70/120) que já existia nos bônus passivos, editável, e listá-la no relatório para validação com o mestre.
- Todos os totais (combate, dano, Força, PV, usos, efeitos, patamares, textos vivos) recalculam a partir dos novos níveis; incrementar `revisaoDados` para o navegador oferecer "Carregar nova".

## Interface
- Aba Poderes e cards da Batalha mostram a composição de cada poder, por exemplo:
  "Lugan da Batalha 5 — Pilar: 1 × 3 = 3 · Poderes livres: +2 · Total: 5".
- Campos editáveis: valor base do pilar (no pacote) e pontos livres por poder; nível do pilar com subir/descer na aba Identidade (já existe).
- Aba Batalha continua como painel principal e deve exibir: PV atual e máximo (base + Proteção Divina com a parcela explícita), fadiga, rolagem base, ataque normal com Jikar e dano, Golpe Devastador com ataque, dano e usos restantes, defesas (aparar, bloquear, esquivar), card da Proteção Divina com nível calculado, rodadas de imunidade, PV extra, absorção em área, criaturas protegidas, bônus contra efeito mental divino e se já reduz Tsu real (no nível 4 sim, com 1d), card da Jikar, usos por dia e lembretes.

## Testes (oráculos novos, calculados pelas escalas do livro)
- Níveis finais conforme a tabela; pilar 3→4 soma o pacote (Lugan Completo 8, Proteção Divina 5, Campeão 8, Filho de Hagashi 16, Lugan da Batalha 6...); pilar 3→2 retira; livres não mudam com o pilar.
- PV total = 242 × 12 + 500 × 4 = 4904; Proteção Divina 4: usos 4, imunidade 4 rodadas, raio 20 km², criaturas 400, anti-mental 600, reduz Tsu real com 1d (patamar 3 atingido; próximo: nível 6, 1d+1).
- Força = 47 + 215 + 60 × 3 = 442; dano usa a Força nova no multiplicador.
- Os demais totais de combate devem ser asseridos a partir da soma das escalas, e o worker deve listar no relatório os valores finais de ataque arma branca, mágico, luta, arma de fogo, aparar, bloquear, esquivar e dano básico.
