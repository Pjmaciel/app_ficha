import { describe, expect, it } from 'vitest';
import antiga from '../fixtures/alexsander-v2-sem-escala.json';
import dados from '../../src/data/alexsander.json';
import {
  combate,
  dadosDoGolpe,
  dano,
  ehDerivada,
  fieisSugeridos,
  fontesDerivadasAtributo,
  fontesDerivadasCombate,
  fontesDerivadasDano,
  fontesDerivadasPv,
  golpe,
  migrarFicha,
  novaSessao,
  poderUsavel,
  pvTotal,
  resumoBatalha,
  totalAtributoFicha,
  totalPericia,
  usoDoPoder,
  usosPorDiaDoPoder,
} from '../../src/engine';
import type { ChaveCombate, Ficha, Poder } from '../../src/model/types';

const ficha = dados as Ficha;
const clonar = (): Ficha => structuredClone(ficha);
const poder = (f: Ficha, id: string): Poder => {
  const p = f.poderes.find((x) => x.id === id);
  if (!p) throw new Error(`Poder ausente: ${id}`);
  return p;
};

const CHAVES: ChaveCombate[] = ['ataqueArmaBranca', 'ataqueMagico', 'ataqueLuta', 'ataqueArmaFogo', 'esquivar', 'bloquear', 'aparar'];
const TOTAIS: Record<ChaveCombate, number> = {
  ataqueArmaBranca: 1578, ataqueMagico: 1141, ataqueLuta: 908, ataqueArmaFogo: 908, esquivar: 760, bloquear: 1161, aparar: 1594,
};

describe('a ficha atual traz os totais dos níveis finais (valor base do pilar × pilar 3 + pontos livres)', () => {
  it.each(Object.entries(TOTAIS))('%s = %i', (chave, total) => {
    expect(combate(ficha, chave as ChaveCombate).total).toBe(total);
  });

  it('Força 442, PV 4904, dano básico e Golpe Devastador', () => {
    expect(totalAtributoFicha(ficha, 'forca')).toBe(442);
    expect(pvTotal(ficha)).toBe(4904);
    expect(dano(ficha).texto).toBe('3d×442 +280');
    const g = golpe(ficha, ficha.golpes[0]);
    expect(g.ataqueDados).toBe(8);
    expect(g.dano.texto).toBe('5d×442 +280');
  });

  it('os poderes conhecidos trazem a escala do livro', () => {
    expect(poder(ficha, 'lugan_da_batalha').escala).toMatchObject({
      ataquePorNivel: Object.fromEntries(CHAVES.map((c) => [c, 50])),
      danoPorNivel: 20,
    });
    expect(poder(ficha, 'campeao_do_combate_divino').escala).toMatchObject({
      ataquePorNivel: { ataqueArmaBranca: 70, aparar: 70 },
      danoPorNivel: 20,
    });
    expect(poder(ficha, 'forca_das_montanhas_divinas').escala?.atributoPorNivel).toEqual({ atributo: 'forca', valor: 60 });
    expect(poder(ficha, 'protecao_divina').escala).toMatchObject({ pvPorNivel: 500, usosPorNivel: 1 });
    expect(poder(ficha, 'o_filho_de_hagashi').escala).toMatchObject({ fieisPorNivel: 8000 });
    expect(poder(ficha, 'manipulador_de_tsu_real').escala).toMatchObject({ ataquePorNivel: { ataqueMagico: 70 } });
    // Velocidade Divina não tem parcela numérica na ficha: só efeitos e o patamar do nível 4.
    const velocidade = poder(ficha, 'velocidade_divina').escala!;
    expect(velocidade.ataquePorNivel).toBeUndefined();
    expect(velocidade.patamares?.map((x) => x.nivel)).toEqual([4]);
  });

  it('a ficha guarda só as parcelas manuais: "Outros" fica e nenhum "Ajuste do mestre" resta', () => {
    const nomes = (c: ChaveCombate) => ficha.combate[c].fontes.map((x) => [x.nome, x.valor]);
    expect(nomes('ataqueArmaBranca')).toEqual([['Outros', 120]]);
    expect(nomes('ataqueMagico')).toEqual([]);
    expect(nomes('ataqueLuta')).toEqual([['Outros', 70]]);
    expect(ficha.dano.fixos).toEqual([]);
    expect(ficha.pvExtras).toEqual([]);
    expect(ficha.atributos.forca.extras).toEqual([]);
    expect(ficha.golpes[0]).toMatchObject({ dadosAtaqueExtras: 0, dadosDanoExtras: -1 });
  });
});

