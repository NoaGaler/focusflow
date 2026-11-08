# ---- 1. build the React site ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 2. serve it with nginx on port 3000 ----
FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx/default.conf.template /etc/nginx/templates-custom/default.conf.template
COPY nginx/start.sh /start.sh
COPY --from=build /app/dist /usr/share/nginx/html
ENV API_UPSTREAM=""
EXPOSE 3000
CMD ["/start.sh"]
