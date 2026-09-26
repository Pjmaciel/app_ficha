# Contrato v2 — modelo, motor e interface (Raio 3)

Fonte da verdade: `test/fixtures/alexsander-somar-iii.xlsx` (planilha correta, nível 41) e `docs/planilha-dump.txt` (todas as células com fórmula e valor). A aba `FICHA` não mudou. Substitui o contrato v1 onde houver conflito. O rolador de dados foi removido do escopo.

## Tipos (`src/model/types.ts`)
```ts
export type AtributoId = 'forca' | 'agilidade' | 'reflexos' | 'fortitude' | 'distancia' | 'mental';
export interface Fonte { nome: string; valor: number }                 // origem nomeada de um bônus
export interface Atributo { bonusNivel: number; pontos: number; extras: Fonte[] }
// base = bonusNivel + pontos; total = base + soma(extras)
export type GrupoPericia = 'artes' | 'ciencias' | 'crime' | 'esporte' | 'idioma' | 'investigacao' | 'manipulacao' | 'sobrevivencia' | 'tecnologia' | 'combate';
export interface Pericia { id: string; nome: string; grupo: GrupoPericia; atributo: AtributoId; inicial: number; graduacao: number }
export type TipoPoder = 'passivo' | 'ativo' | 'defensivo' | 'item' | 'removido';
export interface Poder { id: string; nome: string; nivel: number | null; tipo: TipoPoder; descricao: string; custoFadiga?: number; usosPorDia?: number }
export type Elemento = 'fogo' | 'agua' | 'ar' | 'terra' | 'luz' | 'trevas';
export interface Tsu { elemento: Elemento; nivel: number; real: boolean }   // valor = real ? nivel * 8 : nivel; vários podem ser reais
export type ChaveCombate = 'ataqueArmaBranca' | 'ataqueMagico' | 'ataqueLuta' | 'ataqueArmaFogo' | 'esquivar' | 'bloquear' | 'aparar';
export interface EntradaCombate {
  fontes: Fonte[];            // bônus passivos nomeados; soma = coluna E da planilha
  dadosExtras: Fonte[];       // dados extras de ataque/defesa além dos dados por nível (ex.: Jikar +3)
  fieisPor: number | null;    // +1 por N fiéis (200 ataque/aparar, 100 esquiva/bloqueio, null = não se aplica)
}
export interface Dano {
  atributo: AtributoId;       // 'forca' (multiplicador do dado)
  dadosExtras: Fonte[];       // ex.: Jikar +1
  fixos: Fonte[];             // ex.: Lugan da Batalha 60, Campeão 40, Lugan Completo 20 (soma 120)
  fieisPor: number | null;    // 400
}
export interface GolpeEspecial { id: string; nome: string; dadosAtaqueExtras: number; dadosDanoExtras: number; ativo: boolean } // Golpe Devastador 3: +3 ataque, +2 dano
export interface Ficha {
  versao: 2;
  identidade: { nome; jogador; raca; reino; pilarLuganico; nivel: number; nivelLuganico: number; basePv: number; armaPrincipal: string };
  regras: { pontosIniciais: number; bonusPorNivel: number; nivelReferencia: number; bonusReferencia: number; diferencaMaximaAtributos: number };
  // pontosIniciais 1018; bonusPorNivel 4; nivelReferencia 41; bonusReferencia 47; diferencaMaximaAtributos 120
  atributos: Record<AtributoId, Atributo>;
  pericias: Pericia[];
  pvExtras: Fonte[];          // ex.: Proteção Divina +500
  combate: Record<ChaveCombate, EntradaCombate>;
  dano: Dano;
  golpes: GolpeEspecial[];
  poderes: Poder[];
  tsu: Tsu[];
  fieis: number;              // editável; padrão 0 (ver nota)
  xp: { total: number; atual: number };
}
export interface Sessao { pvAtual: number; fadiga: number; usosPoder: Record<string, number>; anotacoes: string }
```
Nota sobre fiéis: os bônus passivos da planilha (470/280/330) são copiados como estão. O campo `fieis` começa em 0 para não contar duas vezes; quando o jogador informar fiéis, o motor soma `floor(fieis / fieisPor)` por cima. A interface deve explicar isso em uma linha.

## Motor (`src/engine/index.ts`)
```ts
baseAtributo(a): number; totalAtributo(a): number; pontosRestantes(f): number;
bonusNivelEsperado(f): number;            // bonusReferencia + bonusPorNivel * (nivel - nivelReferencia)
alertaBonusNivel(f): string | null;       // se algum atributo.bonusNivel !== esperado
diferencaAtributos(f): { maior: AtributoId; menor: AtributoId; diferencia: number; limite: number; excedeu: boolean };
totalPericia(f, id): number;
pvBase(f): number; pvTotal(f): number;    // base = basePv * fortitude total; total = base + soma(pvExtras)
dadosPorNivel(nivel): number;             // 1 + floor((nivel - 31) / 10)
combate(f, chave): { total: number; composicao: Fonte[]; dados: number; fieisBonus: number };
// total = valor do alvo (perícia/atributo conforme fórmulas v1: espada, manipular_tsu, luta, arma_de_fogo, reflexos+3, escudo+3, espada-distancia+mental+3) + soma(fontes) + fieisBonus; dados = dadosPorNivel + soma(dadosExtras)
dano(f, golpe?: GolpeEspecial): { dados: number; multiplicador: number; fixo: number; fieisBonus: number; texto: string }; // "3d×322 +120"
golpe(f, g): { ataqueDados: number; ataqueTotal: number; dano: ... };
subirNivel(f, quantos): Ficha;            // nivel += n; todos bonusNivel += bonusPorNivel * n; retorna nova ficha (pura)
tsuValor(t): number; novaSessao(f): Sessao; migrarFicha(json: unknown): Ficha;  // aceita versão 1 e converte
```
Oráculos (planilha correta): atributos 322/272/207/242/152/165; pontos restantes 0; pvBase 2904; pvTotal 3404; combate 1078/781/688/688/540/941/1094; perícias mental 301, agilidade 408, intimidar 458, perceber e manipular_tsu 501, espada e escudo 608; dadosPorNivel(41) = 2; combate ataqueArmaBranca.dados = 5 (2 + Jikar 3); dano básico "3d×322 +120"; com Golpe Devastador "5d×322 +120" e ataque 8d; tsu fogo e terra valor 384; bonusNivelEsperado = 47; subirNivel(f, 1).identidade.nivel = 42 e bonusNivel 51; alertaBonusNivel null na ficha atual e não nulo se bonusNivel = 23.

