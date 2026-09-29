import { describe, expect, it } from 'vitest';
import antiga from '../fixtures/alexsander-v2-sem-escala.json';
import dados from '../../src/data/alexsander.json';
import { fichaCompleta } from '../fixtures/ficha-completa';
import {
  aplicarPilar,
  combate,
  composicaoDoPoder,
  dano,
  definirNivelPilar,
  descerPilar,
  efeitosDoPilar,
  marcadoresDisponiveis,
  marcadoresInvalidos,
  migrarFicha,
  novaSessao,
  pvTotal,
  resolverTexto,
  resumoBatalha,
  subirPilar,
  testeDragaoVermelho,
  totalAtributoFicha,
  usosPorDiaDoPoder,
  validarFicha,
} from '../../src/engine';
import { exportarJson, importarJson } from '../../src/import';
import type { ChaveCombate, Ficha, Poder } from '../../src/model/types';

const clonar = (): Ficha => structuredClone(dados) as unknown as Ficha;
const poder = (f: Ficha, id: string): Poder => {
  const p = f.poderes.find((x) => x.id === id);
  if (!p) throw new Error(`Poder ausente: ${id}`);
  return p;
};
const nivelDe = (f: Ficha, id: string): number | null => poder(f, id).nivel;

const CHAVES: ChaveCombate[] = ['ataqueArmaBranca', 'ataqueMagico', 'ataqueLuta', 'ataqueArmaFogo', 'esquivar', 'bloquear', 'aparar'];
const totais = (f: Ficha): number[] => CHAVES.map((c) => combate(f, c).total);

describe('pilar informativo (regra da mesa)', () => {
  it('Justiça 3, sem pacote, sem valor base e sem nivelAplicado', () => {
    const f = clonar();
    expect(f.pilar).toMatchObject({ nome: 'Justiça', nivel: 3 });
    expect(Object.keys(f.pilar).sort()).toEqual(['efeitos', 'nivel', 'nome', 'textos']);
    expect('pilarLuganico' in f.identidade || 'pilarNivel' in f.identidade).toBe(false);
  });

  it('subir, descer e definir o pilar (1 a 5) não muda nenhum poder nem nenhum total', () => {
    const f = clonar();
    for (const n of [1, 2, 4, 5]) {
      const g = definirNivelPilar(f, n);
      expect(g.pilar.nivel).toBe(n);
      expect(g.poderes).toEqual(f.poderes);
      expect(totais(g)).toEqual(totais(f));
      expect(pvTotal(g)).toBe(3904);
      expect(dano(g).texto).toBe('3d×262 +80');
    }
    expect(subirPilar(f).poderes).toEqual(f.poderes);
    expect(descerPilar(f).poderes).toEqual(f.poderes);
    expect(subirPilar(f)).toStrictEqual({ ...f, pilar: { ...f.pilar, nivel: 4 } });
  });

  it('nem a ficha completa (todos os poderes ativos) muda com o pilar', () => {
    const f = fichaCompleta();
    expect(totais(definirNivelPilar(f, 5))).toEqual(totais(f));
    expect(pvTotal(definirNivelPilar(f, 1))).toBe(pvTotal(f));
    expect(totalAtributoFicha(definirNivelPilar(f, 5), 'forca')).toBe(442);
  });

  it('o nível do poder é o informado; aplicarPilar só completa a origem e limita o pilar', () => {
    const f = clonar();
    poder(f, 'lugan_da_batalha').nivel = 4;
    delete poder(f, 'lugan_da_batalha').origem;
    f.pilar.nivel = 9;
    aplicarPilar(f);
    expect(f.pilar.nivel).toBe(5);
    expect(poder(f, 'lugan_da_batalha')).toMatchObject({ nivel: 4, origem: 'livre' });
    expect(aplicarPilar(structuredClone(f))).toStrictEqual(f);
  });

  it('a composição do poder é o nível informado com a origem, sem multiplicação do pilar', () => {
    const f = clonar();
    expect(composicaoDoPoder(f, poder(f, 'lugan_da_batalha')).texto).toBe('Lugan da Batalha 1 — nível informado (poderes livres)');
    expect(composicaoDoPoder(f, poder(f, 'portador_da_jikar')).texto).toBe('Portador da Jikar — sem nível (item)');
    expect(composicaoDoPoder(subirPilar(f), poder(f, 'protecao_divina')).texto).toBe('Proteção Divina 2 — nível informado (poderes livres)');
  });

  it('os efeitos do pilar no nível 3 seguem só como texto: teste do Dragão Vermelho "2400 + 1d×400"', () => {
    const f = clonar();
    expect(efeitosDoPilar(f).find((e) => e.id === 'teste_dragao')?.valor).toBe(2400);
    expect(testeDragaoVermelho(f)).toEqual({ base: 2400, dado: 400, texto: '2400 + 1d×400' });
  });
});

