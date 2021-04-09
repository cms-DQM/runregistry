# Run Registry Backend

This repository contains the API and all the microservices that compose the back end of Run Registry.

## Getting Started

To understand, debug and add new features to Run Registry set up a development environment in which you can run and modify the code without further consequences.

In order to do this you must clone this repository and run three commands from the Make file

```bash
git clone https://github.com/cms-DQM/runregistry/
cd runregistry_backend
make setup
make install
make dev
```

This will then run Run Registry Backend API in port 9500 along with the microservices that are enabled in the docker-compose.development.yml file.

It will also perform hot-reloading of the API, therefore any changes you make will automatically trigger a reload of the application with the new changes in place.

It will also open port 9229 as a debugging port. Based on the configuration in .vscode/launch.json you can debug using VS code. By default the `Docker: Attach to Node` configuration will work out of the box, after running `make dev`, feel free to set break-points in the code.

In order to stop all run registry services just press ctrl + c

Next time you want to run the backend, you just need to run `make dev`.

If you wish to understand how the docker files in this repository work, [read this article](https://jdlm.info/articles/2019/09/06/lessons-building-node-app-docker.html).

## Adding real data to your development environment's database

It is almost useless to test Run Registry without any data that your development backend can serve.

First, after running make dev command above, check if your database is running by connecting to it using a postgres client like postico or pgAdmin.

Now, in order to fill the local postgres database container with data, you must make an SQL dump of the contents of the production database and then upload them to your development postgres container.

To do this you must follow the following steps:

1. Set up a tunnel to lxplus so that you can connect to CERN network and bind a port from your local machine to the database machine (in this case we're using port 5433):

```bash
ssh -L localhost:5433:<production-url-of-database>:<port-of-production-database> <your-username>@lxplus.cern.ch
```

2. Make the dump using pg_dump to a .sql file (you must have postgres version >11 in your computer installed, along with pg_dump and psql). The dump might take a while to complete depending on how big the database is, at the moment of writing this, a dump is in the order of ~4 GB. You can always check progress by typing `watch "ls -ltrh"` in the folder where you are performing the command to see the size of the file increasing.

```bash
pg_dump -f dump.sql -d runregistry_database -U admin -h localhost -p 5433
# The password you must ask the DQM conveners to provide you with
```

3. Restore the dump.sql to the postgres docker container. If you already started the development environment using `make dev` before, make sure to delete the database and create it again using your postgres client (if not it will throw errors saying that the tables already exist), once the database is virginly created, and the admin role has been created, you can run the following command (this will also take a while depending on the size of the dump):

```bash
psql -h localhost -p 6543 -U hackathon -d runregistry_database -f dump.sql
```

Now if you run `make dev` the API will connect to a fresh copy of the production data of run registry running in your local postgres database container. Now, your local environment resembles the production environment as much as possible, you can run runregistry_frontend locally to then interact with your development API.

## The Stack

Run registry is a full-stack javascript application. Meaning both its front-end and back-end are written using JavaScript. There is also a python API pip client[https://github.com/fabioespinosa/runregistry_api_client] for users who want to acces

## Performing migrations

To migrate in development: docker-compose -f docker-compose.development.yml run dev npm run migrate
