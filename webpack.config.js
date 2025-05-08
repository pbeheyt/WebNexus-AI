const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const isProduction = process.env.NODE_ENV === 'production';
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      // Ensure process.env.NODE_ENV is available, default to 'development' if not set
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'node_modules/pdfjs-dist/build/pdf.worker.mjs',
          to: 'pdf.worker.mjs'
        },
        {
          from: 'node_modules/pdfjs-dist/cmaps/',
          to: 'cmaps/'
        }
      ]
    })
  ],
  entry: {
    background: './src/background/index.js',
    popup: './src/popup/index.jsx',
    settings: './src/settings/index.jsx',
    sidebar: './src/sidebar/index.jsx',
    'content-script': './src/content/index.js',
    'platform-content': './src/content/platform-content.js',
    'floatingButton': './src/content/floatingButton.js',
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
  performance: {
    hints: isProduction ? 'warning' : false, // Show hints only in production
  },
};
