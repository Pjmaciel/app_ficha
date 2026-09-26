import { describe, expect, it } from 'vitest';
import antiga from '../fixtures/alexsander-v2-sem-escala.json';
import dados from '../../src/data/alexsander.json';
import {
  alertasPilar,
  efeitosDoPoder,
  idEfeitoCombate,
  linhasDeEfeitos,
  marcadoresDisponiveis,
  marcadoresInvalidos,
  migrarFicha,
  novaSessao,
  patamaresDoPoder,
  pilarTexto,
  pvTotal,
  resolverTexto,
  resumoBatalha,
  usosPorDiaDoPoder,
  valorDeEfeito,
} from '../../src/engine';
import { importarJson } from '../../src/import';
import type { Ficha, Poder } from '../../src/model/types';

const clonar = (): Ficha => structuredClone(dados) as unknown as Ficha;
const poder = (f: Ficha, id: string): Poder => {
  const p = f.poderes.find((x) => x.id === id);
  if (!p) throw new Error(`Poder ausente: ${id}`);
  return p;
};
const efeito = (f: Ficha, poderId: string, id: string): number | null => valorDeEfeito(f, poderId, id);
/** A ficha com os valores da planilha: Proteção Divina no nível 1. */
const nivel1 = (): Ficha => {
  const f = clonar();
  poder(f, 'protecao_divina').nivel = 1;
  return f;
};

describe('efeitos escaláveis', () => {
  it('valor = fixo + porPonto × ⌊nível ÷ aCada⌋', () => {
    const f = clonar();
    const pd = poder(f, 'protecao_divina');
    const valores = (nivel: number) => {
      pd.nivel = nivel;
      return ['imunidade_rodadas', 'vigor', 'absorcao_area', 'raio_km2', 'criaturas', 'anti_mental'].map((id) => efeito(f, 'protecao_divina', id));
    };
    expect(valores(1)).toEqual([1, 0, 200, 5, 100, 150]);
    expect(valores(2)).toEqual([2, 1, 200, 10, 200, 300]);
    expect(valores(3)).toEqual([3, 1, 200, 15, 300, 450]);
    expect(valores(4)).toEqual([4, 2, 200, 20, 400, 600]);
  });

  it('o ajuste fixo do Lugan Completo preserva os 200 da planilha e a ação extra vem a cada 3 níveis', () => {
    const f = clonar();
    const lc = poder(f, 'lugan_completo');
    expect(efeito(f, 'lugan_completo', 'anti_mental')).toBe(200);
    expect(efeito(f, 'lugan_completo', 'voo_kmh')).toBe(280);
    expect(efeito(f, 'lugan_completo', 'acao_extra')).toBe(0);
    lc.nivel = 3;
    expect(efeito(f, 'lugan_completo', 'anti_mental')).toBe(400);
    expect(efeito(f, 'lugan_completo', 'acao_extra')).toBe(1);
    expect(efeito(f, 'lugan_completo', 'voo_kmh')).toBe(560);
  });

  it('as parcelas existentes são efeitos de ids reservados, vindos dos mesmos coeficientes', () => {
    const f = clonar();
    const ids = efeitosDoPoder(poder(f, 'lugan_da_batalha')).filter((e) => e.reservado).map((e) => e.id);
    expect(ids).toEqual([
      'ataque_armaBranca', 'ataque_magico', 'ataque_luta', 'ataque_armaFogo', 'defesa_esquivar', 'defesa_bloquear', 'defesa_aparar', 'dano',
    ]);
    expect(efeito(f, 'lugan_da_batalha', 'ataque_armaBranca')).toBe(150);
    expect(efeito(f, 'lugan_da_batalha', 'dano')).toBe(60);
    expect(efeito(f, 'protecao_divina', 'pv_extra')).toBe(1000);
    expect(efeito(f, 'protecao_divina', 'usos')).toBe(2);
    expect(efeito(f, 'forca_das_montanhas_divinas', 'atributo_forca')).toBe(60);
    expect(efeito(f, 'o_filho_de_hagashi', 'fieis')).toBe(32000);
    expect(efeito(f, 'golpe_devastador', 'dados_ataque')).toBe(3);
    expect(idEfeitoCombate('ataqueArmaBranca')).toBe('ataque_armaBranca');
    expect(idEfeitoCombate('aparar')).toBe('defesa_aparar');
  });

  it('um id reservado repetido em efeitos não cria segunda fonte: vale o coeficiente do campo', () => {
    const f = clonar();
    poder(f, 'protecao_divina').escala!.efeitos!.push({ id: 'pv_extra', rotulo: 'Duplicado', porPonto: 9999 });
    expect(efeito(f, 'protecao_divina', 'pv_extra')).toBe(1000);
    expect(pvTotal(f)).toBe(3904);
  });

  it('as sementes do livro: Velocidade Divina, Golpe Devastador, Filho de Hagashi, Força das Montanhas e Campeão', () => {
    const f = clonar();
    expect(efeito(f, 'velocidade_divina', 'velocidade_kmh')).toBe(440);
    expect(efeito(f, 'golpe_devastador', 'pressao_km2')).toBe(24);
    expect(efeito(f, 'o_filho_de_hagashi', 'protecao')).toBe(1400);
    expect(efeito(f, 'forca_das_montanhas_divinas', 'raio_km2')).toBe(2);
    expect(efeito(f, 'campeao_do_combate_divino', 'pressao_km2')).toBe(6);
    expect(efeito(f, 'fogo_real', 'dano_divinos')).toBe(200);
  });

  it('poder removido ou sem nível não tem efeito ativo', () => {
    const f = clonar();
    poder(f, 'protecao_divina').tipo = 'removido';
    expect(efeito(f, 'protecao_divina', 'raio_km2')).toBe(0);
    const g = clonar();
    poder(g, 'protecao_divina').nivel = null;
    expect(efeito(g, 'protecao_divina', 'absorcao_area')).toBe(0);
    expect(valorDeEfeito(g, 'protecao_divina', 'nivel')).toBe(0);
  });
});

