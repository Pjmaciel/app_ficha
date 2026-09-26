import { describe, expect, it } from 'vitest';
import type { AtributoId, ChaveCombate, Ficha, GrupoPericia } from '../../src/model/types';
import dados from '../../src/data/alexsander.json';
import {
  combate,
  dadosPorNivel,
  novaSessao,
  pontosRestantes,
  pv,
  rolar,
  totalAtributo,
  totalPericia,
  tsuReal,
} from '../../src/engine';

const ficha = dados as Ficha;

/** Cópia profunda para testes que alteram a ficha sem contaminar os demais. */
function clonar(): Ficha {
  return structuredClone(ficha);
}

/** Gerador determinístico: devolve os valores da lista em ciclo. */
function rngFixo(...valores: number[]): () => number {
  let i = 0;
  return () => valores[i++ % valores.length];
}

describe('totalAtributo', () => {
  it('soma bônus, pontos e bônus extra', () => {
    expect(totalAtributo({ bonus: 23, pontos: 215, bonusExtra: 0 })).toBe(238);
    expect(totalAtributo({ bonus: 1, pontos: 2, bonusExtra: 3 })).toBe(6);
  });

  it.each<[AtributoId, number]>([
    ['forca', 238],
    ['agilidade', 248],
    ['reflexos', 183],
    ['fortitude', 218],
    ['distancia', 128],
    ['mental', 141],
  ])('atributo %s da ficha tem total %i', (id, esperado) => {
    expect(totalAtributo(ficha.atributos[id])).toBe(esperado);
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
});

describe('totalPericia', () => {
  it('soma inicial, atributo governante e graduação', () => {
    const f = clonar();
    const espada = f.pericias.find((p) => p.id === 'espada')!;
    espada.graduacao = 7;
    expect(totalPericia(f, 'espada')).toBe(336 + 248 + 7);
  });

  it('lança erro claro para id inexistente', () => {
    expect(() => totalPericia(ficha, 'inexistente')).toThrow(/inexistente/);
  });

  it('atinge os valores de destaque do contrato', () => {
    expect(totalPericia(ficha, 'intimidar')).toBe(374);
    expect(totalPericia(ficha, 'perceber')).toBe(477);
    expect(totalPericia(ficha, 'manipular_tsu')).toBe(477);
    expect(totalPericia(ficha, 'espada')).toBe(584);
    expect(totalPericia(ficha, 'escudo')).toBe(584);
    expect(totalPericia(ficha, 'luta')).toBe(384);
    expect(totalPericia(ficha, 'arma_de_fogo')).toBe(384);
  });

  // Totais por grupo, conforme atributo governante e inicial do contrato.
  const esperadosPorGrupo: Record<GrupoPericia, Record<string, number>> = {
    artes: { atuacao: 277, canto: 277, danca: 277, instrumentos_musicais: 277, oficios: 277 },
    ciencias: {
      geografia: 277, historia: 277, quimica: 277, ecologia: 277, medicina: 277,
      veterinaria: 277, manipular_tsu_ciencia: 277, meteorologia: 277,
      ciencias_ocultas: 277, engenharia_ciencia: 277,
    },
    crime: {
      armadilha: 277, arrombamento: 277, disfarce: 277, furtividade: 384, falsificacao: 277,
      punga: 384, rastreio: 277, jogos_de_azar: 277, fuga: 277,
    },
    esporte: { corrida: 384, acrobacia: 384, escalar: 384, cavalgar: 384, natacao: 384 },
    idioma: {
      criptografia: 277, leitura_labial: 277, linguagem_dos_sinais: 277,
      linguas_atuais: 277, linguas_antigas: 277,
    },
    investigacao: {
      disfarce_inv: 277, criptografia_inv: 277, rastrear_inv: 277, perceber: 477,
      sentir_motivacao: 277, ouvir: 277, observar: 277,
    },
    manipulacao: {
      blefar: 277, lideranca: 277, trato_social: 277, seducao: 277,
      trato_com_animais: 277, intimidar: 374,
    },
    sobrevivencia: {
      escalar_sob: 384, armadilha_sob: 384, meteorologia_sob: 277, rastrear_sob: 277,
      perceber_sob: 277, corrida_sob: 384, fuga_sob: 384,
    },
    tecnologia: { conducao: 384, pilotagem: 384, velejar: 384, engenharia: 277, mecanica: 384 },
    combate: { luta: 384, manipular_tsu: 477, espada: 584, arma_de_fogo: 384, escudo: 584 },
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

describe('pv', () => {
  it('é basePv vezes o total de fortitude (12 × 218 = 2616)', () => {
    expect(pv(ficha)).toBe(2616);
  });

  it('acompanha alterações de fortitude', () => {
    const f = clonar();
    f.atributos.fortitude.bonusExtra = 2;
    expect(pv(f)).toBe(12 * 220);
  });
});

describe('combate', () => {
  it('reproduz o oráculo da aba LUGAN', () => {
    expect(combate(ficha)).toEqual({
      ataqueArmaBranca: 634,
      ataqueMagico: 527,
      ataqueLuta: 434,
      ataqueArmaFogo: 434,
      esquivar: 236,
      bloquear: 637,
      aparar: 650,
    });
  });

  it('usa o bônus passivo de cada chave individualmente', () => {
    const f = clonar();
    const chaves: ChaveCombate[] = Object.keys(f.combate.bonusPassivo) as ChaveCombate[];
    for (const c of chaves) f.combate.bonusPassivo[c] = 0;
    f.combate.bonusPassivo.esquivar = 10;
    const r = combate(f);
    expect(r.esquivar).toBe(183 + 3 + 10);
    expect(r.ataqueArmaBranca).toBe(584);
    expect(r.aparar).toBe(584 - 128 + 141 + 3);
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

describe('tsuReal', () => {
  it('multiplica por 8 quando real', () => {
    const terra = ficha.tsu.find((t) => t.elemento === 'terra')!;
    expect(tsuReal(terra)).toBe(48);
  });

  it('mantém o nível quando não é real', () => {
    const fogo = ficha.tsu.find((t) => t.elemento === 'fogo')!;
    expect(tsuReal(fogo)).toBe(6);
  });
});

describe('rolar', () => {
  it('soma dados vezes multiplicador mais bônus com rng fixo', () => {
    // 0 -> 1, 0.5 -> 4, 0.999 -> 6
    const r = rolar(3, 100, 20, 'Golpe Devastador', rngFixo(0, 0.5, 0.999));
    expect(r.dados).toEqual([1, 4, 6]);
    expect(r.multiplicador).toBe(100);
    expect(r.bonus).toBe(20);
    expect(r.rotulo).toBe('Golpe Devastador');
    expect(r.total).toBe((1 + 4 + 6) * 100 + 20);
  });

  it('é determinístico para o mesmo gerador', () => {
    const a = rolar(2, 100, 0, 'dano', rngFixo(0.1, 0.9));
    const b = rolar(2, 100, 0, 'dano', rngFixo(0.1, 0.9));
    expect(a.dados).toEqual(b.dados);
    expect(a.total).toBe(b.total);
  });

  it('registra o instante da rolagem em ISO 8601', () => {
    const r = rolar(1, 1, 0, 'x', rngFixo(0));
    expect(new Date(r.quando).toISOString()).toBe(r.quando);
  });

  it('sem dados devolve apenas o bônus', () => {
    const r = rolar(0, 100, 5, 'x', rngFixo(0.3));
    expect(r.dados).toEqual([]);
    expect(r.total).toBe(5);
  });

  it('usa Math.random por padrão e mantém as faces entre 1 e 6', () => {
    const r = rolar(50, 1, 0, 'x');
    expect(r.dados).toHaveLength(50);
    for (const d of r.dados) {
      expect(Number.isInteger(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    }
  });

  it('rejeita quantidade de dados negativa ou não inteira', () => {
    expect(() => rolar(-1, 1, 0, 'x')).toThrow();
    expect(() => rolar(1.5, 1, 0, 'x')).toThrow();
  });
});

describe('novaSessao', () => {
  it('começa com PV cheio, fadiga zero e sem usos', () => {
    const s = novaSessao(ficha);
    expect(s.pvAtual).toBe(2616);
    expect(s.fadiga).toBe(0);
    expect(s.anotacoes).toBe('');
    expect(s.rolagens).toEqual([]);
    expect(Object.keys(s.usosPoder).sort()).toEqual(ficha.poderes.map((p) => p.id).sort());
    expect(Object.values(s.usosPoder).every((u) => u === 0)).toBe(true);
  });

  it('devolve objetos independentes a cada chamada', () => {
    const a = novaSessao(ficha);
    const b = novaSessao(ficha);
    a.rolagens.push(rolar(1, 1, 0, 'x', rngFixo(0)));
    a.usosPoder[ficha.poderes[0].id] = 3;
    expect(b.rolagens).toEqual([]);
    expect(b.usosPoder[ficha.poderes[0].id]).toBe(0);
  });
});

describe('pureza', () => {
  it('as funções não alteram a ficha recebida', () => {
    const f = clonar();
    const antes = JSON.stringify(f);
    pontosRestantes(f);
    totalPericia(f, 'espada');
    pv(f);
    combate(f);
    novaSessao(f);
    expect(JSON.stringify(f)).toBe(antes);
  });
});