describe('Proteção Divina 2 na Batalha', () => {
  const f = clonar();
  const r = resumoBatalha(f, novaSessao(f));

  it('nível 2 com usos 2/2, imunidade 2 rodadas, +1000 PV, absorção 400, 10 km², 200 criaturas e +300 anti-mental', () => {
    expect(r.protecaoDivina).toMatchObject({
      nivel: 2, usosPorDia: 2, imunidadeRodadas: 2, pvExtra: 1000, absorcaoArea: 400, raioKm2: 10, criaturasProtegidas: 200, antiMental: 300,
    });
    expect(r.protecaoDivina?.uso).toMatchObject({ limite: 2, restantes: 2 });
    expect(r.protecaoDivina?.rotuloUsos).toBe('Proteção Divina: 2 / 2 rodadas disponíveis');
  });

  it('não reduz Tsu real no nível 2 (só a partir do 3, com 1d); no nível 3 já reduz', () => {
    expect(r.protecaoDivina).toMatchObject({ reduzTsuReal: false, reducaoTsuReal: null, proximaReducaoTsuReal: { nivel: 3, dado: '1d' } });
    expect(r.protecaoDivina?.textoTsuReal).toBe('Não reduz Tsu real no nível 2 (a partir do nível 3, com 1d)');
    const g = clonar();
    poder(g, 'protecao_divina').nivel = 3;
    expect(resumoBatalha(g, novaSessao(g)).protecaoDivina).toMatchObject({ reduzTsuReal: true, reducaoTsuReal: '1d', absorcaoArea: 600 });
  });

  it('a absorção é de 200 por ponto: 200 no nível 1, 400 no 2, 600 no 3', () => {
    for (const [n, esperado] of [[1, 200], [2, 400], [3, 600]] as const) {
      const g = clonar();
      poder(g, 'protecao_divina').nivel = n;
      expect(resumoBatalha(g, novaSessao(g)).protecaoDivina?.absorcaoArea).toBe(esperado);
    }
  });

  it('o PV do topo: base 2904 + 1000 da Proteção Divina; usos gastos diminuem as rodadas disponíveis', () => {
    expect(r.pv).toEqual({ atual: 3904, total: 3904, base: 2904, protecaoDivina: 1000, outros: 0 });
    const s = novaSessao(f);
    s.usosPoder.protecao_divina = 1;
    expect(resumoBatalha(f, s).topo.protecaoDivina).toBe('Proteção Divina: 1 / 2 rodadas disponíveis');
  });

  it('a Proteção Divina removida some do card, dos usos e do PV', () => {
    const g = clonar();
    poder(g, 'protecao_divina').tipo = 'removido';
    const x = resumoBatalha(g, novaSessao(g));
    expect(x.protecaoDivina).toBeNull();
    expect(x.usos).toEqual([]);
    expect(x.pv.total).toBe(2904);
  });
});

