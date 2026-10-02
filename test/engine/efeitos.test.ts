import { describe, expect, it } from 'vitest';
import antiga from '../fixtures/alexsander-v2-sem-escala.json';
import dados from '../../src/data/alexsander.json';
import { fichaCompleta } from '../fixtures/ficha-completa';
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

const clonar = (): Ficha => fichaCompleta();
const clonarBuild = (): Ficha => structuredClone(dados) as unknown as Ficha;
const poder = (f: Ficha, id: string): Poder => {
  const p = f.poderes.find((x) => x.id === id);
  if (!p) throw new Error(`Poder ausente: ${id}`);
  return p;
};
const efeito = (f: Ficha, poderId: string, id: string): number | null => valorDeEfeito(f, poderId, id);
/** A ficha com a Proteção Divina no nível 1 (o motor lê o nível derivado; aqui ele é fixado à mão). */
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
    // A absorção em área é de 200 POR PONTO (regra da mesa, confirmada pelo jogador): 400 no nível 2.
    expect(valores(1)).toEqual([1, 0, 200, 5, 100, 150]);
    expect(valores(2)).toEqual([2, 1, 400, 10, 200, 300]);
    expect(valores(3)).toEqual([3, 1, 600, 15, 300, 450]);
    expect(valores(4)).toEqual([4, 2, 800, 20, 400, 600]);
  });

  it('o Lugan Completo segue o coeficiente do livro por ponto (sem ajuste fixo) e a ação extra vem a cada 3 níveis', () => {
    const f = clonar();
    const lc = poder(f, 'lugan_completo');
    expect(efeito(f, 'lugan_completo', 'anti_mental')).toBe(600);
    expect(efeito(f, 'lugan_completo', 'voo_kmh')).toBe(840);
    expect(efeito(f, 'lugan_completo', 'acao_extra')).toBe(2);
    lc.nivel = 3;
    expect(efeito(f, 'lugan_completo', 'anti_mental')).toBe(300);
    expect(efeito(f, 'lugan_completo', 'acao_extra')).toBe(1);
    expect(efeito(f, 'lugan_completo', 'voo_kmh')).toBe(420);
  });

  it('as parcelas existentes são efeitos de ids reservados, vindos dos mesmos coeficientes', () => {
    const f = clonar();
    const ids = efeitosDoPoder(poder(f, 'lugan_da_batalha')).filter((e) => e.reservado).map((e) => e.id);
    expect(ids).toEqual([
      'ataque_armaBranca', 'ataque_magico', 'ataque_luta', 'ataque_armaFogo', 'defesa_esquivar', 'defesa_bloquear', 'defesa_aparar', 'dano',
    ]);
    expect(efeito(f, 'lugan_da_batalha', 'ataque_armaBranca')).toBe(250);
    expect(efeito(f, 'lugan_da_batalha', 'dano')).toBe(100);
    expect(efeito(f, 'protecao_divina', 'pv_extra')).toBe(2000);
    expect(efeito(f, 'protecao_divina', 'usos')).toBe(4);
    expect(efeito(f, 'forca_das_montanhas_divinas', 'atributo_forca')).toBe(180);
    expect(efeito(f, 'o_filho_de_hagashi', 'fieis')).toBe(96000);
    expect(efeito(f, 'golpe_devastador', 'dados_ataque')).toBe(3);
    expect(idEfeitoCombate('ataqueArmaBranca')).toBe('ataque_armaBranca');
    expect(idEfeitoCombate('aparar')).toBe('defesa_aparar');
  });

  it('um id reservado repetido em efeitos não cria segunda fonte: vale o coeficiente do campo', () => {
    const f = clonar();
    poder(f, 'protecao_divina').escala!.efeitos!.push({ id: 'pv_extra', rotulo: 'Duplicado', porPonto: 9999 });
    expect(efeito(f, 'protecao_divina', 'pv_extra')).toBe(2000);
    expect(pvTotal(f)).toBe(4904);
  });

  it('as sementes do livro: Velocidade Divina, Golpe Devastador, Filho de Hagashi, Força das Montanhas e Campeão', () => {
    const f = clonar();
    expect(efeito(f, 'velocidade_divina', 'velocidade_kmh')).toBe(440);
    expect(efeito(f, 'golpe_devastador', 'pressao_km2')).toBe(24);
    expect(efeito(f, 'o_filho_de_hagashi', 'protecao')).toBe(4200);
    expect(efeito(f, 'forca_das_montanhas_divinas', 'raio_km2')).toBe(6);
    expect(efeito(f, 'campeao_do_combate_divino', 'pressao_km2')).toBe(12);
    expect(efeito(f, 'fogo_real', 'dano_divinos')).toBe(300);
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

  it('a reação de efeito mental cita o bônus da Proteção Divina (+150 no nível 1, +300 no 2); o marcador soma continua valendo', () => {
    const reacaoMental = (f: Ficha): string => resumoBatalha(f, novaSessao(f)).reacoes.find((r) => r.situacao === 'Efeito mental divino')!.resposta;
    const f = nivel1();
    expect(reacaoMental(f)).toBe('Somar o bônus de Proteção Divina (+150).');
    poder(f, 'protecao_divina').nivel = 2;
    expect(reacaoMental(f)).toBe('Somar o bônus de Proteção Divina (+300).');
    expect(resolverTexto(f, '{soma:lugan_completo.anti_mental+protecao_divina.anti_mental}')).toBe('900');
  });

  it('reações, lembretes, ações e descrições acompanham o poder', () => {
    const f = clonar();
    f.acoes.push({ id: 'fogo_real', nome: 'Fogo Real', rolagem: '{poder.fogo_real.dano_rodada} de dano por rodada em {poder.fogo_real.area_km2} km²', notas: 'Contra divinos, +{poder.fogo_real.dano_divinos} de dano.' });
    const antes = resumoBatalha(f, novaSessao(f));
    expect(antes.lembretes).toContain('Proteção Divina: 4 rodada(s) por dia de imunidade.');
    expect(antes.lembretes).toContain('Proteção Divina: 4 ponto(s) (usos por dia).');
    expect(antes.reacoes.find((r) => r.situacao === 'Dano absurdo ou divino')?.resposta).toBe('Proteção Divina: imune por 4 rodada(s) por dia.');
    expect(antes.reacoes.find((r) => r.situacao === 'Área contra aliados ou cenário')?.resposta).toContain('absorve 800 de dano em 20 km²');
    expect(antes.acoes.find((a) => a.id === 'fogo_real')).toMatchObject({
      rolagem: '400 de dano por rodada em 6 km²', notas: 'Contra divinos, +300 de dano.',
    });
    poder(f, 'protecao_divina').nivel = 5;
    poder(f, 'fogo_real').nivel = 3;
    poder(f, 'protecao_divina').descricao = 'Protege {poder.protecao_divina.criaturas} criaturas em {poder.protecao_divina.raio_km2} km².';
    const depois = resumoBatalha(f, novaSessao(f));
    expect(depois.lembretes).toContain('Proteção Divina: 5 ponto(s) (usos por dia).');
    expect(depois.acoes.find((a) => a.id === 'fogo_real')).toMatchObject({
      rolagem: '400 de dano por rodada em 3 km²', notas: 'Contra divinos, +150 de dano.',
    });
    expect(depois.protecoes.find((p) => p.id === 'protecao_divina')?.descricao).toBe('Protege 500 criaturas em 25 km².');
  });
});

