# Contrato do modelo de dados e do motor de regras (v0.1)

Este contrato é a fonte única para todos os workers. `docs/planilha-dump.txt` traz cada célula da planilha com fórmula e valor calculado (oráculo dos testes). A aba `LUGAN` é a ficha em uso; a aba `FICHA` só fornece os valores "iniciais" das perícias (`FICHA!N*`).

## Stack
- Vite + TypeScript (strict), sem framework de UI; testes com Vitest; leitura de xlsx com a biblioteca `xlsx` (SheetJS) ou `exceljs`, rodando no navegador e no Node.
- Publicação estática no GitHub Pages via `.github/workflows/deploy.yml`; `vite.config.ts` com `base` configurável por `VITE_BASE` (padrão `/app_ficha/`).
- PWA: `public/manifest.webmanifest` + service worker simples (cache dos assets de build). Sem dependência de servidor.
- Persistência: `localStorage` chave `app_ficha:ficha` e `app_ficha:sessao`; exportar/importar JSON.
- Todo texto em português com acentuação correta. Zero emojis.

## Tipos (`src/model/types.ts`)
```ts
export type AtributoId = 'forca' | 'agilidade' | 'reflexos' | 'fortitude' | 'distancia' | 'mental';
export interface Atributo { bonus: number; pontos: number; bonusExtra: number } // total = bonus + pontos + bonusExtra
export type GrupoPericia = 'artes' | 'ciencias' | 'crime' | 'esporte' | 'idioma' | 'investigacao' | 'manipulacao' | 'sobrevivencia' | 'tecnologia' | 'combate';
export interface Pericia { id: string; nome: string; grupo: GrupoPericia; atributo: AtributoId; inicial: number; graduacao: number }
// total = inicial + atributos[atributo].total + graduacao
export interface Poder { id: string; nome: string; nivel: number; descricao: string; custoFadiga?: number; usosPorDia?: number }
export type Elemento = 'fogo' | 'agua' | 'ar' | 'terra' | 'luz' | 'trevas';
export interface Tsu { elemento: Elemento; nivel: number; real: boolean } // valor real = nivel * 8 quando real === true
export type ChaveCombate = 'ataqueArmaBranca' | 'ataqueMagico' | 'ataqueLuta' | 'ataqueArmaFogo' | 'esquivar' | 'bloquear' | 'aparar';
export interface Ficha {
  versao: 1;
  identidade: { nome: string; jogador: string; raca: string; reino: string; pilarLuganico: string; nivel: number; nivelLuganico: number; basePv: number };
  pontosIniciais: number; // 1018
  atributos: Record<AtributoId, Atributo>;
  pericias: Pericia[];
  combate: { bonusPassivo: Record<ChaveCombate, number> }; // coluna E26..E32 da aba LUGAN (todos 50 hoje)
  poderes: Poder[];
  tsu: Tsu[];
  xp: { total: number; atual: number };
}
export interface Rolagem { quando: string; rotulo: string; dados: number[]; multiplicador: number; bonus: number; total: number }
export interface Sessao { pvAtual: number; fadiga: number; usosPoder: Record<string, number>; anotacoes: string; rolagens: Rolagem[] }
```

## Motor (`src/engine/index.ts`) — assinaturas exportadas
```ts
export function totalAtributo(a: Atributo): number;
export function pontosRestantes(f: Ficha): number;               // pontosIniciais - soma(pontos)
export function totalPericia(f: Ficha, id: string): number;
export function pv(f: Ficha): number;                            // basePv * fortitude.total
export function combate(f: Ficha): Record<ChaveCombate, number>;
export function dadosPorNivel(nivel: number): number;            // 1 + floor((nivel - 31) / 10); nível 41 => 2
export function tsuReal(t: Tsu): number;                         // real ? nivel * 8 : nivel
export function rolar(qtdDados: number, multiplicador: number, bonus: number, rotulo: string, rng?: () => number): Rolagem; // d6 × multiplicador
export function novaSessao(f: Ficha): Sessao;                    // pvAtual = pv(f), fadiga 0, usos 0
```

