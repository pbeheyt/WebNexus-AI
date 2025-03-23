const path = require('path');
// const pdfWorkerPath = require.resolve('pdfjs-dist/build/pdf.worker.entry');

module.exports = {
  entry: {
    background: './src/background/index.js',
    'content-script': './src/content/index.js',
    'youtube-content': './src/content/youtube-content.js',
    'reddit-content': './src/content/reddit-content.js',
    'general-content': './src/content/general-content.js',
    // 'pdf-content': './src/content/pdf-content.js',
    'platform-content': './src/content/platform-content.js',
    'selected-text-content': './src/content/selected-text-content.js',
    popup: './src/popup/index.jsx',
    settings: './src/settings/index.jsx',
    // 'pdf.worker': 'pdfjs-dist/build/pdf.worker.entry',
    sidebar: './src/sidebar/index.jsx',
    'sidebar-injector': './src/content/sidebar-injector.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist')
    // Removed chunkFormat: 'array-push'
  },
  mode: 'development',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  chrome: "123"
                },
                useBuiltIns: "usage",
                corejs: 3
              }],
              ['@babel/preset-react', { runtime: 'automatic' }]
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
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