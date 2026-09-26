# Contrato do modelo de dados e do motor de regras

A versão vigente é a **v2**, descrita em [`contrato-modelo-v2.md`](./contrato-modelo-v2.md), que é a fonte única para tipos (`src/model/types.ts`), motor (`src/engine/index.ts`), dados (`src/data/alexsander.json`) e interface. O contrato v1 (ficha com `bonus`/`bonusExtra`, `bonusPassivo` numérico, rolador de dados e nível 35) foi substituído e não vale mais.

## Onde cada parte vive
- Tipos: `src/model/types.ts` (`versao: 2`, `Fonte`, `Atributo` com `bonusNivel`/`pontos`/`extras`, `Poder` com `tipo`, `EntradaCombate`, `Dano`, `GolpeEspecial`, `Sessao` sem rolagens).
- Motor: `src/engine/index.ts`, funções puras: `baseAtributo`, `totalAtributo`, `pontosRestantes`, `bonusNivelEsperado`, `alertaBonusNivel`, `diferencaAtributos`, `totalPericia`, `pvBase`, `pvTotal`, `dadosPorNivel`, `combate`, `dano`, `golpe`, `subirNivel`, `tsuValor`, `novaSessao`, `migrarFicha`.
- Importação: `src/import/xlsx.ts` (planilha correta, abas `LUGAN` e `FICHA`) e `src/import/json.ts` (`exportarJson`/`importarJson`, que valida a versão 2 e migra a versão 1).
- Dados: `src/data/alexsander.json`, igual ao resultado da importação de `test/fixtures/alexsander-somar-iii.xlsx` (verificado em `test/import/xlsx.test.ts`).

## Decisões onde o contrato v2 deixou margem
- `diferencaAtributos` compara a **base** (bônus de nível + pontos, sem extras de poderes). Com o total, a Força (322) contra a Distância (152) daria 170; com a base, Agilidade 272 contra Distância 152 dá exatamente 120, o limite. Empate: vale o primeiro na ordem Força, Agilidade, Reflexos, Fortitude, Distância, Mental.
- `combate().composicao` lista todas as parcelas do total, na ordem: valor-alvo (perícia ou atributo, mais a constante 3 das defesas, e a subtração de Distância no aparar), fontes nomeadas e, se houver, "Fiéis". A soma da composição é sempre o total.
- `dano().fieisBonus` (+1 por `fieisPor` fiéis) soma ao bônus fixo mostrado no texto; `fixo` traz só a soma das fontes fixas.
- `dano(f, golpe)` e `golpe(f, g)` aplicam os dados do golpe passado independentemente de `g.ativo`; o campo `ativo` é um marcador de interface.
- `golpe().ataqueTotal` é o total do ataque com arma branca (os dados extras só mudam a quantidade de dados).
- `subirNivel` exige um inteiro positivo e nunca altera o nível lugânico.
- `migrarFicha`: versão 1 recebe as regras padrão do contrato (bônus 47 no nível 41), então um bônus de nível antigo (23) dispara `alertaBonusNivel`; `bonusExtra` vira o extra "Bônus extra"; `bonusPassivo` vira a fonte "Bônus passivo" (omitida se zero); `armaPrincipal` fica vazia; poderes viram `passivo`, ou `ativo` quando têm `custoFadiga`. A versão 2 é apenas copiada (a validação estrutural é de `importarJson`).
- Importador: nomes dos poderes, ids, tipos, usos por dia, `armaPrincipal`, dados extras, golpe, dano e nível/bônus de referência vêm do contrato; da planilha vêm identidade, bônus de nível, pontos, extras, perícias, PV extra (F22), soma passiva (coluna E), Lugan da Batalha (E76 e E78), níveis e descrições dos poderes e a Tsu. O que sobrar da coluna E depois das parcelas nomeadas vira a fonte "Outros".
- Descrições dos poderes: as quebras de linha viram "; ", exceto depois de linha que já termina em ";" ou ".", quando basta um espaço (evita ".;").
- Poder sem nível na planilha (Portador da Jikar) tem `nivel: null`.
