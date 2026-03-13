module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    // 'plugin:react-refresh/recommended', (not compatible with ESLint v8)
    'prettier',
  ],
  settings: { react: { version: 'detect' } },
  env: { browser: true, node: true, es2021: true },
  ignorePatterns: ['tailwind.config.js', 'vite.config.ts', 'postcss.config.js', 'dist/**', 'dist-electron/**', 'release/**'],
  rules: {
    'react/react-in-jsx-scope': 'off',
  },
};
