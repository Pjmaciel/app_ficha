import { describe, expect, it } from 'vitest';
import type { Ficha } from '../../src/model/types';
import dados from '../../src/data/alexsander.json';

const ficha = dados as Ficha;

describe('ficha do Alexsander', () => {
  it('distribui exatamente os pontos iniciais entre os atributos', () => {
    const soma = Object.values(ficha.atributos).reduce((s, a) => s + a.pontos, 0);
    expect(ficha.pontosIniciais - soma).toBe(0);
  });

  it('contém as 64 perícias com ids únicos', () => {
    expect(ficha.pericias).toHaveLength(64);
    expect(new Set(ficha.pericias.map((p) => p.id)).size).toBe(64);
  });

  it('mantém o bônus passivo de combate em 50 nas sete chaves', () => {
    expect(Object.values(ficha.combate.bonusPassivo)).toEqual([50, 50, 50, 50, 50, 50, 50]);
  });
});
