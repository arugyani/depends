default: build

# Build production bundle (main.js)
build:
    npm run build

# Watch and rebuild on save
dev:
    npm run dev

# Run all tests once
test:
    npm test

# Run tests in watch mode
test-watch:
    npm run test:watch

# TypeScript typecheck, no emit
typecheck:
    npm run typecheck

# Install npm dependencies
setup:
    npm install

# List all Obsidian vaults
vaults:
    ./scripts/install.sh vaults

# Pick a vault interactively, then install
pick:
    ./scripts/install.sh vaults verbose

# Install to a vault by name (e.g. `just install Notes`) or interactively if omitted
install vault="":
    ./scripts/install.sh install {{vault}}

# Remove build artifacts
clean:
    rm -f main.js *.js.map