describe('subir o nível de um poder recalcula a ficha', () => {
  it('Lugan da Batalha 6: ataque com arma branca 1628 e dano fixo 300', () => {
    const f = clonar();
    poder(f, 'lugan_da_batalha').nivel = 6;
    expect(combate(f, 'ataqueArmaBranca').total).toBe(1628);
    expect(combate(f, 'esquivar').total).toBe(810);
    expect(combate(f, 'aparar').total).toBe(1644);
    expect(dano(f).fixo).toBe(300);
    expect(dano(f).texto).toBe('3d×442 +300');
    expect(golpe(f, f.golpes[0]).ataqueTotal).toBe(1628);
  });

  it('Proteção Divina 3 → 4: PV total 4404 → 4904 e 3 → 4 usos por dia', () => {
    const f = clonar();
    const p = poder(f, 'protecao_divina');
    p.nivel = 3;
    expect(pvTotal(f)).toBe(4404);
    expect(usosPorDiaDoPoder(p)).toBe(3);
    p.nivel = 4;
    expect(pvTotal(f)).toBe(4904);
    expect(usosPorDiaDoPoder(p)).toBe(4);
    expect(usoDoPoder(p, novaSessao(f)).limite).toBe(4);
    expect(resumoBatalha(f, novaSessao(f)).usos.find((u) => u.id === 'protecao_divina')?.limite).toBe(4);
  });

  it('Força das Montanhas Divinas 2: Força 382 e as perícias que dependem dela acompanham', () => {
    const f = clonar();
    const dependente = f.pericias.find((p) => p.atributo === 'forca')!;
    const antes = totalPericia(f, dependente.id);
    poder(f, 'forca_das_montanhas_divinas').nivel = 2;
    expect(totalAtributoFicha(f, 'forca')).toBe(382);
    expect(dano(f).multiplicador).toBe(382);
    expect(totalPericia(f, dependente.id)).toBe(antes - 60);
  });

  it('Manipulador de Tsu Real 4 muda só o ataque mágico', () => {
    const f = clonar();
    poder(f, 'manipulador_de_tsu_real').nivel = 4;
    expect(combate(f, 'ataqueMagico').total).toBe(1141 + 70);
    expect(combate(f, 'ataqueArmaBranca').total).toBe(1578);
  });

  it('Campeão do Combate Divino 7 soma 70 só em ataque com arma branca e aparar e 20 no dano', () => {
    const f = clonar();
    poder(f, 'campeao_do_combate_divino').nivel = 7;
    expect(combate(f, 'ataqueArmaBranca').total).toBe(1648);
    expect(combate(f, 'aparar').total).toBe(1664);
    expect(combate(f, 'bloquear').total).toBe(1161);
    expect(dano(f).fixo).toBe(300);
  });

  it('Golpe Devastador 4: 9d no ataque, 6d×442 no dano e 4 usos por dia', () => {
    const f = clonar();
    const p = poder(f, 'golpe_devastador');
    p.nivel = 4;
    expect(dadosDoGolpe(f, f.golpes[0])).toEqual({ ataque: 4, dano: 3 });
    const r = golpe(f, f.golpes[0]);
    expect(r.ataqueDados).toBe(2 + 3 + 4);
    expect(r.dano.dados).toBe(2 + 1 + 3);
    expect(usosPorDiaDoPoder(p)).toBe(4);
    const resumo = resumoBatalha(f, novaSessao(f));
    expect(resumo.golpes[0].pontos).toBe(4);
    expect(resumo.golpes[0].pressaoKm2).toBe(32);
    expect(resumo.golpes[0].uso?.limite).toBe(4);
  });

  it('nível nulo contribui com zero', () => {
    const f = clonar();
    poder(f, 'lugan_da_batalha').nivel = null;
    expect(combate(f, 'ataqueArmaBranca').total).toBe(1578 - 250);
  });

  it('poder removido não contribui', () => {
    const f = clonar();
    poder(f, 'lugan_da_batalha').tipo = 'removido';
    poder(f, 'protecao_divina').tipo = 'removido';
    expect(combate(f, 'ataqueArmaBranca').total).toBe(1578 - 250);
    expect(dano(f).fixo).toBe(280 - 100);
    expect(pvTotal(f)).toBe(2904);
  });

  it('a escala é editável: mudar o coeficiente recalcula', () => {
    const f = clonar();
    poder(f, 'lugan_da_batalha').escala!.ataquePorNivel!.ataqueArmaBranca = 100;
    expect(combate(f, 'ataqueArmaBranca').total).toBe(1578 + 250);
    expect(combate(f, 'ataqueMagico').total).toBe(1141);
  });

  it('as parcelas manuais continuam somando às derivadas', () => {
    const f = clonar();
    f.combate.ataqueArmaBranca.fontes.push({ nome: 'Bênção', valor: 7 });
    f.pvExtras.push({ nome: 'Bônus manual', valor: 100 });
    f.atributos.forca.extras.push({ nome: 'Poção', valor: 3 });
    expect(combate(f, 'ataqueArmaBranca').total).toBe(1585);
    expect(pvTotal(f)).toBe(5004);
    expect(totalAtributoFicha(f, 'forca')).toBe(445);
  });
});

