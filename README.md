# Rate Limit Monitor Chrome Extension

一个用于监控API 429状态码并显示恢复时间的Chrome扩展插件。

## 功能特性

- 🚫 **自动检测429错误**: 监控所有HTTP请求，自动捕获429状态码
- ⏰ **倒计时显示**: 实时显示API限制恢复剩余时间
- 🔄 **多种解析方式**: 支持多种resetAt时间戳格式解析
- 💾 **持久化存储**: 页面刷新后数据不丢失
- 🎨 **美观UI**: 现代化的用户界面设计
- 📱 **响应式设计**: 支持移动端和桌面端
- 📡 **后端集成**: 支持将组织ID和重置时间发送到后端服务器
- 🔔 **通知提醒**: 发送数据时显示系统通知，实时反馈发送状态

## 新增功能：后端数据发送

扩展现在支持将以下数据发送到后端：
- `orgId`: 组织ID（从API URL中提取）
- `resetAt`: 限制重置时间（Unix时间戳）
- `timestamp`: 检测时间戳

### 发送时机
当检测到429错误且同时满足以下条件时，会立即发送数据到后端：
1. 后端功能已启用
2. 后端地址已配置
3. 成功提取到组织ID和重置时间

### 后端配置
1. 点击扩展图标打开popup
2. 在"后端配置"区域输入后端API地址：`http://localhost:8787/api/rate-limit`
3. 勾选"启用后端发送"
4. 点击"保存配置" - 会显示配置成功通知

### 通知功能
扩展会在以下情况显示系统通知：
- 🚫 **检测通知**: 检测到Rate Limit时
- 📡 **发送中通知**: 正在发送数据到后端时
- ✅ **成功通知**: 数据发送成功时
- ❌ **错误通知**: 发送失败或网络错误时
- ⚙️ **配置通知**: 后端配置更新时

## 支持的API

- Claude AI (claude.ai)
- FuClaude Demo (demo.fuclaude.com)
- OpenAI ChatGPT (chatgpt.com, api.openai.com)
- Anthropic API (api.anthropic.com)
- 其他返回429状态码的API

## 安装方法

1. 下载或克隆此项目
2. 打开Chrome浏览器，进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹

## 测试功能

项目包含了完整的测试工具：

### 1. 测试页面
打开 `test-backend.html` 可以：
- 模拟不同API的429错误
- 启动测试服务器
- 查看详细的使用说明

### 2. 测试服务器
运行测试服务器来接收扩展发送的数据：

```bash
node test-server.js
```

服务器将在 `http://localhost:3000` 启动，提供以下端点：
- `POST /api/rate-limit` - 接收扩展数据
- `GET /` - 查看接收到的数据
- `GET /api/data` - JSON格式的数据

### 3. 测试步骤
1. 确保你的后端服务器在 `http://localhost:8787/api/rate-limit` 运行
2. 在扩展popup中配置后端地址：`http://localhost:8787/api/rate-limit`
3. 勾选"启用后端发送"并保存 - 应该看到配置成功通知
4. 打开 `test-notification.html` 进行完整测试
5. 点击"完整流程测试"按钮
6. 观察系统通知和后端日志确认数据接收

## 使用方法

1. 安装插件后，访问支持的网站（如claude.ai、demo.fuclaude.com）
2. 当遇到429限制时，插件会自动显示倒计时
3. 点击插件图标可查看所有域名的限制状态
4. 可以手动清除限制记录

## 技术实现

### 拦截机制
- 重写 `window.fetch` 函数监控HTTP请求
- 监控 `XMLHttpRequest` 对象
- 检测429状态码并解析响应

### resetAt解析
支持多种时间戳格式：
- HTTP响应头: `x-ratelimit-reset`, `retry-after`
- 响应体JSON: `resetAt`, `resetsAt`, `reset_time`
- Claude API格式: 嵌套JSON消息解析
- OpenAI API格式: 标准错误响应

### 架构设计
```
inject.js (页面注入)
    ↓ CustomEvent
content.js (内容脚本)
    ↓ chrome.runtime.sendMessage
background.js (后台脚本)
    ↓ chrome.storage.local
持久化存储
```

## 文件结构

```
claude-limit-monitor/
├── manifest.json          # 扩展配置
├── background.js          # 后台脚本
├── content.js            # 内容脚本
├── inject.js             # 页面注入脚本
├── popup.html            # 弹窗页面
├── popup.js              # 弹窗脚本
├── styles.css            # 样式文件
└── README.md             # 说明文档
```

## 开发说明

### 消息类型
- `RATE_LIMIT_DETECTED`: 检测到429错误
- `GET_RATE_LIMIT_STATUS`: 获取限制状态
- `CLEAR_RATE_LIMIT`: 清除特定域名限制
- `RATE_LIMIT_UPDATE`: 更新限制状态

### 存储格式
```javascript
{
  "rateLimit_domain.com": {
    "resetAt": 1703123456,      // Unix时间戳(秒)
    "detectedAt": 1703120000000, // 检测时间(毫秒)
    "url": "https://api.example.com/chat"
  }
}
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！
