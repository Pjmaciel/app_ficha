// Evolução por nível divino conforme o livro (docs/evolucao-divina-requisitos.md).
import { describe, expect, it } from 'vitest';
import dados from '../../src/data/alexsander.json';
import type { AtributoId, Ficha } from '../../src/model/types';
import {
  alertaBonusNivel, combate, dano, diferencaAtributos, migrarFicha, previaSubirNivel, progressoXp, pvTotal, subirNivel, totalAtributoFicha, totalPericia,
} from '../../src/engine';
import { exportarJson, importarJson } from '../../src/import/json';

const embutida = (): Ficha => structuredClone(dados) as unknown as Ficha;
const QUATRO: AtributoId[] = ['forca', 'agilidade', 'fortitude', 'mental'];

describe('regras e modelo da evolução', () => {
  it('a ficha embutida está no nível 41 com XP 62, regra do livro, custo de 50 de XP, incremento 0 e nenhum ponto de poder', () => {
    const f = embutida();
    expect(f.identidade.nivel).toBe(41);
    expect(f.xp).toEqual({ total: 62, atual: 62 });
    expect(f.regras).toMatchObject({ regraNivel: 'livro', xpProximoNivel: 50, incrementoXpPorNivel: 0 });
    expect(f.pontosDePoderDisponiveis).toBe(0);
  });

  it('progressoXp informa acumulado, exigido, falta, próximo nível e se foi atingido', () => {
    const f = embutida();
    expect(progressoXp(f)).toMatchObject({ atual: 62, necessario: 50, falta: 0, atingido: true, proximoNivel: 42, fracao: 1 });
    f.xp.atual = 20;
    expect(progressoXp(f)).toMatchObject({ atual: 20, necessario: 50, falta: 30, atingido: false, fracao: 0.4 });
    f.xp.atual = 50;
    expect(progressoXp(f)).toMatchObject({ falta: 0, atingido: true, fracao: 1 });
  });
});

