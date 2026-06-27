# 前端镜像：构建静态产物 → Nginx 托管
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# 生产启用真实后端；接口走相对路径 /api（由 Nginx 反代到后端）
ENV VITE_USE_API=true
ENV VITE_API_BASE=/api
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
