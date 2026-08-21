#!/bin/bash
# 猫咪2048项目重整 - 第1阶段自动化脚本
# 功能：文档整理和目录重组

set -e  # 遇到错误立即退出

echo "========================================="
echo "  猫咪2048 项目重整 - 第1阶段"
echo "  文档整理和目录重组"
echo "========================================="
echo ""

# 检查是否在git仓库中
if [ ! -d .git ]; then
    echo "❌ 错误: 请在项目根目录执行此脚本"
    exit 1
fi

# 检查是否有未提交的改动
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  警告: 当前有未提交的改动"
    read -p "是否继续? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 创建备份分支
echo "📦 创建备份分支..."
BACKUP_BRANCH="backup/before-refactor-$(date +%Y%m%d-%H%M%S)"
git branch $BACKUP_BRANCH
echo "✅ 备份分支已创建: $BACKUP_BRANCH"
echo ""

# 创建新分支进行重构
echo "🌿 创建重构分支..."
REFACTOR_BRANCH="refactor/project-structure"
if git show-ref --verify --quiet refs/heads/$REFACTOR_BRANCH; then
    echo "⚠️  分支 $REFACTOR_BRANCH 已存在"
    read -p "是否删除并重新创建? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git branch -D $REFACTOR_BRANCH
    else
        exit 1
    fi
fi
git checkout -b $REFACTOR_BRANCH
echo "✅ 已切换到分支: $REFACTOR_BRANCH"
echo ""

# 第1步: 创建文档目录结构
echo "📁 步骤1: 创建文档目录..."
mkdir -p docs/archive
echo "✅ 目录已创建"
echo ""

# 第2步: 迁移核心文档
echo "📄 步骤2: 迁移核心文档..."
if [ -f doc.md ]; then
    git mv doc.md docs/PRD.md
    echo "  ✓ doc.md -> docs/PRD.md"
fi

if [ -f PROJECT_OVERVIEW.md ]; then
    git mv PROJECT_OVERVIEW.md docs/ARCHITECTURE.md
    echo "  ✓ PROJECT_OVERVIEW.md -> docs/ARCHITECTURE.md"
fi
echo ""

# 第3步: 归档临时文档
echo "📦 步骤3: 归档临时文档..."
ARCHIVE_FILES=(
    "P0_FIX_COMPLETED.md"
    "P1_ERROR_FIX.md"
    "P1_OPTIMIZATION_COMPLETED.md"
    "home_redesign_notes.md"
    "HOME_UI_OPTIMIZATION_ANALYSIS.md"
)

for file in "${ARCHIVE_FILES[@]}"; do
    if [ -f "$file" ]; then
        git mv "$file" "docs/archive/"
        echo "  ✓ $file -> docs/archive/"
    fi
done
echo ""

# 第4步: 重命名工具目录
echo "🛠️  步骤4: 重命名工具目录..."
if [ -d tools ]; then
    git mv tools scripts
    echo "  ✓ tools -> scripts"
else
    echo "  ⚠️  工具目录不存在，跳过"
fi
echo ""

# 第5步: 重命名美术资源目录
echo "🎨 步骤5: 重命名美术资源目录..."
if [ -d assets ] && [ ! -d assets/scripts ]; then
    echo "  检测到根目录的 assets/ 目录"
    read -p "  是否重命名为 resources/? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git mv assets resources
        echo "  ✓ assets -> resources"
    else
        echo "  ⊙ 跳过重命名"
    fi
else
    echo "  ⊙ 未找到需要重命名的资源目录"
fi
echo ""

# 第6步: 创建新的根README
echo "📝 步骤6: 创建新的根README..."
cat > README.md << 'READMEEOF'
# 猫咪2048 项目

一款基于 Cocos Creator 3.8.8 开发的微信小游戏，实现经典2048玩法的猫咪主题变体。

## 📚 文档导航

- [产品需求文档 (PRD)](./docs/PRD.md)
- [项目架构文档](./docs/ARCHITECTURE.md)
- [项目重整计划](./PROJECT_REFACTOR_PLAN.md)
- [快速执行指南](./REFACTOR_QUICK_GUIDE.md)
- [历史文档归档](./docs/archive/)

## 🚀 快速开始