describe('subir a Proteção Divina de 1 para 2 muda tudo junto', () => {
  it('PV 3404 → 3904, usos 1 → 2, anti-mental 150 → 300, raio 5 → 10 e criaturas 100 → 200', () => {
    const f = nivel1();
    const pd = poder(f, 'protecao_divina');
    expect([pvTotal(f), usosPorDiaDoPoder(pd), efeito(f, 'protecao_divina', 'anti_mental'), efeito(f, 'protecao_divina', 'raio_km2'), efeito(f, 'protecao_divina', 'criaturas')])
      .toEqual([3404, 1, 150, 5, 100]);
    pd.nivel = 2;
    expect([pvTotal(f), usosPorDiaDoPoder(pd), efeito(f, 'protecao_divina', 'anti_mental'), efeito(f, 'protecao_divina', 'raio_km2'), efeito(f, 'protecao_divina', 'criaturas')])
      .toEqual([3904, 2, 300, 10, 200]);
  });

  it('a reação de efeito mental soma 350 no nível 1 e 500 (200 + 300) no nível 2', () => {
    const reacaoMental = (f: Ficha): string => resumoBatalha(f, novaSessao(f)).reacoes.find((r) => r.situacao === 'Efeito mental divino')!.resposta;
    const f = nivel1();
    expect(reacaoMental(f)).toBe('Somar o bônus de Lugan Completo (+200) e de Proteção Divina (+150), total +350.');
    poder(f, 'protecao_divina').nivel = 2;
    expect(reacaoMental(f)).toBe('Somar o bônus de Lugan Completo (+200) e de Proteção Divina (+300), total +500.');
    expect(resolverTexto(f, '{soma:lugan_completo.anti_mental+protecao_divina.anti_mental}')).toBe('500');
  });

  it('reações, lembretes, ações e descrições acompanham o poder', () => {
    const f = clonar();
    const antes = resumoBatalha(f, novaSessao(f));
    expect(antes.lembretes).toContain('Proteção Divina: 2 rodada(s) por dia de imunidade.');
    expect(antes.lembretes).toContain('Golpe Devastador: 3 ponto(s) (usos por dia).');
    expect(antes.reacoes.find((r) => r.situacao === 'Dano absurdo ou divino')?.resposta).toBe('Proteção Divina: imune por 2 rodada(s) por dia.');
    expect(antes.reacoes.find((r) => r.situacao === 'Área contra aliados ou cenário')?.resposta).toContain('absorve 200 de dano em 10 km²');
    expect(antes.acoes.find((a) => a.id === 'fogo_real')).toMatchObject({
      rolagem: '400 de dano por rodada em 2 km²', notas: 'Contra divinos, ataques diretos recebem +200 de dano.',
    });
    poder(f, 'golpe_devastador').nivel = 5;
    poder(f, 'fogo_real').nivel = 3;
    poder(f, 'protecao_divina').descricao = 'Protege {poder.protecao_divina.criaturas} criaturas em {poder.protecao_divina.raio_km2} km².';
    const depois = resumoBatalha(f, novaSessao(f));
    expect(depois.lembretes).toContain('Golpe Devastador: 5 ponto(s) (usos por dia).');
    expect(depois.acoes.find((a) => a.id === 'fogo_real')).toMatchObject({
      rolagem: '400 de dano por rodada em 3 km²', notas: 'Contra divinos, ataques diretos recebem +250 de dano.',
    });
    expect(depois.protecoes.find((p) => p.id === 'protecao_divina')?.descricao).toBe('Protege 200 criaturas em 10 km².');
  });
});

