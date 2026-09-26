import { describe, expect, it } from 'vitest';
import type { AtributoId, ChaveCombate, Ficha, GrupoPericia } from '../../src/model/types';
import dados from '../../src/data/alexsander.json';
import {
  alertaBonusNivel,
  baseAtributo,
  bonusNivelEsperado,
  combate,
  dadosPorNivel,
  dano,
  diferencaAtributos,
  golpe,
  migrarFicha,
  mostraNaBatalha,
  novaSessao,
  pontosRestantes,
  pvBase,
  poderUsavel,
  pvTotal,
  resumoBatalha,
  subirNivel,
  totalAtributo,
  totalAtributoFicha,
  totalPericia,
  tsuValor,
  usoDoPoder,
} from '../../src/engine';

const ficha = dados as Ficha;

/** Cópia profunda para testes que alteram a ficha sem contaminar os demais. */
function clonar(): Ficha {
  return structuredClone(ficha);
}

const golpeDevastador = ficha.golpes[0];

describe('baseAtributo e totalAtributo', () => {
  it('base soma bônus de nível e pontos; total soma também os extras', () => {
    const a = { bonusNivel: 47, pontos: 215, extras: [{ nome: 'A', valor: 50 }, { nome: 'B', valor: 10 }] };
    expect(baseAtributo(a)).toBe(262);
    expect(totalAtributo(a)).toBe(322);
  });

  it('sem extras, total é igual à base', () => {
    const a = { bonusNivel: 1, pontos: 2, extras: [] };
    expect(totalAtributo(a)).toBe(baseAtributo(a));
    expect(totalAtributo(a)).toBe(3);
  });

  it.each<[AtributoId, number]>([
    ['forca', 322],
    ['agilidade', 272],
    ['reflexos', 207],
    ['fortitude', 242],
    ['distancia', 152],
    ['mental', 165],
  ])('atributo %s da ficha tem total %i', (id, esperado) => {
    expect(totalAtributoFicha(ficha, id)).toBe(esperado);
  });
});

describe('pontosRestantes', () => {
  it('é zero na ficha do Alexsander', () => {
    expect(pontosRestantes(ficha)).toBe(0);
  });

  it('reflete pontos ainda não distribuídos e excedentes', () => {
    const f = clonar();
    f.atributos.forca.pontos -= 10;
    expect(pontosRestantes(f)).toBe(10);
    f.atributos.mental.pontos += 25;
    expect(pontosRestantes(f)).toBe(-15);
  });

  it('usa os pontos iniciais das regras', () => {
    const f = clonar();
    f.regras.pontosIniciais = 1020;
    expect(pontosRestantes(f)).toBe(2);
  });
});

describe('bonusNivelEsperado e alertaBonusNivel', () => {
  it('é 47 no nível 41 (referência das regras)', () => {
    expect(bonusNivelEsperado(ficha)).toBe(47);
  });

  it('cresce bonusPorNivel a cada nível acima ou abaixo da referência', () => {
    const f = clonar();
    f.identidade.nivel = 42;
    expect(bonusNivelEsperado(f)).toBe(51);
    f.identidade.nivel = 40;
    expect(bonusNivelEsperado(f)).toBe(43);
  });

  it('não há alerta na ficha atual', () => {
    expect(alertaBonusNivel(ficha)).toBeNull();
  });

  it('há alerta quando algum bônus de nível diverge, citando o esperado', () => {
    const f = clonar();
    f.atributos.mental.bonusNivel = 23;
    const alerta = alertaBonusNivel(f);
    expect(alerta).not.toBeNull();
    expect(alerta).toContain('47');
    expect(alerta).toContain('Mental');
    expect(alerta).not.toContain('Força');
  });
});

describe('diferencaAtributos', () => {
  it('compara a base (sem extras): 272 (Agilidade) contra 152 (Distância) = 120, sem exceder', () => {
    expect(diferencaAtributos(ficha)).toEqual({
      maior: 'agilidade',
      menor: 'distancia',
      diferencia: 120,
      limite: 120,
      excedeu: false,
    });
  });

  it('extras não entram na comparação (Força total 322 não pesa)', () => {
    const f = clonar();
    f.atributos.forca.extras = [{ nome: 'X', valor: 1000 }];
    expect(diferencaAtributos(f).maior).toBe('agilidade');
  });

  it('marca excedeu quando a diferença passa do limite', () => {
    const f = clonar();
    f.atributos.distancia.pontos -= 1;
    const r = diferencaAtributos(f);
    expect(r.diferencia).toBe(121);
    expect(r.excedeu).toBe(true);
  });

  it('respeita o limite das regras', () => {
    const f = clonar();
    f.regras.diferencaMaximaAtributos = 100;
    expect(diferencaAtributos(f).excedeu).toBe(true);
  });
});

