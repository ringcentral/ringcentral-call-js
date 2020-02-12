const path = require('path');

module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'build'),
    library: 'RingCentralCall',
    libraryTarget: 'umd',
    libraryExport: 'RingCentralCall'
  },
  externals: {
    externals: {
      "ringcentral-web-phone": {
        commonjs: 'ringcentral-web-phone',
        commonjs2: 'ringcentral-web-phone',
        amd: 'ringcentral-web-phone',
        root: 'RingCentralWebPhone'
      },
      "ringcentral-call-control": {
        commonjs: 'ringcentral-call-control',
        commonjs2: 'ringcentral-call-control',
        amd: 'ringcentral-call-control',
        root: 'RingCentralCallControl'
      }
    },
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  optimization: {
    minimize: false
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
};
