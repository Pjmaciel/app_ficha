import type { Atributo, ChaveCombate, Ficha, Rolagem, Sessao, Tsu } from '../model/types';

/** Total do atributo: bônus + pontos distribuídos + bônus extra. */
export function totalAtributo(a: Atributo): number {
  return a.bonus + a.pontos + a.bonusExtra;
}

/** Saldo de pontos ainda não distribuídos (negativo indica excesso). */
export function pontosRestantes(f: Ficha): number {
  const gastos = Object.values(f.atributos).reduce((soma, a) => soma + a.pontos, 0);
  return f.pontosIniciais - gastos;
}

/** Total da perícia: inicial + total do atributo governante + graduação. */
export function totalPericia(f: Ficha, id: string): number {
  const p = f.pericias.find((x) => x.id === id);
  if (!p) throw new Error(`Perícia inexistente: ${id}`);
  return p.inicial + totalAtributo(f.atributos[p.atributo]) + p.graduacao;
}

/** Pontos de vida máximos: basePv × total de Fortitude. */
export function pv(f: Ficha): number {
  return f.identidade.basePv * totalAtributo(f.atributos.fortitude);
}

/** Valores de combate da aba LUGAN (linhas 26-32), já com o bônus passivo. */
export function combate(f: Ficha): Record<ChaveCombate, number> {
  const b = f.combate.bonusPassivo;
  const pericia = (id: string) => totalPericia(f, id);
  const attr = (id: keyof Ficha['atributos']) => totalAtributo(f.atributos[id]);
  return {
    ataqueArmaBranca: pericia('espada') + b.ataqueArmaBranca,
    ataqueMagico: pericia('manipular_tsu') + b.ataqueMagico,
    ataqueLuta: pericia('luta') + b.ataqueLuta,
    ataqueArmaFogo: pericia('arma_de_fogo') + b.ataqueArmaFogo,
    esquivar: attr('reflexos') + 3 + b.esquivar,
    bloquear: pericia('escudo') + 3 + b.bloquear,
    aparar: pericia('espada') - attr('distancia') + attr('mental') + 3 + b.aparar,
  };
}

/** Dados de multiplicador por nível: um por bloco de 10 níveis a partir do 31. */
export function dadosPorNivel(nivel: number): number {
  return 1 + Math.floor((nivel - 31) / 10);
}

/** Valor efetivo da Tsu: oito vezes o nível quando é a Tsu real. */
export function tsuReal(t: Tsu): number {
  return t.real ? t.nivel * 8 : t.nivel;
}

/**
 * Rola `qtdDados` d6 e calcula soma × multiplicador + bônus.
 * O gerador `rng` (intervalo [0, 1)) é injetável para permitir testes determinísticos.
 */
export function rolar(
  qtdDados: number,
  multiplicador: number,
  bonus: number,
  rotulo: string,
  rng: () => number = Math.random,
): Rolagem {
  if (!Number.isInteger(qtdDados) || qtdDados < 0) {
    throw new Error(`Quantidade de dados inválida: ${qtdDados}`);
  }
  const dados = Array.from({ length: qtdDados }, () => Math.floor(rng() * 6) + 1);
  const soma = dados.reduce((s, d) => s + d, 0);
  return {
    quando: new Date().toISOString(),
    rotulo,
    dados,
    multiplicador,
    bonus,
    total: soma * multiplicador + bonus,
  };
}

/** Sessão inicial: PV cheio, fadiga zerada e nenhum uso de poder registrado. */
export function novaSessao(f: Ficha): Sessao {
  return {
    pvAtual: pv(f),
    fadiga: 0,
    usosPoder: Object.fromEntries(f.poderes.map((p) => [p.id, 0])),
    anotacoes: '',
    rolagens: [],
  };
}