describe('totalPericia', () => {
  it('soma inicial, atributo governante e graduação', () => {
    const f = clonar();
    const espada = f.pericias.find((p) => p.id === 'espada')!;
    espada.graduacao = 7;
    expect(totalPericia(f, 'espada')).toBe(336 + 272 + 7);
  });

  it('lança erro claro para id inexistente', () => {
    expect(() => totalPericia(ficha, 'inexistente')).toThrow(/inexistente/);
  });

  it('atinge os valores de destaque do contrato v2', () => {
    expect(totalPericia(ficha, 'atuacao')).toBe(301); // mental
    expect(totalPericia(ficha, 'furtividade')).toBe(408); // agilidade
    expect(totalPericia(ficha, 'intimidar')).toBe(458);
    expect(totalPericia(ficha, 'perceber')).toBe(501);
    expect(totalPericia(ficha, 'manipular_tsu')).toBe(501);
    expect(totalPericia(ficha, 'espada')).toBe(608);
    expect(totalPericia(ficha, 'escudo')).toBe(608);
    expect(totalPericia(ficha, 'luta')).toBe(408);
    expect(totalPericia(ficha, 'arma_de_fogo')).toBe(408);
  });

  it('inclui as parcelas derivadas e os extras manuais do atributo (Força 322 em intimidar)', () => {
    const f = clonar();
    expect(totalPericia(f, 'intimidar')).toBe(458);
    f.atributos.forca.extras.push({ nome: 'Poção', valor: 5 });
    expect(totalPericia(f, 'intimidar')).toBe(458 + 5);
    delete f.poderes.find((p) => p.id === 'forca_das_montanhas_divinas')!.escala;
    expect(totalPericia(f, 'intimidar')).toBe(458 + 5 - 60);
  });

  // Totais por grupo, conforme atributo governante e inicial (planilha correta, nível 41).
  const esperadosPorGrupo: Record<GrupoPericia, Record<string, number>> = {
    artes: { atuacao: 301, canto: 301, danca: 301, instrumentos_musicais: 301, oficios: 301 },
    ciencias: {
      geografia: 301, historia: 301, quimica: 301, ecologia: 301, medicina: 301,
      veterinaria: 301, manipular_tsu_ciencia: 301, meteorologia: 301,
      ciencias_ocultas: 301, engenharia_ciencia: 301,
    },
    crime: {
      armadilha: 301, arrombamento: 301, disfarce: 301, furtividade: 408, falsificacao: 301,
      punga: 408, rastreio: 301, jogos_de_azar: 301, fuga: 301,
    },
    esporte: { corrida: 408, acrobacia: 408, escalar: 408, cavalgar: 408, natacao: 408 },
    idioma: {
      criptografia: 301, leitura_labial: 301, linguagem_dos_sinais: 301,
      linguas_atuais: 301, linguas_antigas: 301,
    },
    investigacao: {
      disfarce_inv: 301, criptografia_inv: 301, rastrear_inv: 301, perceber: 501,
      sentir_motivacao: 301, ouvir: 301, observar: 301,
    },
    manipulacao: {
      blefar: 301, lideranca: 301, trato_social: 301, seducao: 301,
      trato_com_animais: 301, intimidar: 458,
    },
    sobrevivencia: {
      escalar_sob: 408, armadilha_sob: 408, meteorologia_sob: 301, rastrear_sob: 301,
      perceber_sob: 301, corrida_sob: 408, fuga_sob: 408,
    },
    tecnologia: { conducao: 408, pilotagem: 408, velejar: 408, engenharia: 301, mecanica: 408 },
    combate: { luta: 408, manipular_tsu: 501, espada: 608, arma_de_fogo: 408, escudo: 608 },
  };

  describe.each(Object.entries(esperadosPorGrupo))('grupo %s', (grupo, esperados) => {
    it.each(Object.entries(esperados))('perícia %s tem total %i', (id, total) => {
      expect(totalPericia(ficha, id)).toBe(total);
    });

    it('cobre exatamente as perícias do grupo na ficha', () => {
      const idsDaFicha = ficha.pericias.filter((p) => p.grupo === grupo).map((p) => p.id).sort();
      expect(Object.keys(esperados).sort()).toEqual(idsDaFicha);
    });
  });

  it('o oráculo cobre as 64 perícias da ficha', () => {
    const total = Object.values(esperadosPorGrupo).reduce((s, g) => s + Object.keys(g).length, 0);
    expect(total).toBe(ficha.pericias.length);
  });
});

