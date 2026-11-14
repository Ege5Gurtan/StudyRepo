import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'dist-electron/**', 'node_modules/**'] },
  ...tseslint.configs.recommended
];