describe('topo, ataque com Jikar e card da Jikar', () => {
  const f = clonar();
  const r = resumoBatalha(f, novaSessao(f));

  it('topo: pilar Justiça informativo, item principal Jikar, build "Defesa com Jikar"', () => {
    expect(r.topo).toEqual({
      pilar: 'Justiça 3', itemPrincipal: 'Jikar', build: 'Defesa com Jikar', protecaoDivina: 'Proteção Divina: 2 / 2 rodadas disponíveis',
    });
  });

  it('o ataque e o dano normais mostram a composição com os dados da Jikar', () => {
    expect(r.ataqueBasico).toEqual({ dados: 5, bonus: 868, texto: '5d×100 +868' });
    expect(r.ataqueDetalhe).toBe('Rolagem base 2d×100 + Jikar 3d×100 = 5d×100, bônus dos poderes +260');
    expect(r.danoBasico.texto).toBe('3d×262 +80');
    expect(r.danoDetalhe).toBe('Dano base 2d + Jikar 1d = 3d×262, bônus dos poderes +80');
    expect(r.defesas.map((d) => d.rolagem.texto)).toEqual(['5d×100 +884', '5d×100 +661', '5d×100 +260']);
  });

  it('a Jikar tem card com +3d×100, +1d e todos os lembretes do Portador da Jikar', () => {
    expect(r.jikar).toMatchObject({ nome: 'Portador da Jikar', dadosAtaqueDefesa: 3, dadosDano: 1 });
    expect(r.jikar?.lembretes).toEqual([
      '+3d×100 em ataque e defesa',
      '+1d no dano',
      'inimigos só fazem 1 ataque contra o portador',
      'mentira, ilusão e invisibilidade não o afetam',
      'contra vários inimigos só metade ataca',
      'aliados divinos em 3 km recebem +250 em ataque, defesa e dano',
      'aliados não divinos recebem +100',
      'a Jikar retorna pela vontade do dono',
    ]);
  });

  it('os poderes removidos ficam fora da Batalha, dos usos e do golpe; reativar traz de volta', () => {
    expect(r.golpes).toEqual([]);
    expect(r.usos.map((u) => u.id)).toEqual(['protecao_divina']);
    expect(r.velocidadeDivina).toBeNull();
    expect(r.protecoes.map((p) => p.id)).toEqual(['portador_da_jikar', 'protecao_divina']);
    const g = clonar();
    poder(g, 'golpe_devastador').tipo = 'ativo';
    const x = resumoBatalha(g, novaSessao(g));
    expect(x.golpes.map((y) => y.id)).toEqual(['golpe_devastador']);
    expect(x.usos.map((u) => u.id)).toEqual(['golpe_devastador', 'protecao_divina']);
    expect(usosPorDiaDoPoder(poder(g, 'golpe_devastador'))).toBe(3);
  });

  it('sem o Portador da Jikar ou sem a Proteção Divina, o rótulo da build cai para a arma', () => {
    const g = clonar();
    poder(g, 'portador_da_jikar').tipo = 'removido';
    const x = resumoBatalha(g, novaSessao(g));
    expect(x.topo.build).toBe('Com Jikar');
    expect(x.jikar).toBeNull();
  });
});

