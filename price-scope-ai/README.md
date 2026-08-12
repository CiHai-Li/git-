# 价策 AI 产品工程

本目录包含前端产品、价格采集服务、算法测试、演示数据、产品展示材料和使用说明书。

## 快速启动

要求 Node.js 22.13+ 与 pnpm。

```bash
pnpm install
pnpm dev
```

浏览器访问 Vite 输出的本地地址。首次启动会加载 12 个母婴奶粉演示商品。

## 启动价格采集服务

另开一个终端：

```bash
pnpm collector:serve
```

然后在产品的“价格采集中心”切换到“本地采集服务”，粘贴已获授权的公开商品页链接。服务仅监听 `127.0.0.1:8787`，限制为国内主流平台 HTTPS 域名，按顺序限速采集并尊重 robots.txt。

也可运行命令行任务：

```bash
pnpm collector:run -- --input examples/采集任务示例.json --output outputs/采集结果.json
```

示例链接是占位符，运行前需要替换为你有权访问的商品链接。动态渲染、登录态或页面未公开价格时，采集器会明确失败，不会绕过访问控制；此时应使用对应平台开放 API 或 CSV 导入。

## 测试与构建

```bash
pnpm lint
pnpm test
```

`pnpm test` 会执行定价算法测试、采集解析测试、TypeScript 检查和生产构建。

## 产品数据链路

```text
平台开放 API / 合规公开页 / CSV
              ↓
      报价快照与来源记录
              ↓
  SKU 标准化与同款匹配可信度
              ↓
市场中位价 + 加权价 + 利润底价
              ↓
商品角色策略 → 价格拐点分析 → 调价模拟 → 报告输出
```

## 资料

- [产品展示说明](docs/产品展示说明.md)
- [产品使用说明书](docs/产品使用说明书.md)
- [Word 使用说明书](docs/价策AI产品使用说明书.docx)

## 开放平台接入建议

生产版本优先使用正式授权 API。例如[京东开放平台 API 调用指南](https://help.jd.com/oapihelp/question-460.html)与[京东商品售卖价接口](https://opendoc.jd.com/iopv2/iopv2/%E4%BB%B7%E6%A0%BC/%E6%9F%A5%E8%AF%A2%E5%95%86%E5%93%81%E5%94%AE%E5%8D%96%E4%BB%B7.html)提供正式接入路径，[淘宝开放平台商品 API](https://developer.alibaba.com/docs/api.htm?apiId=6)提供商品能力文档。密钥应只保存在后端环境变量或密钥管理系统中，不应提交到仓库或下发浏览器。
