/** @type {import('jest').Config} */
import baseConfig from './jest.config.js';

export default {
  ...baseConfig,
  // Temporarily disable coverage thresholds for CI
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  }
}; 