## Dados (`src/data/alexsander.json`) a partir da planilha correta
- identidade: Alexsander Somar III, Pablo Maciel, Meio Orc, Sodraria, pilar Justiça, nível 41, lugânico 3, basePv 12, armaPrincipal "Jikar"; xp total 12, atual 12.
- atributos: bonusNivel 47 em todos; pontos 215/225/160/195/105/118; extras força [{Força das Montanhas Divinas, 60}].
- pvExtras [{Proteção Divina, 500}].
- combate fontes (somas iguais à coluna E): ataqueArmaBranca 470 = Lugan da Batalha 150 + Campeão do Combate Divino 140 + Lugan Completo 60 + Outros 120; aparar idem 470; ataqueMagico 280 = Lugan da Batalha 150 + Lugan Completo 60 + Manipulador de Tsu Real 70; ataqueLuta 280 e ataqueArmaFogo 280 = Lugan da Batalha 150 + Lugan Completo 60 + Outros 70; esquivar 330 e bloquear 330 = Lugan da Batalha 150 + Lugan Completo 60 + Outros 120. dadosExtras: Jikar +3 em ataqueArmaBranca, aparar, esquivar, bloquear. fieisPor: 200 (armaBranca, aparar), 100 (esquivar, bloquear), null nos demais.
- dano: atributo forca; dadosExtras [{Jikar, 1}]; fixos [{Lugan da Batalha, 60}, {Campeão do Combate Divino, 40}, {Lugan Completo, 20}]; fieisPor 400.
- golpes: [{golpe_devastador, "Golpe Devastador de Lugan", 3, 2, false}].
- poderes (nível, tipo): Velocidade Divina (2, passivo), Lugan da Batalha (3, passivo), Golpe Devastador de Lugan (3, ativo), Portador da Jikar (null, item), Campeão do Combate Divino (3, passivo), Força das Montanhas Divinas (1, passivo), Proteção Divina (1, defensivo, usosPorDia 1), O Filho de Hagashi (4, passivo, usosPorDia 1 para o bônus de +48 aos fiéis), Lugan Completo (1, passivo), Manipulador de Tsu Real (1, passivo), Fogo Real (2, ativo). Descrições copiadas da coluna E da planilha (linhas 73, 76-78, 79, 82, 87, 93, 98, 106, 115, 124, 130), com quebras de linha preservadas como "; ". Nenhum poder removido na lista inicial (o Golpe Especial não existe mais na planilha correta).
- tsu: fogo 48 real, água 6, ar 6, terra 48 real, luz 6, trevas 6. fieis: 0.

## Interface (worker G)
- Sem rolador. Topo com visão rápida: nome, nível, lugânico, pilar, PV atual/total, rolagem Nd×100, arma principal, ataque principal (ex.: "5d×100 +1078"), dano principal (ex.: "3d×322 +120").
- Alertas no topo: bônus de nível divergente do esperado (com botão "corrigir para 47"); diferença entre atributos acima de 120.
- Aba Resumo de Combate (primeira aba): ataque básico com a arma, dano básico, defesas (aparar, bloquear, esquiva), e um bloco por golpe especial (Golpe Devastador) com ataque e dano; campo fiéis com o cálculo mostrado; cada valor com botão "composição" que mostra a lista de fontes.
- Painel de sessão: PV atual (dano/cura), fadiga, usos por dia só dos poderes com usosPorDia ou custoFadiga e tipo diferente de removido, descansar.
- Abas editáveis: Identidade; Atributos (tabela Total | Bônus de nível | Pontos | Extras nomeados, com pontos restantes e botão "Subir de nível" pedindo a quantidade); Perícias por grupo (Total | Inicial | Atributo select | Graduação) com busca; Combate (fontes nomeadas editáveis, dados extras, regra de fiéis); Poderes (nome, nível, tipo, custo, usos, descrição; adicionar/remover; removidos ficam listados em cinza); Tsu (nível e marcador real por elemento).
- Persistência em localStorage com migração da versão 1; exportar/importar JSON; importar xlsx; restaurar valores da planilha.
- Propriedade: F = src/model, src/data, src/engine, src/import, test/**, docs/contrato-modelo.md (substituir pelo v2), README. G = src/ui/**, src/styles/**, src/main.ts, index.html.
