import { describe, expect, it } from 'vitest';
import type { Ficha } from '../../src/model/types';
import alexsander from '../../src/data/alexsander.json';
import { alertaBonusNivel, totalAtributo } from '../../src/engine';
import { exportarJson, importarJson } from '../../src/import/json';
import antiga from '../fixtures/alexsander-v2-sem-escala.json';

const ficha = alexsander as Ficha;

/** Trecho mínimo, mas válido, de uma ficha versão 1. */
function v1() {
  return {
    versao: 1,
    identidade: {
      nome: 'Teste', jogador: 'J', raca: 'R', reino: 'K', pilarLuganico: 'Senhor dos Ossos',
      nivel: 41, nivelLuganico: 3, basePv: 12,
    },
    pontosIniciais: 1018,
    atributos: {
      forca: { bonus: 23, pontos: 215, bonusExtra: 0 },
      agilidade: { bonus: 23, pontos: 225, bonusExtra: 0 },
      reflexos: { bonus: 23, pontos: 160, bonusExtra: 0 },
      fortitude: { bonus: 23, pontos: 195, bonusExtra: 0 },
      distancia: { bonus: 23, pontos: 105, bonusExtra: 0 },
      mental: { bonus: 23, pontos: 118, bonusExtra: 60 },
    },
    pericias: [{ id: 'espada', nome: 'Espada', grupo: 'combate', atributo: 'agilidade', inicial: 336, graduacao: 0 }],
    combate: {
      bonusPassivo: {
        ataqueArmaBranca: 50, ataqueMagico: 50, ataqueLuta: 50, ataqueArmaFogo: 50,
        esquivar: 50, bloquear: 50, aparar: 50,
      },
    },
    poderes: [{ id: 'lugan_da_batalha', nome: 'Lugan da Batalha', nivel: 1, descricao: 'x' }],
    tsu: [{ elemento: 'terra', nivel: 6, real: true }],
    xp: { total: 0, atual: 0 },
  };
}

describe('exportarJson e importarJson', () => {
  it('faz ida e volta sem perda', () => {
    expect(importarJson(exportarJson(ficha))).toStrictEqual(ficha);
  });

  it('rejeita texto que não é JSON', () => {
    expect(() => importarJson('{ quebrado')).toThrow(/JSON válido/);
  });

  it('rejeita conteúdo que não é objeto', () => {
    expect(() => importarJson('[1, 2]')).toThrow(/deve ser um objeto/);
  });

  it('rejeita versão desconhecida', () => {
    expect(() => importarJson(JSON.stringify({ ...ficha, versao: 3 }))).toThrow(/versão não suportada/);
    expect(() => importarJson(JSON.stringify({ ...ficha, versao: undefined }))).toThrow(/versão não suportada/);
  });

  it('rejeita ficha sem atributo obrigatório', () => {
    const { mental: _mental, ...resto } = ficha.atributos;
    const texto = JSON.stringify({ ...ficha, atributos: resto });
    expect(() => importarJson(texto)).toThrow(/atributo mental ausente/);
  });

  it('rejeita atributo sem a lista de extras', () => {
    const atributos = { ...ficha.atributos, forca: { bonusNivel: 47, pontos: 215 } };
    expect(() => importarJson(JSON.stringify({ ...ficha, atributos }))).toThrow(/atributos.forca.extras/);
  });

  it('rejeita perícia com atributo desconhecido', () => {
    const pericias = [{ ...ficha.pericias[0], atributo: 'sorte' }];
    expect(() => importarJson(JSON.stringify({ ...ficha, pericias }))).toThrow(/atributo desconhecido/);
  });

  it('rejeita valores não numéricos em campos numéricos', () => {
    const identidade = { ...ficha.identidade, nivel: '41' };
    expect(() => importarJson(JSON.stringify({ ...ficha, identidade }))).toThrow(/identidade.nivel/);
  });

  it('rejeita fonte de combate sem valor numérico', () => {
    const combate = {
      ...ficha.combate,
      esquivar: { ...ficha.combate.esquivar, fontes: [{ nome: 'X', valor: '5' }] },
    };
    expect(() => importarJson(JSON.stringify({ ...ficha, combate }))).toThrow(/combate.esquivar.fontes/);
  });

  it('rejeita poder com tipo desconhecido', () => {
    const poderes = [{ ...ficha.poderes[0], tipo: 'mágico' }];
    expect(() => importarJson(JSON.stringify({ ...ficha, poderes }))).toThrow(/tipo desconhecido/);
  });

  it('rejeita ficha sem regras, sem fiéis ou sem dano', () => {
    const { regras: _r, ...semRegras } = ficha;
    const { fieis: _f, ...semFieis } = ficha;
    const { dano: _d, ...semDano } = ficha;
    expect(() => importarJson(JSON.stringify(semRegras))).toThrow(/regras/);
    expect(() => importarJson(JSON.stringify(semFieis))).toThrow(/fieis/);
    expect(() => importarJson(JSON.stringify(semDano))).toThrow(/dano/);
  });

  it('aceita nível de poder nulo (item) e campos opcionais ausentes', () => {
    const jikar = ficha.poderes.find((p) => p.nivel === null);
    expect(jikar).toBeDefined();
    expect(() => importarJson(exportarJson(ficha))).not.toThrow();
  });
});