describe('validarFicha', () => {
  const codigos = (f: Ficha): string[] => validarFicha(f).map((a) => a.codigo);

  it('a build da mesa não tem alertas e a função não altera a ficha', () => {
    const f = clonar();
    const antes = JSON.stringify(f);
    expect(validarFicha(f)).toEqual([]);
    expect(JSON.stringify(f)).toBe(antes);
  });

  it('alerta se o pilar estiver adicionando poderes (pacote ou valor base)', () => {
    const f = clonar() as Ficha & { pilar: Record<string, unknown> };
    f.pilar.pacotePorNivel = { fogo_real: 2 };
    expect(codigos(f)).toEqual(['pilar-concede-poderes']);
    const g = clonar();
    (poder(g, 'fogo_real') as Poder & { valorBasePilar?: number }).valorBasePilar = 1;
    expect(codigos(g)).toEqual(['pilar-concede-poderes']);
  });

  it('alerta se Golpe Especial: Competência estiver ativo (golpe ou poder)', () => {
    const f = clonar();
    f.golpes.push({ id: 'golpe_especial_competencia', nome: 'Golpe Especial: Competência', dadosAtaqueExtras: 0, dadosDanoExtras: 0, ativo: true });
    expect(codigos(f)).toEqual(['golpe-competencia']);
    f.golpes[f.golpes.length - 1].ativo = false;
    expect(codigos(f)).toEqual([]);
    f.poderes.push({ id: 'competencia', nome: 'Golpe Especial: Competência', nivel: 1, tipo: 'ativo', descricao: '' });
    expect(codigos(f)).toEqual(['golpe-competencia']);
  });

  it('alerta se a Proteção Divina está ativa sem PV extra; removida ou sem nível não alerta', () => {
    const f = clonar();
    delete poder(f, 'protecao_divina').escala!.pvPorNivel;
    expect(codigos(f)).toEqual(['protecao-sem-pv']);
    poder(f, 'protecao_divina').tipo = 'removido';
    expect(codigos(f)).toEqual([]);
  });

  it('alerta se a Jikar não tem +3d×100 em ataque e defesa ou +1d no dano', () => {
    const f = clonar();
    f.combate.bloquear.dadosExtras = [];
    expect(codigos(f)).toEqual(['jikar-incompleta']);
    const g = clonar();
    g.dano.dadosExtras = [];
    expect(codigos(g)).toEqual(['jikar-incompleta']);
    const h = clonar();
    h.combate.aparar.dadosExtras = [{ nome: 'Jikar', valor: 2 }];
    expect(codigos(h)).toEqual(['jikar-incompleta']);
  });

  it('alerta se a Batalha não usa os bônus do Campeão do Combate Divino e do Lugan da Batalha', () => {
    const f = clonar();
    poder(f, 'campeao_do_combate_divino').tipo = 'removido';
    expect(validarFicha(f).map((a) => a.codigo)).toEqual(['batalha-sem-bonus']);
    expect(validarFicha(f)[0].mensagem).toContain('Campeão do Combate Divino');
    expect(validarFicha(f)[0].mensagem).not.toContain('Lugan da Batalha');
    poder(f, 'lugan_da_batalha').nivel = 0;
    expect(validarFicha(f)[0].mensagem).toContain('Campeão do Combate Divino e Lugan da Batalha');
    const g = clonar();
    delete poder(g, 'lugan_da_batalha').escala!.ataquePorNivel;
    expect(codigos(g)).toEqual(['batalha-sem-bonus']);
  });

  it('vários alertas juntos, na ordem das regras', () => {
    const f = clonar() as Ficha & { pilar: Record<string, unknown> };
    f.pilar.pacotePorNivel = {};
    f.dano.dadosExtras = [];
    poder(f, 'lugan_da_batalha').tipo = 'removido';
    expect(codigos(f)).toEqual(['pilar-concede-poderes', 'jikar-incompleta', 'batalha-sem-bonus']);
  });
});

describe('limites do pilar', () => {
  it('nunca abaixo de 1 nem acima de 5', () => {
    const f = clonar();
    expect(definirNivelPilar(f, 0).pilar.nivel).toBe(1);
    expect(definirNivelPilar(f, -7).pilar.nivel).toBe(1);
    expect(definirNivelPilar(f, 9).pilar.nivel).toBe(5);
    expect(definirNivelPilar(f, 3.6).pilar.nivel).toBe(4);
    let x = f;
    for (let i = 0; i < 10; i++) x = subirPilar(x);
    expect(x.pilar.nivel).toBe(5);
    expect(subirPilar(x)).toStrictEqual(x);
    for (let i = 0; i < 10; i++) x = descerPilar(x);
    expect(x.pilar.nivel).toBe(1);
    expect(descerPilar(x)).toStrictEqual(x);
  });

  it('a migração limita um nível fora do intervalo', () => {
    const f = clonar();
    f.pilar.nivel = 9;
    expect(migrarFicha(f).pilar.nivel).toBe(5);
    f.pilar.nivel = 0;
    expect(migrarFicha(f).pilar.nivel).toBe(1);
  });
});