## Fórmulas de combate (aba LUGAN, linhas 26-32) e oráculo
| Chave | Fórmula | Valor esperado |
|---|---|---|
| ataqueArmaBranca | pericia('espada') + bonusPassivo | 584 + 50 = 634 |
| ataqueMagico | pericia('manipular_tsu') + bonusPassivo | 477 + 50 = 527 |
| ataqueLuta | pericia('luta') + bonusPassivo | 384 + 50 = 434 |
| ataqueArmaFogo | pericia('arma_de_fogo') + bonusPassivo | 384 + 50 = 434 |
| esquivar | reflexos + 3 + bonusPassivo | 183 + 3 + 50 = 236 |
| bloquear | pericia('escudo') + 3 + bonusPassivo | 584 + 3 + 50 = 637 |
| aparar | pericia('espada') - distancia + mental + 3 + bonusPassivo | 584 - 128 + 141 + 3 + 50 = 650 |

Outros oráculos: atributos totais Força 238, Agilidade 248, Reflexos 183, Fortitude 218, Distância 128, Mental 141; PV 2616; pontos restantes 0; Terra real 48; `dadosPorNivel(41) === 2`.

## Perícias (ids, grupo, atributo governante conforme coluna K da aba LUGAN, inicial conforme FICHA!N*)
Regra: `inicial` = valor de `FICHA!N<linha>` referenciado pela coluna J da LUGAN (136 na maioria; 336 em perceber, manipular_tsu, espada, escudo). `graduacao` = coluna L (vazia = 0). O atributo governante é o que a coluna K da LUGAN aponta hoje (inclusive as referências herdadas por cópia), para que os totais atuais se preservem:
- artes (mental): atuacao, canto, danca, instrumentos_musicais, oficios
- ciencias (mental): geografia, historia, quimica, ecologia, medicina, veterinaria, manipular_tsu_ciencia, meteorologia, ciencias_ocultas, engenharia_ciencia
- crime: armadilha (mental), arrombamento (mental), disfarce (mental), furtividade (agilidade), falsificacao (mental), punga (agilidade), rastreio (mental), jogos_de_azar (mental), fuga (mental)
- esporte (agilidade): corrida, acrobacia, escalar, cavalgar, natacao
- idioma (mental): criptografia, leitura_labial, linguagem_dos_sinais, linguas_atuais, linguas_antigas
- investigacao (mental): disfarce_inv, criptografia_inv, rastrear_inv, perceber (inicial 336), sentir_motivacao, ouvir, observar
- manipulacao (mental): blefar, lideranca, trato_social, seducao, trato_com_animais; intimidar (forca)
- sobrevivencia: escalar_sob (agilidade), armadilha_sob (agilidade), meteorologia_sob (mental), rastrear_sob (mental), perceber_sob (mental), corrida_sob (agilidade), fuga_sob (agilidade)
- tecnologia: conducao (agilidade), pilotagem (agilidade), velejar (agilidade), engenharia (mental), mecanica (agilidade)
- combate: luta (agilidade), manipular_tsu (mental, inicial 336), espada (agilidade, inicial 336), arma_de_fogo (agilidade), escudo (agilidade, inicial 336)
Totais esperados: 277 para perícias mental com inicial 136; 384 para agilidade com inicial 136; 374 intimidar; 477 perceber e manipular_tsu; 584 espada e escudo.

## Poderes (aba LUGAN, B72-E86)
- velocidade_divina (nível 1): uma ação de velocidade contra outro Lugan; três ações extras contra seres não lugânicos.
- lugan_da_batalha (nível 1): +50 em qualquer ataque, +50 em qualquer defesa, +20 no final do dano.
- golpe_devastador (nível 1): 3d×100 no ataque; 2d×100 no multiplicador de dano.
- golpe_especial_campeao (nível 1, custoFadiga 10; 25 para os três efeitos): 1 Multiataque (alvos = Agilidade); 2 Ataque acelerado (dobra Agilidade no ataque); 3 Dano acelerado (soma Agilidade no dano).

## Identidade
nome "Alexsander Somar III", jogador "Pablo Maciel", raça "Meio Orc", reino "Sodraria", pilar "Senhor dos Ossos", nível 41 (a planilha diz 35; usar 41), nível lugânico 3, basePv 12, xp total 0 e atual 0. Tsu: seis elementos nível 6; terra real = true.

## Propriedade de arquivos por worker
- A (esqueleto): package.json, tsconfig, vite.config.ts, vitest config, index.html mínimo, src/main.ts placeholder, src/model/types.ts, src/data/alexsander.json, src/engine/index.ts (stubs que lançam `Error('não implementado')`), public/manifest.webmanifest, src/sw.ts ou public/sw.js, .github/workflows/deploy.yml, .gitignore, README.md.
- B (motor): src/engine/** e test/engine/**.
- C (importador): src/import/** e test/import/**.
- D (interface): src/ui/**, src/styles/**, src/main.ts, index.html.