describe('pvBase e pvTotal', () => {
  it('base é basePv vezes o total de fortitude (12 × 242 = 2904)', () => {
    expect(pvBase(ficha)).toBe(2904);
  });

  it('total soma os PV extras (Proteção Divina nível 2: +1000 = 3904; a planilha traz o nível 1, com 3404)', () => {
    expect(pvTotal(ficha)).toBe(3904);
  });

  it('acompanha alterações de fortitude e de PV extras', () => {
    const f = clonar();
    f.atributos.fortitude.extras = [{ nome: 'X', valor: 2 }];
    f.pvExtras.push({ nome: 'Y', valor: 100 });
    expect(pvBase(f)).toBe(12 * 244);
    expect(pvTotal(f)).toBe(12 * 244 + 1100);
  });
});

describe('dadosPorNivel', () => {
  it('rola 1d no nível 35 e 2d no nível 41', () => {
    expect(dadosPorNivel(35)).toBe(1);
    expect(dadosPorNivel(41)).toBe(2);
  });

  it('aumenta um dado por bloco de 10 níveis a partir do 31', () => {
    expect(dadosPorNivel(31)).toBe(1);
    expect(dadosPorNivel(40)).toBe(1);
    expect(dadosPorNivel(51)).toBe(3);
  });
});

describe('combate', () => {
  const oraculo: Record<ChaveCombate, number> = {
    ataqueArmaBranca: 1078,
    ataqueMagico: 781,
    ataqueLuta: 688,
    ataqueArmaFogo: 688,
    esquivar: 540,
    bloquear: 941,
    aparar: 1094,
  };

  it.each(Object.entries(oraculo))('%s tem total %i', (chave, total) => {
    expect(combate(ficha, chave as ChaveCombate).total).toBe(total);
  });

  it.each(Object.keys(oraculo))('a soma da composição de %s é o total', (chave) => {
    const r = combate(ficha, chave as ChaveCombate);
    expect(r.composicao.reduce((s, x) => s + x.valor, 0)).toBe(r.total);
  });

  it('a composição do ataque com arma branca lista a perícia, as parcelas dos poderes e as fontes manuais', () => {
    const { composicao } = combate(ficha, 'ataqueArmaBranca');
    expect(composicao.map((x) => x.valor)).toEqual([608, 150, 210, 30, 120, -70, 30]);
    expect(composicao.map((x) => x.nome)).toContain('Lugan da Batalha');
  });

  it('dados: dadosPorNivel mais os dados extras (Jikar +3)', () => {
    expect(combate(ficha, 'ataqueArmaBranca').dados).toBe(5);
    expect(combate(ficha, 'aparar').dados).toBe(5);
    expect(combate(ficha, 'esquivar').dados).toBe(5);
    expect(combate(ficha, 'bloquear').dados).toBe(5);
    expect(combate(ficha, 'ataqueMagico').dados).toBe(2);
    expect(combate(ficha, 'ataqueLuta').dados).toBe(2);
  });

  it('sem fiéis, o bônus de fiéis é zero', () => {
    for (const chave of Object.keys(oraculo)) {
      expect(combate(ficha, chave as ChaveCombate).fieisBonus).toBe(0);
    }
  });

  it('fiéis somam floor(fiéis / N): 1 por 200 no ataque, 1 por 100 na esquiva', () => {
    const f = clonar();
    f.fieis = 450;
    const ataque = combate(f, 'ataqueArmaBranca');
    expect(ataque.fieisBonus).toBe(2);
    expect(ataque.total).toBe(1078 + 2);
    const esquiva = combate(f, 'esquivar');
    expect(esquiva.fieisBonus).toBe(4);
    expect(esquiva.total).toBe(540 + 4);
    expect(esquiva.composicao.reduce((s, x) => s + x.valor, 0)).toBe(esquiva.total);
  });

  it('fieisPor nulo ignora os fiéis', () => {
    const f = clonar();
    f.fieis = 32000;
    expect(combate(f, 'ataqueMagico')).toMatchObject({ fieisBonus: 0, total: 781 });
  });

  it('usa a fonte de cada chave individualmente', () => {
    const f = clonar();
    f.combate.esquivar.fontes = [{ nome: 'Só este', valor: 10 }];
    // as parcelas derivadas dos poderes (Lugan da Batalha 150 e Lugan Completo 30) continuam somando
    expect(combate(f, 'esquivar').total).toBe(207 + 3 + 150 + 30 + 10);
    expect(combate(f, 'ataqueArmaBranca').total).toBe(1078);
    expect(combate(f, 'aparar').total).toBe(1094);
  });
});

