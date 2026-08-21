# 猫咪2048 项目文档

猫咪2048 微信小游戏的完整文档中心。

## 快速开始

- [项目总览 (根 README)](../README.md)
- 开发环境搭建：Node.js 20+、Python 3.9+、Cocos Creator 3.8.8、MySQL 8.0

## 核心文档

- [产品需求文档 (PRD)](./PRD.md) — 原 `doc.md`，产品需求与玩法说明
- [架构设计](./ARCHITECTURE.md) — 原 `PROJECT_OVERVIEW.md`，项目结构、技术栈与模块说明
- [API 文档](./API.md) — 后端接口说明（认证 / 玩家 / 排行榜）
- [开发指南](./DEVELOPMENT.md) — 环境准备、测试、配置管理、代码规范

## 脚本说明

`../scripts/README.md` — 资源处理与构建脚本的使用说明（含 Python 虚拟环境指南）。

## 历史文档归档

`./archive/` 目录存放阶段性临时文档：

- `P0_FIX_COMPLETED.md` / `P1_ERROR_FIX.md` / `P1_OPTIMIZATION_COMPLETED.md` — 历史修复记录
- `home_redesign_notes.md` / `HOME_UI_OPTIMIZATION_ANALYSIS.md` — 首页 UI 重设计记录
- `PROJECT_REFACTOR_PLAN.md` / `REFACTOR_INDEX.md` — 项目重整方案与索引（重整已完成，归档存档）

## 开发记录

`./superpowers/` 目录存放按日期组织的开发计划（plans）与设计文档（specs）。

## 文档维护规则

1. 代码改动必须同步更新相关文档
2. 临时性记录文档完成后移入 `archive/`
3. 根目录只保留必要的配置文件和 README
