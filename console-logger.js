import { WebSocket, WebSocketServer } from 'ws';

let wsServer;
const clients = new Map();
const viewers = new Set();
const logBuffer = []; // 用于存储最近的日志
const MAX_BUFFER_SIZE = 1000; // 最大缓存日志数量

// 获取所有已连接的页面URL列表
function getConnectedPages() {
  const pages = new Set();
  for (const client of clients.values()) {
    if (client.type === 'logger' && client.url) {
      pages.add(client.url);
    }
  }
  return Array.from(pages);
}

// 广播页面列表给所有查看器
function broadcastPageList() {
  const message = {
    type: 'pages',
    pages: getConnectedPages(),
  };

  viewers.forEach((viewer) => {
    if (viewer.readyState === WebSocket.OPEN) {
      try {
        viewer.send(JSON.stringify(message));
      } catch (e) {
        console.error('Error sending page list:', e);
      }
    }
  });
}

// 广播日志消息给所有查看器
function broadcastToViewers(logData) {
  viewers.forEach((viewer) => {
    if (viewer.readyState === WebSocket.OPEN) {
      try {
        viewer.send(JSON.stringify(logData));
      } catch (e) {
        console.error('Error sending log to viewer:', e);
      }
    }
  });
}

// 发送代码执行结果给指定的查看器
function sendResultToViewer(viewer, result) {
  if (viewer.readyState === WebSocket.OPEN) {
    try {
      viewer.send(JSON.stringify(result));
    } catch (e) {
      console.error('Error sending execution result:', e);
    }
  }
}

// 将代码发送给目标页面执行
function executeCodeOnPage(code, targetUrl, viewer) {
  let targetFound = false;

  for (const [socket, client] of clients.entries()) {
    if (client.type === 'logger' && client.url === targetUrl) {
      targetFound = true;
      try {
        socket.send(
          JSON.stringify({
            type: 'execute',
            code,
            requestId: Date.now().toString(),
          })
        );
      } catch (e) {
        console.error('Error sending code to execute:', e);
        sendResultToViewer(viewer, {
          type: 'result',
          result: '',
          error: 'Failed to send code to page',
          url: targetUrl,
        });
      }
      break;
    }
  }

  if (!targetFound) {
    sendResultToViewer(viewer, {
      type: 'result',
      result: '',
      error: 'Target page not found or disconnected',
      url: targetUrl,
    });
  }
}

function addToBuffer(logData) {
  logBuffer.push(logData);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

export default async function configureServer(server) {
  // 创建 WebSocket 服务器
  wsServer = new WebSocketServer({ noServer: true });

  // 处理 WebSocket 升级请求
  server.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/ws-logger')) {
      wsServer.handleUpgrade(request, socket, head, (ws) => {
        wsServer.emit('connection', ws, request);
      });
    }
  });

  console.log('Console logger WebSocket server started');

  wsServer.on('connection', (socket, request) => {
    // 确定客户端类型
    const clientType = request.url?.includes('/viewer') ? 'viewer' : 'logger';

    if (clientType === 'viewer') {
      // 处理查看器连接
      viewers.add(socket);
      clients.set(socket, { socket, type: 'viewer' });
      console.log('Log viewer connected');

      // 发送缓存的日志
      logBuffer.forEach((log) => {
        try {
          socket.send(JSON.stringify(log));
        } catch (e) {
          console.error('Error sending buffered log to viewer:', e);
        }
      });

      // 发送当前连接的页面列表
      broadcastPageList();
    } else {
      // 处理日志客户端连接
      console.log('Logger client connected');
      clients.set(socket, {
        socket,
        type: 'logger',
        url: undefined,
        clientFlag: Math.random().toString(16).substring(2, 10),
      });
    }

    socket.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (!data.type) {
          // 处理旧格式的日志消息
          const logMessage = {
            type: 'log',
            ...data,
          };

          // 更新客户端URL
          const client = clients.get(socket);
          if (client && client.type === 'logger' && !client.url) {
            client.url = client.clientFlag + '@' + data.url;
            broadcastPageList();
          }

          // 格式化日志输出
          const timestamp = new Date(logMessage.timestamp).toLocaleTimeString();
          const level = logMessage.level.toUpperCase().padEnd(5);
          const url = new URL(logMessage.url).pathname;
          console.log(
            `[${timestamp}] ${level} ${
              client?.clientFlag || ''
            }:${url}: ${logMessage.args.join(' ')}`
          );
          logMessage.url = client.url;
          addToBuffer(logMessage);
          broadcastToViewers(logMessage);
        } else {
          // 处理新格式的消息
          switch (data.type) {
            case 'execute': {
              // 处理代码执行请求
              const { code, targetUrl } = data;
              executeCodeOnPage(code, targetUrl, socket);
              break;
            }
            case 'result': {
              // 处理代码执行结果
              const resultMessage = data;
              // 找到发送执行请求的查看器
              for (const [viewerSocket] of clients) {
                if (viewers.has(viewerSocket)) {
                  sendResultToViewer(viewerSocket, resultMessage);
                }
              }
              break;
            }
          }
        }
      } catch (e) {
        console.error('Error processing message:', e);
      }
    });

    socket.on('error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    socket.on('close', () => {
      const client = clients.get(socket);
      if (client) {
        if (client.type === 'viewer') {
          viewers.delete(socket);
          console.log('Log viewer disconnected');
        } else {
          console.log('Logger client disconnected');
        }
        clients.delete(socket);

        // 如果是日志客户端断开连接，广播更新后的页面列表
        if (client.type === 'logger') {
          broadcastPageList();
        }
      }
    });
  });

  wsServer.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  // 当 Vite 服务器关闭时关闭 WebSocket 服务器
  server.on('close', () => {
    if (wsServer) {
      for (const [socket] of clients) {
        socket.close();
      }
      clients.clear();
      viewers.clear();
      wsServer.close(() => {
        console.log('Console logger WebSocket server closed');
      });
    }
  });
}