describe('dano', () => {
  it('básico: 3d×322 +120', () => {
    expect(dano(ficha)).toEqual({
      dados: 3,
      multiplicador: 322,
      fixo: 120,
      fieisBonus: 0,
      texto: '3d×322 +120',
    });
  });

  it('com Golpe Devastador: 5d×322 +120', () => {
    const r = dano(ficha, golpeDevastador);
    expect(r.dados).toBe(5);
    expect(r.texto).toBe('5d×322 +120');
  });

  it('fiéis somam 1 por 400 ao bônus fixo mostrado no texto', () => {
    const f = clonar();
    f.fieis = 850;
    const r = dano(f);
    expect(r.fieisBonus).toBe(2);
    expect(r.fixo).toBe(120);
    expect(r.texto).toBe('3d×322 +122');
  });

  it('o multiplicador acompanha o atributo configurado', () => {
    const f = clonar();
    f.dano.atributo = 'agilidade';
    expect(dano(f).multiplicador).toBe(272);
  });
});

describe('golpe', () => {
  it('Golpe Devastador: ataque de 8d, total 1078 e dano 5d×322 +120', () => {
    const r = golpe(ficha, golpeDevastador);
    expect(r.ataqueDados).toBe(8);
    expect(r.ataqueTotal).toBe(1078);
    expect(r.dano.texto).toBe('5d×322 +120');
  });
});

describe('subirNivel', () => {
  it('sobe um nível e soma bonusPorNivel a todos os atributos', () => {
    const f = subirNivel(ficha, 1);
    expect(f.identidade.nivel).toBe(42);
    for (const a of Object.values(f.atributos)) expect(a.bonusNivel).toBe(51);
    expect(alertaBonusNivel(f)).toBeNull();
  });

  it('sobe vários níveis de uma vez', () => {
    const f = subirNivel(ficha, 3);
    expect(f.identidade.nivel).toBe(44);
    expect(f.atributos.mental.bonusNivel).toBe(47 + 12);
    expect(dadosPorNivel(f.identidade.nivel)).toBe(2);
  });

  it('é pura: não altera a ficha original e devolve outra instância', () => {
    const f = clonar();
    const antes = JSON.stringify(f);
    const nova = subirNivel(f, 1);
    expect(JSON.stringify(f)).toBe(antes);
    expect(nova).not.toBe(f);
    nova.atributos.forca.extras.push({ nome: 'X', valor: 1 });
    expect(f.atributos.forca.extras).toHaveLength(0);
  });

  it('rejeita quantidade que não seja inteiro positivo', () => {
    expect(() => subirNivel(ficha, 0)).toThrow();
    expect(() => subirNivel(ficha, -1)).toThrow();
    expect(() => subirNivel(ficha, 1.5)).toThrow();
  });
});

describe('tsuValor', () => {
  it('multiplica por 8 quando real: fogo e terra valem 384', () => {
    const valor = (e: string) => tsuValor(ficha.tsu.find((t) => t.elemento === e)!);
    expect(valor('fogo')).toBe(384);
    expect(valor('terra')).toBe(384);
  });

  it('mantém o nível quando não é real', () => {
    expect(tsuValor(ficha.tsu.find((t) => t.elemento === 'agua')!)).toBe(6);
  });
});

