# 通知功能调试指南

## 问题诊断步骤

### 1. 检查扩展是否正确加载
1. 打开 `chrome://extensions/`
2. 确认 "Rate Limit Monitor" 扩展已启用
3. 点击"重新加载"按钮重新加载扩展
4. 检查是否有错误信息

### 2. 检查权限
1. 在扩展详情页面，确认以下权限已授予：
   - ✅ 存储
   - ✅ 活动标签页
   - ✅ 标签页
   - ✅ 通知 (这个很重要!)

### 3. 检查浏览器通知权限
1. 打开 Chrome 设置 → 隐私设置和安全性 → 网站设置 → 通知
2. 确认通知功能已启用
3. 检查是否有网站被阻止显示通知

### 4. 使用调试页面
1. 打开 `debug-notification.html`
2. 按 F12 打开开发者工具
3. 点击"检查权限"按钮
4. 查看控制台输出

### 5. 检查Background Script日志
1. 打开 `chrome://extensions/`
2. 找到 "Rate Limit Monitor" 扩展
3. 点击"检查视图"下的"Service Worker"
4. 在打开的开发者工具中查看控制台日志

## 常见问题解决

### 问题1: 没有任何通知显示
**可能原因:**
- 浏览器通知权限被禁用
- 扩展notifications权限未授予
- Background script未正确加载

**解决方法:**
1. 检查浏览器通知设置
2. 重新安装扩展
3. 检查manifest.json中的permissions

### 问题2: 通知权限错误
**错误信息:** `chrome.notifications is not available`

**解决方法:**
1. 确认manifest.json中包含 `"notifications"` 权限
2. 重新加载扩展
3. 检查Chrome版本是否支持

### 问题3: 后端发送失败但无通知
**可能原因:**
- showNotification函数执行出错
- 通知创建失败但错误被忽略

**解决方法:**
1. 查看Background Script控制台
2. 使用debug-notification.html测试
3. 检查网络连接

## 测试步骤

### 完整测试流程:
1. **重新加载扩展**
   ```
   chrome://extensions/ → 找到扩展 → 点击重新加载
   ```

2. **配置后端**
   - 点击扩展图标
   - 输入: `http://localhost:8787/api/rate-limit`
   - 勾选"启用后端发送"
   - 点击"保存配置" (应该看到配置通知)

3. **测试通知**
   - 打开 `debug-notification.html`
   - 点击"检查权限" (应该看到权限测试通知)
   - 点击"测试基础通知" (应该看到测试通知)

4. **测试完整流程**
   - 点击"测试Rate Limit检测"
   - 应该看到: 检测通知 → 发送中通知 → 成功/失败通知

## 调试命令

在Background Script控制台中运行:

```javascript
// 测试通知API
chrome.notifications.create('test', {
  type: 'basic',
  iconUrl: 'icon48.png',
  title: '测试',
  message: '这是一个测试通知'
});

// 检查后端配置
console.log('Backend config:', backendConfig);

// 手动触发通知
showNotification('test', {
  title: '手动测试',
  message: '这是手动触发的通知'
});
```

## 预期行为

### 正常情况下应该看到:
1. **配置保存时**: "⚙️ 后端配置已更新" 通知
2. **检测到429时**: "🚫 检测到Rate Limit" 通知
3. **开始发送时**: "📡 正在发送数据" 通知
4. **发送成功时**: "✅ 发送成功" 通知
5. **发送失败时**: "❌ 发送失败" 或 "❌ 网络错误" 通知

### 通知特征:
- 出现在屏幕右下角
- 包含扩展图标
- 3-5秒后自动消失
- 可以点击关闭

如果以上步骤都无法解决问题，请提供:
1. Chrome版本
2. 操作系统
3. Background Script控制台的完整日志
4. 是否有任何错误信息
