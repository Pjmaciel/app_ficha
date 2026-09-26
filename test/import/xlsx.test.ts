import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Ficha } from '../../src/model/types';
import alexsander from '../../src/data/alexsander.json';
import { importarXlsx } from '../../src/import/xlsx';

function carregar(): Ficha {
  const arquivo = readFileSync('test/fixtures/alexsander-somar-iii.xlsx');
  const buffer = arquivo.buffer.slice(arquivo.byteOffset, arquivo.byteOffset + arquivo.byteLength) as ArrayBuffer;
  return importarXlsx(buffer);
}

describe('importarXlsx', () => {
  const ficha = carregar();

  it('reproduz exatamente o JSON de referência do Alexsander', () => {
    expect(ficha).toStrictEqual(alexsander);
  });

  it('força o nível 41 quando a planilha desatualizada traz 35', () => {
    expect(ficha.identidade.nivel).toBe(41);
  });

  it('lê os 64 ids de perícia, únicos, com inicial da aba FICHA', () => {
    expect(ficha.pericias).toHaveLength(64);
    expect(new Set(ficha.pericias.map((p) => p.id)).size).toBe(64);
    const inicial = (id: string) => ficha.pericias.find((p) => p.id === id)?.inicial;
    expect(inicial('espada')).toBe(336);
    expect(inicial('escudo')).toBe(336);
    expect(inicial('arma_de_fogo')).toBe(136);
  });

  it('resolve o atributo governante pela cadeia de referências da coluna K', () => {
    const atributo = (id: string) => ficha.pericias.find((p) => p.id === id)?.atributo;
    expect(atributo('fuga')).toBe('mental');
    expect(atributo('furtividade')).toBe('agilidade');
    expect(atributo('intimidar')).toBe('forca');
  });

  it('marca somente a Terra como Tsu real', () => {
    expect(ficha.tsu.filter((t) => t.real).map((t) => t.elemento)).toEqual(['terra']);
  });

  it('rejeita arquivo sem a aba LUGAN', () => {
    expect(() => importarXlsx(new ArrayBuffer(0))).toThrow();
  });
});
