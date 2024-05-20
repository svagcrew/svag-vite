import { sentryVitePlugin } from '@sentry/vite-plugin'
import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import autoprefixer from 'autoprefixer'
import { cpus } from 'os'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import svgr from 'vite-plugin-svgr'

const sourcemapExclude = (opts?: { excludeNodeModules?: boolean }): Plugin => {
  return {
    name: 'sourcemap-exclude',
    transform: (code: string, id: string) => {
      if (opts?.excludeNodeModules && id.includes('node_modules')) {
        return {
          code,
          // https://github.com/rollup/rollup/blob/master/docs/plugin-development/index.md#source-code-transformations
          map: { mappings: '' },
        }
      }
      return undefined
    },
  }
}

export const createViteConfig = ({
  env,
  port,
  sourceVerson,
  sentryAuthToken,
  bundleStats,
  projectName,
  publicEnv,
  pwa,
  __dirname,
  tsconfig,
  resolveAliesesByTsconfig,
  resolveAlieses,
  plugins,
}: {
  env?: {
    PORT?: number | string
    SOURCE_VERSION?: string
    SENTRY_AUTH_TOKEN?: string
    [key: string]: string | undefined | number
  }
  publicEnv?: Record<string, string>
  port?: number | string
  sourceVerson?: string
  sentryAuthToken?: string
  bundleStats?: boolean
  projectName?: string
  pwa?: boolean
  __dirname?: string
  tsconfig?: {
    compilerOptions?: {
      paths?: Record<string, string[]>
    }
  }
  resolveAliesesByTsconfig?: true
  resolveAlieses?: Record<string, string>
  plugins?: Plugin[]
}) => {
  port = Number(port || env?.PORT)
  sourceVerson = sourceVerson || env?.SOURCE_VERSION
  sentryAuthToken = sentryAuthToken || env?.SENTRY_AUTH_TOKEN
  resolveAlieses =
    resolveAlieses ||
    (resolveAliesesByTsconfig && tsconfig?.compilerOptions?.paths && __dirname
      ? Object.fromEntries(
          Object.entries(tsconfig.compilerOptions.paths).map(([key, [value]]) => [
            key.replace('/*', ''),
            path.resolve(__dirname, value.replace('/*', '')),
          ])
        )
      : {})

  return defineConfig(() => {
    return {
      resolve: {
        alias: resolveAlieses,
      },
      plugins: [
        sourcemapExclude({ excludeNodeModules: true }),
        !pwa
          ? undefined
          : VitePWA({
              registerType: 'autoUpdate',
              strategies: 'injectManifest',
              srcDir: 'src',
              filename: 'sw.ts',
              // injectRegister: 'script',
              injectManifest: {
                injectionPoint: undefined,
              },
              manifest: {
                name: projectName || 'My Project',
                short_name: projectName || 'My Project',
                icons: [
                  {
                    src: '/android-chrome-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                  },
                  {
                    src: '/android-chrome-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                  },
                ],
                theme_color: '#ffffff',
                background_color: '#ffffff',
                display: 'standalone',
              },
              devOptions: {
                enabled: true,
              },
            }),
        react(),
        svgr(),
        legacy({
          targets: ['> 2%'],
        }),
        !bundleStats
          ? undefined
          : visualizer({
              filename: './dist/bundle-stats.html',
              gzipSize: true,
              brotliSize: true,
            }),
        !sentryAuthToken || !sourceVerson
          ? undefined
          : sentryVitePlugin({
              org: 'bananygi',
              project: 'webapp',
              authToken: sentryAuthToken,
              release: { name: sourceVerson },
            }),
        ...(plugins || []),
      ],
      css: {
        postcss: {
          plugins: [autoprefixer({})],
        },
      },
      build: {
        sourcemap: true,
        chunkSizeWarningLimit: 900,
        rollupOptions: {
          maxParallelFileOps: Math.max(1, cpus().length - 1),
          output: {
            manualChunks: (id) => {
              if (id.includes('node_modules')) {
                return 'vendor'
              }
              return undefined
            },
            sourcemapIgnoreList: (relativeSourcePath) => {
              const normalizedPath = path.normalize(relativeSourcePath)
              return normalizedPath.includes('node_modules')
            },
          },
          cache: false,
        },
      },
      server: {
        host: true,
        port,
      },
      preview: {
        port,
      },
      define: {
        'process.env': publicEnv || {},
      },
    }
  })
}
