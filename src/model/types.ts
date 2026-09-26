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