describe('novaSessao', () => {
  it('começa com PV total cheio, fadiga zero e sem usos', () => {
    const s = novaSessao(ficha);
    expect(s.pvAtual).toBe(3904);
    expect(s.fadiga).toBe(0);
    expect(s.anotacoes).toBe('');
    expect(s).not.toHaveProperty('rolagens');
    expect(Object.keys(s.usosPoder).sort()).toEqual(ficha.poderes.map((p) => p.id).sort());
    expect(Object.values(s.usosPoder).every((u) => u === 0)).toBe(true);
  });

  it('devolve objetos independentes a cada chamada', () => {
    const a = novaSessao(ficha);
    const b = novaSessao(ficha);
    a.usosPoder[ficha.poderes[0].id] = 3;
    expect(b.usosPoder[ficha.poderes[0].id]).toBe(0);
  });
});

describe('migrarFicha', () => {
  // Trecho mínimo de uma ficha versão 1 (modelo antigo, com bônus 23 e sem regras).
  const v1 = () => ({
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
      fortitude: { bonus: 23, pontos: 195, bonusExtra: 5 },
      distancia: { bonus: 23, pontos: 105, bonusExtra: 0 },
      mental: { bonus: 23, pontos: 118, bonusExtra: 0 },
    },
    pericias: [{ id: 'espada', nome: 'Espada', grupo: 'combate', atributo: 'agilidade', inicial: 336, graduacao: 0 }],
    combate: {
      bonusPassivo: {
        ataqueArmaBranca: 50, ataqueMagico: 50, ataqueLuta: 50, ataqueArmaFogo: 50,
        esquivar: 50, bloquear: 0, aparar: 50,
      },
    },
    poderes: [
      { id: 'lugan_da_batalha', nome: 'Lugan da Batalha', nivel: 1, descricao: 'x' },
      { id: 'golpe_especial_campeao', nome: 'Golpe', nivel: 1, descricao: 'y', custoFadiga: 10 },
    ],
    tsu: [{ elemento: 'terra', nivel: 6, real: true }],
    xp: { total: 0, atual: 0 },
  });

  it('converte a versão 1 para a versão 2', () => {
    const f = migrarFicha(v1());
    expect(f.versao).toBe(2);
    expect(f.identidade).toMatchObject({ nome: 'Teste', nivel: 41, basePv: 12, armaPrincipal: '' });
    expect(f.regras).toEqual({
      pontosIniciais: 1018,
      bonusPorNivel: 4,
      nivelReferencia: 41,
      bonusReferencia: 47,
      diferencaMaximaAtributos: 120,
    });
    expect(f.fieis).toBe(0);
    expect(f.pvExtras).toEqual([]);
    expect(f.golpes).toEqual([]);
    expect(f.xp).toEqual({ total: 0, atual: 0 });
  });

  it('converte atributos: bonus vira bonusNivel e bonusExtra vira extra nomeado', () => {
    const f = migrarFicha(v1());
    expect(f.atributos.forca).toEqual({ bonusNivel: 23, pontos: 215, extras: [] });
    expect(f.atributos.fortitude.extras).toEqual([{ nome: 'Bônus extra', valor: 5 }]);
    expect(totalAtributo(f.atributos.fortitude)).toBe(23 + 195 + 5);
  });

  it('converte o bônus passivo em fonte nomeada e mantém o total de combate', () => {
    const f = migrarFicha(v1());
    expect(f.combate.ataqueArmaBranca.fontes).toEqual([{ nome: 'Bônus passivo', valor: 50 }]);
    expect(f.combate.bloquear.fontes).toEqual([]);
    expect(f.combate.ataqueArmaBranca.fieisPor).toBe(200);
    expect(f.combate.esquivar.fieisPor).toBe(100);
    expect(f.combate.ataqueMagico.fieisPor).toBeNull();
    // espada: 336 + agilidade (23 + 225) + 50 de fonte
    expect(combate(f, 'ataqueArmaBranca').total).toBe(336 + 248 + 50);
  });

  it('converte poderes: tipo passivo por padrão e ativo quando tem custo de fadiga', () => {
    const f = migrarFicha(v1());
    expect(f.poderes[0]).toMatchObject({ id: 'lugan_da_batalha', tipo: 'passivo', nivel: 1 });
    expect(f.poderes[1]).toMatchObject({ tipo: 'ativo', custoFadiga: 10 });
    expect(f.poderes[0]).not.toHaveProperty('custoFadiga');
  });

  it('cria o dano padrão e preserva a tsu', () => {
    const f = migrarFicha(v1());
    expect(f.dano).toEqual({ atributo: 'forca', dadosExtras: [], fixos: [], fieisPor: 400 });
    expect(f.tsu).toEqual([{ elemento: 'terra', nivel: 6, real: true }]);
  });

  it('a ficha migrada dispara o alerta de bônus de nível (23 em vez de 47)', () => {
    expect(alertaBonusNivel(migrarFicha(v1()))).not.toBeNull();
  });

  it('não altera a entrada', () => {
    const entrada = v1();
    const antes = JSON.stringify(entrada);
    migrarFicha(entrada);
    expect(JSON.stringify(entrada)).toBe(antes);
  });

  it('a versão 2 passa sem alterações', () => {
    expect(migrarFicha(ficha)).toStrictEqual(ficha);
  });

  it('rejeita versão desconhecida e conteúdo que não é objeto', () => {
    expect(() => migrarFicha({ versao: 3 })).toThrow(/versão/);
    expect(() => migrarFicha(null)).toThrow();
    expect(() => migrarFicha('texto')).toThrow();
  });
});

