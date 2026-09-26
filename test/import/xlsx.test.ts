import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Ficha } from '../../src/model/types';
import alexsander from '../../src/data/alexsander.json';
import { combate, dano, migrarFicha, pontosRestantes, pvTotal, totalAtributoFicha } from '../../src/engine';
import { importarXlsx } from '../../src/import/xlsx';

function carregar(): Ficha {
  const arquivo = readFileSync('test/fixtures/alexsander-somar-iii.xlsx');
  const buffer = arquivo.buffer.slice(arquivo.byteOffset, arquivo.byteOffset + arquivo.byteLength) as ArrayBuffer;
  return importarXlsx(buffer);
}

describe('importarXlsx', () => {
  const ficha = carregar();

  it('reproduz exatamente o JSON de referência do Alexsander, depois da migração que semeia as escalas dos poderes', () => {
    // Diferença documentada: a planilha traz a Proteção Divina no nível 1; a ficha embutida a tem no nível 2
    // (confirmado pelo jogador, revisão 4), o que muda PV (3404 → 3904), usos (1 → 2) e os efeitos por nível.
    const esperado = structuredClone(alexsander) as unknown as Ficha;
    esperado.poderes.find((p) => p.id === 'protecao_divina')!.nivel = 1;
    esperado.poderes.find((p) => p.id === 'protecao_divina')!.pontosProprios = 1;
    expect(migrarFicha(ficha)).toStrictEqual({ ...esperado, revisaoDados: 0 });
  });

  it('o importador não semeia escalas: os poderes saem sem escala e as fontes continuam nomeadas', () => {
    expect(ficha.poderes.every((p) => p.escala === undefined)).toBe(true);
    expect(ficha.combate.ataqueArmaBranca.fontes.map((x) => x.nome)).toContain('Lugan da Batalha');
  });

  it('é uma ficha versão 2 de nível 41 com pilar Justiça', () => {
    expect(ficha.versao).toBe(2);
    expect(ficha.identidade.nivel).toBe(41);
    expect(ficha.pilar.nome).toBe('Justiça');
    expect(ficha.pilar.nivel).toBe(3);
    expect(ficha.identidade.nome).toBe('Alexsander Somar III');
    expect(ficha.xp).toEqual({ total: 12, atual: 12 });
  });

  it('lê bônus de nível 47, pontos, extra de Força e PV extra', () => {
    for (const a of Object.values(ficha.atributos)) expect(a.bonusNivel).toBe(47);
    expect(ficha.atributos.forca.extras).toEqual([{ nome: 'Força das Montanhas Divinas', valor: 60 }]);
    expect(ficha.atributos.mental.extras).toEqual([]);
    expect(ficha.pvExtras).toEqual([{ nome: 'Proteção Divina', valor: 500 }]);
    expect(pontosRestantes(ficha)).toBe(0);
  });

  it('as fontes de combate somam exatamente a coluna E da planilha', () => {
    const soma = (c: keyof Ficha['combate']) => ficha.combate[c].fontes.reduce((s, x) => s + x.valor, 0);
    expect(soma('ataqueArmaBranca')).toBe(470);
    expect(soma('aparar')).toBe(470);
    expect(soma('ataqueMagico')).toBe(280);
    expect(soma('ataqueLuta')).toBe(280);
    expect(soma('ataqueArmaFogo')).toBe(280);
    expect(soma('esquivar')).toBe(330);
    expect(soma('bloquear')).toBe(330);
  });

  it('os valores calculados batem com as células da planilha (D26:D32, C22)', () => {
    expect(combate(ficha, 'ataqueArmaBranca').total).toBe(1078);
    expect(combate(ficha, 'ataqueMagico').total).toBe(781);
    expect(combate(ficha, 'esquivar').total).toBe(540);
    expect(combate(ficha, 'bloquear').total).toBe(941);
    expect(combate(ficha, 'aparar').total).toBe(1094);
    expect(totalAtributoFicha(ficha, 'forca')).toBe(322);
    expect(pvTotal(ficha)).toBe(3404);
    expect(dano(ficha).texto).toBe('3d×322 +120');
  });

  it('lê os 64 ids de perícia, únicos, com inicial da aba FICHA', () => {
    expect(ficha.pericias).toHaveLength(64);
    expect(new Set(ficha.pericias.map((p) => p.id)).size).toBe(64);
    const inicial = (id: string) => ficha.pericias.find((p) => p.id === id)?.inicial;
    expect(inicial('espada')).toBe(336);
    expect(inicial('escudo')).toBe(336);
    expect(inicial('arma_de_fogo')).toBe(136);
  });

  it('resolve o atributo governante pela cadeia de referências da coluna K', () => {
    const atributo = (id: string) => ficha.pericias.find((p) => p.id === id)?.atributo;
    expect(atributo('fuga')).toBe('mental');
    expect(atributo('furtividade')).toBe('agilidade');
    expect(atributo('intimidar')).toBe('forca');
  });

  it('lê os 11 poderes com nível, tipo e descrição da coluna E', () => {
    expect(ficha.poderes.map((p) => [p.nome, p.nivel, p.tipo])).toEqual([
      ['Velocidade Divina', 2, 'passivo'],
      ['Lugan da Batalha', 3, 'passivo'],
      ['Golpe Devastador de Lugan', 3, 'ativo'],
      ['Portador da Jikar', null, 'item'],
      ['Campeão do Combate Divino', 3, 'passivo'],
      ['Força das Montanhas Divinas', 1, 'passivo'],
      ['Proteção Divina', 1, 'defensivo'],
      ['O Filho de Hagashi', 4, 'passivo'],
      ['Lugan Completo', 1, 'passivo'],
      ['Manipulador de Tsu Real', 1, 'passivo'],
      ['Fogo Real', 2, 'ativo'],
    ]);
    expect(ficha.poderes.find((p) => p.usosPorDia !== undefined && p.id === 'protecao_divina')?.usosPorDia).toBe(1);
    expect(ficha.poderes.find((p) => p.id === 'o_filho_de_hagashi')?.usosPorDia).toBe(1);
  });

  it('monta a descrição do Lugan da Batalha de E76:F78 e junta as demais sem pontuação duplicada', () => {
    const descricao = (id: string) => ficha.poderes.find((p) => p.id === id)?.descricao;
    expect(descricao('lugan_da_batalha')).toBe('+150 em qualquer ataque; +150 em qualquer defesa; +60 no final do dano');
    expect(descricao('golpe_devastador')).toBe('4d×100 no ataque; 3d×100 no multiplicador de dano.');
    expect(descricao('velocidade_divina')).toBe(
      'Dá uma ação de velocidade contra outro Lugan. Contra seres não lugânicos, dá três ações extras.',
    );
    for (const p of ficha.poderes) {
      expect(p.descricao).not.toMatch(/\n/);
      expect(p.descricao).not.toMatch(/[;.];/);
    }
  });

  it('marca como reais as Tsu com fórmula na coluna J: fogo e terra', () => {
    expect(ficha.tsu.filter((t) => t.real).map((t) => t.elemento)).toEqual(['fogo', 'terra']);
    expect(ficha.tsu.map((t) => t.nivel)).toEqual([48, 6, 6, 48, 6, 6]);
  });

  it('rejeita arquivo sem a aba LUGAN', () => {
    expect(() => importarXlsx(new ArrayBuffer(0))).toThrow();
  });
});