describe('parcelas derivadas', () => {
  it('trazem origem, nível e coeficiente', () => {
    const derivadas = fontesDerivadasCombate(ficha, 'ataqueArmaBranca');
    expect(derivadas.map((d) => [d.nome, d.poderId, d.nivel, d.coeficiente, d.valor])).toEqual([
      ['Lugan da Batalha', 'lugan_da_batalha', 5, 50, 250],
      ['Campeão do Combate Divino', 'campeao_do_combate_divino', 6, 70, 420],
      ['Lugan Completo', 'lugan_completo', 6, 30, 180],
    ]);
    expect(fontesDerivadasCombate(ficha, 'ataqueMagico').map((d) => d.poderId)).toEqual([
      'lugan_da_batalha', 'lugan_completo', 'manipulador_de_tsu_real',
    ]);
    expect(fontesDerivadasDano(ficha).map((d) => d.valor)).toEqual([100, 120, 60]);
    expect(fontesDerivadasAtributo(ficha, 'forca').map((d) => [d.poderId, d.valor])).toEqual([['forca_das_montanhas_divinas', 180]]);
    expect(fontesDerivadasAtributo(ficha, 'mental')).toEqual([]);
    expect(fontesDerivadasPv(ficha).map((d) => [d.poderId, d.valor])).toEqual([['protecao_divina', 2000]]);
  });

  it('aparecem na composição do combate, depois da perícia e antes das manuais, e a soma bate com o total', () => {
    const c = combate(ficha, 'ataqueArmaBranca');
    expect(c.composicao.map((x) => x.nome)).toEqual([
      'Perícia Espada', 'Lugan da Batalha', 'Campeão do Combate Divino', 'Lugan Completo',
      'Outros',
    ]);
    expect(c.composicao.filter(ehDerivada).map((x) => x.poderId)).toEqual([
      'lugan_da_batalha', 'campeao_do_combate_divino', 'lugan_completo',
    ]);
    expect(c.composicao.reduce((s, x) => s + x.valor, 0)).toBe(c.total);
  });

  it('a soma da composição é o total em todas as chaves', () => {
    for (const chave of CHAVES) {
      const c = combate(ficha, chave);
      expect(c.composicao.reduce((s, x) => s + x.valor, 0)).toBe(c.total);
    }
  });
});

