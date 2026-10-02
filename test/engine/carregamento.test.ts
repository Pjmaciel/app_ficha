import { describe, expect, it } from 'vitest';
import dados from '../../src/data/alexsander.json';
import { decidirCarregamento, migrarFicha } from '../../src/engine';
import type { Ficha } from '../../src/model/types';

const embutida = dados as unknown as Ficha;

describe('decidirCarregamento', () => {
  it('a ficha embutida está na revisão 8 (regra da mesa: pilar informativo e build livre)', () => {
    expect(embutida.revisaoDados).toBe(9);
  });

  it('sem ficha salva usa a embutida', () => {
    expect(decidirCarregamento(null, embutida)).toEqual({ acao: 'embutida', motivo: 'sem-salva' });
  });

  it('ficha salva na versão 1 (planilha antiga) é descartada', () => {
    expect(decidirCarregamento({ versao: 1 }, embutida)).toEqual({ acao: 'embutida', motivo: 'planilha-antiga' });
  });

  it('versão 2 com revisão menor é mantida, com aviso', () => {
    expect(decidirCarregamento({ versao: 2, revisaoDados: 1 }, embutida)).toEqual({ acao: 'salva', avisarNovaRevisao: true });
  });

  it('versão 2 sem revisão conta como revisão 0 e avisa', () => {
    expect(decidirCarregamento({ versao: 2 }, embutida)).toEqual({ acao: 'salva', avisarNovaRevisao: true });
  });

  it('as revisões 3 a 7 (antes da regra da mesa) pedem o aviso', () => {
    expect(decidirCarregamento({ versao: 2, revisaoDados: 3 }, embutida)).toEqual({ acao: 'salva', avisarNovaRevisao: true });
    expect(decidirCarregamento({ versao: 2, revisaoDados: 4 }, embutida)).toEqual({ acao: 'salva', avisarNovaRevisao: true });
    expect(decidirCarregamento({ versao: 2, revisaoDados: 5 }, embutida)).toEqual({ acao: 'salva', avisarNovaRevisao: true });
    expect(decidirCarregamento({ versao: 2, revisaoDados: 6 }, embutida)).toEqual({ acao: 'salva', avisarNovaRevisao: true });
    expect(decidirCarregamento({ versao: 2, revisaoDados: 7 }, embutida)).toEqual({ acao: 'salva', avisarNovaRevisao: true });
  });

  it('versão 2 com a mesma revisão (ou maior) é mantida sem aviso', () => {
    expect(decidirCarregamento({ versao: 2, revisaoDados: 8 }, embutida)).toEqual({ acao: 'salva', avisarNovaRevisao: false });
    expect(decidirCarregamento({ versao: 2, revisaoDados: 9 }, embutida)).toEqual({ acao: 'salva', avisarNovaRevisao: false });
  });
});

describe('revisaoDados na migração', () => {
  it('atribui 0 quando ausente e preserva quando presente', () => {
    const { revisaoDados: _, ...semRevisao } = embutida;
    expect(migrarFicha(semRevisao).revisaoDados).toBe(0);
    expect(migrarFicha({ ...semRevisao, revisaoDados: 3 }).revisaoDados).toBe(3);
  });
});
