const path = require('path');

module.exports = {
  entry: {
    background: './src/background.js',
    'youtube-content': './src/content/youtube-content.js',
    'reddit-content': './src/content/reddit-content.js',
    'general-content': './src/content/general-content.js',
    'claude-content': './src/content/claude.js',
    'chatgpt-content': './src/content/chatgpt.js',
    'deepseek-content': './src/content/deepseek.js',
    popup: './src/popup.js',
    settings: './src/settings.js'
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