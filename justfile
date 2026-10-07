default: build

# install dependencies
install:
    npm ci

# typecheck and build the single-file page into dist/index.html
build:
    npm run build

# unit tests (vitest)
test:
    npm test

# headless scenario comparison (give-way vs signals, both plans); optional seed
scenarios seed="1":
    npm run scenarios -- {{seed}}

# dev server with hot reload
dev:
    npm run dev

# build and serve the production file locally
serve: build
    npm run preview
