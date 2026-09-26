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
