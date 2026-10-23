# WeChatMiniProgram

存放多个微信小程序的仓库。每个小程序使用独立文件夹，互不干扰。

## 目录结构

```
WeChatMiniProgram/
├── README.md
├── .gitignore
└── <小程序名称>/                # 一个小程序一个文件夹
    ├── project.config.json      # 微信开发者工具导入该文件夹
    ├── miniprogram/             # 小程序源码
    ├── cloudfunctions/          # 云函数（如有）
    └── package.json
```

## 小程序列表

| 文件夹 | 说明 |
| --- | --- |
| `unit-price-compare` | 单价比价小程序：单位价格计算与比较、条形码查询、记录管理、多语言 |

## 新增一个小程序

1. 在仓库根目录新建一个文件夹，例如 `my-miniprogram`。
2. 在该文件夹内放置小程序项目，确保根目录包含 `project.config.json`。
3. 用微信开发者工具选择该文件夹导入项目。
4. 如果使用 npm 依赖，在对应文件夹内执行 `npm install`，然后在开发者工具中点击「工具 -> 构建 npm」。

不要在小程序文件夹之外共享 `node_modules`，每个小程序各自管理依赖。

## 开发 `unit-price-compare`

```bash
cd unit-price-compare
npm install
```

然后用微信开发者工具导入 `unit-price-compare` 文件夹。更新依赖后需重新执行「构建 npm」生成 `miniprogram/miniprogram_npm/`。
