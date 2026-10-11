const esbuild = require('esbuild');

module.exports = {
  process(source, filename) {
    const loader = filename.endsWith('.jsx') ? 'jsx' : 'js';
    const result = esbuild.transformSync(source, {
      loader,
      format: 'cjs',
      jsx: 'automatic',
      sourcefile: filename,
      target: 'node18',
    });
    return { code: result.code };
  },
};
