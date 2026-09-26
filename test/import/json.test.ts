import { describe, expect, it } from 'vitest';
import type { Ficha } from '../../src/model/types';
import alexsander from '../../src/data/alexsander.json';
import { exportarJson, importarJson } from '../../src/import/json';

const ficha = alexsander as Ficha;

describe('exportarJson e importarJson', () => {
  it('faz ida e volta sem perda', () => {
    expect(importarJson(exportarJson(ficha))).toStrictEqual(ficha);
  });

  it('rejeita texto que não é JSON', () => {
    expect(() => importarJson('{ quebrado')).toThrow(/JSON válido/);
  });

  it('rejeita versão diferente de 1', () => {
    const texto = JSON.stringify({ ...ficha, versao: 2 });
    expect(() => importarJson(texto)).toThrow(/versão não suportada/);
  });

  it('rejeita ficha sem atributo obrigatório', () => {
    const { mental: _mental, ...resto } = ficha.atributos;
    const texto = JSON.stringify({ ...ficha, atributos: resto });
    expect(() => importarJson(texto)).toThrow(/atributo mental ausente/);
  });

  it('rejeita perícia com atributo desconhecido', () => {
    const pericias = [{ ...ficha.pericias[0], atributo: 'sorte' }];
    expect(() => importarJson(JSON.stringify({ ...ficha, pericias }))).toThrow(/atributo desconhecido/);
  });

  it('rejeita valores não numéricos em campos numéricos', () => {
    const identidade = { ...ficha.identidade, nivel: '41' };
    expect(() => importarJson(JSON.stringify({ ...ficha, identidade }))).toThrow(/identidade.nivel/);
  });
});
