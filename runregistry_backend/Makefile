setup:
	docker volume create nodemodules
install:
	docker-compose -f docker-compose.builder.yml run --rm install
dev:
	docker-compose -f docker-compose.development.yml up
prod:
# For production we concatenate the services and remove local postgres (since we are using db on demand postgres)
	docker-compose -f docker-compose.development.yml -f docker-compose.production.yml