describe('mostraNaBatalha, poderUsavel e usoDoPoder', () => {
  const base = { id: 'x', nome: 'X', nivel: 1, descricao: '' };

  it('defensivo e item aparecem por padrão; passivo e ativo só se marcados; removido nunca', () => {
    expect(mostraNaBatalha({ ...base, tipo: 'defensivo' })).toBe(true);
    expect(mostraNaBatalha({ ...base, tipo: 'item' })).toBe(true);
    expect(mostraNaBatalha({ ...base, tipo: 'passivo' })).toBe(false);
    expect(mostraNaBatalha({ ...base, tipo: 'ativo' })).toBe(false);
    expect(mostraNaBatalha({ ...base, tipo: 'passivo', mostrarNaBatalha: true })).toBe(true);
    expect(mostraNaBatalha({ ...base, tipo: 'defensivo', mostrarNaBatalha: false })).toBe(false);
    expect(mostraNaBatalha({ ...base, tipo: 'removido', mostrarNaBatalha: true })).toBe(false);
  });

  it('poder consumível tem usos por dia ou custo de fadiga e não é removido', () => {
    expect(poderUsavel({ ...base, tipo: 'ativo', usosPorDia: 3 })).toBe(true);
    expect(poderUsavel({ ...base, tipo: 'ativo', custoFadiga: 5 })).toBe(true);
    expect(poderUsavel({ ...base, tipo: 'passivo' })).toBe(false);
    expect(poderUsavel({ ...base, tipo: 'removido', usosPorDia: 1 })).toBe(false);
  });

  it('usos restantes nunca ficam negativos e o poder esgota no limite', () => {
    const poder = { ...base, tipo: 'ativo' as const, usosPorDia: 3 };
    const sessao = { pvAtual: 0, fadiga: 0, anotacoes: '', usosPoder: { x: 5 } };
    expect(usoDoPoder(poder, sessao)).toMatchObject({ usados: 5, limite: 3, restantes: 0, esgotado: true });
    expect(usoDoPoder(poder, { ...sessao, usosPoder: {} })).toMatchObject({ usados: 0, restantes: 3, esgotado: false });
    expect(usoDoPoder({ ...base, tipo: 'ativo', custoFadiga: 4 }, sessao)).toMatchObject({ limite: null, restantes: null, esgotado: false, custoFadiga: 4 });
  });
});

