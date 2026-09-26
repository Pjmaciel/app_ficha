import { describe, expect, it } from 'vitest';
import type { ChaveCombate, Ficha } from '../../src/model/types';
import dados from '../../src/data/alexsander.json';

const ficha = dados as Ficha;

const somaFontes = (fontes: { valor: number }[]) => fontes.reduce((s, f) => s + f.valor, 0);

describe('ficha do Alexsander', () => {
  it('está na versão 2', () => {
    expect(ficha.versao).toBe(2);
  });

  it('distribui exatamente os pontos iniciais entre os atributos', () => {
    const soma = Object.values(ficha.atributos).reduce((s, a) => s + a.pontos, 0);
    expect(ficha.regras.pontosIniciais - soma).toBe(0);
  });

  it('contém as 64 perícias com ids únicos', () => {
    expect(ficha.pericias).toHaveLength(64);
    expect(new Set(ficha.pericias.map((p) => p.id)).size).toBe(64);
  });

  it('traz as regras do contrato v2', () => {
    expect(ficha.regras).toEqual({
      pontosIniciais: 1018,
      bonusPorNivel: 4,
      nivelReferencia: 41,
      bonusReferencia: 47,
      diferencaMaximaAtributos: 120,
    });
  });

  it('as fontes de combate somam a coluna E da planilha', () => {
    const esperado: Record<ChaveCombate, number> = {
      ataqueArmaBranca: 470,
      ataqueMagico: 280,
      ataqueLuta: 280,
      ataqueArmaFogo: 280,
      esquivar: 330,
      bloquear: 330,
      aparar: 470,
    };
    for (const [chave, soma] of Object.entries(esperado)) {
      expect(somaFontes(ficha.combate[chave as ChaveCombate].fontes)).toBe(soma);
    }
  });

  it('a Jikar dá +3 dados de ataque/defesa e +1 de dano; os fiéis seguem a regra do contrato', () => {
    const comJikar: ChaveCombate[] = ['ataqueArmaBranca', 'aparar', 'esquivar', 'bloquear'];
    for (const [chave, e] of Object.entries(ficha.combate)) {
      expect(somaFontes(e.dadosExtras)).toBe(comJikar.includes(chave as ChaveCombate) ? 3 : 0);
    }
    expect(ficha.combate.ataqueArmaBranca.fieisPor).toBe(200);
    expect(ficha.combate.esquivar.fieisPor).toBe(100);
    expect(ficha.combate.ataqueMagico.fieisPor).toBeNull();
    expect(somaFontes(ficha.dano.dadosExtras)).toBe(1);
    expect(somaFontes(ficha.dano.fixos)).toBe(120);
    expect(ficha.dano.fieisPor).toBe(400);
    expect(ficha.fieis).toBe(0);
  });

  it('não há poder removido na lista inicial', () => {
    expect(ficha.poderes).toHaveLength(11);
    expect(ficha.poderes.every((p) => p.tipo !== 'removido')).toBe(true);
  });

  it('o golpe devastador soma +3 dados de ataque e +2 de dano', () => {
    expect(ficha.golpes).toEqual([
      { id: 'golpe_devastador', nome: 'Golpe Devastador de Lugan', dadosAtaqueExtras: 3, dadosDanoExtras: 2, ativo: false },
    ]);
  });
});
