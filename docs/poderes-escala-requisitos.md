# Requisito — Poderes com escala por nível (nó I do Raio 3)

Dor: ao subir um poder durante a narrativa, a ficha não muda; as parcelas de combate, Força, PV e usos são números copiados. O jogador precisa que aumentar o nível de um poder recalcule a ficha.

## Modelo
- `Poder.escala?: { ataque?: Fonte-like por chave; ... }` simplificado em:
```ts
export interface EscalaPoder {
  ataquePorNivel?: Partial<Record<ChaveCombate, number>>; // bônus por nível em cada chave de combate
  danoPorNivel?: number;              // parcela fixa no dano
  atributoPorNivel?: { atributo: AtributoId; valor: number };
  pvPorNivel?: number;
  usosPorNivel?: number;              // usosPorDia = usosPorNivel * nivel
  fieisPorNivel?: number;             // informativo
  dadosAtaquePorNivel?: number;       // golpes: dados extras de ataque
  dadosDanoPorNivel?: number;
}
Poder.escala?: EscalaPoder;
Fonte.poderId?: string;               // parcela derivada de poder; recalculada, não editável diretamente
```
- Parcelas derivadas: o motor gera as fontes de combate, dano, atributo e PV a partir dos poderes com `escala` e nível; as fontes manuais (sem poderId, ex.: "Outros 120") continuam editáveis e são somadas.
- Semente (valores da planilha, coeficiente = valor atual / nível): Lugan da Batalha (3): ataque e defesa 50/nível em todas as chaves, dano 20/nível. Campeão do Combate Divino (3): 140/140/40 no nível 3 (coeficiente 46,67 não é inteiro; semear como valorNoNivelAtual com escala linear a partir do livro 70/70/20 por nível e manter parcela manual de ajuste para bater 140). Decisão: usar `porNivel` do livro (70/70/20) e uma fonte manual "Ajuste do mestre" negativa (−70/−70/−20) para bater a planilha. Lugan Completo (1): 60/60/20 por nível (planilha). Força das Montanhas Divinas (1): Força +60 por nível. Proteção Divina (1): PV +500 por nível, usos 1 por nível. Golpe Devastador (3): dadosAtaque +1 por nível, dadosDano... a planilha diz 4d×100 ataque e 3d×100 dano no nível 3 e o jogador usa +3/+2; semear +1 dado de ataque por nível e dadosDano = nível − 1 (usar campo fixo no golpe, editável). Filho de Hagashi (4): fiéis 8.000 por nível (informativo). Manipulador de Tsu Real (1): ataqueMagico +70 por nível. Velocidade Divina: sem escala numérica (texto).
- O importador não muda; a migração adiciona `escala` aos poderes conhecidos por id e converte as fontes correspondentes em derivadas, preservando os totais atuais (teste: totais de combate 1078/781/688/688/540/941/1094, Força 322, PV 3404 permanecem iguais após a migração).

## Interface
- Na aba Poderes, o nível é um campo numérico; ao mudar, todos os totais recalculam. Cada poder mostra a sua escala editável (ataque/defesa/dano/atributo/PV/usos por nível).
- Nas parcelas de combate, atributos e PV, as fontes derivadas aparecem com o nome do poder e o rótulo "nível N" e não são editáveis ali; as manuais continuam editáveis.
- A composição (botão) mostra origem, nível e coeficiente.

