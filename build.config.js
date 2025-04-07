import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig([
  {
    entries: ['index.js'],
    // externals: ['vite', 'vue/compiler-sfc', '@vue/compiler-sfc'],
    clean: true,
    declaration: 'compatible',
    rollup: {
      emitCJS: true,
      inlineDependencies: true,
    },
  },
  {
    entries: ['console-logger.js'],
    clean: true,
    declaration: 'compatible',
    rollup: {
      emitCJS: true,
      inlineDependencies: true,
    },
  },
  {
    entries: [
      'client.js',
      {
        builder: 'copy',
        input: 'client.js',
        outDir: 'dist/client',
        pattern: 'client.js',
      },
    ],
  },
]);