describe('subirNivel na regra do livro', () => {
  it('nível 41 com XP 62 (custo 50, habilitado): nível 42, +10 em quatro atributos, +4 em todas as perícias, pontos de poder inalterados', () => {
    const antes = embutida();
    const f = subirNivel(antes, { atributos: QUATRO });
    expect(f.identidade.nivel).toBe(42);
    for (const id of QUATRO) expect(f.atributos[id].bonusNivel).toBe(antes.atributos[id].bonusNivel + 10);
    expect(f.atributos.reflexos.bonusNivel).toBe(antes.atributos.reflexos.bonusNivel);
    expect(f.atributos.distancia.bonusNivel).toBe(antes.atributos.distancia.bonusNivel);
    f.pericias.forEach((p, i) => expect(p.graduacao).toBe(antes.pericias[i].graduacao + 4));
    expect(f.pontosDePoderDisponiveis).toBe(0);
    expect(f.xp).toEqual({ total: 62, atual: 12 });
    expect(f.regras.xpProximoNivel).toBe(50);
    expect(f.identidade.nivelLuganico).toBe(antes.identidade.nivelLuganico);
  });

  it('nível 43 em seguida: perícias inalteradas e +1 ponto de poder; com incremento 0 o custo permanece 50', () => {
    const n41 = embutida();
    const n42 = subirNivel(n41, { atributos: QUATRO });
    const n43 = subirNivel(n42, { atributos: ['forca', 'reflexos', 'distancia', 'mental'] });
    expect(n41.regras.xpProximoNivel).toBe(50);
    expect(n42.regras.xpProximoNivel).toBe(50);
    expect(n43.regras.xpProximoNivel).toBe(50);
    expect(n43.xp).toEqual({ total: 62, atual: 0 });
    expect(n43.identidade.nivel).toBe(43);
    expect(n43.pericias).toEqual(n42.pericias);
    expect(n43.pontosDePoderDisponiveis).toBe(1);
    expect(n43.atributos.forca.bonusNivel).toBe(n41.atributos.forca.bonusNivel + 20);
    expect(n43.atributos.agilidade.bonusNivel).toBe(n41.atributos.agilidade.bonusNivel + 10);
  });

  it('desconta o custo do XP atual sem deixar negativo e preserva o histórico', () => {
    const f = embutida();
    f.xp = { total: 3000, atual: 140 };
    const n42 = subirNivel(f, { atributos: QUATRO });
    expect(n42.xp).toEqual({ total: 3000, atual: 90 });
    const n43 = subirNivel(n42, { atributos: QUATRO });
    expect(n43.xp).toEqual({ total: 3000, atual: 40 });
    const n44 = subirNivel(n43, { atributos: QUATRO });
    expect(n44.xp).toEqual({ total: 3000, atual: 0 });
    expect(subirNivel(embutida(), { atributos: QUATRO }).xp).toEqual({ total: 62, atual: 12 });
  });

  it('forçar sem XP suficiente zera o XP atual em vez de ficar negativo', () => {
    const f = embutida();
    f.xp.atual = 20;
    expect(subirNivel(f, { atributos: QUATRO }).xp.atual).toBe(0);
  });

  it('o custo e o incremento são editáveis', () => {
    const f = embutida();
    f.regras.xpProximoNivel = 70;
    f.regras.incrementoXpPorNivel = 25;
    f.xp.atual = 80;
    const n = subirNivel(f, { atributos: QUATRO });
    expect(n.xp.atual).toBe(10);
    expect(n.regras.xpProximoNivel).toBe(95);
    expect(subirNivel(n, { atributos: QUATRO }).regras.xpProximoNivel).toBe(120);
  });

  it.each<[string, AtributoId[] | undefined]>([
    ['três atributos', ['forca', 'agilidade', 'mental']],
    ['cinco atributos', ['forca', 'agilidade', 'mental', 'fortitude', 'reflexos']],
    ['atributo repetido', ['forca', 'forca', 'mental', 'fortitude']],
    ['atributo desconhecido', ['forca', 'agilidade', 'mental', 'sorte' as AtributoId]],
    ['nenhuma escolha', undefined],
    ['lista vazia', []],
  ])('rejeita %s', (_nome, atributos) => {
    expect(() => subirNivel(embutida(), { atributos })).toThrow(/4 atributos distintos/);
  });

  it('é pura: a ficha original não muda', () => {
    const f = embutida();
    const antes = JSON.stringify(f);
    subirNivel(f, { atributos: QUATRO });
    expect(JSON.stringify(f)).toBe(antes);
  });

  it('PV e combate recalculam com os atributos novos e as perícias do nível par', () => {
    const antes = embutida();
    const depois = subirNivel(antes, { atributos: QUATRO });
    // Fortitude +10 × 12 PV por ponto.
    expect(totalAtributoFicha(depois, 'fortitude')).toBe(totalAtributoFicha(antes, 'fortitude') + 10);
    expect(pvTotal(depois)).toBe(pvTotal(antes) + 120);
    // Força +10 muda o multiplicador do dano (3d×262 → 3d×272).
    expect(dano(antes).texto).toBe('3d×262 +80');
    expect(dano(depois).texto).toBe('3d×272 +80');
    // Ataque com arma branca usa a perícia (+4 de graduação mais o atributo governante).
    const ganhoEspada = totalPericia(depois, 'espada') - totalPericia(antes, 'espada');
    expect(ganhoEspada).toBeGreaterThanOrEqual(4);
    expect(combate(depois, 'ataqueArmaBranca').total - combate(antes, 'ataqueArmaBranca').total).toBe(ganhoEspada);
  });

  it('o alerta de bônus de nível fica desligado na regra do livro e volta na da planilha', () => {
    const f = subirNivel(embutida(), { atributos: QUATRO });
    expect(alertaBonusNivel(f)).toBeNull();
    f.regras.regraNivel = 'planilha';
    expect(alertaBonusNivel(f)).not.toBeNull();
  });
});

describe('regra da planilha continua disponível', () => {
  it('+4 em todos os atributos, sem mexer em perícias, pontos de poder nem XP', () => {
    const antes = embutida();
    antes.regras.regraNivel = 'planilha';
    const f = subirNivel(antes, { quantos: 2 });
    expect(f.identidade.nivel).toBe(43);
    for (const id of Object.keys(f.atributos) as AtributoId[]) expect(f.atributos[id].bonusNivel).toBe(antes.atributos[id].bonusNivel + 8);
    expect(f.pericias).toEqual(antes.pericias);
    expect(f.pontosDePoderDisponiveis).toBe(0);
    expect(f.xp).toEqual(antes.xp);
    expect(f.regras.xpProximoNivel).toBe(50);
  });
});