describe('resumoBatalha', () => {
  const resumo = () => resumoBatalha(ficha, novaSessao(ficha));

  it('traz o card Minha rodada: PV, fadiga, rolagem base, arma e Velocidade Divina', () => {
    const r = resumo();
    expect(r.pv).toEqual({ atual: 3904, total: 3904 });
    expect(r.fadiga).toBe(0);
    expect(r.rolagemBase).toBe('2d×100');
    expect(r.armaPrincipal).toBe('Jikar');
    expect(r.velocidadeDivina).toBe(2);
  });

  it('calcula o ataque e o dano básicos (oráculo da planilha)', () => {
    const r = resumo();
    expect(r.ataqueBasico).toEqual({ dados: 5, bonus: 1078, texto: '5d×100 +1078' });
    expect(r.danoBasico.texto).toBe('3d×322 +120');
  });

  it('calcula o Golpe Devastador com pressão de 24 km² e 3 usos restantes', () => {
    const [g] = resumo().golpes;
    expect(g.nome).toBe('Golpe Devastador de Lugan');
    expect(g.ataque.texto).toBe('8d×100 +1078');
    expect(g.dano.texto).toBe('5d×322 +120');
    expect(g.pontos).toBe(3);
    expect(g.pressaoKm2).toBe(24);
    expect(g.uso).toMatchObject({ usados: 0, limite: 3, restantes: 3, esgotado: false });
  });

  it('desconta os usos da sessão e esgota o golpe no terceiro uso', () => {
    const sessao = novaSessao(ficha);
    sessao.usosPoder.golpe_devastador = 2;
    expect(resumoBatalha(ficha, sessao).golpes[0].uso?.restantes).toBe(1);
    sessao.usosPoder.golpe_devastador = 3;
    expect(resumoBatalha(ficha, sessao).golpes[0].uso).toMatchObject({ restantes: 0, esgotado: true });
  });

  it('lista as defesas na ordem aparar, bloquear, esquivar com os valores da planilha', () => {
    const d = resumo().defesas;
    expect(d.map((x) => x.nome)).toEqual(['Aparar', 'Bloquear', 'Esquivar']);
    expect(d.map((x) => x.rolagem.bonus)).toEqual([1094, 941, 540]);
    // A Jikar dá +3 dados também nas defesas (dados extras da ficha), então todas rolam 5d.
    expect(d.map((x) => x.rolagem.texto)).toEqual(['5d×100 +1094', '5d×100 +941', '5d×100 +540']);
  });

  it('as absorções vêm de defensivo, item e dos passivos marcados', () => {
    const nomes = resumo().protecoes.map((p) => p.nome);
    expect(nomes).toEqual(['Portador da Jikar', 'Proteção Divina', 'Lugan Completo']);
    const protecao = resumo().protecoes.find((p) => p.id === 'protecao_divina');
    expect(protecao?.descricao).toContain('absorve 200');
    expect(protecao?.uso).toMatchObject({ limite: 2, restantes: 2 });
  });

  it('desmarcar um poder o tira das absorções e o tipo removido o esconde', () => {
    const f = clonar();
    f.poderes.find((p) => p.id === 'lugan_completo')!.mostrarNaBatalha = false;
    f.poderes.find((p) => p.id === 'portador_da_jikar')!.tipo = 'removido';
    expect(resumoBatalha(f, novaSessao(f)).protecoes.map((p) => p.id)).toEqual(['protecao_divina']);
  });

  it('lista os usos apenas de poderes com usos por dia ou custo de fadiga', () => {
    expect(resumo().usos.map((u) => [u.id, u.restantes])).toEqual([
      ['golpe_devastador', 3],
      ['protecao_divina', 2],
      ['o_filho_de_hagashi', 1],
    ]);
  });

  it('repassa ações, reações e lembretes editáveis da ficha', () => {
    const r = resumo();
    expect(r.acoes.map((a) => a.nome)).toEqual(['Terra Real', 'Fogo Real']);
    expect(r.reacoes).toHaveLength(5);
    expect(r.lembretes).toContain('Terra Real: 1d×48 direto no PV.');
  });

  it('acompanha as edições: fiéis somam ao ataque e ao dano e a pressão muda com os pontos', () => {
    const f = clonar();
    f.fieis = 400;
    f.golpes[0].pressaoPorPonto = 10;
    const r = resumoBatalha(f, novaSessao(f));
    expect(r.ataqueBasico.bonus).toBe(1080);
    expect(r.danoBasico.texto).toBe('3d×322 +121');
    expect(r.golpes[0].pressaoKm2).toBe(30);
  });

  it('sem poder correspondente ou sem pressão por ponto, o golpe não tem uso nem pressão', () => {
    const f = clonar();
    f.poderes = f.poderes.filter((p) => p.id !== 'golpe_devastador');
    expect(resumoBatalha(f, novaSessao(f)).golpes[0]).toMatchObject({ pontos: null, pressaoKm2: null, uso: null });
    // Sem o valor do golpe, vale o efeito pressao_km2 do poder; sem os dois, não há pressão.
    const g = clonar();
    delete g.golpes[0].pressaoPorPonto;
    expect(resumoBatalha(g, novaSessao(g)).golpes[0].pressaoKm2).toBe(24);
    g.poderes.find((p) => p.id === 'golpe_devastador')!.escala!.efeitos = [];
    expect(resumoBatalha(g, novaSessao(g)).golpes[0].pressaoKm2).toBeNull();
  });

  it('não altera a ficha nem a sessão', () => {
    const f = clonar();
    const s = novaSessao(f);
    const antes = JSON.stringify([f, s]);
    resumoBatalha(f, s);
    expect(JSON.stringify([f, s])).toBe(antes);
  });
});