describe('importarJson e os textos da aba Batalha', () => {
  it('aceita a versão 2 sem os campos da aba e aplica os padrões', () => {
    const { acoes: _a, lembretes: _l, reacoes: _r, ...antiga } = ficha;
    const f = importarJson(JSON.stringify(antiga));
    expect(f.acoes).toEqual(ficha.acoes);
    expect(f.lembretes).toEqual(ficha.lembretes);
    expect(f.reacoes).toEqual(ficha.reacoes);
  });

  it('preserva listas vazias escolhidas pelo jogador', () => {
    const f = importarJson(JSON.stringify({ ...ficha, acoes: [], lembretes: [], reacoes: [] }));
    expect([f.acoes, f.lembretes, f.reacoes]).toEqual([[], [], []]);
  });

  it('rejeita ação, lembrete, reação, marca de poder e pressão inválidos', () => {
    expect(() => importarJson(JSON.stringify({ ...ficha, acoes: [{ id: 'a', nome: 'A', rolagem: 1, notas: '' }] }))).toThrow(/acoes/);
    expect(() => importarJson(JSON.stringify({ ...ficha, acoes: 'x' }))).toThrow(/acoes/);
    expect(() => importarJson(JSON.stringify({ ...ficha, lembretes: [1] }))).toThrow(/lembretes/);
    expect(() => importarJson(JSON.stringify({ ...ficha, reacoes: [{ situacao: 'x' }] }))).toThrow(/reacoes/);
    const poderes = [{ ...ficha.poderes[0], mostrarNaBatalha: 'sim' }];
    expect(() => importarJson(JSON.stringify({ ...ficha, poderes }))).toThrow(/mostrarNaBatalha/);
    const golpes = [{ ...ficha.golpes[0], pressaoPorPonto: '8' }];
    expect(() => importarJson(JSON.stringify({ ...ficha, golpes }))).toThrow(/pressaoPorPonto/);
  });
});

describe('importarJson e a escala por nível dos poderes', () => {
  const comEscala = (escala: unknown) => JSON.stringify({ ...ficha, poderes: [{ ...ficha.poderes[0], escala }, ...ficha.poderes.slice(1)] });

  it('a ficha salva antes da escala é migrada: as fontes viram parcelas derivadas dos poderes, sem ajuste do mestre', () => {
    const f = importarJson(JSON.stringify(antiga));
    // Os níveis vêm da semente do pilar (valor base × pilar + livres), não dos níveis antigos da planilha.
    // O XP é progresso do jogador: a planilha e a ficha antiga trazem 12, a embutida tem mais; é a única diferença esperada.
    expect(f).toStrictEqual({ ...structuredClone(ficha), revisaoDados: 0, xp: { total: 12, atual: 12 } });
  });

  it('aceita escala completa e a preserva na ida e volta', () => {
    const escala = {
      ataquePorNivel: { ataqueMagico: 3 }, danoPorNivel: 2, atributoPorNivel: { atributo: 'mental', valor: 4 },
      pvPorNivel: 5, usosPorNivel: 1, fieisPorNivel: 100, dadosAtaquePorNivel: 1, dadosDanoPorNivel: 1,
    };
    const f = importarJson(comEscala(escala));
    expect(f.poderes[0].escala).toMatchObject(escala);
    expect(importarJson(exportarJson(f))).toStrictEqual(f);
  });

  it('respeita a escala vazia (não semeia de novo)', () => {
    expect(importarJson(comEscala({})).poderes[0].escala).toEqual({});
  });

  it('rejeita escala inválida', () => {
    expect(() => importarJson(comEscala('x'))).toThrow(/escala/);
    expect(() => importarJson(comEscala({ danoPorNivel: '20' }))).toThrow(/danoPorNivel/);
    expect(() => importarJson(comEscala({ ataquePorNivel: { voar: 1 } }))).toThrow(/ataquePorNivel/);
    expect(() => importarJson(comEscala({ ataquePorNivel: { esquivar: 'a' } }))).toThrow(/ataquePorNivel/);
    expect(() => importarJson(comEscala({ atributoPorNivel: { atributo: 'sorte', valor: 1 } }))).toThrow(/atributoPorNivel/);
    expect(() => importarJson(comEscala({ atributoPorNivel: { atributo: 'forca' } }))).toThrow(/atributoPorNivel/);
    expect(() => importarJson(comEscala({ usosPorNivel: null }))).toThrow(/usosPorNivel/);
  });

  it('rejeita poderId que não é texto em uma fonte', () => {
    const combate = structuredClone(ficha.combate);
    combate.esquivar.fontes.push({ nome: 'X', valor: 1, poderId: 3 as unknown as string });
    expect(() => importarJson(JSON.stringify({ ...ficha, combate }))).toThrow(/fonte inválida/);
  });
});

describe('importarJson com versão 1', () => {
  it('migra para a versão 2 preservando os totais dos atributos', () => {
    const f = importarJson(JSON.stringify(v1()));
    expect(f.versao).toBe(2);
    expect(totalAtributo(f.atributos.forca)).toBe(23 + 215);
    expect(totalAtributo(f.atributos.mental)).toBe(23 + 118 + 60);
    expect(f.regras.pontosIniciais).toBe(1018);
    expect(f.reacoes).toEqual(ficha.reacoes);
  });

  it('a ficha migrada aponta o bônus de nível antigo', () => {
    expect(alertaBonusNivel(importarJson(JSON.stringify(v1())))).toContain('47');
  });

  it('rejeita versão 1 com estrutura inválida', () => {
    const { pontosIniciais: _p, ...semPontos } = v1();
    expect(() => importarJson(JSON.stringify(semPontos))).toThrow(/pontosIniciais/);
    const quebrada = v1();
    (quebrada.atributos as Record<string, unknown>).mental = { bonus: 1 };
    expect(() => importarJson(JSON.stringify(quebrada))).toThrow(/atributos.mental/);
  });

  it('o resultado da migração exportado e reimportado é estável', () => {
    const f = importarJson(JSON.stringify(v1()));
    expect(importarJson(exportarJson(f))).toStrictEqual(f);
  });
});
