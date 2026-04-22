const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const modelsDir = path.resolve(__dirname, "src/assets/models");
const stlFiles = fs.existsSync(modelsDir)
  ? fs
      .readdirSync(modelsDir)
      .filter((name) => name.toLowerCase().endsWith(".stl"))
      .sort()
  : [];

module.exports = {
  entry: path.resolve(__dirname, "src/index.js"),
  output: {
    filename: "[name].[contenthash].js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
    assetModuleFilename: "assets/[name][contenthash][ext][query]",
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.svg$/i,
        type: "asset/resource",
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/index.html"),
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: modelsDir,
          to: "models",
          noErrorOnMissing: true,
        },
      ],
    }),
    new webpack.DefinePlugin({
      __MAGOS_STL_FILES__: JSON.stringify(stlFiles),
    }),
  ],
  devServer: {
    host: "0.0.0.0",
    port: 2345,
    static: {
      directory: path.resolve(__dirname, "dist"),
    },
    historyApiFallback: true,
  },
};