describe('resolverTexto', () => {
  const f = clonar();

  it('resolve efeito, nível, valor por ponto, fixo e soma', () => {
    expect(resolverTexto(f, '{poder.protecao_divina.nivel}')).toBe('2');
    expect(resolverTexto(f, '{poder.protecao_divina.raio_km2}')).toBe('10');
    expect(resolverTexto(f, '{poder.protecao_divina.raio_km2.porPonto}')).toBe('5');
    expect(resolverTexto(f, '{poder.lugan_completo.anti_mental.fixo}')).toBe('100');
    expect(resolverTexto(f, '{soma:protecao_divina.criaturas + lugan_completo.anti_mental}')).toBe('400');
    expect(resolverTexto(f, '{soma:poder.protecao_divina.raio_km2+poder.fogo_real.area_km2}')).toBe('12');
  });

  it('formata milhares em português', () => {
    expect(resolverTexto(f, '{poder.o_filho_de_hagashi.fieis} fiéis')).toBe('32.000 fiéis');
  });

  it('deixa o texto sem marcador como está e não toca em chaves que não são marcadores vivos', () => {
    expect(resolverTexto(f, 'Sem marcadores: 5d×100 {x} e {}')).toBe('Sem marcadores: 5d×100 {x} e {}');
  });

  it('marcador de poder ou efeito inexistente fica visível e é apontado', () => {
    const texto = 'A {poder.nao_existe.x} e {poder.protecao_divina.nao_existe} e {soma:protecao_divina.raio_km2+fogo_real.zzz} e {poder.protecao_divina.raio_km2}';
    expect(resolverTexto(f, texto)).toBe('A {poder.nao_existe.x} e {poder.protecao_divina.nao_existe} e {soma:protecao_divina.raio_km2+fogo_real.zzz} e 10');
    expect(marcadoresInvalidos(f, texto)).toEqual(['{poder.nao_existe.x}', '{poder.protecao_divina.nao_existe}', '{soma:protecao_divina.raio_km2+fogo_real.zzz}']);
    expect(marcadoresInvalidos(f, 'Nada {x}')).toEqual([]);
  });

  it('lista os marcadores disponíveis com o valor atual', () => {
    const lista = marcadoresDisponiveis(f);
    expect(lista).toContainEqual({ marcador: '{poder.protecao_divina.anti_mental}', rotulo: 'Proteção Divina: Anula efeitos mentais divinos', valor: 300 });
    expect(lista).toContainEqual({ marcador: '{poder.protecao_divina.nivel}', rotulo: 'Proteção Divina: nível', valor: 2 });
    const g = clonar();
    poder(g, 'protecao_divina').tipo = 'removido';
    expect(marcadoresDisponiveis(g).some((m) => m.marcador.startsWith('{poder.protecao_divina'))).toBe(false);
  });

  it('não altera a ficha', () => {
    const g = clonar();
    const antes = JSON.stringify(g);
    resolverTexto(g, '{poder.protecao_divina.raio_km2}');
    marcadoresDisponiveis(g);
    expect(JSON.stringify(g)).toBe(antes);
  });
});

