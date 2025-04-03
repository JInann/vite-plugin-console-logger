# vite-plugin-console-logger

一个强大的 Vite 插件，用于实时监控和管理前端页面的控制台日志。它允许你在远程查看和管理多个页面的控制台输出，并支持远程代码执行功能。

## 功能特点

- 🔄 实时日志监控：捕获并转发所有控制台日志（log、info、warn、error）
- 📱 多页面支持：同时监控多个页面的日志输出
- 🔌 WebSocket 连接：使用 WebSocket 实现实时双向通信
- 💾 日志缓存：自动缓存最近的日志消息
- 🛠 远程代码执行：支持在目标页面远程执行 JavaScript 代码
- 🔁 自动重连：断线自动重连机制
- 🎯 错误追踪：自动捕获并报告 JavaScript 错误

## 安装

使用你喜欢的包管理器安装：

```bash
npm install vite-plugin-console-logger --save-dev
# 或
pnpm add -D vite-plugin-console-logger
# 或
yarn add -D vite-plugin-console-logger
```

## 使用方法

1. 在你的 Vite 配置文件中添加插件：

```javascript
// vite.config.js / vite.config.ts
import consoleLogger from 'vite-plugin-console-logger'

export default {
  plugins: [
    consoleLogger({
      useRemote: false, // 使用本地模式
      remoteUrl: 'http://your-remote-url' // 可选，用于远程模式
    })
  ]
}
```

2. 启动你的 Vite 开发服务器，插件会自动注入必要的客户端代码。

3. 所有控制台输出将被自动捕获并转发到日志查看器。

## 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| useRemote | boolean | false | 是否使用远程模式 |
| remoteUrl | string | undefined | 远程日志服务器的URL（仅在useRemote为true时需要） |

## 功能演示

### 日志监控
插件会自动捕获所有类型的控制台输出：

```javascript
console.log('Hello World');
console.info('This is some info');
console.warn('Warning message');
console.error('Error occurred');
```

### 错误追踪
自动捕获未处理的错误和异常：

```javascript
throw new Error('Uncaught exception');
// 错误将被自动捕获并发送到日志查看器
```

### 远程代码执行
通过日志查看器界面，你可以在目标页面远程执行 JavaScript 代码，并获取执行结果。

## 高级特性

### 自动重连机制
- 在连接断开时自动尝试重新连接
- 最大重试次数：5次
- 重连间隔：3秒

### 日志缓存
- 自动缓存最近的1000条日志消息
- 在重新连接后自动发送缓存的日志

### 序列化支持
支持多种类型的数据序列化：
- Error 对象
- DOM 元素
- 复杂的 JavaScript 对象
- 正则表达式
- 函数引用

## 注意事项

1. 不建议在生产环境中使用，建议仅用于调试。在测试环境中使用时，建议配置 `useRemote: true` 并提供安全的 `remoteUrl`。
2. 大量日志输出可能会影响性能，请根据需要调整缓存大小。

## 许可证

ISC License