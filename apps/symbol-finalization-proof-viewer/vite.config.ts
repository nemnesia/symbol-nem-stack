import { defineConfig } from 'vite';
import singleFileCompression from 'vite-plugin-singlefile-compression';

// https://vite.dev/config/
export default defineConfig({
  plugins: [singleFileCompression()],
  build: {
    rolldownOptions: {
      onwarn(warning, defaultHandler) {
        // MUI's RSC boundary directives have no effect in this client-only app.
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
          warning.message.includes('"use client"') &&
          /[/\\]node_modules[/\\]@mui[/\\]/.test(warning.id ?? '')
        )
          return;
        defaultHandler(warning);
      },
    },
  },
});