### 环境要求
- Node.js 20+
- Python 3.9+ (资源处理需要)
- Cocos Creator 3.8.8
- MySQL 8.0 (开发后端时)

### 安装依赖
```bash
# 游戏项目
cd game
npm install

# 后端服务
cd server
npm install
```

### 运行游戏
1. 用 Cocos Creator 3.8.8 打开 `game/` 目录
2. 打开 `assets/main.scene`
3. 点击预览按钮运行游戏

### 运行后端
```bash
cd server
cp .env.example .env  # 配置环境变量
npm run prisma:deploy
npm run start:dev
```

## 📁 项目结构

```
cat2048/
├── docs/              # 📚 文档中心
│   ├── PRD.md         # 产品需求文档
│   ├── ARCHITECTURE.md # 架构设计文档
│   └── archive/       # 历史文档归档
├── game/              # 🎮 Cocos Creator游戏项目
│   ├── assets/        # 游戏资源和脚本
│   └── tests/         # 测试文件
├── server/            # 🔧 NestJS后端服务
│   ├── src/           # 源代码
│   └── prisma/        # 数据库Schema
└── scripts/           # 🛠️ 开发脚本
    ├── build/         # 构建脚本
    └── assets/        # 资源处理脚本
```

## 🧪 测试

```bash
# 游戏项目测试
cd game
npm run verify  # 类型检查 + 测试

# 后端测试
cd server
npm test
npm run test:e2e
```

## 📦 构建

### 微信小游戏构建
1. 用Cocos Creator打开游戏项目
2. 项目 -> 构建发布 -> 微信小游戏
3. 运行构建后脚本：
   ```bash
   cd game
   npm run customize:wechat-loading
   npm run verify:wechat-build
   ```
4. 用微信开发者工具打开 `game/build/wechatgame`

## 🤝 贡献指南

1. 提交前运行 `npm run verify` 确保代码质量
2. 遵循提交规范：`feat/fix/docs/refactor/test/chore: 描述`
3. 大型改动先创建Issue讨论

## 📄 许可证

Private - All Rights Reserved
READMEEOF

git add README.md
echo "  ✓ 新的 README.md 已创建"
echo ""

# 第7步: 更新 .gitignore
echo "🔒 步骤7: 更新 .gitignore..."
if [ -f .gitignore ]; then
    # 备份原文件
    cp .gitignore .gitignore.backup
    
    # 添加常见忽略项（如果不存在）
    cat >> .gitignore << 'GITIGNOREEOF'

# 项目重整后的额外忽略项
*.backup
.DS_Store
*.log
.vscode/settings.json
.idea/

# Python
__pycache__/
*.py[cod]
.pytest_cache/
.coverage

# 临时文件
*.tmp
*.swp
*~
GITIGNOREEOF

    echo "  ✓ .gitignore 已更新（原文件备份为 .gitignore.backup）"
else
    echo "  ⚠️  .gitignore 不存在，跳过"
fi
echo ""

# 提交改动
echo "💾 步骤8: 提交改动..."
git add .
git commit -m "refactor(stage1): 整理文档和目录结构

- 创建 docs/ 文档中心
- 迁移核心文档（PRD, ARCHITECTURE）
- 归档临时文档到 docs/archive/
- 重命名 tools -> scripts
- 更新根 README.md
- 更新 .gitignore
"
echo "✅ 改动已提交"
echo ""

# 显示完成信息
echo "========================================="
echo "  🎉 第1阶段完成！"
echo "========================================="
echo ""
echo "已完成的操作:"
echo "  ✓ 创建备份分支: $BACKUP_BRANCH"
echo "  ✓ 创建重构分支: $REFACTOR_BRANCH"
echo "  ✓ 整理文档到 docs/"
echo "  ✓ 归档临时文档"
echo "  ✓ 重命名工具目录为 scripts/"
echo "  ✓ 更新根 README.md"
echo "  ✓ 更新 .gitignore"
echo ""
echo "后续步骤:"
echo "  1. 运行测试验证: cd game && npm run verify"
echo "  2. 检查改动: git status"
echo "  3. 继续第2阶段: 参考 REFACTOR_QUICK_GUIDE.md"
echo "  4. 如需回退: git checkout $BACKUP_BRANCH"
echo ""
echo "查看完整计划: cat PROJECT_REFACTOR_PLAN.md"
echo "========================================="