describe('usos por dia', () => {
  const base: Poder = { id: 'x', nome: 'X', nivel: 3, tipo: 'ativo', descricao: '' };

  it('usosPorNivel × nível vale no lugar do valor manual', () => {
    expect(usosPorDiaDoPoder({ ...base, usosPorDia: 9, escala: { usosPorNivel: 2 } })).toBe(6);
  });

  it('sem usosPorNivel vale o valor manual; sem nenhum, é indefinido', () => {
    expect(usosPorDiaDoPoder({ ...base, usosPorDia: 5, escala: { pvPorNivel: 1 } })).toBe(5);
    expect(usosPorDiaDoPoder(base)).toBeUndefined();
  });

  it('nível nulo cai no valor manual', () => {
    expect(usosPorDiaDoPoder({ ...base, nivel: null, usosPorDia: 4, escala: { usosPorNivel: 1 } })).toBe(4);
  });

  it('poder com usosPorNivel é consumível', () => {
    expect(poderUsavel({ ...base, escala: { usosPorNivel: 1 } })).toBe(true);
  });
});

describe('fiéis sugeridos', () => {
  it('O Filho de Hagashi nível 12 sugere 96.000 fiéis', () => {
    expect(fieisSugeridos(ficha)).toBe(96000);
  });

  it('sem poder com fiéis por nível, não há sugestão', () => {
    const f = clonar();
    delete poder(f, 'o_filho_de_hagashi').escala;
    expect(fieisSugeridos(f)).toBeNull();
  });
});

