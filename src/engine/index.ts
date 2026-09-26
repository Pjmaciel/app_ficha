import type { Atributo, ChaveCombate, Ficha, Rolagem, Sessao, Tsu } from '../model/types';

// Stubs do contrato; a implementação é responsabilidade do worker B.
export function totalAtributo(_a: Atributo): number { throw new Error('não implementado'); }
export function pontosRestantes(_f: Ficha): number { throw new Error('não implementado'); }
export function totalPericia(_f: Ficha, _id: string): number { throw new Error('não implementado'); }
export function pv(_f: Ficha): number { throw new Error('não implementado'); }
export function combate(_f: Ficha): Record<ChaveCombate, number> { throw new Error('não implementado'); }
export function dadosPorNivel(_nivel: number): number { throw new Error('não implementado'); }
export function tsuReal(_t: Tsu): number { throw new Error('não implementado'); }
export function rolar(_qtdDados: number, _multiplicador: number, _bonus: number, _rotulo: string, _rng?: () => number): Rolagem { throw new Error('não implementado'); }
export function novaSessao(_f: Ficha): Sessao { throw new Error('não implementado'); }
