const path = require('path');
// Import necessary plugins
const CopyWebpackPlugin = require('copy-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

// Determine build environment
const isProduction = process.env.NODE_ENV === 'production';
const analyzeBundle = process.env.ANALYZE_BUNDLE === 'true';

module.exports = {
  entry: {
    background: './src/background/index.js',
    popup: './src/popup/index.jsx',
    settings: './src/settings/index.jsx',
    sidebar: './src/sidebar/index.jsx',
    'content-script': './src/content/index.js',
    'platform-content': './src/content/platform-content.js',
    // Entry point for the pdf.js worker
    'pdf.worker': 'pdfjs-dist/build/pdf.worker.entry',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    // Clean the output directory before emit (optional but recommended)
    clean: true,
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
              ['@babel/preset-env', {
                targets: {
                  // Specify your target Chrome version or browser list
                  chrome: "123"
                },
                useBuiltIns: "usage",
                corejs: 3 // Specify the core-js version
              }],
              // Use automatic runtime for React 17+
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
      path.resolve(__dirname, 'src') // Allows importing from src like 'components/Button'
    ],
    fallback: {
      // Prevent Webpack from trying to polyfill Node.js core modules
      "path": false,
      "fs": false,
      // Add other Node.js core modules you might see warnings for if needed
      "url": false,
      "http": false,
      "https": false,
      "zlib": false,
      "stream": false,
      "util": false,
      "buffer": false,
      "assert": false
    }
  },
  optimization: {
    // Ensure minimization is enabled for production
    minimize: isProduction,
    // You can add other optimization options here if needed
  },
  performance: {
    // Disable performance hints to avoid warnings during build
    hints: false
  },
  plugins: [
    // Copy PDF.js CMaps to the dist/cmaps directory
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(__dirname, 'node_modules/pdfjs-dist/cmaps'),
          to: path.join(__dirname, 'dist/cmaps/'),
        },
      ],
    }),

    // Conditionally add the Bundle Analyzer plugin
    analyzeBundle && new BundleAnalyzerPlugin()

  ].filter(Boolean) // Filter out any falsy values (like when analyzeBundle is false)
};