describe('migração para a escala por nível', () => {
  const migrada = () => migrarFicha(structuredClone(antiga));

  it('a ficha salva antes da escala vira a ficha semeada, com os níveis da semente do pilar e sem ajuste do mestre', () => {
    const f = migrada();
    expect(f).toStrictEqual({ ...clonar(), revisaoDados: 0 });
    for (const [chave, total] of Object.entries(TOTAIS)) expect(combate(f, chave as ChaveCombate).total).toBe(total);
    expect(totalAtributoFicha(f, 'forca')).toBe(442);
    expect(pvTotal(f)).toBe(4904);
    expect(dano(f).texto).toBe('3d×442 +280');
    expect(golpe(f, f.golpes[0]).ataqueDados).toBe(8);
    expect(golpe(f, f.golpes[0]).dano.texto).toBe('5d×442 +280');
    expect(usosPorDiaDoPoder(poder(f, 'golpe_devastador'))).toBe(3);
    expect(usosPorDiaDoPoder(poder(f, 'protecao_divina'))).toBe(4);
  });

  it('é idempotente', () => {
    const uma = migrada();
    expect(migrarFicha(uma)).toStrictEqual(uma);
  });

  it('não altera a entrada', () => {
    const entrada = structuredClone(antiga);
    const antes = JSON.stringify(entrada);
    migrarFicha(entrada);
    expect(JSON.stringify(entrada)).toBe(antes);
  });

  it('remove os usos manuais que passaram a ser derivados, mas guarda o do Filho de Hagashi', () => {
    const f = migrada();
    expect(poder(f, 'protecao_divina')).not.toHaveProperty('usosPorDia');
    expect(poder(f, 'golpe_devastador')).not.toHaveProperty('usosPorDia');
    expect(poder(f, 'o_filho_de_hagashi').usosPorDia).toBe(1);
  });

  it('só converte o que corresponde a uma fonte da ficha: sem fonte com o nome do poder, não injeta escala', () => {
    const bruta = structuredClone(antiga) as unknown as Ficha;
    for (const c of CHAVES) bruta.combate[c].fontes = bruta.combate[c].fontes.filter((x) => x.nome !== 'Lugan da Batalha');
    bruta.dano.fixos = bruta.dano.fixos.filter((x) => x.nome !== 'Lugan da Batalha');
    const f = migrarFicha(bruta);
    // Sem valor salvo a converter, a parcela numérica não entra (ficaria em dobro); só os efeitos informativos.
    expect(poder(f, 'lugan_da_batalha').escala?.ataquePorNivel).toBeUndefined();
    expect(poder(f, 'lugan_da_batalha').escala?.danoPorNivel).toBeUndefined();
    expect(combate(f, 'ataqueArmaBranca').total).toBe(1578 - 250);
    expect(dano(f).fixo).toBe(280 - 100);
  });

  it('o valor salvo com o nível antigo é descartado: vale o coeficiente do livro, sem ajuste do mestre', () => {
    const bruta = structuredClone(antiga) as unknown as Ficha;
    bruta.combate.esquivar.fontes.find((x) => x.nome === 'Lugan da Batalha')!.valor = 175;
    const f = migrarFicha(bruta);
    expect(combate(f, 'esquivar').total).toBe(760);
    expect(f.combate.esquivar.fontes.map((x) => x.nome)).toEqual(['Outros']);
  });

  it('o nível salvo é ignorado: os poderes da Justiça recebem os pontos livres da semente', () => {
    const bruta = structuredClone(antiga) as unknown as Ficha;
    poder(bruta, 'lugan_da_batalha').nivel = 9;
    const f = migrarFicha(bruta);
    expect(poder(f, 'lugan_da_batalha')).toMatchObject({ nivel: 5, pontosLivres: 2, valorBasePilar: 1 });
    expect(combate(f, 'ataqueArmaBranca').total).toBe(1578);
    poder(f, 'lugan_da_batalha').nivel = 6;
    expect(combate(f, 'ataqueArmaBranca').total).toBe(1628);
  });

  it('remove os "Ajuste do mestre" de uma ficha salva na revisão anterior e mantém "Outros"', () => {
    const salva = clonar();
    salva.combate.ataqueArmaBranca.fontes.push({ nome: 'Ajuste do mestre (Lugan Completo)', valor: 30 });
    salva.dano.fixos.push({ nome: 'Ajuste do mestre (Campeão do Combate Divino)', valor: -20 });
    salva.pvExtras.push({ nome: 'Ajuste do mestre (Proteção Divina)', valor: 5 });
    const f = migrarFicha(salva);
    expect(f.combate.ataqueArmaBranca.fontes).toEqual([{ nome: 'Outros', valor: 120 }]);
    expect(f.dano.fixos).toEqual([]);
    expect(f.pvExtras).toEqual([]);
  });

  it('o carregamento de fichas da versão 1 não injeta escala (o bônus passivo é um total opaco)', () => {
    const v1 = {
      versao: 1,
      identidade: { nome: 'T', jogador: 'J', raca: 'R', reino: 'K', pilarLuganico: 'P', nivel: 41, nivelLuganico: 3, basePv: 12 },
      pontosIniciais: 1018,
      atributos: Object.fromEntries(['forca', 'agilidade', 'reflexos', 'fortitude', 'distancia', 'mental']
        .map((id) => [id, { bonus: 47, pontos: 100, bonusExtra: 0 }])),
      pericias: (antiga as unknown as Ficha).pericias,
      combate: { bonusPassivo: Object.fromEntries(CHAVES.map((c) => [c, 50])) },
      poderes: [{ id: 'lugan_da_batalha', nome: 'Lugan da Batalha', nivel: 1, descricao: '' }],
      tsu: [],
      xp: { total: 0, atual: 0 },
    };
    const f = migrarFicha(v1);
    expect(f.poderes[0].escala?.ataquePorNivel).toBeUndefined();
    expect(f.combate.ataqueArmaBranca.fontes).toEqual([{ nome: 'Bônus passivo', valor: 50 }]);
  });
});
