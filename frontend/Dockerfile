FROM node:20.19-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5173

# --host is crucial to expose the Vite server outside the container
CMD ["npm", "run", "dev", "--", "--host"]
