// Adaptador para as funções de src/import (contrato: importarXlsx, exportarJson, importarJson).
import { exportarJson, importarJson, importarXlsx } from '../import';
import type { Ficha } from '../model/types';

export function lerXlsx(dados: ArrayBuffer): Ficha {
  return importarXlsx(dados);
}

export function lerJson(texto: string): Ficha {
  return importarJson(texto);
}

export function gerarJson(ficha: Ficha): string {
  return exportarJson(ficha);
}
