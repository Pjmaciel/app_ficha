// Declaração mínima para ler o fixture nos testes sem depender de @types/node.
declare module 'node:fs' {
  export function readFileSync(caminho: string): { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
}