describe('textos vivos do pilar', () => {
  it('{pilar.nivel} e {pilar.<efeito>} resolvem no nível atual, sem separador de milhar', () => {
    const f = clonar();
    expect(resolverTexto(f, 'nível {pilar.nivel}: {pilar.teste_dragao} + 1d×{pilar.teste_dado}')).toBe('nível 3: 2400 + 1d×400');
    expect(resolverTexto(subirPilar(f), '{pilar.teste_dragao}')).toBe('3200');
    expect(resolverTexto(definirNivelPilar(f, 5), '{pilar.teste_dragao}')).toBe('4000');
    expect(resolverTexto(f, '{pilar.teste_dragao.porPonto}')).toBe('800');
  });

  it('marcador do pilar desconhecido fica cru e é apontado como inválido', () => {
    const f = clonar();
    expect(resolverTexto(f, '{pilar.inexistente}')).toBe('{pilar.inexistente}');
    expect(marcadoresInvalidos(f, '{pilar.inexistente} {pilar.nivel}')).toEqual(['{pilar.inexistente}']);
  });

  it('os marcadores disponíveis incluem os do pilar', () => {
    const marcadores = marcadoresDisponiveis(clonar()).map((m) => m.marcador);
    expect(marcadores).toContain('{pilar.nivel}');
    expect(marcadores).toContain('{pilar.teste_dragao}');
  });
});

describe('card do pilar na aba Batalha', () => {
  it('"Pilar da Justiça nível 3" com Jikar, Ancestrais, Dragão Vermelho (teste calculado) e os redutores por 5 h', () => {
    const f = clonar();
    const pilar = resumoBatalha(f, novaSessao(f)).pilar!;
    expect(pilar.titulo).toBe('Pilar da Justiça nível 3');
    expect(pilar.nivel).toBe(3);
    expect(pilar.testeDragao).toBe('2400 + 1d×400');
    expect(pilar.textos).toHaveLength(4);
    expect(pilar.textos[0]).toContain('Jikar');
    expect(pilar.textos[1]).toContain('Ancestrais da Justiça');
    expect(pilar.textos[1]).toContain('2000 samurais');
    expect(pilar.textos[2]).toContain('Proteção do Dragão Vermelho');
    expect(pilar.textos[2]).toContain('nível do pilar (3) × 800 + 1d×400');
    expect(pilar.textos[3]).toContain('por mais 5 h');
    expect(pilar.textos[3]).toContain('−400');
    expect(pilar.textos[3]).toContain('−2');
    expect(pilar.textos.join(' ')).not.toMatch(/[{}]/);
  });

  it('subir o pilar muda o título e o teste (nível 4: "3200 + 1d×400")', () => {
    const f = subirPilar(clonar());
    const pilar = resumoBatalha(f, novaSessao(f)).pilar!;
    expect(pilar.titulo).toBe('Pilar da Justiça nível 4');
    expect(pilar.testeDragao).toBe('3200 + 1d×400');
    expect(pilar.textos[2]).toContain('nível do pilar (4) × 800');
  });

  it('pilar sem textos nem efeitos não gera card; sem nome o título é "Pilar nível N"', () => {
    const f = clonar();
    f.pilar.nome = '';
    expect(resumoBatalha(f, novaSessao(f)).pilar?.titulo).toBe('Pilar nível 3');
    f.pilar.textos = [];
    f.pilar.efeitos = [];
    expect(resumoBatalha(f, novaSessao(f)).pilar).toBeNull();
    expect(testeDragaoVermelho(f)).toBeNull();
  });
});