describe('migrarFicha e os textos da aba Batalha', () => {
  /** Ficha versão 2 salva antes da aba Batalha: sem os três campos, sem usos no golpe e sem pressão. */
  const anterior = () => {
    const f = clonar() as unknown as Record<string, unknown> & Ficha;
    delete (f as Partial<Ficha>).acoes;
    delete (f as Partial<Ficha>).lembretes;
    delete (f as Partial<Ficha>).reacoes;
    delete f.poderes.find((p) => p.id === 'golpe_devastador')!.usosPorDia;
    delete f.poderes.find((p) => p.id === 'lugan_completo')!.mostrarNaBatalha;
    delete f.golpes[0].pressaoPorPonto;
    return f;
  };

  it('completa a ficha anterior com os padrões: textos, usos do golpe igual ao nível e pressão', () => {
    const f = migrarFicha(anterior());
    expect(f.versao).toBe(2);
    expect(f.acoes).toEqual(ficha.acoes);
    expect(f.lembretes).toEqual(ficha.lembretes);
    expect(f.reacoes).toEqual(ficha.reacoes);
    expect(f.poderes.find((p) => p.id === 'golpe_devastador')?.usosPorDia).toBe(3);
    expect(f.golpes[0].pressaoPorPonto).toBe(8);
  });

  it('não sobrescreve listas presentes, mesmo vazias, nem apaga escolhas do jogador', () => {
    const f = clonar();
    f.acoes = [];
    f.lembretes = ['Só este'];
    delete f.poderes.find((p) => p.id === 'golpe_devastador')!.usosPorDia;
    const m = migrarFicha(f);
    expect(m.acoes).toEqual([]);
    expect(m.lembretes).toEqual(['Só este']);
    expect(m.reacoes).toEqual(ficha.reacoes);
    expect(m.poderes.find((p) => p.id === 'golpe_devastador')?.usosPorDia).toBeUndefined();
  });

  it('entrega cópias novas dos padrões (editar uma ficha não contamina outra)', () => {
    const a = migrarFicha(anterior());
    const b = migrarFicha(anterior());
    a.acoes[0].nome = 'Alterada';
    a.lembretes.push('novo');
    expect(b.acoes[0].nome).toBe('Terra Real');
    expect(b.lembretes).toHaveLength(8);
  });

  it('a migração da versão 1 também recebe os textos padrão', () => {
    const f = migrarFicha({
      versao: 1,
      identidade: { nome: 'T', jogador: 'J', raca: 'R', reino: 'K', pilarLuganico: 'P', nivel: 41, nivelLuganico: 3, basePv: 12 },
      pontosIniciais: 1018,
      atributos: Object.fromEntries(['forca', 'agilidade', 'reflexos', 'fortitude', 'distancia', 'mental'].map((id) => [id, { bonus: 23, pontos: 1, bonusExtra: 0 }])),
      pericias: [],
      combate: { bonusPassivo: { ataqueArmaBranca: 0, ataqueMagico: 0, ataqueLuta: 0, ataqueArmaFogo: 0, esquivar: 0, bloquear: 0, aparar: 0 } },
      poderes: [],
      tsu: [],
      xp: { total: 0, atual: 0 },
    });
    expect(f.acoes).toEqual(ficha.acoes);
    expect(f.lembretes).toHaveLength(8);
    expect(f.reacoes).toHaveLength(5);
  });
});

describe('pureza', () => {
  it('as funções não alteram a ficha recebida', () => {
    const f = clonar();
    const antes = JSON.stringify(f);
    pontosRestantes(f);
    totalPericia(f, 'espada');
    pvBase(f);
    pvTotal(f);
    bonusNivelEsperado(f);
    alertaBonusNivel(f);
    diferencaAtributos(f);
    for (const c of Object.keys(f.combate)) combate(f, c as ChaveCombate);
    dano(f, f.golpes[0]);
    golpe(f, f.golpes[0]);
    subirNivel(f, 2);
    novaSessao(f);
    resumoBatalha(f, novaSessao(f));
    migrarFicha(f);
    expect(JSON.stringify(f)).toBe(antes);
  });
});
