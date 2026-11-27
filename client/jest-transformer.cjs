const esbuild = require('esbuild');

module.exports = {
  process(source, filename) {
    const loader = filename.endsWith('.jsx') ? 'jsx' : 'js';
    const result = esbuild.transformSync(source, {
      loader,
      format: 'cjs',
      jsx: 'automatic',
      sourcefile: filename,
      sourcemap: true,
      target: 'node18',
    });
    return { code: result.code, map: JSON.parse(result.map) };
  },
};
