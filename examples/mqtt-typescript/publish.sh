#/bin/bash

# Install all dependencies
# pnpm install --frozen-lockfile

# Build application
# pnpm build

# Install only production dependencies
# pnpm install --prod --frozen-lockfile

# Install dependencies using NPM (issues with pnpm and mono repos, had to use npm)
npm install

# Build Package
npm run build

# Archive essential files
zip -rv archive.zip ./package.json ./dist ./src ./node_modules

# Upload to Jobber
curl \
  --silent \
  --show-error \
  --request POST \
  --url 'http://localhost:3000/api/job/publish/' \
  --header 'content-type: multipart/form-data' \
  --header 'Authorization: Bearer 2abb54173128350bdc916054f320a300c8b76bc873dd3c80301a02946f39c9e24bc824' \
  --form 'archive=@archive.zip;type=application/zip'

rm archive.zip