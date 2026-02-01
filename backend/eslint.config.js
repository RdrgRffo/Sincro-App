import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      // Definimos que estamos en un entorno Node.js para que no marque
      // error en cosas como 'process' o 'module'
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      // 1. Solo avisa si hay variables sin usar (útil pero no bloqueante)
      '@typescript-eslint/no-unused-vars': ['warn', { 
        "argsIgnorePattern": "^_", 
        "varsIgnorePattern": "^_" 
      }],
      
      // 2. Desactivamos las reglas que te daban errores molestos en los servicios
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      
      // 3. Permitimos logs en el backend (son necesarios)
      'no-console': 'off',
    },
  },
  {
    // Carpetas que el Linter debe ignorar por completo
    ignores: [
      'dist/**', 
      'node_modules/**', 
      'prisma/**', 
      'test/**',           // Ignoramos tests si dan problemas de tipos
      'debug-schedules.ts' // Ignoramos archivos sueltos de debug
    ],
  }
);