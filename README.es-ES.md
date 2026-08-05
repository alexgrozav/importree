

# importree

[![npm version](https://img.shields.io/npm/v/importree)](https://www.npmjs.com/package/importree)
[![npm downloads](https://img.shields.io/npm/dm/importree)](https://www.npmjs.com/package/importree)
[![bundle size](https://img.shields.io/bundlephobia/minzip/importree)](https://bundlephobia.com/package/importree)
[![license](https://img.shields.io/npm/l/importree)](https://github.com/alexgrozav/importree/blob/main/LICENSE)

Construye árboles de dependencias de importación para archivos TypeScript y JavaScript. Análisis estático rápido y sin dependencias para la detección de dependencias y la invalidación de caché.

Cuando un archivo cambia, necesitas saber qué más se ve afectado. `importree` construye el árbol completo de dependencias de importación para cualquier punto de entrada TypeScript o JavaScript, sin dependencias externas y sin sobrecarga de análisis AST.

Diseñado para pipelines de CI, herramientas de compilación, ejecutores de tareas en monorepositorios y selectores de pruebas.

[Website](https://importree.js.org) · [GitHub](https://github.com/alexgrozav/importree) · [npm](https://www.npmjs.com/package/importree)

## Highlights

- **Sin dependencias** — Construido completamente con los módulos integrados de Node.js. Sin binarios nativos, sin WASM.
- **Escaneo rápido** — Extracción de importaciones basada en expresiones regulares con recorrido de archivos asíncrono concurrente. Sin sobrecarga de análisis AST.
- **Soporte para alias de rutas** — Resuelve `@/components`, `~/utils` o cualquier alias personalizado con coincidencia de prefijo más largo y sondeo automático de extensiones.
- **Invalidación de caché** — El grafo de dependencias inversas precalculado responde instantáneamente a "¿qué necesita recompilarse?".
- **Salida dual** — Incluye tanto ESM como CJS con declaraciones completas de TypeScript.

## Benchmarks

Medido con [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) en Node.js v22. Los resultados varían según el hardware.

### Comparison with alternatives

Cada herramienta aporta diferentes fortalezas: [dependency-tree](https://github.com/dependents/node-dependency-tree) ofrece un análisis robusto basado en AST mediante detective, [madge](https://github.com/pahen/madge) admite varios lenguajes y proporciona detección de dependencias circulares con visualización. `importree` intercambia esas características por velocidad bruta mediante extracción basada en expresiones regulares.

| Escenario           | importree  | [dependency-tree](https://github.com/dependents/node-dependency-tree) | [madge](https://github.com/pahen/madge) | Manual glob+regex | ts.createProgram |
| ------------------ | ---------- | --------------------------------------------------------------------- | --------------------------------------- | ----------------- | ---------------- |
| Pequeño (10 archivos)   | **0.2 ms** | 1.3 ms                                                                | 1.4 ms                                  | 0.7 ms            | ~100 ms          |
| Mediano (100 archivos) | **1.1 ms** | 8.7 ms                                                                | 8.8 ms                                  | 5.6 ms            | ~100 ms          |
| Grande (500 archivos)  | **6.0 ms** | 21.5 ms                                                               | 25.8 ms                                 | 27.6 ms           | ~100 ms          |

### Full tree build

| Tamaño del proyecto | Tiempo medio | Rendimiento   |
| ------------ | --------- | ------------ |
| 10 archivos     | 0.2 ms    | ~5,121 ops/s |
| 100 archivos    | 1.2 ms    | ~863 ops/s   |
| 500 archivos    | 5.1 ms    | ~197 ops/s   |
| 1,000 archivos  | 10.3 ms   | ~97 ops/s    |

### Scanner throughput

| Operación                     | Rendimiento    |
| ----------------------------- | ------------- |
| `scanImports` (3 importaciones)     | ~706K ops/s   |
| `scanImports` (50 importaciones)    | ~79K ops/s    |
| `stripComments` (1,000 líneas) | ~12,337 ops/s |

> Ejecuta `pnpm bench:run` para reproducirlo localmente.

## Install

```sh
npm install importree
# or
pnpm add importree
# or
yarn add importree
# or
bun add importree
```

Requiere Node.js >= 18.

## Quick Start

### Build the tree

```ts
import { importree } from "importree";

const tree = await importree("./src/index.ts", {
  aliases: { "@": "./src" },
});

console.log(tree.files);
// ['/abs/src/index.ts', '/abs/src/app.ts', ...]

console.log(tree.externals);
// ['react', 'lodash', 'node:path']

console.log(tree.graph);
// { '/abs/src/index.ts': ['/abs/src/app.ts', ...] }
```

### Find affected files

```ts
import { importree, getAffectedFiles } from "importree";

const tree = await importree("./src/index.ts");

// When utils.ts changes, what needs rebuilding?
const affected = getAffectedFiles(tree, "./src/utils.ts");

console.log(affected);
// ['/abs/src/app.ts', '/abs/src/index.ts']
// ^ every file that transitively depends on utils.ts
```

## API

### `importree(entry, options?)`

Resuelve recursivamente todas las importaciones estáticas, importaciones dinámicas, llamadas a `require()` y re-exportaciones comenzando desde el archivo de entrada. Devuelve el grafo completo de dependencias.

```ts
importree(entry: string, options?: ImportreeOptions): Promise<ImportTree>
```

#### Parámetros

| Parámetro | Tipo               | Requerido | Descripción                                     |
| --------- | ------------------ | -------- | ----------------------------------------------- |
| `entry`   | `string`           | Sí      | Ruta al archivo de entrada (se resuelve relativa a `cwd`) |
| `options` | `ImportreeOptions` | No       | Configuración para el comportamiento de resolución           |

#### `ImportreeOptions`

| Opción       | Tipo                     | Predeterminado                                          | Descripción                                                 |
| ------------ | ------------------------ | ------------------------------------------------ | ----------------------------------------------------------- |
| `rootDir`    | `string`                 | `process.cwd()`                                  | Directorio raíz para resolver rutas relativas de alias           |
| `aliases`    | `Record<string, string>` | `{}`                                             | Mapeos de alias de rutas (p. ej., `{ '@': './src' }`)              |
| `extensions` | `string[]`               | `['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']` | Extensiones de archivo a probar al resolver importaciones sin extensión |

#### Devuelve

`Promise<ImportTree>` — el árbol de dependencias resuelto.

---

### `getAffectedFiles(tree, changedFile)`

Recorrido BFS del grafo de dependencias inversas. Devuelve todos los archivos que dependen transitivamente del archivo modificado: ordenados, deterministas y excluyendo el archivo modificado en sí.

```ts
getAffectedFiles(tree: ImportTree, changedFile: string): string[]
```

#### Parámetros

| Parámetro     | Tipo         | Requerido | Descripción                                          |
| ------------- | ------------ | -------- | ---------------------------------------------------- |
| `tree`        | `ImportTree` | Sí      | Un árbol devuelto previamente por `importree()`          |
| `changedFile` | `string`     | Sí      | Ruta al archivo que cambió (resuelta a absoluta) |

#### Devuelve

`string[]` — rutas absolutas ordenadas de todos los archivos que dependen transitivamente del archivo modificado. El archivo modificado se excluye. Devuelve un array vacío si el archivo no está en el grafo.

---

### `ImportTree`

El objeto de resultado devuelto por `importree()`.

| Campo          | Tipo                       | Descripción                                                                       |
| -------------- | -------------------------- | --------------------------------------------------------------------------------- |
| `entrypoint`   | `string`                   | Ruta absoluta del archivo de entrada                                                   |
| `files`        | `string[]`                 | Rutas absolutas ordenadas de todos los archivos locales en el árbol de dependencias                   |
| `externals`    | `string[]`                 | Especificadores de importación desnudos únicos ordenados — paquetes como `react`, `lodash`, `node:fs` |
| `graph`        | `Record<string, string[]>` | Lista de adyacencia directa. Cada archivo se asigna a sus importaciones locales directas.               |
| `reverseGraph` | `Record<string, string[]>` | Lista de adyacencia inversa. Cada archivo se asigna a los archivos que lo importan.                   |

## What gets detected

`importree` extrae especificadores de todos los patrones de importación estándar:

- Importaciones estáticas — `import { foo } from './bar'`
- Importaciones predeterminadas — `import foo from './bar'`
- Importaciones de espacio de nombres — `import * as foo from './bar'`
- Importaciones con efectos secundarios — `import './bar'`
- Importaciones de tipo — `import type { Foo } from './bar'`
- Importaciones dinámicas — `import('./bar')`
- `require` de CommonJS — `require('./bar')`
- Re-exportaciones — `export { foo } from './bar'`, `export * from './bar'`

Las importaciones dentro de comentarios y literales de cadena se ignoran.

Se manejan las dependencias circulares; cada archivo se visita una sola vez.

## Resolution

1. **Importaciones relativas** (`./` o `../`) se resuelven en relación con el directorio del archivo que realiza la importación.
2. **Importaciones con alias** coinciden con los `aliases` configurados usando coincidencia de prefijo más largo, y luego se resuelven como rutas relativas desde `rootDir`.
3. **Especificadores desnudos** (p. ej., `react`, `@scope/pkg`, `node:fs`) se clasifican como externos y se recopilan en `externals`.

Para cada ruta resuelta, `importree` realiza sondeos en este orden:

1. Ruta exacta
2. Ruta + cada extensión (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`)
3. Ruta como directorio + `index` + cada extensión

## License

ISC — [Alex Grozav](https://github.com/alexgrozav)