describe('resolverTexto', () => {
  const f = clonar();

  it('resolve efeito, nível, valor por ponto, fixo e soma', () => {
    expect(resolverTexto(f, '{poder.protecao_divina.nivel}')).toBe('4');
    expect(resolverTexto(f, '{poder.protecao_divina.raio_km2}')).toBe('20');
    expect(resolverTexto(f, '{poder.protecao_divina.raio_km2.porPonto}')).toBe('5');
    expect(resolverTexto(f, '{poder.protecao_divina.absorcao_area.porPonto}')).toBe('200');
    expect(resolverTexto(f, '{poder.fogo_real.dano_rodada.fixo}')).toBe('400');
    expect(resolverTexto(f, '{soma:protecao_divina.criaturas + lugan_completo.anti_mental}')).toBe('1.000');
    expect(resolverTexto(f, '{soma:poder.protecao_divina.raio_km2+poder.fogo_real.area_km2}')).toBe('26');
  });

  it('formata milhares em português', () => {
    expect(resolverTexto(f, '{poder.o_filho_de_hagashi.fieis} fiéis')).toBe('96.000 fiéis');
  });

  it('deixa o texto sem marcador como está e não toca em chaves que não são marcadores vivos', () => {
    expect(resolverTexto(f, 'Sem marcadores: 5d×100 {x} e {}')).toBe('Sem marcadores: 5d×100 {x} e {}');
  });

  it('marcador de poder ou efeito inexistente fica visível e é apontado', () => {
    const texto = 'A {poder.nao_existe.x} e {poder.protecao_divina.nao_existe} e {soma:protecao_divina.raio_km2+fogo_real.zzz} e {poder.protecao_divina.raio_km2}';
    expect(resolverTexto(f, texto)).toBe('A {poder.nao_existe.x} e {poder.protecao_divina.nao_existe} e {soma:protecao_divina.raio_km2+fogo_real.zzz} e 20');
    expect(marcadoresInvalidos(f, texto)).toEqual(['{poder.nao_existe.x}', '{poder.protecao_divina.nao_existe}', '{soma:protecao_divina.raio_km2+fogo_real.zzz}']);
    expect(marcadoresInvalidos(f, 'Nada {x}')).toEqual([]);
  });

  it('lista os marcadores disponíveis com o valor atual', () => {
    const lista = marcadoresDisponiveis(f);
    expect(lista).toContainEqual({ marcador: '{poder.protecao_divina.anti_mental}', rotulo: 'Proteção Divina: Anula efeitos mentais divinos', valor: 600 });
    expect(lista).toContainEqual({ marcador: '{poder.protecao_divina.nivel}', rotulo: 'Proteção Divina: nível', valor: 4 });
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
    poder(f, 'protecao_divina').nivel = 2;
    const { atingidos, proximo } = patamaresDoPoder(f, poder(f, 'protecao_divina'));
    expect(atingidos).toEqual([]);
    expect(proximo).toMatchObject({ nivel: 3, atingido: false });
    const c = card(f);
    expect(c.proximoPatamar?.nivel).toBe(3);
    expect(c.resumo).toContain('próximo patamar: nível 3, passa a reduzir a Tsu real');
  });

  it('nível 4 (o da ficha): patamar 3 atingido e o próximo é o nível 6 (1d+1)', () => {
    const f = clonar();
    const { atingidos, proximo } = patamaresDoPoder(f, poder(f, 'protecao_divina'));
    expect(atingidos.map((x) => x.nivel)).toEqual([3]);
    expect(proximo).toMatchObject({ nivel: 6, atingido: false });
    expect(card(f).resumo).toContain('nível 3: passa a reduzir a Tsu real: rola 1d para diminuir o dano');
    expect(card(f).resumo).toContain('próximo patamar: nível 6, reduz a Tsu real com 1d+1');
  });

  it('o card traz os efeitos no nível atual: 4 rodadas, +2000 PV, absorve 800, 20 km², 400 criaturas e +600 contra mentais', () => {
    const textos = card(clonar()).efeitos.map((e) => e.texto);
    expect(textos).toContain('Imunidade total: 4 rodadas por dia');
    expect(textos).toContain('PV extras: +2000 PV');
    expect(textos).toContain('Absorção de dano no cenário e nos envolvidos: 800 de dano');
    expect(textos).toContain('Raio da proteção: 20 km²');
    expect(textos).toContain('Criaturas protegidas: 400 criaturas');
    expect(textos).toContain('Anula efeitos mentais divinos: 600');
    expect(textos).toContain('Rolagem de vigor lugânico: 2');
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
    expect(card(f).efeitos.map((e) => e.texto)).toContain('Escudos: 12 escudos');
    poder(f, 'protecao_divina').escala!.efeitos = [];
    expect(card(f).efeitos.map((e) => e.id)).toEqual(['pv_extra']);
  });
});

