#/bin/bash

# Install only production dependencies
# pnpm install --prod --frozen-lockfile

# Install dependencies using NPM (issues with pnpm and mono repos, had to use npm)
npm install

# Archive essential files
zip -rv archive.zip ./package.json ./src ./node_modules

# Get base url argument from argument, defaults to localhost:3000
BASE_URL=${1:-http://localhost:3000}

# Upload to Jobber
curl \
  --silent \
  --show-error \
  --request POST \
  --url "$BASE_URL/api/job/publish/" \
  --header 'content-type: multipart/form-data' \
  --form 'archive=@archive.zip;type=application/zip'

rm archive.zip