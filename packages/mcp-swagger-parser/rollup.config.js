import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import dts from 'rollup-plugin-dts';

const external = [
  '@apidevtools/swagger-parser',
  'axios',
  'js-yaml',
  'zod'
];

export default [
  // ES 和 CJS 构建
  {
    input: 'src/index.ts',
    external,
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true
      },
      {
        file: 'dist/index.esm.js',
        format: 'es',
        sourcemap: true
      }
    ],
    plugins: [
      resolve({
        preferBuiltins: true
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*']
      })
    ]
  },
  // TypeScript 声明文件
  {
    input: 'src/index.ts',
    external,
    output: {
      file: 'dist/index.d.ts',
      format: 'es'
    },
    plugins: [
      dts()
    ]
  }
];