describe('patamares e o card de absorção', () => {
  const card = (f: Ficha) => resumoBatalha(f, novaSessao(f)).protecoes.find((p) => p.id === 'protecao_divina')!;

  it('nível 2: nenhum atingido e o próximo é o nível 3 (Tsu real)', () => {
    const f = clonar();
    const { atingidos, proximo } = patamaresDoPoder(f, poder(f, 'protecao_divina'));
    expect(atingidos).toEqual([]);
    expect(proximo).toMatchObject({ nivel: 3, atingido: false });
    const c = card(f);
    expect(c.proximoPatamar?.nivel).toBe(3);
    expect(c.resumo).toContain('próximo patamar: nível 3, passa a reduzir a Tsu real');
  });

  it('o card traz os efeitos no nível atual: 2 rodadas, +1000 PV, absorve 200, 10 km², 200 criaturas e +300 contra mentais', () => {
    const textos = card(clonar()).efeitos.map((e) => e.texto);
    expect(textos).toContain('Imunidade total: 2 rodadas por dia');
    expect(textos).toContain('PV extras: +1000 PV');
    expect(textos).toContain('Absorção de dano no cenário e nos envolvidos: 200 de dano');
    expect(textos).toContain('Raio da proteção: 10 km²');
    expect(textos).toContain('Criaturas protegidas: 200 criaturas');
    expect(textos).toContain('Anula efeitos mentais divinos: 300');
    expect(textos).toContain('Rolagem de vigor lugânico: 1');
    expect(textos.some((t) => t.startsWith('Ataque') || t.startsWith('Dano'))).toBe(false);
  });

  it('nível 3 atinge o primeiro patamar; nível 6 o segundo; nível 9 não tem próximo', () => {
    const f = clonar();
    const pd = poder(f, 'protecao_divina');
    pd.nivel = 3;
    expect(card(f).patamares.filter((x) => x.atingido).map((x) => x.nivel)).toEqual([3]);
    expect(card(f).proximoPatamar?.nivel).toBe(6);
    pd.nivel = 6;
    expect(card(f).patamares.filter((x) => x.atingido).map((x) => x.nivel)).toEqual([3, 6]);
    pd.nivel = 9;
    expect(card(f).patamares.every((x) => x.atingido)).toBe(true);
    expect(card(f).proximoPatamar).toBeNull();
    expect(card(f).resumo).toContain('nível 9: reduz a Tsu real com 1d+2');
  });

  it('Velocidade Divina: o patamar do nível 4 usa o valor por ponto do teleporte', () => {
    const f = clonar();
    const { proximo } = patamaresDoPoder(f, poder(f, 'velocidade_divina'));
    expect(proximo?.texto).toBe('rompe a barreira do espaço: teleporte para qualquer lugar de Kitai, até 2.000 km por ponto');
    poder(f, 'velocidade_divina').nivel = 4;
    expect(patamaresDoPoder(f, poder(f, 'velocidade_divina')).atingidos.map((x) => x.nivel)).toEqual([4]);
  });

  it('patamares desordenados são ordenados por nível; poder sem escala não tem patamares', () => {
    const f = clonar();
    poder(f, 'protecao_divina').escala!.patamares = [{ nivel: 9, texto: 'c' }, { nivel: 3, texto: 'a' }, { nivel: 6, texto: 'b' }];
    expect(patamaresDoPoder(f, poder(f, 'protecao_divina')).patamares.map((x) => x.nivel)).toEqual([3, 6, 9]);
    expect(patamaresDoPoder(f, poder(f, 'portador_da_jikar'))).toEqual({ patamares: [], atingidos: [], proximo: null });
    expect(linhasDeEfeitos(poder(f, 'portador_da_jikar'))).toEqual([]);
  });

  it('a lista de efeitos editada pelo jogador aparece no card', () => {
    const f = clonar();
    poder(f, 'protecao_divina').escala!.efeitos!.push({ id: 'novo', rotulo: 'Escudos', porPonto: 3, unidade: 'escudos' });
    expect(card(f).efeitos.map((e) => e.texto)).toContain('Escudos: 6 escudos');
    poder(f, 'protecao_divina').escala!.efeitos = [];
    expect(card(f).efeitos.map((e) => e.id)).toEqual(['pv_extra']);
  });
});

