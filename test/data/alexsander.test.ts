import { describe, expect, it } from 'vitest';
import type { ChaveCombate, Ficha } from '../../src/model/types';
import dados from '../../src/data/alexsander.json';
import { combate, dano, fontesDerivadasCombate, fontesDerivadasDano, pvBase, pvTotal, totalAtributoFicha, usosPorDiaDoPoder, validarFicha } from '../../src/engine';

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
      regraNivel: 'livro',
      xpProximoNivel: 50,
      incrementoXpPorNivel: 0,
    });
    expect(ficha.pontosDePoderDisponiveis).toBe(0);
  });

  it('a build da mesa: só o Campeão (3), o Lugan da Batalha (1) e a Proteção Divina (2) mais o item Jikar entram nos cálculos', () => {
    const ativos = ficha.poderes.filter((p) => p.tipo !== 'removido').map((p) => [p.id, p.nivel, p.tipo, p.origem]);
    expect(ativos).toEqual([
      ['lugan_da_batalha', 1, 'passivo', 'livre'],
      ['portador_da_jikar', null, 'item', 'item'],
      ['campeao_do_combate_divino', 3, 'passivo', 'livre'],
      ['protecao_divina', 2, 'defesa', 'livre'],
    ]);
    const removidos = ficha.poderes.filter((p) => p.tipo === 'removido').map((p) => p.id).sort();
    expect(removidos).toEqual([
      'fogo_real', 'forca_das_montanhas_divinas', 'golpe_devastador', 'lugan_completo', 'manipulador_de_tsu_real',
      'o_filho_de_hagashi', 'velocidade_divina',
    ]);
    expect(ficha.poderes).toHaveLength(11);
  });

  it('o pilar é só informativo: Justiça 3, sem pacote e sem valor base nos poderes', () => {
    expect(ficha.pilar).toMatchObject({ nome: 'Justiça', nivel: 3 });
    expect(ficha.pilar).not.toHaveProperty('pacotePorNivel');
    expect(ficha.pilar).not.toHaveProperty('nivelAplicado');
    for (const p of ficha.poderes) {
      expect(p).not.toHaveProperty('valorBasePilar');
      expect(p).not.toHaveProperty('pontosLivres');
      expect(p).not.toHaveProperty('pontosProprios');
      expect(['livre', 'item', 'manual']).toContain(p.origem);
    }
  });

  it('nenhuma fonte manual sem origem em poder ou item: some o "Outros" (120/70/120) e os ajustes do mestre', () => {
    for (const e of Object.values(ficha.combate)) expect(e.fontes).toEqual([]);
    expect(ficha.dano.fixos).toEqual([]);
    expect(ficha.pvExtras).toEqual([]);
    for (const a of Object.values(ficha.atributos)) expect(a.extras).toEqual([]);
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
    expect(ficha.dano.fieisPor).toBe(400);
    expect(ficha.fieis).toBe(0);
  });

  it('as parcelas dos poderes: Campeão 70/70/20 só em arma branca, aparar e dano; Lugan da Batalha 50/50/20 em tudo', () => {
    const esperado: Record<ChaveCombate, number> = {
      ataqueArmaBranca: 260, ataqueMagico: 50, ataqueLuta: 50, ataqueArmaFogo: 50, esquivar: 50, bloquear: 50, aparar: 260,
    };
    for (const [chave, soma] of Object.entries(esperado)) {
      expect(somaFontes(fontesDerivadasCombate(ficha, chave as ChaveCombate))).toBe(soma);
    }
    expect(somaFontes(fontesDerivadasDano(ficha))).toBe(80);
  });

  it('oráculos da build: Força 262, PV 2904 + 1000 = 3904 e os valores de combate e dano', () => {
    expect(totalAtributoFicha(ficha, 'forca')).toBe(47 + 215);
    expect(pvBase(ficha)).toBe(2904);
    expect(pvTotal(ficha)).toBe(2904 + 1000);
    const rolagem = (c: ChaveCombate): string => { const r = combate(ficha, c); return `${r.dados}d×100 +${r.total}`; };
    expect(rolagem('ataqueArmaBranca')).toBe('5d×100 +868');
    expect(rolagem('aparar')).toBe('5d×100 +884');
    expect(rolagem('bloquear')).toBe('5d×100 +661');
    expect(rolagem('esquivar')).toBe('5d×100 +260');
    expect(rolagem('ataqueLuta')).toBe('2d×100 +458');
    expect(rolagem('ataqueArmaFogo')).toBe('2d×100 +458');
    expect(rolagem('ataqueMagico')).toBe('2d×100 +551');
    expect(dano(ficha).texto).toBe('3d×262 +80');
  });

  it('as composições batem com a regra: aparar = 608 − 152 + 165 + 3 + 260; bloquear = 608 + 3 + 50; esquivar = 207 + 3 + 50', () => {
    expect(combate(ficha, 'aparar').composicao.map((x) => x.valor)).toEqual([608, -152, 165, 3, 50, 210]);
    expect(combate(ficha, 'bloquear').composicao.map((x) => x.valor)).toEqual([608, 3, 50]);
    expect(combate(ficha, 'esquivar').composicao.map((x) => x.valor)).toEqual([207, 3, 50]);
  });

  it('o Golpe Devastador, "por enquanto", fica removido: sem usos por dia e fora da Batalha; Golpe Especial: Competência não existe', () => {
    const poder = ficha.poderes.find((p) => p.id === 'golpe_devastador');
    expect(poder?.tipo).toBe('removido');
    expect(poder?.nivel).toBe(3);
    expect(ficha.golpes.some((g) => g.ativo)).toBe(false);
    expect(ficha.golpes.some((g) => /compet/i.test(`${g.id} ${g.nome}`))).toBe(false);
  });

  it('a Proteção Divina 2 dá 2 usos por dia; os removidos não contam usos', () => {
    const pd = ficha.poderes.find((p) => p.id === 'protecao_divina')!;
    expect(usosPorDiaDoPoder(pd)).toBe(2);
    expect(pd.usosPorDia).toBeUndefined();
  });

  it('traz as ações, os lembretes e as reações da aba Batalha para a build', () => {
    expect(ficha.acoes.map((a) => [a.nome, a.rolagem])).toEqual([['Terra Real', '1d×48 direto no PV']]);
    expect(new Set(ficha.acoes.map((a) => a.id)).size).toBe(ficha.acoes.length);
    expect(ficha.lembretes).toHaveLength(3);
    expect(ficha.reacoes).toHaveLength(5);
    expect(ficha.reacoes[0]).toEqual({
      situacao: 'Ataque físico ou mágico normal',
      resposta: 'Aparar ou Bloquear (valores em Defesas).',
    });
  });

  it('a ficha embutida não gera nenhum alerta de validação', () => {
    expect(validarFicha(ficha)).toEqual([]);
  });

  it('só o Lugan Completo tinha a marca explícita de mostrar na batalha, e ele agora está removido', () => {
    expect(ficha.poderes.filter((p) => p.mostrarNaBatalha !== undefined).map((p) => p.id)).toEqual(['lugan_completo']);
  });
});
