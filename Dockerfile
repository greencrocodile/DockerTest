FROM node:16.20.1

COPY nodejs_auto_close_shutdown_archive /nodejs_auto_close_shutdown_archive 

COPY ssh/config /root/.ssh/config

COPY git_ivasiliev /root/.ssh/git_ivasiliev

RUN ssh-keyscan -H git.fortus.pro >> ~/.ssh/known_hosts

# RUN ssh -Tv git.fortus.pro

WORKDIR /nodejs_auto_close_shutdown_archive 

RUN npm ci

RUN rm -rf ~/.ssh

CMD ["npm", "start" ]

#docker build --no-cache -t myproject:latest .
#docker build -t myproject:latest .
#docker run -d --name myproject myproject:latest
#docker run -d -v ./logs:/nodejs_auto_close_shutdown_archive/logs --name myproject myproject:latest