## Escalas extraídas do livro (obrigatório usar como semente; ver docs/livro-poderes.md para o texto integral)
Regra geral: a escala é por ponto (nível) do poder, salvo indicação. Quando a planilha do jogador diverge do livro, semear o coeficiente do livro e uma fonte manual "Ajuste do mestre" para que os totais atuais da planilha sejam preservados; ambos editáveis.
- Lugan da Batalha (nível 3): +50 ataque e +50 defesa por ponto em todas as chaves; +20 no dano por ponto; pressão 1 km² por ponto. Planilha: 150/150/60 (bate).
- Força das Montanhas Divinas (1): +60 Força por ponto; raio 2 km² por ponto; terremoto em linha de 500 m por 4 km² por ponto.
- Lugan Completo (1): livro +30 ataque/defesa e +10 dano por ponto, 1 ação extra a cada 3 pontos, voo 140 km/h por ponto a 3.000 m, pressão 500 m por ponto, +100 contra efeitos mentais divinos por ponto, 1d×1.000 seguidores. Planilha usa 60/60/20 e voo 280 km/h no nível 1: semear livro e ajuste do mestre (+30/+30/+10).
- Velocidade Divina (2): 1 ação de velocidade por ponto contra Lugan; 3 ações extras por rodada contra não lugânicos; +50 de ataque e defesa por ponto de diferença sobre o oponente, máximo 3 ações extras; 220 km/h por ponto; patamar nível 4: teleporte de até 2.000 km por ponto. Sem parcela numérica automática na ficha, apenas texto por patamar.
- Proteção Divina (1): 1 rodada de imunidade total por dia por ponto (usosPorDia = nível); +500 PV por ponto; +1 na rolagem de vigor lugânico a cada 2 níveis; patamares contra Tsu real: níveis 1 e 2 não reduzem Tsu real, nível 3 rola 1d para reduzir, nível 6 rola 1d+1, nível 9 rola 1d+2; absorve 200 no cenário e em todos os envolvidos; raio 5 km² por ponto; protege 100 criaturas por ponto (2 barras de CD e +15 em ataque, defesa e perícias); +150 contra efeitos mentais divinos por nível. A interface deve mostrar os patamares atingidos e o próximo patamar (ex.: "nível 3: passa a reduzir Tsu real").
- Campeão do Combate Divino (3): livro +70 ataque e +70 defesa com a arma escolhida e +20 no dano físico (texto não diz "por ponto"; pressão 2 km² por ponto). Planilha: 140/140/40 no nível 3. Semear como 70/70/20 por ponto com ajuste do mestre −70/−70/−20, marcando a divergência para validação com o mestre.
- Golpe Devastador de Lugan (3): por ponto, +2d no ataque e +1d no dano (livro: com 1 ponto joga 3d×100 ataque e 2d×100 dano); planilha nível 3: 4d×100 ataque e 3d×100 dano; uso do jogador: +3d ataque (8d) e +2d dano (5d). Semear dados extras de ataque = nível e dados extras de dano = nível − 1 (editáveis), usos por dia = nível, custo alternativo 1.600 PV sem pontos, pressão 8 km² por ponto e dano ×2 em área, raio 500 m.
- O Filho de Hagashi (4): proteção territorial 350 por ponto em 25 km por ponto do reino; 8.000 hagashianos fiéis por ponto; fiéis recebem +12 ataque/defesa por ponto (planilha +48 no nível 4) por 8 h, 1 vez a cada 24 h (usosPorDia 1); o Lugan recebe +1 ataque e defesa a cada 200 fiéis e +1 dano a cada 400 fiéis. Campo fieis da ficha deve sugerir 8.000 × nível quando vazio.
- Manipulação da Tsu real (1) e Fogo Real (2), Terra real: ler as seções correspondentes em docs/livro-poderes.md e semear coeficientes por ponto (planilha: Manipular Tsu Real +70, danos mágicos +10; Fogo Real 2 km², 400 de dano por rodada, +200 contra divinos). Registrar em `escala` só o que for numérico; o resto vai para a descrição por patamar.
- Portador da Jikar (item, sem nível): +3d×100 ataque e defesa, +1d dano, demais efeitos textuais.

## Pilar (aspecto do mundo)
- Livro: o aspecto varia de 1 a 5, sobe com meditação de 28 a 34 dias em um salão (teste 10 × nível + 1d×100 contra dificuldade 600, −100 por nível do aspecto contrário); alguns poderes exigem aspecto mínimo (ex.: "honra 3") e só funcionam quando o aspecto do mundo estiver nesse nível.
- Modelo: `identidade.pilarNivel: number` (atual 3, editável) e `Poder.requerPilar?: number`. Exibir o pilar como "Justiça 3" a partir de pilarLuganico + pilarNivel (substitui a formatação por nível lugânico feita no nó H). Alerta quando um poder exigir pilar acima do atual.