describe('pilar', () => {
  it('a ficha traz o pilar Justiça 3 e o exibe como "Justiça 3"', () => {
    const f = clonar();
    expect(f.pilar.nivel).toBe(3);
    expect(pilarTexto(f)).toBe('Justiça 3');
    f.pilar.nivel = 4;
    expect(pilarTexto(f)).toBe('Justiça 4');
    f.pilar.nome = ' ';
    expect(pilarTexto(f)).toBe('4');
    f.pilar.nivel = 0;
    expect(pilarTexto(f)).toBe('—');
  });

  it('a migração monta o pilar (nível 3 quando ausente, versões 1 e 2) e respeita o nível salvo', () => {
    const { pilar: _, ...semPilar } = clonar();
    const legado = { ...semPilar, identidade: { ...clonar().identidade, pilarLuganico: 'Justiça' } };
    expect(migrarFicha(legado).pilar.nivel).toBe(3);
    expect(migrarFicha(structuredClone(antiga)).pilar).toMatchObject({ nome: 'Justiça', nivel: 3 });
    expect(migrarFicha(structuredClone(antiga)).pilar).not.toHaveProperty('nivelAplicado');
    const f = clonar();
    f.pilar.nivel = 5;
    expect(migrarFicha(f).pilar.nivel).toBe(5);
  });

  it('alerta quando um poder exige pilar acima do atual; removido não alerta', () => {
    const f = clonar();
    expect(alertasPilar(f)).toEqual([]);
    poder(f, 'lugan_completo').requerPilar = 4;
    poder(f, 'fogo_real').requerPilar = 3;
    expect(alertasPilar(f)).toEqual([{ poderId: 'lugan_completo', nome: 'Lugan Completo', requer: 4, atual: 3 }]);
    f.pilar.nivel = 4;
    expect(alertasPilar(f)).toEqual([]);
    f.pilar.nivel = 1;
    poder(f, 'lugan_completo').tipo = 'removido';
    expect(alertasPilar(f).map((a) => a.poderId)).toEqual(['fogo_real']);
  });

  it('a importação de JSON valida o pilar e requerPilar (pilar ausente é aceito e montado na migração)', () => {
    const f = clonar();
    expect(importarJson(JSON.stringify(f)).pilar.nivel).toBe(3);
    expect(() => importarJson(JSON.stringify({ ...f, pilar: { ...f.pilar, nivel: 'três' } }))).toThrow(/pilar\.nivel/);
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

  it('a ficha salva antes da escala termina igual à embutida (níveis da semente do pilar)', () => {
    // O XP é progresso do jogador: a planilha e a ficha antiga trazem 12, a embutida tem mais; é a única diferença esperada.
    expect(migrarFicha(structuredClone(antiga))).toStrictEqual({ ...clonarBuild(), revisaoDados: 0, xp: { total: 12, atual: 12 } });
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