describe('previaSubirNivel', () => {
  it('nível par: +4 em perícias, nenhum ponto de poder, XP e custo seguinte', () => {
    const p = previaSubirNivel(embutida(), QUATRO);
    expect(p).toMatchObject({ novoNivel: 42, bonusPericias: 4, pontosDePoder: 0, xpAtualDepois: 12, xpProximoNivelDepois: 50, completa: true });
    expect(p.atributos.map((a) => [a.id, a.para - a.de])).toEqual(QUATRO.map((id) => [id, 10]));
  });

  it('nível ímpar: perícias inalteradas e +1 ponto de poder', () => {
    const f = subirNivel(embutida(), { atributos: QUATRO });
    expect(previaSubirNivel(f, QUATRO)).toMatchObject({ novoNivel: 43, bonusPericias: 0, pontosDePoder: 1 });
  });

  it('aceita escolha incompleta ou repetida (a prévia só fica incompleta) e não altera a ficha', () => {
    const f = embutida();
    const antes = JSON.stringify(f);
    expect(previaSubirNivel(f, ['forca', 'mental']).completa).toBe(false);
    expect(previaSubirNivel(f, ['forca', 'forca', 'mental', 'agilidade']).completa).toBe(false);
    expect(previaSubirNivel(f, []).atributos).toEqual([]);
    expect(JSON.stringify(f)).toBe(antes);
  });

  it('indica quando a escolha estoura a diferença máxima entre atributos (120)', () => {
    const f = embutida();
    expect(diferencaAtributos(f).excedeu).toBe(false);
    const p = previaSubirNivel(f, ['agilidade', 'forca', 'reflexos', 'fortitude']);
    expect(p.diferenca.excedeu).toBe(true);
    expect(p.diferenca.diferencia).toBeGreaterThan(120);
  });
});

describe('migração e importação da evolução', () => {
  const semEvolucao = (): Record<string, unknown> => {
    const f = embutida() as unknown as Record<string, unknown>;
    const { regraNivel: _a, xpProximoNivel: _b, incrementoXpPorNivel: _c, ...regras } = (f.regras as Record<string, unknown>);
    delete f.pontosDePoderDisponiveis;
    return { ...f, regras, revisaoDados: 9 };
  };

  it('ficha salva antes da evolução recebe os padrões do livro e mantém o resto', () => {
    const f = migrarFicha(semEvolucao());
    expect(f.regras).toMatchObject({ regraNivel: 'livro', xpProximoNivel: 50, incrementoXpPorNivel: 0 });
    expect(f.pontosDePoderDisponiveis).toBe(0);
    expect(f).toStrictEqual({ ...embutida(), revisaoDados: 9 });
  });

  it('valores salvos são respeitados e a migração é idempotente', () => {
    const salva = embutida();
    salva.regras = { ...salva.regras, regraNivel: 'planilha', xpProximoNivel: 1000, incrementoXpPorNivel: 100 };
    salva.pontosDePoderDisponiveis = 3;
    const f = migrarFicha(salva);
    expect(f).toStrictEqual(salva);
    expect(migrarFicha(f)).toStrictEqual(f);
  });

  it('importarJson aceita a ficha antiga, completa os padrões e preserva a ida e volta', () => {
    const f = importarJson(JSON.stringify(semEvolucao()));
    expect(f.regras.regraNivel).toBe('livro');
    expect(f.pontosDePoderDisponiveis).toBe(0);
    expect(importarJson(exportarJson(f))).toStrictEqual(f);
  });

  it('rejeita valores inválidos da evolução', () => {
    const base = embutida();
    const com = (parte: Record<string, unknown>) => JSON.stringify({ ...base, ...parte });
    expect(() => importarJson(com({ regras: { ...base.regras, regraNivel: 'outra' } }))).toThrow(/regraNivel/);
    expect(() => importarJson(com({ regras: { ...base.regras, xpProximoNivel: '900' } }))).toThrow(/xpProximoNivel/);
    expect(() => importarJson(com({ regras: { ...base.regras, incrementoXpPorNivel: -1 } }))).toThrow(/incrementoXpPorNivel/);
    expect(() => importarJson(com({ pontosDePoderDisponiveis: 'muitos' }))).toThrow(/pontosDePoderDisponiveis/);
    expect(() => importarJson(com({ pontosDePoderDisponiveis: -2 }))).toThrow(/pontosDePoderDisponiveis/);
  });
});
