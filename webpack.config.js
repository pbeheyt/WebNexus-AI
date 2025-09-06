const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const isProduction = process.env.NODE_ENV === 'production';
const TerserPlugin = require('terser-webpack-plugin');
const generateLicenseFile = require('generate-license-file').generateLicenseFile;

// Determine the build mode from environment variables, defaulting to 'full'
const BUILD_MODE = process.env.BUILD_MODE || 'full';
const IS_LIGHT_BUILD = BUILD_MODE === 'light';

console.log(`\n--- Running Webpack for a '${BUILD_MODE}' build ---\n`);

module.exports = {
  plugins: [
    // Expose the BUILD_MODE to the source code
    new webpack.DefinePlugin({
      'process.env.BUILD_MODE': JSON.stringify(BUILD_MODE),
      // Ensure process.env.NODE_ENV is available, default to 'development' if not set
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'development'
      ),
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'popup.html', to: 'popup.html' },
        { from: 'settings.html', to: 'settings.html' },
        {
          from: 'manifest.json',
          to: 'manifest.json',
          transform: (content) => {
            const manifest = JSON.parse(content.toString());
            if (IS_LIGHT_BUILD) {
              console.log('Transforming manifest.json for LIGHT build...');
              // Remove sidePanel permission
              manifest.permissions = manifest.permissions.filter(
                (p) => p !== 'sidePanel'
              );

              // Define API-specific host permissions to remove
              const apiHostsToRemove = new Set([
                'https://api.anthropic.com/',
                'https://api.openai.com/',
                'https://api.mistral.ai/',
                'https://api.deepseek.com/',
                'https://generativelanguage.googleapis.com/',
                'https://api.x.ai/',
              ]);

              // Filter out API host permissions
              manifest.host_permissions = manifest.host_permissions.filter(
                (host) => !apiHostsToRemove.has(host)
              );
              console.log('Removed sidePanel and API host permissions.');
            }
            return JSON.stringify(manifest, null, 2);
          },
        },
        { from: 'images', to: 'images' },
        {
          from: 'platform-display-config.json',
          to: 'platform-display-config.json',
        },
        // PDF.js worker and cmaps
        {
          from: 'node_modules/pdfjs-dist/build/pdf.worker.mjs',
          to: 'dist/pdf.worker.mjs',
        },
        { from: 'node_modules/pdfjs-dist/cmaps', to: 'dist/cmaps/' },
        // Conditionally copy files for the 'full' build only
        ...( !IS_LIGHT_BUILD
          ? [
              { from: 'sidepanel.html', to: 'sidepanel.html' },
              {
                from: 'platform-api-config.json',
                to: 'platform-api-config.json',
              },
            ]
          : []
        ),
        {
          from: 'LICENSE.md',
          to: 'LICENSE.md',
        },
        {
          from: 'NOTICES.txt',
          to: 'NOTICES.txt',
        },
      ],
    }),
    // Conditionally add BundleAnalyzerPlugin
    ...(process.env.ANALYZE === 'true' ? [new BundleAnalyzerPlugin()] : []),
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tapPromise(
          'GenerateLicenseFilePlugin',
          async () => {
            try {
              await generateLicenseFile({
                input: path.resolve(__dirname, 'package.json'),
                output: path.resolve(__dirname, 'NOTICES.txt'),
                /* See configuration options at https://generate-license-file.js.org/ */
              });
              console.log('License file generated successfully.');
            } catch (error) {
              console.error('Error generating license file:', error);
            }
          }
        );
      },
    },
  ].filter(Boolean),
  entry: {
    background: './src/background/index.js',
    popup: './src/popup/index.jsx',
    settings: './src/settings/index.jsx',
    'selection-listener': './src/content/selection-listener.js',
    'extractor-content': './src/content/extractor-content.js',
    'platform-content': './src/content/platform-content.js',
    // Conditionally include the sidepanel entry only for the full build
    ...( !IS_LIGHT_BUILD && { sidepanel: './src/sidepanel/index.jsx' } ),
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? false : 'source-map', // Disable source maps for production

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: {
                    chrome: '130',
                  },
                  useBuiltIns: 'usage',
                  corejs: 3,
                },
              ],
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    modules: ['node_modules', path.resolve(__dirname, 'src')],
    fallback: {
      path: false,
      fs: false,
    },
  },
  optimization: {
    minimize: isProduction,
    minimizer: [
      // Only add Terser config if in production
      ...(isProduction
        ? [
            new TerserPlugin({
              terserOptions: {
                compress: {
                  drop_console: true, // This explicitly removes console.* statements
                },
              },
            }),
          ]
        : []),
    ],
  },
  performance: {
    hints: isProduction ? 'warning' : false,
  },
};
