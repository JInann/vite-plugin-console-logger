(() => {
  // 配置
  const WS_URL = `//${window.location.host}/ws-logger/client`; // 使用当前页面的主机和端口
  const RECONNECT_INTERVAL = 3000;
  const MAX_RETRY_COUNT = 5;
  const MAX_BUFFER_SIZE = 1000;

  // 存储原始的 console 方法
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  // 日志缓冲区
  let logBuffer = [];
  let ws = null;
  let retryCount = 0;
  let reconnectTimeout = null;

  // 执行远程代码
  async function executeRemoteCode(code, requestId) {
    try {
      // 使用 Function 构造器创建一个异步函数
      const asyncFunction = new Function(
        'return (async () => { ' + code + ' })()'
      );
      const result = await asyncFunction();

      // 发送执行结果
      ws.send(
        JSON.stringify({
          type: 'result',
          result: serializeArg(result),
          url: window.location.href,
        })
      );
    } catch (error) {
      // 发送错误信息
      ws.send(
        JSON.stringify({
          type: 'result',
          error: serializeArg(error),
          url: window.location.href,
        })
      );
    }
  }

  // 创建 WebSocket 连接
  function createWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      originalConsole.log('[Console Logger] Connected to server');
      retryCount = 0;

      // 连接成功后发送缓冲区中的日志
      while (logBuffer.length > 0) {
        const log = logBuffer.shift();
        sendLog(log);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'execute') {
          executeRemoteCode(data.code, data.requestId);
        }
      } catch (e) {
        originalConsole.error('[Console Logger] Failed to process message:', e);
      }
    };

    ws.onclose = () => {
      originalConsole.warn('[Console Logger] Connection closed');
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      originalConsole.error('[Console Logger] WebSocket error:', error);
    };
  }

  // 重连逻辑
  function scheduleReconnect() {
    if (retryCount >= MAX_RETRY_COUNT) {
      originalConsole.error(
        '[Console Logger] Max retry count reached, giving up'
      );
      return;
    }

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }

    reconnectTimeout = setTimeout(() => {
      retryCount++;
      originalConsole.log(
        `[Console Logger] Attempting to reconnect (attempt ${retryCount}/${MAX_RETRY_COUNT})`
      );
      createWebSocket();
    }, RECONNECT_INTERVAL);
  }

  // 发送日志到服务器
  function sendLog(logData) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(logData));
      } catch (e) {
        originalConsole.error('[Console Logger] Failed to send log:', e);
      }
    } else {
      // 如果连接断开，将日志添加到缓冲区
      logBuffer.push(logData);

      // 限制缓冲区大小
      if (logBuffer.length > MAX_BUFFER_SIZE) {
        logBuffer.shift();
      }
    }
  }

  // 处理复杂对象的序列化
  function serializeArg(arg) {
    try {
      if (arg === undefined) return 'undefined';
      if (arg === null) return 'null';

      if (typeof arg === 'object') {
        // 处理错误对象
        if (arg instanceof Error) {
          return `\${arg.name}: ${arg.message}\n${arg.stack || ''}`;
        }

        // 处理错误事件对象
        if (arg instanceof ErrorEvent) {
          return `${arg.message}\n${arg.error.stack || ''}`;
        }

        // 处理DOM元素
        if (arg instanceof HTMLElement) {
          return arg.outerHTML;
        }

        // 其他对象使用JSON序列化
        return JSON.stringify(
          arg,
          (key, value) => {
            if (value instanceof Function) return 'function() { ... }';
            if (value instanceof RegExp) return value.toString();
            return value;
          },
          2
        );
      }

      return String(arg);
    } catch (e) {
      return `[Serialization Error: ${e.message}]`;
    }
  }

  // 劫持 console 方法
  ['log', 'info', 'warn', 'error'].forEach((level) => {
    console[level] = (...args) => {
      // 调用原始方法
      originalConsole[level].apply(console, args);

      // 准备发送到服务器的数据
      const logData = {
        timestamp: new Date().toISOString(),
        level,
        args: args.map(serializeArg),
        url: window.location.href,
      };

      sendLog(logData);
    };
  });

  // 上报window.onerror
  window.addEventListener('error', (event) => {
    console.error(event);
  });

  // 初始化 WebSocket 连接
  createWebSocket();

  // 页面卸载时尝试发送剩余的日志
  window.addEventListener('beforeunload', () => {
    if (logBuffer.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
      logBuffer.forEach((log) => {
        ws.send(JSON.stringify(log));
      });
    }
  });
})();