describe('migração e importação do pilar e da build', () => {
  it('a ficha salva antes do pilar com escala (nome e nível em identidade) vira o pilar informativo e a build da mesa', () => {
    const bruta = structuredClone(antiga) as unknown as Ficha & { identidade: Record<string, unknown> };
    bruta.identidade.pilarNivel = 4;
    const f = migrarFicha(bruta);
    expect(f.pilar).toMatchObject({ nome: 'Justiça', nivel: 4 });
    expect(Object.keys(f.pilar).sort()).toEqual(['efeitos', 'nivel', 'nome', 'textos']);
    expect('pilarLuganico' in f.identidade || 'pilarNivel' in f.identidade).toBe(false);
    expect(nivelDe(f, 'protecao_divina')).toBe(2);
    expect(pvTotal(f)).toBe(3904);
  });

  it('a ficha salva na revisão 7 (pacote, valor base, pontos livres, origem pilar) migra para a build da mesa', () => {
    const cheia = fichaCompleta() as unknown as { pilar: Record<string, unknown>; poderes: Record<string, unknown>[]; revisaoDados: number } & Ficha;
    cheia.revisaoDados = 7;
    cheia.pilar.pacotePorNivel = { lugan_completo: 2, protecao_divina: 1 };
    for (const p of cheia.poderes) {
      p.valorBasePilar = p.id === 'lugan_completo' ? 2 : 0;
      p.pontosLivres = p.nivel;
      (p as { origem?: string }).origem = p.id === 'lugan_completo' ? 'pilar' : 'livre';
    }
    poder(cheia, 'protecao_divina').tipo = 'defensivo' as never;
    cheia.combate.esquivar.fontes.push({ nome: 'Ajuste do mestre (X)', valor: 3 });
    const f = migrarFicha(cheia);
    expect(f).toStrictEqual({ ...clonar(), revisaoDados: 7 });
    expect(validarFicha(f)).toEqual([]);
  });

  it('a migração da ficha da versão 1 traz o pilar 3 informativo e os poderes com origem', () => {
    const v1 = {
      versao: 1,
      identidade: { nome: 'T', jogador: 'J', raca: 'R', reino: 'K', pilarLuganico: 'Justiça', nivel: 41, nivelLuganico: 3, basePv: 12 },
      pontosIniciais: 1018,
      atributos: Object.fromEntries(['forca', 'agilidade', 'reflexos', 'fortitude', 'distancia', 'mental']
        .map((id) => [id, { bonus: 47, pontos: 100, bonusExtra: 0 }])),
      pericias: (antiga as unknown as Ficha).pericias,
      combate: { bonusPassivo: Object.fromEntries(CHAVES.map((c) => [c, 50])) },
      poderes: [{ id: 'protecao_divina', nome: 'Proteção Divina', nivel: 2, descricao: '' }],
      tsu: [],
      xp: { total: 0, atual: 0 },
    };
    const f = migrarFicha(v1);
    expect(f.pilar).toMatchObject({ nome: 'Justiça', nivel: 3 });
    expect(f.poderes[0]).toMatchObject({ nivel: 2, origem: 'livre' });
    expect(nivelDe(subirPilar(f), 'protecao_divina')).toBe(2);
  });

  it('um pilar que não é o da Justiça começa sem efeitos nem textos', () => {
    const bruta = structuredClone(antiga) as unknown as Ficha & { identidade: Record<string, unknown> };
    bruta.identidade.pilarLuganico = 'Honra';
    const f = migrarFicha(bruta);
    expect(f.pilar).toEqual({ nome: 'Honra', nivel: 3, efeitos: [], textos: [] });
    expect(resumoBatalha(f, novaSessao(f)).pilar).toBeNull();
  });

  it('a migração de um pilar salvo completa só o que falta', () => {
    const f = clonar();
    const { textos: _t, efeitos: _e, ...parcial } = f.pilar;
    const migrada = migrarFicha({ ...f, pilar: parcial });
    expect(migrada.pilar.textos).toHaveLength(4);
    expect(migrada.pilar.efeitos.length).toBeGreaterThan(0);
  });

  it('a ida e volta em JSON preserva o pilar e os poderes', () => {
    const f = subirPilar(clonar());
    const volta = importarJson(exportarJson(f));
    expect(volta).toStrictEqual(f);
    expect(volta.pilar.nivel).toBe(4);
    expect(nivelDe(volta, 'campeao_do_combate_divino')).toBe(3);
  });

  it('a importação valida o pilar e os poderes', () => {
    const f = clonar();
    const com = (pilar: unknown) => JSON.stringify({ ...f, pilar });
    expect(() => importarJson(com([]))).toThrow(/pilar/);
    expect(() => importarJson(com({ ...f.pilar, pacotePorNivel: { fogo_real: 'dois' } }))).toThrow(/pacotePorNivel/);
    expect(() => importarJson(com({ ...f.pilar, efeitos: [{ id: 'a.b', rotulo: 'x', porPonto: 1 }] }))).toThrow(/pilar com efeito inválido/);
    expect(() => importarJson(com({ ...f.pilar, textos: [1] }))).toThrow(/textos/);
    const com1 = (extra: Record<string, unknown>) => JSON.stringify({ ...f, poderes: f.poderes.map((p, i) => (i === 0 ? { ...p, ...extra } : p)) });
    expect(() => importarJson(com1({ origem: 'sorte' }))).toThrow(/origem/);
    expect(() => importarJson(com1({ tipo: 'magico' }))).toThrow(/tipo/);
    expect(importarJson(com1({ tipo: 'recurso' })).poderes[0].tipo).toBe('recurso');
    // O tipo antigo `defensivo` é aceito na importação e a migração converte a ficha para a build da mesa.
    expect(importarJson(com1({ tipo: 'defensivo' })).poderes.find((p) => p.id === 'protecao_divina')?.tipo).toBe('defesa');
  });

  it('a ficha sem identidade.pilarLuganico e sem pilar é aceita (pilar sem nome)', () => {
    const { pilar: _, ...semPilar } = clonar();
    const f = importarJson(JSON.stringify(semPilar));
    expect(f.pilar).toMatchObject({ nome: '', nivel: 3 });
  });
});