describe('pilar', () => {
  it('a ficha traz o nível do pilar 3 e o exibe como "Justiça 3"', () => {
    const f = clonar();
    expect(f.identidade.pilarNivel).toBe(3);
    expect(pilarTexto(f)).toBe('Justiça 3');
    f.identidade.pilarNivel = 4;
    expect(pilarTexto(f)).toBe('Justiça 4');
    f.identidade.pilarLuganico = ' ';
    expect(pilarTexto(f)).toBe('4');
    f.identidade.pilarNivel = 0;
    expect(pilarTexto(f)).toBe('—');
  });

  it('a migração preenche pilarNivel = 3 quando ausente (versões 1 e 2) e respeita o valor salvo', () => {
    const { pilarNivel: _, ...semPilar } = clonar().identidade;
    expect(migrarFicha({ ...clonar(), identidade: semPilar }).identidade.pilarNivel).toBe(3);
    expect(migrarFicha(structuredClone(antiga)).identidade.pilarNivel).toBe(3);
    const f = clonar();
    f.identidade.pilarNivel = 5;
    expect(migrarFicha(f).identidade.pilarNivel).toBe(5);
  });

  it('alerta quando um poder exige pilar acima do atual; removido não alerta', () => {
    const f = clonar();
    expect(alertasPilar(f)).toEqual([]);
    poder(f, 'lugan_completo').requerPilar = 4;
    poder(f, 'fogo_real').requerPilar = 3;
    expect(alertasPilar(f)).toEqual([{ poderId: 'lugan_completo', nome: 'Lugan Completo', requer: 4, atual: 3 }]);
    f.identidade.pilarNivel = 4;
    expect(alertasPilar(f)).toEqual([]);
    f.identidade.pilarNivel = 1;
    poder(f, 'lugan_completo').tipo = 'removido';
    expect(alertasPilar(f).map((a) => a.poderId)).toEqual(['fogo_real']);
  });

  it('a importação de JSON valida pilarNivel e requerPilar (ausentes são aceitos)', () => {
    const f = clonar();
    expect(importarJson(JSON.stringify(f)).identidade.pilarNivel).toBe(3);
    expect(() => importarJson(JSON.stringify({ ...f, identidade: { ...f.identidade, pilarNivel: 'três' } }))).toThrow(/pilarNivel/);
    const poderes = f.poderes.map((p) => (p.id === 'fogo_real' ? { ...p, requerPilar: 'x' } : p));
    expect(() => importarJson(JSON.stringify({ ...f, poderes }))).toThrow(/requerPilar/);
  });
});

