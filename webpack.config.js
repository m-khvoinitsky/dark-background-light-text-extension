const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env, options) => {
  let config = {
    entry: {
      'content': './src/content/index.ts',
      'background': './src/background/index.ts',
      'preferences': './src/preferences/index.ts',
      'browser-action': './src/browser-action/index.ts',
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              onlyCompileBundledFiles: true,
            },
          },
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js', '.json']
    },
    plugins: [
      new CleanWebpackPlugin(),
      new CopyPlugin({
        patterns: [
          { from: "manifest.json" },
          { from: "icons", to: "icons" },
          { from: "ui", to: "ui" },
        ],
      }),
    ],
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
    },
  };
  if (options.watch) {
    config['optimization'] = {minimize: false};
    config['devtool'] = 'source-map';
  }
  return config;
}
