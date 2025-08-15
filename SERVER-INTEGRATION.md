# Claude Rate Limit Monitor - 服务端集成指南

## 概述

这个服务端注入脚本可以在你的 `claude.lqqmail.xzy` 服务器上自动检测429错误、提取组织ID和resetAt时间，并发送到后端API，用户完全无感知。

## 文件说明

- `server-inject.js` - 主要的注入脚本
- `SERVER-INTEGRATION.md` - 本集成指南

## 集成步骤

### 1. 配置后端地址

在 `server-inject.js` 中修改配置：

```javascript
const CONFIG = {
  // 修改为你的实际后端地址
  BACKEND_URL: 'https://your-api.com/api/rate-limit',
  
  // 是否启用调试日志（生产环境建议设为false）
  DEBUG: false,
  
  // 重试配置
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};
```

### 2. 在你的网站中注入脚本

#### 方法1: 直接在HTML中引入
```html
<!DOCTYPE html>
<html>
<head>
    <!-- 其他head内容 -->
    <script src="/path/to/server-inject.js"></script>
</head>
<body>
    <!-- 页面内容 -->
</body>
</html>
```

#### 方法2: 通过服务端模板注入
```javascript
// Express.js 示例
app.get('*', (req, res) => {
  let html = fs.readFileSync('index.html', 'utf8');
  
  // 在head标签中注入脚本
  html = html.replace(
    '</head>',
    '<script src="/server-inject.js"></script></head>'
  );
  
  res.send(html);
});
```

#### 方法3: 动态注入
```javascript
// 在你的主JavaScript文件中
function loadRateLimitMonitor() {
  const script = document.createElement('script');
  script.src = '/server-inject.js';
  script.onload = () => {
    console.log('Rate Limit Monitor loaded');
  };
  document.head.appendChild(script);
}

// 页面加载完成后注入
document.addEventListener('DOMContentLoaded', loadRateLimitMonitor);
```

### 3. 后端API接口

确保你的后端API能够接收以下格式的数据：

```javascript
// POST /api/rate-limit
{
  "orgId": "org_abc123def456",
  "resetAt": 1755237600,
  "timestamp": 1755225718752,
  "source": "server-inject",
  "domain": "claude.lqqmail.xzy"
}
```

#### 后端接口示例 (Node.js/Express)
```javascript
app.post('/api/rate-limit', (req, res) => {
  const { orgId, resetAt, timestamp, source, domain } = req.body;
  
  // 验证必需字段
  if (!orgId || !resetAt) {
    return res.status(400).json({
      error: 'Missing required fields: orgId and resetAt'
    });
  }
  
  // 处理数据
  console.log('收到Rate Limit数据:', {
    orgId,
    resetAt: new Date(resetAt * 1000).toISOString(),
    timestamp: new Date(timestamp).toISOString(),
    source,
    domain
  });
  
  // 这里添加你的业务逻辑
  // 比如存储到数据库、发送通知等
  
  res.json({ success: true });
});
```

## 功能特性

### ✅ 自动检测
- 自动拦截所有HTTP请求
- 检测429状态码
- 支持fetch和XMLHttpRequest

### ✅ 智能解析
- 支持FuClaude格式 (`responseData.resetsAt`)
- 支持响应头格式 (`x-ratelimit-reset`, `retry-after`)
- 支持Claude格式 (`error.message.resetsAt`)

### ✅ 可靠发送
- 自动重试机制
- 网络错误处理
- 详细的日志记录

### ✅ 用户无感知
- 完全在后台运行
- 不影响用户体验
- 不显示任何UI

## 配置选项

### 运行时配置修改
```javascript
// 在浏览器控制台中或你的代码中
window.RateLimitMonitor.updateConfig({
  BACKEND_URL: 'https://new-api.com/rate-limit',
  DEBUG: true
});
```

### 手动测试
```javascript
// 测试发送功能
window.RateLimitMonitor.testSend('test_org_123', 1755237600);
```

### 获取当前配置
```javascript
console.log(window.RateLimitMonitor.getConfig());
```

## 调试

### 启用调试日志
设置 `CONFIG.DEBUG = true`，然后在浏览器控制台查看日志：

```
[Rate Limit Monitor] 🚫 检测到429错误: {...}
[Rate Limit Monitor] ✅ FuClaude格式成功 - resetsAt: 1755237600
[Rate Limit Monitor] 📡 发送数据到后端: {...}
[Rate Limit Monitor] ✅ 后端发送成功: {...}
```

### 常见问题

1. **CORS错误**: 确保后端API设置了正确的CORS头
2. **网络错误**: 检查后端地址是否正确，服务是否运行
3. **数据解析失败**: 检查API响应格式是否符合预期

## 生产环境建议

1. **关闭调试日志**: 设置 `DEBUG: false`
2. **配置重试**: 根据网络环境调整重试次数和延迟
3. **错误监控**: 在后端添加错误日志和监控
4. **性能优化**: 考虑批量发送或异步处理

## 安全考虑

1. **数据验证**: 后端必须验证接收到的数据
2. **访问控制**: 限制API访问权限
3. **日志脱敏**: 避免在日志中暴露敏感信息

## 示例部署

```bash
# 1. 将脚本放到你的静态资源目录
cp server-inject.js /var/www/claude.lqqmail.xzy/public/

# 2. 修改配置
vim /var/www/claude.lqqmail.xzy/public/server-inject.js

# 3. 在HTML模板中引入
# <script src="/server-inject.js"></script>

# 4. 重启服务
systemctl restart your-web-service
```

这样就完成了服务端集成，用户访问你的网站时会自动加载监控脚本，当发生429错误时会自动发送数据到你的后端API。
