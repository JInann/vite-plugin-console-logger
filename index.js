import { readFileSync } from 'fs';
import consoleLogger from './console-logger';
import path from 'path';
// 客户端代码，将被注入到页面中
const clientCode = readFileSync(
  path.join(import.meta.dirname || __dirname, 'client.mjs')
).toString();

export default function consoleLoggerPlugin(
  options = { onlyServer: false, remoteUrl: '', useRemote: false }
) {
  return {
    name: 'vite-plugin-console-logger',
    configureServer(server) {
      if (options.onlyServer) {
        // 创建 WebSocket 服务器
        consoleLogger(server.httpServer);
        return;
      }
      let url = options.remoteUrl;
      if (options.useRemote == false) {
        url += '?host=localhost:' + server.config.server.port;
      }
      console.log('已配置远程日志调试，请打开链接查看：', url);
      if (options.useRemote) {
        return;
      }
      // 创建 WebSocket 服务器
      consoleLogger(server.httpServer);
    },

    transformIndexHtml() {
      if (options.onlyServer) {
        return;
      }
      let code = clientCode;
      if (options.useRemote) {
        let url = new URL(options.remoteUrl || '');
        code = clientCode.replace('${window.location.host}', url.host);
      }
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: code,
          injectTo: 'head',
        },
      ];
    },
  };
}
