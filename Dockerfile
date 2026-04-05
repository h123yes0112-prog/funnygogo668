FROM node:22-alpine

WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝相依套件 (乾淨安裝)
RUN npm i --omit=dev

# 複製專案原始碼 (不會複製 .gitignore 中排除的 node_modules)
COPY . .

# 開放通訊埠
EXPOSE 8080

# 固定給系統的環境變數
ENV PORT=8080
ENV NODE_ENV=production

# 啟動伺服器
CMD ["npm", "start"]
