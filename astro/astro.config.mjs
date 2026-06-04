// @ts-check
import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://integrakotova.com',

  image: {
    domains: ['images.unsplash.com'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.unsplash.com' }
    ]
  },

  integrations: [preact(), sitemap()]
});