describe('migração dos efeitos e dos textos vivos', () => {
  it('a ficha salva antes dos efeitos recebe efeitos e patamares do livro, sem mudar as parcelas', () => {
    const salva = clonar();
    for (const p of salva.poderes) if (p.escala) { delete p.escala.efeitos; delete p.escala.patamares; }
    delete poder(salva, 'velocidade_divina').escala;
    delete poder(salva, 'fogo_real').escala;
    const m = migrarFicha(salva);
    expect(m).toStrictEqual(clonar());
  });

  it('é idempotente e respeita a lista de efeitos vazia e a escala vazia', () => {
    const f = clonar();
    poder(f, 'protecao_divina').escala!.efeitos = [];
    poder(f, 'protecao_divina').escala!.patamares = [];
    poder(f, 'lugan_completo').escala = {};
    const m = migrarFicha(f);
    expect(m.poderes.find((p) => p.id === 'protecao_divina')!.escala!.efeitos).toEqual([]);
    expect(m.poderes.find((p) => p.id === 'protecao_divina')!.escala!.patamares).toEqual([]);
    expect(m.poderes.find((p) => p.id === 'lugan_completo')!.escala).toEqual({});
    expect(migrarFicha(m)).toStrictEqual(m);
  });

  it('troca os textos antigos da semente pelos vivos e mantém os editados', () => {
    const f = clonar();
    f.acoes[1] = { id: 'fogo_real', nome: 'Fogo Real', rolagem: '400 de dano por rodada em 2 km²', notas: 'Minha nota: +200 de dano.' };
    f.lembretes = ['Proteção Divina: 1 rodada por dia de imunidade.', 'Golpe Devastador: 3 pontos (usos por dia).', 'Escolha minha: 200'];
    f.reacoes = [
      { situacao: 'Efeito mental divino', resposta: 'Somar o bônus de Lugan Completo (+200) e de Proteção Divina (+150).' },
      { situacao: 'Outra', resposta: 'Proteção Divina absorve 200 de dano; O Filho de Hagashi protege os fiéis.' },
    ];
    const m = migrarFicha(f);
    expect(m.acoes[1].rolagem).toBe('{poder.fogo_real.dano_rodada} de dano por rodada em {poder.fogo_real.area_km2} km²');
    expect(m.acoes[1].notas).toBe('Minha nota: +200 de dano.');
    expect(m.lembretes[0]).toBe('Proteção Divina: {poder.protecao_divina.imunidade_rodadas} rodada(s) por dia de imunidade.');
    expect(m.lembretes[1]).toBe('Golpe Devastador: {poder.golpe_devastador.nivel} ponto(s) (usos por dia).');
    expect(m.lembretes[2]).toBe('Escolha minha: 200');
    expect(m.reacoes[0].resposta).toContain('{soma:lugan_completo.anti_mental+protecao_divina.anti_mental}');
    expect(m.reacoes[1].resposta).toContain('{poder.protecao_divina.absorcao_area}');
    expect(migrarFicha(m)).toStrictEqual(m);
  });

  it('a ficha salva antes da escala termina igual à embutida (com a Proteção Divina no nível da planilha)', () => {
    expect(migrarFicha(structuredClone(antiga))).toStrictEqual({ ...nivel1(), revisaoDados: 0 });
  });
});

describe('validação dos efeitos na importação de JSON', () => {
  const comEfeitos = (escala: unknown) => JSON.stringify({ ...clonar(), poderes: clonar().poderes.map((p) => (p.id === 'fogo_real' ? { ...p, escala } : p)) });

  it('aceita efeitos e patamares completos e os preserva na ida e volta', () => {
    const escala = {
      efeitos: [{ id: 'x_1', rotulo: 'X', porPonto: 2, fixo: 1, unidade: 'km²', aCada: 3 }],
      patamares: [{ nivel: 2, texto: 'vale {poder.fogo_real.nivel}' }],
    };
    const f = importarJson(comEfeitos(escala));
    expect(poder(f, 'fogo_real').escala).toEqual(escala);
  });

  it.each([
    ['efeitos que não é lista', { efeitos: 'x' }, /efeitos/],
    ['efeito sem rótulo', { efeitos: [{ id: 'a', porPonto: 1 }] }, /efeito inválido/],
    ['efeito com id com ponto', { efeitos: [{ id: 'a.b', rotulo: 'A', porPonto: 1 }] }, /efeito inválido/],
    ['efeito com porPonto de texto', { efeitos: [{ id: 'a', rotulo: 'A', porPonto: '1' }] }, /efeito inválido/],
    ['efeito com id repetido', { efeitos: [{ id: 'a', rotulo: 'A', porPonto: 1 }, { id: 'a', rotulo: 'B', porPonto: 1 }] }, /repetido/],
    ['efeito com aCada zero', { efeitos: [{ id: 'a', rotulo: 'A', porPonto: 1, aCada: 0 }] }, /aCada/],
    ['efeito com fixo de texto', { efeitos: [{ id: 'a', rotulo: 'A', porPonto: 1, fixo: 'x' }] }, /fixo/],
    ['patamares que não é lista', { patamares: {} }, /patamares/],
    ['patamar sem texto', { patamares: [{ nivel: 3 }] }, /patamar inválido/],
  ])('rejeita %s', (_nome, escala, erro) => {
    expect(() => importarJson(comEfeitos(escala))).toThrow(erro);
  });
});