describe('descrições vivas dos poderes', () => {
  const descricao = (f: Ficha, id: string): string => resolverTexto(f, poder(f, id).descricao);

  it('nenhuma descrição da ficha embutida tem marcador sem resolver e as de escala não trazem os números antigos', () => {
    const f = fichaCompleta();
    for (const p of f.poderes) expect(marcadoresInvalidos(f, p.descricao)).toEqual([]);
    expect(descricao(f, 'lugan_da_batalha')).not.toMatch(/[{}]/);
    expect(poder(f, 'lugan_da_batalha').descricao).toContain('{poder.lugan_da_batalha.ataque_armaBranca}');
  });

  it('Lugan da Batalha (nível 1 na build) cita +50 e +20; no nível 5, +250 e +100; no nível 6, +300 e +120', () => {
    const b = clonar();
    expect(descricao(b, 'lugan_da_batalha')).toBe(
      '+50 em qualquer ataque; +50 em qualquer defesa; +20 no final do dano; pressão de cada ataque em 1 km².');
    const f = fichaCompleta();
    expect(descricao(f, 'lugan_da_batalha')).toBe(
      '+250 em qualquer ataque; +250 em qualquer defesa; +100 no final do dano; pressão de cada ataque em 5 km².');
    const f4 = fichaCompleta();
    poder(f4, 'lugan_da_batalha').nivel = 6;
    expect(descricao(f4, 'lugan_da_batalha')).toBe(
      '+300 em qualquer ataque; +300 em qualquer defesa; +120 no final do dano; pressão de cada ataque em 6 km².');
  });

  it('Proteção Divina 2 (build) cita +1.000 PV e 2 rodadas; no nível 4, +2.000 PV e 4 rodadas; no 5, +2.500 PV e 5 rodadas', () => {
    const b = descricao(clonar(), 'protecao_divina');
    expect(b).toContain('2 rodada(s) por dia de imunidade');
    expect(b).toContain('+1.000 PV extras');
    expect(b).toContain('absorve 400 de dano');
    const f = fichaCompleta();
    const d = descricao(f, 'protecao_divina');
    expect(d).toContain('4 rodada(s) por dia de imunidade');
    expect(d).toContain('+2.000 PV extras');
    expect(d).toContain('proteção de área em 20 km²');
    expect(d).toContain('até 400 criaturas');
    expect(d).toContain('bônus de +600 para anular');
    poder(f, 'protecao_divina').nivel = 5;
    expect(descricao(f, 'protecao_divina')).toContain('5 rodada(s)');
    expect(descricao(f, 'protecao_divina')).toContain('+2.500 PV extras');
  });

  it('as demais descrições acompanham o nível: Lugan Completo, Campeão, Força, Golpe, Filho, Manipulador e Fogo Real', () => {
    const f = fichaCompleta();
    expect(descricao(f, 'lugan_completo')).toContain('voo de 840 km/h');
    expect(descricao(f, 'lugan_completo')).toContain('+180 em qualquer ataque');
    expect(descricao(f, 'lugan_completo')).toContain('bônus de +600');
    expect(descricao(f, 'campeao_do_combate_divino')).toContain('+420 nas rolagens de ataque');
    expect(descricao(f, 'campeao_do_combate_divino')).toContain('+120 no dano físico');
    expect(descricao(f, 'forca_das_montanhas_divinas')).toContain('[+180] Força permanente');
    expect(descricao(f, 'golpe_devastador')).toContain('+3d×100 no ataque');
    expect(descricao(f, 'golpe_devastador')).toContain('pressão de 24 km²');
    expect(descricao(f, 'o_filho_de_hagashi')).toContain('vincula 96.000 hagashianos');
    expect(descricao(f, 'manipulador_de_tsu_real')).toContain('+210 em Manipular Tsu Real');
    expect(descricao(f, 'fogo_real')).toContain('fogo real em 6 km²');
    expect(descricao(f, 'fogo_real')).toContain('+300 dano');
    expect(descricao(f, 'velocidade_divina')).toContain('Deslocamento de 440 km/h');
    // O Portador da Jikar é um item sem nível: texto qualitativo, sem marcadores.
    expect(poder(f, 'portador_da_jikar').descricao).not.toMatch(/[{}]/);
  });

  it('a descrição antiga da planilha é trocada na migração; a editada pelo jogador fica', () => {
    const salva = clonar();
    poder(salva, 'lugan_da_batalha').descricao = '+150 em qualquer ataque; +150 em qualquer defesa; +60 no final do dano';
    poder(salva, 'fogo_real').descricao = 'Minha descrição: 400 de dano.';
    const m = migrarFicha(salva);
    expect(poder(m, 'lugan_da_batalha').descricao).toContain('{poder.lugan_da_batalha.dano}');
    expect(poder(m, 'fogo_real').descricao).toBe('Minha descrição: 400 de dano.');
  });

  it('a aba Batalha traz a descrição do card resolvida (o texto cru só aparece na edição)', () => {
    const f = fichaCompleta();
    const card = resumoBatalha(f, novaSessao(f)).protecoes.find((p) => p.id === 'protecao_divina')!;
    expect(card.descricao).toContain('+2.000 PV extras');
    expect(card.descricao).not.toMatch(/[{}]/);
  });
});
