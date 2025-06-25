
push:
	git push origin main

deploy: push
	ssh spierce@192.168.86.10 'zsh -c "cd code/h5-app; git pull && docker compose up --build -d"'
