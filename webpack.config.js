const path = require('path');
const pdfWorkerPath = require.resolve('pdfjs-dist/build/pdf.worker.entry');

module.exports = {
  entry: {
    background: './src/background.js',
    'youtube-content': './src/content/youtube-content.js',
    'reddit-content': './src/content/reddit-content.js',
    'general-content': './src/content/general-content.js',
    'pdf-content': './src/content/pdf-content.js',
    'platform-content': './src/content/platform-content.js',
    popup: './src/popup/index.js',
    settings: './src/settings/index.js',
    'pdf.worker': 'pdfjs-dist/build/pdf.worker.entry'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  mode: 'production',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  chrome: "88"
                },
                useBuiltIns: "usage",
                corejs: 3
              }]
            ]
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js'],
    modules: [
      'node_modules',
      path.resolve(__dirname, 'src')
    ],
    fallback: {
      "path": false,
      "fs": false
    }
  },
  optimization: {
    minimize: true
  },
  performance: {
    hints: false
  }
};